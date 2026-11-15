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
import { estimateLiveIRating, formatSofShort } from "./irating-calc";

const lastRenderedHtml = new WeakMap<HTMLElement, string>();
function setHtmlIfChanged(container: HTMLElement, html: string): void {
  if (lastRenderedHtml.get(container) === html) return;
  lastRenderedHtml.set(container, html);
  container.innerHTML = html;
}

const LICENSE_BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "#1d4ed8", border: "#3b82f6", text: "#ffffff" },
  B: { bg: "#15803d", border: "#22c55e", text: "#ffffff" },
  C: { bg: "#b45309", border: "#f59e0b", text: "#ffffff" },
  D: { bg: "#c2410c", border: "#fb923c", text: "#ffffff" },
  R: { bg: "#b91c1c", border: "#f87171", text: "#ffffff" },
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

  const tTrack = state.frame.trackTempC;
  const trackTempStr = typeof tTrack === "number" && tTrack > 0 ? `${tTrack.toFixed(0)}°C` : "--°C";
  const localClock = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const activeLap = Math.max(0, state.frame.carIdxLap[state.camCarIdx] || 0);
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remMin = Math.floor(remSec / 60);
  const remSecPart = String(remSec % 60).padStart(2, "0");
  const sessionClock = `${String(remMin).padStart(2, "0")}:${remSecPart}`;
  const sessType = (state.session.sessionType || "Practice").split(" ")[0];

  const headerHtml = `
    <div style="height:19px;padding:0 6px;display:flex;align-items:center;justify-content:space-between;background:rgba(10,12,16,0.62);border-bottom:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.9);color:rgba(255,255,255,0.8)">
      <span>${irEst ? `SOF ${formatSofShort(irEst.sof)}` : "REL"}</span>
      <span>${trackTempStr} · ${localClock}</span>
    </div>
  `;

  const selfIdx = entries.findIndex((e) => e.isActiveCam);
  const displayEntries = selfIdx >= 0
    ? entries.slice(Math.max(0, selfIdx - 3), selfIdx + 4)
    : entries.slice(0, 7);

  const rowsHtml = displayEntries
    .map((e: RelativeEntry, rowIdx: number) => {
      const isSelf = e.isActiveCam;
      const rowBgStyle = isSelf
        ? "background:rgba(0,230,118,0.20)"
        : rowIdx % 2 === 1
        ? "background:rgba(255,255,255,0.03)"
        : "background:transparent";

      const gapClean = (e.deltaStr || "0.0").replace(/s$/i, "");
      const gapColor = isSelf
        ? "#00e676"
        : e.onPitRoad
        ? "#fbbf24"
        : "#ffffff";

      const pitBadge = cols.pitStatus && e.onPitRoad
        ? `<span style="padding:0 3px;border-radius:2px;font-size:8px;font-weight:700;background:rgba(245,158,11,0.25);color:#fbbf24">PIT</span>`
        : "";

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : (e.driverName || e.abbrevName);

      const relPos = posByCarIdx.get(e.carIdx) ?? 0;
      const classPosCell = `<span style="width:20px;flex-shrink:0;text-align:center;font-size:10px;font-weight:700;color:${e.carClassColor || "#38bdf8"}">${relPos > 0 ? relPos : "-"}</span>`;
      const numCell = cols.carNumber
        ? `<span style="width:30px;flex-shrink:0;text-align:center;font-size:10px;font-weight:700;color:${isSelf ? "#00e676" : "rgba(255,255,255,0.85)"}">#${e.carNumber}</span>`
        : `<span style="width:30px;flex-shrink:0"></span>`;
      const nameCell = cols.driverName
        ? `<span style="flex:1 1 0%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:${isSelf ? "700" : "600"};color:${isSelf ? "#ffffff" : "rgba(255,255,255,0.92)"}">${displayName}</span>`
        : `<span style="flex:1 1 0%;min-width:0"></span>`;
      const tagCell = `<span style="width:24px;flex-shrink:0;text-align:center">${pitBadge}</span>`;
      const licCell = cols.license
        ? `<span style="width:34px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center">${renderLicenseBadge(e.licString)}</span>`
        : `<span style="width:34px;flex-shrink:0"></span>`;
      const irCell = cols.iRating && e.iRatingStr
        ? `<span style="width:34px;flex-shrink:0;text-align:right;font-size:10px;color:rgba(255,255,255,0.72)">${e.iRatingStr}</span>`
        : `<span style="width:34px;flex-shrink:0"></span>`;
      const deltaCell = cols.delta
        ? `<span style="width:36px;flex-shrink:0;text-align:right;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;color:${gapColor}">${gapClean}</span>`
        : `<span style="width:36px;flex-shrink:0"></span>`;

      return `
        <div class="font-mono tabular-nums"
             style="${rowBgStyle};display:flex;align-items:center;gap:3px;height:19px;padding:0 5px;white-space:nowrap;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,0.9);border-left:2px solid ${isSelf ? "#00e676" : (e.carClassColor || "#00e699")}">
          ${classPosCell}
          ${numCell}
          ${nameCell}
          ${tagCell}
          ${licCell}
          ${irCell}
          ${deltaCell}
        </div>
      `;
    })
    .join("");

  const footerHtml = `
    <div style="height:19px;padding:0 6px;display:flex;align-items:center;justify-content:space-between;background:rgba(10,12,16,0.62);border-top:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.9);color:rgba(255,255,255,0.7)">
      <span>Lap: <strong style="color:#fff">${activeLap}</strong></span>
      <span>${sessionClock}</span>
      <span>${isReplay ? "Replay" : sessType}</span>
    </div>
  `;

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="font-mono select-none" style="overflow:hidden">
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
  const tempStr = typeof tTrack === "number" && tTrack > 0 ? `${tTrack.toFixed(0)}°C` : "--°C";
  const leadClass = leaderboard[0]?.carClassShortName || (isPractice ? "PRAC" : "RACE");
  const leadColor = leaderboard[0]?.carClassColor || "#38bdf8";
  const sessChar = isPractice ? "P" : "R";

  const headerHtml = `
    <div style="height:19px;padding:0 6px;display:flex;align-items:center;justify-content:space-between;background:rgba(10,12,16,0.62);border-bottom:1px solid rgba(255,255,255,0.08);font-size:10px;font-weight:600;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,0.9)">
      <div style="display:flex;align-items:center;gap:5px">
        <span style="color:rgba(255,255,255,0.75);font-weight:700">${sessChar}</span>
        <span style="padding:0 4px;border-radius:2px;font-size:9px;font-weight:800;background:${leadColor}28;color:${leadColor}">${leadClass}</span>
        <span style="color:#fff">${lapStr}</span>
        <span style="color:rgba(255,255,255,0.6)">${remClock}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;color:rgba(255,255,255,0.72)">
        <span>${tempStr}</span>
        <span>${leaderboard.length}</span>
      </div>
    </div>
  `;

  // Compact Standings window: Top 3 + divider + ±3 around CamCarIdx (max 10-11 rows)
  const compactRows = buildCompactStandingsWindow(leaderboard);
  const classPositions = new Map<string, number>();

  const rowsHtml = compactRows
    .map((row, rowIdx) => {
      if (row.kind === "separator") {
        return `<div style="height:12px;display:flex;align-items:center;justify-content:center;font-size:9px;color:rgba(255,255,255,0.35);letter-spacing:2px">···</div>`;
      }
      const e = row.entry;
      const idx = row.rankIdx;
      const clsKey = e.carClassShortName || "ALL";
      const clsPos = (classPositions.get(clsKey) ?? 0) + 1;
      classPositions.set(clsKey, clsPos);

      const isLeader = idx === 0;
      const isSelf = e.isActiveCam;
      const posColor = isLeader ? "#fbbf24" : idx === 1 ? "#e2e8f0" : idx === 2 ? "#d97706" : "rgba(255,255,255,0.8)";
      const rowBgStyle = isSelf
        ? "background:rgba(0,230,118,0.20)"
        : rowIdx % 2 === 1
        ? "background:rgba(255,255,255,0.03)"
        : "background:transparent";

      const posGlobalCell = cols.position
        ? `<span style="width:18px;flex-shrink:0;text-align:center;font-size:10px;font-weight:700;color:${posColor}">${e.position}</span>`
        : `<span style="width:18px;flex-shrink:0"></span>`;
      const posClassCell = `<span style="width:18px;flex-shrink:0;text-align:center;font-size:10px;font-weight:700;color:${e.carClassColor || "#38bdf8"}">${clsPos}</span>`;

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : (cols.driverName ? (e.driverName || e.abbrevName) : "");
      const nameCell = `<span style="flex:1 1 0%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:${isSelf ? "700" : "600"};color:${isSelf ? "#ffffff" : "rgba(255,255,255,0.94)"}">${displayName}</span>`;
      const brandCell = cols.brandIcon
        ? `<span style="width:16px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center">${getCarBrandSvg(e.carPath, 12)}</span>`
        : `<span style="width:16px;flex-shrink:0"></span>`;
      const fullIr = (e as any).iRating > 0 ? String((e as any).iRating) : (e.iRatingStr || "");
      const licIrCell = `<span style="width:66px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:flex-end;gap:3px">${e.licString ? renderLicenseBadge(e.licString) : ""}${cols.iRating && fullIr ? `<span style="font-size:10px;color:rgba(255,255,255,0.75)">${fullIr}</span>` : ""}</span>`;
      const gapCell = `<span style="width:40px;flex-shrink:0;text-align:right;font-size:10px;color:${isLeader ? "#fbbf24" : "rgba(255,255,255,0.8)"};font-weight:${isLeader ? "700" : "600"}">${isLeader ? "LDR" : (e.gapStr || "-")}</span>`;
      const intCell = `<span style="width:40px;flex-shrink:0;text-align:right;font-size:10px;color:rgba(255,255,255,0.68)">${isLeader ? "-" : (e.intervalStr || "-")}</span>`;
      const bestCell = `<span style="width:52px;flex-shrink:0;text-align:right;font-size:10px;font-weight:${(isLeader && isPractice) || isSelf ? "700" : "600"};color:${isLeader && isPractice ? "#fbbf24" : isSelf ? "#00e676" : "rgba(255,255,255,0.92)"}">${e.bestLapStr || "--:--.--"}</span>`;

      return `
        <div class="font-mono tabular-nums"
             style="${rowBgStyle};display:flex;align-items:center;gap:3px;height:19px;padding:0 5px;white-space:nowrap;overflow:hidden;text-shadow:0 1px 2px rgba(0,0,0,0.9);border-left:2px solid ${isSelf ? "#00e676" : (e.carClassColor || "#38bdf8")}">
          ${posGlobalCell}
          ${posClassCell}
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
    <div class="font-mono tabular-nums select-none" style="overflow:hidden;max-height:240px">
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
