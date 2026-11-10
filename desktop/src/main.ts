import { inTauri } from "./env";
import { createMock } from "./mock";
import { createTauriBackend } from "./tauri-backend";
import type { Backend, LibraryItem, Settings, Snapshot, StagedFile } from "./types";
import { fuelText, paintExtras } from "./extra";

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
let filter: "all" | "Race" | "Qualy" | "Wet" = "all";
let query = "";
let pollTimer = 0;
let view: "library" | "upload" | "settings" | "week" | "analysis" | "reference" | "strategy" | "overlays" | "team" = "library";

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

function showNotice(message: string): void {
  notice.textContent = message;
  notice.hidden = message.length === 0;
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
  const items = (snapshot?.library ?? []).filter((entry) => {
    const key = kindKey(entry.kind);
    if (filter !== "all" && key !== filter) return false;
    const haystack = `${entry.car} ${entry.track} ${entry.filename} ${entry.season}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  libraryEl.replaceChildren();
  const groups = new Map<string, LibraryItem[]>();
  for (const entry of items) {
    const list = groups.get(entry.car) ?? [];
    list.push(entry);
    groups.set(entry.car, list);
  }
  for (const [car, rows] of groups) {
    const section = document.createElement("section");
    section.className = "rounded-2xl border border-r-line bg-r-surface overflow-hidden mmt-in";
    const heading = document.createElement("h2");
    heading.className = "mmt-display text-2xl px-4 py-3 border-b border-r-line";
    heading.textContent = car;
    section.append(heading);
    const order = ["Race", "Qualy", "Wet", "other"];
    for (const key of order) {
      const ofKind = rows.filter((row) => kindKey(row.kind) === key);
      if (ofKind.length === 0) continue;
      const block = document.createElement("div");
      block.className = "px-4 py-3 border-b border-r-line last:border-b-0";
      const label = document.createElement("h3");
      label.className = "font-mono text-[11px] uppercase tracking-[0.16em] text-r-accent mb-2";
      label.textContent = KIND_LABEL[key] ?? key;
      block.append(label);
      const list = document.createElement("ul");
      list.className = "grid gap-2";
      for (const row of ofKind) list.append(rowView(row));
      block.append(list);
      section.append(block);
    }
    libraryEl.append(section);
  }
  $("libraryEmpty").hidden = items.length > 0;
}

function rowView(row: LibraryItem): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "flex flex-wrap items-center justify-between gap-2";
  const left = document.createElement("div");
  left.className = "min-w-0";
  const name = document.createElement("p");
  name.className = "font-mono text-sm text-r-text truncate";
  name.textContent = row.filename;
  const meta = document.createElement("p");
  meta.className = "text-xs text-r-muted";
  meta.textContent = `${row.track} · ${row.season} · ${formatBytes(row.size)}`;
  left.append(name, meta);
  const badge = document.createElement("span");
  const state = row.state;
  badge.className =
    state === "nuevo"
      ? "px-2.5 py-1 rounded-full bg-r-accent text-r-ink font-mono text-[10px] uppercase tracking-wider"
      : state === "actualizado"
        ? "px-2.5 py-1 rounded-full border border-r-accent text-r-accent font-mono text-[10px] uppercase tracking-wider"
        : "px-2.5 py-1 rounded-full text-r-muted font-mono text-[10px] uppercase tracking-wider";
  badge.textContent = STATE_LABEL[state] ?? state;
  li.append(left, badge);
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
    team: "viewTeam",
  };
  for (const [name, id] of Object.entries(extra)) {
    const node = document.getElementById(id);
    if (node) node.hidden = next !== name;
  }
  setNav();
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
      if (next === "library" || next === "upload" || next === "settings" || next === "week" || next === "analysis" || next === "reference" || next === "strategy" || next === "overlays" || next === "team") showView(next);
    });
  });
  $("syncBtn").addEventListener("click", () => {
    const button = $("syncBtn");
    button.setAttribute("aria-busy", "true");
    button.textContent = "Sincronizando…";
    void backend
      .syncNow()
      .then(async (report) => {
        showNotice(report.message);
        await refresh();
      })
      .catch((error: unknown) => {
        showNotice(error instanceof Error ? error.message : "La sincronización no se completó.");
      })
      .finally(() => {
        button.removeAttribute("aria-busy");
        button.textContent = "Sincronizar ahora";
      });
  });
  $("search").addEventListener("input", () => {
    query = ($("search") as HTMLInputElement).value;
    paintLibrary();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.filter;
      if (value === "all" || value === "Race" || value === "Qualy" || value === "Wet") {
        filter = value;
        setNav();
        paintLibrary();
      }
    });
  });
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
  if (snapshot?.pilot && (screen === "upload" || screen === "settings" || screen === "library" || screen === "week" || screen === "analysis" || screen === "reference" || screen === "strategy" || screen === "overlays" || screen === "team")) {
    showView(screen);
  }
}

void boot().catch((error: unknown) => {
  showNotice(error instanceof Error ? error.message : "MMT Sync no pudo arrancar.");
});
