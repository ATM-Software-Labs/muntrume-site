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
import { computeClassSof, estimateAllDriversIRatingDeltas, estimateLiveIRating, formatSofShort } from "./irating-calc";

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
  const activeLap = Math.max(0, state.frame.carIdxLap[state.camCarIdx] || 0);
  const remSec = Math.max(0, Math.round(state.frame.sessionTimeRemain || 0));
  const remMin = Math.floor(remSec / 60);
  const remSecPart = String(remSec % 60).padStart(2, "0");
  const sessionClock = `${String(remMin).padStart(2, "0")}:${remSecPart}`;
  const sessType = (state.session.sessionType || "Practice").split(" ")[0];

  const headerHtml = `
    <div class="mmt-rel-header flex items-center justify-between gap-2 whitespace-nowrap">
      <span>${irEst ? `SOF ${formatSofShort(irEst.sof)}` : "REL"} · ⏱ ${sessionClock}</span>
      <span>${trackTempStr ? `${trackTempStr} · ` : ""}${isReplay ? "Replay" : sessType}</span>
    </div>
  `;

  const anyWetCar = (state.frame.carIdxTireCompound || []).some((c) => c === 1);
  const showCompounds = (state.frame.trackWetness ?? 1) >= 3 || (state.frame.precipitationPct ?? 0) > 0 || anyWetCar;

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
      const compoundCell = showCompounds ? renderCompoundBadge(state.frame.carIdxTireCompound?.[e.carIdx]) : "";
      const irDeltaVal = isPractice ? 0 : (irDeltas.get(e.carIdx) ?? 0);
      const irDeltaText = isPractice ? "—" : irDeltaVal > 0 ? `+${Math.round(irDeltaVal)}` : `${Math.round(irDeltaVal)}`;
      const irDeltaColor = isPractice || irDeltaVal === 0 ? "text-white/40" : irDeltaVal > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold";
      const irDeltaCell = isPractice ? `` : `<span class="w-[28px] shrink-0 text-right text-[10.5px] tabular-nums ${irDeltaColor}">${irDeltaText}</span>`;
      const deltaCell = cols.delta
        ? `<span class="w-[36px] shrink-0 text-right text-[11px] tabular-nums ${gapColor}">${gapClean}</span>`
        : ``;

      return `
        <div class="${rowCls}" data-car-idx="${e.carIdx}" style="border-left-color: ${isSelf ? "#10b981" : (e.carClassColor || "#00e699")}">
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

  setHtmlWithFlipAnimation(container, `
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

export interface MulticlassStandingsBlock {
  classKey: string;
  className: string;
  color: string;
  isPlayerClass: boolean;
  totalActive: number;
  rows: CompactStandingsRow[];
  classBestLap: number;
}

const classSpeedOrder = (cls: string): number => {
  const u = cls.toUpperCase();
  if (u.includes("GTP") || u.includes("LMDH") || u.includes("HYP") || u.includes("LMH")) return 1;
  if (u.includes("LMP2")) return 2;
  if (u.includes("LMP3")) return 3;
  if (u.includes("GTE")) return 4;
  if (u.includes("GT3") || u.includes("IMSA")) return 5;
  if (u.includes("GT4")) return 6;
  if (u.includes("TCR")) return 7;
  if (u.includes("MX")) return 8;
  return 9;
};

const resolveRacelabClassColor = (cls: string, fallback: string): string => {
  const u = cls.toUpperCase();
  if (u.includes("GTP") || u.includes("LMDH") || u.includes("LMH")) return "#facc15";
  if (u.includes("LMP2")) return "#38bdf8";
  if (u.includes("GT3") || u.includes("IMSA")) return "#a855f7";
  return fallback || "#38bdf8";
};

/**
 * Racelab-style Multiclass Standings window:
 * - Other classes (e.g. GTP, LMP2): Top 3
 * - Player's class (e.g. GT3/IMSA): Top 10 + player ±1 if outside Top 10
 */
export function buildMulticlassStandingsGroups(leaderboard: LeaderboardEntry[]): MulticlassStandingsBlock[] {
  if (!leaderboard || leaderboard.length === 0) return [];
  const active = leaderboard.find((e) => e.isActiveCam);
  const activeKey = active ? (active.carClassShortName || "ALL").toUpperCase() : "";

  const grouped = new Map<string, { name: string; color: string; entries: LeaderboardEntry[] }>();
  for (const e of leaderboard) {
    const clsName = (e.carClassShortName || "ALL").toUpperCase();
    const g = grouped.get(clsName) ?? {
      name: clsName,
      color: resolveRacelabClassColor(clsName, e.carClassColor),
      entries: [],
    };
    g.entries.push(e);
    grouped.set(clsName, g);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => classSpeedOrder(a[1].name) - classSpeedOrder(b[1].name))
    .map(([classKey, g]) => {
      const isPlayerClass = !activeKey || classKey === activeKey;
      let classBestLap = 0;
      for (const e of g.entries) {
        if (e.bestLapTime > 0 && (classBestLap === 0 || e.bestLapTime < classBestLap)) {
          classBestLap = e.bestLapTime;
        }
      }
      const rows: CompactStandingsRow[] = [];
      if (!isPlayerClass) {
        const top3 = g.entries.slice(0, 3);
        top3.forEach((entry, rankIdx) => rows.push({ kind: "entry", entry, rankIdx }));
      } else {
        const selfIdx = g.entries.findIndex((e) => e.isActiveCam);
        const top10 = g.entries.slice(0, 10);
        top10.forEach((entry, rankIdx) => rows.push({ kind: "entry", entry, rankIdx }));
        if (selfIdx >= 10) {
          rows.push({ kind: "separator" });
          const winStart = Math.max(10, selfIdx - 1);
          const winEnd = Math.min(g.entries.length, selfIdx + 2);
          for (let i = winStart; i < winEnd; i++) {
            rows.push({ kind: "entry", entry: g.entries[i], rankIdx: i });
          }
        }
      }
      return {
        classKey,
        className: g.name,
        color: g.color,
        isPlayerClass,
        totalActive: g.entries.length,
        rows,
        classBestLap,
      };
    });
}

/**
 * Zero-Bloat Standings (legacy helper kept compatible for tests; includes all classes)
 */
export function buildZeroBloatStandings(leaderboard: LeaderboardEntry[]): CompactStandingsRow[] {
  return buildMulticlassStandingsGroups(leaderboard).flatMap((b) => b.rows);
}

/**
 * Renders the Multiclass Standings widget into target DOM container
 */
function renderIncidentPill(state: IrsdkComputedState): string {
  const cur = Math.max(
    0,
    Math.round(
      state.frame.playerCarTeamIncidentCount ??
      state.frame.playerCarMyIncidentCount ??
      0
    )
  );
  const limit = Math.max(0, Math.round(state.session.weekendInfo?.incidentLimit ?? 0));
  const label = limit > 0 ? `INC ${cur}/${limit}x` : `INC ${cur}x`;
  let colorStyle = "color:#10b981;border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.12);";
  if (limit > 0 && limit - cur <= 2) {
    colorStyle = "color:#ef4444;border-color:rgba(239,68,68,0.6);background:rgba(239,68,68,0.18);";
  } else if (limit > 0 && cur >= limit * 0.5) {
    colorStyle = "color:#f59e0b;border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.14);";
  }
  return `<span class="px-1.5 py-0.5 rounded-[2px] border font-mono text-[10px] font-black tabular-nums leading-none" style="${colorStyle}">${label}</span>`;
}

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

  const localClock = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const anyWetCar = (state.frame.carIdxTireCompound || []).some((c) => c === 1);
  const showCompounds = (state.frame.trackWetness ?? 1) >= 3 || (state.frame.precipitationPct ?? 0) > 0 || anyWetCar;

  const headerHtml = `
    <div class="mmt-std-header">
      <div class="flex items-center gap-2">
        <span class="font-bold text-white/90">${sessChar}</span>
        <span class="px-1 rounded-[2px] text-[10px] font-extrabold" style="background:${leadColor}28;color:${leadColor}">${leadClass}</span>
        <span class="text-white">Vta ${activeLap}${validTotalLaps > 0 ? `/${validTotalLaps}` : ""}</span>
        <span class="text-emerald-300 font-bold">⏱ ${remClock}</span>
      </div>
      <div class="flex items-center gap-2 text-white/85">
        ${renderIncidentPill(state)}
        ${tempPart ? `<span>${tempPart}</span>` : ""}
        <span>🕒 ${localClock}</span>
        <span>${leaderboard.length}/${totalSessionCars}</span>
      </div>
    </div>
  `;

  const formatShortLap = (sec: number): string => {
    if (!sec || sec <= 0 || !isFinite(sec)) return "--.-";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}:${s.toFixed(1).padStart(4, "0")}` : s.toFixed(1);
  };

  const classBlocks = buildMulticlassStandingsGroups(leaderboard);
  const irDeltas = estimateAllDriversIRatingDeltas(state);
  const allDrivers = Object.values(state.session.driverInfo?.drivers ?? {});
  const classSofMap = new Map<string, { iRatings: number[]; registered: number }>();
  for (const d of allDrivers) {
    if (d.isPaceCar || d.isSpectator) continue;
    const key = (d.carClassShortName || "ALL").toUpperCase();
    const cur = classSofMap.get(key) ?? { iRatings: [], registered: 0 };
    cur.registered += 1;
    if (d.iRating > 0) cur.iRatings.push(d.iRating);
    classSofMap.set(key, cur);
  }

  const rowsHtml = classBlocks
    .map((group) => {
      const sofData = classSofMap.get(group.classKey);
      const clsSofExact = sofData && sofData.iRatings.length > 0 ? computeClassSof(sofData.iRatings) : 0;
      const clsReg = sofData?.registered || group.totalActive;
      const classHeaderHtml = `
        <div class="mmt-std-class-header flex items-center justify-between px-2 py-1 text-[10.5px] font-mono font-bold" style="border-left: 3px solid ${group.color}; background: ${group.color}1c;">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded-[2px] text-[10px] font-black tracking-wide" style="background:${group.color};color:#090b0f;">${group.className}</span>
            <span class="text-white/80 tabular-nums">${group.totalActive}/${clsReg}</span>
            <span class="text-emerald-300 tabular-nums">${remClock}${validTotalLaps > 0 ? `/${validTotalLaps}v` : ""}</span>
            ${typeof tTrack === "number" && tTrack > 0 ? `<span class="text-white/70 tabular-nums">${tTrack.toFixed(0)}°C</span>` : ""}
          </div>
          <span class="text-white/90 font-extrabold tabular-nums">${clsSofExact > 0 ? `SOF ${clsSofExact}` : `${group.totalActive} coches`}</span>
        </div>
      `;

      const clsRows = group.rows
        .map((row, clsIdx) => {
          if (row.kind === "separator") {
            return `<div class="h-[2px] my-0.5 bg-white/15"></div>`;
          }
          const e = row.entry;
          const idx = row.rankIdx;
          const clsPos = e.classPosition > 0 ? e.classPosition : idx + 1;
          const isLeader = clsPos === 1;
          const isSelf = e.isActiveCam;
          const isOffLap = !isSelf && !isPractice && (e.lapDelta ?? 0) !== 0;
          const posColor = isLeader ? "text-amber-400" : clsPos === 2 ? "text-slate-200" : clsPos === 3 ? "text-amber-600" : "text-white/85";
          const rowCls = `mmt-std-row font-mono${isSelf ? " is-self" : clsIdx % 2 === 1 ? " is-alt" : ""}`;

          const posGlobalCell = cols.position
            ? `<span class="w-[18px] shrink-0 text-center text-[11px] font-black ${posColor}">${clsPos}</span>`
            : ``;
          const deltaPos = e.posDelta ?? 0;
          const posDeltaCell = isPractice
            ? ``
            : deltaPos > 0
            ? `<span class="w-[24px] shrink-0 text-center text-[10px] font-bold text-[#22c55e]">▲${deltaPos}</span>`
            : deltaPos < 0
            ? `<span class="w-[24px] shrink-0 text-center text-[10px] font-bold text-[#ef4444]">▼${Math.abs(deltaPos)}</span>`
            : `<span class="w-[24px] shrink-0 text-center text-[10px] text-white/25">—</span>`;
          const numCell = `<span class="w-[28px] shrink-0 text-center text-[10.5px] font-bold rounded-[2px] ${isSelf ? "bg-emerald-500/20 text-emerald-300" : isOffLap ? "text-[#fbbf24]" : "text-white/85"}">#${e.carNumber}</span>`;

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
          const compoundCell = showCompounds ? renderCompoundBadge(state.frame.carIdxTireCompound?.[e.carIdx]) : "";

          const irDeltaVal = isPractice ? 0 : Math.round(irDeltas.get(e.carIdx) ?? 0);
          const irDeltaHtml = isPractice
            ? ``
            : irDeltaVal > 0
            ? `<span class="w-[44px] shrink-0 mr-3 px-1.5 py-0.5 rounded-[3px] text-right tabular-nums leading-none" style="font-size:12px;font-weight:800;color:#22c55e;background:rgba(34,197,94,0.14);">+${irDeltaVal}</span>`
            : irDeltaVal < 0
            ? `<span class="w-[44px] shrink-0 mr-3 px-1.5 py-0.5 rounded-[3px] text-right tabular-nums leading-none" style="font-size:12px;font-weight:800;color:#ef4444;background:rgba(239,68,68,0.14);">${irDeltaVal}</span>`
            : `<span class="w-[44px] shrink-0 mr-3 px-1.5 py-0.5 rounded-[3px] text-right tabular-nums leading-none text-white/35" style="font-size:12px;font-weight:700;">0</span>`;

          // Hide GAP & INT in Practice/Qualy (Prompt 140) to save ~90px of dead width
          const showRaceGaps = !isPractice && !state.session.sessionType.toLowerCase().includes("qual");
          const gapCell = showRaceGaps
            ? `<span class="w-[46px] shrink-0 text-right tabular-nums text-[10.5px] ${isLeader ? "text-white/55 font-bold" : isOffLap ? "text-[#fbbf24]/90" : "text-white/85 font-semibold"}">${isLeader ? "LDR" : (e.gapStr || "-")}</span>`
            : ``;
          const intCell = showRaceGaps
            ? `<span class="w-[46px] shrink-0 text-right tabular-nums text-[10.5px] text-white/65">${isLeader ? "-" : (e.intervalStr || "-")}</span>`
            : ``;
          const lastCell = `<span class="w-[52px] shrink-0 text-right text-[10.5px] tabular-nums text-white/75">${e.lastLapStr || "--:--.---"}</span>`;

          const pitCell = e.pitStatus === "PIT"
            ? `<span class="w-[26px] shrink-0 text-center px-1 rounded-[2px] bg-amber-500/25 text-amber-300 text-[9px] font-black">PIT</span>`
            : e.pitStatus === "OUT"
            ? `<span class="w-[26px] shrink-0 text-center px-1 rounded-[2px] bg-sky-500/25 text-sky-300 text-[9px] font-black">OUT</span>`
            : e.lapsSincePit !== undefined && e.lapsSincePit > 0
            ? `<span class="w-[26px] shrink-0 text-center text-[9px] text-white/45">${e.lapsSincePit}v</span>`
            : `<span class="w-[26px] shrink-0 text-center text-[9px] text-white/20">•</span>`;

          const isClassBest = group.classBestLap > 0 && e.bestLapTime > 0 && Math.abs(e.bestLapTime - group.classBestLap) < 0.002;
          const bestPrefix = e.bestLapNum && e.bestLapTime > 0 ? `L${e.bestLapNum} ` : "";
          const bestColor = isClassBest ? "text-[#c084fc] font-black" : isSelf ? "text-emerald-400 font-bold" : "text-[#f8fafc] font-semibold";
          const bestCell = `<span class="w-[68px] shrink-0 text-right text-[10.5px] tabular-nums ${bestColor}">${e.bestLapTime > 0 ? `${bestPrefix}${e.bestLapStr}` : "--:--.---"}</span>`;

          const recent = e.recentLaps ?? [];
          const recentSlots = [recent[recent.length - 3], recent[recent.length - 2], recent[recent.length - 1]];
          const recentHtml = recentSlots
            .map((lt) => {
              if (!lt || lt <= 0) return `<span class="w-[34px] text-right text-[9.5px] text-white/20">--.-</span>`;
              const c = group.classBestLap > 0 && Math.abs(lt - group.classBestLap) < 0.002
                ? "text-[#c084fc] font-bold"
                : e.bestLapTime > 0 && Math.abs(lt - e.bestLapTime) < 0.002
                  ? "text-[#4ade80] font-bold"
                  : "text-white/70";
              return `<span class="w-[34px] text-right text-[9.5px] tabular-nums ${c}">${formatShortLap(lt)}</span>`;
            })
            .join("");

          return `
            <div class="${rowCls}" data-car-idx="${e.carIdx}" style="border-left-color: ${isSelf ? "#10b981" : group.color};${isSelf ? "background:rgba(16,185,129,0.16);" : ""}">
              ${posGlobalCell}
              ${posDeltaCell}
              ${numCell}
              ${nameCell}
              ${brandCell}
              ${licIrCell}
              ${compoundCell}
              ${irDeltaHtml}
              ${gapCell}
              ${intCell}
              ${lastCell}
              ${pitCell}
              ${bestCell}
              <span class="hidden xl:inline-flex items-center gap-1 shrink-0 pl-1 border-l border-white/10">${recentHtml}</span>
            </div>
          `;
        })
        .join("");

      return `${classHeaderHtml}${clsRows}`;
    })
    .join("");

  setHtmlWithFlipAnimation(container, `
    ${headerHtml}
    <div class="font-mono tabular-nums select-none overflow-y-auto max-h-[460px]">
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
  const isOtherCar = state.camCarIdx !== state.playerCarIdx || Boolean(state.isReplayPlaying);
  if (isOtherCar) {
    const camEntry = state.leaderboard.find((e) => e.carIdx === state.camCarIdx);
    const stintLaps = camEntry?.lapsSincePit ?? camEntry?.lapsCompleted ?? 0;
    const pits = camEntry?.pitCount ?? 0;
    setHtmlIfChanged(container, `
      <div class="h-[20px] flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
        <span class="text-white/70 font-bold tracking-wider">FUEL · STINT</span>
        <span class="text-sky-300 font-bold">Stint: L${stintLaps} · Pits: ${pits}</span>
      </div>
      <div class="mt-1.5 flex items-center justify-between text-[9.5px] font-mono text-white/60">
        <span>#${camEntry?.carNumber || "--"} ${camEntry?.abbrevName || ""}</span>
        <span class="px-1.5 py-0.5 rounded bg-white/10 text-white/75">Telemetría privada de rival</span>
      </div>
    `);
    return;
  }

  const headerHtml = `
    <div class="h-[20px] flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
      <span class="text-white/70 font-bold tracking-wider">FUEL</span>
      <span class="text-white font-bold">${fuel.fuelRemainingL > 0 ? `${fuel.fuelRemainingL} L` : "-- L"} · ${fuel.isValid ? `${fuel.stintLapsRemaining} v` : "-- v"}</span>
    </div>
  `;

  if (!fuel.isValid) {
    const estBurn = fuel.avgBurnPerLap > 0 ? `~${fuel.avgBurnPerLap.toFixed(2)} L/v` : "-- L/v";
    const estLaps = fuel.stintLapsRemaining > 0 ? `~${fuel.stintLapsRemaining} v` : "-- v";
    setHtmlIfChanged(container, `
      <div class="h-[20px] flex items-center justify-between border-b border-white/10 text-[10px] font-mono tabular-nums whitespace-nowrap">
        <span class="text-white/70 font-bold tracking-wider">FUEL</span>
        <span class="text-white font-bold">${fuel.fuelRemainingL > 0 ? `${fuel.fuelRemainingL} L` : "-- L"} · ${estLaps}</span>
      </div>
      <div class="mt-1 grid gap-0.5 text-[10px] font-mono tabular-nums text-white/65">
        <div class="mmt-fuel-row"><span>Consumo (Est.)</span><span>${estBurn}</span></div>
        <div class="mmt-fuel-row"><span>Estado</span><span class="truncate text-right">${fuel.reasonNotReady || "Calibrando"}</span></div>
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
        : "";

  setHtmlIfChanged(container, `
    <div class="h-[26px] rounded-[2px] border border-white/10 text-white font-mono text-[13px] font-semibold tabular-nums flex items-center whitespace-nowrap select-none" style="width: max-content; padding: 3px 10px; gap: 10px; background: rgba(8, 10, 14, 0.88);">
      ${flagHtml}
      ${tempHtml}
      <span class="${wet.cls}">💧 ${wet.label}</span>
      ${optPill}
      ${renderIncidentPill(state)}
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
  const isOtherCar = state.camCarIdx !== state.playerCarIdx || Boolean(state.isReplayPlaying);
  if (isOtherCar) {
    const camEntry = state.leaderboard.find((e) => e.carIdx === state.camCarIdx);
    const stintLaps = camEntry?.lapsSincePit ?? camEntry?.lapsCompleted ?? 0;
    const pits = camEntry?.pitCount ?? 0;
    setHtmlIfChanged(container, `
      <div class="w-[260px] h-[68px] p-2 rounded-[2px] border border-white/10 text-white font-mono tabular-nums flex flex-col justify-between select-none" style="background: rgba(8, 10, 14, 0.88);">
        <div class="flex items-center justify-between text-[10px]">
          <span class="text-white/70 font-bold">NEUMÁTICOS</span>
          <span class="text-sky-300 font-bold">Stint: L${stintLaps} · Pits: ${pits}</span>
        </div>
        <div class="flex items-center justify-between text-[9.5px] text-white/60">
          <span>#${camEntry?.carNumber || "--"} ${camEntry?.abbrevName || ""}</span>
          <span class="px-1.5 py-0.5 rounded bg-white/10 text-white/75">Telemetría privada de rival</span>
        </div>
      </div>
    `);
    return;
  }
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

  const frame = state.frame;
  const isRemoteCam = state.camCarIdx !== frame.playerCarIdx || Boolean(state.isReplayPlaying);
  if (isRemoteCam) {
    const drv = state.activeDriver;
    const camEntry = state.leaderboard.find((e) => e.carIdx === state.camCarIdx);
    const stintLaps = camEntry?.lapsSincePit ?? camEntry?.lapsCompleted ?? 0;
    const pits = camEntry?.pitCount ?? 0;
    const pos = frame.carIdxPosition[state.camCarIdx] ?? 0;
    const lap = Math.max(0, frame.carIdxLap[state.camCarIdx] ?? 0);
    const lastSec = frame.carIdxLastLapTime[state.camCarIdx] ?? 0;
    const lastStr = lastSec > 0 ? `${Math.floor(lastSec / 60)}:${(lastSec % 60).toFixed(3).padStart(6, "0")}` : "--:--.---";
    setHtmlIfChanged(container, `
      <div class="space-y-2 select-none">
        <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span class="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10px] font-bold">Stint: L${stintLaps} · Pits: ${pits}</span>
          <strong class="text-[13px] text-white truncate max-w-[200px]">#${drv?.carNumber || "?"} ${drv?.abbrevName || "Piloto"}</strong>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center py-2">
          <div><span class="block text-[9px] text-white/55">POSICIÓN</span><strong class="text-[15px] text-emerald-400">P${pos > 0 ? pos : "-"}</strong></div>
          <div><span class="block text-[9px] text-white/55">VUELTA</span><strong class="text-[15px] text-white">${lap}</strong></div>
          <div><span class="block text-[9px] text-white/55">ÚLTIMA</span><strong class="text-[13px] text-sky-300">${lastStr}</strong></div>
        </div>
        <p class="text-[10px] text-white/60 text-center">Telemetría privada de rival</p>
      </div>
    `);
    return;
  }

  const fuel = state.fuel;
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

export function renderDigiFlagPanelWidget(container: HTMLElement, state: IrsdkComputedState, forcePreview = false): void {
  const flags = (state.frame.sessionFlags || 0) | (state.frame.carIdxSessionFlags?.[state.camCarIdx] ?? 0);
  let bg = "";
  let label = "";
  let sub = "";
  let extraStyle = "";

  if (flags & 0x00200000) {
    bg = "background:#ea580c;border-color:#fdba74;color:#fff;";
    label = "MEAT";
    sub = "BOX";
  } else if (flags & 0x00010000) {
    bg = "background:#090b0f;border-color:#ef4444;color:#f87171;";
    label = "BLACK";
    sub = "PEN";
  } else if (flags & 0x00080000) {
    bg = "background:#f59e0b;border-color:#fef08a;color:#090b0f;";
    label = "SLOW";
    sub = "DOWN";
  } else if ((flags & 0x00004100) !== 0) {
    bg = "background:#eab308;border-color:#fef08a;color:#090b0f;";
    label = "FCY";
    sub = "SC";
  } else if (flags & 0x00000008) {
    bg = "background:#facc15;border-color:#fef9c3;color:#090b0f;";
    label = "YEL";
    sub = "WARN";
  } else if (flags & 0x00000020) {
    bg = "background:#2563eb;border-color:#93c5fd;color:#fff;";
    extraStyle = "background-image:linear-gradient(135deg,transparent 42%,rgba(250,204,21,0.92) 42%,rgba(250,204,21,0.92) 58%,transparent 58%);";
    label = "BLUE";
    sub = "PASS";
  } else if (flags & 0x00000002) {
    bg = "background:#f8fafc;border-color:#cbd5e1;color:#090b0f;";
    label = "LAST";
    sub = "LAP";
  } else if (flags & 0x00000001) {
    bg = "background:#111827;border-color:#fff;color:#fff;";
    extraStyle = "background-image:repeating-conic-gradient(#fff 0% 25%,#111827 0% 50%);background-size:16px 16px;";
    label = "FIN";
    sub = "CHECK";
  } else if ((flags & 0x00000004) || forcePreview) {
    bg = "background:#10b981;border-color:#6ee7b7;color:#052e16;";
    label = "GREEN";
    sub = "TRACK";
  }

  if (!label) {
    container.style.display = "none";
    setHtmlIfChanged(container, "");
    return;
  }
  container.style.display = "block";
  setHtmlIfChanged(container, `
    <div class="w-[64px] h-[64px] rounded-[6px] border-2 font-mono flex flex-col items-center justify-center shadow-2xl select-none" style="${bg}${extraStyle}">
      <span class="text-[14px] font-black leading-none tracking-tight drop-shadow">${label}</span>
      <span class="text-[9px] font-extrabold opacity-90 mt-0.5 drop-shadow">${sub}</span>
    </div>
  `);
}

export function renderRejoinHelperWidget(
  container: HTMLElement,
  state: IrsdkComputedState,
  speedKmh: number,
  forcePreview = false
): void {
  const surface = state.frame.carIdxTrackSurface?.[state.camCarIdx] ?? 3;
  const isOffTrackSlow = surface === 0 && speedKmh < 45;
  if (!isOffTrackSlow && !forcePreview) {
    container.style.display = "none";
    setHtmlIfChanged(container, "");
    return;
  }

  const behind = state.relative.entries
    .filter((r) => !r.isActiveCam && r.deltaSeconds < -0.05 && !r.onPitRoad)
    .sort((a, b) => b.deltaSeconds - a.deltaSeconds);
  const nearestSec = behind.length > 0 ? Math.abs(behind[0].deltaSeconds) : forcePreview ? 1.8 : 99;

  let cls = "border-emerald-500/70 bg-emerald-950/92 text-emerald-200";
  let msg = nearestSec >= 20 ? "✓ PISTA DESPEJADA (>20s)" : `✓ TRÁFICO LIBRE EN ${nearestSec.toFixed(1)}s`;
  if (nearestSec < 3.0) {
    cls = "border-rose-500 bg-rose-950/95 text-rose-100 animate-pulse";
    msg = `⚠ ¡NO ENTRAR! COCHE EN ${nearestSec.toFixed(1)}s`;
  } else if (nearestSec < 6.0) {
    cls = "border-amber-500 bg-amber-950/95 text-amber-100";
    msg = `PRECAUCIÓN · COCHE EN ${nearestSec.toFixed(1)}s`;
  }

  container.style.display = "block";
  setHtmlIfChanged(container, `
    <div class="px-3.5 py-2 rounded-[6px] border-2 font-mono text-[12px] font-black tracking-wide whitespace-nowrap shadow-2xl select-none ${cls}">
      ${msg}
    </div>
  `);
}

export function renderFasterCarAlertWidget(
  container: HTMLElement,
  state: IrsdkComputedState,
  forcePreview = false
): void {
  const myEst = state.activeDriver?.carClassEstLapTime || 100;
  const fasterBehind = state.relative.entries
    .filter((r) => !r.isActiveCam && r.deltaSeconds < 0 && r.deltaSeconds >= -1.5 && r.trackSurface > 0 && !r.onPitRoad)
    .find((r) => {
      const drv = state.session.driverInfo?.drivers[r.carIdx];
      const est = drv?.carClassEstLapTime || myEst;
      return myEst - est >= 2.5 || Boolean(state.frame.carIdxOnPitRoad?.[state.camCarIdx]);
    });

  if (!fasterBehind && !forcePreview) {
    container.style.display = "none";
    setHtmlIfChanged(container, "");
    return;
  }

  const clsName = fasterBehind?.carClassShortName || "GTP";
  const carNum = fasterBehind?.carNumber || "7";
  const gap = fasterBehind ? Math.abs(fasterBehind.deltaSeconds).toFixed(1) : "1.1";

  container.style.display = "block";
  setHtmlIfChanged(container, `
    <div class="px-3 py-1.5 rounded-[4px] border border-sky-400/70 bg-sky-950/90 text-sky-100 font-mono text-[11px] font-black whitespace-nowrap shadow-xl flex items-center gap-2 animate-pulse select-none">
      <span class="px-1.5 py-0.5 rounded-[2px] bg-sky-400 text-slate-950 text-[10px]">${clsName}</span>
      <span>▲ COCHE RÁPIDO #${carNum} EN ${gap}s</span>
    </div>
  `);
}

let prevInCar: { bb: number; tc: number; abs: number; map: number; init: boolean } = {
  bb: 0,
  tc: 0,
  abs: 0,
  map: 0,
  init: false,
};
let inCarToast: { title: string; value: string; untilMs: number } | null = null;

export function renderInCarControlsWidget(
  container: HTMLElement,
  state: IrsdkComputedState,
  nowMs: number,
  forcePreview = false
): void {
  const bb = Number((state.frame.dcBrakeBias ?? 0).toFixed(2));
  const tc = Math.round(state.frame.dcTractionControl ?? 0);
  const abs = Math.round(state.frame.dcABS ?? 0);
  const map = Math.round(state.frame.dcFuelMixture ?? 0);

  if (!prevInCar.init) {
    prevInCar = { bb, tc, abs, map, init: true };
  } else {
    if (bb > 0 && Math.abs(bb - prevInCar.bb) >= 0.05) {
      inCarToast = { title: "BRAKE BIAS", value: `${bb.toFixed(1)}%`, untilMs: nowMs + 3000 };
    } else if (tc !== prevInCar.tc && tc > 0) {
      inCarToast = { title: "TRACTION CTRL", value: `TC ${tc}`, untilMs: nowMs + 3000 };
    } else if (abs !== prevInCar.abs && abs > 0) {
      inCarToast = { title: "ABS SETTING", value: `ABS ${abs}`, untilMs: nowMs + 3000 };
    } else if (map !== prevInCar.map && map > 0) {
      inCarToast = { title: "ENGINE MAP", value: `MAP ${map}`, untilMs: nowMs + 3000 };
    }
    prevInCar = { bb, tc, abs, map, init: true };
  }

  const active = inCarToast && nowMs <= inCarToast.untilMs ? inCarToast : forcePreview ? { title: "BRAKE BIAS", value: "54.2%", untilMs: nowMs + 1 } : null;
  if (!active) {
    container.style.display = "none";
    setHtmlIfChanged(container, "");
    return;
  }

  container.style.display = "block";
  setHtmlIfChanged(container, `
    <div class="px-3.5 py-2 rounded-[5px] border border-emerald-400/60 bg-[#090b0f]/92 text-white font-mono flex items-center gap-3 shadow-2xl select-none">
      <span class="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">${active.title}</span>
      <strong class="text-[16px] font-black text-white tabular-nums">${active.value}</strong>
    </div>
  `);
}

export interface LapHistoryEntry {
  lap: number;
  timeSec: number;
}

export function renderLapTimesWidget(
  container: HTMLElement,
  laps: LapHistoryEntry[],
  bestLapSec: number,
  optLapSec: number
): void {
  const recent = laps.slice(-5).reverse();
  const valid = laps.filter((l) => l.timeSec > 10);
  const avgSec = valid.length > 0 ? valid.reduce((a, b) => a + b.timeSec, 0) / valid.length : 0;

  const fmt = (sec: number) => {
    if (!(sec > 0)) return "--:--.---";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(3).padStart(6, "0");
    return m > 0 ? `${m}:${s}` : s;
  };
  const rows =
    recent.length > 0
      ? recent
          .map((l) => {
            const delta = avgSec > 0 ? l.timeSec - avgSec : 0;
            const dStr = avgSec > 0 ? `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}s` : "—";
            const dCls = delta <= -0.05 ? "text-emerald-400" : delta >= 0.15 ? "text-rose-400" : "text-white/75";
            const isBest = bestLapSec > 0 && Math.abs(l.timeSec - bestLapSec) < 0.005;
            return `
              <div class="flex items-center justify-between text-[11px] leading-[17px] border-b border-white/[0.05]">
                <span class="text-white/60">V${l.lap}</span>
                <span class="font-bold ${isBest ? "text-fuchsia-400" : "text-white"}">${fmt(l.timeSec)}</span>
                <span class="${dCls} w-12 text-right">${dStr}</span>
              </div>
            `;
          })
          .join("")
      : `<div class="text-[10.5px] text-white/45 py-2 text-center">Completa una vuelta para ver ritmo</div>`;

  setHtmlIfChanged(container, `
    <div class="w-[240px] rounded-[4px] border border-white/10 bg-[#080a0e]/88 p-2 font-mono text-white select-none tabular-nums">
      <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-emerald-400 pb-1 mb-1 border-b border-white/10">
        <span>Historial Vueltas</span>
        <span class="text-white/60">Últ. 5</span>
      </div>
      <div class="space-y-0.5">${rows}</div>
      <div class="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px]">
        <span class="text-fuchsia-300">Mejor: <strong>${fmt(bestLapSec)}</strong></span>
        <span class="text-sky-300">Ópt: <strong>${fmt(optLapSec)}</strong></span>
      </div>
    </div>
  `);
}

const flipPrevOrder = new WeakMap<HTMLElement, Map<string, { top: number; idx: number }>>();

function setHtmlWithFlipAnimation(container: HTMLElement, html: string): void {
  const prev = new Map<string, { top: number; idx: number }>();
  const oldRows = container.querySelectorAll<HTMLElement>("[data-car-idx]");
  oldRows.forEach((row, idx) => {
    const id = row.dataset.carIdx;
    if (id) prev.set(id, { top: row.offsetTop, idx });
  });

  setHtmlIfChanged(container, html);

  const prevSnap = prev.size > 0 ? prev : flipPrevOrder.get(container);
  if (!prevSnap || prevSnap.size === 0) {
    const nextInit = new Map<string, { top: number; idx: number }>();
    container.querySelectorAll<HTMLElement>("[data-car-idx]").forEach((row, idx) => {
      if (row.dataset.carIdx) nextInit.set(row.dataset.carIdx, { top: row.offsetTop, idx });
    });
    flipPrevOrder.set(container, nextInit);
    return;
  }

  const moved: Array<{ row: HTMLElement; dy: number; gained: boolean; lost: boolean }> = [];
  const nextSnap = new Map<string, { top: number; idx: number }>();
  container.querySelectorAll<HTMLElement>("[data-car-idx]").forEach((row, idx) => {
    const id = row.dataset.carIdx;
    if (!id) return;
    const newTop = row.offsetTop;
    nextSnap.set(id, { top: newTop, idx });
    const old = prevSnap.get(id);
    if (old) {
      const dy = old.top - newTop;
      if (Math.abs(dy) >= 2 && Math.abs(dy) <= 180) {
        moved.push({ row, dy, gained: idx < old.idx, lost: idx > old.idx });
      }
    }
  });
  flipPrevOrder.set(container, nextSnap);

  if (moved.length > 0 && typeof requestAnimationFrame === "function") {
    for (const m of moved) {
      m.row.style.transition = "none";
      m.row.style.transform = `translateY(${m.dy}px)`;
      if (m.gained) m.row.style.backgroundColor = "rgba(16, 185, 129, 0.24)";
      else if (m.lost) m.row.style.backgroundColor = "rgba(239, 68, 68, 0.24)";
    }
    requestAnimationFrame(() => {
      for (const m of moved) {
        m.row.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 400ms ease";
        m.row.style.transform = "translateY(0)";
        setTimeout(() => {
          m.row.style.backgroundColor = "";
        }, 400);
      }
    });
  }
}

let dualDeltaMemory: {
  aheadCarIdx: number;
  aheadRefGap: number;
  aheadTrend: number;
  leaderRefGap: number;
  leaderTrend: number;
  lastSampleMs: number;
} = {
  aheadCarIdx: -1,
  aheadRefGap: 0,
  aheadTrend: 0,
  leaderRefGap: 0,
  leaderTrend: 0,
  lastSampleMs: 0,
};

export function renderRaceDualDeltaWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state || state.leaderboard.length === 0) {
    container.style.display = "none";
    return;
  }
  const sessLower = (state.session.sessionType || "").toLowerCase();
  if (sessLower.includes("practice") || sessLower.includes("qual") || sessLower.includes("warmup")) {
    container.style.display = "none";
    return;
  }

  const myIdx = state.camCarIdx;
  const me = state.leaderboard.find((e) => e.carIdx === myIdx);
  if (!me) {
    container.style.display = "none";
    return;
  }

  const sameClass = state.leaderboard.filter((e) => e.carClassShortName === me.carClassShortName);
  const myClassRank = sameClass.findIndex((e) => e.carIdx === myIdx);
  const carAhead = myClassRank > 0 ? sameClass[myClassRank - 1] : null;
  const classLeader = sameClass.length > 0 && myClassRank > 0 ? sameClass[0] : null;

  if (!carAhead && !classLeader) {
    container.style.display = "none";
    return;
  }

  const parseGapSec = (gapStr?: string): number => {
    if (!gapStr) return 0;
    const clean = gapStr.replace(/[+s]/g, "").trim();
    const val = parseFloat(clean);
    return Number.isFinite(val) ? val : 0;
  };

  const aheadGap = carAhead ? parseGapSec(me.intervalStr) || Math.max(0, parseGapSec(me.gapStr) - parseGapSec(carAhead.gapStr)) : 0;
  const leaderGap = classLeader ? parseGapSec(me.gapStr) : 0;

  const now = Date.now();
  if (now - dualDeltaMemory.lastSampleMs >= 1000) {
    if (carAhead && dualDeltaMemory.aheadCarIdx === carAhead.carIdx && dualDeltaMemory.aheadRefGap > 0) {
      dualDeltaMemory.aheadTrend = aheadGap - dualDeltaMemory.aheadRefGap;
    } else {
      dualDeltaMemory.aheadTrend = 0;
    }
    if (classLeader && dualDeltaMemory.leaderRefGap > 0) {
      dualDeltaMemory.leaderTrend = leaderGap - dualDeltaMemory.leaderRefGap;
    } else {
      dualDeltaMemory.leaderTrend = 0;
    }
    dualDeltaMemory.aheadCarIdx = carAhead?.carIdx ?? -1;
    dualDeltaMemory.aheadRefGap = aheadGap;
    dualDeltaMemory.leaderRefGap = leaderGap;
    dualDeltaMemory.lastSampleMs = now;
  }

  const fmtTrend = (val: number) => {
    const sign = val <= 0 ? "" : "+";
    const cls = val <= -0.02 ? "text-emerald-400" : val >= 0.02 ? "text-rose-400" : "text-white/60";
    return `<span class="${cls}">(${sign}${val.toFixed(2)}s)</span>`;
  };

  container.style.display = "block";
  setHtmlIfChanged(container, `
    <div class="px-3 py-1 rounded-[3px] border border-white/10 bg-[#080a0e]/88 text-white font-mono text-[14px] font-bold tabular-nums flex items-center gap-4 whitespace-nowrap select-none shadow-lg">
      ${carAhead ? `<span>DELANTE (P${carAhead.classPosition || myClassRank}): <strong class="text-white">+${aheadGap.toFixed(2)}s</strong> ${fmtTrend(dualDeltaMemory.aheadTrend)}</span>` : ""}
      ${classLeader ? `<span>LÍDER (P1): <strong class="text-amber-300">+${leaderGap.toFixed(2)}s</strong> ${fmtTrend(dualDeltaMemory.leaderTrend)}</span>` : ""}
    </div>
  `);
}
