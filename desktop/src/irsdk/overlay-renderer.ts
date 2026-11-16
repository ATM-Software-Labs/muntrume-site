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
  const label = num ? `${letter}${num}` : letter;
  const cls = ["A", "B", "C", "D", "R"].includes(letter) ? `mmt-lic-${letter}` : "mmt-lic-R";
  return `<span class="mmt-lic-pill ${cls}">${label}</span>`;
}

function renderLicenseIrBlock(licString: string | undefined, iRatingExact?: number, iRatingStr?: string, showIr = true): string {
  const licHtml = licString ? renderLicenseBadge(licString) : "";
  const irVal = iRatingExact && iRatingExact > 0 ? String(Math.round(iRatingExact)) : (iRatingStr || "");
  const irHtml = showIr && irVal ? `<span class="mmt-ir-exact">${irVal}</span>` : "";
  if (!licHtml && !irHtml) return "";
  return `<span class="mmt-lic-ir-block">${licHtml}${irHtml}</span>`;
}

const gpuPedalsEngine = new GpuPedalsEngine();
const radar360Engine = new Radar360Engine();
const pitboxEngine = new PitboxHelperEngine();
const digiFlagEngine = new DigiFlagEngine();

function renderCompoundBadge(compound: number | undefined): string {
  if (compound === undefined || compound < 0) return "";
  if (compound === 0) {
    return `<span class="w-[16px] h-[16px] shrink-0 rounded-[2px] bg-[#e2e8f0] border border-rose-500 text-slate-950 font-black text-[9px] flex items-center justify-center" title="Slick / Dry">S</span>`;
  }
  if (compound === 1) {
    return `<span class="w-[16px] h-[16px] shrink-0 rounded-[2px] bg-[#0284c7] text-white font-black text-[9px] flex items-center justify-center" title="Wet / Lluvia">W</span>`;
  }
  if (compound === 2) {
    return `<span class="w-[16px] h-[16px] shrink-0 rounded-[2px] bg-[#facc15] text-slate-950 font-black text-[9px] flex items-center justify-center" title="Medium">M</span>`;
  }
  if (compound === 3) {
    return `<span class="w-[16px] h-[16px] shrink-0 rounded-[2px] bg-white text-slate-950 font-black text-[9px] flex items-center justify-center" title="Hard">H</span>`;
  }
  return "";
}

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
  const irDeltas = estimateAllDriversIRatingDeltas(state);
  const isPractice =
    state.session.sessionType.toLowerCase().includes("practice") ||
    state.session.sessionType.toLowerCase().includes("warmup");
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
        : "text-[#f8fafc] font-semibold";

      const flags = e.sessionFlags ?? 0;
      const hasBlackFlag = (flags & 0x00010000) !== 0; // irsdk_black
      const hasSlowDown = (flags & 0x00080000) !== 0;  // irsdk_furled
      const badgeParts: string[] = [];
      if (hasBlackFlag) badgeParts.push(`<span class="mmt-flag-f" title="Bandera Negra">F</span>`);
      if (hasSlowDown) badgeParts.push(`<span class="mmt-flag-xd" title="Slow Down">XD</span>`);
      if (cols.pitStatus && e.onPitRoad) badgeParts.push(`<span class="mmt-flag-pit">PIT</span>`);

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : (e.driverName || e.abbrevName);

      const relPos = e.position && e.position > 0 ? e.position : (posByCarIdx.get(e.carIdx) ?? 0);
      const isOffLap = !isSelf && (e.lapDelta ?? 0) !== 0;
      const nameColor = isSelf ? "text-white font-bold" : isOffLap ? "text-[#fbbf24]" : "text-[#f8fafc]";

      const classPosCell = `<span class="w-[16px] shrink-0 text-center text-[10.5px] font-bold" style="color:${e.carClassColor || "#38bdf8"}">${relPos > 0 ? relPos : "-"}</span>`;
      const numCell = cols.carNumber
        ? `<span class="w-[26px] shrink-0 text-center text-[10.5px] font-bold ${isSelf ? "text-emerald-400" : isOffLap ? "text-[#fbbf24]" : "text-white/85"}">#${e.carNumber}</span>`
        : ``;
      const nameCell = cols.driverName
        ? `<span class="mmt-cell-name shrink-0 ${nameColor}">${displayName}</span>`
        : ``;
      const tagCell = badgeParts.length > 0
        ? `<span class="w-[24px] shrink-0 flex items-center justify-center gap-0.5">${badgeParts.join("")}</span>`
        : `<span class="w-[24px] shrink-0"></span>`;
      const licIrCell = cols.license
        ? `<span class="w-[58px] shrink-0 flex items-center justify-end">${renderLicenseIrBlock(e.licString, e.iRatingExact, e.iRatingStr, true)}</span>`
        : ``;
      const compoundCell = renderCompoundBadge(state.frame.carIdxTireCompound?.[e.carIdx]);
      const irDeltaVal = isPractice ? 0 : (irDeltas.get(e.carIdx) ?? 0);
      const irDeltaText = isPractice ? "—" : irDeltaVal > 0 ? `+${Math.round(irDeltaVal)}` : `${Math.round(irDeltaVal)}`;
      const irDeltaColor = isPractice || irDeltaVal === 0 ? "text-white/40" : irDeltaVal > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
      const irDeltaCell = isPractice ? `` : `<span class="w-[28px] shrink-0 text-right text-[10.5px] tabular-nums ${irDeltaColor}">${irDeltaText}</span>`;
      const deltaCell = cols.delta
        ? `<span class="w-[36px] shrink-0 text-right text-[11px] tabular-nums ${gapColor}">${gapClean}</span>`
        : ``;

      return `
        <div class="${rowCls}" style="border-left-color: ${isSelf ? "#10b981" : (e.carClassColor || "#00e699")}">
          ${classPosCell}
          ${numCell}
          ${nameCell}
          ${tagCell}
          ${licIrCell}
          ${compoundCell}
          ${irDeltaCell}
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
 * Zero-Bloat Standings (Prompts 121 & 147):
 * On multiclass grids, focus on the active player's class and cap DOM rows to
 * Top 6 (P1-P6) + 2px divider + player & ±1 immediate rival (max 9 driver rows).
 */
export function buildZeroBloatStandings(leaderboard: LeaderboardEntry[]): CompactStandingsRow[] {
  if (!leaderboard || leaderboard.length === 0) return [];
  const active = leaderboard.find((e) => e.isActiveCam);
  const activeClass = active?.carClassShortName || "";
  const classBoard =
    leaderboard.length > 9 && activeClass
      ? leaderboard.filter((e) => e.carClassShortName === activeClass)
      : leaderboard;
  const list = classBoard.length > 0 ? classBoard : leaderboard;
  if (list.length <= 9) {
    return list.map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));
  }

  const selfIdx = list.findIndex((e) => e.isActiveCam);
  if (selfIdx < 0 || selfIdx <= 7) {
    return list.slice(0, 9).map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));
  }

  // Top 6 (P1-P6) + 2px divider + player ±1 rival (9 driver rows)
  const rows: CompactStandingsRow[] = list
    .slice(0, 6)
    .map((entry, rankIdx) => ({ kind: "entry", entry, rankIdx }));
  const winStart = Math.max(6, selfIdx - 1);
  const winEnd = Math.min(list.length, selfIdx + 2);
  if (winStart > 6) {
    rows.push({ kind: "separator" });
  }
  for (let i = winStart; i < winEnd; i++) {
    rows.push({ kind: "entry", entry: list[i], rankIdx: i });
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
  const remH = Math.floor(remSec / 3600);
  const remM = Math.floor((remSec % 3600) / 60);
  const remS = remSec % 60;
  const remClock = remH > 0
    ? `${remH}:${String(remM).padStart(2, "0")}:${String(remS).padStart(2, "0")}`
    : `${remM}:${String(remS).padStart(2, "0")}`;
  const tTrack = state.frame.trackTempC;
  const tempPart = typeof tTrack === "number" && tTrack > 0 ? `🌡 ${tTrack.toFixed(0)}°C` : "";
  const leadClass = leaderboard[0]?.carClassShortName || (isPractice ? "PRAC" : "RACE");
  const leadColor = leaderboard[0]?.carClassColor || "#38bdf8";
  const sessChar = isPractice ? "P" : "R";
  const totalSessionCars = Math.max(
    leaderboard.length,
    Object.values(state.session.driverInfo?.drivers ?? {}).filter((d) => !d.isPaceCar && !d.isSpectator).length
  );

  const headerHtml = `
    <div class="mmt-std-header">
      <div class="flex items-center gap-1.5">
        <span class="font-bold text-white/90">${sessChar}</span>
        <span class="px-1 rounded-[2px] text-[9px] font-extrabold" style="background:${leadColor}28;color:${leadColor}">${leadClass}</span>
        <span class="text-white">${lapStr}</span>
        <span class="text-white/70">${remClock}</span>
      </div>
      <div class="flex items-center gap-2 text-white/80">
        ${tempPart ? `<span>${tempPart}</span>` : ""}
        <span>🏎 ${leaderboard.length}/${totalSessionCars}</span>
      </div>
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

  const compactRows = buildZeroBloatStandings(leaderboard);
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
          const isLeader = idx === 0;
          const isSelf = e.isActiveCam;
          const isOffLap = !isSelf && !isPractice && (e.lapDelta ?? 0) !== 0;
          const posColor = isLeader ? "text-amber-400" : idx === 1 ? "text-slate-200" : idx === 2 ? "text-amber-600" : "text-white/85";
          const rowCls = `mmt-std-row font-mono${isSelf ? " is-self" : clsIdx % 2 === 1 ? " is-alt" : ""}`;

          const posGlobalCell = cols.position
            ? `<span class="w-[18px] shrink-0 text-center text-[10.5px] font-bold ${posColor}">${e.position}</span>`
            : ``;
          const deltaPos = e.posDelta ?? 0;
          const posDeltaCell = isPractice
            ? ``
            : deltaPos > 0
            ? `<span class="w-[20px] shrink-0 text-center text-[9.5px] font-bold text-emerald-400">▲${deltaPos}</span>`
            : deltaPos < 0
            ? `<span class="w-[20px] shrink-0 text-center text-[9.5px] font-bold text-rose-400">▼${Math.abs(deltaPos)}</span>`
            : `<span class="w-[20px] shrink-0 text-center text-[9.5px] text-white/25">—</span>`;
          const numCell = `<span class="w-[28px] shrink-0 text-center text-[10.5px] font-bold ${isSelf ? "text-emerald-400" : isOffLap ? "text-[#fbbf24]" : "text-white/80"}">#${e.carNumber}</span>`;

          const displayName = isStreamer
            ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
            : (cols.driverName ? (e.driverName || e.abbrevName) : "");
          const nameCell = cols.driverName
            ? `<span class="mmt-cell-name shrink-0 ${isSelf ? "text-white font-bold" : isOffLap ? "text-[#fbbf24]" : "text-[#f8fafc]"}">${displayName}</span>`
            : ``;
          const brandCell = cols.brandIcon
            ? `<span class="w-[16px] shrink-0 flex items-center justify-center">${getCarBrandSvg(e.carPath, 14)}</span>`
            : ``;
          const licIrCell = `<span class="w-[62px] shrink-0 flex items-center justify-end">${renderLicenseIrBlock(e.licString, e.iRatingExact, e.iRatingStr, cols.iRating)}</span>`;
          const compoundCell = renderCompoundBadge(state.frame.carIdxTireCompound?.[e.carIdx]);

          const irDeltaVal = isPractice ? 0 : (irDeltas.get(e.carIdx) ?? 0);
          const irDeltaText = isPractice ? "—" : irDeltaVal > 0 ? `+${Math.round(irDeltaVal)}` : `${Math.round(irDeltaVal)}`;
          const irDeltaColor = isPractice || irDeltaVal === 0 ? "text-white/40" : irDeltaVal > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
          const irDeltaCell = isPractice ? `` : `<span class="w-[28px] shrink-0 text-right text-[10.5px] tabular-nums ${irDeltaColor}">${irDeltaText}</span>`;

          // Hide GAP & INT in Practice/Qualy (Prompt 140) to save ~90px of dead width
          const showRaceGaps = !isPractice && !state.session.sessionType.toLowerCase().includes("qual");
          const gapCell = showRaceGaps
            ? `<span class="w-[38px] shrink-0 text-right text-[10.5px] ${isLeader ? "text-amber-300 font-bold" : isOffLap ? "text-[#fbbf24]/90" : "text-white/85 font-semibold"}">${isLeader ? "LDR" : (e.gapStr || "-")}</span>`
            : ``;
          const intCell = showRaceGaps
            ? `<span class="w-[38px] shrink-0 text-right text-[10.5px] text-white/65">${isLeader ? "-" : (e.intervalStr || "-")}</span>`
            : ``;
          const lastCell = `<span class="w-[52px] shrink-0 text-right text-[10.5px] tabular-nums text-white/75">${e.lastLapStr || "--:--.---"}</span>`;
          const bestCell = `<span class="w-[52px] shrink-0 text-right text-[10.5px] tabular-nums ${isLeader && isPractice ? "text-amber-300 font-bold" : isSelf ? "text-emerald-400 font-bold" : "text-[#f8fafc] font-semibold"}">${e.bestLapStr || "--:--.---"}</span>`;

          return `
            <div class="${rowCls}" style="border-left-color: ${isSelf ? "#10b981" : (e.carClassColor || "#38bdf8")}">
              ${posGlobalCell}
              ${posDeltaCell}
              ${numCell}
              ${nameCell}
              ${brandCell}
              ${licIrCell}
              ${compoundCell}
              ${irDeltaCell}
              ${gapCell}
              ${intCell}
              ${lastCell}
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

  const surplus = fuel.fuelSurplusL ?? 0;
  const toAddStr = fuel.fuelToAdd > 0
    ? `PARAR · +${fuel.fuelToAdd.toFixed(1)} L`
    : `OK · +${surplus.toFixed(1)} L`;
  const toAddClass = fuel.fuelToAdd > 0 ? "text-rose-400" : "text-emerald-400";
  const addBadgeHtml = fuel.fuelToAdd > 0
    ? `<span class="text-[#00ff88] font-black text-[12px]">+${fuel.fuelToAdd.toFixed(1)} L</span>`
    : `<span class="text-emerald-400 font-black text-[11px]">OK</span>`;

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="mt-1 grid gap-0.5 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <div class="mmt-fuel-row text-white/85">
        <span>Media / Máx</span>
        <span>${fuel.avgBurnPerLap} / ${fuel.maxBurnPerLap} L/v</span>
      </div>
      <div class="mmt-fuel-row text-white/85">
        <span>Repostaje</span>
        ${addBadgeHtml}
      </div>
      <div class="mmt-fuel-row text-white/85">
        <span>Meta (${fuel.lapsRemaining}v)</span>
        <span class="${toAddClass} font-bold">${toAddStr}</span>
      </div>
    </div>
  `);
}

const trackTempHistory: Array<{ t: number; temp: number }> = [];

/**
 * Renders the compact 360x24 Track Conditions, Flags, Temp Trend & Wetness bar
 */
export function renderTrackConditionsWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state) {
    setHtmlIfChanged(container, "");
    return;
  }

  const frame = state.frame;
  const flags = frame.sessionFlags ?? 0;
  const now = Date.now();
  const temp = typeof frame.trackTempC === "number" && frame.trackTempC > 0 ? frame.trackTempC : 0;

  if (temp > 0) {
    if (trackTempHistory.length === 0 || now - trackTempHistory[trackTempHistory.length - 1].t >= 10_000) {
      trackTempHistory.push({ t: now, temp });
    }
    const cutoff = now - 5 * 60 * 1000;
    while (trackTempHistory.length > 1 && trackTempHistory[0].t < cutoff) {
      trackTempHistory.shift();
    }
  }

  const baseTemp = trackTempHistory.length > 0 ? trackTempHistory[0].temp : temp;
  const tempDelta = temp > 0 && baseTemp > 0 ? temp - baseTemp : 0;
  const trendStr = Math.abs(tempDelta) >= 0.1
    ? ` <span class="${tempDelta < 0 ? "text-sky-400" : "text-amber-400"}">${tempDelta < 0 ? "▼" : "▲"} ${tempDelta > 0 ? "+" : ""}${tempDelta.toFixed(1)}°C</span>`
    : "";

  const wetMap: Record<number, { label: string; cls: string }> = {
    0: { label: "Dry", cls: "text-white/70" },
    1: { label: "Dry", cls: "text-white/70" },
    2: { label: "Mostly Dry", cls: "text-sky-200" },
    3: { label: "Damp", cls: "text-sky-300 font-bold" },
    4: { label: "Wet", cls: "text-sky-400 font-black" },
    5: { label: "Very Wet", cls: "text-blue-400 font-black" },
  };
  const wet = wetMap[frame.trackWetness ?? 1] ?? { label: "Dry", cls: "text-white/70" };

  let flagHtml = `<span class="text-emerald-400 font-bold">GREEN</span>`;
  if (flags & 0x00020000) flagHtml = `<span class="px-1.5 rounded-[2px] bg-rose-600 text-white font-black">DQ</span>`;
  else if (flags & 0x00200000) flagHtml = `<span class="px-1.5 rounded-[2px] bg-orange-600 text-white font-black">MEATBALL</span>`;
  else if (flags & 0x00010000) flagHtml = `<span class="px-1.5 rounded-[2px] bg-black border border-rose-500 text-rose-400 font-black">BLACK FLAG</span>`;
  else if (flags & 0x00080000) flagHtml = `<span class="px-1.5 rounded-[2px] bg-amber-500 text-black font-black">SLOW DOWN</span>`;
  else if ((flags & 0x00004100) !== 0) flagHtml = `<span class="px-1.5 rounded-[2px] bg-yellow-500 text-black font-black">CAUTION / FCY</span>`;
  else if (flags & 0x00000008) flagHtml = `<span class="px-1.5 rounded-[2px] bg-yellow-400 text-black font-black">YELLOW</span>`;
  else if (flags & 0x00000020) flagHtml = `<span class="px-1.5 rounded-[2px] bg-blue-600 text-white font-black">BLUE FLAG</span>`;
  else if (flags & 0x00000002) flagHtml = `<span class="px-1.5 rounded-[2px] bg-white text-black font-black">ÚLTIMA VUELTA</span>`;
  else if (flags & 0x00000001) flagHtml = `<span class="px-1.5 rounded-[2px] bg-white text-black font-black">CUADROS</span>`;

  const tempHtml = temp > 0 ? `<span>🌡 ${temp.toFixed(1)}°C${trendStr}</span>` : `<span>🌡 --°C</span>`;
  const wetness = frame.trackWetness ?? 1;
  const playerCompound = frame.carIdxTireCompound?.[state.camCarIdx];
  const optPill =
    wetness >= 4
      ? `<span class="px-1.5 py-0.5 rounded-[2px] bg-[#0ea5e9] text-white font-black text-[9.5px] tracking-wider">${playerCompound === 0 ? "⚠ WET" : "WET"}</span>`
      : wetness === 3
        ? `<span class="px-1.5 py-0.5 rounded-[2px] bg-[#f59e0b] text-black font-black text-[9.5px] tracking-wider animate-pulse">CROSSOVER</span>`
        : `<span class="px-1.5 py-0.5 rounded-[2px] bg-[#f8fafc] text-black font-black text-[9.5px] tracking-wider">SLICK</span>`;

  setHtmlIfChanged(container, `
    <div class="h-[26px] rounded-[2px] border border-white/10 text-white font-mono text-[13px] font-semibold tabular-nums flex items-center whitespace-nowrap select-none" style="width: max-content; padding: 3px 10px; gap: 10px; background: rgba(8, 10, 14, 0.88);">
      ${flagHtml}
      ${tempHtml}
      <span class="${wet.cls}">💧 ${wet.label}</span>
      ${optPill}
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

/**
 * Renders the compact 260x68 Tire IMO, Wear & ABS/TC Electronics monitor (Prompt 104)
 */
export function renderTireStatusWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state) {
    setHtmlIfChanged(container, "");
    return;
  }

  const frame = state.frame;
  const temps = frame.tireTempsC && frame.tireTempsC.length === 12
    ? frame.tireTempsC
    : [78, 80, 76, 80, 79, 75, 74, 76, 75, 75, 76, 74];
  const wear = frame.tireWearPct && frame.tireWearPct.length === 4
    ? frame.tireWearPct
    : [100, 100, 100, 100];

  const tempColor = (c: number): string => {
    if (c < 65) return "#38bdf8";
    if (c <= 92) return "#10b981";
    if (c <= 100) return "#f59e0b";
    return "#ef4444";
  };

  const renderCorner = (label: string, tIdx: number, wIdx: number) => {
    const i = temps[tIdx] ?? 0;
    const m = temps[tIdx + 1] ?? 0;
    const o = temps[tIdx + 2] ?? 0;
    const w = Math.round(wear[wIdx] ?? 100);
    return `
      <div class="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded-[2px] bg-white/[0.04] border border-white/10">
        <span class="text-[8.5px] font-bold text-white/60 w-4">${label}</span>
        <div class="flex items-center gap-0.5">
          <span class="w-3 h-2.5 rounded-[1px] text-[7.5px] font-bold text-black flex items-center justify-center" style="background:${tempColor(i)}">${Math.round(i)}</span>
          <span class="w-3 h-2.5 rounded-[1px] text-[7.5px] font-bold text-black flex items-center justify-center" style="background:${tempColor(m)}">${Math.round(m)}</span>
          <span class="w-3 h-2.5 rounded-[1px] text-[7.5px] font-bold text-black flex items-center justify-center" style="background:${tempColor(o)}">${Math.round(o)}</span>
        </div>
        <span class="text-[8.5px] font-bold ${w > 60 ? "text-emerald-400" : w > 30 ? "text-amber-400" : "text-rose-400"}">${w}%</span>
      </div>
    `;
  };

  const absOn = Boolean(frame.brakeAbsActive);
  const tcOn = ((frame.engineWarnings ?? 0) & 0x10) !== 0 || ((frame.engineWarnings ?? 0) & 0x04) !== 0;

  setHtmlIfChanged(container, `
    <div class="w-[260px] h-[68px] p-1 rounded-[2px] border border-white/10 text-white font-mono tabular-nums flex items-center gap-1.5 select-none" style="background: rgba(8, 10, 14, 0.88);">
      <div class="flex-1 grid grid-cols-2 gap-1">
        ${renderCorner("FL", 0, 0)}
        ${renderCorner("FR", 3, 1)}
        ${renderCorner("RL", 6, 2)}
        ${renderCorner("RR", 9, 3)}
      </div>
      <div class="w-7 flex flex-col gap-1 shrink-0">
        <span class="h-6 rounded-[2px] flex items-center justify-center text-[8.5px] font-black ${absOn ? "bg-amber-400 text-black animate-pulse" : "bg-white/5 text-white/30"}">ABS</span>
        <span class="h-6 rounded-[2px] flex items-center justify-center text-[8.5px] font-black ${tcOn ? "bg-sky-400 text-black animate-pulse" : "bg-white/5 text-white/30"}">TC</span>
      </div>
    </div>
  `);
}

/**
 * Unified CarTelemetryDock (340x118px): Large Fuel Computer + 2x2 4-Tire IMO & Wear Monitor (Prompt 151)
 */
export function renderCarTelemetryDock(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state) {
    setHtmlIfChanged(container, `<div class="text-xs text-white/50 text-center py-8">Esperando telemetría de coche...</div>`);
    return;
  }

  const fuel = state.fuel;
  const frame = state.frame;
  const fuelRemStr = fuel.fuelRemainingL > 0 ? `${fuel.fuelRemainingL.toFixed(1)} L` : "-- L";
  const lapsRemStr = fuel.isValid ? `${fuel.stintLapsRemaining.toFixed(1)} vtas` : "-- vtas";
  const avgStr = fuel.isValid ? `${fuel.avgBurnPerLap.toFixed(2)} L/vta` : "-- L/vta";
  const surplus = fuel.fuelSurplusL ?? 0;
  const needStop = fuel.isValid && fuel.fuelToAdd > 0;
  const pitPillCls = !fuel.isValid
    ? "bg-white/10 text-white/60"
    : needStop
      ? "bg-rose-500/25 border border-rose-400/60 text-rose-300"
      : "bg-emerald-500/20 border border-emerald-400/60 text-emerald-300";
  const pitPillTxt = !fuel.isValid
    ? "--"
    : needStop
      ? `+${fuel.fuelToAdd.toFixed(1)} L`
      : `OK · +${surplus.toFixed(1)} L`;

  const temps = frame.tireTempsC && frame.tireTempsC.length === 12
    ? frame.tireTempsC
    : [78, 80, 76, 80, 79, 75, 74, 76, 75, 75, 76, 74];
  const wear = frame.tireWearPct && frame.tireWearPct.length === 4
    ? frame.tireWearPct
    : [100, 100, 100, 100];

  const tempColor = (c: number): string => {
    if (c < 65) return "#38bdf8";
    if (c <= 92) return "#10b981";
    if (c <= 100) return "#f59e0b";
    return "#ef4444";
  };

  const renderTire = (label: string, tIdx: number, wIdx: number) => {
    const i = temps[tIdx] ?? 0;
    const m = temps[tIdx + 1] ?? 0;
    const o = temps[tIdx + 2] ?? 0;
    const avgT = Math.round((i + m + o) / 3);
    const w = Math.round(wear[wIdx] ?? 100);
    return `
      <div class="rounded-[3px] bg-white/[0.04] border border-white/10 px-2 py-1 space-y-1">
        <div class="flex items-baseline justify-between gap-1">
          <span class="text-[10px] font-bold text-white/60">${label}</span>
          <span class="text-[14px] font-black leading-none ${w > 60 ? "text-emerald-400" : w > 30 ? "text-amber-400" : "text-rose-400"}">${w}%</span>
          <span class="text-[11px] font-bold leading-none" style="color:${tempColor(avgT)}">${avgT}°C</span>
        </div>
        <div class="grid grid-cols-3 gap-1">
          <div class="h-[6px] rounded-[1px]" style="background:${tempColor(i)}" title="Int ${Math.round(i)}°C"></div>
          <div class="h-[6px] rounded-[1px]" style="background:${tempColor(m)}" title="Mid ${Math.round(m)}°C"></div>
          <div class="h-[6px] rounded-[1px]" style="background:${tempColor(o)}" title="Ext ${Math.round(o)}°C"></div>
        </div>
      </div>
    `;
  };

  const absOn = Boolean(frame.brakeAbsActive);
  const tcOn = ((frame.engineWarnings ?? 0) & 0x10) !== 0 || ((frame.engineWarnings ?? 0) & 0x04) !== 0;

  setHtmlIfChanged(container, `
    <div class="space-y-2 select-none">
      <div class="grid grid-cols-3 items-center gap-2 pb-1.5 border-b border-white/10">
        <div>
          <span class="block text-[9px] text-white/55 uppercase">Fuel Actual</span>
          <strong class="block text-[16px] font-black text-white leading-tight">${fuelRemStr}</strong>
          <span class="block text-[10px] text-white/70">${lapsRemStr}</span>
        </div>
        <div class="text-center">
          <span class="block text-[9px] text-white/55 uppercase">Consumo</span>
          <strong class="block text-[13px] font-bold text-sky-300 leading-tight">${avgStr}</strong>
        </div>
        <div class="text-right">
          <span class="block text-[9px] text-white/55 uppercase mb-0.5">Añadir en Box</span>
          <span class="inline-block px-2 py-0.5 rounded-[3px] text-[17px] font-black leading-none ${pitPillCls}">${pitPillTxt}</span>
        </div>
      </div>
      <div class="flex items-stretch gap-2">
        <div class="flex-1 grid grid-cols-2 gap-2">
          ${renderTire("FL", 0, 0)}
          ${renderTire("FR", 3, 1)}
          ${renderTire("RL", 6, 2)}
          ${renderTire("RR", 9, 3)}
        </div>
        <div class="flex flex-col justify-center gap-1.5 w-9 shrink-0">
          <span class="py-1 text-center rounded-[2px] text-[9.5px] font-black ${absOn ? "bg-amber-400 text-black animate-pulse" : "bg-white/5 text-white/30"}">ABS</span>
          <span class="py-1 text-center rounded-[2px] text-[9.5px] font-black ${tcOn ? "bg-sky-400 text-black animate-pulse" : "bg-white/5 text-white/30"}">TC</span>
        </div>
      </div>
    </div>
  `);
}
