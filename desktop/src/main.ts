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

const CAR_NAMES: Record<string, string> = {
  ferrari296gt3: "Ferrari 296 GT3",
  porsche992rgt3: "Porsche 911 GT3.R (992)",
  bmwm4gt3: "BMW M4 GT3",
  mercedesamggt3: "Mercedes-AMG GT3",
  audi97gt3: "Audi R8 LMS GT3",
  audir8lmsevo2gt3: "Audi R8 LMS EVO II GT3",
  mclaren720sgt3: "McLaren 720S GT3 EVO",
  corvettez06gt3r: "Chevrolet Corvette Z06 GT3.R",
  fordmustanggt3: "Ford Mustang GT3",
  lamborghinievogt3: "Lamborghini Huracán GT3 EVO2",
  acuraarx06gtp: "Acura ARX-06 GTP",
  bmwlmdh: "BMW M Hybrid V8 GTP",
  bmwmhybridv8: "BMW M Hybrid V8 GTP",
  cadillacvseriesr: "Cadillac V-Series.R GTP",
  porsche963: "Porsche 963 GTP",
  amvalkyriegtp: "Aston Martin Valkyrie AMR Pro GTP",
  dallarap217: "Dallara P217 LMP2",
  dallarair18: "Dallara IR-18 IndyCar",
  superformula_sf23: "Super Formula SF23",
  "superformula sf23": "Super Formula SF23",
  formulavee: "Formula Vee",
  rayff1600: "Ray FF1600",
  fiaf4: "FIA F4",
  f4: "FIA F4",
  dallaraf3: "Dallara F3",
  formularenault20: "Formula Renault 2.0",
  formularenault35: "Formula Renault 3.5",
  williamsfw31: "Williams-Toyota FW31 F1",
  mclarenmp430: "McLaren-Honda MP4-30 F1",
  mercedesw12: "Mercedes-AMG F1 W12 E",
  mercedesw13: "Mercedes-AMG F1 W13 E",
  "mx5 mx52016": "Global Mazda MX-5 Cup",
  toyotagr86: "Toyota GR86 Cup",
  bmwm2csr: "BMW M2 CS Racing",
  bmwm2g87: "BMW M2 (G87)",
  porsche992cup: "Porsche 911 GT3 Cup (992)",
  ferrari488gt3: "Ferrari 488 GT3 EVO",
  c8rvettegte: "Chevrolet Corvette C8.R GTE",
  porsche991rsr: "Porsche 911 RSR GTE",
  bmwm8gte: "BMW M8 GTE",
  ferrari488gte: "Ferrari 488 GTE",
  fordgt2017: "Ford GT GTE",
  astonmartin_vantage_gt4: "Aston Martin Vantage GT4",
  amvantagegt4: "Aston Martin Vantage GT4",
  amvantageevogt3: "Aston Martin Vantage GT3 EVO",
  bmwm4gt4: "BMW M4 GT4",
  bmwm4evogt4: "BMW M4 GT4 EVO",
  mclaren570sgt4: "McLaren 570S GT4",
  mercedesamggt4: "Mercedes-AMG GT4",
  porschecaymankt4: "Porsche 718 Cayman GT4",
  audirs3lms: "Audi RS 3 LMS TCR",
  audirs3lmsgen2: "Audi RS 3 LMS TCR Gen 2",
  hondacivic: "Honda Civic Type R TCR",
  hyundaielantra: "Hyundai Elantra N TCR",
  hyundaiveloster: "Hyundai Veloster N TCR",
  radicalsrf: "Radical SR10",
  radicalsr8: "Radical SR8",
  scca_spec_racer: "SCCA Spec Racer Ford",
  clio: "Renault Clio Cup",
};

export function formatCarName(folder: string): string {
  const clean = String(folder || "").trim();
  if (!clean) return "Coche";
  const lower = clean.toLowerCase();
  if (CAR_NAMES[lower]) return CAR_NAMES[lower];
  return clean
    .replace(/gt3/i, " GT3")
    .replace(/gt4/i, " GT4")
    .replace(/gtp/i, " GTP")
    .replace(/gte/i, " GTE")
    .replace(/lmp2/i, " LMP2")
    .replace(/evo/i, " EVO ")
    .replace(/(\d{4})/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

let collapsedState = new Set<string>();
let allExpanded = false;

function setupCardView(row: LibraryItem, showCar = false): HTMLElement {
  const card = document.createElement("div");
  card.className =
    "group rounded-xl border border-r-line bg-r-bg/80 p-3.5 flex flex-col justify-between gap-2.5 hover:border-r-accent/60 hover:bg-r-surface transition shadow-xs";

  const top = document.createElement("div");
  top.className = "flex items-center justify-between gap-2";

  const kKey = kindKey(row.kind);
  const kindPill = document.createElement("span");
  kindPill.className =
    kKey === "Race"
      ? "px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider"
      : kKey === "Qualy"
        ? "px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider"
        : kKey === "Wet"
          ? "px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-bold uppercase tracking-wider"
          : "px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-bold uppercase tracking-wider";
  kindPill.textContent = KIND_LABEL[kKey] ?? row.kind;

  const right = document.createElement("div");
  right.className = "flex items-center gap-1.5";

  const favBtn = document.createElement("button");
  favBtn.type = "button";
  const isFav = snapshot?.settings.favourites.includes(row.id) ?? false;
  favBtn.className = isFav
    ? "p-1 rounded text-amber-400 hover:scale-125 transition text-sm leading-none"
    : "p-1 rounded text-r-muted/40 hover:text-amber-400 hover:scale-125 transition text-sm leading-none";
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
      ? "px-2 py-0.5 rounded-full bg-r-accent text-r-ink font-mono text-[9px] uppercase font-bold"
      : state === "actualizado"
        ? "px-2 py-0.5 rounded-full border border-r-accent text-r-accent font-mono text-[9px] uppercase font-semibold"
        : "px-1.5 py-0.5 rounded text-emerald-400/80 font-mono text-[9px] uppercase border border-emerald-500/20";
  stateBadge.textContent = STATE_LABEL[state] ?? state;

  right.append(favBtn, stateBadge);
  top.append(kindPill, right);

  const mid = document.createElement("div");
  mid.className = "space-y-1";

  if (showCar) {
    const carTag = document.createElement("div");
    carTag.className = "text-xs font-semibold text-r-text flex items-center gap-1.5";
    carTag.innerHTML = `<span>🏎️</span> <span>${formatCarName(row.carFolder || row.car)}</span>`;
    mid.append(carTag);
  }

  const filenameEl = document.createElement("div");
  filenameEl.className = "font-mono text-xs font-semibold text-r-text break-all select-all group-hover:text-r-accent transition";
  filenameEl.textContent = row.filename;
  mid.append(filenameEl);

  const bottom = document.createElement("div");
  bottom.className = "flex items-center justify-between text-[11px] text-r-muted font-mono pt-1.5 border-t border-r-line/40";

  const details = document.createElement("div");
  details.className = "flex flex-wrap items-center gap-1.5";

  const lowerName = row.filename.toLowerCase();
  if (lowerName.includes("safe")) {
    const safeTag = document.createElement("span");
    safeTag.className = "px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold";
    safeTag.textContent = "SAFE";
    details.append(safeTag);
  }
  if (lowerName.includes("bop")) {
    const bopMatch = row.filename.match(/bop\d+/i);
    const bopTag = document.createElement("span");
    bopTag.className = "px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold";
    bopTag.textContent = bopMatch ? bopMatch[0].toUpperCase() : "BoP";
    details.append(bopTag);
  }
  if (lowerName.includes("endu")) {
    const enduTag = document.createElement("span");
    enduTag.className = "px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 text-[10px] font-semibold";
    enduTag.textContent = "ENDU";
    details.append(enduTag);
  }

  const metaSpan = document.createElement("span");
  metaSpan.textContent = `${row.season} · ${formatBytes(row.size)}`;
  details.append(metaSpan);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "p-1 text-r-muted hover:text-r-text transition text-xs";
  copyBtn.title = "Copiar nombre de archivo";
  copyBtn.textContent = "📋";
  copyBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(row.filename);
      copyBtn.textContent = "✓";
      setTimeout(() => (copyBtn.textContent = "📋"), 1500);
    } catch {}
  });

  bottom.append(details, copyBtn);
  card.append(top, mid, bottom);
  return card;
}

function paintGroupedByCar(items: LibraryItem[]): void {
  const groups = new Map<string, LibraryItem[]>();
  for (const entry of items) {
    const list = groups.get(entry.car) ?? [];
    list.push(entry);
    groups.set(entry.car, list);
  }

  const sortedCars = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  const isSearching = query.trim().length > 0;

  for (let carIndex = 0; carIndex < sortedCars.length; carIndex++) {
    const car = sortedCars[carIndex];
    const rows = groups.get(car) ?? [];
    const prettyCarName = formatCarName(car);
    const cat = classifyCar(rows[0]?.carFolder || car);

    // Group setups of this car by Circuit
    const circuitGroups = new Map<string, LibraryItem[]>();
    for (const r of rows) {
      const track = r.track.trim() || "Circuito general";
      const list = circuitGroups.get(track) ?? [];
      list.push(r);
      circuitGroups.set(track, list);
    }
    const sortedCircuits = Array.from(circuitGroups.keys()).sort((a, b) => a.localeCompare(b));

    let rCount = 0;
    let qCount = 0;
    let wCount = 0;
    for (const r of rows) {
      const k = kindKey(r.kind);
      if (k === "Race") rCount++;
      else if (k === "Qualy") qCount++;
      else if (k === "Wet") wCount++;
    }

    const section = document.createElement("section");
    section.className = "rounded-2xl border border-r-line bg-r-surface overflow-hidden shadow-sm hover:border-r-line-2 transition";

    const isCollapsed = allExpanded ? false : isSearching ? false : collapsedState.has(`car:${car}`) ? true : carIndex >= 4;

    // CAR HEADER BLOCK
    const header = document.createElement("div");
    header.className = "px-5 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/60 cursor-pointer select-none hover:bg-r-bg/80 transition";

    const left = document.createElement("div");
    left.className = "flex items-center gap-3";

    const chevron = document.createElement("span");
    chevron.className = "text-r-muted transition-transform duration-200 text-xs font-mono";
    chevron.textContent = isCollapsed ? "▶" : "▼";

    const icon = document.createElement("span");
    icon.className = "text-xl";
    icon.textContent = cat === "FORMULA CAR" ? "🏎️" : cat === "OVAL" ? "🏁" : cat === "DIRT" ? "🚜" : "🏎️";

    const titleBlock = document.createElement("div");
    const heading = document.createElement("h2");
    heading.className = "text-base md:text-lg font-bold text-r-text tracking-wide flex items-center gap-2";
    heading.textContent = prettyCarName;

    const rawFolderPill = document.createElement("span");
    rawFolderPill.className = "font-mono text-[11px] font-normal px-2 py-0.5 rounded bg-r-line/40 text-r-muted";
    rawFolderPill.textContent = car;
    heading.append(rawFolderPill);

    const subText = document.createElement("div");
    subText.className = "text-xs text-r-muted flex items-center gap-2 mt-0.5";
    subText.textContent = `${sortedCircuits.length} circuitos cubiertos`;

    titleBlock.append(heading, subText);
    left.append(chevron, icon, titleBlock);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2 font-mono text-[11px]";

    const catBadge = document.createElement("span");
    catBadge.className = "px-2.5 py-1 rounded-lg border border-r-line bg-r-surface text-r-muted uppercase font-bold tracking-wider";
    catBadge.textContent = cat;

    const typePill = document.createElement("span");
    typePill.className = "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-r-line bg-r-surface text-r-text text-[11px]";
    typePill.innerHTML = `<span class="text-emerald-400 font-bold">${rCount}R</span> · <span class="text-amber-400 font-bold">${qCount}Q</span> · <span class="text-sky-400 font-bold">${wCount}W</span>`;

    const countBadge = document.createElement("span");
    countBadge.className = "px-3 py-1 rounded-lg bg-r-accent/15 text-r-accent font-bold text-xs";
    countBadge.textContent = `${rows.length} setups`;

    right.append(catBadge, typePill, countBadge);
    header.append(left, right);
    section.append(header);

    // CAR BODY: Contains Circuit Sub-Blocks!
    const body = document.createElement("div");
    body.className = "divide-y divide-r-line/40 bg-r-surface/40";
    body.hidden = isCollapsed;

    header.addEventListener("click", () => {
      body.hidden = !body.hidden;
      chevron.textContent = body.hidden ? "▶" : "▼";
      if (body.hidden) {
        collapsedState.add(`car:${car}`);
      } else {
        collapsedState.delete(`car:${car}`);
      }
    });

    for (const track of sortedCircuits) {
      const circuitRows = circuitGroups.get(track) ?? [];
      const trackBlock = document.createElement("div");
      trackBlock.className = "p-4 space-y-2.5";

      // Circuit Sub-Header
      const trackHeader = document.createElement("div");
      trackHeader.className = "flex items-center justify-between gap-2 px-1";

      const trackLeft = document.createElement("div");
      trackLeft.className = "flex items-center gap-2";

      const trackPin = document.createElement("span");
      trackPin.className = "text-r-accent text-sm";
      trackPin.textContent = "📍";

      const trackTitle = document.createElement("h3");
      trackTitle.className = "font-bold text-sm text-r-text";
      trackTitle.textContent = track;

      trackLeft.append(trackPin, trackTitle);

      const weekNum = findWeekForTrack(track);
      if (weekNum) {
        const weekBadge = document.createElement("span");
        const isCur = weekNum === (sched.current_week || 9);
        weekBadge.className = isCur
          ? "px-2 py-0.5 rounded-full bg-r-accent text-r-ink font-bold text-[10px] uppercase tracking-wider shadow-sm"
          : "px-2 py-0.5 rounded-full border border-r-line bg-r-bg text-r-muted text-[10px] font-mono";
        weekBadge.textContent = isCur ? `🔥 Semana ${weekNum} (ACTUAL)` : `Semana ${weekNum}`;
        trackLeft.append(weekBadge);
      }

      const trackRight = document.createElement("span");
      trackRight.className = "text-xs font-mono text-r-muted";
      trackRight.textContent = `${circuitRows.length} ${circuitRows.length === 1 ? "setup" : "setups"}`;

      trackHeader.append(trackLeft, trackRight);
      trackBlock.append(trackHeader);

      // Setup Cards Grid inside Circuit!
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5";

      for (const row of circuitRows) {
        grid.append(setupCardView(row, false));
      }
      trackBlock.append(grid);
      body.append(trackBlock);
    }

    section.append(body);
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
  const isSearching = query.trim().length > 0;

  for (let trackIndex = 0; trackIndex < sortedTracks.length; trackIndex++) {
    const track = sortedTracks[trackIndex];
    const rows = groups.get(track) ?? [];

    // Group setups of this track by Car
    const carGroups = new Map<string, LibraryItem[]>();
    for (const r of rows) {
      const list = carGroups.get(r.car) ?? [];
      list.push(r);
      carGroups.set(r.car, list);
    }
    const sortedCars = Array.from(carGroups.keys()).sort((a, b) => a.localeCompare(b));

    const section = document.createElement("section");
    section.className = "rounded-2xl border border-r-line bg-r-surface overflow-hidden shadow-sm hover:border-r-line-2 transition";

    const isCollapsed = allExpanded ? false : isSearching ? false : collapsedState.has(`track:${track}`) ? true : trackIndex >= 4;

    const header = document.createElement("div");
    header.className = "px-5 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/60 cursor-pointer select-none hover:bg-r-bg/80 transition";

    const left = document.createElement("div");
    left.className = "flex items-center gap-3";

    const chevron = document.createElement("span");
    chevron.className = "text-r-muted transition-transform duration-200 text-xs font-mono";
    chevron.textContent = isCollapsed ? "▶" : "▼";

    const icon = document.createElement("span");
    icon.className = "text-xl";
    icon.textContent = "📍";

    const titleBlock = document.createElement("div");
    const heading = document.createElement("h2");
    heading.className = "text-base md:text-lg font-bold text-r-text tracking-wide";
    heading.textContent = track;

    const subText = document.createElement("div");
    subText.className = "text-xs text-r-muted flex items-center gap-2 mt-0.5";
    subText.textContent = `${sortedCars.length} coches disponibles`;

    titleBlock.append(heading, subText);
    left.append(chevron, icon, titleBlock);

    const right = document.createElement("div");
    right.className = "flex items-center gap-2 font-mono text-[11px]";

    const weekNum = findWeekForTrack(track);
    if (weekNum) {
      const weekBadge = document.createElement("span");
      const isCur = weekNum === (sched.current_week || 9);
      weekBadge.className = isCur
        ? "px-2 py-0.5 rounded-full bg-r-accent text-r-ink font-bold uppercase tracking-wider"
        : "px-2 py-0.5 rounded-full border border-r-line bg-r-surface text-r-muted uppercase tracking-wider";
      weekBadge.textContent = isCur ? `Semana ${weekNum} · ACTUAL` : `Semana ${weekNum}`;
      right.append(weekBadge);
    }

    const countBadge = document.createElement("span");
    countBadge.className = "px-3 py-1 rounded-lg bg-r-accent/15 text-r-accent font-bold text-xs";
    countBadge.textContent = `${rows.length} setups`;

    right.append(countBadge);
    header.append(left, right);
    section.append(header);

    const body = document.createElement("div");
    body.className = "divide-y divide-r-line/40 bg-r-surface/40";
    body.hidden = isCollapsed;

    header.addEventListener("click", () => {
      body.hidden = !body.hidden;
      chevron.textContent = body.hidden ? "▶" : "▼";
      if (body.hidden) {
        collapsedState.add(`track:${track}`);
      } else {
        collapsedState.delete(`track:${track}`);
      }
    });

    for (const car of sortedCars) {
      const carRows = carGroups.get(car) ?? [];
      const carBlock = document.createElement("div");
      carBlock.className = "p-4 space-y-2.5";

      const carHeader = document.createElement("div");
      carHeader.className = "flex items-center justify-between gap-2 px-1";

      const carLeft = document.createElement("div");
      carLeft.className = "flex items-center gap-2";

      const carIcon = document.createElement("span");
      carIcon.textContent = "🏎️";

      const carTitle = document.createElement("h3");
      carTitle.className = "font-bold text-sm text-r-text";
      carTitle.textContent = formatCarName(car);

      carLeft.append(carIcon, carTitle);

      const carRight = document.createElement("span");
      carRight.className = "text-xs font-mono text-r-muted";
      carRight.textContent = `${carRows.length} ${carRows.length === 1 ? "setup" : "setups"}`;

      carHeader.append(carLeft, carRight);
      carBlock.append(carHeader);

      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5";

      for (const row of carRows) {
        grid.append(setupCardView(row, false));
      }
      carBlock.append(grid);
      body.append(carBlock);
    }

    section.append(body);
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

  const isSearching = query.trim().length > 0;

  for (let weekIndex = 0; weekIndex < orderedKeys.length; weekIndex++) {
    const key = orderedKeys[weekIndex];
    const rows = groups.get(key) ?? [];
    const isCur = key === cur;

    // Group setups of this week by Track
    const trackGroups = new Map<string, LibraryItem[]>();
    for (const r of rows) {
      const track = r.track.trim() || "Circuito general";
      const list = trackGroups.get(track) ?? [];
      list.push(r);
      trackGroups.set(track, list);
    }
    const sortedTracks = Array.from(trackGroups.keys()).sort((a, b) => a.localeCompare(b));

    const section = document.createElement("section");
    section.className = isCur
      ? "rounded-2xl border-2 border-r-accent bg-r-surface overflow-hidden shadow-lg shadow-r-accent/5 transition"
      : "rounded-2xl border border-r-line bg-r-surface overflow-hidden shadow-sm transition";

    const isCollapsed = allExpanded ? false : isSearching ? false : isCur ? false : collapsedState.has(`week:${key}`) ? true : weekIndex >= 3;

    const header = document.createElement("div");
    header.className = isCur
      ? "px-5 py-3.5 border-b border-r-accent/30 flex flex-wrap items-center justify-between gap-3 bg-r-accent/10 cursor-pointer select-none hover:bg-r-accent/15 transition"
      : "px-5 py-3.5 border-b border-r-line flex flex-wrap items-center justify-between gap-3 bg-r-bg/60 cursor-pointer select-none hover:bg-r-bg/80 transition";

    const left = document.createElement("div");
    left.className = "flex items-center gap-3";

    const chevron = document.createElement("span");
    chevron.className = "text-r-muted transition-transform duration-200 text-xs font-mono";
    chevron.textContent = isCollapsed ? "▶" : "▼";

    const icon = document.createElement("span");
    icon.className = "text-xl";
    icon.textContent = isCur ? "🔥" : "📅";

    const titleBlock = document.createElement("div");
    const heading = document.createElement("h2");
    heading.className = "text-base md:text-lg font-bold text-r-text tracking-wide";
    if (typeof key === "number") {
      heading.textContent = `Semana ${key} (${weekDates[key] ?? ""})${isCur ? " · SEMANA ACTUAL" : ""}`;
    } else {
      heading.textContent = "Otras semanas y eventos especiales";
    }

    const subText = document.createElement("div");
    subText.className = "text-xs text-r-muted flex items-center gap-2 mt-0.5";
    subText.textContent = `${sortedTracks.length} circuitos en calendario`;

    titleBlock.append(heading, subText);
    left.append(chevron, icon, titleBlock);

    const countBadge = document.createElement("span");
    countBadge.className = isCur
      ? "px-3 py-1 rounded-lg bg-r-accent text-r-ink font-mono text-xs font-extrabold uppercase shadow-sm"
      : "px-3 py-1 rounded-lg bg-r-accent/15 text-r-accent font-mono text-xs font-semibold";
    countBadge.textContent = `${rows.length} setups`;

    header.append(left, countBadge);
    section.append(header);

    const body = document.createElement("div");
    body.className = "divide-y divide-r-line/40 bg-r-surface/40";
    body.hidden = isCollapsed;

    header.addEventListener("click", () => {
      body.hidden = !body.hidden;
      chevron.textContent = body.hidden ? "▶" : "▼";
      if (body.hidden) {
        collapsedState.add(`week:${key}`);
      } else {
        collapsedState.delete(`week:${key}`);
      }
    });

    for (const track of sortedTracks) {
      const trackRows = trackGroups.get(track) ?? [];
      const trackBlock = document.createElement("div");
      trackBlock.className = "p-4 space-y-2.5";

      const trackHeader = document.createElement("div");
      trackHeader.className = "flex items-center justify-between gap-2 px-1";

      const trackLeft = document.createElement("div");
      trackLeft.className = "flex items-center gap-2";

      const trackPin = document.createElement("span");
      trackPin.className = "text-r-accent text-sm";
      trackPin.textContent = "📍";

      const trackTitle = document.createElement("h3");
      trackTitle.className = "font-bold text-sm text-r-text";
      trackTitle.textContent = track;

      trackLeft.append(trackPin, trackTitle);

      const trackRight = document.createElement("span");
      trackRight.className = "text-xs font-mono text-r-muted";
      trackRight.textContent = `${trackRows.length} ${trackRows.length === 1 ? "setup" : "setups"}`;

      trackHeader.append(trackLeft, trackRight);
      trackBlock.append(trackHeader);

      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5";

      for (const row of trackRows) {
        grid.append(setupCardView(row, true));
      }
      trackBlock.append(grid);
      body.append(trackBlock);
    }

    section.append(body);
    libraryEl.append(section);
  }
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
        const msg = typeof error === "string" ? error : (error as { message?: string })?.message || "La sincronización no se completó.";
        showNotice(msg, true);
      })
      .finally(() => {
        button.removeAttribute("aria-busy");
        if (syncText) syncText.textContent = "Sincronizar ahora";
        if (syncIcon) syncIcon.className = "";
      });
  });
  $("search").addEventListener("input", () => {
    query = ($("search") as HTMLInputElement).value;
    const clearBtn = document.getElementById("clearSearch");
    if (clearBtn) clearBtn.hidden = query.length === 0;
    paintLibrary();
  });
  const clearSearchBtn = document.getElementById("clearSearch");
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      ($("search") as HTMLInputElement).value = "";
      query = "";
      clearSearchBtn.hidden = true;
      paintLibrary();
    });
  }
  const toggleAllBtn = document.getElementById("btnToggleAll");
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener("click", () => {
      allExpanded = !allExpanded;
      collapsedState.clear();
      toggleAllBtn.textContent = allExpanded ? "Colapsar todo" : "Expandir todo";
      paintLibrary();
    });
  }
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
