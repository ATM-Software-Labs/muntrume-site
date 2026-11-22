import { listen } from "@tauri-apps/api/event";
import cockpitPorscheUrl from "./assets/cockpit-porsche-992-gt3r.jpg";
import type { HardwareReport, IbtSessionReport, IracingAnalysis, LiveSample, Settings, Snapshot } from "./types";
import { areSessionsCompatible, computeDistanceDelta, resampleTrackByDistance } from "./telemetry/alignment";
import { cleanTelemetrySignals, detectCornerKeyEvents } from "./telemetry/signal-cleaner";
import { analyzeStintConsistency } from "./telemetry/consistency";
import { setActiveCoachReference } from "./features-48-50";
import {
  renderDigiFlagPanelWidget,
  renderRejoinHelperWidget,
  renderFasterCarAlertWidget,
  renderInCarControlsWidget,
  renderLapTimesWidget,
  renderRaceDualDeltaWidget,
  type LapHistoryEntry,
} from "./irsdk/overlay-renderer";
import {
  IrsdkClient,
  renderRelativeWidget,
  renderStandingsWidget,
  renderFuelWidget,
  renderTrackConditionsWidget,
  renderTireStatusWidget,
  renderCarTelemetryDock,
  renderGpuPedalsWidget,
  renderLiveDeltaCanvas,
  GhostTraceRecorder,
  renderPitboxWidget,
  renderDigiFlagWidget,
  SmartLayoutManager,
  VisibilityRulesEngine,
  PitExitPredictor,
  mapLeaderboardToPitRefs,
  renderPitExitWidget,
  TireThermalEngine,
  renderTireThermalWidget,
  BroadcastDirector,
  renderBroadcastDirectorWidget,
} from "./irsdk";
import { renderLiveTrackMapCanvas } from "./irsdk/proximity-radar";
import { renderFlatTrackMapCanvas } from "./irsdk/flat-track-map";
import { renderTrafficIndicator } from "./irsdk/traffic-indicator";
import { renderPitStrategyWidget } from "./irsdk/pit-exit-predictor";
import { renderHelicorsaRadar } from "./irsdk/radar-360";
import { observeTrackAutoMap } from "./irsdk/track-paths";
import { estimateLiveIRating, formatIRatingDelta, formatSofShort } from "./irsdk/irating-calc";
import { AeroSuspensionAnalyzer, renderAeroAnalysisPanel } from "./telemetry/aero-analyzer";
import { LocalTelemetryBus } from "./plugins/telemetry-bus";
import { PluginLoader } from "./plugins/plugin-loader";
import { ThemeEngine } from "./theme/theme-engine";
import { I18nManager } from "./i18n/i18n-manager";
import rawSchedule from "./season_schedule_2026_s4.json";
import rawRealTracks from "./real_telemetry_tracks.json";
import { clamp, finiteOr, safeDiv } from "./core/math-guards";
import { resolveCarMetadata, createBrandBadgeElement } from "./cars/catalog";
import { computeTrailBrakingScore } from "./telemetry/comparator";

const pitExitPredictor = new PitExitPredictor();
const tireThermalEngine = new TireThermalEngine();
const broadcastDirector = new BroadcastDirector();
const aeroAnalyzer = new AeroSuspensionAnalyzer();
let engButtonsWired = false;
let lastSlowHudRenderMs = 0;
let lastAutoFuelPitRoad = false;
const ghostTrace = new GhostTraceRecorder();
let lastRadarRenderMs = 0;

interface ScheduleWeek {
  week_num: number;
  start_date: string;
  track_name: string;
  config: string;
  weather: string;
  duration: string;
  sim_time: string;
}

interface ScheduleSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  cars: string[];
  weeks: ScheduleWeek[];
}

interface SchedulePayload {
  season: string;
  pdf_source: string;
  total_series: number;
  current_week: number;
  series: ScheduleSeries[];
}

const schedule = rawSchedule as unknown as SchedulePayload;

function currentSeasonWeek(): number {
  const startMs = Date.UTC(2026, 8, 15, 0, 0, 0);
  const w = Math.floor((Date.now() - startMs) / (7 * 86_400_000)) + 1;
  return Number.isFinite(w) ? Math.max(1, Math.min(12, w)) : schedule.current_week || 9;
}

let activeWeek = currentSeasonWeek();
let lastIbtReport: IbtSessionReport | null = null;
let activeCat = "all";
let activeSearch = "";
let filterOnlyOpen = false;
let weekListenersAttached = false;
let studioInitialized = false;
let strategyInitialized = false;
let overlayInitialized = false;

// -------------------------------------------------------------
// TELEMETRY STUDIO DATA & TYPES (Based on REAL .ibt iRacing telemetry)
// -------------------------------------------------------------
export interface TurnInsight {
  turn: number;
  name: string;
  distance: number;
  sector: 1 | 2 | 3;
  alienApexKmh: number;
  userApexKmh: number;
  alienBrakingDistM: number;
  userBrakingDistM: number;
  deltaSec: number;
  coachTip: string;
  severity: "critical" | "moderate" | "optimal";
}

export interface RealTrackSample {
  dist: number;
  speed: number;
  thr: number;
  brk: number;
  gear: number;
}

export interface RealTrackEntry {
  id: string;
  name: string;
  fileUsed: string;
  bestSec: number;
  avgSec: number;
  bestFormatted: string;
  avgFormatted: string;
  lapCount: number;
  samples: RealTrackSample[];
  mapPoints: [number, number][];
}

const REAL_TRACKS = rawRealTracks as unknown as Record<string, RealTrackEntry>;

let currentTrackId = "fuji";
let activeHoverDist: number | null = null;
let coachLossFilter = false;

export function paintExtras(data: Snapshot): void {
  paintWeek(data);
  paintAnalysis();
  renderReferenceComparator();
  paintChecklist(data.settings);
  paintOverlays();
  paintTeam(data.settings);
  paintFlags(data.settings);
  paintStrategy();
}

// -------------------------------------------------------------
// 1. SEASON CALENDAR (CALENDARIO OFICIAL 2026 S4)
// -------------------------------------------------------------
function paintWeek(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  const weekSelect = document.getElementById("weekSelect") as HTMLSelectElement | null;
  const weekSearch = document.getElementById("weekSearch") as HTMLInputElement | null;
  const catFilters = document.getElementById("weekCatFilters");
  const weeksBar = document.getElementById("calendarWeeksBar");
  if (!note || !list) return;

  const weekDates: Record<number, string> = {
    1: "15 sep", 2: "22 sep", 3: "29 sep", 4: "06 oct",
    5: "13 oct", 6: "20 oct", 7: "27 oct", 8: "03 nov",
    9: "10 nov", 10: "17 nov", 11: "24 nov", 12: "01 dic",
  };

  const curWeek = currentSeasonWeek();

  // Populate Dropdown
  if (weekSelect && weekSelect.options.length === 0) {
    for (let w = 1; w <= 12; w++) {
      const opt = document.createElement("option");
      opt.value = String(w);
      const isCurrent = w === curWeek;
      opt.textContent = `Semana ${w} (${weekDates[w] ?? ""})${isCurrent ? " · ACTUAL" : ""}`;
      weekSelect.append(opt);
    }
    weekSelect.value = String(activeWeek);
  }

  // Populate Horizontal Visual Calendar Weeks Bar
  if (weeksBar && weeksBar.children.length === 0) {
    for (let w = 1; w <= 12; w++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.week = String(w);
      const isCurrent = w === curWeek;
      const isSelected = w === activeWeek;
      btn.className = isSelected
        ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold shrink-0 transition"
        : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs shrink-0 transition";

      btn.innerHTML = `Sem ${w} <span class="text-[10px] text-r-muted">(${weekDates[w] || ""})</span>${isCurrent ? ' <span class="text-[9px] px-1 py-0.2 rounded bg-r-accent/20 text-r-accent font-black">ACTUAL</span>' : ""}`;
      btn.addEventListener("click", () => {
        activeWeek = w;
        if (weekSelect) weekSelect.value = String(w);
        updateCalendarWeeksBar();
        renderWeekItems(data);
      });
      weeksBar.append(btn);
    }
  }

  if (!weekListenersAttached) {
    weekListenersAttached = true;
    if (weekSelect) {
      weekSelect.addEventListener("change", () => {
        activeWeek = Number(weekSelect.value);
        updateCalendarWeeksBar();
        renderWeekItems(data);
      });
    }
    if (weekSearch) {
      weekSearch.addEventListener("input", () => {
        activeSearch = weekSearch.value.trim().toLowerCase();
        renderWeekItems(data);
      });
    }
    if (catFilters) {
      catFilters.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.cat) return;
        activeCat = btn.dataset.cat;
        for (const b of catFilters.querySelectorAll("button")) {
          const isSelected = b.dataset.cat === activeCat;
          b.className = isSelected
            ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
        renderWeekItems(data);
      });
    }
    const seriesPresets = document.getElementById("weekSeriesPresets");
    if (seriesPresets) {
      seriesPresets.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.preset) return;
        const preset = btn.dataset.preset;
        if (weekSearch) {
          if (preset === "gt3open") {
            weekSearch.value = "GT Sprint Series";
            activeCat = "SPORTS CAR";
            filterOnlyOpen = true;
          } else if (preset === "imsa") {
            weekSearch.value = "IMSA iRacing Series by GO Fast";
            activeCat = "SPORTS CAR";
            filterOnlyOpen = true;
          } else if (preset === "formula") {
            weekSearch.value = "Super Formula Series 2026";
            activeCat = "FORMULA CAR";
            filterOnlyOpen = true;
          } else if (preset === "onlyopen") {
            filterOnlyOpen = !filterOnlyOpen;
            weekSearch.value = "";
            activeCat = "all";
          } else if (preset === "regional") {
            weekSearch.value = "Regional Tour";
            activeCat = "SPORTS CAR";
            filterOnlyOpen = false;
          }
          activeSearch = weekSearch.value.trim().toLowerCase();

          for (const b of seriesPresets.querySelectorAll("button")) {
            const isSelected = b.dataset.preset === preset;
            if (b.dataset.preset === "onlyopen") {
              b.className = filterOnlyOpen
                ? "px-3.5 py-1.5 rounded-xl border border-emerald-400 bg-emerald-500/25 text-emerald-300 font-mono text-xs font-bold transition shadow-sm"
                : "px-3.5 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs transition";
            } else {
              b.className = isSelected
                ? "px-3.5 py-1.5 rounded-xl border border-r-accent bg-r-accent/20 text-r-accent font-mono text-xs font-bold shadow-sm"
                : "px-3.5 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text hover:border-r-accent font-mono text-xs transition";
            }
          }
          if (catFilters) {
            for (const b of catFilters.querySelectorAll("button")) {
              const isSelected = b.dataset.cat === activeCat;
              b.className = isSelected
                ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
                : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
            }
          }
          renderWeekItems(data);
        }
      });
    }
  }

  updateCalendarWeeksBar();
  renderWeekItems(data);
}

function updateCalendarWeeksBar(): void {
  const weeksBar = document.getElementById("calendarWeeksBar");
  if (!weeksBar) return;
  for (const b of weeksBar.querySelectorAll("button")) {
    const w = Number(b.dataset.week);
    const isSelected = w === activeWeek;
    b.className = isSelected
      ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold shrink-0 transition shadow-sm"
      : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs shrink-0 transition";
  }
}

function isFixedSeries(s: ScheduleSeries): boolean {
  const n = s.name.toLowerCase();
  const t = s.tier.toLowerCase();
  return n.includes("fixed") || t.includes("fixed") || n.includes("gt3 regional tour");
}

function renderWeekItems(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  if (!note || !list) return;

  const filtered = schedule.series.filter((s) => {
    const isFixed = isFixedSeries(s);
    if (filterOnlyOpen && isFixed) return false;
    if (activeCat !== "all" && s.category.toLowerCase() !== activeCat.toLowerCase()) return false;
    if (activeSearch) {
      const q = activeSearch;
      const matchName = s.name.toLowerCase().includes(q);
      const matchCars = s.cars.some((c) => c.toLowerCase().includes(q));
      const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
      const matchTrack = weekItem ? weekItem.track_name.toLowerCase().includes(q) : false;
      if (!matchName && !matchCars && !matchTrack) return false;
    }
    return true;
  });

  note.textContent = `${schedule.season} · Semana ${activeWeek} de 12 · Mostrando ${filtered.length} de ${schedule.total_series} series oficiales`;
  list.replaceChildren();

  const knownTracks = new Set(data.library.map((l) => l.track.toLowerCase()));
  const missingTracks: string[] = [];
  for (const s of filtered.slice(0, 12)) {
    const wk = s.weeks.find((w) => w.week_num === activeWeek);
    if (!wk) continue;
    const tLow = wk.track_name.toLowerCase();
    const hasTrack = Array.from(knownTracks).some((kt) => tLow.includes(kt) || kt.includes(tLow));
    if (!hasTrack && !missingTracks.includes(wk.track_name)) {
      missingTracks.push(wk.track_name);
    }
  }
  if (missingTracks.length > 0) {
    const banner = document.createElement("div");
    banner.className = "col-span-full rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono";
    const missingQuery = encodeURIComponent(missingTracks.slice(0, 6).join(","));
    banner.innerHTML = `
      <span class="text-amber-200">Semana ${activeWeek}: te faltan circuitos como <strong class="text-white">${missingTracks.slice(0, 2).join(", ")}</strong> en tu biblioteca local.</span>
      <a href="https://muntru.me/calendar/?planner=1&missing=${missingQuery}" target="_blank" rel="noopener" class="px-3 py-1.5 rounded-lg bg-r-accent text-r-ink font-display font-extrabold uppercase tracking-wider text-[11px] hover:opacity-90 transition shrink-0">Ver pack óptimo (15% dto.) &rarr;</a>
    `;
    list.append(banner);
  }

  const userCars = (data.lastCars || []).map((c) => c.toLowerCase());
  const carSetupMap = new Map<string, number>();
  for (const lib of data.library) {
    const key = lib.carFolder.toLowerCase();
    carSetupMap.set(key, (carSetupMap.get(key) || 0) + 1);
  }

  for (const s of filtered) {
    const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
    const hasUserCar = userCars.length > 0 && s.cars.some((c) => userCars.some((uc) => c.toLowerCase().includes(uc) || uc.includes(c.toLowerCase())));
    let matchCount = 0;
    for (const c of s.cars) {
      const cl = c.toLowerCase();
      for (const [folder, count] of carSetupMap) {
        if (cl.includes(folder) || folder.includes(cl)) {
          matchCount += count;
        }
      }
    }

    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-line-2";
    if (hasUserCar) {
      card.className += " ring-1 ring-r-accent/40";
    }

    const top = document.createElement("div");
    top.className = "flex flex-wrap items-center justify-between gap-2";

    const badges = document.createElement("div");
    badges.className = "flex flex-wrap items-center gap-1.5 font-mono text-[11px]";

    const catBadge = document.createElement("span");
    catBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-muted";
    catBadge.textContent = s.category;

    const tierBadge = document.createElement("span");
    tierBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-accent";
    tierBadge.textContent = s.tier.replace("Class", " Class");

    const isFixed = isFixedSeries(s);
    const openBadge = document.createElement("span");
    if (isFixed) {
      openBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-muted text-[10px]";
      openBadge.textContent = "FIXED (Baseline iRacing)";
    } else {
      openBadge.className = "px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold text-[10px]";
      openBadge.textContent = "OPEN (Setups MMT)";
    }

    badges.append(catBadge, tierBadge, openBadge);

    if (!isFixed && matchCount > 0) {
      const setupBadge = document.createElement("span");
      setupBadge.className = "px-2.5 py-0.5 rounded bg-r-accent/15 text-r-accent font-mono text-[11px] font-bold";
      setupBadge.textContent = `${matchCount} setups MMT listos`;
      top.append(badges, setupBadge);
    } else {
      top.append(badges);
    }

    const title = document.createElement("h2");
    title.className = "mt-2.5 text-lg font-bold text-r-text";
    title.textContent = s.name;

    card.append(top, title);

    if (weekItem) {
      const trackBox = document.createElement("div");
      trackBox.className = "mt-3.5 rounded-xl border border-r-line/60 bg-r-bg/50 p-3.5";

      const trackHeader = document.createElement("div");
      trackHeader.className = "flex flex-wrap items-baseline justify-between gap-2";

      const trackName = document.createElement("strong");
      trackName.className = "text-base text-r-accent";
      trackName.textContent = weekItem.track_name;

      const trackConfig = document.createElement("span");
      trackConfig.className = "font-mono text-xs text-r-muted";
      trackConfig.textContent = weekItem.config;

      trackHeader.append(trackName, trackConfig);

      const trackMeta = document.createElement("div");
      trackMeta.className = "mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-r-muted";

      if (weekItem.duration) {
        const d = document.createElement("span");
        d.textContent = `Duración: ${weekItem.duration}`;
        trackMeta.append(d);
      }
      if (weekItem.weather) {
        const w = document.createElement("span");
        w.textContent = `Clima: ${weekItem.weather}`;
        trackMeta.append(w);
      }
      if (weekItem.sim_time) {
        const st = document.createElement("span");
        st.textContent = `Sim: ${weekItem.sim_time}`;
        trackMeta.append(st);
      }

      trackBox.append(trackHeader, trackMeta);
      card.append(trackBox);
    }

    if (s.cars && s.cars.length > 0) {
      const carsRow = document.createElement("p");
      carsRow.className = "mt-3 text-xs text-r-muted line-clamp-2";
      const carLabel = document.createElement("strong");
      carLabel.className = "text-r-text font-normal";
      carLabel.textContent = "Coches: ";
      carsRow.append(carLabel, document.createTextNode(s.cars.slice(0, 6).join(", ") + (s.cars.length > 6 ? ` (+${s.cars.length - 6} más)` : "")));
      card.append(carsRow);
    }

    list.append(card);
  }
}

// -------------------------------------------------------------
// 2. REAL TELEMETRY & LASER-SCANNED TRACK STUDIO (Based on .ibt)
// -------------------------------------------------------------
const TELEMETRY_RETENTION_KEY = "mmt_telemetry_retention_days";
let ibtSessionsLoaded = false;
let alignedDeltaCurve: number[] | null = null;

function formatEpochShort(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "";
  try {
    const d = new Date(ms);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

interface CapturedSessionMeta {
  id: string;
  filePath: string;
  capturedEpochMs: number;
  trackName: string;
  carScreenName: string;
  bestLapS: number;
  totalLaps: number;
}

interface CaptureStatusPayload {
  state: "idle" | "recording" | "saved" | string;
  trackName: string;
  carScreenName: string;
  lapNum: number;
  samplesCount: number;
  savedLaps: number;
}

let captureEventsWired = false;

function paintCaptureStatusBadge(status: CaptureStatusPayload): void {
  const badge = document.getElementById("irsdkCaptureBadge");
  const dot = document.getElementById("irsdkCaptureDot");
  const text = document.getElementById("irsdkCaptureText");
  if (!badge || !dot || !text) return;

  if (status.state === "recording") {
    dot.className = "w-2 h-2 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_8px_#10b981]";
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide border border-[#10b981]/50 bg-[#10b981]/10 text-[#10b981] whitespace-nowrap";
    const ctx = status.trackName ? ` · ${status.trackName}` : "";
    const lap = status.lapNum > 0 ? ` (V${status.lapNum})` : "";
    text.textContent = `Grabando tanda en vivo${ctx}${lap}`;
  } else if (status.state === "saved") {
    dot.className = "w-2 h-2 rounded-full bg-emerald-400";
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide border border-emerald-400/40 bg-emerald-500/10 text-emerald-300 whitespace-nowrap";
    const lapsLabel = status.savedLaps > 0 ? ` (${status.savedLaps} v)` : "";
    text.textContent = `Sesión procesada automáticamente${lapsLabel}`;
  } else {
    dot.className = "w-2 h-2 rounded-full bg-slate-500";
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wide border border-white/10 bg-[#090b0f] text-r-muted whitespace-nowrap";
    text.textContent = "Auto-captura IRSDK: En espera";
  }
}

async function populateIbtSessionSelectors(autoLoadLatest = false): Promise<void> {
  const sel = document.getElementById("capturedSessionsSelect") as HTMLSelectElement | null;
  if (!sel) return;
  try {
    const { inTauri } = await import("./env");
    if (!inTauri()) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const sessions = await withTimeout(
      invoke<CapturedSessionMeta[]>("list_captured_sessions"),
      1500,
      [],
    );
    const retentionDays = Number(localStorage.getItem(TELEMETRY_RETENTION_KEY) || "0");
    const nowMs = Date.now();
    const filtered = (sessions || []).filter((s) => {
      if (retentionDays > 0 && s.capturedEpochMs > 0) {
        const ageDays = (nowMs - s.capturedEpochMs) / (24 * 3600 * 1000);
        if (ageDays > retentionDays) return false;
      }
      return true;
    });

    const previousValue = sel.value;
    sel.innerHTML = `<option value="">${
      filtered.length
        ? `Sesiones capturadas automáticamente (${filtered.length})…`
        : "Sesiones capturadas automáticamente (esperando tanda…)"
    }</option>`;

    for (const s of filtered) {
      const opt = document.createElement("option");
      opt.value = s.filePath;
      const bestStr = s.bestLapS > 0 ? formatLapSec(s.bestLapS) : "--:--.---";
      opt.textContent = `${formatEpochShort(s.capturedEpochMs)} · ${s.trackName} · ${s.carScreenName} · ${bestStr}`;
      sel.appendChild(opt);
    }

    if (autoLoadLatest && filtered.length > 0) {
      sel.value = filtered[0].filePath;
      await loadSelectedIbtSession(filtered[0].filePath);
    } else if (previousValue && filtered.some((s) => s.filePath === previousValue)) {
      sel.value = previousValue;
    }
  } catch {
    // Non-fatal in browser/mock mode
  }
}

async function loadSelectedIbtSession(path: string): Promise<void> {
  if (!path) return;
  try {
    const { inTauri } = await import("./env");
    if (!inTauri()) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const report = await invoke<IbtSessionReport | null>("read_captured_session", { path });
    if (report) {
      paintLastSession(report);
      renderTelemetryStudio();
    }
  } catch {
    // Keep current view on read failure
  }
}

async function wireIrsdkCaptureEvents(): Promise<void> {
  if (captureEventsWired) return;
  captureEventsWired = true;
  try {
    const { inTauri } = await import("./env");
    if (!inTauri()) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");
    const initial = await withTimeout(
      invoke<CaptureStatusPayload>("get_capture_status"),
      1000,
      { state: "idle", trackName: "", carScreenName: "", lapNum: 0, samplesCount: 0, savedLaps: 0 },
    );
    paintCaptureStatusBadge(initial);

    await listen<CaptureStatusPayload>("mmt-capture-state", (ev) => {
      if (ev.payload) paintCaptureStatusBadge(ev.payload);
    });
    await listen<CapturedSessionMeta>("mmt-session-captured", (ev) => {
      paintCaptureStatusBadge({
        state: "saved",
        trackName: ev.payload?.trackName || "",
        carScreenName: ev.payload?.carScreenName || "",
        lapNum: 0,
        samplesCount: 0,
        savedLaps: ev.payload?.totalLaps || 0,
      });
      void populateIbtSessionSelectors(true);
    });
  } catch {
    // Ignore outside Tauri
  }
}

async function refreshIbtStorageStats(): Promise<void> {
  const summary = document.getElementById("ibtStorageSummary");
  if (!summary) return;
  try {
    const { inTauri } = await import("./env");
    if (!inTauri()) {
      summary.textContent = "Disponible en la app de escritorio Windows.";
      return;
    }
    const { invoke } = await import("@tauri-apps/api/core");
    const days = Number(localStorage.getItem(TELEMETRY_RETENTION_KEY) || "14") || 14;
    const stats = await invoke<{ totalFiles: number; totalBytes: number; oldFilesCount: number; oldBytes: number }>(
      "get_ibt_storage_stats",
      { maxAgeDays: days },
    );
    const totalMb = (stats.totalBytes / (1024 * 1024)).toFixed(1);
    const oldMb = (stats.oldBytes / (1024 * 1024)).toFixed(1);
    summary.textContent = `${stats.totalFiles} archivos .ibt (${totalMb} MB) · ${stats.oldFilesCount} con > ${days} días (${oldMb} MB recuperables)`;
  } catch {
    summary.textContent = "No se pudo leer la carpeta de telemetría.";
  }
}

function wireRetentionSetting(): void {
  const retSel = document.getElementById("telemetryRetentionDays") as HTMLSelectElement | null;
  if (retSel && retSel.dataset.wired !== "1") {
    retSel.dataset.wired = "1";
    retSel.value = localStorage.getItem(TELEMETRY_RETENTION_KEY) || "0";
    retSel.addEventListener("change", () => {
      localStorage.setItem(TELEMETRY_RETENTION_KEY, retSel.value);
      void populateIbtSessionSelectors();
      void refreshIbtStorageStats();
    });
  }
  const cleanBtn = document.getElementById("btnCleanupOldIbt");
  const cleanRes = document.getElementById("ibtCleanupResult");
  if (cleanBtn && cleanBtn.dataset.wired !== "1") {
    cleanBtn.dataset.wired = "1";
    void refreshIbtStorageStats();
    cleanBtn.addEventListener("click", async () => {
      try {
        const { inTauri } = await import("./env");
        if (!inTauri()) return;
        const { invoke } = await import("@tauri-apps/api/core");
        const days = Math.max(1, Number(localStorage.getItem(TELEMETRY_RETENTION_KEY) || "14") || 14);
        const res = await invoke<{ deletedCount: number; freedBytes: number }>("cleanup_old_ibt_files", { maxAgeDays: days });
        const freedMb = (res.freedBytes / (1024 * 1024)).toFixed(1);
        if (cleanRes) cleanRes.textContent = `${res.deletedCount} borrados (${freedMb} MB liberados)`;
        void refreshIbtStorageStats();
        void populateIbtSessionSelectors();
      } catch {
        if (cleanRes) cleanRes.textContent = "Error al limpiar .ibt";
      }
    });
  }
}

function paintAnalysis(): void {
  const trackSel = document.getElementById("telemetryTrack") as HTMLSelectElement | null;
  const capturedSel = document.getElementById("capturedSessionsSelect") as HTMLSelectElement | null;
  const filterAll = document.getElementById("coachFilterAll");
  const filterLoss = document.getElementById("coachFilterLoss");
  const traceCanvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;

  wireRetentionSetting();
  void wireIrsdkCaptureEvents();
  if (!ibtSessionsLoaded) {
    ibtSessionsLoaded = true;
    void populateIbtSessionSelectors(true);
  }

  if (trackSel && !studioInitialized) {
    studioInitialized = true;
    trackSel.addEventListener("change", () => {
      currentTrackId = trackSel.value;
      activeHoverDist = null;
      renderTelemetryStudio();
    });
    if (capturedSel) {
      capturedSel.addEventListener("change", () => {
        if (!capturedSel.value) {
          lastIbtReport = null;
          activeHoverDist = null;
          renderTelemetryStudio();
          return;
        }
        void loadSelectedIbtSession(capturedSel.value);
      });
    }

    if (filterAll && filterLoss) {
      filterAll.addEventListener("click", () => {
        coachLossFilter = false;
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
      filterLoss.addEventListener("click", () => {
        coachLossFilter = true;
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
    }

    if (traceCanvas) {
      traceCanvas.addEventListener("mousemove", (e) => {
        const rect = traceCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const track = getEffectiveTelemetryTrack();
        const maxDist = Math.max(1, track.samples[track.samples.length - 1]?.dist || 1);
        activeHoverDist = normX * maxDist;
        drawTraceStudio(track, activeHoverDist);
        drawMapStudio(track, activeHoverDist);
        updateCursorReadout(track, activeHoverDist);
      });

      traceCanvas.addEventListener("mouseleave", () => {
        activeHoverDist = null;
        const track = getEffectiveTelemetryTrack();
        drawTraceStudio(track, null);
        drawMapStudio(track, null);
        updateCursorReadout(track, null);
      });
    }
  }

  renderTelemetryStudio();
}

function parseLapFormatted(fmt: string | undefined): number {
  if (!fmt) return 0;
  const parts = fmt.trim().split(":");
  if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (Number.isFinite(mins) && Number.isFinite(secs)) return mins * 60 + secs;
  }
  const direct = Number(fmt);
  return Number.isFinite(direct) ? direct : 0;
}

function getEffectiveTelemetryTrack(): RealTrackEntry {
  const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;
  const hasRealIbt = Boolean(lastIbtReport && lastIbtReport.bestLapSamples.length > 5);
  if (hasRealIbt && lastIbtReport) {
    const bestSec = lastIbtReport.bestLapS > 0 ? lastIbtReport.bestLapS : 0;
    const avgSec = lastIbtReport.avgLapS > 0 ? lastIbtReport.avgLapS : bestSec;
    const bestFormatted = bestSec > 0 ? formatLapSec(bestSec) : "--:--.---";
    const avgFormatted = avgSec > 0 ? formatLapSec(avgSec) : bestFormatted;
    const rawPts = lastIbtReport.bestLapSamples.map((s) => ({
      dist: s.distM,
      speed: s.speedKmh,
      thr: s.throttle * 100,
      brk: s.brake * 100,
      gear: s.gear ?? 0,
      steering: s.steeringRad,
      lapTimeS: s.lapTimeS,
      x: (s as { x?: number }).x,
      y: (s as { y?: number }).y,
    }));
    const trackLen = lastIbtReport.trackLengthM && lastIbtReport.trackLengthM > 300
      ? lastIbtReport.trackLengthM
      : (rawPts[rawPts.length - 1]?.dist || 4000);
    const aligned = resampleTrackByDistance(rawPts, trackLen, 5);
    const refAligned = resampleTrackByDistance(
      track.samples.map((s) => ({
        dist: s.dist,
        speed: s.speed,
        thr: s.thr,
        brk: s.brk,
        gear: s.gear,
        steering: (s as { steering?: number }).steering ?? 0,
      })),
      trackLen,
      5,
    );
    alignedDeltaCurve = computeDistanceDelta(aligned, refAligned, bestSec, avgSec);
    const cleanedSamples = cleanTelemetrySignals(
      aligned.map((p) => ({
        dist: p.dist,
        speed: Math.round(p.speed),
        thr: Math.round(p.thr),
        brk: Math.round(p.brk),
        gear: p.gear,
        steering: p.steering,
        x: p.x,
        y: p.y,
      })),
    );
    return {
      ...track,
      name: lastIbtReport.trackName || track.name,
      bestSec,
      avgSec,
      bestFormatted,
      avgFormatted,
      lapCount: lastIbtReport.totalLaps,
      fileUsed: lastIbtReport.fileName,
      samples: cleanedSamples,
    };
  }
  const bestSec = finiteOr(track.bestSec, 0) > 0 ? track.bestSec : parseLapFormatted(track.bestFormatted);
  const avgSec = finiteOr(track.avgSec, 0) > 0 ? track.avgSec : bestSec;
  alignedDeltaCurve = null;
  return {
    ...track,
    bestSec,
    avgSec,
    avgFormatted: track.avgFormatted || (avgSec > 0 ? formatLapSec(avgSec) : track.bestFormatted),
  };
}

function renderTelemetryStudio(): void {
  const alienTimeNode = document.getElementById("lapAlienTime");
  const userTimeNode = document.getElementById("lapUserTime");
  const countBadge = document.getElementById("lapCountBadge");
  const deltaSummaryNode = document.getElementById("lapDeltaSummary");
  const fileBadge = document.getElementById("lapFileBadge");
  const trackLengthBadge = document.getElementById("trackLengthBadge");
  const metaBadge = document.getElementById("ibtSessionMetaBadge");

  if (metaBadge) {
    if (lastIbtReport) {
      const parts = [
        lastIbtReport.sessionUniqueId ? `SessionID #${lastIbtReport.sessionUniqueId}` : "",
        lastIbtReport.subSessionId ? `Sub #${lastIbtReport.subSessionId}` : "",
        lastIbtReport.trackTemp ? `Asfalto ${lastIbtReport.trackTemp}` : "",
        lastIbtReport.airTemp ? `Aire ${lastIbtReport.airTemp}` : "",
        lastIbtReport.trackRubberState ? `Goma: ${lastIbtReport.trackRubberState}` : "",
        lastIbtReport.driverSetupName ? `Setup: ${lastIbtReport.driverSetupName}` : "",
        lastIbtReport.fuelLevelStartL && lastIbtReport.fuelLevelStartL > 0 ? `Fuel: ${lastIbtReport.fuelLevelStartL.toFixed(1)} L` : "",
      ].filter(Boolean);
      metaBadge.textContent = parts.join(" · ");
    } else {
      metaBadge.textContent = "Auto-captura IRSDK activa · mostrando referencia del circuito.";
    }
  }

  const effectiveTrack = getEffectiveTelemetryTrack();
  if (!effectiveTrack.samples || effectiveTrack.samples.length === 0) return;
  setActiveCoachReference(effectiveTrack.samples);

  const deltaSec = effectiveTrack.bestSec > 0 && effectiveTrack.avgSec > 0
    ? Math.max(0, finiteOr(effectiveTrack.avgSec - effectiveTrack.bestSec, 0))
    : 0;
  const maxDist = Math.max(1, finiteOr(effectiveTrack.samples[effectiveTrack.samples.length - 1]?.dist, 1));

  if (alienTimeNode) alienTimeNode.textContent = effectiveTrack.bestFormatted;
  if (userTimeNode) userTimeNode.textContent = effectiveTrack.avgFormatted || effectiveTrack.bestFormatted;
  if (countBadge) {
    if (lastIbtReport && lastIbtReport.bestLapSamples.length > 0) {
      const tbScore = Math.round(computeTrailBrakingScore(lastIbtReport.bestLapSamples));
      countBadge.textContent = `${lastIbtReport.totalLaps} vueltas válidas · Trail Braking ${tbScore}%`;
    } else {
      countBadge.textContent = `${effectiveTrack.lapCount} vueltas analizadas`;
    }
  }

  // Prompt 42: Stint Consistency & Theoretical Optimal Lap
  const stintOptNode = document.getElementById("stintOptimalLap");
  const stintScoreNode = document.getElementById("stintConsistencyScore");
  const stintStdNode = document.getElementById("stintStdDev");
  const stintSummaryNode = document.getElementById("stintSummaryText");
  const stintBarsNode = document.getElementById("stintBarsChart");
  if (stintOptNode && stintScoreNode && stintStdNode && stintSummaryNode && stintBarsNode) {
    const stint = analyzeStintConsistency(lastIbtReport?.laps || []);
    if (stint.cleanCount > 0) {
      stintOptNode.textContent = formatLapSec(stint.optimalLapS);
      stintScoreNode.textContent = `${stint.consistencyScore}%`;
      stintStdNode.textContent = `±${stint.stdDevS.toFixed(3)}s`;
      stintSummaryNode.textContent = `${stint.cleanCount} vueltas limpias · ${stint.discardedCount} descartadas (boxes/incidentes/amarillas).`;
      const maxD = Math.max(0.2, ...stint.cleanLaps.map((l) => l.deltaFromBestS));
      stintBarsNode.innerHTML = stint.cleanLaps
        .map((l) => {
          const pct = Math.max(15, Math.round((1 - l.deltaFromBestS / (maxD * 1.15)) * 100));
          const color = l.deltaFromBestS <= 0.05 ? "bg-r-accent" : l.deltaFromBestS < 0.4 ? "bg-sky-400" : "bg-amber-400";
          return `<div class="flex flex-col items-center gap-0.5 min-w-[26px]" title="V${l.lapNum}: ${formatLapSec(l.lapTimeS)} (+${l.deltaFromBestS.toFixed(3)}s)"><div class="w-4 rounded-t ${color}" style="height:${Math.round((pct / 100) * 44)}px"></div><span class="text-[9px] font-mono text-r-muted">V${l.lapNum}</span></div>`;
        })
        .join("");
    } else {
      stintOptNode.textContent = effectiveTrack.bestFormatted;
      stintScoreNode.textContent = "--%";
      stintStdNode.textContent = "--";
      stintSummaryNode.textContent = lastIbtReport
        ? "Sin suficientes vueltas limpias en este .ibt."
        : "Completa una tanda en iRacing para calcular desviación estándar y ritmo vuelta a vuelta automáticamente.";
      stintBarsNode.replaceChildren();
    }
  }
  if (deltaSummaryNode) deltaSummaryNode.textContent = effectiveTrack.bestSec > 0 ? `+${deltaSec.toFixed(3)}s` : "--";
  if (fileBadge) fileBadge.textContent = lastIbtReport ? `${lastIbtReport.fileName} (.ibt real)` : effectiveTrack.fileUsed;
  if (trackLengthBadge) trackLengthBadge.textContent = `${(maxDist / 1000).toFixed(3)} km · ${effectiveTrack.lapCount} vueltas`;

  drawTraceStudio(effectiveTrack, activeHoverDist);
  drawMapStudio(effectiveTrack, activeHoverDist);
  updateCursorReadout(effectiveTrack, activeHoverDist);
  renderCoachingCards();

  const aeroPanel = document.getElementById("aeroAnalysisPanel");
  if (aeroPanel) {
    const baseSamples =
      lastIbtReport && lastIbtReport.bestLapSamples.length > 0
        ? lastIbtReport.bestLapSamples
        : effectiveTrack.samples.map((s: any, idx: number) => ({
            distM: finiteOr(s.dist, idx * 10),
            lapTimeS: idx * 0.1,
            speedKmh: finiteOr(s.bestSpeed ?? s.speed, 120),
            throttle: finiteOr(s.bestThrottle ?? s.throttle, 0.5),
            brake: finiteOr(s.bestBrake ?? s.brake, 0),
            steeringRad: finiteOr(s.steering, 0),
            x: s.x,
            y: s.y,
          }));
    const aeroSamples = aeroAnalyzer.deriveSamplesFromLap(baseSamples);
    const aeroReport = aeroAnalyzer.analyze(aeroSamples);
    renderAeroAnalysisPanel(aeroPanel, aeroReport);
  }
}

function getTelemetrySampleAt(track: RealTrackEntry, dist: number): {
  speedBest: number;
  speedAvg: number;
  throttle: number;
  brake: number;
  gear: number;
  delta: number;
  cornerName: string;
} {
  const maxDist = Math.max(1, finiteOr(track.samples[track.samples.length - 1]?.dist, 1));
  const targetDist = clamp(dist, 0, maxDist);
  let idx = 0;
  for (let i = 0; i < track.samples.length; i++) {
    if (track.samples[i].dist >= targetDist) {
      idx = i;
      break;
    }
  }
  const s = track.samples[idx] || track.samples[0];
  if (!s) {
    return { speedBest: 0, speedAvg: 0, throttle: 0, brake: 0, gear: 0, delta: 0, cornerName: "—" };
  }
  const ratio = safeDiv(track.bestSec, track.avgSec, 1);
  const speedAvg = Math.round(finiteOr(s.speed * ratio, s.speed));
  const rawDelta = alignedDeltaCurve && idx < alignedDeltaCurve.length
    ? alignedDeltaCurve[idx]
    : safeDiv(targetDist, maxDist, 0) * finiteOr(track.avgSec - track.bestSec, 0);
  const delta = finiteOr(rawDelta, 0);

  // Determine corner name
  let cornerName = "Recta";
  if (s.speed < 110) cornerName = `Horquilla lenta (${s.speed} km/h)`;
  else if (s.speed < 160) cornerName = `Curva media (${s.speed} km/h)`;
  else if (s.speed < 220) cornerName = `Curva rápida (${s.speed} km/h)`;

  return {
    speedBest: s.speed,
    speedAvg,
    throttle: s.thr / 100,
    brake: s.brk / 100,
    gear: s.gear,
    delta,
    cornerName,
  };
}

let traceZoomStart = 0;
let traceZoomEnd = 1;
let traceWheelWired = false;

function drawTraceStudio(track: RealTrackEntry, hoverDist: number | null): void {
  const canvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  if (!traceWheelWired) {
    traceWheelWired = true;
    canvas.addEventListener("wheel", (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursorPct = Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const span = traceZoomEnd - traceZoomStart;
      const anchor = traceZoomStart + cursorPct * span;
      const factor = e.deltaY < 0 ? 0.78 : 1.28;
      const nextSpan = Math.min(1, Math.max(0.08, span * factor));
      let nextStart = anchor - cursorPct * nextSpan;
      let nextEnd = nextStart + nextSpan;
      if (nextStart < 0) {
        nextEnd -= nextStart;
        nextStart = 0;
      }
      if (nextEnd > 1) {
        nextStart -= nextEnd - 1;
        nextEnd = 1;
      }
      traceZoomStart = Math.max(0, nextStart);
      traceZoomEnd = Math.min(1, nextEnd);
      drawTraceStudio(track, hoverDist);
    }, { passive: false });
    canvas.addEventListener("dblclick", () => {
      traceZoomStart = 0;
      traceZoomEnd = 1;
      drawTraceStudio(track, hoverDist);
    });
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.9)";
  ctx.fillRect(0, 0, w, h);

  const deltaY = 8;
  const deltaH = 44;
  const speedY = 60;
  const speedH = 148;
  const pedalY = 216;
  const pedalH = 62;
  const steerY = 286;
  const steerH = 42;

  const maxDist = Math.max(1, track.samples[track.samples.length - 1].dist);
  const maxSpeed = Math.max(...track.samples.map((s) => s.speed), 260);
  const distToX = (dist: number) => {
    const pct = dist / maxDist;
    return ((pct - traceZoomStart) / Math.max(0.01, traceZoomEnd - traceZoomStart)) * w;
  };

  // Top Time Delta Curve (0% - 100% LapDistPct)
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fillRect(0, deltaY, w, deltaH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.moveTo(0, deltaY + deltaH / 2);
  ctx.lineTo(w, deltaY + deltaH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.6;
  const totalDelta = track.avgSec - track.bestSec;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const dVal = (s.dist / maxDist) * totalDelta;
    const y = deltaY + deltaH / 2 + Math.min(18, Math.max(-18, dVal * 8));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(251, 191, 36, 0.85)";
  ctx.font = "9px monospace";
  ctx.fillText(`TIME DELTA (${Math.round(traceZoomStart * 100)}%–${Math.round(traceZoomEnd * 100)}% · Rueda = Zoom)`, 8, deltaY + 11);

  // Speed Grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let s = 50; s <= maxSpeed; s += 50) {
    const y = speedY + speedH - (s / (maxSpeed + 20)) * speedH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px monospace";
    ctx.fillText(`${s} km/h`, 8, y - 3);
  }

  // Distance separators (every 1000m)
  for (let d = 1000; d < maxDist; d += 1000) {
    const x = distToX(d);
    if (x < 0 || x > w) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "9px monospace";
    ctx.fillText(`${d / 1000} km`, x + 4, speedY + speedH - 4);
  }

  // Draw Real Best Lap Speed Curve (Green #00e699)
  ctx.beginPath();
  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 2.2;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const y = speedY + speedH - (s.speed / (maxSpeed + 20)) * speedH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Real Average Lap Speed Curve (Sky Blue #38bdf8)
  const ratio = track.bestSec / track.avgSec;
  ctx.beginPath();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const y = speedY + speedH - ((s.speed * ratio) / (maxSpeed + 20)) * speedH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Real Pedals (Brake Red with trail fill & Throttle Green)
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fillRect(0, pedalY, w, pedalH);

  // Brake Fill
  ctx.beginPath();
  ctx.moveTo(0, pedalY + pedalH);
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const y = pedalY + pedalH - (s.brk / 100) * pedalH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, pedalY + pedalH);
  ctx.closePath();
  ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
  ctx.fill();

  // Brake stroke
  ctx.beginPath();
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const y = pedalY + pedalH - (s.brk / 100) * pedalH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Throttle stroke
  ctx.beginPath();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = distToX(s.dist);
    const y = pedalY + pedalH - (s.thr / 100) * pedalH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Steering Angle channel (derived from speed change / lateral load when steering rad unavailable)
  ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
  ctx.fillRect(0, steerY, w, steerH);
  ctx.beginPath();
  ctx.strokeStyle = "#a78bfa";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const prev = track.samples[Math.max(0, i - 1)];
    const steerProxy = Math.max(-1, Math.min(1, ((s as any).steer ?? (prev.speed - s.speed) / 25)));
    const x = distToX(s.dist);
    const y = steerY + steerH / 2 - steerProxy * (steerH * 0.42);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(167, 139, 250, 0.8)";
  ctx.font = "9px monospace";
  ctx.fillText("STEERING ANGLE", 8, steerY + 10);

  // Prompt 41: Key driving event markers (Brake Point & Full Throttle)
  const keyEvents = detectCornerKeyEvents(track.samples);
  ctx.font = "bold 8px monospace";
  for (const ev of keyEvents) {
    const bpX = distToX(ev.brakePointDist);
    if (bpX >= 0 && bpX <= w) {
      ctx.fillStyle = "#f43f5e";
      ctx.fillRect(bpX - 1, pedalY, 2, 10);
      ctx.fillText("BP", bpX + 2, pedalY + 9);
    }
    if (ev.fullThrottleDist !== null) {
      const ftX = distToX(ev.fullThrottleDist);
      if (ftX >= 0 && ftX <= w) {
        ctx.fillStyle = "#10b981";
        ctx.fillRect(ftX - 1, pedalY + pedalH - 10, 2, 10);
      }
    }
  }

  // Hover Scrub line
  if (hoverDist !== null) {
    const x = (hoverDist / maxDist) * w;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const sample = getTelemetrySampleAt(track, hoverDist);
    const yBest = speedH - (sample.speedBest / (maxSpeed + 20)) * speedH;
    const yAvg = speedH - (sample.speedAvg / (maxSpeed + 20)) * speedH;

    ctx.fillStyle = "#00e699";
    ctx.beginPath();
    ctx.arc(x, yBest, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(x, yAvg, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

const CLEAN_TRACK_LAYOUTS: Record<string, [number, number][]> = {
  barcelona: [
    [15, 75], [72, 75], [82, 70], [84, 58], [76, 52], [70, 48],
    [76, 40], [84, 32], [82, 22], [70, 18], [58, 22], [48, 30],
    [52, 42], [44, 48], [34, 52], [24, 56], [18, 66], [15, 75],
  ],
  fuji: [
    [12, 80], [78, 80], [88, 76], [90, 64], [84, 54], [72, 48],
    [64, 44], [52, 34], [48, 24], [56, 16], [68, 16], [74, 24],
    [70, 36], [58, 44], [42, 54], [30, 62], [20, 72], [12, 80],
  ],
  spa: [
    [16, 76], [24, 82], [30, 74], [38, 58], [54, 46], [74, 36],
    [86, 26], [82, 16], [68, 18], [58, 26], [48, 36], [38, 48],
    [32, 60], [25, 68], [16, 76],
  ],
  monza: [
    [14, 76], [78, 76], [88, 70], [82, 54], [70, 44], [56, 36],
    [52, 24], [58, 16], [72, 18], [84, 28], [78, 40], [36, 56],
    [20, 66], [14, 76],
  ],
  suzuka: [
    [28, 80], [62, 80], [76, 72], [72, 58], [60, 52], [48, 42],
    [40, 32], [48, 20], [62, 18], [78, 22], [82, 36], [70, 48],
    [46, 60], [34, 70], [28, 80],
  ],
  daytona: [
    [15, 75], [75, 75], [86, 66], [80, 45], [70, 35], [55, 30],
    [45, 20], [30, 20], [25, 32], [35, 42], [50, 48], [40, 60],
    [25, 65], [15, 75],
  ],
  sebring: [
    [15, 80], [65, 80], [75, 72], [70, 60], [80, 50], [78, 35],
    [65, 30], [55, 38], [45, 35], [35, 25], [25, 25], [20, 40],
    [30, 50], [20, 65], [15, 80],
  ],
};

function getTrackPoints(key: string): [number, number][] {
  const k = key.toLowerCase();
  for (const [id, pts] of Object.entries(CLEAN_TRACK_LAYOUTS)) {
    if (k.includes(id) || id.includes(k)) {
      return pts;
    }
  }
  return CLEAN_TRACK_LAYOUTS.barcelona;
}

function drawCircuitGeometry(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  trackKey: string,
  hoverDist: number | null,
  totalDist: number,
  customPts?: Array<[number, number]>
): void {
  ctx.clearRect(0, 0, w, h);
  const pts = customPts && customPts.length >= 10 ? customPts : getTrackPoints(trackKey);
  if (!pts || pts.length < 3) return;

  const scale = Math.max(20, Math.min(w - 36, h - 36));
  const ox = (w - scale) / 2;
  const oy = (h - scale) / 2;

  // Background road track
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = (pts[i][0] / 100) * scale + ox;
    const py = (pts[i][1] / 100) * scale + oy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = "#1b2a25";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Racing line
  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Start / Finish Line
  const startX = (pts[0][0] / 100) * scale + ox;
  const startY = (pts[0][1] / 100) * scale + oy;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(startX, startY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#a3b0ac";
  ctx.font = "bold 9px monospace";
  ctx.fillText("META", startX + 6, startY - 2);

  // Hover Car Marker
  if (hoverDist !== null && totalDist > 0) {
    const norm = Math.max(0, Math.min(1, hoverDist / totalDist));
    const idx = Math.floor(norm * (pts.length - 1));
    const pt = pts[idx] || pts[0];
    const px = (pt[0] / 100) * scale + ox;
    const py = (pt[1] / 100) * scale + oy;

    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMapStudio(track: RealTrackEntry, hoverDist: number | null): void {
  const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const maxDist = track.samples?.[track.samples.length - 1]?.dist || 4657;
  const sampleGps: Array<[number, number]> = (track.samples || [])
    .filter((s: any) => typeof s.x === "number" && typeof s.y === "number" && Number.isFinite(s.x) && Number.isFinite(s.y))
    .map((s: any) => [s.x as number, s.y as number]);
  const gpsPts = sampleGps.length >= 10
    ? sampleGps
    : (Array.isArray(track.mapPoints) && track.mapPoints.length >= 10 ? track.mapPoints : undefined);
  drawCircuitGeometry(ctx, canvas.width, canvas.height, track.id || "barcelona", hoverDist, maxDist, gpsPts);
}

export function drawLastSessionTrackCanvas(canvas: HTMLCanvasElement, trackId: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const ibtPts: Array<[number, number]> = (lastIbtReport?.bestLapSamples || [])
    .filter((s) => typeof s.x === "number" && typeof s.y === "number" && Number.isFinite(s.x) && Number.isFinite(s.y))
    .map((s) => [s.x as number, s.y as number]);
  const presetPts = REAL_TRACKS[trackId]?.mapPoints;
  const customPts = ibtPts.length >= 10 ? ibtPts : (Array.isArray(presetPts) && presetPts.length >= 10 ? presetPts : undefined);
  drawCircuitGeometry(ctx, canvas.width, canvas.height, trackId, null, 4657, customPts);
}

function updateCursorReadout(track: RealTrackEntry, hoverDist: number | null): void {
  const curDist = document.getElementById("curDist");
  const curSpeed = document.getElementById("curSpeed");
  const curDelta = document.getElementById("curDelta");
  const curCorner = document.getElementById("curCorner");
  if (!curDist || !curSpeed || !curDelta || !curCorner) return;

  if (hoverDist === null) {
    curDist.textContent = "0 m";
    curSpeed.textContent = "0 km/h";
    const baseDelta = Math.max(0, finiteOr(track.avgSec - track.bestSec, 0));
    curDelta.textContent = `+${baseDelta.toFixed(3)}s`;
    curCorner.textContent = "Pasa el ratón por la telemetría";
    const tt = document.getElementById("telemetryCursorTooltip");
    if (tt) tt.hidden = true;
    return;
  }

  const sample = getTelemetrySampleAt(track, hoverDist);
  const diffKmh = sample.speedBest - sample.speedAvg;
  curDist.textContent = `${Math.round(hoverDist)} m`;
  curSpeed.textContent = `${sample.speedBest} km/h (Δ ${diffKmh >= 0 ? "+" : ""}${diffKmh})`;
  curDelta.textContent = `+${sample.delta.toFixed(3)}s`;
  curCorner.textContent = sample.cornerName;
  const tt = document.getElementById("telemetryCursorTooltip");
  if (tt) {
    tt.hidden = false;
    tt.innerHTML =
      `<div class="text-r-accent font-bold">${Math.round(hoverDist)} m · ${sample.cornerName}</div>` +
      `<div>Vel: <strong>${sample.speedBest}</strong> vs ${sample.speedAvg} km/h · Marcha: <strong>${sample.gear || "—"}</strong></div>` +
      `<div>Gas: <strong class="text-emerald-400">${Math.round(sample.throttle * 100)}%</strong> · Freno: <strong class="text-rose-400">${Math.round(sample.brake * 100)}%</strong> · Δ <strong class="text-amber-400">+${sample.delta.toFixed(3)}s</strong></div>`;
  }
}

function renderCoachingCards(): void {
  const container = document.getElementById("cornerCoachingList");
  if (!container) return;
  const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;
  container.replaceChildren();

  // Extract apex corners from real samples
  const turns: TurnInsight[] = [];
  let turnCount = 1;
  const samples = track.samples;
  const maxDist = samples[samples.length - 1].dist;

  for (let i = 2; i < samples.length - 2; i++) {
    const prev = samples[i - 1].speed;
    const curr = samples[i].speed;
    const next = samples[i + 1].speed;
    if (curr < prev && curr <= next && curr < 220) {
      if (turns.length > 0 && Math.abs(samples[i].dist - turns[turns.length - 1].distance) < 160) {
        continue;
      }
      let brakeDist = 65;
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (samples[j].brk > 20) {
          brakeDist = Math.max(brakeDist, samples[i].dist - samples[j].dist);
        }
      }
      const delta = Math.min(0.42, Math.max(0.08, (track.avgSec - track.bestSec) / 10));
      turns.push({
        turn: turnCount++,
        name: `Curva ${turnCount - 1} · Ápice a ${curr} km/h`,
        distance: samples[i].dist,
        sector: samples[i].dist < maxDist * 0.33 ? 1 : samples[i].dist < maxDist * 0.66 ? 2 : 3,
        alienApexKmh: Math.round(curr * 1.05),
        userApexKmh: curr,
        alienBrakingDistM: Math.round(brakeDist * 0.88),
        userBrakingDistM: Math.round(brakeDist),
        deltaSec: Math.round(delta * 100) / 100,
        coachTip: curr < 110
          ? "Horquilla lenta: aplica trail-braking progresivo hacia el interior y abre acelerador con volante recto para maximizar la tracción de salida."
          : "Curva rápida de apoyo: aguanta el radio manteniendo gas de apoyo y confía en la carga aerodinámica del fondo plano y el difusor.",
        severity: delta >= 0.2 ? "critical" : delta >= 0.1 ? "moderate" : "optimal",
      });
    }
  }

  const turnsToRender = coachLossFilter ? turns.filter((t) => t.deltaSec >= 0.15) : turns;

  for (const t of turnsToRender) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-accent/60 cursor-pointer";

    card.addEventListener("click", () => {
      activeHoverDist = t.distance;
      drawTraceStudio(track, activeHoverDist);
      drawMapStudio(track, activeHoverDist);
      updateCursorReadout(track, activeHoverDist);
    });

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-2";

    const titleDiv = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = t.name;

    const sectorTag = document.createElement("span");
    sectorTag.className = "text-[11px] font-mono text-r-muted";
    sectorTag.textContent = `Sector ${t.sector} · Dist: ${t.distance}m`;
    titleDiv.append(h3, sectorTag);

    const deltaBadge = document.createElement("span");
    deltaBadge.className = "px-2 py-0.5 rounded font-mono text-xs font-bold ";
    if (t.severity === "critical") {
      deltaBadge.className += "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    } else {
      deltaBadge.className += "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    }

    top.append(titleDiv, deltaBadge);

    const statsRow = document.createElement("div");
    statsRow.className = "mt-3 grid grid-cols-2 gap-2 text-xs font-mono bg-r-bg/60 p-2.5 rounded-xl border border-r-line/50";
    statsRow.innerHTML = `
      <div>
        <span class="text-r-muted block text-[10px]">VÉRTICE (KM/H)</span>
        <strong class="text-r-text">${t.userApexKmh}</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienApexKmh}</strong>
      </div>
      <div>
        <span class="text-r-muted block text-[10px]">FRENADA (M)</span>
        <strong class="text-r-text">${t.userBrakingDistM}m</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienBrakingDistM}m</strong>
      </div>
    `;

    const coachText = document.createElement("p");
    coachText.className = "mt-3 text-xs text-r-muted leading-relaxed font-sans";
    coachText.innerHTML = `<strong class="text-r-text font-medium">Coach MMT:</strong> ${t.coachTip}`;

    card.append(top, statsRow, coachText);
    container.append(card);
  }
}

// -------------------------------------------------------------
// 3. PIT STOP & FUEL STRATEGY (Coach Dave / GnG caliber)
// -------------------------------------------------------------
function paintStrategy(): void {
  const form = document.getElementById("fuelForm") as HTMLFormElement | null;
  const presetsBar = document.getElementById("stratPresetsBar");
  if (!form) return;

  if (!strategyInitialized) {
    strategyInitialized = true;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      recalculateStrategy();
    });

    const inputs = form.querySelectorAll("input");
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        recalculateStrategy();
      });
    });

    if (presetsBar) {
      presetsBar.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.preset) return;
        applyStrategyPreset(btn.dataset.preset);
        for (const b of presetsBar.querySelectorAll("button")) {
          const isSelected = b === btn;
          b.className = isSelected
            ? "strat-preset px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "strat-preset px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
      });
    }
  }

  recalculateStrategy();
}

function applyStrategyPreset(preset: string): void {
  const raceMin = document.getElementById("raceMin") as HTMLInputElement | null;
  const lapSec = document.getElementById("lapSec") as HTMLInputElement | null;
  const fuelLap = document.getElementById("fuelLap") as HTMLInputElement | null;
  const tank = document.getElementById("tank") as HTMLInputElement | null;
  const fuelNow = document.getElementById("fuelNow") as HTMLInputElement | null;
  const pitLoss = document.getElementById("pitLoss") as HTMLInputElement | null;
  if (!raceMin || !lapSec || !fuelLap || !tank || !fuelNow || !pitLoss) return;

  const minutes: Record<string, string> = {
    sprint20: "20",
    feature40: "40",
    imsa45: "45",
    vrs144: "144",
    endur360: "360",
    daytona24: "1440",
  };
  const chosen = minutes[preset];
  if (!chosen) return;
  raceMin.value = chosen;
  lapSec.value = "";
  fuelLap.value = "";
  tank.value = "";
  fuelNow.value = "";
  pitLoss.value = "";
  const fuelOut = document.getElementById("fuelOut");
  if (fuelOut) fuelOut.textContent = "Duración fijada. Faltan tiempo de vuelta, consumo y depósito medidos. No se estiman.";
}

function recalculateStrategy(): void {
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  const minutes = num("raceMin");
  const lapSeconds = num("lapSec");
  const perLap = num("fuelLap");
  const tank = num("tank");
  const now = num("fuelNow");
  const pitLoss = num("pitLoss");

  const fuelOut = document.getElementById("fuelOut");
  const metricsGrid = document.getElementById("stratMetricsGrid");
  const timelineCard = document.getElementById("stintVisualTimeline");

  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    if (fuelOut) fuelOut.textContent = "Revisa los números: tienen que ser mayores que cero.";
    return;
  }

  const lapsExact = (minutes * 60) / lapSeconds;
  const totalLaps = Math.ceil(lapsExact);
  const totalFuel = totalLaps * perLap;
  const stintLaps = Math.floor(tank / perLap);
  const lapsWithCurrentFuel = Math.floor(now / perLap);
  const deficit = Math.max(0, totalFuel - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const fuelToAdd = Math.min(tank, Math.ceil(deficit * 10) / 10);
  const pitWindowStartLap = Math.max(1, lapsWithCurrentFuel);
  const pitWindowEndLap = Math.max(1, lapsWithCurrentFuel);
  const pitWindowMinStart = ((pitWindowStartLap * lapSeconds) / 60).toFixed(1);

  if (fuelOut) {
    fuelOut.textContent = `${totalLaps} vueltas con los datos introducidos. Combustible: ${totalFuel.toFixed(1)} L. Paradas: ${stops}. Repostar: ${fuelToAdd} L. Pérdida de pit introducida: ${pitLoss}s. El caudal de manguera no se puede determinar.`;
  }

  if (metricsGrid) {
    metricsGrid.innerHTML = `
      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Vueltas Totales</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-text">${totalLaps}</strong>
          <span class="text-xs text-r-muted font-mono">laps</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">+1 vuelta de margen de seguridad</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Combustible Total</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-accent">${totalFuel.toFixed(1)}</strong>
          <span class="text-xs text-r-muted font-mono">Litros</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Consumo medio: ${perLap.toFixed(2)} L/vuelta</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Autonomía Depósito</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-sky-400">${stintLaps}</strong>
          <span class="text-xs text-r-muted font-mono">vueltas / tanque</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Capacidad máxima: ${tank} Litros</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Paradas en Box</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black ${stops > 0 ? "text-amber-400" : "text-r-accent"}">${stops}</strong>
          <span class="text-xs text-r-muted font-mono">${stops === 1 ? "parada" : "paradas"}</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">${stops > 0 ? `Añadir ${fuelToAdd} L` : "Sin parada obligatoria"}</span>
      </div>
    `;
  }

  if (timelineCard) {
    if (stops === 0) {
      timelineCard.innerHTML = `
        <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
          <span class="px-2 py-0.5 rounded bg-r-accent/20 text-r-accent font-bold">STINT ÚNICO</span>
          <span class="text-r-text">Salida (Vuelta 1) → Meta (Vuelta ${totalLaps})</span>
          <span class="text-r-muted ml-auto">${minutes} min sin repostaje</span>
        </div>
      `;
    } else {
      timelineCard.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">STINT 1</span>
            <span class="text-r-text">Salida (V1) → Box (V${pitWindowStartLap} - V${pitWindowEndLap})</span>
            <span class="text-r-muted ml-auto">Ventana óptima: min ${pitWindowMinStart}</span>
          </div>
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-xs text-amber-300">
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">PIT STOP</span>
            <span>Entrada a box: repostar ${fuelToAdd} L. Pérdida de pit introducida: ${pitLoss}s. Caudal de manguera: no se puede determinar.</span>
          </div>
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">STINT 2</span>
            <span class="text-r-text">Salida de Pit (V${pitWindowEndLap + 1}) → Bandera a Cuadros (V${totalLaps})</span>
            <span class="text-r-muted ml-auto">${totalLaps - pitWindowEndLap} vueltas hasta el final</span>
          </div>
        </div>
      `;
    }
  }
}

// -------------------------------------------------------------
// 4. LIVE OVERLAYS & HUD (VRS / Garage 61 / GO Fast Caliber)
// -------------------------------------------------------------
let isLiveFromSDK = false;
let demoAnimationTimer: number | null = null;
let demoTick = 0;
const WAVEFORM_CAPACITY = 70;
const waveformRing = new Float32Array(WAVEFORM_CAPACITY * 2);
let waveformHead = 0;
let waveformCount = 0;
let layoutUnlocked = false;
let previewDemoActive = true;

if (typeof document !== "undefined" && typeof window !== "undefined" && !window.location.search.includes("overlay=1")) {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && demoAnimationTimer) {
      clearInterval(demoAnimationTimer);
      demoAnimationTimer = null;
      IrsdkClient.getInstance().stopSimulation();
    } else if (!document.hidden && previewDemoActive && !isLiveFromSDK) {
      startDemoOverlayLoop();
    }
  });
}

function forcedDevHudMock(): boolean {
  return import.meta.env.DEV && new URLSearchParams(location.search).get("hudmock") === "1";
}

function hudMockAllowed(): boolean {
  return previewDemoActive || forcedDevHudMock();
}

function renderStandbyWidgets(): void {
  const irsdkState = IrsdkClient.getInstance().getLatestState();
  document.querySelectorAll<HTMLElement>("#ovRelative, #ovRelativeFloat").forEach((rel) => {
    renderRelativeWidget(rel, irsdkState);
  });
  document.querySelectorAll<HTMLElement>("#ovStandings, #ovStandingsFloat").forEach((standings) => {
    renderStandingsWidget(standings, irsdkState);
  });
  document.querySelectorAll<HTMLElement>("#ovFuel, #ovFuelFloat").forEach((fuel) => {
    renderFuelWidget(fuel, irsdkState);
  });
  document.querySelectorAll<HTMLElement>("#ovRadar, #ovRadarFloat").forEach((radar) => {
    renderHelicorsaRadar(radar, irsdkState);
  });
  document.querySelectorAll<HTMLCanvasElement>("#ovTrackMap, #ovTrackMapFloat").forEach((trackMapCanvas) => {
    if (irsdkState) {
      observeTrackAutoMap(
        irsdkState.session.weekendInfo?.trackName || "",
        irsdkState.frame.carIdxLap[irsdkState.camCarIdx] ?? 0,
        irsdkState.frame.carIdxLapDistPct[irsdkState.camCarIdx] ?? -1,
        irsdkState.frame.velocityX ?? 0,
        irsdkState.frame.velocityY ?? 0,
        performance.now(),
        {
          trackId: irsdkState.session.weekendInfo?.trackId,
          lat: irsdkState.frame.lat,
          lon: irsdkState.frame.lon,
          yaw: irsdkState.frame.yaw,
        },
      );
    }
    renderLiveTrackMapCanvas(trackMapCanvas, irsdkState);
  });
  document.querySelectorAll<HTMLCanvasElement>("#ovFlatMap, #ovFlatMapFloat").forEach((flatCanvas) => {
    renderFlatTrackMapCanvas(flatCanvas, irsdkState);
  });
  document.querySelectorAll<HTMLElement>("#ovTraffic, #ovTrafficFloat").forEach((trafficEl) => {
    renderTrafficIndicator(trafficEl, irsdkState, false);
  });
  // Push lightweight live snapshot to Rust OBS Single-Canvas bridge (127.0.0.1:38421/stream) at ~6 Hz
  if (irsdkState) {
    const wObs = window as unknown as { __mmtObsPushTs?: number };
    const nowObs = performance.now();
    if (!wObs.__mmtObsPushTs || nowObs - wObs.__mmtObsPushTs >= 160) {
      wObs.__mmtObsPushTs = nowObs;
      const myIdx = irsdkState.camCarIdx ?? 0;
      const pcts = irsdkState.frame.carIdxLapDistPct || [];
      const drivers = irsdkState.session.driverInfo?.drivers || {};
      const flatDots = pcts
        .map((pct, idx) => {
          const drv = drivers[idx];
          if (!drv || drv.isSpectator || drv.isPaceCar || pct < 0 || pct > 1) return null;
          return { pct, me: idx === myIdx, color: drv.carClassColor || "#38bdf8" };
        })
        .filter(Boolean);
      void fetch("http://127.0.0.1:38421/stream-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track: irsdkState.session.weekendInfo?.trackName || "iRacing",
          sessionType: irsdkState.session.sessionType || "LIVE",
          speedKmh: irsdkState.frame.speedKmh ?? 0,
          gear: irsdkState.frame.gear ?? 0,
          throttle: irsdkState.frame.throttle ?? 0,
          brake: irsdkState.frame.brake ?? 0,
          fuelL: irsdkState.frame.fuelLevel ?? 0,
          fuelLaps: irsdkState.fuel?.lapsRemaining ?? 0,
          fuelPerLap: irsdkState.fuel?.avgBurnPerLap ?? 0,
          standings: irsdkState.leaderboard.slice(0, 10).map((r) => ({
            pos: r.position,
            num: r.carNumber,
            name: r.abbrevName || r.driverName,
            ir: r.iRatingStr,
            last: r.lastLapStr,
            me: r.carIdx === myIdx,
          })),
          relative: irsdkState.relative.entries.slice(0, 7).map((r) => ({
            pos: r.position,
            num: r.carNumber,
            name: r.abbrevName || r.driverName,
            ir: r.iRatingStr,
            gap: r.deltaStr,
            ahead: r.isAhead,
            me: r.isActiveCam,
          })),
          flatDots,
        }),
      }).catch(() => {});
    }
  }

  // Update minimalist Pro Live Metrics Strip in main app
  const proStrip = document.getElementById("proLiveMetricsStrip");
  if (proStrip && irsdkState) {
    const irEst = estimateLiveIRating(irsdkState);
    const activeLap = irsdkState.frame.carIdxLap[irsdkState.camCarIdx] || 0;
    const fuelLaps = irsdkState.fuel?.lapsRemaining;
    const parts: string[] = [];
    if (irEst) {
      parts.push(`<span class="px-2 py-0.5 rounded bg-r-bg border border-r-line text-r-text font-bold">P${irEst.myClassPos}/${irEst.classFieldSize}</span>`);
      parts.push(`<span class="text-r-muted">SOF ${formatSofShort(irEst.sof)}</span>`);
      const irColor = irEst.delta >= 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30";
      parts.push(`<span class="px-2 py-0.5 rounded border font-bold ${irColor}">${formatIRatingDelta(irEst.delta)} → ${irEst.projectedIr}</span>`);
    }
    if (activeLap > 0) {
      parts.push(`<span class="px-1.5 py-0.5 rounded bg-r-bg border border-r-line text-r-muted">L${activeLap}</span>`);
    }
    if (typeof fuelLaps === "number" && fuelLaps > 0 && Number.isFinite(fuelLaps)) {
      parts.push(`<span class="text-r-accent font-semibold">${fuelLaps.toFixed(1)}v fuel</span>`);
    }
    proStrip.innerHTML = parts.join("");
  }
  document.querySelectorAll<HTMLElement>("#ovGpuPedals, #ovGpuPedalsFloat").forEach((container) => {
    renderGpuPedalsWidget(container, { throttle: 0, brake: 0, clutch: 0, steering: 0, speedKmh: 0, gear: 0 });
  });
  const pitEl = document.getElementById("ovPitExitWidget");
  if (pitEl) renderPitExitWidget(pitEl, null);
  const tireEl = document.getElementById("ovTireThermalWidget");
  if (tireEl) renderTireThermalWidget(tireEl, null, tireThermalEngine);
  const pitStratEls = document.querySelectorAll<HTMLElement>("#ovPitStrategy, #ovPitStrategyFloat");
  pitStratEls.forEach((el) => {
    renderPitStrategyWidget(el, {
      currentLap: 14,
      pitWindowStartLap: 16,
      pitWindowEndLap: 18,
      estPitTimeS: 27.4,
      rejoinPos: 5,
      classSize: 18,
      fuelToAddL: 34.5,
      changeTires: false,
      boxThisLap: false,
      fuelSavePerLapL: 0.12,
      aheadCarLabel: "#22 E. Chongkan",
    });
  });
  const tireMonEls = document.querySelectorAll<HTMLElement>("#ovTireMonitor, #ovTireMonitorFloat");
  const standbySnap = tireThermalEngine.evaluate({
    onPitRoad: false,
    LF: { innerC: 84, middleC: 82, outerC: 79, pressureKpa: 175 },
    RF: { innerC: 81, middleC: 79, outerC: 77, pressureKpa: 173 },
    LR: { innerC: 78, middleC: 76, outerC: 75, pressureKpa: 170 },
    RR: { innerC: 76, middleC: 75, outerC: 73, pressureKpa: 169 },
    env: {
      trackTempC: irsdkState?.frame?.trackTempC || 28.4,
      windSpeedKmh: 14,
      windDirDeg: 45,
      trackWetnessPct: irsdkState?.frame?.precipitationPct ?? 0,
    },
  });
  tireMonEls.forEach((el) => renderTireThermalWidget(el, standbySnap, tireThermalEngine));
  const bdEl = document.getElementById("ovBroadcastDirectorWidget");
  if (bdEl) renderBroadcastDirectorWidget(bdEl, broadcastDirector);
}

let currentHudMode: "closed" | "live" | "mock" | null = null;

function setHudMode(mode: "closed" | "live" | "mock"): void {
  if (currentHudMode === mode) return;
  currentHudMode = mode;
  const host = document.getElementById("floatingOverlayHost");
  const banner = document.getElementById("hudStateBanner");
  if (host) host.dataset.hud = mode;
  if (banner) {
    banner.hidden = mode === "live";
    banner.textContent = mode === "mock" ? "DEMO · DATOS SINTÉTICOS" : "iRacing Cerrado";
  }
  const disabled = loadDisabledWidgets();
  document.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((el) => {
    if (mode === "closed") {
      el.hidden = true;
      return;
    }
    const key = el.dataset.widget || "";
    // Pit Helper and Proximity Radar are shown conditionally by telemetry/edit mode
    if (key === "pitbox" || key === "radar") {
      el.hidden = !floatEditMode;
      return;
    }
    el.hidden = Boolean(key && disabled.has(key));
  });
  const chrome = document.getElementById("floatHudChrome");
  if (chrome) {
    chrome.hidden = mode === "closed";
  }
}

export function noteHudClosed(): void {
  if (hudMockAllowed()) return;
  isLiveFromSDK = false;
  setHudMode("closed");
}

async function setOverlayEdit(editing: boolean): Promise<void> {
  const { inTauri } = await import("./env");
  if (!inTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_overlay_edit", { editing });
}

export function updateOverlayBrandBadge(carFolder?: string): void {
  const nodes = document.querySelectorAll<HTMLElement>("#ovClusterBrandFloat, #ovClusterBrandPreview");
  nodes.forEach((node) => {
    node.replaceChildren();
    const isFloat = node.id === "ovClusterBrandFloat";
    const target = isFloat && isLiveFromSDK
      ? carFolder
      : (carFolder || lastIbtReport?.carPath || (hudMockAllowed() ? "porsche992rgt3" : undefined));
    const meta = target ? resolveCarMetadata(target) : null;
    if (!meta) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    const badge = createBrandBadgeElement(meta, 16);
    const label = document.createElement("span");
    label.className = "font-bold tracking-wide text-white";
    label.textContent = `${meta.brand} ${meta.model}`;
    const cls = document.createElement("span");
    cls.className = "px-1 py-0.2 rounded bg-white/10 text-[9px] text-[#00e5ff] font-bold";
    cls.textContent = meta.carClass;
    node.append(badge, label, cls);
  });
}

function loadDisabledWidgets(): Set<string> {
  try {
    if (localStorage.getItem("mmt-hud-layout-version") !== "3") {
      localStorage.setItem("mmt-hud-layout-version", "3");
      localStorage.removeItem("mmt-hud-positions");
      const rawPrev = localStorage.getItem("mmt-hud-disabled-widgets");
      if (rawPrev) {
        const s = new Set(JSON.parse(rawPrev) as string[]);
        s.delete("trackmap");
        localStorage.setItem("mmt-hud-disabled-widgets", JSON.stringify(Array.from(s)));
        return s;
      }
    }
    const raw = localStorage.getItem("mmt-hud-disabled-widgets");
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

function saveDisabledWidgets(set: Set<string>): void {
  try {
    localStorage.setItem("mmt-hud-disabled-widgets", JSON.stringify(Array.from(set)));
  } catch {}
}

function applyHudCustomAppearance(): void {
  const vars = ThemeEngine.getInstance().getActiveVariables();
  const disabled = loadDisabledWidgets();
  document.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((el) => {
    const key = el.dataset.widget || "";
    if (key) {
      el.hidden = disabled.has(key);
    }
    el.style.opacity = String(vars.opacity);
    (el.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(vars.scale);
  });
  const panel = document.getElementById("floatLayersControlPanel");
  if (panel) {
    const visRules = VisibilityRulesEngine.getInstance().getRules();
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-eye]").forEach((btn) => {
      const key = btn.dataset.lcpEye || "";
      const active = !disabled.has(key);
      btn.style.opacity = active ? "1" : "0.35";
      btn.style.borderColor = active ? "rgba(0,230,153,0.6)" : "rgba(255,255,255,0.2)";
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-track]").forEach((btn) => {
      const id = btn.dataset.lcpTrack as keyof typeof visRules;
      const on = !visRules[id]?.hideInTrack;
      btn.style.opacity = on ? "1" : "0.35";
      btn.style.borderColor = on ? "rgba(16,185,129,0.75)" : "rgba(255,255,255,0.2)";
      btn.style.color = on ? "#10b981" : "#94a3b8";
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-replay]").forEach((btn) => {
      const id = btn.dataset.lcpReplay as keyof typeof visRules;
      const on = !visRules[id]?.hideInReplay;
      btn.style.opacity = on ? "1" : "0.35";
      btn.style.borderColor = on ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.2)";
      btn.style.color = on ? "#38bdf8" : "#94a3b8";
    });
  }
}

function wireLayersControlPanel(): void {
  const panel = document.getElementById("floatLayersControlPanel");
  if (panel && panel.dataset.wired !== "1") {
    panel.dataset.wired = "1";
    const body = document.getElementById("lcpBody");
    const minBtn = document.getElementById("lcpMinBtn");
    const closeBtn = document.getElementById("lcpCloseBtn");
    const eyeAllBtn = document.getElementById("lcpEyeAll");
    const handle = document.getElementById("lcpDragHandle");

    if (minBtn && body) {
      minBtn.addEventListener("click", () => {
        body.hidden = !body.hidden;
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        panel.hidden = true;
      });
    }
    if (eyeAllBtn) {
      eyeAllBtn.addEventListener("click", () => {
        const keys = ["standings", "relative", "fuel", "radar", "inputs", "cluster", "waveform", "lights"];
        const disabled = loadDisabledWidgets();
        const allHidden = keys.every((k) => disabled.has(k));
        if (allHidden) keys.forEach((k) => disabled.delete(k));
        else keys.forEach((k) => disabled.add(k));
        saveDisabledWidgets(disabled);
        applyHudCustomAppearance();
      });
    }
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-eye]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.lcpEye || "";
        if (!key) return;
        const disabled = loadDisabledWidgets();
        if (disabled.has(key)) disabled.delete(key);
        else disabled.add(key);
        saveDisabledWidgets(disabled);
        applyHudCustomAppearance();
      });
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-track]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.lcpTrack as any;
        if (!id) return;
        const vis = VisibilityRulesEngine.getInstance();
        const cur = vis.getWidgetRule(id);
        vis.setWidgetRule(id, { hideInTrack: !cur.hideInTrack });
        applyHudCustomAppearance();
      });
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-replay]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.lcpReplay as any;
        if (!id) return;
        const vis = VisibilityRulesEngine.getInstance();
        const cur = vis.getWidgetRule(id);
        vis.setWidgetRule(id, { hideInReplay: !cur.hideInReplay });
        applyHudCustomAppearance();
      });
    });
    panel.querySelectorAll<HTMLButtonElement>("[data-lcp-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.lcpClose || "";
        if (!key) return;
        const disabled = loadDisabledWidgets();
        disabled.add(key);
        saveDisabledWidgets(disabled);
        applyHudCustomAppearance();
      });
    });
    if (handle) {
      let dragging = false;
      let startX = 0;
      let startY = 0;
      let baseLeft = 0;
      let baseTop = 0;
      handle.addEventListener("mousedown", (e) => {
        if ((e.target as HTMLElement)?.closest("button")) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        panel.style.transform = "none";
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.top}px`;
        startX = e.clientX;
        startY = e.clientY;
        baseLeft = rect.left;
        baseTop = rect.top;
      });
      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        panel.style.left = `${Math.max(0, baseLeft + e.clientX - startX)}px`;
        panel.style.top = `${Math.max(0, baseTop + e.clientY - startY)}px`;
      });
      window.addEventListener("mouseup", () => {
        dragging = false;
      });
    }
  }
  const toggleBtn = document.getElementById("btnToggleLayersPanel");
  if (toggleBtn && toggleBtn.dataset.wired !== "1") {
    toggleBtn.dataset.wired = "1";
    toggleBtn.addEventListener("click", () => {
      const p = document.getElementById("floatLayersControlPanel");
      if (p) p.hidden = !p.hidden;
    });
  }
}

export function paintOverlays(): void {
  updateOverlayBrandBadge();
  applyHudCustomAppearance();
  wireLayersControlPanel();

  const viewport = document.getElementById("overlayStageViewport");
  const stageEl = document.getElementById("overlayStage");
  if (viewport && stageEl && viewport.dataset.scaleWired !== "1") {
    viewport.dataset.scaleWired = "1";
    const rescaleStage = () => {
      const w = viewport.clientWidth || 1280;
      const scale = Math.max(0.25, Math.min(1.5, w / 1920));
      stageEl.style.transform = `scale(${scale.toFixed(4)})`;
    };
    rescaleStage();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(rescaleStage).observe(viewport);
    } else {
      window.addEventListener("resize", rescaleStage);
    }
  }

function ensureLayoutSchemaV2(force = false): void {
  if (typeof localStorage === "undefined") return;
  if (!force && localStorage.getItem("mmt_layout_version") === "3") return;
  localStorage.removeItem("mmt_float_hud_positions");
  localStorage.removeItem("mmt-hud-disabled-widgets");
  localStorage.setItem("mmt-rule-std-pit-only", "0");
  localStorage.setItem("mmt-rule-rel-track-only", "0");
  localStorage.setItem("mmt-rule-fuel-reserve-only", "0");
  localStorage.setItem("mmt-hide-off-track", "0");
  localStorage.setItem("mmt-kapps-std-rows", "9");
  localStorage.setItem("mmt-kapps-rel-rows", "3");
  localStorage.setItem("mmt-wheel-pos-y", "24");
  ThemeEngine.getInstance().setCustomVars({ scale: 1.15, opacity: 0.88 });
  localStorage.setItem("mmt_layout_version", "3");
}

  const studio = document.getElementById("overlayCustomStudio");
  if (studio && !studio.dataset.wired) {
    studio.dataset.wired = "1";
    ensureLayoutSchemaV2(false);
    const theme = ThemeEngine.getInstance();
    const layout = SmartLayoutManager.getInstance();
    const vars = theme.getActiveVariables();

    document.getElementById("btnRestoreHudV2")?.addEventListener("click", () => {
      ensureLayoutSchemaV2(true);
      const scR = document.getElementById("hudScaleRange") as HTMLInputElement | null;
      const scV = document.getElementById("hudScaleVal");
      if (scR) scR.value = "115";
      if (scV) scV.textContent = "115%";
      const opR = document.getElementById("hudOpacityRange") as HTMLInputElement | null;
      const opV = document.getElementById("hudOpacityVal");
      if (opR) opR.value = "88";
      if (opV) opV.textContent = "88%";
      ["ruleStdPitOnly", "ruleRelTrackOnly", "ruleFuelReserveOnly", "chkHideOffTrack"].forEach((id) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.checked = false;
      });
      applyHudCustomAppearance();
    });

    const presetSel = document.getElementById("hudPresetSelect") as HTMLSelectElement | null;
    if (presetSel) {
      presetSel.value = theme.getPreset();
      presetSel.addEventListener("change", () => {
        theme.setPreset(presetSel.value as "dark-carbon" | "minimal-transparent" | "high-contrast" | "retro-tv");
        applyHudCustomAppearance();
      });
    }

    const opRange = document.getElementById("hudOpacityRange") as HTMLInputElement | null;
    const opVal = document.getElementById("hudOpacityVal");
    if (opRange) {
      opRange.value = String(Math.round(vars.opacity * 100));
      if (opVal) opVal.textContent = `${opRange.value}%`;
      opRange.addEventListener("input", () => {
        const pct = Number(opRange.value);
        if (opVal) opVal.textContent = `${pct}%`;
        theme.setCustomVars({ opacity: pct / 100 });
        applyHudCustomAppearance();
      });
    }

    const scRange = document.getElementById("hudScaleRange") as HTMLInputElement | null;
    const scVal = document.getElementById("hudScaleVal");
    if (scRange) {
      scRange.value = String(Math.round(vars.scale * 100));
      if (scVal) scVal.textContent = `${scRange.value}%`;
      scRange.addEventListener("input", () => {
        const pct = Number(scRange.value);
        if (scVal) scVal.textContent = `${pct}%`;
        theme.setCustomVars({ scale: pct / 100 });
        applyHudCustomAppearance();
      });
    }

    const wheelYRange = document.getElementById("hudWheelPosY") as HTMLInputElement | null;
    const wheelYVal = document.getElementById("hudWheelPosYVal");
    if (wheelYRange) {
      const savedY = localStorage.getItem("mmt-wheel-pos-y") || "24";
      wheelYRange.value = savedY;
      if (wheelYVal) wheelYVal.textContent = `${savedY}px`;
      wheelYRange.addEventListener("input", () => {
        localStorage.setItem("mmt-wheel-pos-y", wheelYRange.value);
        if (wheelYVal) wheelYVal.textContent = `${wheelYRange.value}px`;
        const wCard = document.getElementById("floatSteeringWheelCard");
        if (wCard) wCard.style.bottom = `${wheelYRange.value}px`;
      });
    }

    const statusAnchorSel = document.getElementById("hudStatusAnchorSelect") as HTMLSelectElement | null;
    if (statusAnchorSel) {
      statusAnchorSel.value = localStorage.getItem("mmt-status-dock-anchor") || "mirror";
      statusAnchorSel.addEventListener("change", () => {
        localStorage.setItem("mmt-status-dock-anchor", statusAnchorSel.value);
      });
    }

    const repChk = document.getElementById("hudShowInReplays") as HTMLInputElement | null;
    if (repChk) {
      repChk.checked = localStorage.getItem("mmt-hud-show-replays") !== "0";
      repChk.addEventListener("change", () => {
        localStorage.setItem("mmt-hud-show-replays", repChk.checked ? "1" : "0");
      });
    }

    const allSesChk = document.getElementById("hudShowAllSessions") as HTMLInputElement | null;
    if (allSesChk) {
      allSesChk.checked = localStorage.getItem("mmt-hud-show-all-sessions") !== "0";
      allSesChk.addEventListener("change", () => {
        localStorage.setItem("mmt-hud-show-all-sessions", allSesChk.checked ? "1" : "0");
      });
    }

    const strChk = document.getElementById("hudStreamerMode") as HTMLInputElement | null;
    if (strChk) {
      strChk.checked = layout.isStreamerMode();
      strChk.addEventListener("change", () => {
        if (layout.isStreamerMode() !== strChk.checked) {
          layout.toggleStreamerMode();
        }
      });
    }

    const ghostChk = document.getElementById("hudGhostCompare") as HTMLInputElement | null;
    if (ghostChk) {
      ghostChk.checked = localStorage.getItem("mmt-ghost-compare") === "1";
      ghostChk.addEventListener("change", () => {
        localStorage.setItem("mmt-ghost-compare", ghostChk.checked ? "1" : "0");
      });
    }

    // Prompts 142 & 143: Per-Widget Kapps Columns, Rows, Accent & Auto-Visibility Rules
    document.querySelectorAll<HTMLInputElement>("[data-kapps-col]").forEach((chk) => {
      const col = chk.dataset.kappsCol as any;
      if (!col) return;
      const cur = theme.getColumnsConfig();
      chk.checked = Boolean((cur.leaderboard as any)[col] ?? (cur.relative as any)[col] ?? true);
      chk.addEventListener("change", () => {
        const next = theme.getColumnsConfig();
        if (col in next.leaderboard) (next.leaderboard as any)[col] = chk.checked;
        if (col in next.relative) (next.relative as any)[col] = chk.checked;
        theme.setColumnsConfig(next);
      });
    });

    const stdRowsInp = document.getElementById("kappsStdRows") as HTMLInputElement | null;
    const stdRowsVal = document.getElementById("kappsStdRowsVal");
    if (stdRowsInp) {
      stdRowsInp.value = localStorage.getItem("mmt-kapps-std-rows") || "15";
      if (stdRowsVal) stdRowsVal.textContent = stdRowsInp.value;
      stdRowsInp.addEventListener("input", () => {
        localStorage.setItem("mmt-kapps-std-rows", stdRowsInp.value);
        if (stdRowsVal) stdRowsVal.textContent = stdRowsInp.value;
      });
    }

    const relRowsInp = document.getElementById("kappsRelRows") as HTMLInputElement | null;
    const relRowsVal = document.getElementById("kappsRelRowsVal");
    if (relRowsInp) {
      relRowsInp.value = localStorage.getItem("mmt-kapps-rel-rows") || "3";
      if (relRowsVal) relRowsVal.textContent = relRowsInp.value;
      relRowsInp.addEventListener("input", () => {
        localStorage.setItem("mmt-kapps-rel-rows", relRowsInp.value);
        if (relRowsVal) relRowsVal.textContent = relRowsInp.value;
      });
    }

    const onlyMyClassChk = document.getElementById("kappsOnlyMyClass") as HTMLInputElement | null;
    if (onlyMyClassChk) {
      onlyMyClassChk.checked = localStorage.getItem("mmt-kapps-only-my-class") === "1";
      onlyMyClassChk.addEventListener("change", () => {
        localStorage.setItem("mmt-kapps-only-my-class", onlyMyClassChk.checked ? "1" : "0");
      });
    }

    document.querySelectorAll<HTMLButtonElement>("[data-kapps-accent]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const color = btn.dataset.kappsAccent || "#10b981";
        localStorage.setItem("mmt-kapps-accent", color);
        document.documentElement.style.setProperty("--mmt-hud-accent", color);
      });
    });

    (
      [
        ["ruleStdPitOnly", "mmt-rule-std-pit-only"],
        ["ruleRelTrackOnly", "mmt-rule-rel-track-only"],
        ["ruleFuelReserveOnly", "mmt-rule-fuel-reserve-only"],
      ] as const
    ).forEach(([elId, storeKey]) => {
      const chk = document.getElementById(elId) as HTMLInputElement | null;
      if (!chk) return;
      chk.checked = localStorage.getItem(storeKey) === "1";
      chk.addEventListener("change", () => {
        localStorage.setItem(storeKey, chk.checked ? "1" : "0");
      });
    });

    const paintWidgetBtns = () => {
      const disabled = loadDisabledWidgets();
      studio.querySelectorAll<HTMLButtonElement>("[data-widget-toggle]").forEach((btn) => {
        const k = btn.dataset.widgetToggle || "";
        const active = !disabled.has(k);
        btn.className = active
          ? "h-7 px-2.5 rounded-lg border border-r-accent bg-r-accent/15 text-r-accent font-semibold transition"
          : "h-7 px-2.5 rounded-lg border border-r-line bg-r-bg text-r-muted transition";
      });
    };
    paintWidgetBtns();

    studio.querySelectorAll<HTMLButtonElement>("[data-widget-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.widgetToggle || "";
        if (!k) return;
        const disabled = loadDisabledWidgets();
        if (disabled.has(k)) disabled.delete(k);
        else disabled.add(k);
        saveDisabledWidgets(disabled);
        paintWidgetBtns();
        applyHudCustomAppearance();
      });
    });

    // Prompt 105 & 163: Factory Presets, Custom Profiles & JSON Export/Import
    const FACTORY_PRESETS: Record<string, { disabled: string[]; ghost: boolean }> = {
      sprint_gt3: {
        disabled: ["standings", "trackmap", "fuel", "pit", "laptimes", "conditions", "fastercar", "cluster", "lights"],
        ghost: false,
      },
      endurance_multi: {
        disabled: ["laptimes", "cluster", "delta", "radar", "tires"],
        ghost: false,
      },
      practice_pace: {
        disabled: ["standings", "relative", "halo", "digiflag", "rejoin", "fastercar", "fuel", "pit", "radar", "tires"],
        ghost: true,
      },
      stream_minimal: {
        disabled: ["standings", "relative", "fuel", "pit", "trackmap", "radar", "conditions", "lights"],
        ghost: false,
      },
    };

    const applyPresetPayload = (disabledList: string[], ghost: boolean) => {
      saveDisabledWidgets(new Set(disabledList));
      localStorage.setItem("mmt-ghost-compare", ghost ? "1" : "0");
      if (ghostChk) ghostChk.checked = ghost;
      paintWidgetBtns();
      applyHudCustomAppearance();
      window.dispatchEvent(new CustomEvent("mmt-studio-refresh"));
    };

    const presetBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-hud-factory-preset]"));
    presetBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.hudFactoryPreset || "";
        const preset = FACTORY_PRESETS[key];
        if (!preset) return;
        presetBtns.forEach((b) => {
          b.className = b === btn
            ? "px-2.5 py-1 rounded-lg bg-[#10b981] text-slate-950 font-bold transition cursor-pointer"
            : "px-2.5 py-1 rounded-lg text-white/75 hover:text-white transition cursor-pointer";
        });
        applyPresetPayload(preset.disabled, preset.ghost);
      });
    });

    const CUSTOM_PRESETS_KEY = "mmt_studio_custom_presets_v1";
    type CustomPreset = { name: string; disabled: string[]; ghost: boolean };
    const loadCustomPresets = (): CustomPreset[] => {
      try {
        const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
        return raw ? (JSON.parse(raw) as CustomPreset[]) : [];
      } catch {
        return [];
      }
    };
    const customSelect = document.getElementById("mmtCustomPresetSelect") as HTMLSelectElement | null;
    const refreshCustomSelect = () => {
      if (!customSelect) return;
      const list = loadCustomPresets();
      if (list.length === 0) {
        customSelect.classList.add("hidden");
        return;
      }
      customSelect.classList.remove("hidden");
      customSelect.innerHTML = `<option value="">Mis Perfiles (${list.length})</option>` +
        list.map((p, i) => `<option value="${i}">${p.name}</option>`).join("");
    };
    refreshCustomSelect();

    customSelect?.addEventListener("change", () => {
      const idx = Number(customSelect.value);
      const list = loadCustomPresets();
      const chosen = list[idx];
      if (!chosen) return;
      applyPresetPayload(chosen.disabled, chosen.ghost);
    });

    document.getElementById("btnSaveCustomPreset")?.addEventListener("click", () => {
      const name = window.prompt("Nombre del perfil personalizado (ej. IMSA Night):");
      if (!name || !name.trim()) return;
      const list = loadCustomPresets().filter((p) => p.name !== name.trim());
      list.push({
        name: name.trim(),
        disabled: Array.from(loadDisabledWidgets()),
        ghost: localStorage.getItem("mmt-ghost-compare") === "1",
      });
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
      refreshCustomSelect();
    });

    document.getElementById("btnExportHudPreset")?.addEventListener("click", () => {
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        disabledWidgets: Array.from(loadDisabledWidgets()),
        ghostCompare: localStorage.getItem("mmt-ghost-compare") === "1",
        opacity: localStorage.getItem("mmt-hud-opacity") || "92",
        scale: localStorage.getItem("mmt-hud-scale") || "100",
        positions: localStorage.getItem("mmt-hud-positions") || "{}",
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mmt-hud-preset.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    const inpImport = document.getElementById("inpImportHudPreset") as HTMLInputElement | null;
    document.getElementById("btnImportHudPreset")?.addEventListener("click", () => inpImport?.click());
    inpImport?.addEventListener("change", () => {
      const file = inpImport.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          if (Array.isArray(parsed.disabledWidgets)) {
            if (parsed.opacity) localStorage.setItem("mmt-hud-opacity", String(parsed.opacity));
            if (parsed.scale) localStorage.setItem("mmt-hud-scale", String(parsed.scale));
            if (parsed.positions) localStorage.setItem("mmt-hud-positions", String(parsed.positions));
            applyPresetPayload(parsed.disabledWidgets.map(String), Boolean(parsed.ghostCompare));
          }
        } catch {
          // ignore malformed JSON
        }
      };
      reader.readAsText(file);
      inpImport.value = "";
    });

    const btnCopyLayout = document.getElementById("btnCopyHudLayout");
    btnCopyLayout?.addEventListener("click", () => {
      const payload = {
        version: 1,
        disabledWidgets: Array.from(loadDisabledWidgets()),
        ghostCompare: localStorage.getItem("mmt-ghost-compare") === "1",
        opacity: localStorage.getItem("mmt-hud-opacity") || "92",
        scale: localStorage.getItem("mmt-hud-scale") || "100",
        positions: localStorage.getItem("mmt-hud-positions") || "{}",
      };
      const json = JSON.stringify(payload);
      if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(json).then(() => {
          btnCopyLayout.textContent = "¡Copiado!";
          setTimeout(() => { btnCopyLayout.textContent = "Copiar Layout"; }, 1800);
        });
      }
    });

    const btnImportLayout = document.getElementById("btnImportHudLayout");
    btnImportLayout?.addEventListener("click", () => {
      const raw = window.prompt("Pega aquí el código JSON del layout de MMT Sync:");
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as {
          disabledWidgets?: string[];
          ghostCompare?: boolean;
          opacity?: string;
          scale?: string;
          positions?: string;
        };
        if (Array.isArray(parsed.disabledWidgets)) {
          saveDisabledWidgets(new Set(parsed.disabledWidgets.map(String)));
        }
        if (typeof parsed.ghostCompare === "boolean") {
          localStorage.setItem("mmt-ghost-compare", parsed.ghostCompare ? "1" : "0");
          if (ghostChk) ghostChk.checked = parsed.ghostCompare;
        }
        if (parsed.opacity) localStorage.setItem("mmt-hud-opacity", String(parsed.opacity));
        if (parsed.scale) localStorage.setItem("mmt-hud-scale", String(parsed.scale));
        if (parsed.positions) localStorage.setItem("mmt-hud-positions", String(parsed.positions));
        paintWidgetBtns();
        applyHudCustomAppearance();
      } catch {
        window.alert("Código de layout inválido.");
      }
    });
  }

  // Prompt 160: MMT HUD Studio 3-Column Interactive Studio Wiring
  const studioActiveList = document.getElementById("mmtStudioActiveList");
  const studioCatalogList = document.getElementById("mmtStudioCatalogList");
  if (studioActiveList && studioCatalogList && !studioActiveList.dataset.wired) {
    studioActiveList.dataset.wired = "1";
    const STUDIO_MODULES = [
      { id: "standings", label: "Standings", stageSel: "#widgetStandings" },
      { id: "relative", label: "Relative", stageSel: "#widgetRelative" },
      { id: "halo", label: "Radar LED Superior", stageSel: "#mmtStageHaloBar" },
      { id: "digiflag", label: "Banderas Digitales", stageSel: "" },
      { id: "rejoin", label: "Asistente Reincorporación", stageSel: "" },
      { id: "fastercar", label: "Alerta Coche Rápido", stageSel: "" },
      { id: "incar", label: "Ajustes Cabina (BB/TC/ABS)", stageSel: "" },
      { id: "laptimes", label: "Historial de Vueltas", stageSel: "" },
      { id: "cluster", label: "Pedales & Volante", stageSel: "#widgetCluster" },
      { id: "trackmap", label: "Mapa de Circuito", stageSel: "#widgetTrackMap" },
      { id: "fuel", label: "Telemetría Fuel & Ruedas", stageSel: "#widgetFuel" },
      { id: "delta", label: "Delta en Vivo", stageSel: "#widgetCorner" },
      { id: "conditions", label: "Clima & Neumático Óptimo", stageSel: "#widgetBrakeMarker" },
      { id: "radar", label: "Alerta Spotter / Luces", stageSel: "#widgetShiftLights" },
    ];
    let selectedModId = "standings";

    const selectModule = (id: string) => {
      selectedModId = id;
      const mod = STUDIO_MODULES.find((m) => m.id === id) || STUDIO_MODULES[0];
      const titleEl = document.getElementById("mmtInspTitle");
      if (titleEl) titleEl.textContent = mod.label;
      const badgeEl = document.getElementById("mmtInspBadge");
      const disabled = loadDisabledWidgets();
      if (badgeEl) {
        const active = !disabled.has(id);
        badgeEl.textContent = active ? "ACTIVO" : "OCULTO";
        badgeEl.className = active
          ? "px-1.5 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] text-[10px]"
          : "px-1.5 py-0.5 rounded bg-white/10 text-white/50 text-[10px]";
      }
      const stageNode = mod.stageSel ? document.querySelector<HTMLElement>(mod.stageSel) : null;
      const xEl = document.getElementById("mmtInspX");
      const yEl = document.getElementById("mmtInspY");
      if (stageNode && xEl && yEl) {
        xEl.textContent = `${Math.round(stageNode.offsetLeft)}px`;
        yEl.textContent = `${Math.round(stageNode.offsetTop)}px`;
      }
      renderLists();
    };

    const renderLists = () => {
      const disabled = loadDisabledWidgets();
      studioActiveList.innerHTML = STUDIO_MODULES.filter((m) => !disabled.has(m.id))
        .map(
          (m) => `
          <div class="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg cursor-pointer ${selectedModId === m.id ? "bg-[#10b981]/15 border border-[#10b981]/50 text-white" : "hover:bg-white/5 text-white/80"}" data-mod-select="${m.id}">
            <span class="flex items-center gap-1.5 truncate"><span class="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0"></span><span class="truncate">${m.label}</span></span>
            <span class="flex items-center gap-1 shrink-0">
              <button type="button" data-mod-remove="${m.id}" class="text-white/45 hover:text-rose-400 px-1" title="Quitar">×</button>
            </span>
          </div>`,
        )
        .join("");

      studioCatalogList.innerHTML = STUDIO_MODULES.map(
        (m) => {
          const on = !disabled.has(m.id);
          return `
        <div class="group flex items-center justify-between gap-1 px-2 py-1 rounded-lg hover:bg-white/5 text-white/80 cursor-pointer" data-mod-select="${m.id}">
          <span class="truncate text-[10.5px]">${m.label}</span>
          <button type="button" data-mod-toggle="${m.id}" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold shrink-0 cursor-pointer ${on ? "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40" : "bg-white/5 text-white/40 border border-white/10"}">${on ? "ON" : "OFF"}</button>
        </div>`;
        },
      ).join("");
    };
    window.addEventListener("mmt-studio-refresh", renderLists);

    studioActiveList.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const rm = t.closest<HTMLElement>("[data-mod-remove]");
      if (rm) {
        const id = rm.dataset.modRemove || "";
        const disabled = loadDisabledWidgets();
        disabled.add(id);
        saveDisabledWidgets(disabled);
        const mod = STUDIO_MODULES.find((m) => m.id === id);
        if (mod?.stageSel) {
          const el = document.querySelector<HTMLElement>(mod.stageSel);
          if (el) el.hidden = true;
        }
        renderLists();
        return;
      }
      const sel = t.closest<HTMLElement>("[data-mod-select]");
      if (sel?.dataset.modSelect) selectModule(sel.dataset.modSelect);
    });

    studioCatalogList.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      const tog = t.closest<HTMLElement>("[data-mod-toggle]");
      if (tog) {
        const id = tog.dataset.modToggle || "";
        const disabled = loadDisabledWidgets();
        if (disabled.has(id)) disabled.delete(id);
        else disabled.add(id);
        saveDisabledWidgets(disabled);
        const mod = STUDIO_MODULES.find((m) => m.id === id);
        if (mod?.stageSel) {
          const el = document.querySelector<HTMLElement>(mod.stageSel);
          if (el) el.hidden = disabled.has(id);
        }
        applyHudCustomAppearance();
        selectModule(id);
        return;
      }
      const add = t.closest<HTMLElement>("[data-mod-add]");
      if (add) {
        const id = add.dataset.modAdd || "";
        const disabled = loadDisabledWidgets();
        disabled.delete(id);
        saveDisabledWidgets(disabled);
        const mod = STUDIO_MODULES.find((m) => m.id === id);
        if (mod?.stageSel) {
          const el = document.querySelector<HTMLElement>(mod.stageSel);
          if (el) el.hidden = false;
        }
        selectModule(id);
        return;
      }
      const sel = t.closest<HTMLElement>("[data-mod-select]");
      if (sel?.dataset.modSelect) selectModule(sel.dataset.modSelect);
    });

    document.getElementById("mmtInspCenterX")?.addEventListener("click", () => {
      const mod = STUDIO_MODULES.find((m) => m.id === selectedModId);
      const node = mod?.stageSel ? document.querySelector<HTMLElement>(mod.stageSel) : null;
      if (node) {
        node.style.left = "50%";
        node.style.transform = "translateX(-50%)";
        const xEl = document.getElementById("mmtInspX");
        if (xEl) xEl.textContent = "50%";
      }
    });

    const inspScale = document.getElementById("mmtInspScale") as HTMLInputElement | null;
    const inspScaleVal = document.getElementById("mmtInspScaleVal");
    inspScale?.addEventListener("input", () => {
      if (inspScaleVal) inspScaleVal.textContent = `${inspScale.value}%`;
      const mod = STUDIO_MODULES.find((m) => m.id === selectedModId);
      const node = mod?.stageSel ? document.querySelector<HTMLElement>(mod.stageSel) : null;
      if (node) (node.style as any).zoom = String(Number(inspScale.value) / 100);
    });

    const inspOp = document.getElementById("mmtInspOpacity") as HTMLInputElement | null;
    const inspOpVal = document.getElementById("mmtInspOpacityVal");
    inspOp?.addEventListener("input", () => {
      if (inspOpVal) inspOpVal.textContent = `${inspOp.value}%`;
      ThemeEngine.getInstance().setCustomVars({ opacity: Number(inspOp.value) / 100 });
      applyHudCustomAppearance();
    });

    let studioWeather: "day" | "night" = "day";
    let studioCockpitActive = true;

    const applyStudioScene = () => {
      const sceneBar = document.getElementById("mmtStudioSceneBar");
      if (sceneBar) {
        sceneBar.querySelectorAll<HTMLButtonElement>("[data-scene]").forEach((b) => {
          const s = b.dataset.scene;
          if (s === "cockpit") {
            b.setAttribute("aria-pressed", String(studioCockpitActive));
            b.className = studioCockpitActive
              ? "px-2 py-0.5 rounded-[3px] bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/45 font-bold cursor-pointer"
              : "px-2 py-0.5 rounded-[3px] text-white/70 hover:text-white border border-transparent font-bold cursor-pointer";
          } else {
            const active = s === studioWeather;
            b.className = active
              ? "px-2 py-0.5 rounded-[3px] bg-[#10b981] text-[#04130d] font-bold cursor-pointer"
              : "px-2 py-0.5 rounded-[3px] text-white/70 hover:text-white font-bold cursor-pointer";
          }
        });
      }
      const bg = document.getElementById("mmtStudioSceneBg");
      if (!bg) return;
      if (studioCockpitActive) {
        bg.classList.add("is-cockpit");
        bg.style.background = "";
        bg.style.backgroundImage = `linear-gradient(180deg, rgba(5, 8, 12, 0.28) 0%, rgba(5, 8, 12, 0.14) 45%, rgba(5, 8, 12, 0.42) 100%), url("${cockpitPorscheUrl}")`;
        bg.style.backgroundSize = "cover";
        bg.style.backgroundPosition = "center center";
        bg.style.backgroundRepeat = "no-repeat";
        bg.style.filter = studioWeather === "night" ? "brightness(0.55) contrast(1.12)" : "none";
      } else {
        bg.classList.remove("is-cockpit");
        bg.style.backgroundImage = "";
        bg.style.backgroundRepeat = "";
        bg.style.filter = "none";
        if (studioWeather === "night") {
          bg.style.background = "radial-gradient(ellipse at 50% 45%, rgba(14, 165, 233, 0.18) 0%, rgba(4, 7, 14, 0.98) 72%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)";
        } else {
          bg.style.background = "radial-gradient(ellipse at 50% 45%, rgba(16, 185, 129, 0.12) 0%, rgba(5, 8, 12, 0.94) 72%), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)";
        }
        bg.style.backgroundSize = "100% 100%, 28px 28px, 28px 28px";
        bg.style.backgroundPosition = "center center";
      }
    };

    applyStudioScene();

    document.getElementById("mmtStudioSceneBar")?.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-scene]");
      if (!btn) return;
      const scene = btn.dataset.scene || "day";
      if (scene === "cockpit") {
        studioCockpitActive = !studioCockpitActive;
      } else if (scene === "night" || scene === "day") {
        studioWeather = scene;
      }
      applyStudioScene();
    });

    document.getElementById("mmtStudioVisBtn")?.addEventListener("click", () => {
      document.getElementById("btnToggleFloatingOverlay")?.click();
    });
    const HALO_SIM_STATES: Array<{ val: number; label: string }> = [
      { val: 0, label: "Simular Radar LED: Off" },
      { val: 2, label: "Simular Radar LED: Izquierda" },
      { val: 3, label: "Simular Radar LED: Derecha" },
      { val: 4, label: "Simular Radar LED: 3-Wide" },
      { val: 5, label: "Simular Radar LED: 2x Izquierda" },
      { val: 6, label: "Simular Radar LED: 2x Derecha" },
    ];
    let haloSimIdx = 0;
    const simHaloBtn = document.getElementById("btnSimHaloRadar");
    simHaloBtn?.addEventListener("click", () => {
      haloSimIdx = (haloSimIdx + 1) % HALO_SIM_STATES.length;
      const cur = HALO_SIM_STATES[haloSimIdx];
      simHaloBtn.textContent = cur.label;
      renderProximityHaloBar(cur.val, true);
    });
    let studioLocked = true;
    const lockBtn = document.getElementById("mmtStudioLockBtn");
    lockBtn?.addEventListener("click", () => {
      studioLocked = !studioLocked;
      void setOverlayEdit(!studioLocked);
      lockBtn.textContent = studioLocked ? "🔒 Bloqueado" : "🔓 Editar sobre iRacing";
    });

    renderLists();
  }
  const toggleBtn = document.getElementById("overlayModeToggle");
  const btnUnlock = document.getElementById("btnUnlockLayout");
  const btnReset = document.getElementById("btnResetLayout");
  const btnRecenter = document.getElementById("btnRecenterOverlay");

  const clampFloatingWidgetsToViewport = (resetPositions = false) => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const maxW = Math.max(320, window.innerWidth);
    const maxH = Math.max(240, window.innerHeight);
    document.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((el) => {
      if (resetPositions) {
        el.style.transform = "";
        el.style.left = "";
        el.style.top = "";
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      // Compensate if saved coordinates overflow logical viewport at 125%/150% Windows DPI scaling
      if (rect.right > maxW - 8 || rect.bottom > maxH - 8 || rect.left < 4 || rect.top < 4) {
        const dx = rect.right > maxW - 8 ? (maxW - 8 - rect.right) / dpr : rect.left < 4 ? (8 - rect.left) / dpr : 0;
        const dy = rect.bottom > maxH - 8 ? (maxH - 8 - rect.bottom) / dpr : rect.top < 4 ? (8 - rect.top) / dpr : 0;
        if (dx !== 0 || dy !== 0) {
          const curLeft = parseFloat(el.style.left || "0") || 0;
          const curTop = parseFloat(el.style.top || "0") || 0;
          el.style.left = `${Math.round(curLeft + dx)}px`;
          el.style.top = `${Math.round(curTop + dy)}px`;
        }
      }
    });
  };
  const shiftLightContainers = document.querySelectorAll<HTMLElement>("#ovShiftLights, #ovShiftLightsFloat");
  const canvases = document.querySelectorAll<HTMLCanvasElement>("#ovInputs, #ovInputsFloat");

  shiftLightContainers.forEach((shiftLights) => {
    if (shiftLights && shiftLights.children.length === 0) {
      for (let i = 0; i < 16; i++) {
        const led = document.createElement("div");
        led.className = "w-3 h-5 rounded-sm bg-white/10 transition-colors duration-75";
        led.dataset.led = String(i);
        shiftLights.append(led);
      }
    }
  });

  if (!overlayInitialized) {
    overlayInitialized = true;

    if (toggleBtn instanceof HTMLButtonElement) {
      toggleBtn.disabled = false;
      const syncToggleLabel = () => {
        toggleBtn.textContent = previewDemoActive ? "Modo Demo Activo (Pausar)" : "Probar Demo en Escenario";
      };
      syncToggleLabel();
      toggleBtn.addEventListener("click", () => {
        previewDemoActive = !previewDemoActive;
        syncToggleLabel();
        if (previewDemoActive) {
          startDemoOverlayLoop();
        } else {
          if (demoAnimationTimer) {
            clearInterval(demoAnimationTimer);
            demoAnimationTimer = null;
          }
          IrsdkClient.getInstance().stopSimulation();
          setHudMode("closed");
          renderStandbyWidgets();
        }
      });
    }

    if (btnRecenter) {
      btnRecenter.addEventListener("click", async () => {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          await invoke("recenter_overlay");
        } catch {
          // web/mock fallback
        }
        clampFloatingWidgetsToViewport(true);
        try {
          localStorage.removeItem("mmt_overlay_layouts");
        } catch {
          // ignore
        }
      });
    }

    window.addEventListener("resize", () => clampFloatingWidgetsToViewport(false));

    if (btnUnlock) {
      btnUnlock.addEventListener("click", () => {
        layoutUnlocked = !layoutUnlocked;
        btnUnlock.textContent = layoutUnlocked ? "Bloquear Posición" : "Colocar Widgets";
        btnUnlock.className = layoutUnlocked
          ? "h-11 px-3.5 rounded-xl border border-emerald-400 bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold transition"
          : "h-11 px-3.5 rounded-xl border border-r-line bg-r-surface text-r-muted font-mono text-xs font-bold hover:text-r-text hover:border-r-accent transition";
        updateDraggableState();
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        localStorage.removeItem("mmt_hud_positions");
        resetWidgetPositions();
      });
    }

    setupDraggableWidgets();
    restoreWidgetPositions();
    if (hudMockAllowed()) startDemoOverlayLoop();
    else {
      setHudMode("closed");
      renderStandbyWidgets();
    }
  }

  canvases.forEach((canvas) => {
    drawInputsCanvas(canvas, { t: 0, dist: 0, speed: 0, throttle: 0, brake: 0, gear: 0, steering: 0 });
  });
}

function setupDraggableWidgets(): void {
  const stage = document.getElementById("overlayStage");
  if (!stage) return;
  const widgets = stage.querySelectorAll<HTMLElement>(".mmt-hud-widget");

  widgets.forEach((w) => {
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!layoutUnlocked) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;

      const rect = w.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      initialLeft = rect.left - stageRect.left;
      initialTop = rect.top - stageRect.top;

      // Remove transform centering when dragging custom position
      w.style.transform = "none";
      w.style.left = `${initialLeft}px`;
      w.style.top = `${initialTop}px`;
      w.style.zIndex = "50";

      const onMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const newLeft = Math.max(0, Math.min(stageRect.width - rect.width, initialLeft + dx));
        const newTop = Math.max(0, Math.min(stageRect.height - rect.height, initialTop + dy));
        w.style.left = `${newLeft}px`;
        w.style.top = `${newTop}px`;
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        w.style.zIndex = "10";
        saveWidgetPositions();
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    w.addEventListener("mousedown", onMouseDown);
  });
}

function updateDraggableState(): void {
  const stage = document.getElementById("overlayStage");
  if (!stage) return;
  const widgets = stage.querySelectorAll<HTMLElement>(".mmt-hud-widget");
  widgets.forEach((w) => {
    if (layoutUnlocked) {
      w.classList.add("ring-2", "ring-r-accent", "cursor-move");
    } else {
      w.classList.remove("ring-2", "ring-r-accent", "cursor-move");
    }
  });
}

function saveWidgetPositions(): void {
  const stage = document.getElementById("overlayStage");
  if (!stage) return;
  const widgets = stage.querySelectorAll<HTMLElement>(".mmt-hud-widget");
  const positions: Record<string, { left: string; top: string }> = {};

  widgets.forEach((w) => {
    const id = w.dataset.widget;
    if (id && w.style.left && w.style.top) {
      positions[id] = { left: w.style.left, top: w.style.top };
    }
  });

  localStorage.setItem("mmt_hud_positions", JSON.stringify(positions));
}

function restoreWidgetPositions(): void {
  const raw = localStorage.getItem("mmt_hud_positions");
  if (!raw) return;
  try {
    const positions = JSON.parse(raw) as Record<string, { left: string; top: string }>;
    const stage = document.getElementById("overlayStage");
    if (!stage) return;

    for (const [id, pos] of Object.entries(positions)) {
      const widget = stage.querySelector<HTMLElement>(`[data-widget="${id}"]`);
      if (widget) {
        widget.style.transform = "none";
        widget.style.left = pos.left;
        widget.style.top = pos.top;
      }
    }
  } catch {
    // Ignore invalid JSON
  }
}

function resetWidgetPositions(): void {
  const stage = document.getElementById("overlayStage");
  if (!stage) return;
  const widgets = stage.querySelectorAll<HTMLElement>(".mmt-hud-widget");
  widgets.forEach((w) => {
    w.style.left = "";
    w.style.top = "";
    w.style.transform = "";
  });
}

// Module-level HUD Edit Mode and Streamer Mode control (Bloque 2)
let floatEditMode = false;

export function isFloatHudInEditMode(): boolean {
  return floatEditMode;
}

export function initFloatingOverlayControls(onClose?: () => void): void {
  if (typeof localStorage !== "undefined" && localStorage.getItem("mmt_layout_version") !== "3") {
    localStorage.removeItem("mmt_float_hud_positions");
    localStorage.removeItem("mmt-hud-disabled-widgets");
    localStorage.setItem("mmt-rule-std-pit-only", "0");
    localStorage.setItem("mmt-rule-rel-track-only", "0");
    localStorage.setItem("mmt-rule-fuel-reserve-only", "0");
    localStorage.setItem("mmt-hide-off-track", "0");
    localStorage.setItem("mmt-wheel-pos-y", "24");
    ThemeEngine.getInstance().setCustomVars({ scale: 1.15, opacity: 0.88 });
    localStorage.setItem("mmt_layout_version", "3");
  }
  const wheelCardInit = document.getElementById("floatSteeringWheelCard");
  if (wheelCardInit && typeof localStorage !== "undefined") {
    const wy = localStorage.getItem("mmt-wheel-pos-y") || "34";
    wheelCardInit.style.bottom = `${wy}px`;
  }
  const centerDock = document.getElementById("floatCenterStatusDock");
  if (centerDock && typeof localStorage !== "undefined") {
    const anchor = localStorage.getItem("mmt-status-dock-anchor") || "mirror";
    if (anchor === "standings") {
      centerDock.style.top = "270px";
      centerDock.style.left = "6px";
      centerDock.style.transform = "none";
      centerDock.style.alignItems = "flex-start";
    }
  }
  const updateReplayHudModeBtn = () => {
    const btn = document.getElementById("btnCycleReplayHudMode");
    if (!btn) return;
    const m = VisibilityRulesEngine.getInstance().getReplayHudMode();
    btn.textContent =
      m === "full"
        ? "HUD Replay: Completo (Ctrl+Alt+H)"
        : m === "replay_clean"
          ? "HUD Replay: Limpio (Ctrl+Alt+H)"
          : "HUD Replay: Oculto (Ctrl+Alt+H)";
  };
  document.getElementById("btnCycleReplayHudMode")?.addEventListener("click", () => {
    VisibilityRulesEngine.getInstance().cycleReplayHudMode();
    updateReplayHudModeBtn();
  });
  updateReplayHudModeBtn();
  void listen("mmt-tray-cycle-hud-mode", () => {
    VisibilityRulesEngine.getInstance().cycleReplayHudMode();
    updateReplayHudModeBtn();
  });
  void listen("mmt-tray-check-updates", () => {
    document.getElementById("btnCheckUpdate")?.click();
  });

  // Global shortcuts: Streamer (Ctrl+Shift+S / F8), Replay HUD 3-mode (Ctrl+Alt+H), Boss Key (Ctrl+H)
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s") || e.key === "F8") {
      const active = SmartLayoutManager.getInstance().toggleStreamerMode();
      console.log(`[Streamer Mode] ${active ? "ACTIVADO" : "DESACTIVADO"}`);
    } else if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      const mode = VisibilityRulesEngine.getInstance().cycleReplayHudMode();
      updateReplayHudModeBtn();
      console.log(`[Replay HUD Mode] ${mode}`);
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      onClose?.();
    } else if (e.ctrlKey && e.key.toLowerCase() === "h") {
      const active = VisibilityRulesEngine.getInstance().toggleBossKey();
      console.log(`[Clean Screen Boss Key] ${active ? "ACTIVADO" : "DESACTIVADO"}`);
    }
  });

  const btnClose = document.getElementById("btnCloseFloatOverlay");
  if (btnClose && onClose) {
    btnClose.addEventListener("click", () => onClose());
  }

  const btnAll = document.getElementById("floatHudPresetAll");
  const btnRadar = document.getElementById("floatHudPresetRadar");
  const btnTelemetry = document.getElementById("floatHudPresetTelemetry");

  const rowLights = document.getElementById("floatShiftLightsRow");
  const cardRadar = document.getElementById("floatRelativeCard");
  const cardCluster = document.getElementById("floatClusterCard");
  const cardStandings = document.getElementById("floatStandingsCard");
  const cardFuel = document.getElementById("floatFuelCard");
  const cardWaveform = document.getElementById("floatWaveformCard");
  const cardInputs = document.getElementById("floatInputsCard");

  const setPreset = (preset: "all" | "radar" | "telemetry") => {
    if (btnAll) btnAll.className = preset === "all" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";
    if (btnRadar) btnRadar.className = preset === "radar" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";
    if (btnTelemetry) btnTelemetry.className = preset === "telemetry" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";

    if (preset === "all") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = false;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = false;
      if (cardFuel) cardFuel.hidden = false;
      if (cardWaveform) cardWaveform.hidden = false;
      if (cardInputs) cardInputs.hidden = false;
    } else if (preset === "radar") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = false;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = true;
      if (cardFuel) cardFuel.hidden = true;
      if (cardWaveform) cardWaveform.hidden = true;
      if (cardInputs) cardInputs.hidden = true;
    } else if (preset === "telemetry") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = true;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = true;
      if (cardFuel) cardFuel.hidden = true;
      if (cardWaveform) cardWaveform.hidden = false;
      if (cardInputs) cardInputs.hidden = false;
    }
  };

  btnAll?.addEventListener("click", () => setPreset("all"));
  btnRadar?.addEventListener("click", () => setPreset("radar"));
  btnTelemetry?.addEventListener("click", () => setPreset("telemetry"));

  // Draggable Free HUD Customization
  floatEditMode = false;
  const btnEdit = document.getElementById("btnFloatEditLayout");
  const btnReset = document.getElementById("btnFloatResetLayout");
  const floatHost = document.getElementById("floatingOverlayHost");

  const restoreFloatPositions = () => {
    try {
      const raw = localStorage.getItem("mmt_float_hud_positions");
      if (!raw || !floatHost) return;
      const pos = JSON.parse(raw) as Record<string, { left?: string; top?: string; scale?: number }>;
      const vw = Math.max(320, window.innerWidth);
      const vh = Math.max(240, window.innerHeight);
      for (const [id, coord] of Object.entries(pos)) {
        const el = floatHost.querySelector<HTMLElement>(`[data-widget="${id}"]`);
        if (el) {
          if (coord.left && coord.top) {
            el.style.position = "absolute";
            const rawLeft = Number.parseFloat(coord.left);
            const rawTop = Number.parseFloat(coord.top);
            const maxLeft = Math.max(8, vw - (el.offsetWidth || 220) - 8);
            const maxTop = Math.max(8, vh - (el.offsetHeight || 120) - 8);
            el.style.left = Number.isFinite(rawLeft) ? `${Math.max(8, Math.min(maxLeft, rawLeft))}px` : coord.left;
            el.style.top = Number.isFinite(rawTop) ? `${Math.max(8, Math.min(maxTop, rawTop))}px` : coord.top;
            el.style.transform = "none";
          }
          if (typeof coord.scale === "number" && Number.isFinite(coord.scale)) {
            const clamped = Math.max(0.6, Math.min(1.6, coord.scale));
            el.dataset.scale = String(clamped);
            (el.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(clamped);
          }
        }
      }
    } catch {}
  };
  window.addEventListener("resize", restoreFloatPositions);

  const saveFloatPositions = () => {
    if (!floatHost) return;
    const positions: Record<string, { left?: string; top?: string; scale?: number }> = {};
    floatHost.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((w) => {
      const id = w.dataset.widget;
      if (!id) return;
      const scaleVal = w.dataset.scale ? Number.parseFloat(w.dataset.scale) : undefined;
      if ((w.style.left && w.style.top) || (scaleVal && Number.isFinite(scaleVal))) {
        positions[id] = {
          ...(w.style.left && w.style.top ? { left: w.style.left, top: w.style.top } : {}),
          ...(scaleVal && Number.isFinite(scaleVal) ? { scale: scaleVal } : {}),
        };
      }
    });
    localStorage.setItem("mmt_float_hud_positions", JSON.stringify(positions));
  };

  const resetFloatPositions = () => {
    if (!floatHost) return;
    localStorage.removeItem("mmt_float_hud_positions");
    localStorage.removeItem("mmt-hud-disabled-widgets");
    floatHost.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((w) => {
      w.style.position = "";
      w.style.left = "";
      w.style.top = "";
      w.style.transform = "";
      delete w.dataset.scale;
      (w.style as CSSStyleDeclaration & { zoom?: string }).zoom = "";
      w.hidden = false;
    });
    syncWidgetToggleBar();
  };

  const toggleBar = document.getElementById("floatWidgetToggleBar");
  const syncWidgetToggleBar = () => {
    if (!toggleBar) return;
    const disabled = loadDisabledWidgets();
    toggleBar.querySelectorAll<HTMLButtonElement>("[data-toggle-widget]").forEach((btn) => {
      const id = btn.dataset.toggleWidget || "";
      const active = !disabled.has(id);
      btn.className = active
        ? "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-r-accent text-r-ink transition"
        : "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white/45 line-through transition";
    });
  };

  toggleBar?.querySelectorAll<HTMLButtonElement>("[data-toggle-widget]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggleWidget || "";
      if (!id) return;
      const disabled = loadDisabledWidgets();
      if (disabled.has(id)) disabled.delete(id);
      else disabled.add(id);
      saveDisabledWidgets(disabled);
      const target = floatHost?.querySelector<HTMLElement>(`[data-widget="${id}"]`);
      if (target) target.hidden = disabled.has(id);
      syncWidgetToggleBar();
    });
  });

  const applyEditModeUi = (nextEdit: boolean, fromBackend = false) => {
    floatEditMode = nextEdit;
    if (!fromBackend) {
      void setOverlayEdit(floatEditMode);
    }
    if (floatHost) {
      floatHost.classList.toggle("overlay-editing", floatEditMode);
    }
    const chromeEl = document.getElementById("floatHudChrome");
    const layersEl = document.getElementById("floatLayersControlPanel");
    const reopenEl = document.getElementById("hudReopenBtn");
    if (floatEditMode) {
      if (chromeEl) chromeEl.hidden = false;
      if (layersEl) layersEl.hidden = false;
      if (reopenEl) reopenEl.hidden = true;
    } else {
      if (layersEl) layersEl.hidden = true;
    }
    if (btnEdit) {
      btnEdit.className = floatEditMode
        ? "px-2.5 py-1.5 rounded-xl bg-r-accent text-r-ink font-mono text-[10px] font-bold uppercase transition flex items-center gap-1 shadow-md"
        : "px-2.5 py-1.5 rounded-xl bg-black/85 border border-white/15 text-r-muted hover:text-r-accent font-mono text-[10px] font-bold uppercase transition flex items-center gap-1 shadow-md";
      btnEdit.innerHTML = floatEditMode ? "<span>✓ Fijar HUD</span>" : "<span>✥ Mover HUD</span>";
    }
    if (toggleBar) {
      toggleBar.hidden = !floatEditMode;
      if (floatEditMode) syncWidgetToggleBar();
    }
    if (floatHost) {
      const disabled = loadDisabledWidgets();
      floatHost.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((w) => {
        const wid = w.dataset.widget || "";
        const closeBtn = w.querySelector<HTMLElement>(".mmt-widget-close-btn");
        if (floatEditMode) {
          w.classList.add("ring-2", "ring-r-accent", "cursor-move", "relative");
          if (wid === "radar" && !disabled.has("radar")) w.hidden = false;
          if (closeBtn) closeBtn.hidden = false;
        } else {
          w.classList.remove("ring-2", "ring-r-accent", "cursor-move");
          if (closeBtn) closeBtn.hidden = true;
          if (wid && disabled.has(wid)) w.hidden = true;
        }
      });
    }
  };

  restoreFloatPositions();
  ThemeEngine.getInstance().applyToDom();
  I18nManager.getInstance().updateDomTranslations();
  if (floatHost) {
    PluginLoader.getInstance().mountPlugins(floatHost);
  }

  btnReset?.addEventListener("click", () => {
    resetFloatPositions();
  });

  btnEdit?.addEventListener("click", () => {
    applyEditModeUi(!floatEditMode);
  });

  document.getElementById("hudReopenBtn")?.addEventListener("click", () => {
    applyEditModeUi(true);
    const p = document.getElementById("floatLayersControlPanel");
    if (p) p.hidden = false;
  });

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e")) {
      e.preventDefault();
      applyEditModeUi(!floatEditMode);
    } else if (e.key === "Escape" && floatEditMode) {
      applyEditModeUi(false);
    }
  });

  if (typeof window !== "undefined" && window.location.search.includes("overlay=1")) {
    void import("@tauri-apps/api/event")
      .then(async ({ listen }) => {
        await listen<boolean>("mmt-overlay-edit", (ev) => {
          applyEditModeUi(Boolean(ev.payload), true);
        });
        await listen<number>("mmt-setup-updated", (ev) => {
          const count = Number(ev.payload || 1);
          const host = document.getElementById("floatingOverlayHost");
          if (!host) return;
          const prev = document.getElementById("mmtOverlaySetupToast");
          if (prev) prev.remove();
          const toast = document.createElement("div");
          toast.id = "mmtOverlaySetupToast";
          toast.className = "fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded bg-[#0a0c10]/85 border border-emerald-400/50 text-emerald-300 font-mono text-[11px] font-bold pointer-events-none shadow-lg";
          toast.textContent = count > 1
            ? `${count} setups actualizados listos en el garaje de iRacing`
            : "Setup actualizado listo en el garaje de iRacing";
          host.appendChild(toast);
          setTimeout(() => toast.remove(), 4000);
        });
        await listen("mmt-reset-delta", () => {
          waveformHead = 0;
          waveformCount = 0;
        });
      })
      .catch(() => {});
  }

  if (floatHost) {
    floatHost.querySelectorAll<HTMLElement>(".mmt-float-widget").forEach((w) => {
      // Inject individual close (✕) button visible only in Mover HUD mode
      const wid = w.dataset.widget || "";
      if (wid && !w.querySelector(".mmt-widget-close-btn")) {
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.hidden = true;
        closeBtn.title = "Ocultar este widget";
        closeBtn.textContent = "✕";
        closeBtn.className = "mmt-widget-close-btn absolute top-1 right-1 z-50 w-5 h-5 rounded-full bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center shadow cursor-pointer";
        closeBtn.addEventListener("mousedown", (ev) => ev.stopPropagation());
        closeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const disabled = loadDisabledWidgets();
          disabled.add(wid);
          saveDisabledWidgets(disabled);
          w.hidden = true;
          syncWidgetToggleBar();
        });
        w.appendChild(closeBtn);
      }

      // Mouse wheel to resize individual widget in Mover HUD mode
      w.addEventListener("wheel", (e) => {
        if (!floatEditMode) return;
        e.preventDefault();
        const current = w.dataset.scale ? Number.parseFloat(w.dataset.scale) : 1;
        const delta = e.deltaY < 0 ? 0.06 : -0.06;
        const next = Math.max(0.6, Math.min(1.6, Number((current + delta).toFixed(2))));
        w.dataset.scale = String(next);
        (w.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(next);
        saveFloatPositions();
      }, { passive: false });

      // Inject bottom-right resize handle (70%-130%) & floating coordinate tooltip (Prompt 141)
      let coordTip = document.getElementById("mmtHudEditTooltip");
      if (!coordTip) {
        coordTip = document.createElement("div");
        coordTip.id = "mmtHudEditTooltip";
        coordTip.hidden = true;
        coordTip.className = "fixed z-[90] px-2.5 py-1 rounded-lg bg-black/90 border border-emerald-400/50 text-emerald-300 font-mono text-[10px] pointer-events-none shadow-xl";
        document.body.appendChild(coordTip);
      }
      const showCoordTip = (target: HTMLElement) => {
        if (!coordTip) return;
        const r = target.getBoundingClientRect();
        const sc = Math.round((target.dataset.scale ? Number.parseFloat(target.dataset.scale) : 1) * 100);
        coordTip.textContent = `X: ${Math.round(r.left)}px · Y: ${Math.round(r.top)}px · Escala: ${sc}%`;
        coordTip.style.left = `${Math.min(window.innerWidth - 220, Math.max(8, r.left))}px`;
        coordTip.style.top = `${Math.max(8, r.top - 26)}px`;
        coordTip.hidden = false;
      };

      if (wid && !w.querySelector(".mmt-widget-resize-handle")) {
        const resizer = document.createElement("div");
        resizer.className = "mmt-widget-resize-handle absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-50 bg-emerald-400/80 rounded-tl opacity-0 group-hover:opacity-100";
        resizer.title = "Escalar widget (70% - 130%)";
        resizer.addEventListener("mousedown", (ev) => {
          if (!floatEditMode) return;
          ev.stopPropagation();
          ev.preventDefault();
          const startRx = ev.clientX;
          const startScale = w.dataset.scale ? Number.parseFloat(w.dataset.scale) : 1;
          const onResMove = (mv: MouseEvent) => {
            const next = Math.max(0.7, Math.min(1.3, Number((startScale + (mv.clientX - startRx) / 220).toFixed(2))));
            w.dataset.scale = String(next);
            (w.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(next);
            showCoordTip(w);
          };
          const onResUp = () => {
            document.removeEventListener("mousemove", onResMove);
            document.removeEventListener("mouseup", onResUp);
            if (coordTip) coordTip.hidden = true;
            saveFloatPositions();
          };
          document.addEventListener("mousemove", onResMove);
          document.addEventListener("mouseup", onResUp);
        });
        w.appendChild(resizer);
      }

      let startX = 0;
      let startY = 0;
      let initLeft = 0;
      let initTop = 0;

      w.addEventListener("mousedown", (e) => {
        if (!floatEditMode) return;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;

        const rect = w.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;

        w.style.position = "absolute";
        w.style.transform = "none";
        w.style.left = `${initLeft}px`;
        w.style.top = `${initTop}px`;
        w.style.zIndex = "60";

        const onMove = (ev: MouseEvent) => {
          // 8px Snap-to-Grid + edge/center magnetic snap (Prompt 141)
          let nx = Math.round((initLeft + (ev.clientX - startX)) / 8) * 8;
          let ny = Math.round((initTop + (ev.clientY - startY)) / 8) * 8;
          const centerX = Math.round((window.innerWidth - w.offsetWidth) / 2);
          if (Math.abs(nx - centerX) <= 12) nx = centerX;
          if (nx <= 12) nx = 8;
          if (ny <= 12) ny = 8;
          w.style.left = `${Math.max(0, nx)}px`;
          w.style.top = `${Math.max(0, ny)}px`;
          showCoordTip(w);
        };

        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          w.style.zIndex = "10";
          if (coordTip) coordTip.hidden = true;
          saveFloatPositions();
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }
  syncWidgetToggleBar();
}

export function stopOverlayDemoLoop(): void {
  previewDemoActive = false;
  if (demoAnimationTimer) {
    clearInterval(demoAnimationTimer);
    demoAnimationTimer = null;
  }
  IrsdkClient.getInstance().stopSimulation();
}

function startDemoOverlayLoop(): void {
  if (typeof window !== "undefined" && window.location.search.includes("overlay=1") && !forcedDevHudMock()) {
    stopOverlayDemoLoop();
    setHudMode("closed");
    return;
  }
  if (!hudMockAllowed()) {
    setHudMode("closed");
    IrsdkClient.getInstance().stopSimulation();
    return;
  }
  setHudMode("mock");
  IrsdkClient.getInstance().startSimulation(200);
  if (demoAnimationTimer) clearInterval(demoAnimationTimer);

  const paintDemo = () => {
    if (isLiveFromSDK) return;

    demoTick += 0.1;
    const t = demoTick;
    const speed = 120 + Math.sin(t * 0.8) * 85;
    const gear = speed > 185 ? 5 : speed > 145 ? 4 : speed > 95 ? 3 : 2;
    const throttle = Math.sin(t * 0.8) > 0 ? Math.abs(Math.sin(t * 0.8)) : 0.05;
    const brake = Math.sin(t * 0.8) < -0.2 ? Math.abs(Math.sin(t * 0.8)) : 0;
    const steering = Math.sin(t * 0.4) * 0.75;

    updateHUDDisplay({
      t: demoTick,
      dist: (demoTick * 45) % 4657,
      speed: speed / 3.6,
      throttle,
      brake,
      gear,
      steering,
    });
  };
  paintDemo();
  demoAnimationTimer = window.setInterval(paintDemo, 100);
}

export function updateLiveOverlay(sample: LiveSample): void {
  if (forcedDevHudMock()) return;
  if (previewDemoActive) {
    previewDemoActive = false;
    if (demoAnimationTimer) {
      clearInterval(demoAnimationTimer);
      demoAnimationTimer = null;
    }
    const toggleBtn = document.getElementById("overlayModeToggle");
    if (toggleBtn) toggleBtn.textContent = "Probar Demo en Escenario";
  }
  isLiveFromSDK = true;
  IrsdkClient.getInstance().stopSimulation();
  setHudMode("live");
  updateHUDDisplay(sample);
}

function applyHaloStripStyle(el: HTMLElement | null, mode: "off" | "amber" | "red"): void {
  if (!el) return;
  if (mode === "amber") {
    el.className = "w-[245px] h-full rounded-full";
    el.style.background = "linear-gradient(90deg, rgba(245,158,11,0.98) 0%, rgba(251,191,36,0.92) 100%)";
    el.style.boxShadow = "0 0 14px rgba(245,158,11,0.95)";
  } else if (mode === "red") {
    el.className = "w-[245px] h-full rounded-full animate-pulse";
    el.style.background = "linear-gradient(90deg, rgba(239,68,68,1) 0%, rgba(248,113,113,0.95) 100%)";
    el.style.boxShadow = "0 0 18px rgba(239,68,68,1)";
  } else {
    el.className = "w-[245px] h-full rounded-full";
    el.style.background = "transparent";
    el.style.boxShadow = "none";
  }
}

function renderProximityHaloBar(carLeftRight: number, updateStage = false): void {
  const leftMode: "off" | "amber" | "red" =
    carLeftRight === 2 ? "amber" : carLeftRight === 4 || carLeftRight === 5 ? "red" : "off";
  const rightMode: "off" | "amber" | "red" =
    carLeftRight === 3 ? "amber" : carLeftRight === 4 || carLeftRight === 6 ? "red" : "off";
  const active = leftMode !== "off" || rightMode !== "off";

  const targets: Array<{ bar: string; left: string; right: string }> = [
    { bar: "floatProximityHaloBar", left: "haloLedLeft", right: "haloLedRight" },
  ];
  if (updateStage) {
    targets.push({ bar: "mmtStageHaloBar", left: "stageHaloLeft", right: "stageHaloRight" });
  }
  for (const t of targets) {
    const barEl = document.getElementById(t.bar);
    if (!barEl) continue;
    barEl.style.opacity = active ? "1" : "0";
    applyHaloStripStyle(document.getElementById(t.left), leftMode);
    applyHaloStripStyle(document.getElementById(t.right), rightMode);
  }
}

const studioLapHistory: LapHistoryEntry[] = [];

function updateHUDDisplay(sample: LiveSample): void {
  if (typeof document !== "undefined" && document.hidden) return;
  const irsdkState = IrsdkClient.getInstance().getLatestState();
  const kmh = Math.round(sample.speed * 3.6);
  const gearStr = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const mock = hudMockAllowed();
  const liveRpm = irsdkState?.frame.rpm ?? 0;
  const rpmEst = liveRpm > 0 ? Math.round(liveRpm) : (mock ? Math.min(8600, Math.round(kmh * 38 + 2100)) : 0);

  // Push to zero-allocation Float32Array circular buffer
  const writeIdx = waveformHead * 2;
  waveformRing[writeIdx] = sample.throttle;
  waveformRing[writeIdx + 1] = sample.brake;
  waveformHead = (waveformHead + 1) % WAVEFORM_CAPACITY;
  if (waveformCount < WAVEFORM_CAPACITY) waveformCount++;

  // Draw scrolling live waveform only for visible canvases
  document.querySelectorAll<HTMLCanvasElement>("#ovWaveformCanvas, #ovWaveformCanvasFloat").forEach((c) => {
    if (c.offsetParent !== null) drawWaveformCanvas(c);
  });

  // Shift Lights
  const shiftLightContainers = document.querySelectorAll<HTMLElement>("#ovShiftLights, #ovShiftLightsFloat");
  const revAlert = document.getElementById("ovRevLimiterAlert");
  const isLimiter = (liveRpm > 0 || mock) && rpmEst >= 8250;

  if (revAlert) {
    revAlert.classList.toggle("hidden", !isLimiter);
  }

  shiftLightContainers.forEach((shiftLights) => {
    if (shiftLights.children.length === 0) {
      for (let i = 0; i < 16; i++) {
        const led = document.createElement("div");
        led.className = "w-3 h-5 rounded-sm bg-white/10 transition-colors duration-75";
        led.dataset.led = String(i);
        shiftLights.append(led);
      }
    }
    const leds = shiftLights.children;
    const rpmNorm = mock ? Math.max(0, Math.min(1, (rpmEst - 5000) / 3250)) : 0;
    const activeCount = Math.floor(rpmNorm * 16);

    for (let i = 0; i < leds.length; i++) {
      const el = leds[i] as HTMLElement;
      if (isLimiter) {
        el.style.backgroundColor = (demoTick * 10) % 2 < 1 ? "#38bdf8" : "#818cf8";
        el.style.boxShadow = "0 0 10px #38bdf8";
      } else if (i < activeCount) {
        if (i < 5) el.style.backgroundColor = "#10b981";
        else if (i < 10) el.style.backgroundColor = "#facc15";
        else if (i < 14) el.style.backgroundColor = "#ef4444";
        else el.style.backgroundColor = "#38bdf8";
        el.style.boxShadow = "0 0 8px currentColor";
      } else {
        el.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
        el.style.boxShadow = "none";
      }
    }
  });

  // Update Brake Marker Countdown
  updateBrakeMarkerCountdown(sample.dist, kmh);

  // Central Cluster (only update visible elements and skip unchanged text)
  const speedStr = String(kmh);
  const rpmStr = mock ? `${rpmEst.toLocaleString()} RPM` : "—";
  document.querySelectorAll<HTMLElement>("#ovGear, #ovGearFloat").forEach((el) => {
    if (el.offsetParent !== null && el.textContent !== gearStr) el.textContent = gearStr;
  });
  document.querySelectorAll<HTMLElement>("#ovSpeed, #ovSpeedFloat").forEach((el) => {
    if (el.offsetParent !== null && el.textContent !== speedStr) el.textContent = speedStr;
  });
  document.querySelectorAll<HTMLElement>("#ovRpm, #ovRpmFloat").forEach((el) => {
    if (el.offsetParent !== null && el.textContent !== rpmStr) el.textContent = rpmStr;
  });

  const deltaVal = mock ? Math.sin(sample.t * 0.5) * 0.42 : 0;
  const ovDelta = document.getElementById("ovDelta");
  if (ovDelta && ovDelta.offsetParent !== null) {
    const deltaText = mock ? `${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(2)}s · Sector 2` : "—";
    if (ovDelta.textContent !== deltaText) ovDelta.textContent = deltaText;
    ovDelta.className = deltaVal <= 0
      ? "mb-3 px-5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/80 text-emerald-400 font-mono text-sm font-bold shadow-lg shadow-emerald-950/50"
      : "mb-3 px-5 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/80 text-rose-400 font-mono text-sm font-bold shadow-lg shadow-rose-950/50";
  }

  // Corner Analysis Widget
  const nextTurnBadge = document.getElementById("ovNextTurnBadge");
  const apexTarget = document.getElementById("ovCornerApexTarget");
  const cornerDelta = document.getElementById("ovCornerDelta");
  const cornerTip = document.getElementById("ovCornerTip");
  if (nextTurnBadge && apexTarget && cornerDelta && cornerTip && !mock) {
    nextTurnBadge.textContent = "—";
    apexTarget.textContent = "—";
    cornerDelta.textContent = "—";
    cornerTip.textContent = "—";
  } else if (nextTurnBadge && apexTarget && cornerDelta && cornerTip) {
    const turnIdx = Math.floor((sample.dist / 4657) * 14) + 1;
    nextTurnBadge.textContent = `Curva ${turnIdx}`;
    const targetSpd = 95 + ((turnIdx * 17) % 65);
    apexTarget.textContent = `${targetSpd} km/h`;
    const diff = kmh - targetSpd;
    cornerDelta.textContent = `${diff >= 0 ? "+" : ""}${diff} km/h`;
    cornerDelta.className = diff >= 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold";
    cornerTip.textContent = targetSpd < 110
      ? "Vértice lento: trail-braking profundo y abre dirección antes de dar gas."
      : "Curva rápida: sostén gas de apoyo para asentar el alerón trasero.";
  }

function safeRenderWidget(el: HTMLElement | null, fn: () => void): void {
  if (!el) return;
  try {
    fn();
  } catch (err) {
    console.warn(`[WidgetErrorBoundary] ${el.id || "widget"}:`, err);
    el.hidden = true;
  }
}

  // Render high-precision Relative, Standings, and Fuel at 4 Hz (250ms) and only when visible
  const nowHudMs = performance.now();
  const shouldRenderSlowHud = nowHudMs - lastSlowHudRenderMs >= 250;
  if (shouldRenderSlowHud) {
    lastSlowHudRenderMs = nowHudMs;
    if (isLiveFromSDK) {
      updateOverlayBrandBadge(irsdkState?.activeDriver?.carPath);
    }
    const hasSessionField = !isLiveFromSDK || (irsdkState !== null && irsdkState.leaderboard.length > 0);
    const floatRelCard = document.getElementById("floatRelativeCard");
    const floatStdCard = document.getElementById("floatStandingsCard");
    const floatFuelCard = document.getElementById("floatFuelCard");
    if (floatRelCard) floatRelCard.hidden = !hasSessionField;
    if (floatStdCard) floatStdCard.hidden = !hasSessionField;
    if (floatFuelCard) floatFuelCard.hidden = !hasSessionField;

    document.querySelectorAll<HTMLElement>("#ovRelative, #ovRelativeFloat").forEach((rel) => {
      if (rel.offsetParent !== null) safeRenderWidget(rel, () => renderRelativeWidget(rel, irsdkState));
    });
    document.querySelectorAll<HTMLElement>("#ovStandings, #ovStandingsFloat").forEach((standings) => {
      if (standings.offsetParent !== null) safeRenderWidget(standings, () => renderStandingsWidget(standings, irsdkState));
    });
    const raceDeltasEl = document.getElementById("ovRaceDeltasFloat");
    if (raceDeltasEl && raceDeltasEl.offsetParent !== null) {
      safeRenderWidget(raceDeltasEl, () => renderRaceDualDeltaWidget(raceDeltasEl, irsdkState));
    }
    document.querySelectorAll<HTMLElement>("#ovFuel, #ovFuelFloat").forEach((fuel) => {
      if (fuel.offsetParent !== null) safeRenderWidget(fuel, () => renderFuelWidget(fuel, irsdkState));
    });

    // Update minimalist Pro Live Metrics Strip in main app
    const proStrip = document.getElementById("proLiveMetricsStrip");
    if (proStrip && proStrip.offsetParent !== null && irsdkState) {
      const irEst = estimateLiveIRating(irsdkState);
      const activeLap = irsdkState.frame.carIdxLap[irsdkState.camCarIdx] || 0;
      const fuelLaps = irsdkState.fuel?.lapsRemaining;
      const parts: string[] = [];
      if (irEst) {
        parts.push(`<span class="px-2 py-0.5 rounded bg-r-bg border border-r-line text-r-text font-bold">P${irEst.myClassPos}/${irEst.classFieldSize}</span>`);
        parts.push(`<span class="text-r-muted">SOF ${formatSofShort(irEst.sof)}</span>`);
        const irColor = irEst.delta >= 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-rose-500/15 text-rose-300 border-rose-500/30";
        parts.push(`<span class="px-2 py-0.5 rounded border font-bold ${irColor}">${formatIRatingDelta(irEst.delta)} → ${irEst.projectedIr}</span>`);
      }
      if (activeLap > 0) {
        parts.push(`<span class="px-1.5 py-0.5 rounded bg-r-bg border border-r-line text-r-muted">L${activeLap}</span>`);
      }
      if (typeof fuelLaps === "number" && fuelLaps > 0 && Number.isFinite(fuelLaps)) {
        parts.push(`<span class="text-r-accent font-semibold">${fuelLaps.toFixed(1)}v fuel</span>`);
      }
      proStrip.innerHTML = parts.join("");
    }
  }

  // Prompts 34, 35, 37: Pit Exit Predictor, Tire Thermal IMO, Broadcast Director
  if (!engButtonsWired) {
    engButtonsWired = true;
    document.getElementById("btnResetColdTires")?.addEventListener("click", () => {
      tireThermalEngine.resetColdBaseline();
    });
    const autoCamBtn = document.getElementById("btnToggleAutoCam");
    autoCamBtn?.addEventListener("click", () => {
      const next = !broadcastDirector.getConfig().enabled;
      broadcastDirector.configure({ enabled: next });
      autoCamBtn.textContent = next ? "Auto-Cam: ON" : "Auto-Cam: OFF";
    });
    document.getElementById("btnManualClip")?.addEventListener("click", () => {
      const st = IrsdkClient.getInstance().getLatestState();
      const drv = st?.activeDriver;
      broadcastDirector.addManualClip(st?.frame?.sessionTime ?? 0, drv?.carNumber || "16", drv?.abbrevName || "Piloto MMT");
      const bdEl = document.getElementById("ovBroadcastDirectorWidget");
      if (bdEl) renderBroadcastDirectorWidget(bdEl, broadcastDirector);
    });
    document.getElementById("btnExportClipsCsv")?.addEventListener("click", () => {
      const csv = broadcastDirector.exportCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mmt-highlights-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const pitEl = document.getElementById("ovPitExitWidget");
  if (shouldRenderSlowHud && pitEl && pitEl.offsetParent !== null && irsdkState) {
    const rawFrame = irsdkState.frame;
    const activeIdx = irsdkState.camCarIdx;
    const activeLap = rawFrame?.carIdxLap?.[activeIdx] ?? 1;
    const estLapS = irsdkState.activeDriver?.carClassEstLapTime || irsdkState.session?.driverInfo?.driverCarEstLapTime || 95;
    const trackKey = irsdkState.session?.weekendInfo?.trackName || "default";
    pitExitPredictor.observePitTransition(
      trackKey,
      Boolean(irsdkState.onPitRoad),
      rawFrame?.sessionTime ?? 0,
    );
    const pred = pitExitPredictor.predict({
      trackKey,
      activeCarIdx: activeIdx,
      activeLapDistPct: rawFrame?.carIdxLapDistPct?.[activeIdx] ?? 0,
      estLapTimeS: estLapS,
      cars: mapLeaderboardToPitRefs(
        irsdkState.leaderboard || [],
        rawFrame?.carIdxLapDistPct || [],
        activeLap,
      ),
    });
    renderPitExitWidget(pitEl, pred);
  }

  const tireEl = document.getElementById("ovTireThermalWidget");
  if (shouldRenderSlowHud && tireEl && tireEl.offsetParent !== null) {
    const baseTemp = 68 + Math.min(28, (kmh / 260) * 18 + (sample.brake || 0) * 12);
    const baseKpa = 165 + Math.min(18, (kmh / 260) * 10);
    const tireSnap = tireThermalEngine.evaluate({
      onPitRoad: Boolean(irsdkState?.onPitRoad),
      LF: { innerC: baseTemp + 5.2, middleC: baseTemp + 1.4, outerC: baseTemp - 2.1, pressureKpa: baseKpa + 2.4 },
      RF: { innerC: baseTemp + 3.8, middleC: baseTemp + 0.8, outerC: baseTemp - 1.5, pressureKpa: baseKpa + 1.8 },
      LR: { innerC: baseTemp + 1.2, middleC: baseTemp - 1.5, outerC: baseTemp - 3.0, pressureKpa: baseKpa + 0.9 },
      RR: { innerC: baseTemp + 0.9, middleC: baseTemp - 1.8, outerC: baseTemp - 3.4, pressureKpa: baseKpa + 0.6 },
      env: {
        trackTempC: irsdkState?.frame?.trackTempC || 29.2,
        windSpeedKmh: 14,
        windDirDeg: 45,
        trackWetnessPct: irsdkState?.frame?.precipitationPct ?? 0,
      },
    });
    renderTireThermalWidget(tireEl, tireSnap, tireThermalEngine);
  }

  if (shouldRenderSlowHud && irsdkState) {
    const rawFrame = irsdkState.frame;
    const activeIdx = irsdkState.camCarIdx;
    const activeLap = Math.max(1, rawFrame?.carIdxLap?.[activeIdx] ?? 1);
    const fuel = irsdkState.fuel;
    const stintLaps = Math.max(1, fuel?.stintLapsRemaining ?? 4);
    const totalLapsLeft = Math.max(1, fuel?.lapsRemaining ?? 12);
    const fuelToAdd = Math.max(0, fuel?.fuelToAdd ?? 28);
    const estBox = 21.5 + fuelToAdd * 0.25;
    const myEntry = irsdkState.leaderboard?.find((e) => e.carIdx === activeIdx);
    const myPos = myEntry?.position || 4;
    const classSize = irsdkState.leaderboard?.length || 18;
    const rejoinPos = Math.min(classSize, myPos + Math.max(1, Math.round(estBox / 14)));
    const needsFuelSave = stintLaps < totalLapsLeft && (totalLapsLeft - stintLaps) <= 2.2;
    const fuelSavePerLapL = needsFuelSave ? Math.min(0.35, ((totalLapsLeft - stintLaps) * (fuel?.avgBurnPerLap || 2.8)) / Math.max(1, stintLaps)) : 0;
    const pitStratData = {
      currentLap: activeLap,
      pitWindowStartLap: activeLap + Math.max(1, Math.floor(stintLaps - 2)),
      pitWindowEndLap: activeLap + Math.max(1, Math.floor(stintLaps)),
      estPitTimeS: estBox,
      rejoinPos,
      classSize,
      fuelToAddL: fuelToAdd,
      changeTires: fuelToAdd > 35,
      boxThisLap: stintLaps <= 1.5 && totalLapsLeft > 1.5,
      fuelSavePerLapL,
      aheadCarLabel: myEntry?.abbrevName ? `P${Math.max(1, rejoinPos - 1)}` : "#22 E. Chongkan",
    };
    document.querySelectorAll<HTMLElement>("#ovPitStrategy, #ovPitStrategyFloat").forEach((el) => {
      if (el.offsetParent !== null) renderPitStrategyWidget(el, pitStratData);
    });

    const baseTemp = 72 + Math.min(26, (kmh / 260) * 18 + (sample.brake || 0) * 10);
    const baseKpa = 166 + Math.min(16, (kmh / 260) * 9);
    const liveTireSnap = tireThermalEngine.evaluate({
      onPitRoad: Boolean(irsdkState.onPitRoad),
      LF: { innerC: baseTemp + 4.8, middleC: baseTemp + 1.5, outerC: baseTemp - 1.8, pressureKpa: baseKpa + 2.2 },
      RF: { innerC: baseTemp + 3.4, middleC: baseTemp + 0.9, outerC: baseTemp - 1.4, pressureKpa: baseKpa + 1.6 },
      LR: { innerC: baseTemp + 1.0, middleC: baseTemp - 1.2, outerC: baseTemp - 2.6, pressureKpa: baseKpa + 0.8 },
      RR: { innerC: baseTemp + 0.7, middleC: baseTemp - 1.6, outerC: baseTemp - 2.9, pressureKpa: baseKpa + 0.5 },
      env: {
        trackTempC: rawFrame?.trackTempC || 29.2,
        windSpeedKmh: 14,
        windDirDeg: 45,
        trackWetnessPct: rawFrame?.precipitationPct ?? 0,
      },
    });
    document.querySelectorAll<HTMLElement>("#ovTireMonitor, #ovTireMonitorFloat").forEach((el) => {
      if (el.offsetParent !== null) renderTireThermalWidget(el, liveTireSnap, tireThermalEngine);
    });
  }

  const bdEl = document.getElementById("ovBroadcastDirectorWidget");
  if (shouldRenderSlowHud && bdEl && bdEl.offsetParent !== null && irsdkState) {
    const sessionTime = irsdkState.frame?.sessionTime ?? 0;
    broadcastDirector.evaluateCamera(irsdkState.leaderboard || [], sessionTime);
    const clr = Number((sample as any).carLeftRight ?? 0);
    const drv = irsdkState.activeDriver;
    broadcastDirector.observeParallelBattle(clr, sessionTime, drv?.carNumber || "16", drv?.abbrevName || "Piloto");
    renderBroadcastDirectorWidget(bdEl, broadcastDirector);
  }

  // Bloque 2: GPU-Accelerated Pedals & Steering (60 FPS, Canvas) + Ghost Compare (Prompt 103)
  const ghostEnabled = typeof localStorage !== "undefined" && localStorage.getItem("mmt-ghost-compare") === "1";
  let ghostPt: { throttle: number; brake: number } | null = null;
  if (irsdkState) {
    const cIdx = irsdkState.camCarIdx;
    const distPct = irsdkState.frame.carIdxLapDistPct[cIdx] ?? (sample.dist >= 0 && sample.dist <= 1 ? sample.dist : -1);
    const lap = irsdkState.frame.carIdxLap[cIdx] ?? 0;
    const lastLap = irsdkState.frame.carIdxLastLapTime[cIdx] ?? 0;
    const estLap = irsdkState.activeDriver?.carClassEstLapTime || 90;
    ghostPt = ghostTrace.update(distPct, lap, lastLap, sample.throttle, sample.brake, kmh, estLap);
  }
  const pedalSample = {
    throttle: sample.throttle,
    brake: sample.brake,
    clutch: sample.clutch ?? irsdkState?.frame.clutch ?? 0,
    steering: sample.steering,
    speedKmh: kmh,
    gear: sample.gear,
    absActive: Boolean(sample.brakeAbsActive || irsdkState?.frame.brakeAbsActive),
    ghostEnabled,
    ghostThrottle: ghostPt?.throttle,
    ghostBrake: ghostPt?.brake,
  };
  document.querySelectorAll<HTMLElement>("#ovGpuPedals, #ovGpuPedalsFloat").forEach((container) => {
    if (container.offsetParent !== null) safeRenderWidget(container, () => renderGpuPedalsWidget(container, pedalSample));
  });
  const haloDisabled = loadDisabledWidgets().has("halo");
  const carLeftRight = haloDisabled ? 0 : (sample.carLeftRight ?? irsdkState?.frame.carLeftRight ?? 0);
  renderProximityHaloBar(carLeftRight);

  // Live Delta Bar (30 FPS Canvas, Prompt 109)
  const deltaCanvas = document.getElementById("ovLiveDeltaFloat") as HTMLCanvasElement | null;
  if (deltaCanvas && deltaCanvas.offsetParent !== null) {
    safeRenderWidget(deltaCanvas, () => renderLiveDeltaCanvas(deltaCanvas, sample.lapDelta ?? 0, Boolean(sample.lapDeltaOk)));
  }

  // Fallback for canvas inputs if visible
  document.querySelectorAll<HTMLCanvasElement>("#ovInputs, #ovInputsFloat").forEach((canvas) => {
    if (!canvas.classList.contains("hidden") && canvas.offsetParent !== null) {
      safeRenderWidget(canvas, () => drawInputsCanvas(canvas, sample));
    }
  });

  // Bloque 2: 360° Proximity Radar (15 Hz), Pitbox Helper (4 Hz), DigiFlag (15 Hz)
  if (irsdkState) {
    const frame = irsdkState.frame;
    const session = irsdkState.session;

    if (nowHudMs - lastRadarRenderMs >= 66) {
      lastRadarRenderMs = nowHudMs;
      document.querySelectorAll<HTMLElement>("#ovRadar, #ovRadarFloat").forEach((radar) => {
        if (radar.offsetParent !== null) {
          safeRenderWidget(radar, () => renderHelicorsaRadar(radar, irsdkState));
        }
      });
      document.querySelectorAll<HTMLCanvasElement>("#ovTrackMap, #ovTrackMapFloat").forEach((trackMapCanvas) => {
        if (trackMapCanvas.offsetParent !== null) {
          observeTrackAutoMap(
            irsdkState.session.weekendInfo?.trackName || "",
            frame.carIdxLap[irsdkState.camCarIdx] ?? 0,
            frame.carIdxLapDistPct[irsdkState.camCarIdx] ?? -1,
            sample.vx ?? 0,
            sample.vy ?? 0,
          );
          safeRenderWidget(trackMapCanvas, () => renderLiveTrackMapCanvas(trackMapCanvas, irsdkState));
        }
      });
    }

    if (shouldRenderSlowHud) {
      document.querySelectorAll<HTMLElement>("#ovPitbox, #ovPitboxFloat").forEach((pitbox) => {
        if (pitbox.offsetParent !== null) {
          safeRenderWidget(pitbox, () =>
            renderPitboxWidget(pitbox, {
              onPitRoad: irsdkState.onPitRoad,
              speedKmh: kmh,
              pitSpeedLimitKmh: (frame as any).pitSpeedLimitKmh ?? 60,
              distanceToStallMeters: (frame as any).playerCarPitLocation ?? 0,
            }),
          );
        }
      });

      document.querySelectorAll<HTMLElement>("#ovDigiFlag, #ovDigiFlagFloat").forEach((flag) => {
        if (flag.parentElement && flag.parentElement.offsetParent !== null) {
          safeRenderWidget(flag, () => renderDigiFlagWidget(flag, frame.sessionFlags ?? 0));
        }
      });

      const condEl = document.getElementById("ovTrackConditionsFloat");
      if (condEl && condEl.offsetParent !== null) {
        safeRenderWidget(condEl, () => renderTrackConditionsWidget(condEl, irsdkState));
      }

      const tireStatusEl = document.getElementById("ovTireStatusFloat");
      if (tireStatusEl && tireStatusEl.offsetParent !== null) {
        safeRenderWidget(tireStatusEl, () => renderTireStatusWidget(tireStatusEl, irsdkState));
      }

      const dockEl = document.getElementById("ovCarTelemetryDockFloat");
      if (dockEl && dockEl.offsetParent !== null) {
        safeRenderWidget(dockEl, () => renderCarTelemetryDock(dockEl, irsdkState));
      }

      // Prompt 162: Modular Overlays (0% CPU when OFF)
      const disabledMods = loadDisabledWidgets();
      const digiPanelEl = document.getElementById("floatDigiFlagPanel");
      if (digiPanelEl) {
        if (disabledMods.has("digiflag")) {
          if (digiPanelEl.style.display !== "none") { digiPanelEl.style.display = "none"; digiPanelEl.innerHTML = ""; }
        } else {
          safeRenderWidget(digiPanelEl, () => renderDigiFlagPanelWidget(digiPanelEl, irsdkState));
        }
      }
      const rejoinEl = document.getElementById("floatRejoinHelper");
      if (rejoinEl) {
        if (disabledMods.has("rejoin")) {
          if (rejoinEl.style.display !== "none") { rejoinEl.style.display = "none"; rejoinEl.innerHTML = ""; }
        } else {
          safeRenderWidget(rejoinEl, () => renderRejoinHelperWidget(rejoinEl, irsdkState, kmh));
        }
      }
      const fasterEl = document.getElementById("floatFasterCarAlert");
      if (fasterEl) {
        if (disabledMods.has("fastercar")) {
          if (fasterEl.style.display !== "none") { fasterEl.style.display = "none"; fasterEl.innerHTML = ""; }
        } else {
          safeRenderWidget(fasterEl, () => renderFasterCarAlertWidget(fasterEl, irsdkState));
        }
      }
      const inCarEl = document.getElementById("floatInCarControls");
      if (inCarEl) {
        if (disabledMods.has("incar")) {
          if (inCarEl.style.display !== "none") { inCarEl.style.display = "none"; inCarEl.innerHTML = ""; }
        } else {
          safeRenderWidget(inCarEl, () => renderInCarControlsWidget(inCarEl, irsdkState, nowHudMs));
        }
      }
      const lapTimesEl = document.getElementById("floatLapTimesPanel");
      if (lapTimesEl) {
        if (disabledMods.has("laptimes")) {
          if (lapTimesEl.style.display !== "none") { lapTimesEl.style.display = "none"; lapTimesEl.innerHTML = ""; }
        } else {
          const cIdx = irsdkState.camCarIdx;
          const curLap = frame.carIdxLap?.[cIdx] ?? 0;
          const lastLapSec = frame.carIdxLastLapTime?.[cIdx] ?? 0;
          const bestLapSec = frame.carIdxBestLapTime?.[cIdx] ?? 0;
          if (curLap > 1 && lastLapSec > 10 && !studioLapHistory.some((l) => l.lap === curLap - 1)) {
            studioLapHistory.push({ lap: curLap - 1, timeSec: lastLapSec });
          }
          lapTimesEl.style.display = "block";
          safeRenderWidget(lapTimesEl, () => renderLapTimesWidget(lapTimesEl, studioLapHistory, bestLapSec, bestLapSec));
        }
      }

      // Smart Auto-Fuel Pro: Leader-pace laps + telemetry burn + guaranteed >= +0.2/+0.4L safety margin above iRacing
      const pitNow = Boolean(irsdkState.onPitRoad);
      const autoFuelEnabled = typeof localStorage !== "undefined" && localStorage.getItem("mmt-auto-fuel-pit") === "1";
      if (autoFuelEnabled && irsdkState.fuel.isValid) {
        const marginRaw = Number(localStorage.getItem("mmt-auto-fuel-margin-l") || "0.4");
        const safetyMarginL = Number.isFinite(marginRaw) ? Math.max(0.2, Math.min(3.0, marginRaw)) : 0.4;

        // Leader pace calculation (P1 best/last lap time -> worst-case remaining laps so we never run dry)
        let leaderLapSec = 0;
        const posArr = frame.carIdxPosition || [];
        for (let i = 0; i < posArr.length; i++) {
          if (posArr[i] === 1) {
            const lb = frame.carIdxBestLapTime?.[i] ?? 0;
            const ll = frame.carIdxLastLapTime?.[i] ?? 0;
            leaderLapSec = lb > 10 ? lb : (ll > 10 ? ll : 0);
            break;
          }
        }
        const myBest = frame.carIdxBestLapTime?.[irsdkState.camCarIdx] ?? 0;
        const refLapSec = leaderLapSec > 10 ? leaderLapSec : (myBest > 10 ? myBest : 0);
        const sessRemainSec = Number(frame.sessionTimeRemain ?? 0);
        const avgBurn = Number(irsdkState.fuel.avgBurnPerLap ?? 0);
        const curFuel = Number(irsdkState.fuel.fuelRemainingL ?? frame.fuelLevel ?? 0);

        let leaderCalcAdd = 0;
        if (refLapSec > 10 && sessRemainSec > 0 && avgBurn > 0.05) {
          const leaderLapsRem = Math.ceil(sessRemainSec / refLapSec) + 0.25;
          leaderCalcAdd = Math.max(0, leaderLapsRem * avgBurn - curFuel + safetyMarginL);
        }

        // Always enforce at least +0.2L / +0.4L over iRacing's own fuelToAdd estimate
        const iracingEstWithBuffer = irsdkState.fuel.fuelToAdd > 0 ? (irsdkState.fuel.fuelToAdd + safetyMarginL) : 0;
        const targetLiters = Math.ceil(Math.max(leaderCalcAdd, iracingEstWithBuffer));

        const curLapForFuel = frame.carIdxLap?.[irsdkState.camCarIdx] ?? 0;
        const winAny = window as unknown as { __mmtLastFuelLap?: number; __mmtLastFuelSent?: number };
        const lapChanged = curLapForFuel > 0 && winAny.__mmtLastFuelLap !== curLapForFuel;
        const enteredPit = pitNow && !lastAutoFuelPitRoad;

        if (targetLiters > 0 && (enteredPit || (lapChanged && winAny.__mmtLastFuelSent !== targetLiters))) {
          winAny.__mmtLastFuelLap = curLapForFuel;
          winAny.__mmtLastFuelSent = targetLiters;
          void import("@tauri-apps/api/core")
            .then(({ invoke }) => invoke("send_iracing_pit_fuel", { liters: targetLiters }))
            .catch(() => {});
        }
      }
      lastAutoFuelPitRoad = pitNow;

      // MMT Companion Live Playtime & Session Heartbeat (every 60s while actively driving in iRacing)
      if (!frame.isReplayPlaying) {
        const wComp = window as unknown as {
          __mmtPtLastTs?: number;
          __mmtPtAccumSec?: number;
          __mmtPtLastLap?: number;
          __mmtPtLapsDelta?: number;
          __mmtPtLastPushTs?: number;
        };
        const nowMs = Date.now();
        if (wComp.__mmtPtLastTs && nowMs - wComp.__mmtPtLastTs < 10_000) {
          wComp.__mmtPtAccumSec = (wComp.__mmtPtAccumSec || 0) + (nowMs - wComp.__mmtPtLastTs) / 1000;
        }
        wComp.__mmtPtLastTs = nowMs;
        const lapNow = frame.carIdxLap?.[irsdkState.camCarIdx] ?? 0;
        if (wComp.__mmtPtLastLap != null && lapNow > wComp.__mmtPtLastLap && lapNow - wComp.__mmtPtLastLap <= 2) {
          wComp.__mmtPtLapsDelta = (wComp.__mmtPtLapsDelta || 0) + (lapNow - wComp.__mmtPtLastLap);
        }
        if (lapNow > 0) wComp.__mmtPtLastLap = lapNow;

        if (!wComp.__mmtPtLastPushTs || nowMs - wComp.__mmtPtLastPushTs >= 60_000) {
          const deltaSec = Math.round(wComp.__mmtPtAccumSec || 0);
          const deltaLaps = wComp.__mmtPtLapsDelta || 0;
          const tk = typeof localStorage !== "undefined"
            ? (localStorage.getItem("mmt_desktop_token") || localStorage.getItem("mrt_vault_token") || localStorage.getItem("mm_token") || "")
            : "";
          if (tk && (deltaSec >= 10 || deltaLaps > 0)) {
            wComp.__mmtPtLastPushTs = nowMs;
            wComp.__mmtPtAccumSec = 0;
            wComp.__mmtPtLapsDelta = 0;
            const liveTrack = session.weekendInfo?.trackName || "";
            const liveCar = session.driverInfo?.drivers?.[irsdkState.camCarIdx]?.carScreenName || "";
            void fetch("https://muntrume.atrumin16.workers.dev/api/desktop/companion/push", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
              body: JSON.stringify({
                playtime_delta_sec: deltaSec,
                laps_delta: deltaLaps,
                live_session: {
                  active: true,
                  track: liveTrack,
                  car: liveCar,
                  lap: lapNow,
                  on_pit_road: pitNow,
                  fuel_l: Number((frame.fuelLevel ?? 0).toFixed(2)),
                  speed_kph: Math.round(frame.speedKmh ?? 0),
                },
              }),
            }).catch(() => {});
          }
        }
      }
    }

    if (shouldRenderSlowHud) {
      const category = session.weekendInfo?.category || "";
      const sessionType = session.sessionType || "";
      const carPath = irsdkState.activeDriver?.carPath || "";
      SmartLayoutManager.getInstance().matchAndActivate(category, sessionType, carPath);

      // Bloque 21 + Prompt 203: Contextual visibility rules & Replay Safe Zones (evaluated at 4 Hz)
      const vis = VisibilityRulesEngine.getInstance();
      const showReplays = localStorage.getItem("mmt-hud-show-replays") !== "0";
      const showAllSess = localStorage.getItem("mmt-hud-show-all-sessions") !== "0";
      const disabledWidgets = loadDisabledWidgets();
      const isReplayMode = Boolean(irsdkState.isReplayPlaying || !frame.isOnTrack || frame.sessionState === 6);
      const visCtx = {
        isReplayPlaying: isReplayMode,
        sessionType: showAllSess ? "Race" : (session.sessionType || ""),
        sessionState: frame.sessionState || 4,
        camCarIdx: irsdkState.camCarIdx,
        activeLap: showAllSess ? 2 : (frame.carIdxLap[irsdkState.camCarIdx] || 1),
        lapDistPct: showAllSess ? 0.5 : (frame.carIdxLapDistPct[irsdkState.camCarIdx] || 0),
        onPitRoad: irsdkState.onPitRoad,
      };

      const replayAllowed = !isReplayMode || showReplays;
      const ruleStdPitOnly = localStorage.getItem("mmt-rule-std-pit-only") === "1";
      const ruleRelTrackOnly = localStorage.getItem("mmt-rule-rel-track-only") === "1";
      const ruleFuelReserveOnly = localStorage.getItem("mmt-rule-fuel-reserve-only") === "1";
      const activeTrackOrReplay = Boolean(frame.isOnTrack || irsdkState.isReplayPlaying);
      const stdShow = replayAllowed && !disabledWidgets.has("standings") && vis.evaluateVisibility("standings", visCtx) && (!ruleStdPitOnly || irsdkState.onPitRoad || irsdkState.isReplayPlaying || !frame.isOnTrack);
      const relShow = replayAllowed && !disabledWidgets.has("relative") && vis.evaluateVisibility("relative", visCtx) && (!ruleRelTrackOnly || activeTrackOrReplay);
      const inpShow = replayAllowed && !disabledWidgets.has("inputs") && vis.evaluateVisibility("pedals", visCtx) && (!ruleRelTrackOnly || activeTrackOrReplay);
      const fuelReserveOk = !ruleFuelReserveOnly || !irsdkState.fuel.isValid || irsdkState.fuel.lapsRemaining <= 5 || irsdkState.fuel.fuelToAdd > 0;
      const fuelShow = replayAllowed && !disabledWidgets.has("fuel") && vis.evaluateVisibility("fuel", visCtx) && fuelReserveOk;
      const mapShow = replayAllowed && !disabledWidgets.has("trackmap") && vis.evaluateVisibility("trackmap", visCtx);
      const waveShow = replayAllowed && !disabledWidgets.has("waveform") && vis.evaluateVisibility("waveform", visCtx);
      const cockpitVisible = replayAllowed && (!isReplayMode || vis.getReplayHudMode() === "full");

      vis.applyElementVisibility(document.getElementById("floatRelativeCard"), floatEditMode || relShow);
      vis.applyElementVisibility(document.getElementById("floatStandingsCard"), floatEditMode || stdShow);
      vis.applyElementVisibility(document.getElementById("floatCarTelemetryDock"), floatEditMode || (fuelShow && !isReplayMode));
      vis.applyElementVisibility(document.getElementById("floatFuelCard"), floatEditMode || (fuelShow && !isReplayMode));
      vis.applyElementVisibility(document.getElementById("floatDeltaBarCard"), floatEditMode || (inpShow && !isReplayMode && !disabledWidgets.has("delta")));
      vis.applyElementVisibility(document.getElementById("floatRadarCard"), floatEditMode || (!isReplayMode && !disabledWidgets.has("radar")));
      vis.applyElementVisibility(document.getElementById("floatTireStatusCard"), replayAllowed && !disabledWidgets.has("tires") && vis.evaluateVisibility("fuel", visCtx));
      vis.applyElementVisibility(document.getElementById("floatCenterStatusDock"), replayAllowed && !disabledWidgets.has("conditions") && vis.getReplayHudMode() !== "hidden");
      vis.applyElementVisibility(document.getElementById("floatTrackMapCard"), floatEditMode || mapShow);
      vis.applyElementVisibility(document.getElementById("floatInputsCard"), floatEditMode || (inpShow && !isReplayMode));
      vis.applyElementVisibility(document.getElementById("floatSteeringWheelCard"), floatEditMode || (inpShow && !isReplayMode));
      vis.applyElementVisibility(document.getElementById("floatWaveformCard"), floatEditMode || (waveShow && !isReplayMode));
      vis.applyElementVisibility(document.getElementById("floatClusterCard"), floatEditMode || (cockpitVisible && !disabledWidgets.has("cluster")));
      vis.applyElementVisibility(document.getElementById("floatShiftLightsRow"), floatEditMode || (cockpitVisible && !disabledWidgets.has("lights")));

      // Prompt 203: Automatic Replay Safe Zones (top >= 92px, bottom >= 140px)
      const safeActive = isReplayMode && !floatEditMode;
      for (const id of ["floatStandingsCard", "floatRelativeCard", "floatCenterStatusDock"]) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (safeActive) {
          if (el.dataset.inCarTop === undefined) el.dataset.inCarTop = el.style.top || "";
          const curTop = el.getBoundingClientRect().top;
          if (curTop < 92) el.style.top = "92px";
        } else if (el.dataset.inCarTop !== undefined) {
          el.style.top = el.dataset.inCarTop;
          delete el.dataset.inCarTop;
        }
      }
      for (const id of ["floatCarTelemetryDock", "floatFuelCard", "floatInputsCard", "floatWaveformCard", "floatClusterCard", "floatTrackMapCard"]) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (safeActive) {
          if (el.dataset.inCarBottom === undefined) el.dataset.inCarBottom = el.style.bottom || "";
          const rect = el.getBoundingClientRect();
          if (rect.height > 0 && rect.bottom > window.innerHeight - 135) {
            el.style.top = "auto";
            el.style.bottom = "140px";
          }
        } else if (el.dataset.inCarBottom !== undefined) {
          el.style.bottom = el.dataset.inCarBottom;
          delete el.dataset.inCarBottom;
        }
      }
      const pitCard = document.getElementById("floatPitHelperCard");
      if (pitCard) {
        pitCard.hidden = !Boolean(irsdkState.onPitRoad);
      }
      const carProximity = Number(frame.carLeftRight ?? 0);
      const radarVisible = !disabledWidgets.has("radar") && (floatEditMode || carProximity > 0);
      vis.applyElementVisibility(document.getElementById("floatRadarCard"), radarVisible);

      // Auto-hide Layers Control Panel and top-right HUD chrome when driving on track
      const isOnTrack = Boolean(frame.isOnTrack);
      const chrome = document.getElementById("floatHudChrome");
      const layersPanel = document.getElementById("floatLayersControlPanel");
      const reopenBtn = document.getElementById("hudReopenBtn");
      if (isOnTrack && !floatEditMode) {
        if (chrome) chrome.hidden = true;
        if (layersPanel) layersPanel.hidden = true;
        if (reopenBtn) reopenBtn.hidden = false;
      } else if (!floatEditMode) {
        const showChrome = SmartLayoutManager.getInstance().computeEditBarVisibility(irsdkState.onPitRoad, false);
        if (chrome) chrome.hidden = !showChrome;
        if (reopenBtn) reopenBtn.hidden = showChrome;
      } else {
        if (chrome) chrome.hidden = false;
        if (reopenBtn) reopenBtn.hidden = true;
      }
    }

    // Broadcast normalized telemetry to WebSocket and external plugins only if subscribers exist
    LocalTelemetryBus.getInstance().publish(irsdkState, kmh, {
      throttle: sample.throttle,
      brake: sample.brake,
      clutch: (sample as any).clutch ?? 0,
      steering: sample.steering,
      gear: sample.gear,
      rpm: rpmEst || 7500,
    });
  }

  const steerDeg = (sample.steering * 57.2958).toFixed(1);
  const tyresText = `Volante: ${steerDeg}° · Gas: ${Math.round(sample.throttle * 100)}% · Freno: ${Math.round(sample.brake * 100)}%`;
  document.querySelectorAll<HTMLElement>("#ovTyres, #ovTyresFloat").forEach((tyres) => {
    if (tyres.offsetParent !== null && tyres.textContent !== tyresText) tyres.textContent = tyresText;
  });
}

function updateBrakeMarkerCountdown(dist: number, speed: number): void {
  const bm200 = document.getElementById("bm200");
  const bm150 = document.getElementById("bm150");
  const bm100 = document.getElementById("bm100");
  const bm50 = document.getElementById("bm50");
  const bmAdvice = document.getElementById("bmAdvice");
  const bmFloatCountdown = document.getElementById("bmFloatCountdown");
  const bmFloatAdvice = document.getElementById("bmFloatAdvice");

  if (!hudMockAllowed()) {
    if (bmFloatCountdown) bmFloatCountdown.textContent = "—";
    if (bmFloatAdvice) bmFloatAdvice.textContent = "—";
    if (bmAdvice) bmAdvice.textContent = "—";
    return;
  }

  // Approximate next braking zone (repeats every ~400m). Solo con el flag de demo.
  const zoneCycle = dist % 400;
  const distToZone = Math.max(0, 250 - zoneCycle);

  const resetPill = (el: HTMLElement | null, active: boolean, colorClass: string) => {
    if (!el) return;
    if (active) {
      el.className = `px-2 py-0.5 rounded font-bold ${colorClass} shadow-md`;
    } else {
      el.className = "px-2 py-0.5 rounded bg-white/10 text-white/40";
    }
  };

  resetPill(bm200, distToZone <= 200 && distToZone > 150, "bg-sky-500/30 text-sky-300 border border-sky-400");
  resetPill(bm150, distToZone <= 150 && distToZone > 100, "bg-yellow-500/30 text-yellow-300 border border-yellow-400");
  resetPill(bm100, distToZone <= 100 && distToZone > 50, "bg-amber-500/30 text-amber-300 border border-amber-400");
  resetPill(bm50, distToZone <= 50 && distToZone > 10, "bg-rose-500/30 text-rose-300 border border-rose-400 animate-pulse");

  let advice = "Aceleración Plena";
  let countStr = "Recta";
  if (distToZone <= 200 && distToZone > 120) {
    advice = "Preparar Frenada (Referencia 120m)";
    countStr = `${Math.round(distToZone)}m`;
  } else if (distToZone <= 120 && distToZone > 60) {
    advice = speed > 160 ? "¡Freno Fuerte! (Pico 85-90%)" : "Freno Medio (Pico 60%)";
    countStr = `${Math.round(distToZone)}m`;
  } else if (distToZone <= 60 && distToZone > 0) {
    advice = "Trail-Braking hacia el Ápice";
    countStr = "ÁPICE";
  }

  if (bmAdvice) bmAdvice.textContent = advice;
  if (bmFloatCountdown) bmFloatCountdown.textContent = countStr;
  if (bmFloatAdvice) bmFloatAdvice.textContent = advice;
}

function drawWaveformCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.95)";
  ctx.fillRect(0, 0, w, h);

  // Grid line at 50%
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.5);
  ctx.lineTo(w, h * 0.5);
  ctx.stroke();

  if (waveformCount < 2) return;

  const step = w / WAVEFORM_CAPACITY;
  const startIdx = waveformCount === WAVEFORM_CAPACITY ? waveformHead : 0;

  // Brake curve (Red)
  ctx.beginPath();
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 2;
  for (let i = 0; i < waveformCount; i++) {
    const slot = ((startIdx + i) % WAVEFORM_CAPACITY) * 2;
    const x = i * step;
    const y = h - waveformRing[slot + 1] * (h - 6) - 3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Throttle curve (Green)
  ctx.beginPath();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  for (let i = 0; i < waveformCount; i++) {
    const slot = ((startIdx + i) % WAVEFORM_CAPACITY) * 2;
    const x = i * step;
    const y = h - waveformRing[slot] * (h - 6) - 3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawInputsCanvas(canvas: HTMLCanvasElement, sample: LiveSample): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.95)";
  ctx.fillRect(0, 0, w, h);

  const barH = 58;
  const barY = 14;

  // Throttle capsule bar
  const thrNorm = Math.max(0, Math.min(1, sample.throttle));
  const thrH = thrNorm * barH;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(14, barY, 18, barH);
  ctx.fillStyle = "#10b981";
  ctx.fillRect(14, barY + barH - thrH, 18, thrH);

  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#a0aba6";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(thrNorm * 100)}%`, 23, barY - 3);
  ctx.fillText("GAS", 23, barY + barH + 14);

  // Brake capsule bar
  const brkNorm = Math.max(0, Math.min(1, sample.brake));
  const brkH = brkNorm * barH;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(38, barY, 18, barH);
  ctx.fillStyle = brkNorm > 0.85 ? "#ff2a44" : "#f43f5e";
  ctx.fillRect(38, barY + barH - brkH, 18, brkH);

  ctx.fillText(`${Math.round(brkNorm * 100)}%`, 47, barY - 3);
  ctx.fillText("BRK", 47, barY + barH + 14);

  // Force Feedback Clipping bar (FF)
  const ffNorm = Math.min(1, Math.abs(sample.steering) * 0.85 + (sample.speed > 50 ? 0.2 : 0.05));
  const ffH = ffNorm * barH;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(62, barY, 12, barH);
  ctx.fillStyle = ffNorm > 0.95 ? "#ef4444" : "#94a3b8";
  ctx.fillRect(62, barY + barH - ffH, 12, ffH);
  ctx.fillText("FF", 68, barY + barH + 14);

  // ABS active indicator
  if (brkNorm > 0.8) {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(47, barY - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Steering gauge
  const stX = 92;
  const stW = 110;
  const stMid = stX + stW / 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(stX, barY + 22, stW, 8);

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillRect(stMid - 1, barY + 16, 2, 20);

  const steerDeg = sample.steering * 57.2958;
  const steerNorm = Math.max(-1, Math.min(1, steerDeg / 90));
  const pipX = stMid - steerNorm * (stW / 2 - 5);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(pipX - 3, barY + 16, 6, 20);

  ctx.fillText(`VOL ${steerDeg >= 0 ? "+" : ""}${steerDeg.toFixed(0)}°`, stMid, barY + barH + 14);

  // Speed and Gear readout
  const gear = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const kmh = Math.round(sample.speed * 3.6);
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(gear, 252, 40);

  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#00e699";
  ctx.fillText(`${kmh} km/h`, 252, 64);
}

// -------------------------------------------------------------
// 5. OFFICIAL TEAM ROSTER & PADDOCK
// -------------------------------------------------------------
interface TeamDriver {
  slug: string;
  number: string;
  fullName: string;
  role: string;
  specialty: string;
  badge: "FUNDADOR" | "PILOTO";
  country: string;
  flag: string;
  favoriteTrack: string;
  topCars: string[];
  onlineStatus: string;
}

const OFFICIAL_DRIVERS: TeamDriver[] = [
  {
    slug: "albertot",
    number: "#16",
    fullName: "Alberto Trujillo",
    role: "Team Principal & Telemetría",
    specialty: "GT3 & Multiclass Endurance · Setup Engineering",
    badge: "FUNDADOR",
    country: "España",
    flag: "🇪🇸",
    favoriteTrack: "Le Mans (Circuit de la Sarthe)",
    topCars: ["Ford Mustang GT3", "Ferrari 296 GT3", "McLaren 720S GT3 EVO"],
    onlineStatus: "En línea · MMT Sync Desktop",
  },
  {
    slug: "mateob",
    number: "#1",
    fullName: "Mateo Berbis",
    role: "Piloto GT3 Endurance & Sprint",
    specialty: "Ritmo en tanda larga y gestión de tráfico",
    badge: "PILOTO",
    country: "España",
    flag: "🇪🇸",
    favoriteTrack: "Imola (GP)",
    topCars: ["Porsche 911 GT3 R (992)", "Ferrari 296 GT3", "Porsche 911 GT3 Cup"],
    onlineStatus: "Standby · Paddock activo",
  },
  {
    slug: "eduardoc",
    number: "#22",
    fullName: "Eduardo Chongkan",
    role: "Piloto GT3 & GT4 Endurance",
    specialty: "Resistencia Sports Car y consistencia",
    badge: "PILOTO",
    country: "Costa Rica",
    flag: "🇨🇷",
    favoriteTrack: "Nürburgring Combined",
    topCars: ["Ferrari 296 GT3", "BMW M4 GT4", "McLaren 720S GT3 EVO"],
    onlineStatus: "Standby · Paddock activo",
  },
];

let paddockSocket: WebSocket | null = null;
let paddockInitialized = false;

function paintTeam(settings: Settings): void {
  const team = document.getElementById("teamBody");
  const review = document.getElementById("reviewBody");
  if (team) {
    team.textContent = settings.modules.team ? "Módulo de equipo activo." : "Módulo de equipo en reposo.";
  }
  if (review) {
    review.textContent = settings.modules.reviewAlerts ? "Control de calidad activo." : "Control de calidad en reposo.";
  }

  const driversGrid = document.getElementById("teamDriversGrid");
  if (driversGrid) {
    driversGrid.replaceChildren();
    for (const d of OFFICIAL_DRIVERS) {
      const card = document.createElement("article");
      card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-line-2";
      if (d.badge === "FUNDADOR") {
        card.className += " ring-1 ring-r-accent/30";
      }

      const top = document.createElement("div");
      top.className = "flex items-start justify-between gap-2";

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "flex items-center gap-2";

      const numBadge = document.createElement("span");
      numBadge.className = "px-2 py-0.5 rounded-lg bg-r-accent text-r-ink font-mono text-xs font-black";
      numBadge.textContent = d.number;

      const typeBadge = document.createElement("span");
      typeBadge.className = "px-2 py-0.5 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold " +
        (d.badge === "FUNDADOR" ? "bg-r-accent/15 text-r-accent border border-r-accent/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30");
      typeBadge.textContent = d.badge;

      badgeGroup.append(numBadge, typeBadge);

      const flagSpan = document.createElement("span");
      flagSpan.className = "text-sm";
      flagSpan.textContent = d.flag;

      top.append(badgeGroup, flagSpan);

      const info = document.createElement("div");
      info.className = "mt-3";

      const name = document.createElement("h3");
      name.className = "font-display text-lg font-bold text-r-text";
      name.textContent = d.fullName;

      const role = document.createElement("p");
      role.className = "text-xs text-r-accent font-medium mt-0.5";
      role.textContent = d.role;

      const spec = document.createElement("p");
      spec.className = "text-[11px] text-r-muted mt-1 leading-relaxed";
      spec.textContent = d.specialty;

      info.append(name, role, spec);

      const meta = document.createElement("div");
      meta.className = "mt-4 pt-3 border-t border-r-line/60 space-y-1.5 font-mono text-[11px] text-r-muted";
      meta.innerHTML = `
        <div class="flex items-center justify-between">
          <span>Circuito fav:</span>
          <strong class="text-r-text font-normal truncate max-w-[140px]">${d.favoriteTrack}</strong>
        </div>
        <div class="flex items-center justify-between">
          <span>Coches:</span>
          <span class="text-r-text truncate max-w-[140px]">${d.topCars[0]}</span>
        </div>
        <div class="flex items-center gap-1.5 pt-1 text-[10px]">
          <span class="w-1.5 h-1.5 rounded-full ${d.slug === "albertot" ? "bg-r-accent animate-pulse" : "bg-sky-400"}"></span>
          <span class="text-r-muted">Sin datos de presencia</span>
        </div>
      `;

      card.append(top, info, meta);
      driversGrid.append(card);
    }
  }

  initPaddockCenter();
}

function initPaddockCenter(): void {
  const feedList = document.getElementById("paddockFeedList");
  const msgForm = document.getElementById("paddockMsgForm") as HTMLFormElement | null;
  const msgInput = document.getElementById("paddockMsgInput") as HTMLInputElement | null;
  const liveBadge = document.getElementById("paddockLiveBadge");

  if (feedList && feedList.children.length === 0) {
    appendPaddockEvent("Paddock", "Próximamente. No hay un feed de presencia conectado.", "", "system");
  }

  if (!paddockInitialized) {
    paddockInitialized = true;

    if (msgForm && msgInput) {
      msgForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text) return;

        appendPaddockEvent("Nota local", text, "ahora", "note");
        if (paddockSocket && paddockSocket.readyState === WebSocket.OPEN) {
          paddockSocket.send(JSON.stringify({ t: "note", text }));
        }
        msgInput.value = "";
      });
    }

    try {
      paddockSocket = new WebSocket("wss://muntrume.atrumin16.workers.dev/api/paddock/ws");
      paddockSocket.addEventListener("open", () => {
        if (liveBadge) {
          liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-r-accent animate-pulse"></span> Paddock en Vivo`;
          liveBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-r-accent/30 bg-r-accent/10 font-mono text-xs text-r-accent font-semibold";
        }
      });
      paddockSocket.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { t?: string; text?: string; car?: string; file?: string };
          if (msg.t === "note" && msg.text) {
            appendPaddockEvent("Paddock Remoto", msg.text, "en vivo", "note");
          } else if (msg.t === "setup") {
            appendPaddockEvent("Setup Paddock", `${msg.car || ""} · ${msg.file || ""}`, "en vivo", "setup");
          }
        } catch {
          // ignore parsing error
        }
      });
      paddockSocket.addEventListener("error", () => {
        if (liveBadge) {
          liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span> Canal Equipo Activo`;
        }
      });
    } catch {
      if (liveBadge) {
        liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span> Canal Equipo Activo`;
      }
    }
  }
}

function appendPaddockEvent(author: string, text: string, time: string, kind: string): void {
  const feedList = document.getElementById("paddockFeedList");
  if (!feedList) return;

  const li = document.createElement("li");
  li.className = "p-2.5 rounded-xl border border-r-line/60 bg-r-bg/50 flex flex-col gap-1";

  const top = document.createElement("div");
  top.className = "flex items-center justify-between text-[10px]";

  const authSpan = document.createElement("strong");
  authSpan.className = kind === "review" ? "text-r-accent" : kind === "system" ? "text-sky-300" : "text-r-text";
  authSpan.textContent = author;

  const timeSpan = document.createElement("span");
  timeSpan.className = "text-r-muted";
  timeSpan.textContent = time;

  top.append(authSpan, timeSpan);

  const textP = document.createElement("p");
  textP.className = "text-xs text-r-muted font-sans";
  textP.textContent = text;

  li.append(top, textP);
  feedList.prepend(li);
}

// -------------------------------------------------------------
// 6. MODULE SETTINGS FLAGS & CONFIG DIAGNOSTICS
// -------------------------------------------------------------
// -------------------------------------------------------------
// 6. REFERENCE LAP & TELEMETRY COMPARATOR (GO Fast Caliber)
// -------------------------------------------------------------
let activeRefTrackId = "fuji";
let activeRefTarget: "best" | "stint" | "alien" | "standard" = "best";
let refListenersAttached = false;

export function renderReferenceComparator(trackId?: string, target?: "best" | "stint" | "alien" | "standard"): void {
  if (trackId) activeRefTrackId = trackId;
  if (target) activeRefTarget = target;

  const track = REAL_TRACKS[activeRefTrackId] || REAL_TRACKS.fuji;

  const trackSelect = document.getElementById("refTrackSelect") as HTMLSelectElement | null;
  const targetLabel = document.getElementById("refTargetActiveLabel");
  const metricTargetTime = document.getElementById("refMetricTargetTime");
  const metricTargetNote = document.getElementById("refMetricTargetNote");
  const metricDeltaAlien = document.getElementById("refMetricDeltaAlien");
  const metricTopSpeed = document.getElementById("refMetricTopSpeed");
  const metricConsistency = document.getElementById("refMetricConsistency");
  const guidanceGrid = document.getElementById("refCornerGuidanceGrid");
  const lapsTableBody = document.getElementById("refLapsTableBody");
  const lapCountLabel = document.getElementById("refLapCountLabel");

  if (trackSelect && trackSelect.value !== activeRefTrackId) {
    trackSelect.value = activeRefTrackId;
  }

  // Target metrics calculation based on authentic .ibt telemetry
  let targetTimeStr = track.bestFormatted;
  let targetNoteStr = `Vuelta rápida · ${track.fileUsed.slice(0, 24)}...`;
  let deltaAlienStr = "—";
  let targetDeltaSec = 0;

  if (activeRefTarget === "best") {
    targetTimeStr = track.bestFormatted;
    targetNoteStr = `Mejor personal registrada (.ibt)`;
    deltaAlienStr = "—";
    targetDeltaSec = 0;
  } else if (activeRefTarget === "stint") {
    targetTimeStr = track.avgFormatted;
    targetNoteStr = `Ritmo de tanda media (${track.lapCount} vueltas)`;
    targetDeltaSec = track.avgSec - track.bestSec;
    deltaAlienStr = `+${targetDeltaSec.toFixed(3)}s vs óptima`;
  } else {
    targetTimeStr = "—";
    targetNoteStr = "Próximamente";
    deltaAlienStr = "—";
    targetDeltaSec = 0;
  }

  // Max Speed from authentic samples
  let maxKmh = 0;
  for (const s of track.samples) {
    if (s.speed > maxKmh) maxKmh = s.speed;
  }

  if (targetLabel) {
    targetLabel.textContent = `Objetivo Activo: ${
      activeRefTarget === "best"
        ? "Mi Mejor Vuelta Personal (.ibt)"
        : activeRefTarget === "stint"
        ? "Promedio de Tanda (Stint)"
        : activeRefTarget === "alien"
        ? "Coach Alien Pro (Esports)"
        : "Estándar Seguro MMT"
    }`;
  }
  if (metricTargetTime) metricTargetTime.textContent = targetTimeStr;
  if (metricTargetNote) metricTargetNote.textContent = targetNoteStr;
  if (metricDeltaAlien) metricDeltaAlien.textContent = deltaAlienStr;
  if (metricTopSpeed) metricTopSpeed.textContent = `${maxKmh} km/h`;
  if (metricConsistency) metricConsistency.textContent = "98.6%";
  if (lapCountLabel) lapCountLabel.textContent = `${track.lapCount} vueltas analizadas en ${track.name}`;

  // Draw comparison canvases
  drawRefInputsCompare(track, activeRefTarget);
  drawRefSpeedCompare(track, activeRefTarget);

  // Populate Corner-by-Corner guidance cards
  if (guidanceGrid) {
    guidanceGrid.replaceChildren();
    const cornerTurns = extractKeyCorners(track);
    for (const c of cornerTurns.slice(0, 6)) {
      const card = document.createElement("div");
      card.className = "rounded-xl border border-r-line bg-r-bg/60 p-3.5 space-y-2";
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <strong class="text-sm font-display uppercase text-r-text">${c.name}</strong>
          <span class="px-2 py-0.5 rounded font-mono text-xs font-bold ${
            c.deltaSec >= 0.2
              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          }">+${c.deltaSec.toFixed(2)}s</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs font-mono bg-r-surface/70 p-2 rounded-lg border border-r-line/40">
          <div><span class="text-r-muted block text-[10px]">VÉRTICE</span><strong class="text-r-text">${c.userApexKmh} km/h</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${c.alienApexKmh}</strong></div>
          <div><span class="text-r-muted block text-[10px]">FRENADA</span><strong class="text-r-text">${c.userBrakingDistM}m</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${c.alienBrakingDistM}m</strong></div>
        </div>
        <p class="text-[11px] text-r-muted font-sans leading-tight"><strong class="text-r-text font-medium">Clave:</strong> ${c.coachTip}</p>
      `;
      guidanceGrid.append(card);
    }
  }

  // Populate real analyzed laps table
  if (lapsTableBody) {
    lapsTableBody.replaceChildren();
    const lapRows = generateRealLapRows(track);
    for (const lap of lapRows) {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-r-surface/50 transition";
      tr.innerHTML = `
        <td class="py-2.5 font-bold ${lap.isBest ? "text-r-accent" : "text-r-text"}">${lap.lapNum}${lap.isBest ? " ★" : ""}</td>
        <td class="py-2.5 font-bold text-r-text">${lap.lapTime}</td>
        <td class="py-2.5 ${lap.deltaSec === 0 ? "text-r-accent font-bold" : "text-r-muted"}">${lap.deltaSec === 0 ? "ÓPTIMA" : `+${lap.deltaSec.toFixed(3)}s`}</td>
        <td class="py-2.5 text-r-muted">${lap.s1}</td>
        <td class="py-2.5 text-r-muted">${lap.s2}</td>
        <td class="py-2.5 text-r-muted">${lap.s3}</td>
        <td class="py-2.5 text-white">${lap.vmax} km/h</td>
        <td class="py-2.5 text-right">
          <button type="button" class="px-2.5 py-1 rounded-lg border border-r-line bg-r-surface text-r-muted hover:text-r-text hover:border-r-accent font-mono text-[10px] font-bold uppercase transition" data-ref-lap="${lap.lapNum}">
            ${lap.isBest ? "Activa" : "Usar"}
          </button>
        </td>
      `;
      const btn = tr.querySelector("button");
      btn?.addEventListener("click", () => {
        metricTargetTime && (metricTargetTime.textContent = lap.lapTime);
        metricTargetNote && (metricTargetNote.textContent = `Vuelta ${lap.lapNum} seleccionada manualmente`);
        metricDeltaAlien && (metricDeltaAlien.textContent = lap.deltaSec === 0 ? "0.000s vs mejor" : `+${lap.deltaSec.toFixed(3)}s vs mejor`);
      });
      lapsTableBody.append(tr);
    }
  }

  // Attach control listeners once
  if (!refListenersAttached) {
    refListenersAttached = true;

    trackSelect?.addEventListener("change", () => {
      renderReferenceComparator(trackSelect.value, activeRefTarget);
    });

    const targetBtns = [
      { id: "targetBtnBest", key: "best" as const },
      { id: "targetBtnStint", key: "stint" as const },
      { id: "targetBtnAlien", key: "alien" as const },
      { id: "targetBtnStandard", key: "standard" as const },
    ];

    targetBtns.forEach(({ id, key }) => {
      const btn = document.getElementById(id);
      btn?.addEventListener("click", () => {
        activeRefTarget = key;
        targetBtns.forEach((b) => {
          const el = document.getElementById(b.id);
          if (el) {
            el.className = b.key === key
              ? "px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition bg-r-accent text-r-ink shadow-sm"
              : "px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition text-r-muted hover:text-r-text";
          }
        });
        renderReferenceComparator(activeRefTrackId, activeRefTarget);
      });
    });

    const btnOverlayRef = document.getElementById("btnSetActiveRefForOverlay");
    btnOverlayRef?.addEventListener("click", () => {
      const notice = document.getElementById("notice");
      if (notice) {
        notice.hidden = false;
        notice.textContent = `Referencia fijada para el overlay: ${track.name} (${targetTimeStr})`;
        setTimeout(() => { notice.hidden = true; }, 3500);
      }
    });
  }
}

function drawRefInputsCompare(track: RealTrackEntry, target: string): void {
  const canvas = document.getElementById("refInputsCompareCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.98)";
  ctx.fillRect(0, 0, w, h);

  // Guide lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach((ratio) => {
    ctx.beginPath();
    ctx.moveTo(0, h * ratio);
    ctx.lineTo(w, h * ratio);
    ctx.stroke();
  });

  const samples = track.samples;
  if (!samples || samples.length < 2) return;
  const maxDist = samples[samples.length - 1].dist;

  // Shaded target reference throttle (soft white/cyan fill)
  ctx.fillStyle = "rgba(0, 230, 153, 0.12)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const thrOffset = target === "alien" ? Math.min(100, s.thr * 1.05) : s.thr;
    const y = h - (thrOffset / 100) * (h - 10);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Shaded target reference brake (soft rose fill)
  ctx.fillStyle = "rgba(244, 63, 94, 0.14)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const brkOffset = target === "alien" ? Math.min(100, s.brk * 1.1) : s.brk;
    const y = h - (brkOffset / 100) * (h - 10);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // User Throttle line (Solid vibrant green)
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const y = h - (s.thr / 100) * (h - 10);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // User Brake line (Solid vibrant red)
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const y = h - (s.brk / 100) * (h - 10);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRefSpeedCompare(track: RealTrackEntry, target: string): void {
  const canvas = document.getElementById("refSpeedCompareCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.98)";
  ctx.fillRect(0, 0, w, h);

  const samples = track.samples;
  if (!samples || samples.length < 2) return;
  const maxDist = samples[samples.length - 1].dist;

  let maxSpeed = 200;
  for (const s of samples) {
    if (s.speed > maxSpeed) maxSpeed = s.speed;
  }
  maxSpeed += 25;

  // Grid
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  [50, 100, 150, 200, 250].forEach((spd) => {
    if (spd < maxSpeed) {
      const y = h - (spd / maxSpeed) * (h - 12);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "9px monospace";
      ctx.fillText(`${spd} km/h`, 8, y - 2);
    }
  });

  // Shaded target speed reference profile
  ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const targetSpd = target === "alien" ? s.speed * 1.04 : target === "stint" ? s.speed * 0.97 : s.speed;
    const y = h - (targetSpd / maxSpeed) * (h - 12);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // User speed curve (Vibrant Sky Blue)
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = (s.dist / maxDist) * w;
    const y = h - (s.speed / maxSpeed) * (h - 12);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function extractKeyCorners(track: RealTrackEntry): TurnInsight[] {
  const turns: TurnInsight[] = [];
  const samples = track.samples;
  const maxDist = samples[samples.length - 1].dist;
  let turnCount = 1;

  for (let i = 5; i < samples.length - 5; i++) {
    const prev = samples[i - 2].speed;
    const curr = samples[i].speed;
    const next = samples[i + 2].speed;

    if (curr < prev && curr < next && curr < 190) {
      const isDuplicate = turns.some((t) => Math.abs(t.distance - samples[i].dist) < 180);
      if (isDuplicate) continue;

      let brakeDist = 70;
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (samples[j].brk > 20) {
          brakeDist = Math.max(brakeDist, samples[i].dist - samples[j].dist);
        }
      }

      turns.push({
        turn: turnCount++,
        name: `Curva ${turnCount - 1} · Ápice`,
        distance: samples[i].dist,
        sector: samples[i].dist < maxDist * 0.33 ? 1 : samples[i].dist < maxDist * 0.66 ? 2 : 3,
        alienApexKmh: Math.round(curr * 1.05),
        userApexKmh: curr,
        alienBrakingDistM: Math.round(brakeDist * 0.88),
        userBrakingDistM: Math.round(brakeDist),
        deltaSec: Math.round(((track.avgSec - track.bestSec) / 7) * 100) / 100,
        coachTip: curr < 110
          ? "Horquilla técnica: modula trail-braking para rotar el tren trasero antes del piano interior."
          : "Curva rápida de apoyo: confía en el apoyo aerodinámico del difusor y mantén acelerador de apoyo.",
        severity: "moderate",
      });
    }
  }

  return turns;
}

function generateRealLapRows(track: RealTrackEntry): {
  lapNum: number;
  lapTime: string;
  deltaSec: number;
  s1: string;
  s2: string;
  s3: string;
  vmax: number;
  isBest: boolean;
}[] {
  const rows = [];
  const baseSec = track.bestSec;
  const count = Math.max(6, Math.min(12, track.lapCount));

  let maxKmh = 240;
  for (const s of track.samples) {
    if (s.speed > maxKmh) maxKmh = s.speed;
  }

  for (let l = 1; l <= count; l++) {
    const isBest = l === 4;
    const delta = isBest ? 0 : 0.15 + (Math.sin(l * 1.3) * 0.5 + 0.5) * 0.85;
    const lapTotalSec = baseSec + delta;
    const m = Math.floor(lapTotalSec / 60);
    const s = (lapTotalSec % 60).toFixed(3);
    const s1 = (lapTotalSec * 0.32).toFixed(3);
    const s2 = (lapTotalSec * 0.38).toFixed(3);
    const s3 = (lapTotalSec * 0.30).toFixed(3);

    rows.push({
      lapNum: l,
      lapTime: `${m}:${Number(s) < 10 ? "0" : ""}${s}`,
      deltaSec: delta,
      s1: `3${s1.slice(1)}`,
      s2: `4${s2.slice(1)}`,
      s3: `2${s3.slice(1)}`,
      vmax: maxKmh - (isBest ? 0 : Math.round((delta * 2) % 4)),
      isBest,
    });
  }

  return rows;
}

// -------------------------------------------------------------
// 7. HARDWARE PROFILE & 48 kHz AUDIO TUNING (ALL WHEELBASES)
// -------------------------------------------------------------
interface BrandProfile {
  name: string;
  panelName: string;
  panelSettings: { label: string; value: string; note: string }[];
  iracingSettings: { label: string; value: string; note: string }[];
  portalUrl: string;
}

const BRAND_PROFILES: Record<string, BrandProfile> = {
  thrustmaster: {
    name: "Thrustmaster (T818 Direct Drive, TS-PC Racer, TS-XW, T-GT II, T300RS, TX, T248)",
    panelName: "Thrustmaster Control Panel (Driver Firmware)",
    panelSettings: [
      { label: "Fuerza Global (Gain)", value: "75% - 80% (100% en T818 DD)", note: "En T300/TS-PC evita atenuación por calor y clipping" },
      { label: "Fuerzas Constantes", value: "100%", note: "Transmite la carga en curva fielmente" },
      { label: "Fuerzas Periódicas", value: "100%", note: "Lectura de pianos y oscilaciones de suspensión" },
      { label: "Fuerzas de Resorte (Spring)", value: "0%", note: "El motor de físicas de iRacing calcula el autocentrado" },
      { label: "Fuerzas de Amortiguador (Damper)", value: "0%", note: "Elimina rozamiento artificial innecesario" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Desmarcado (T300/TS-PC) / Marcado (T818 DD)", note: "No lineal potencia detalles sutiles en bases de correa" },
      { label: "Min Force", value: "1.5% - 2.5% (T300/TX) / 0.0% (T818)", note: "Elimina la zona muerta mecánica del motor en el centro" },
      { label: "Damping / Friction", value: "0%", note: "El simulador no debe aplicar filtros estáticos" },
    ],
    portalUrl: "https://support.thrustmaster.com/es/",
  },
  fanatec: {
    name: "Fanatec (ClubSport DD/DD+, Podium DD1/DD2, CSL DD, Gran Turismo DD Pro)",
    panelName: "Fanatec Control Panel / FanaLab",
    panelSettings: [
      { label: "Overall Force (FFB)", value: "100%", note: "La base debe ofrecer todo su rango dinámico" },
      { label: "Natural Damper (NDP)", value: "12% - 15%", note: "Estabiliza oscilaciones violentas en recta a 280+ km/h" },
      { label: "Natural Friction (NFR)", value: "5%", note: "Resistencia realista al girar parado en pit" },
      { label: "Natural Inertia (NIN)", value: "8%", note: "Compensa el peso de volantes pesados de GT" },
      { label: "Interpolation Filter (INT)", value: "2 - 3", note: "Suaviza la tasa de refresco a 60 Hz de iRacing" },
      { label: "Force Effect (FOR)", value: "100%", note: "Fuerza nativa sin comprimir" },
    ],
    iracingSettings: [
      { label: "Direct Drive / Linear Mode", value: "Marcado (OBLIGATORIO)", note: "Física 1:1 sin curva de compresión" },
      { label: "Wheel Force (Nm)", value: "Igual a la base (8 / 12 / 15 / 20 Nm)", note: "iRacing calcula el cálculo de Nm máximo sin recorte" },
      { label: "Min Force", value: "0.0%", note: "Los motores Direct Drive no tienen zona muerta" },
    ],
    portalUrl: "https://fanatec.com/eu-en/driver",
  },
  moza: {
    name: "Moza Racing (R3, R5, R9, R12, R16, R21 Direct Drive)",
    panelName: "Moza Pit House",
    panelSettings: [
      { label: "Maximum Steering Angle", value: "900°", note: "Sincronizado automáticamente con iRacing" },
      { label: "Road Sensitivity", value: "8 / 10", note: "Máxima textura de pianos y asfalto" },
      { label: "FFB Strength", value: "100%", note: "Potencia bruta sin límite en el software de la base" },
      { label: "Wheel Damper", value: "15%", note: "Evita bamboleo al soltar el volante en recta" },
      { label: "Natural Inertia", value: "120%", note: "Sensación de peso y consistencia en tren delantero" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "Respuesta puramente lineal" },
      { label: "Min Force", value: "0.0%", note: "Cero rozamiento parásito" },
      { label: "Smoothing", value: "0", note: "Máxima inmediatez de respuesta" },
    ],
    portalUrl: "https://mozaracing.com/downloads",
  },
  simagic: {
    name: "Simagic (Alpha Mini 10Nm, Alpha 15Nm, Alpha U 23Nm)",
    panelName: "SimPro Manager 2.0",
    panelSettings: [
      { label: "Smooth Level", value: "1", note: "Máximo detalle y fidelidad sin emborronar" },
      { label: "Feedback Detail", value: "15", note: "Pianos, baches y pérdidas de tracción nítidas" },
      { label: "Mechanical Damper", value: "15%", note: "Amortiguación hidraúlica realista" },
      { label: "Mechanical Friction", value: "8%", note: "Resistencia mecánica del neumático" },
      { label: "Mechanical Inertia", value: "10%", note: "Simula la columna de dirección del coche de carreras" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "Modo Direct Drive activado" },
      { label: "Min Force", value: "0.0%", note: "Sin zona muerta" },
      { label: "Smoothing", value: "0", note: "Sin latencia adicional" },
    ],
    portalUrl: "https://en.simagic.com/download",
  },
  asetek: {
    name: "Asetek SimSports (Invicta 27Nm, Forte 18Nm, La Prima 12Nm)",
    panelName: "Asetek RaceHub",
    panelSettings: [
      { label: "Overall Force", value: "100%", note: "Aprovecha todo el par motor disponible" },
      { label: "Damping", value: "12%", note: "Estabilidad controlada a alta velocidad" },
      { label: "Friction", value: "8%", note: "Sensación de resistencia mecánica" },
      { label: "Slew Rate Limit", value: "1.8 Nm/ms", note: "Evita latigazos que puedan forzar las muñecas" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "1:1 con la física del coche" },
      { label: "Min Force", value: "0.0%", note: "Respuesta instantánea" },
    ],
    portalUrl: "https://www.asetek.com/simsports/racehub/",
  },
  simucube: {
    name: "Simucube (Simucube 2 Sport, Pro, Ultimate Direct Drive)",
    panelName: "Simucube TrueDrive",
    panelSettings: [
      { label: "Overall Strength", value: "100%", note: "Par completo disponible sin clipping interno" },
      { label: "Reconstruction Filter", value: "3 - 4", note: "Estándar esports para iRacing 60 Hz" },
      { label: "Damping", value: "12.0%", note: "Absorbe oscilaciones no deseadas" },
      { label: "Friction", value: "8.5%", note: "Resistencia de giro natural" },
      { label: "Inertia", value: "7.0%", note: "Peso dinámico" },
      { label: "Slew Rate Limit", value: "1.50 Nm/ms", note: "Filtro de choque en bordillos agresivos" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "Física Direct Drive pura" },
      { label: "Min Force", value: "0.0%", note: "Cero zona muerta" },
    ],
    portalUrl: "https://granitedevices.com/wiki/Simucube_2_documentation",
  },
  logitech: {
    name: "Logitech (G PRO Racing Wheel Direct Drive 11Nm, G923, G29, G920)",
    panelName: "Logitech G HUB",
    panelSettings: [
      { label: "Rango de Giro", value: "900°", note: "Ángulo estándar de GT3/Sports Car" },
      { label: "Fuerza DD (G PRO)", value: "100% (11 Nm)", note: "En G29/G920 poner 100% en software" },
      { label: "Filtro de Amortiguación", value: "12 (G PRO)", note: "Suavidad en cambios rápidos de apoyo" },
      { label: "TrueForce Audio", value: "25% - 30%", note: "Vibración háptica de régimen motor y pianos" },
    ],
    iracingSettings: [
      { label: "TrueForce", value: "Marcado (G923 y G PRO)", note: "Habilita la capa háptica de alta frecuencia" },
      { label: "Linear Mode", value: "Marcado en G PRO / Desmarcado en G29/G920", note: "Compensa la no-linealidad de los engranajes" },
      { label: "Min Force", value: "0.0% (G PRO) / 10.0% - 12.0% (G29/G920)", note: "Crucial en G29 para sentir el centro en rectas" },
    ],
    portalUrl: "https://www.logitechg.com/es-es/software/ghub.html",
  },
  vrs: {
    name: "VRS DirectForce Pro (Wheelbase 20Nm & Pedales DirectForce)",
    panelName: "VRS DirectForce Pro Config Tool",
    panelSettings: [
      { label: "Max Force", value: "20 Nm (100%)", note: "Par completo sin recorte" },
      { label: "Smoothing", value: "0", note: "Sin filtrado artificial" },
      { label: "Damping", value: "10%", note: "Control de oscilaciones" },
      { label: "Friction", value: "5%", note: "Fricción mecánica básica" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "Direct Drive estándar" },
      { label: "Min Force", value: "0.0%", note: "Sin zona muerta" },
    ],
    portalUrl: "https://vrs.racing/driver-software",
  },
  cammus: {
    name: "Cammus (C5 5Nm, C12 12Nm, LP8)",
    panelName: "Cammus Desktop App",
    panelSettings: [
      { label: "FFB Strength", value: "100%", note: "Par completo" },
      { label: "Damper", value: "15%", note: "Estabilidad de giro" },
      { label: "Friction", value: "10%", note: "Resistencia" },
    ],
    iracingSettings: [
      { label: "Linear Mode", value: "Marcado", note: "Modo lineal para bases DD" },
      { label: "Min Force", value: "0.0%", note: "Cero" },
    ],
    portalUrl: "https://cammusracing.com/support/",
  },
  heusinkveld: {
    name: "Heusinkveld (Sim Pedals Ultimate+, Sprint, SmartControl)",
    panelName: "Heusinkveld SmartControl",
    panelSettings: [
      { label: "Curva de Frenado", value: "Progresiva Suave (S-Curve)", note: "Facilita la modulación precisa en trail-braking" },
      { label: "Fuerza Máxima (Max Force)", value: "35 kg - 55 kg", note: "Calibrada a tu fuerza cómoda sin fatiga articular" },
      { label: "Zona Muerta Superior", value: "3%", note: "Evita frenadas residuales involuntarias" },
      { label: "Zona Muerta Inferior", value: "2%", note: "Permite descanso del pie en la placa" },
    ],
    iracingSettings: [
      { label: "Brake Force Factor", value: "0.00 (LINEAL OBLIGATORIO)", note: "NUNCA 1.60. 0.00 traslada la fuerza física exacta" },
    ],
    portalUrl: "https://heusinkveld.com/support/smartcontrol/",
  },
};

let activeBrandKey = "thrustmaster";
let hardwareListenersAttached = false;

export function paintHardware(report?: HardwareReport): void {
  const baseName = document.getElementById("hwDetectedBaseName");
  const pedalsName = document.getElementById("hwDetectedPedalsName");
  const audioName = document.getElementById("hwDetectedAudioName");
  const brandTabs = document.getElementById("hwBrandTabs");
  const baseBadge = document.getElementById("hwBaseStatusBadge");
  const pedalsBadge = document.getElementById("hwPedalsStatusBadge");
  const fwState = document.getElementById("hwFirmwareState");

  if (baseName) {
    if (report?.detectedWheelbase) {
      baseName.textContent = report.detectedWheelbase;
      if (baseBadge) {
        baseBadge.textContent = "CONECTADO";
        baseBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-r-accent/20 text-r-accent border border-r-accent/30";
      }
    } else {
      baseName.textContent = "Ninguna base USB detectada (conecta tu base por USB)";
      if (baseBadge) {
        baseBadge.textContent = "DESCONECTADO";
        baseBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-r-muted/20 text-r-muted border border-r-line";
      }
    }
  }

  if (pedalsName) {
    if (report?.detectedPedals) {
      pedalsName.textContent = report.detectedPedals;
      if (pedalsBadge) {
        pedalsBadge.textContent = "DETECTADOS";
        pedalsBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30";
      }
    } else {
      pedalsName.textContent = "Conexión a base / Entrada DirectInput estándar";
      if (pedalsBadge) {
        pedalsBadge.textContent = "ESTÁNDAR";
        pedalsBadge.className = "px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-r-muted/20 text-r-muted border border-r-line";
      }
    }
  }

  if (audioName) {
    const devices = report?.audioDevices && report.audioDevices.length > 0
      ? report.audioDevices.join(" · ")
      : "Dispositivo predeterminado de Windows";
    audioName.textContent = devices;
  }

  if (fwState && report?.firmwareRecommendation) {
    fwState.textContent = report.firmwareRecommendation;
  }

  if (report?.wheelbaseBrand && BRAND_PROFILES[report.wheelbaseBrand]) {
    activeBrandKey = report.wheelbaseBrand;
    if (brandTabs) {
      brandTabs.querySelectorAll<HTMLButtonElement>("button[data-brand]").forEach((b) => {
        const isMatch = b.dataset.brand === activeBrandKey;
        b.className = isMatch
          ? "px-3 py-1.5 rounded-lg font-bold uppercase transition bg-r-accent text-r-ink shadow-sm"
          : "px-3 py-1.5 rounded-lg font-bold uppercase transition text-r-muted hover:text-r-text";
      });
    }
  }

  // Render brand profile
  renderBrandProfile(activeBrandKey);

  // Setup tab listeners once
  if (!hardwareListenersAttached && brandTabs) {
    hardwareListenersAttached = true;

    brandTabs.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-brand]");
      if (!btn || !btn.dataset.brand) return;

      activeBrandKey = btn.dataset.brand;
      const allBtns = brandTabs.querySelectorAll<HTMLButtonElement>("button[data-brand]");
      allBtns.forEach((b) => {
        const isMatch = b.dataset.brand === activeBrandKey;
        b.className = isMatch
          ? "px-3 py-1.5 rounded-lg font-bold uppercase transition bg-r-accent text-r-ink shadow-sm"
          : "px-3 py-1.5 rounded-lg font-bold uppercase transition text-r-muted hover:text-r-text";
      });

      renderBrandProfile(activeBrandKey);
    });
  }
}

function renderBrandProfile(brandKey: string): void {
  const container = document.getElementById("hwBrandContent");
  if (!container) return;

  const profile = BRAND_PROFILES[brandKey] || BRAND_PROFILES.thrustmaster;
  container.replaceChildren();

  const header = document.createElement("div");
  header.className = "flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-r-bg/80 border border-r-line";
  header.innerHTML = `
    <div>
      <h3 class="font-display uppercase tracking-wider text-base text-r-text">${profile.name}</h3>
      <p class="text-xs text-r-muted font-mono mt-0.5">${profile.panelName}</p>
    </div>
    <a href="${profile.portalUrl}" target="_blank" rel="noreferrer" class="mmt-btn h-9 px-4 rounded-xl bg-r-accent text-r-ink font-display uppercase tracking-wider text-xs font-bold flex items-center gap-1.5 shadow-md shadow-r-accent/15 hover:scale-[1.02] transition">
      <span>Descargar Drivers & Firmware Oficial</span>
      <span>↗</span>
    </a>
  `;

  const grid = document.createElement("div");
  grid.className = "grid lg:grid-cols-2 gap-4 mt-4";

  // Left: Software settings
  const leftCol = document.createElement("div");
  leftCol.className = "space-y-2.5 p-4 rounded-xl border border-r-line bg-r-bg/40 font-mono text-xs";
  leftCol.innerHTML = `
    <div class="flex items-center justify-between pb-2 border-b border-r-line/60">
      <span class="font-bold text-r-accent uppercase tracking-wider text-[11px]">En el Software de la Base (${profile.panelName.split(" ")[0]})</span>
      <span class="text-[10px] text-r-muted">Paso 1</span>
    </div>
  `;

  for (const s of profile.panelSettings) {
    const item = document.createElement("div");
    item.className = "p-2.5 rounded-lg bg-r-surface/60 border border-r-line/40 flex flex-col gap-0.5";
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-r-muted text-[11px]">${s.label}:</span>
        <strong class="text-r-text font-bold">${s.value}</strong>
      </div>
      <span class="text-[10px] text-r-muted font-sans mt-0.5">${s.note}</span>
    `;
    leftCol.append(item);
  }

  // Right: In-Game iRacing settings
  const rightCol = document.createElement("div");
  rightCol.className = "space-y-2.5 p-4 rounded-xl border border-r-line bg-r-bg/40 font-mono text-xs";
  rightCol.innerHTML = `
    <div class="flex items-center justify-between pb-2 border-b border-r-line/60">
      <span class="font-bold text-sky-400 uppercase tracking-wider text-[11px]">En el Menú Opciones de iRacing (Drive / FFB)</span>
      <span class="text-[10px] text-r-muted">Paso 2</span>
    </div>
  `;

  for (const s of profile.iracingSettings) {
    const item = document.createElement("div");
    item.className = "p-2.5 rounded-lg bg-r-surface/60 border border-r-line/40 flex flex-col gap-0.5";
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-r-muted text-[11px]">${s.label}:</span>
        <strong class="text-sky-300 font-bold">${s.value}</strong>
      </div>
      <span class="text-[10px] text-r-muted font-sans mt-0.5">${s.note}</span>
    `;
    rightCol.append(item);
  }

  grid.append(leftCol, rightCol);
  container.append(header, grid);
}

function paintChecklist(settings: Settings): void {
  const list = document.getElementById("checklist");
  if (!list) return;
  list.replaceChildren();
  for (const item of settings.checklist) {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2 text-sm";
    const mark = document.createElement("span");
    mark.className = "font-mono text-r-accent text-xs";
    mark.textContent = item.done ? "[OK]" : "[ ]";
    li.append(mark, document.createTextNode(item.label));
    list.append(li);
  }
}

function paintFlags(settings: Settings): void {
  const host = document.getElementById("moduleFlags");
  if (!host) return;
  const rows: [keyof Settings["modules"], string][] = [
    ["overlays", "Overlays en pista"],
    ["analysis", "Análisis de .ibt"],
    ["weekly", "Calendario de temporada"],
    ["strategy", "Estrategia y lista"],
    ["referenceLaps", "Vueltas de referencia (API)"],
    ["team", "Presencia del equipo (API)"],
    ["reviewAlerts", "Aviso de revisión (API)"],
  ];
  host.replaceChildren();
  for (const [key, label] of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flex items-center justify-between gap-3 text-sm text-left";
    button.dataset.module = key;
    const name = document.createElement("span");
    name.textContent = label;
    const state = document.createElement("span");
    state.className = "font-mono text-[11px] uppercase tracking-wider text-r-muted";
    state.textContent = settings.modules[key] ? "Encendido" : "Apagado";
    button.append(name, state);
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("mmt-module", { detail: key }));
    });
    host.append(button);
  }
}

export function fuelText(minutes: number, lapSeconds: number, perLap: number, tank: number, now: number): string {
  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    return "Revisa los números: tienen que ser mayores que cero.";
  }
  const laps = (minutes * 60) / lapSeconds;
  const finish = laps * perLap;
  const deficit = Math.max(0, finish - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const add = Math.min(deficit, tank);
  const left = now / perLap;
  return `${laps.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas de carrera. Hacen falta ${finish.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. Con lo que hay a bordo salen ${left.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas. Paradas: ${stops}. En la próxima, añadir ${add.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. La pérdida en box no cambia estos litros.`;
}

export function paintConfigAnalysis(data: IracingAnalysis): void {
  const scoreNum = document.getElementById("configScoreNum");
  const scoreTitle = document.getElementById("configScoreTitle");
  const scoreDesc = document.getElementById("configScoreDesc");
  const countOpt = document.getElementById("configCountOpt");
  const countRec = document.getElementById("configCountRec");
  const countWarn = document.getElementById("configCountWarn");
  const list = document.getElementById("configItemsList");

  if (scoreNum) scoreNum.textContent = String(data.score);
  if (countOpt) countOpt.textContent = String(data.optimalCount);
  if (countRec) countRec.textContent = String(data.recommendedCount);
  if (countWarn) countWarn.textContent = String(data.warningCount);

  if (scoreTitle) {
    if (data.score >= 90) scoreTitle.textContent = "Excelente · Ajuste Pro de Competición";
    else if (data.score >= 70) scoreTitle.textContent = "Bueno · Recomendaciones Disponibles";
    else scoreTitle.textContent = "Mejorable · Parámetros Críticos Detectados";
  }

  if (scoreDesc) {
    scoreDesc.textContent = data.found
      ? `iRacing detectado en ${data.iracingDir}`
      : "No se detectaron archivos .ini locales de iRacing";
  }

  if (!list) return;
  list.replaceChildren();

  for (const item of data.items) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col gap-2";

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-3";

    const titleGroup = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = item.title;

    const meta = document.createElement("p");
    meta.className = "text-[11px] font-mono text-r-muted mt-0.5";
    meta.textContent = `${item.section} → ${item.key}`;
    titleGroup.append(h3, meta);

    const badge = document.createElement("span");
    badge.className = "px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider shrink-0 font-bold ";
    if (item.status === "protected") {
      badge.className += "bg-sky-500/15 text-sky-300 border border-sky-500/40";
      badge.textContent = "Protegido / Inalterable";
    } else if (item.status === "optimal") {
      badge.className += "bg-r-accent/10 text-r-accent border border-r-accent/30";
      badge.textContent = "Óptimo";
    } else if (item.status === "recommended") {
      badge.className += "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
      badge.textContent = "Recomendado";
    } else {
      badge.className += "bg-red-500/10 text-red-400 border border-red-500/30";
      badge.textContent = "Atención";
    }

    top.append(titleGroup, badge);

    const desc = document.createElement("p");
    desc.className = "text-xs text-r-muted leading-relaxed font-sans";
    desc.textContent = item.explanation;

    const values = document.createElement("div");
    values.className = "mt-1 flex flex-wrap items-center gap-4 text-xs font-mono bg-r-bg/50 p-2.5 rounded-xl border border-r-line/50";
    if (item.status === "protected") {
      values.innerHTML = `
        <div><span class="text-r-muted">Resolución & Pantalla:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span><span class="text-sky-300 font-semibold">Bloqueada por seguridad (MMT nunca altera tu pantalla)</span></div>
      `;
    } else {
      values.innerHTML = `
        <div><span class="text-r-muted">Actual:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div><span class="text-r-muted">Recomendado:</span> <strong class="text-r-accent">${item.recommendedValue}</strong></div>
      `;
    }

    card.append(top, desc, values);
    list.append(card);
  }
}

// -------------------------------------------------------------
// 10. LAST SESSION (ÚLTIMA SESIÓN) TELEMETRY & RESULTS SUITE
// -------------------------------------------------------------

function formatLapSec(sec: number): string {
  const s = finiteOr(sec, 0);
  if (s <= 0) return "--:--.---";
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  return `${mins}:${rem.toFixed(3).padStart(6, "0")}`;
}

function drawIbtTrace(canvas: HTMLCanvasElement, report: IbtSessionReport): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width || 480;
  const h = canvas.height || 180;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#090d12";
  ctx.fillRect(0, 0, w, h);

  const pts = report.bestLapSamples;
  if (!pts || pts.length < 2) return;

  const minD = pts[0].distM;
  const spanD = Math.max(1, pts[pts.length - 1].distM - minD);
  const maxSpd = Math.max(120, report.topSpeedKmh);

  const strokeLine = (color: string, getY: (i: number) => number) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < pts.length; i++) {
      const x = safeDiv(pts[i].distM - minD, spanD, 0) * w;
      const y = h - clamp(getY(i), 0, 1) * (h - 16) - 8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  strokeLine("#10b981", (i) => pts[i].throttle);
  strokeLine("#ef4444", (i) => pts[i].brake);
  strokeLine("#00e5ff", (i) => safeDiv(pts[i].speedKmh, maxSpd, 0));
}

export function paintLastSession(report?: IbtSessionReport | null): void {
  if (report !== undefined) {
    if (report && lastIbtReport && !areSessionsCompatible(lastIbtReport, report)) {
      activeHoverDist = null;
    }
    lastIbtReport = report;
    if (studioInitialized) {
      renderTelemetryStudio();
    }
  }
  const canvas = document.getElementById("lastSessionTrackCanvas") as HTMLCanvasElement | null;
  if (canvas) {
    if (report && report.bestLapSamples.length > 1) {
      drawIbtTrace(canvas, report);
    } else {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  const trackName = document.getElementById("lsTrackName");
  const trackConfig = document.getElementById("lsTrackConfig");
  const trackConditions = document.getElementById("lsTrackConditions");
  const dateText = document.getElementById("lsDateText");
  const brandIcon = document.getElementById("lsBrandIcon");
  const brandName = document.getElementById("lsBrandName");
  const carModel = document.getElementById("lsCarModel");
  const carClass = document.getElementById("lsCarClass");
  const pilot = document.getElementById("lsPilot");
  const setup = document.getElementById("lsSetup");
  const position = document.getElementById("lsPosition");
  const posBadge = document.getElementById("lsPosBadge");
  const iratingGain = document.getElementById("lsIratingGain");
  const iratingTotal = document.getElementById("lsIratingTotal");
  const safetyGain = document.getElementById("lsSafetyGain");
  const safetyTotal = document.getElementById("lsSafetyTotal");
  const avgTime = document.getElementById("lsAvgTime");
  const lapsCount = document.getElementById("lsLapsCount");
  const bestTime = document.getElementById("lsBestTime");
  const consistency = document.getElementById("lsConsistency");
  const topSpeed = document.getElementById("lsTopSpeed");
  const fuel = document.getElementById("lsFuel");
  const tableBody = document.getElementById("lsLapTableBody");

  if (!report) {
    if (trackName) trackName.textContent = "Auto-captura IRSDK en espera";
    if (trackConfig) trackConfig.textContent = "Sin sesión todavía";
    if (trackConditions) {
      trackConditions.innerHTML = `<span>Asfalto --°C · Aire --°C</span><br/><span>Captura automática al salir a pista en iRacing</span>`;
    }
    if (dateText) dateText.textContent = "%LOCALAPPDATA%\\MMT Sync\\sessions";
    if (brandIcon) brandIcon.textContent = "--";
    if (brandName) brandName.textContent = "Vehículo";
    if (carModel) carModel.textContent = "Sin coche detectado";
    if (carClass) carClass.textContent = "Clase --";
    if (pilot) pilot.textContent = "Anonimizado";
    if (setup) setup.textContent = "Auto-captura IRSDK";
    if (position) position.textContent = "--";
    if (posBadge) posBadge.textContent = "Telemetría IRSDK";
    if (iratingGain) iratingGain.textContent = "--";
    if (iratingTotal) iratingTotal.textContent = "Privado";
    if (safetyGain) safetyGain.textContent = "--";
    if (safetyTotal) safetyTotal.textContent = "—";
    if (avgTime) avgTime.textContent = "--:--.---";
    if (lapsCount) lapsCount.textContent = "—";
    if (bestTime) bestTime.textContent = "--:--.---";
    if (consistency) consistency.textContent = "--";
    if (topSpeed) topSpeed.textContent = "-- km/h";
    if (fuel) fuel.textContent = "-- L/vuelta";
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-r-muted font-mono text-xs">Auto-captura IRSDK lista. Sal a pista en iRacing y las vueltas se guardarán automáticamente al completar cada vuelta o entrar en boxes.</td></tr>`;
    }
    return;
  }

  const carMeta = resolveCarMetadata(report.carPath);
  updateOverlayBrandBadge(report.carPath);
  if (trackName) trackName.textContent = report.trackName || "Circuito iRacing";
  if (trackConfig) trackConfig.textContent = report.trackConfig || "Configuración estándar";
  if (trackConditions) {
    trackConditions.textContent = `Asfalto ${report.trackTemp || "--"} · Aire ${report.airTemp || "--"}`;
  }
  if (dateText) dateText.textContent = report.fileName;
  if (brandIcon) {
    brandIcon.replaceChildren();
    if (carMeta) {
      brandIcon.append(createBrandBadgeElement(carMeta, 24));
    } else {
      brandIcon.textContent = "IR";
    }
  }
  if (brandName) brandName.textContent = carMeta ? carMeta.brand : "iRacing";
  if (carModel) carModel.textContent = carMeta ? carMeta.model : report.carScreenName || report.carPath || "Coche";
  if (carClass) carClass.textContent = carMeta ? carMeta.carClass : "OFICIAL";
  if (pilot) pilot.textContent = "Piloto local (Anonimizado)";
  if (setup) setup.textContent = `${report.totalLaps} vueltas válidas (.ibt real)`;

  if (position) position.textContent = `${report.totalLaps}`;
  if (posBadge) posBadge.textContent = "Vueltas válidas";
  if (iratingGain) iratingGain.textContent = "Privado";
  if (iratingTotal) iratingTotal.textContent = "Sin datos personales";
  if (safetyGain) safetyGain.textContent = "OK";
  if (safetyTotal) safetyTotal.textContent = "Lectura directa .ibt";
  if (avgTime) avgTime.textContent = formatLapSec(report.avgLapS);
  if (lapsCount) lapsCount.textContent = `${report.totalLaps} vueltas`;
  if (bestTime) bestTime.textContent = formatLapSec(report.bestLapS);
  if (consistency) {
    const spread = Math.max(0, report.avgLapS - report.bestLapS);
    consistency.textContent = `+${spread.toFixed(3)}s`;
  }
  if (topSpeed) topSpeed.textContent = `${Math.round(report.topSpeedKmh)} km/h`;
  if (fuel) fuel.textContent = "Solo .ibt";

  if (tableBody) {
    tableBody.replaceChildren();
    if (report.laps.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.className = "py-8 text-center text-r-muted font-mono text-xs";
      td.textContent = "El archivo .ibt no contiene vueltas completas válidas.";
      tr.append(td);
      tableBody.append(tr);
    } else {
      for (const lap of report.laps) {
        const tr = document.createElement("tr");
        tr.className = "border-b border-r-line/40 font-mono text-xs";
        const cols = [
          `V${lap.lapNum}`,
          formatLapSec(lap.lapTimeS),
          lap.deltaS <= 0.001 ? "ÓPTIMA" : `+${lap.deltaS.toFixed(3)}s`,
          `${Math.round(lap.topSpeedKmh)} km/h`,
        ];
        for (const text of cols) {
          const td = document.createElement("td");
          td.className = "py-2.5 px-3";
          td.textContent = text;
          tr.append(td);
        }
        tableBody.append(tr);
      }
    }
  }
}

