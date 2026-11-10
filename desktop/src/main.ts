import { inTauri } from "./env";
import { createMock } from "./mock";
import { createTauriBackend } from "./tauri-backend";
import type { Backend, LibraryItem, LiveSample, Settings, Snapshot, StagedFile } from "./types";
import { fuelText, paintConfigAnalysis, paintExtras, updateLiveOverlay } from "./extra";
import rawSchedule from "./season_schedule_2026_s4.json";

interface ScheduleDoc {
  current_week?: number;
  series?: Array<{
    weeks?: Array<{ week_num: number; track_name: string }>;
  }>;
}

const sched = rawSchedule as unknown as ScheduleDoc;

// Track to Week mapping from official 2026 Season 4 PDF
const trackToWeeks = new Map<string, number[]>();
if (sched && Array.isArray(sched.series)) {
  for (const s of sched.series) {
    for (const w of s.weeks || []) {
      const cleanTrack = String(w.track_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanTrack) {
        const list = trackToWeeks.get(cleanTrack) ?? [];
        if (!list.includes(w.week_num)) list.push(w.week_num);
        trackToWeeks.set(cleanTrack, list);
      }
    }
  }
}

export function findWeekForTrack(track: string): number | null {
  const clean = String(track || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!clean) return null;
  for (const [t, weeks] of trackToWeeks) {
    if (clean.includes(t) || t.includes(clean)) {
      return weeks[0] ?? null;
    }
  }
  return null;
}

export function classifyCar(carFolder: string): "SPORTS CAR" | "FORMULA CAR" | "OVAL" | "DIRT" {
  const c = String(carFolder || "").toLowerCase();
  if (c.includes("dirt") || c.includes("rally") || c.includes("pro2") || c.includes("pro4") || c.includes("offroad") || c.includes("beetlerx")) {
    return "DIRT";
  }
  if (c.includes("formula") || c.includes("f3") || c.includes("f4") || c.includes("sf23") || c.includes("sflights") || c.includes("pm18") || c.includes("usf2000") || c.includes("ir01") || c.includes("ir18") || c.includes("dallarair") || c.includes("lotus") || c.includes("ff1600") || c.includes("skipbarber")) {
    return "FORMULA CAR";
  }
  if (c.includes("nascar") || c.includes("truck") || c.includes("arca") || c.includes("skmod") || c.includes("tourmod") || c.includes("legends") || c.includes("latemodel") || c.includes("superlate") || c.includes("srx") || c.includes("ministock") || c.includes("streetstock")) {
    return "OVAL";
  }
  return "SPORTS CAR";
}

const params = new URLSearchParams(location.search);
const screen = params.get("screen");
const backend: Backend = inTauri() ? createTauriBackend() : createMock(screen);

const $ = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta #${id}`);
  return node as T;
};

const viewLogin = $("viewLogin");
const viewApp = $("viewApp");
const viewLibrary = $("viewLibrary");
const viewUpload = $("viewUpload");
const viewSettings = $("viewSettings");
const libraryEl = $("library");
const notice = $("notice");

let snapshot: Snapshot | null = null;
let filter: "all" | "Race" | "Qualy" | "Wet" | "Fav" = "all";
let query = "";
let pollTimer = 0;
let view: "library" | "upload" | "settings" | "week" | "analysis" | "reference" | "strategy" | "overlays" | "team" | "config" = "library";

let libraryGroupBy: "car" | "track" | "week" = (() => {
  try {
    const val = localStorage.getItem("mmt-library-groupby");
    if (val === "car" || val === "track" || val === "week") return val;
  } catch {}
  return "car";
})();

let activeCatFilter = (() => {
  try {
    return localStorage.getItem("mmt-active-cat-filter") || "all";
  } catch {}
  return "all";
})();

let userPreferences: string[] = (() => {
  try {
    const raw = localStorage.getItem("mmt-user-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return ["SPORTS CAR", "FORMULA CAR", "OVAL", "DIRT"];
})();

let lastLiveSample = 0;

function updateLiveStatus(sample: LiveSample): void {
  lastLiveSample = Date.now();
  const badge = document.getElementById("irBadge");
  const dot = document.getElementById("irDot");
  const text = document.getElementById("irText");
  if (badge && dot && text) {
    dot.className = "w-2 h-2 rounded-full bg-r-accent animate-pulse";
    text.textContent = "iRacing activo";
    badge.classList.add("text-r-accent", "border-r-accent/40");
    badge.classList.remove("text-r-muted", "border-r-line");
  }
  updateLiveOverlay(sample);
}

setInterval(() => {
  if (Date.now() - lastLiveSample > 2500) {
    const badge = document.getElementById("irBadge");
    const dot = document.getElementById("irDot");
    const text = document.getElementById("irText");
    if (badge && dot && text) {
      dot.className = "w-2 h-2 rounded-full bg-r-muted";
      text.textContent = "iRacing en espera";
      badge.classList.remove("text-r-accent", "border-r-accent/40");
      badge.classList.add("text-r-muted", "border-r-line");
    }
  }
}, 1000);

function theme(): "dark" | "light" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(next: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("mmt-sync-theme", next);
  } catch {
    /* la preferencia visual no es un secreto */
  }
  const toggle = $("themeToggle");
  toggle.textContent = next === "light" ? "Tema oscuro" : "Tema claro";
  toggle.setAttribute("aria-pressed", next === "light" ? "true" : "false");
}

let noticeTimeout = 0;
function showNotice(message: string, isError = false): void {
  window.clearTimeout(noticeTimeout);
  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    return;
  }
  notice.hidden = false;
  notice.textContent = message;
  if (isError) {
    notice.className = "mx-5 mt-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-300 px-4 py-3 text-sm flex items-center justify-between";
  } else {
    notice.className = "mx-5 mt-4 rounded-xl border border-r-accent/40 bg-r-accent/10 text-r-accent px-4 py-3 text-sm flex items-center justify-between";
    noticeTimeout = window.setTimeout(() => {
      notice.hidden = true;
    }, 5000);
  }
}

function kindKey(kind: string): "Race" | "Qualy" | "Wet" | "other" {
  const value = kind.trim().toLowerCase();
  if (value === "race" || value === "carrera") return "Race";
  if (value === "qualy" || value === "quali" || value === "clasificacion" || value === "clasificación") return "Qualy";
  if (value === "wet" || value === "lluvia") return "Wet";
  return "other";
}

const KIND_LABEL: Record<string, string> = {
  Race: "Carrera",
  Qualy: "Clasificación",
  Wet: "Lluvia",
  other: "Otros",
};

const STATE_LABEL: Record<LibraryItem["state"], string> = {
  nuevo: "Nuevo",
  actualizado: "Actualizado",
  al_dia: "Al día",
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024).toLocaleString("es-ES", { maximumFractionDigits: 0 })} KB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Todavía no se ha sincronizado.";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `Última sincronización: ${iso}`;
  return `Última sincronización: ${date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}`;
}

function setNav(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
    const on = button.dataset.nav === view;
    button.classList.toggle("text-r-accent", on);
    button.classList.toggle("text-r-muted", !on);
    button.setAttribute("aria-current", on ? "page" : "false");
  });
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    const on = button.dataset.filter === filter;
    button.classList.toggle("bg-r-accent", on);
    button.classList.toggle("text-r-ink", on);
    button.classList.toggle("border-r-accent", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function paintLibrary(): void {
  const allItems = snapshot?.library ?? [];

  // Filter items
  const items = allItems.filter((entry) => {
    // Kind filter
    const key = kindKey(entry.kind);
    if (filter === "Fav") {
      if (!snapshot?.settings.favourites.includes(entry.id)) return false;
    } else if (filter !== "all" && key !== filter) {
      return false;
    }

    // Category filter
    const carCat = classifyCar(entry.carFolder);
    if (activeCatFilter === "MY_CATS") {
      if (!userPreferences.includes(carCat)) return false;
    } else if (activeCatFilter !== "all" && carCat !== activeCatFilter) {
      return false;
    }

    // Search query
    if (query) {
      const q = query.trim().toLowerCase();
      const haystack = `${entry.car} ${entry.carFolder} ${entry.track} ${entry.filename} ${entry.season} ${entry.kind}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  // Update Stats and UI Badges
  const countText = document.getElementById("libCountText");
  const filterNote = document.getElementById("libFilterNote");
  if (countText) {
    countText.textContent = `${items.length} de ${allItems.length} setups disponibles`;
  }
  if (filterNote) {
    if (activeCatFilter === "MY_CATS") {
      filterNote.textContent = `⭐ Mis categorías (${userPreferences.length} activas)`;
    } else if (activeCatFilter !== "all") {
      filterNote.textContent = `Filtrando: ${activeCatFilter}`;
    } else {
      filterNote.textContent = "";
    }
  }

  // Update pill active styling
  document.querySelectorAll<HTMLButtonElement>("[data-cat-toggle]").forEach((btn) => {
    const isAct = btn.dataset.catToggle === activeCatFilter;
    btn.className = isAct
      ? "h-8 px-3 rounded-lg border border-r-accent bg-r-accent/15 text-r-accent font-semibold transition"
      : "h-8 px-3 rounded-lg border border-r-line bg-r-bg text-r-muted hover:text-r-text transition";
  });

  document.querySelectorAll<HTMLButtonElement>("[data-group]").forEach((btn) => {
    const isAct = btn.dataset.group === libraryGroupBy;
    btn.className = isAct
      ? "h-7 px-3 rounded-lg bg-r-surface text-r-accent font-semibold shadow-sm transition"
      : "h-7 px-3 rounded-lg text-r-muted hover:text-r-text transition";
  });

  libraryEl.replaceChildren();

  if (items.length === 0) {
    $("libraryEmpty").hidden = false;
    return;
  }
  $("libraryEmpty").hidden = true;

  if (libraryGroupBy === "car") {
    paintGroupedByCar(items);
  } else if (libraryGroupBy === "track") {
    paintGroupedByTrack(items);
  } else if (libraryGroupBy === "week") {
    paintGroupedByWeek(items);
  }
}

function paintGroupedByCar(items: LibraryItem[]): void {
  const groups = new Map<string, LibraryItem[]>();
  for (const entry of items) {
    const list = groups.get(entry.car) ?? [];
    list.push(entry);
    groups.set(entry.car, list);
  }

  const sortedCars = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  for (const car of sortedCars) {
    const rows = groups.get(car) ?? [];
    const section = document.createElement("section");
    section.className = "rounded-2xl border border-r-line bg-r-surface overflow-hidden transition hover:border-r-line-2 shadow-sm";

    const header = document.createElement("div");
    header.className = "px-4 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/40";

    const left = document.createElement("div");
    left.className = "flex items-center gap-2.5";
    const icon = document.createElement("span");
    icon.className = "text-base";
    icon.textContent = "🏎️";

    const heading = document.createElement("h2");
    heading.className = "text-lg font-bold text-r-text tracking-wide";
    heading.textContent = car;
    left.append(icon, heading);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2 font-mono text-[11px]";

    const catBadge = document.createElement("span");
    const cat = classifyCar(rows[0]?.carFolder || car);
    catBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-surface text-r-muted uppercase tracking-wider";
    catBadge.textContent = cat;

    const countBadge = document.createElement("span");
    countBadge.className = "px-2.5 py-0.5 rounded-full bg-r-accent/15 text-r-accent font-semibold";
    countBadge.textContent = `${rows.length} setups`;

    right.append(catBadge, countBadge);
    header.append(left, right);
    section.append(header);

    const list = document.createElement("ul");
    list.className = "divide-y divide-r-line/50";
    for (const row of rows) {
      list.append(rowView(row, false));
    }
    section.append(list);
    libraryEl.append(section);
  }
}

function paintGroupedByTrack(items: LibraryItem[]): void {
  const groups = new Map<string, LibraryItem[]>();
  for (const entry of items) {
    const track = entry.track.trim() || "Circuito general";
    const list = groups.get(track) ?? [];
    list.push(entry);
    groups.set(track, list);
  }

  const sortedTracks = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  for (const track of sortedTracks) {
    const rows = groups.get(track) ?? [];
    const section = document.createElement("section");
    section.className = "rounded-2xl border border-r-line bg-r-surface overflow-hidden transition hover:border-r-line-2 shadow-sm";

    const header = document.createElement("div");
    header.className = "px-4 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/40";

    const left = document.createElement("div");
    left.className = "flex items-center gap-2.5";
    const icon = document.createElement("span");
    icon.className = "text-base";
    icon.textContent = "📍";

    const heading = document.createElement("h2");
    heading.className = "text-lg font-bold text-r-text tracking-wide";
    heading.textContent = track;
    left.append(icon, heading);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2 font-mono text-[11px]";

    const weekNum = findWeekForTrack(track);
    if (weekNum) {
      const weekBadge = document.createElement("span");
      const isCur = weekNum === (sched.current_week || 9);
      weekBadge.className = isCur
        ? "px-2 py-0.5 rounded bg-r-accent text-r-ink font-bold uppercase tracking-wider"
        : "px-2 py-0.5 rounded border border-r-line bg-r-surface text-r-muted uppercase tracking-wider";
      weekBadge.textContent = isCur ? `Semana ${weekNum} · ACTUAL` : `Semana ${weekNum}`;
      right.append(weekBadge);
    }

    const countBadge = document.createElement("span");
    countBadge.className = "px-2.5 py-0.5 rounded-full bg-r-accent/15 text-r-accent font-semibold";
    countBadge.textContent = `${rows.length} setups`;

    right.append(countBadge);
    header.append(left, right);
    section.append(header);

    const list = document.createElement("ul");
    list.className = "divide-y divide-r-line/50";
    for (const row of rows) {
      list.append(rowView(row, true));
    }
    section.append(list);
    libraryEl.append(section);
  }
}

function paintGroupedByWeek(items: LibraryItem[]): void {
  const weekDates: Record<number, string> = {
    1: "15 sep", 2: "22 sep", 3: "29 sep", 4: "06 oct",
    5: "13 oct", 6: "20 oct", 7: "27 oct", 8: "03 nov",
    9: "10 nov", 10: "17 nov", 11: "24 nov", 12: "01 dic",
  };

  const groups = new Map<number | string, LibraryItem[]>();
  for (const entry of items) {
    const w = findWeekForTrack(entry.track);
    const key = w ?? "Otras semanas";
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const cur = sched.current_week || 9;
  const orderedKeys: Array<number | string> = [];
  if (groups.has(cur)) orderedKeys.push(cur);
  for (let w = 1; w <= 12; w++) {
    if (w !== cur && groups.has(w)) orderedKeys.push(w);
  }
  if (groups.has("Otras semanas")) orderedKeys.push("Otras semanas");

  for (const key of orderedKeys) {
    const rows = groups.get(key) ?? [];
    const section = document.createElement("section");
    const isCur = key === cur;
    section.className = isCur
      ? "rounded-2xl border-2 border-r-accent bg-r-surface overflow-hidden shadow-lg shadow-r-accent/5 transition"
      : "rounded-2xl border border-r-line bg-r-surface overflow-hidden shadow-sm transition";

    const header = document.createElement("div");
    header.className = isCur
      ? "px-4 py-3.5 border-b border-r-accent/30 flex flex-wrap items-center justify-between gap-3 bg-r-accent/10"
      : "px-4 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/40";

    const left = document.createElement("div");
    left.className = "flex items-center gap-2.5";
    const icon = document.createElement("span");
    icon.className = "text-base";
    icon.textContent = isCur ? "🔥" : "📅";

    const heading = document.createElement("h2");
    heading.className = "text-lg font-bold text-r-text tracking-wide";
    if (typeof key === "number") {
      heading.textContent = `Semana ${key} (${weekDates[key] ?? ""})${isCur ? " · SEMANA ACTUAL" : ""}`;
    } else {
      heading.textContent = "Otras semanas y eventos especiales";
    }
    left.append(icon, heading);

    const countBadge = document.createElement("span");
    countBadge.className = isCur
      ? "px-2.5 py-0.5 rounded-full bg-r-accent text-r-ink font-mono text-[11px] font-extrabold uppercase"
      : "px-2.5 py-0.5 rounded-full bg-r-accent/15 text-r-accent font-mono text-[11px] font-semibold";
    countBadge.textContent = `${rows.length} setups`;

    header.append(left, countBadge);
    section.append(header);

    const list = document.createElement("ul");
    list.className = "divide-y divide-r-line/50";
    for (const row of rows) {
      list.append(rowView(row, true));
    }
    section.append(list);
    libraryEl.append(section);
  }
}

function rowView(row: LibraryItem, showCarName: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-r-bg/50 transition";

  const left = document.createElement("div");
  left.className = "min-w-0 flex-1";

  const topRow = document.createElement("div");
  topRow.className = "flex flex-wrap items-center gap-2";

  const kKey = kindKey(row.kind);
  const dot = document.createElement("span");
  dot.className =
    kKey === "Race"
      ? "w-2 h-2 rounded-full bg-emerald-400 shrink-0"
      : kKey === "Qualy"
        ? "w-2 h-2 rounded-full bg-sky-400 shrink-0"
        : kKey === "Wet"
          ? "w-2 h-2 rounded-full bg-cyan-400 shrink-0"
          : "w-2 h-2 rounded-full bg-r-muted shrink-0";

  const name = document.createElement("span");
  name.className = "font-mono text-sm font-medium text-r-text truncate";
  name.textContent = row.filename;

  topRow.append(dot, name);

  const pills = document.createElement("div");
  pills.className = "mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-r-muted font-mono";

  if (showCarName) {
    const carPill = document.createElement("span");
    carPill.className = "px-2 py-0.5 rounded bg-r-bg text-r-text font-medium border border-r-line/60";
    carPill.textContent = row.car;
    pills.append(carPill);
  }

  const trackPill = document.createElement("span");
  trackPill.className = "px-2 py-0.5 rounded bg-r-bg text-r-accent border border-r-line/60";
  trackPill.textContent = `📍 ${row.track}`;

  const kindPill = document.createElement("span");
  kindPill.className =
    kKey === "Race"
      ? "px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      : kKey === "Qualy"
        ? "px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20"
        : kKey === "Wet"
          ? "px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
          : "px-2 py-0.5 rounded bg-r-bg text-r-muted border border-r-line/60";
  kindPill.textContent = KIND_LABEL[kKey] ?? row.kind;

  const sizePill = document.createElement("span");
  sizePill.className = "text-[11px] text-r-muted";
  sizePill.textContent = `${row.season} · ${formatBytes(row.size)}`;

  pills.append(trackPill, kindPill, sizePill);
  left.append(topRow, pills);

  const right = document.createElement("div");
  right.className = "flex items-center gap-2.5 shrink-0";

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  const isFav = snapshot?.settings.favourites.includes(row.id) ?? false;
  favBtn.className = isFav
    ? "p-1.5 rounded-lg text-amber-400 hover:scale-110 transition text-base leading-none"
    : "p-1.5 rounded-lg text-r-muted/40 hover:text-amber-400 hover:scale-110 transition text-base leading-none";
  favBtn.title = isFav ? "Quitar de favoritos" : "Marcar como favorito";
  favBtn.textContent = isFav ? "★" : "☆";
  favBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!snapshot) return;
    const favs = snapshot.settings.favourites;
    if (favs.includes(row.id)) {
      snapshot.settings.favourites = favs.filter((id) => id !== row.id);
    } else {
      snapshot.settings.favourites = [...favs, row.id];
    }
    void persistSettings().then(() => {
      paintLibrary();
    });
  });

  const stateBadge = document.createElement("span");
  const state = row.state;
  stateBadge.className =
    state === "nuevo"
      ? "px-2.5 py-0.5 rounded-full bg-r-accent text-r-ink font-mono text-[10px] uppercase font-bold"
      : state === "actualizado"
        ? "px-2.5 py-0.5 rounded-full border border-r-accent text-r-accent font-mono text-[10px] uppercase font-semibold"
        : "px-2 py-0.5 rounded text-r-muted/70 font-mono text-[10px] uppercase";
  stateBadge.textContent = STATE_LABEL[state] ?? state;

  right.append(favBtn, stateBadge);
  li.append(left, right);
  return li;
}

function paint(data: Snapshot): void {
  snapshot = data;
  $("demoChip").hidden = !data.mock;
  $("offlineChip").hidden = !data.offline;
  const logged = Boolean(data.pilot);
  viewLogin.hidden = logged;
  viewApp.hidden = !logged;
  $("appNav").hidden = !logged;
  $("pilotLine").textContent = data.pilot ? `${data.pilot.name} · ${data.pilot.slug}` : "Muntrume Motorsport";
  applyTheme(data.settings.theme === "light" ? "light" : themeFromSettings(data));
  const status = $( "syncStatus");
  status.textContent = formatWhen(data.lastSyncRfc3339);
  if (data.lastDownloaded > 0 && data.lastCars.length > 0) {
    status.textContent += ` · ${data.lastDownloaded} sincronizados: ${data.lastCars.join(", ")}`;
  }
  paintLibrary();
  paintExtras(data);
  paintStaged(data.staged);
  paintSettings(data);
  if (data.updateVersion) {
    $("updateBar").hidden = false;
    $("updateText").textContent = `Hay una actualización: ${data.updateVersion}`;
  }
  showView(logged ? view : "library");
}

function themeFromSettings(data: Snapshot): "dark" | "light" {
  return data.settings.theme === "light" ? "light" : "dark";
}

function paintStaged(staged: StagedFile | null): void {
  $("stagedName").textContent = staged
    ? `${staged.filename} · ${formatBytes(staged.size)}`
    : "Como máximo 1 MB.";
}

function paintSettings(data: Snapshot): void {
  $("folderPath").textContent = data.settings.setupsDir || "Sin carpeta";
  $("folderWarn").hidden = data.folderExists || data.settings.setupsDir.length === 0;
  press("autoSync", data.settings.autoSync);
  press("deleteRetired", data.settings.deleteRetired);
  press("startWindows", data.settings.startWithWindows);
  ($("interval") as HTMLInputElement).value = String(data.settings.intervalMinutes);

  const container = document.getElementById("settingsCatToggles");
  if (container) {
    container.querySelectorAll<HTMLInputElement>("input[data-settings-cat]").forEach((cb) => {
      const cat = cb.dataset.settingsCat;
      if (cat) {
        cb.checked = userPreferences.includes(cat);
      }
    });
  }
}

function press(id: string, on: boolean): void {
  $(id).setAttribute("aria-pressed", on ? "true" : "false");
}

function showView(next: typeof view): void {
  view = next;
  for (const id of ["viewLibrary", "viewUpload", "viewSettings", "viewWeek", "viewAnalysis", "viewReference", "viewStrategy", "viewOverlays", "viewTeam"] as const) {
    const node = document.getElementById(id);
    if (node) node.hidden = id !== `view${next[0].toUpperCase()}${next.slice(1)}` && !(next === "library" && id === "viewLibrary") && !(next === "upload" && id === "viewUpload") && !(next === "settings" && id === "viewSettings") && !(next === "week" && id === "viewWeek") && !(next === "analysis" && id === "viewAnalysis") && !(next === "reference" && id === "viewReference") && !(next === "strategy" && id === "viewStrategy") && !(next === "overlays" && id === "viewOverlays") && !(next === "team" && id === "viewTeam");
  }
  viewLibrary.hidden = next !== "library";
  viewUpload.hidden = next !== "upload";
  viewSettings.hidden = next !== "settings";
  const extra: Record<string, string> = {
    week: "viewWeek",
    analysis: "viewAnalysis",
    reference: "viewReference",
    strategy: "viewStrategy",
    overlays: "viewOverlays",
    config: "viewConfig",
    team: "viewTeam",
  };
  for (const [name, id] of Object.entries(extra)) {
    const node = document.getElementById(id);
    if (node) node.hidden = next !== name;
  }
  if (next === "config") {
    void loadConfigAnalysis();
  }
  setNav();
}

async function loadConfigAnalysis(): Promise<void> {
  try {
    const analysis = await backend.inspectConfig();
    paintConfigAnalysis(analysis);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudo analizar la configuración de iRacing.");
  }
}

async function refresh(): Promise<void> {
  paint(await backend.snapshot());
}

async function settingsPatch(): Promise<Settings> {
  const current = snapshot?.settings;
  const themeNow = theme();
  return backend.saveSettings({
    intervalMinutes: Number(($("interval") as HTMLInputElement).value) || current?.intervalMinutes || 30,
    autoSync: $("autoSync").getAttribute("aria-pressed") === "true",
    deleteRetired: $("deleteRetired").getAttribute("aria-pressed") === "true",
    startWithWindows: $("startWindows").getAttribute("aria-pressed") === "true",
    theme: themeNow,
    disabledCars: current?.disabledCars ?? [],
    favourites: current?.favourites ?? [],
    modules: current?.modules ?? {
      overlays: true,
      analysis: true,
      referenceLaps: false,
      weekly: true,
      strategy: true,
      team: false,
      reviewAlerts: false,
    },
    checklist: current?.checklist ?? [],
  });
}

async function persistSettings(): Promise<void> {
  try {
    const saved = await settingsPatch();
    if (snapshot) snapshot = { ...snapshot, settings: saved };
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No se pudieron guardar los ajustes.");
  }
}

function stopPoll(): void {
  window.clearInterval(pollTimer);
  pollTimer = 0;
}

async function beginLink(): Promise<void> {
  showNotice("");
  const started = await backend.authStart();
  $("userCode").textContent = started.userCode;
  $("loginStart").hidden = true;
  $("loginPending").hidden = false;
  $("mockApprove").hidden = inTauri();
  $("pollStatus").textContent = "Esperando autorización…";
  try {
    await backend.openVerify();
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "No pude abrir el navegador.");
  }
  stopPoll();
  const wait = Math.max(1, started.interval) * 1000;
  pollTimer = window.setInterval(() => {
    void pollOnce();
  }, wait);
}

async function pollOnce(): Promise<void> {
  try {
    const result = await backend.authPoll();
    if (result.status === "pending") {
      $("pollStatus").textContent = "Esperando autorización…";
      return;
    }
    stopPoll();
    if (result.status === "expired") {
      $("pollStatus").textContent = "El código ha caducado. Empieza de nuevo.";
      return;
    }
    await refresh();
    showView("library");
  } catch (error) {
    stopPoll();
    showNotice(error instanceof Error ? error.message : "No se pudo completar la vinculación.");
  }
}

function readStoFile(file: File): void {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".sto") || file.size <= 0 || file.size > 1024 * 1024) {
    showNotice("El archivo tiene que ser .sto y pesar como máximo 1 MB.");
    return;
  }
  if (inTauri()) return;
  void backend.pickSto().then((staged) => {
    paintStaged(staged);
    showNotice("");
  });
}

function bind(): void {
  document.addEventListener("mmt-module", (event) => {
    const key = (event as CustomEvent<keyof Settings["modules"]>).detail;
    if (!snapshot) return;
    snapshot.settings.modules[key] = !snapshot.settings.modules[key];
    void persistSettings().then(() => {
      if (snapshot) paintExtras(snapshot);
    });
  });
  $("themeToggle").addEventListener("click", () => {
    applyTheme(theme() === "light" ? "dark" : "light");
    if (snapshot?.pilot) void persistSettings();
  });
  $("linkBtn").addEventListener("click", () => {
    void beginLink().catch((error: unknown) => {
      showNotice(error instanceof Error ? error.message : "No se pudo empezar la vinculación.");
    });
  });
  $("openBrowser").addEventListener("click", () => {
    void backend.openVerify().catch((error: unknown) => {
      showNotice(error instanceof Error ? error.message : "No pude abrir el navegador.");
    });
  });
  $("cancelLink").addEventListener("click", () => {
    stopPoll();
    void backend.authCancel();
    $("loginPending").hidden = true;
    $("loginStart").hidden = false;
  });
  $("mockApprove").addEventListener("click", () => {
    void pollOnce();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.nav;
      if (next === "library" || next === "upload" || next === "settings" || next === "week" || next === "analysis" || next === "reference" || next === "strategy" || next === "overlays" || next === "team" || next === "config") showView(next);
    });
  });
  const btnRefreshCfg = document.getElementById("btnRefreshConfig");
  if (btnRefreshCfg) {
    btnRefreshCfg.addEventListener("click", () => {
      void loadConfigAnalysis();
    });
  }
  $("syncBtn").addEventListener("click", () => {
    const button = $("syncBtn");
    button.setAttribute("aria-busy", "true");
    const syncText = document.getElementById("syncText");
    const syncIcon = document.getElementById("syncIcon");
    if (syncText) syncText.textContent = "Sincronizando…";
    if (syncIcon) syncIcon.className = "animate-spin inline-block";
    showNotice("");

    void backend
      .syncNow()
      .then(async (report) => {
        const isErr = report.message.toLowerCase().includes("incompleta") || report.message.toLowerCase().includes("error");
        showNotice(report.message, isErr);
        await refresh();
      })
      .catch((error: unknown) => {
        showNotice(error instanceof Error ? error.message : "La sincronización no se completó.", true);
      })
      .finally(() => {
        button.removeAttribute("aria-busy");
        if (syncText) syncText.textContent = "Sincronizar ahora";
        if (syncIcon) syncIcon.className = "";
      });
  });
  $("search").addEventListener("input", () => {
    query = ($("search") as HTMLInputElement).value;
    paintLibrary();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.filter;
      if (value === "all" || value === "Race" || value === "Qualy" || value === "Wet" || value === "Fav") {
        filter = value;
        setNav();
        paintLibrary();
      }
    });
  });
  const catPills = document.getElementById("userCategoryPills");
  if (catPills) {
    catPills.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn || !btn.dataset.catToggle) return;
      activeCatFilter = btn.dataset.catToggle;
      try {
        localStorage.setItem("mmt-active-cat-filter", activeCatFilter);
      } catch {}
      paintLibrary();
    });
  }
  const groupPills = document.getElementById("groupByPills");
  if (groupPills) {
    groupPills.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn || !btn.dataset.group) return;
      libraryGroupBy = btn.dataset.group as "car" | "track" | "week";
      try {
        localStorage.setItem("mmt-library-groupby", libraryGroupBy);
      } catch {}
      paintLibrary();
    });
  }
  const settingsCatToggles = document.getElementById("settingsCatToggles");
  if (settingsCatToggles) {
    settingsCatToggles.addEventListener("change", () => {
      const checkedBoxes = settingsCatToggles.querySelectorAll<HTMLInputElement>("input[data-settings-cat]:checked");
      userPreferences = Array.from(checkedBoxes).map((c) => c.dataset.settingsCat!);
      if (userPreferences.length === 0) {
        userPreferences = ["SPORTS CAR", "FORMULA CAR", "OVAL", "DIRT"];
      }
      try {
        localStorage.setItem("mmt-user-categories", JSON.stringify(userPreferences));
      } catch {}
      paintLibrary();
    });
  }
  const drop = $("dropZone");
  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) readStoFile(file);
  });
  $("pickSto").addEventListener("click", () => {
    if (inTauri()) {
      void backend.pickSto().then((staged) => {
        if (staged) paintStaged(staged);
      });
      return;
    }
    ($("stoInput") as HTMLInputElement).click();
  });
  $("stoInput").addEventListener("change", () => {
    const file = ($("stoInput") as HTMLInputElement).files?.[0];
    if (file) readStoFile(file);
  });
  $("notes").addEventListener("input", () => {
    const count = ($("notes") as HTMLTextAreaElement).value.length;
    $("notesCount").textContent = `${count} / 280`;
  });
  $("fuelForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
    $("fuelOut").textContent = fuelText(num("raceMin"), num("lapSec"), num("fuelLap"), num("tank"), num("fuelNow"));
  });
  $("refPack").addEventListener("click", () => {
    $("refResult").textContent = "Paquete de demostración preparado en memoria. No se ha enviado: el endpoint no existe y el módulo sigue apagado por defecto.";
  });
  $("uploadForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const carFolder = ($("carFolder") as HTMLInputElement).value.trim();
    const track = ($("track") as HTMLInputElement).value.trim();
    const kind = ($("kind") as HTMLSelectElement).value;
    const notes = ($("notes") as HTMLTextAreaElement).value;
    void backend
      .upload({ carFolder, track, kind, notes })
      .then((message) => {
        $("uploadForm").hidden = true;
        $("uploadDone").hidden = false;
        $("uploadDone").textContent = message;
        showNotice("");
      })
      .catch((error: unknown) => {
        showNotice(error instanceof Error ? error.message : "No se pudo enviar el setup.");
      });
  });
  for (const id of ["autoSync", "deleteRetired", "startWindows"] as const) {
    $(id).addEventListener("click", () => {
      const on = $(id).getAttribute("aria-pressed") === "true";
      press(id, !on);
      void persistSettings();
    });
  }
  $("interval").addEventListener("change", () => {
    void persistSettings();
  });
  $("pickFolder").addEventListener("click", () => {
    void backend.pickFolder().then((settings) => {
      if (settings && snapshot) {
        snapshot = { ...snapshot, settings, folderExists: true };
        paintSettings(snapshot);
      }
    }).catch((error: unknown) => showNotice(error instanceof Error ? error.message : "No se pudo cambiar la carpeta."));
  });
  $("detectFolder").addEventListener("click", () => {
    void backend.detectFolder().then((settings) => {
      if (snapshot) {
        snapshot = { ...snapshot, settings, folderExists: settings.setupsDir.length > 0 };
        paintSettings(snapshot);
      }
    }).catch((error: unknown) => showNotice(error instanceof Error ? error.message : "No pude detectar la carpeta."));
  });
  $("logoutBtn").addEventListener("click", () => {
    void backend.logout().then(() => refresh());
  });
  $("quitBtn").addEventListener("click", () => {
    void backend.quit();
  });
  $("updateBtn").addEventListener("click", () => {
    void backend.installUpdate().catch((error: unknown) => {
      showNotice(error instanceof Error ? error.message : "No se pudo instalar la actualización.");
    });
  });
  backend.onRefresh(() => {
    void refresh();
  });
  backend.onStaged((file) => paintStaged(file));
  backend.onNotice((message) => showNotice(message));
  backend.onUpdate((version) => {
    $("updateBar").hidden = false;
    $("updateText").textContent = `Hay una actualización: ${version}`;
  });
  backend.onLive((sample) => updateLiveStatus(sample));
}

async function boot(): Promise<void> {
  applyTheme(theme());
  bind();
  if (screen === "upload") {
    ($("carFolder") as HTMLInputElement).value = "ferrari296gt3";
    ($("track") as HTMLInputElement).value = "Spa-Francorchamps";
    ($("kind") as HTMLSelectElement).value = "Race";
    ($("notes") as HTMLTextAreaElement).value = "Presiones para 20 °C. Revisar el rake.";
    $("notesCount").textContent = `${($("notes") as HTMLTextAreaElement).value.length} / 280`;
  }
  await refresh();
  if (!snapshot?.pilot && screen === "login") {
    $("userCode").textContent = "MMT-7K2Q";
    $("loginStart").hidden = true;
    $("loginPending").hidden = false;
    $("mockApprove").hidden = true;
  }
  if (snapshot?.pilot && (screen === "upload" || screen === "settings" || screen === "library" || screen === "week" || screen === "analysis" || screen === "reference" || screen === "strategy" || screen === "overlays" || screen === "team" || screen === "config")) {
    showView(screen);
  }
}

void boot().catch((error: unknown) => {
  showNotice(error instanceof Error ? error.message : "MMT Sync no pudo arrancar.");
});
