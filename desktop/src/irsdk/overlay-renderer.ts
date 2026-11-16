/**
 * MMT Sync — Kapps 2027 Style Overlay Renderers (Bloque 1 & 2)
 * High performance 60 FPS GPU-accelerated renderers, tabular numeric typography,
 * SVG local brand mappers, Driver Tags badges, Streamer Mode,
 * Radar 360°, Pitbox Helper, and DigiFlag.
 */

import type { IrsdkComputedState, LeaderboardEntry, RelativeEntry } from "./types";
import { getCarBrandSvg } from "./brand-helper";
import { SmartLayoutManager } from "./smart-layouts";
import { GpuPedalsEngine, type PedalsSample } from "./gpu-pedals";
import { Radar360Engine, type RadarInputState } from "./radar-360";
import { PitboxHelperEngine, type PitboxInputState } from "./pitbox-helper";
import { DigiFlagEngine } from "./digi-flag";
import { ThemeEngine } from "../theme/theme-engine";
import { estimateAllDriversIRatingDeltas, estimateLiveIRating, formatSofShort } from "./irating-calc";

const lastRenderedHtml = new WeakMap<HTMLElement, string>();
function setHtmlIfChanged(container: HTMLElement, html: string): void {
  if (lastRenderedHtml.get(container) === html) return;
  lastRenderedHtml.set(container, html);
  container.innerHTML = html;
}

function renderLicenseBadge(licString: string | undefined): string {
  const raw = (licString || "R 0.0").trim();
  const letter = raw.charAt(0).toUpperCase();
  const num = raw.slice(1).trim();
  const label = num ? `${letter} ${num}` : letter;
  const cls = ["A", "B", "C", "D", "R"].includes(letter) ? `mmt-lic-${letter}` : "mmt-lic-R";
  return `<span class="mmt-lic-pill ${cls}">${label}</span>`;
}

const gpuPedalsEngine = new GpuPedalsEngine();
const radar360Engine = new Radar360Engine();
const pitboxEngine = new PitboxHelperEngine();
const digiFlagEngine = new DigiFlagEngine();

/**
 * Renders the Relative Radar widget into target DOM container
 */
export function renderRelativeWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state || !state.relative || state.relative.entries.length === 0) {
    container.innerHTML = `
      <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
        <span class="text-r-muted">Radar Relativo</span>
        <span class="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/50 font-mono">EN ESPERA</span>
      </div>
      <div class="p-3 text-center text-xs text-white/50 font-mono">Esperando telemetría de iRacing...</div>
    `;
    return;
  }

  const { entries } = state.relative;
  const isReplay = state.isReplayPlaying;
  const isStreamer = SmartLayoutManager.getInstance().isStreamerMode();
  const cols = ThemeEngine.getInstance().getColumnsConfig().relative;
  const irEst = estimateLiveIRating(state);
  const posByCarIdx = new Map<number, number>();
  state.leaderboard.forEach((entry) => posByCarIdx.set(entry.carIdx, entry.position));

  const tTrack = state.frame.trackTempC;
  const trackTempStr = typeof tTrack === "number" && tTrack > 0 ? `${tTrack.toFixed(0)}°C` : "";
  const localClock = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const activeLap = Math.max(0, state.frame.carIdxLap[state.camCarIdx] || 0);
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remMin = Math.floor(remSec / 60);
  const remSecPart = String(remSec % 60).padStart(2, "0");
  const sessionClock = `${String(remMin).padStart(2, "0")}:${remSecPart}`;
  const sessType = (state.session.sessionType || "Practice").split(" ")[0];

  const headerHtml = `
    <div class="mmt-rel-header">
      <span>${irEst ? `SOF ${formatSofShort(irEst.sof)}` : "REL"}</span>
      <span>${trackTempStr ? `${trackTempStr} · ` : ""}${localClock}</span>
    </div>
  `;

  const selfIdx = entries.findIndex((e) => e.isActiveCam);
  const displayEntries = selfIdx >= 0
    ? entries.slice(Math.max(0, selfIdx - 3), selfIdx + 4)
    : entries.slice(0, 7);

  const rowsHtml = displayEntries
    .map((e: RelativeEntry, rowIdx: number) => {
      const isSelf = e.isActiveCam;
      const rowCls = `mmt-rel-row font-mono${isSelf ? " is-self" : rowIdx % 2 === 1 ? " is-alt" : ""}`;

      const gapClean = (e.deltaStr || "0.0").replace(/s$/i, "");
      const gapColor = isSelf
        ? "text-emerald-400 font-bold"
        : e.onPitRoad
        ? "text-amber-300 font-bold"
        : "text-white font-semibold";

      const pitBadge = cols.pitStatus && e.onPitRoad
        ? `<span class="px-1 rounded-[2px] text-[8px] font-bold bg-amber-500/25 text-amber-300">PIT</span>`
        : "";

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : (e.driverName || e.abbrevName);

      const relPos = posByCarIdx.get(e.carIdx) ?? 0;
      const classPosCell = `<span class="text-center text-[10px] font-bold" style="color:${e.carClassColor || "#38bdf8"}">${relPos > 0 ? relPos : "-"}</span>`;
      const numCell = cols.carNumber
        ? `<span class="text-center text-[10px] font-bold ${isSelf ? "text-emerald-400" : "text-white/85"}">#${e.carNumber}</span>`
        : `<span></span>`;
      const nameCell = cols.driverName
        ? `<span class="mmt-cell-name text-[11px] ${isSelf ? "text-white font-bold" : "text-white/90 font-semibold"}">${displayName}</span>`
        : `<span></span>`;
      const tagCell = `<span class="text-center">${pitBadge}</span>`;
      const licCell = cols.license
        ? `<span class="flex items-center justify-center">${renderLicenseBadge(e.licString)}</span>`
        : `<span></span>`;
      const deltaCell = cols.delta
        ? `<span class="text-right text-[11px] tabular-nums ${gapColor}">${gapClean}</span>`
        : `<span></span>`;

      return `
        <div class="${rowCls}" style="border-left-color: ${isSelf ? "#10b981" : (e.carClassColor || "#00e699")}">
          ${classPosCell}
          ${numCell}
          ${nameCell}
          ${tagCell}
          ${licCell}
          ${deltaCell}
        </div>
      `;
    })
    .join("");

  const footerHtml = `
    <div class="mmt-rel-footer">
      <span>Lap: <strong class="text-white">${activeLap}</strong></span>
      <span>${sessionClock}</span>
      <span>${isReplay ? "Replay" : sessType}</span>
    </div>
  `;

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="font-mono select-none overflow-hidden">
      ${rowsHtml}
    </div>
    ${footerHtml}
  `);
}

export type CompactStandingsRow =
  | { kind: "entry"; entry: LeaderboardEntry; rankIdx: number }
  | { kind: "separator" };

/**
 * Compact Standings window: Top 3 fixed + subtle divider + ±3 around CamCarIdx (max 11 rows total).
 */
export function buildCompactStandingsWindow(leaderboard: LeaderboardEntry[]): CompactStandingsRow[] {
  if (!leaderboard || leaderboard.length === 0) return [];
  if (leaderboard.length <= 10) {
    return leaderboard.map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));
  }

  const selfIdx = leaderboard.findIndex((e) => e.isActiveCam);
  if (selfIdx <= 6) {
    return leaderboard.slice(0, 10).map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));
  }

  const rows: CompactStandingsRow[] = leaderboard
    .slice(0, 3)
    .map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));

  const winStart = Math.max(3, selfIdx - 3);
  const winEnd = Math.min(leaderboard.length, selfIdx + 4);
  if (winStart > 3) {
    rows.push({ kind: "separator" });
  }
  for (let i = winStart; i < winEnd && rows.length < 11; i++) {
    rows.push({ kind: "entry", entry: leaderboard[i], rankIdx: i });
  }
  return rows;
}

/**
 * Renders the Multiclass Standings widget into target DOM container
 */
export function renderStandingsWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state || !state.leaderboard || state.leaderboard.length === 0) {
    container.innerHTML = `
      <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
        <span class="text-r-muted">Clasificación</span>
        <span class="text-[9px] text-r-muted font-mono">SIN DATOS</span>
      </div>
      <div class="p-3 text-center text-xs text-white/50 font-mono">Esperando clasificación...</div>
    `;
    return;
  }

  const { leaderboard } = state;
  const isStreamer = SmartLayoutManager.getInstance().isStreamerMode();
  const cols = ThemeEngine.getInstance().getColumnsConfig().leaderboard;

  const isPractice =
    state.session.sessionType.toLowerCase().includes("practice") ||
    state.session.sessionType.toLowerCase().includes("warmup");

  const rawLap = state.frame.carIdxLap[state.camCarIdx] ?? 0;
  const activeLap = Math.max(0, rawLap);
  const remainLaps = state.frame.sessionLapsRemainEx;
  const validTotalLaps = remainLaps > 0 && remainLaps < 30000 ? activeLap + remainLaps : 0;
  const lapStr = validTotalLaps > 0 ? `Lap ${activeLap}/${validTotalLaps}` : `Lap ${activeLap}`;
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remClock = `${Math.floor(remSec / 60)}:${String(remSec % 60).padStart(2, "0")}`;
  const tTrack = state.frame.trackTempC;
  const tempPart = typeof tTrack === "number" && tTrack > 0 ? ` · ${tTrack.toFixed(0)}°C` : "";
  const leadClass = leaderboard[0]?.carClassShortName || (isPractice ? "PRAC" : "RACE");
  const leadColor = leaderboard[0]?.carClassColor || "#38bdf8";
  const sessChar = isPractice ? "P" : "R";

  const headerHtml = `
    <div class="mmt-std-header">
      <div class="flex items-center gap-1.5">
        <span class="font-bold text-white/80">${sessChar}</span>
        <span class="px-1 rounded-[2px] text-[9px] font-extrabold" style="background:${leadColor}28;color:${leadColor}">${leadClass}</span>
        <span class="text-white">${lapStr}</span>
        <span class="text-white/60">• ${remClock}</span>
      </div>
      <span class="text-white/70">${leaderboard.length} coches${tempPart}</span>
    </div>
  `;

  // Group & sort compact Standings by class speed (GTP -> LMP2 -> LMP3 -> GTE -> GT3 -> GT4 -> TCR -> MX5)
  const classSpeedOrder = (cls: string): number => {
    const u = cls.toUpperCase();
    if (u.includes("GTP") || u.includes("LMDH") || u.includes("HYPER")) return 1;
    if (u.includes("LMP2")) return 2;
    if (u.includes("LMP3")) return 3;
    if (u.includes("GTE")) return 4;
    if (u.includes("GT3")) return 5;
    if (u.includes("GT4")) return 6;
    if (u.includes("TCR")) return 7;
    if (u.includes("MX")) return 8;
    return 9;
  };

  const compactRows = buildCompactStandingsWindow(leaderboard);
  const irDeltas = estimateAllDriversIRatingDeltas(state);
  const allDrivers = Object.values(state.session.driverInfo?.drivers ?? {});
  const classSofMap = new Map<string, { sum: number; count: number; color: string }>();
  for (const d of allDrivers) {
    if (d.isPaceCar || d.isSpectator) continue;
    const key = d.carClassShortName || "ALL";
    const cur = classSofMap.get(key) ?? { sum: 0, count: 0, color: d.carClassColor || "#38bdf8" };
    if (d.iRating > 0) {
      cur.sum += d.iRating;
      cur.count += 1;
    }
    classSofMap.set(key, cur);
  }

  // Group compact entries by class while preserving speed order
  const entryGroups = new Map<string, { color: string; entries: Array<{ entry: LeaderboardEntry; rankIdx: number }> }>();
  for (const row of compactRows) {
    if (row.kind !== "entry") continue;
    const key = row.entry.carClassShortName || "ALL";
    const g = entryGroups.get(key) ?? { color: row.entry.carClassColor || "#38bdf8", entries: [] };
    g.entries.push({ entry: row.entry, rankIdx: row.rankIdx });
    entryGroups.set(key, g);
  }
  const sortedClasses = Array.from(entryGroups.entries()).sort((a, b) => classSpeedOrder(a[0]) - classSpeedOrder(b[0]));
  const isMulticlass = sortedClasses.length > 1;

  const rowsHtml = sortedClasses
    .map(([clsName, group]) => {
      const sofData = classSofMap.get(clsName);
      const clsSof = sofData && sofData.count > 0 ? formatSofShort(Math.round(sofData.sum / sofData.count)) : "";
      const classHeaderHtml = isMulticlass
        ? `<div class="mmt-std-class-header" style="border-left: 3px solid ${group.color}; color: ${group.color}">
             <span>${clsName}</span>
             <span class="text-white/65">${clsSof ? `SOF ${clsSof}` : `${group.entries.length} coches`}</span>
           </div>`
        : "";

      const clsRows = group.entries
        .map(({ entry: e, rankIdx: idx }, clsIdx) => {
          const clsPos = clsIdx + 1;
          const isLeader = idx === 0;
          const isSelf = e.isActiveCam;
          const posColor = isLeader ? "text-amber-400" : idx === 1 ? "text-slate-200" : idx === 2 ? "text-amber-600" : "text-white/80";
          const rowCls = `mmt-std-row font-mono${isSelf ? " is-self" : clsIdx % 2 === 1 ? " is-alt" : ""}`;

          const posGlobalCell = cols.position
            ? `<span class="text-center text-[10px] font-bold ${posColor}">${e.position}</span>`
            : `<span></span>`;
          const posClassCell = `<span class="text-center text-[10px] font-bold" style="color:${e.carClassColor || "#38bdf8"}">${clsPos}</span>`;

          const displayName = isStreamer
            ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
            : (cols.driverName ? (e.driverName || e.abbrevName) : "");
          const nameCell = `<span class="mmt-cell-name text-[11px] ${isSelf ? "text-white font-bold" : "text-white/90 font-semibold"}">${displayName}</span>`;
          const brandCell = cols.brandIcon
            ? `<span class="flex items-center justify-center">${getCarBrandSvg(e.carPath, 16)}</span>`
            : `<span></span>`;
          const irShort = e.iRatingStr || "";
          const licIrCell = `<span class="flex items-center justify-end gap-1">${e.licString ? renderLicenseBadge(e.licString) : ""}${cols.iRating && irShort ? `<span class="mmt-ir-pill">${irShort}</span>` : ""}</span>`;

          const irDeltaVal = isPractice ? 0 : (irDeltas.get(e.carIdx) ?? 0);
          const irDeltaText = isPractice ? "—" : irDeltaVal > 0 ? `+${Math.round(irDeltaVal)}` : `${Math.round(irDeltaVal)}`;
          const irDeltaColor = isPractice || irDeltaVal === 0 ? "text-white/40" : irDeltaVal > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
          const irDeltaCell = `<span class="text-right text-[10px] tabular-nums ${irDeltaColor}">${irDeltaText}</span>`;

          const gapCell = `<span class="text-right text-[10px] ${isLeader ? "text-amber-300 font-bold" : "text-white/80 font-semibold"}">${isLeader ? "LDR" : (e.gapStr || "-")}</span>`;
          const intCell = `<span class="text-right text-[10px] text-white/65">${isLeader ? "-" : (e.intervalStr || "-")}</span>`;
          const bestCell = `<span class="text-right text-[10px] ${isLeader && isPractice ? "text-amber-300 font-bold" : isSelf ? "text-emerald-400 font-bold" : "text-white/90 font-semibold"}">${e.bestLapStr || "--:--.--"}</span>`;

          return `
            <div class="${rowCls}" style="border-left-color: ${isSelf ? "#10b981" : (e.carClassColor || "#38bdf8")}">
              ${posGlobalCell}
              ${posClassCell}
              ${nameCell}
              ${brandCell}
              ${licIrCell}
              ${irDeltaCell}
              ${gapCell}
              ${intCell}
              ${bestCell}
            </div>
          `;
        })
        .join("");

      return `${classHeaderHtml}${clsRows}`;
    })
    .join("");

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="font-mono tabular-nums select-none overflow-hidden max-h-[260px]">
      ${rowsHtml}
    </div>
  `);
}

/**
 * Renders the Fuel Computer widget into target DOM container
 */
export function renderFuelWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state) {
    container.innerHTML = `
      <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Ordenador de Combustible</div>
      <div class="p-3 text-center text-xs text-white/50 font-mono">Esperando lectura de telemetría...</div>
    `;
    return;
  }

  const fuel = state.fuel;

  const headerHtml = `
    <div class="h-[20px] flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <span class="text-white/70 font-bold tracking-wider">FUEL</span>
      <span class="text-white font-bold">${fuel.fuelRemainingL > 0 ? `${fuel.fuelRemainingL} L` : "-- L"} · ${fuel.isValid ? `${fuel.stintLapsRemaining} v` : "-- v"}</span>
    </div>
  `;

  if (!fuel.isValid) {
    setHtmlIfChanged(container, `
      ${headerHtml}
      <div class="mt-1 grid gap-0.5 text-[10px] font-mono tabular-nums text-white/65">
        <div class="mmt-fuel-row"><span>Last</span><span>-- L/v</span></div>
        <div class="mmt-fuel-row"><span>Stint</span><span>-- L/v</span></div>
        <div class="mmt-fuel-row"><span>Session</span><span class="truncate text-right">${fuel.reasonNotReady || "Calibrando"}</span></div>
      </div>
    `);
    return;
  }

  const toAddStr = fuel.fuelToAdd > 0 ? `+${fuel.fuelToAdd} L` : "OK";
  const toAddClass = fuel.fuelToAdd > 0 ? "text-amber-400" : "text-emerald-400";

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="mt-1 grid gap-0.5 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <div class="mmt-fuel-row text-white/80">
        <span>Last</span>
        <span>${fuel.avgBurnPerLap} L/v</span>
      </div>
      <div class="mmt-fuel-row text-white/80">
        <span>Stint (5v)</span>
        <span>${fuel.maxBurnPerLap} L/v · ${fuel.stintLapsRemaining} v</span>
      </div>
      <div class="mmt-fuel-row text-white/80">
        <span>Session</span>
        <span class="${toAddClass} font-bold">${toAddStr} · L&amp;C ${fuel.liftAndCoastTarget}</span>
      </div>
    </div>
  `);
}

/**
 * Renders the hardware-accelerated GPU Pedals & Steering widget
 */
export function renderGpuPedalsWidget(container: HTMLElement, sample: PedalsSample): void {
  gpuPedalsEngine.render(container, sample);
}

/**
 * Renders the 360° Proximity Radar & Spotter widget
 */
export function renderRadarWidget(container: HTMLElement, state: RadarInputState): void {
  radar360Engine.render(container, state);
}

/**
 * Renders the Pitbox Helper & Speed Limiter widget
 */
export function renderPitboxWidget(container: HTMLElement, state: PitboxInputState): void {
  pitboxEngine.render(container, state);
}

/**
 * Renders the DigiFlag LED flag matrix widget
 */
export function renderDigiFlagWidget(container: HTMLElement, sessionFlags: number): void {
  digiFlagEngine.render(container, sessionFlags);
}
