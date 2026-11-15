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
import { estimateLiveIRating, formatIRatingDelta, formatSofShort } from "./irating-calc";

const lastRenderedHtml = new WeakMap<HTMLElement, string>();
function setHtmlIfChanged(container: HTMLElement, html: string): void {
  if (lastRenderedHtml.get(container) === html) return;
  lastRenderedHtml.set(container, html);
  container.innerHTML = html;
}

const LICENSE_BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "#2563eb", border: "#60a5fa", text: "#ffffff" },
  B: { bg: "#16a34a", border: "#4ade80", text: "#ffffff" },
  C: { bg: "#eab308", border: "#fde047", text: "#09090b" },
  D: { bg: "#ea580c", border: "#fb923c", text: "#ffffff" },
  R: { bg: "#dc2626", border: "#f87171", text: "#ffffff" },
  P: { bg: "#09090b", border: "rgba(255,255,255,0.65)", text: "#ffffff" },
  W: { bg: "#09090b", border: "rgba(255,255,255,0.65)", text: "#ffffff" },
};

function renderLicenseBadge(licString: string | undefined): string {
  const code = (licString || "R 0.0").replace(/\s+/g, "");
  const letter = code.charAt(0).toUpperCase();
  const palette = LICENSE_BADGE_STYLES[letter] ?? { bg: "#475569", border: "#94a3b8", text: "#ffffff" };
  return `<span style="display:inline-flex;align-items:center;justify-content:center;padding:1px 5px;border-radius:3px;font-size:10px;font-weight:800;line-height:1.15;font-variant-numeric:tabular-nums;background-color:${palette.bg};color:${palette.text};border:1px solid ${palette.border}">${code}</span>`;
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
  const irPill = irEst
    ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tabular-nums ${
        irEst.delta >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
      }">${formatIRatingDelta(irEst.delta)}</span>`
    : "";

  const tTrack = state.frame.trackTempC;
  const trackTempStr = typeof tTrack === "number" && tTrack > 0 ? `${tTrack.toFixed(0)}°C` : "--°C";
  const localClock = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const activeLap = state.frame.carIdxLap[state.camCarIdx] || 1;
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remMin = Math.floor(remSec / 60);
  const remSecPart = String(remSec % 60).padStart(2, "0");
  const sessionClock = `${String(remMin).padStart(2, "0")}:${remSecPart}`;
  const sessType = (state.session.sessionType || "Practice").split(" ")[0];

  const headerHtml = `
    <div class="h-[22px] px-2 flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap text-white/75">
      <div class="flex items-center gap-1.5">
        <span class="font-bold text-white/90">${irEst ? `SOF ${formatSofShort(irEst.sof)}` : "REL"}</span>
        ${irPill}
        ${isStreamer ? `<span class="px-1 rounded text-[8px] bg-purple-500/20 text-purple-300">STR</span>` : ""}
      </div>
      <div class="flex items-center gap-2 text-white/65">
        <span>${trackTempStr}</span>
        <span>${localClock}</span>
      </div>
    </div>
  `;

  const selfIdx = entries.findIndex((e) => e.isActiveCam);
  const displayEntries = selfIdx >= 0
    ? entries.slice(Math.max(0, selfIdx - 3), selfIdx + 4)
    : entries.slice(0, 7);

  const rowsHtml = displayEntries
    .map((e: RelativeEntry) => {
      const isSelf = e.isActiveCam;
      const rowBg = isSelf
        ? "bg-[rgba(0,230,118,0.18)]"
        : "bg-[#0a0c10]/88 odd:bg-[#0e1218]/88";

      const deltaClass = isSelf
        ? "text-[#00e676] font-extrabold"
        : e.isAhead
        ? "text-amber-300 font-bold"
        : "text-sky-300 font-bold";

      const pitBadge = cols.pitStatus && e.onPitRoad
        ? `<span class="px-1 rounded-[2px] text-[8px] bg-amber-500/25 text-amber-300 font-bold">PIT</span>`
        : "";

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : e.abbrevName;

      const relPos = posByCarIdx.get(e.carIdx) ?? 0;
      const classPosCell = `<span class="text-[10px] font-bold text-center rounded-[2px]" style="color:${e.carClassColor || "#38bdf8"}">${relPos > 0 ? `P${relPos}` : "-"}</span>`;
      const numCell = cols.carNumber
        ? `<span class="text-[10px] font-bold text-center rounded-[2px] ${isSelf ? "text-[#00e676]" : "text-white/80"}">#${e.carNumber}</span>`
        : `<span></span>`;
      const nameCell = cols.driverName
        ? `<span class="truncate text-[11px] ${isSelf ? "text-white font-bold" : "text-white/90"}">${displayName}</span>`
        : `<span></span>`;
      const licCell = cols.license
        ? `<span class="flex items-center justify-end gap-0.5">${renderLicenseBadge(e.licString)}</span>`
        : `<span></span>`;
      const tagCell = `<span class="text-center">${pitBadge}</span>`;
      const deltaCell = cols.delta
        ? `<span class="text-right text-[11px] tabular-nums ${deltaClass}">${e.deltaStr}</span>`
        : `<span></span>`;

      return `
        <div class="grid items-center gap-1 px-1.5 h-[20px] ${rowBg} font-mono text-[11px] tabular-nums whitespace-nowrap overflow-hidden"
             style="grid-template-columns: 24px 30px minmax(75px, 1fr) 40px 26px 46px; border-left: 3px solid ${isSelf ? "#00e676" : (e.carClassColor || "#00e699")}">
          ${classPosCell}
          ${numCell}
          ${nameCell}
          ${licCell}
          ${tagCell}
          ${deltaCell}
        </div>
      `;
    })
    .join("");

  const footerHtml = `
    <div class="h-[20px] px-2 flex items-center justify-between border-t border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap text-white/60">
      <span>Lap: <strong class="text-white/90">${activeLap}</strong></span>
      <span>${sessionClock}</span>
      <span>${isReplay ? "Replay" : sessType}</span>
    </div>
  `;

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="divide-y divide-white/[0.04] overflow-hidden font-mono text-[11px] select-none">
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

  const activeLap = state.frame.carIdxLap[state.camCarIdx] || 1;
  const totalLaps = state.frame.sessionLapsRemainEx > 0 ? activeLap + state.frame.sessionLapsRemainEx : 0;
  const lapStr = totalLaps > 0 ? `Lap ${activeLap}/${totalLaps}` : `Lap ${activeLap}`;
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remClock = `${Math.floor(remSec / 60)}:${String(remSec % 60).padStart(2, "0")}`;
  const tTrack = state.frame.trackTempC;
  const tAir = state.frame.airTempC;
  const tempStr = typeof tTrack === "number" && tTrack > 0
    ? `${tTrack.toFixed(0)}°/${typeof tAir === "number" ? tAir.toFixed(0) : "--"}°`
    : "--°/--°";
  const leadClass = leaderboard[0]?.carClassShortName || (isPractice ? "PRAC" : "RACE");
  const leadColor = leaderboard[0]?.carClassColor || "#38bdf8";

  const headerHtml = `
    <div class="h-[22px] px-2 flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <div class="flex items-center gap-1.5">
        <span class="px-1 rounded-[2px] text-[9px] font-extrabold" style="background:${leadColor}28;color:${leadColor}">${leadClass}</span>
        <span class="text-white/90 font-bold">${lapStr}</span>
        <span class="text-white/55">• ${remClock}</span>
        ${isStreamer ? `<span class="px-1 rounded text-[8px] bg-purple-500/20 text-purple-300">STR</span>` : ""}
      </div>
      <div class="flex items-center gap-2 text-white/65">
        <span>${tempStr}</span>
      </div>
    </div>
  `;

  // Compact Standings window: Top 3 + divider + ±3 around CamCarIdx (max 10-11 rows)
  const compactRows = buildCompactStandingsWindow(leaderboard);
  const classPositions = new Map<string, number>();

  const rowsHtml = compactRows
    .map((row) => {
      if (row.kind === "separator") {
        return `<div class="h-[14px] flex items-center justify-center bg-[#0a0c10]/70 text-[10px] font-mono text-white/35 tracking-widest select-none">···</div>`;
      }
      const e = row.entry;
      const idx = row.rankIdx;
      const clsKey = e.carClassShortName || "ALL";
      const clsPos = (classPositions.get(clsKey) ?? 0) + 1;
      classPositions.set(clsKey, clsPos);

      const isLeader = idx === 0;
      const isSelf = e.isActiveCam;
      const posClass = isLeader
        ? "text-amber-400 font-black"
        : idx === 1
        ? "text-slate-200 font-bold"
        : idx === 2
        ? "text-amber-600 font-bold"
        : "text-white/75";

      const rowBg = isSelf
        ? "bg-[rgba(0,230,118,0.18)]"
        : "bg-[#0a0c10]/88 odd:bg-[#0e1218]/88";

      const posClassCell = `<span class="text-[10px] font-bold text-center" style="color:${e.carClassColor || "#38bdf8"}">${clsPos}</span>`;
      const posGlobalCell = cols.position
        ? `<span class="text-[10px] text-center ${posClass}">${e.position}</span>`
        : `<span></span>`;
      const numCell = cols.carNumber && e.carNumber
        ? `<span class="text-[10px] font-bold text-center ${isSelf ? "text-[#00e676]" : "text-white/80"}">#${e.carNumber}</span>`
        : `<span></span>`;

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : (cols.driverName ? e.abbrevName : "");
      const nameCell = `<span class="truncate text-[11px] ${isSelf ? "text-white font-bold" : "text-white/90"}">${displayName}</span>`;
      const brandCell = cols.brandIcon ? `<span class="flex items-center justify-center">${getCarBrandSvg(e.carPath, 12)}</span>` : `<span></span>`;
      const licIrCell = `<span class="flex items-center justify-end gap-1">${e.licString ? renderLicenseBadge(e.licString) : ""}${cols.iRating && e.iRatingStr ? `<span class="text-[9px] text-white/65">${e.iRatingStr}</span>` : ""}</span>`;
      const gapCell = `<span class="text-right text-[10px] ${isLeader ? "text-amber-300 font-bold" : "text-white/75"}">${isLeader ? "LDR" : (e.gapStr || "-")}</span>`;
      const intCell = `<span class="text-right text-[10px] text-white/60">${isLeader ? "-" : (e.intervalStr || "-")}</span>`;
      const bestCell = `<span class="text-right text-[10px] ${isLeader && isPractice ? "text-amber-300 font-bold" : isSelf ? "text-[#00e676] font-bold" : "text-white/90"}">${e.bestLapStr || "--:--.--"}</span>`;

      return `
        <div class="grid items-center gap-1 px-1.5 h-[20px] ${rowBg} font-mono text-[11px] tabular-nums whitespace-nowrap overflow-hidden"
             style="grid-template-columns: 18px 18px 28px minmax(80px, 1fr) 14px 62px 44px 44px 54px; border-left: 3px solid ${isSelf ? "#00e676" : (e.carClassColor || "#38bdf8")}">
          ${posClassCell}
          ${posGlobalCell}
          ${numCell}
          ${nameCell}
          ${brandCell}
          ${licIrCell}
          ${gapCell}
          ${intCell}
          ${bestCell}
        </div>
      `;
    })
    .join("");

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="divide-y divide-white/[0.04] overflow-hidden font-mono text-[11px] tabular-nums select-none max-h-[260px]">
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
        <div class="flex justify-between"><span>Last</span><span>-- L/v</span></div>
        <div class="flex justify-between"><span>Stint</span><span>-- L/v</span></div>
        <div class="flex justify-between"><span>Session</span><span>${fuel.reasonNotReady || "Calibrando"}</span></div>
      </div>
    `);
    return;
  }

  const toAddStr = fuel.fuelToAdd > 0 ? `+${fuel.fuelToAdd} L` : "OK";
  const toAddClass = fuel.fuelToAdd > 0 ? "text-amber-400" : "text-emerald-400";

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="mt-1 grid gap-0.5 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <div class="flex justify-between text-white/80">
        <span>Last</span>
        <span>${fuel.avgBurnPerLap} L/v</span>
      </div>
      <div class="flex justify-between text-white/80">
        <span>Stint (5v)</span>
        <span>${fuel.maxBurnPerLap} L/v · ${fuel.stintLapsRemaining} v</span>
      </div>
      <div class="flex justify-between text-white/80">
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
