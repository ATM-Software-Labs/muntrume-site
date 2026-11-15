/**
 * MMT Sync — Kapps 2027 Style Overlay Renderers (Bloque 1 & 2)
 * High performance 60 FPS GPU-accelerated renderers, tabular numeric typography,
 * SVG local brand mappers, Driver Tags badges, Streamer Mode,
 * Radar 360°, Pitbox Helper, and DigiFlag.
 */

import type { IrsdkComputedState, LeaderboardEntry, RelativeEntry } from "./types";
import { getCarBrandSvg } from "./brand-helper";
import { DriverTagsManager } from "./driver-tags";
import { SmartLayoutManager } from "./smart-layouts";
import { GpuPedalsEngine, type PedalsSample } from "./gpu-pedals";
import { Radar360Engine, type RadarInputState } from "./radar-360";
import { PitboxHelperEngine, type PitboxInputState } from "./pitbox-helper";
import { DigiFlagEngine } from "./digi-flag";
import { ThemeEngine } from "../theme/theme-engine";
import { estimateAllDriversIRatingDeltas, estimateLiveIRating, formatIRatingDelta, formatSofShort } from "./irating-calc";

const lastRenderedHtml = new WeakMap<HTMLElement, string>();
function setHtmlIfChanged(container: HTMLElement, html: string): void {
  if (lastRenderedHtml.get(container) === html) return;
  lastRenderedHtml.set(container, html);
  container.innerHTML = html;
}

const LICENSE_BADGE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  A: { bg: "#0284c7", border: "#38bdf8", text: "#ffffff" },
  B: { bg: "#16a34a", border: "#4ade80", text: "#ffffff" },
  C: { bg: "#ca8a04", border: "#facc15", text: "#ffffff" },
  D: { bg: "#ea580c", border: "#fb923c", text: "#ffffff" },
  R: { bg: "#dc2626", border: "#f87171", text: "#ffffff" },
  P: { bg: "#05070a", border: "rgba(255,255,255,0.55)", text: "#ffffff" },
};

function renderLicenseBadge(licString: string | undefined): string {
  const code = (licString || "R 0.0").replace(/\s+/g, "");
  const letter = code.charAt(0).toUpperCase();
  const palette = LICENSE_BADGE_STYLES[letter] ?? { bg: "#475569", border: "#94a3b8", text: "#ffffff" };
  return `<span class="px-1 py-[1px] rounded-[3px] text-[9px] font-bold tabular-nums leading-none" style="background-color:${palette.bg};color:${palette.text};border:1px solid ${palette.border}">${code}</span>`;
}

function renderDriverIrDelta(delta: number | undefined): string {
  if (delta === undefined || !Number.isFinite(delta)) return "";
  const sign = delta > 0 ? "+" : "";
  const cls = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-white/45";
  return `<span class="w-7 text-right text-[9px] font-bold tabular-nums ${cls}">${sign}${delta}</span>`;
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
  const activeCar = state.activeDriver;
  const isStreamer = SmartLayoutManager.getInstance().isStreamerMode();
  const driverTags = DriverTagsManager.getInstance();
  const cols = ThemeEngine.getInstance().getColumnsConfig().relative;
  const irEst = estimateLiveIRating(state);
  const irDeltas = estimateAllDriversIRatingDeltas(state);
  const isMulticlass = new Set(entries.map((x) => x.carClassShortName)).size > 1;
  const irPill = irEst
    ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tabular-nums ${
        irEst.delta >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
      }">${formatIRatingDelta(irEst.delta)}</span>`
    : "";
  const sofPill = irEst
    ? `<span class="text-[9px] text-white/55 font-mono tabular-nums">SOF ${formatSofShort(irEst.sof)}</span>`
    : "";

  const headerHtml = `
    <div class="flex items-center justify-between pb-1 mb-1.5 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
      <div class="flex items-center gap-1.5">
        <span class="text-white/60">REL</span>
        ${sofPill}
        ${irPill}
        ${isStreamer ? `<span class="px-1 py-0.2 rounded text-[8px] bg-purple-500/20 text-purple-300">STREAMER</span>` : ""}
      </div>
      <span class="px-1.5 py-0.2 rounded text-[9px] font-mono tabular-nums ${
        isReplay ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
      }">
        ${isReplay ? "REPLAY" : "LIVE"} · #${activeCar?.carNumber || state.camCarIdx}
      </span>
    </div>
  `;

  const rowsHtml = entries
    .map((e: RelativeEntry) => {
      const isSelf = e.isActiveCam;
      const rowBg = isSelf
        ? "bg-[#00e699]/18"
        : "bg-[#0a0c10]/88 odd:bg-[#0e1218]/88";

      const deltaClass = isSelf
        ? "text-[#00e699] font-extrabold"
        : e.isAhead
        ? "text-amber-300 font-bold"
        : "text-sky-300 font-bold";

      const pitBadge = cols.pitStatus && e.onPitRoad
        ? `<span class="px-1 rounded-[2px] text-[8px] bg-rose-500/30 text-rose-200 font-bold">PIT</span>`
        : "";

      const tagBadge = driverTags.renderBadgeHtml(e.cust_id || e.driverName || e.carNumber);

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : isSelf ? `${e.abbrevName}` : e.abbrevName;

      const classSpan = cols.carClass && isMulticlass
        ? `<span class="px-1 rounded-[2px] text-[8px] font-bold tracking-tight" style="background-color: ${e.carClassColor}28; color: ${e.carClassColor}">${e.carClassShortName}</span>`
        : "";

      const numSpan = cols.carNumber
        ? `<span class="min-w-[20px] text-[10px] font-bold text-center px-1 rounded-[2px] ${isSelf ? "bg-[#00e699]/25 text-[#00e699]" : "bg-white/10 text-white/80"}">#${e.carNumber}</span>`
        : "";

      const brandSvg = cols.brandIcon ? getCarBrandSvg(e.carPath, 11) : "";

      const nameSpan = cols.driverName
        ? `<span class="truncate text-[11px] font-medium ${isSelf ? "text-white font-bold" : "text-white/90"}">${displayName}</span>`
        : "";

      const licSpan = cols.license ? renderLicenseBadge(e.licString) : "";
      const irSpan = cols.iRating && e.iRatingStr
        ? `<span class="w-7 text-right text-[9px] text-white/60 tabular-nums">${e.iRatingStr}</span>`
        : "";
      const irDeltaSpan = cols.iRating ? renderDriverIrDelta(irDeltas.get(e.carIdx)) : "";

      const deltaSpan = cols.delta
        ? `<span class="w-10 text-right text-[11px] tabular-nums ${deltaClass}">${e.deltaStr}</span>`
        : "";

      return `
        <div class="flex items-center justify-between gap-1 px-2 py-[3px] ${rowBg} font-mono" style="border-left: 3px solid ${e.carClassColor || "#00e699"}">
          <div class="flex items-center gap-1 min-w-0 flex-1">
            ${classSpan}
            ${numSpan}
            ${brandSvg}
            ${nameSpan}
            ${tagBadge}
            ${pitBadge}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${licSpan}
            ${irSpan}
            ${irDeltaSpan}
            ${deltaSpan}
          </div>
        </div>
      `;
    })
    .join("");

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="divide-y divide-white/[0.04] rounded overflow-hidden font-mono text-xs select-none">
      ${rowsHtml}
    </div>
  `);
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
  const driverTags = DriverTagsManager.getInstance();
  const cols = ThemeEngine.getInstance().getColumnsConfig().leaderboard;

  const isPractice =
    state.session.sessionType.toLowerCase().includes("practice") ||
    state.session.sessionType.toLowerCase().includes("warmup");

  const activeLap = state.frame.carIdxLap[state.camCarIdx] || 1;
  const totalLaps = state.frame.sessionLapsRemainEx > 0 ? activeLap + state.frame.sessionLapsRemainEx : 0;
  const lapStr = totalLaps > 0 ? `L${activeLap}/${totalLaps}` : `L${activeLap}`;
  const irEst = estimateLiveIRating(state);
  const sofPill = irEst
    ? `<span class="text-[9px] text-white/55 font-mono tabular-nums">SOF ${formatSofShort(irEst.sof)}</span>`
    : "";
  const irPill = irEst
    ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold tabular-nums ${
        irEst.delta >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
      }">${formatIRatingDelta(irEst.delta)}</span>`
    : "";

  const headerHtml = `
    <div class="flex items-center justify-between pb-1 mb-1 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
      <div class="flex items-center gap-1.5">
        <span class="text-white/60">${isPractice ? "PRAC" : "RACE"}</span>
        ${sofPill}
        ${irPill}
        ${isStreamer ? `<span class="px-1 py-0.2 rounded text-[8px] bg-purple-500/20 text-purple-300">STREAMER</span>` : ""}
      </div>
      <span class="text-[9px] text-white/60 font-mono tabular-nums">${isPractice ? "BEST" : lapStr}</span>
    </div>
    ${(() => {
      const tTrack = state.frame.trackTempC;
      const tAir = state.frame.airTempC;
      const rain = state.frame.precipitationPct ?? 0;
      const wind = state.frame.windKmh ?? 0;
      if (typeof tTrack !== "number" || tTrack <= 0) return "";
      const rainLabel = rain > 0 ? `<span class="text-sky-300 font-bold">LLUVIA ${Math.round(rain)}%</span>` : `<span class="text-emerald-300">SECO</span>`;
      return `<div class="flex items-center justify-between pb-1 mb-1 text-[9px] font-mono tabular-nums text-white/65 border-b border-white/[0.06]">
        <span>PISTA <strong class="text-amber-300">${tTrack.toFixed(1)}°</strong> · AIRE ${typeof tAir === "number" ? tAir.toFixed(1) : "--"}°</span>
        <span>${wind > 0 ? `${Math.round(wind)}km/h · ` : ""}${rainLabel}</span>
      </div>`;
    })()}
  `;

  // Display top 10 drivers (compact Kapps Pro density)
  const sliceList = leaderboard.slice(0, 10);
  const irDeltas = estimateAllDriversIRatingDeltas(state);
  const isMulticlass = new Set(sliceList.map((x) => x.carClassShortName)).size > 1;

  const rowsHtml = sliceList
    .map((e: LeaderboardEntry, idx: number) => {
      const isLeader = idx === 0;
      const isSelf = e.isActiveCam;
      const posClass = isLeader
        ? "text-amber-400 font-black"
        : idx === 1
        ? "text-slate-200 font-bold"
        : idx === 2
        ? "text-amber-600 font-bold"
        : "text-white/70";

      const rowBg = isSelf
        ? "bg-[#00e699]/18"
        : "bg-[#0a0c10]/88 odd:bg-[#0e1218]/88";

      const timeVal = isPractice
        ? e.bestLapStr
        : isLeader
        ? "LEADER"
        : e.gapStr;

      const posSpan = cols.position
        ? `<span class="w-4 text-[10px] font-bold tabular-nums ${posClass}">${e.position}</span>`
        : "";

      const classSpan = cols.classPosition && isMulticlass
        ? `<span class="px-1 rounded-[2px] text-[8px] font-bold" style="background-color: ${e.carClassColor}28; color: ${e.carClassColor}">${e.carClassShortName}</span>`
        : "";

      const brandSvg = cols.brandIcon ? getCarBrandSvg(e.carPath, 11) : "";

      const displayName = isStreamer
        ? isSelf ? "Piloto (Tú)" : `Piloto #${e.carNumber}`
        : `${cols.carNumber && e.carNumber ? `#${e.carNumber} ` : ""}${cols.driverName ? e.abbrevName : ""}`;

      const nameSpan = displayName
        ? `<span class="truncate text-[11px] ${isSelf ? "text-white font-bold" : "text-white/90 font-medium"}">${displayName}</span>`
        : "";

      const pitBadge = cols.pitStatus && e.onPitRoad
        ? `<span class="px-1 rounded-[2px] text-[8px] bg-rose-500/30 text-rose-200 font-bold">PIT</span>`
        : "";

      const tagBadge = driverTags.renderBadgeHtml(e.cust_id || e.driverName || e.carNumber);

      const licBadge = e.licString ? renderLicenseBadge(e.licString) : "";

      const irBadge = cols.iRating && e.iRatingStr
        ? `<span class="w-7 text-right text-[9px] text-white/60 tabular-nums">${e.iRatingStr}</span>`
        : "";
      const irDeltaBadge = cols.iRating ? renderDriverIrDelta(irDeltas.get(e.carIdx)) : "";

      const timeSpan = (isPractice ? cols.bestLap : cols.gap)
        ? `<span class="w-12 text-right tabular-nums font-mono text-[10px] ${isLeader ? "text-amber-300 font-bold" : isSelf ? "text-[#00e699] font-bold" : "text-white/85"}">${timeVal}</span>`
        : "";

      return `
        <div class="flex items-center justify-between gap-1 px-2 py-[3px] ${rowBg} font-mono text-xs" style="border-left: 3px solid ${e.carClassColor || "#38bdf8"}">
          <div class="flex items-center gap-1 min-w-0 flex-1">
            ${posSpan}
            ${classSpan}
            ${brandSvg}
            ${nameSpan}
            ${tagBadge}
            ${pitBadge}
          </div>
          <div class="flex items-center gap-1 shrink-0 text-right">
            ${licBadge}
            ${irBadge}
            ${irDeltaBadge}
            ${timeSpan}
          </div>
        </div>
      `;
    })
    .join("");

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="divide-y divide-white/[0.04] rounded overflow-hidden font-mono text-xs select-none">
      ${rowsHtml}
    </div>
  `);
}

/**
 * Renders the Fuel Computer widget into target DOM container
 */
export function renderFuelWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const cols = ThemeEngine.getInstance().getColumnsConfig().fuel;
  if (!state) {
    container.innerHTML = `
      <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Ordenador de Combustible</div>
      <div class="p-3 text-center text-xs text-white/50 font-mono">Esperando lectura de telemetría...</div>
    `;
    return;
  }

  const fuel = state.fuel;
  const isPit = state.onPitRoad;
  const isReplay = state.isReplayPlaying;

  const statusBadge = fuel.isValid
    ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-emerald-500/20 text-emerald-300 font-mono">ACTIVO</span>`
    : isReplay
    ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-300 font-mono">REPLAY</span>`
    : isPit
    ? `<span class="px-1.5 py-0.5 rounded text-[8px] bg-rose-500/20 text-rose-300 font-mono">BOXES</span>`
    : `<span class="px-1.5 py-0.5 rounded text-[8px] bg-amber-500/20 text-amber-300 font-mono">CALIBRANDO</span>`;

  const headerHtml = `
    <div class="flex items-center justify-between pb-1 mb-1.5 border-b border-white/10">
      <span class="text-[10px] uppercase text-white/60 font-bold tracking-wider">FUEL</span>
      ${statusBadge}
    </div>
  `;

  if (!fuel.isValid) {
    container.innerHTML = `
      ${headerHtml}
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
          <span class="text-r-muted block text-[10px]">A BORDO</span>
          <strong class="text-white text-base tabular-nums">${fuel.fuelRemainingL > 0 ? fuel.fuelRemainingL : "--"} L</strong>
        </div>
        <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
          <span class="text-r-muted block text-[10px]">VUELTAS RESTANTES</span>
          <strong class="text-r-muted text-base tabular-nums">--</strong>
        </div>
        <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
          <span class="text-r-muted block text-[10px]">BURN RATE (5V)</span>
          <strong class="text-amber-400 text-sm tabular-nums">-- L/v</strong>
        </div>
        <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
          <span class="text-r-muted block text-[10px]">PARA META (+0.2L)</span>
          <strong class="text-amber-400 text-sm tabular-nums">-- L</strong>
        </div>
      </div>
      <div class="mt-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-sans">
        ${fuel.reasonNotReady || "Protección de boxes/replays activada"}
      </div>
    `;
    return;
  }

  const toAddStr = fuel.fuelToAdd > 0 ? `+${fuel.fuelToAdd} L` : "SUFICIENTE";
  const toAddClass = fuel.fuelToAdd > 0 ? "text-amber-400" : "text-emerald-400";

  const cardsHtml = [
    cols.remainingL
      ? `<div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
           <span class="text-r-muted block text-[10px]">A BORDO</span>
           <strong class="text-white text-base tabular-nums">${fuel.fuelRemainingL} L</strong>
         </div>`
      : "",
    cols.lapsRemaining
      ? `<div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
           <span class="text-r-muted block text-[10px]">VUELTAS RESTANTES</span>
           <strong class="text-r-accent text-base tabular-nums">${fuel.stintLapsRemaining} v</strong>
         </div>`
      : "",
    cols.avgBurn
      ? `<div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
           <span class="text-r-muted block text-[10px]">CONSUMO MEDIO (5V)</span>
           <strong class="text-white text-sm tabular-nums">${fuel.avgBurnPerLap} L/v</strong>
         </div>`
      : "",
    cols.fuelToAdd
      ? `<div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
           <span class="text-r-muted block text-[10px]">REPOSTAR (+0.2L MARGEN)</span>
           <strong class="${toAddClass} text-sm tabular-nums font-bold">${toAddStr}</strong>
         </div>`
      : "",
  ].filter(Boolean).join("");

  const fuelPct = Math.max(0, Math.min(100, Math.round(fuel.fuelRemainingPct || 0)));
  const barColor = fuelPct < 15 ? "#f43f5e" : fuelPct < 35 ? "#f59e0b" : "#10b981";

  setHtmlIfChanged(container, `
    ${headerHtml}
    <div class="mb-2">
      <div class="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div class="h-full rounded-full transition-all duration-300" style="width:${fuelPct}%;background:${barColor}"></div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-1.5 text-xs font-mono select-none">
      ${cardsHtml}
    </div>
    <div class="mt-2 flex items-center justify-between text-[9px] text-r-muted font-mono pt-1.5 border-t border-white/10">
      <span>MÁX ${fuel.maxBurnPerLap} L/v</span>
      <span class="text-emerald-300 font-bold">L&amp;C ${fuel.liftAndCoastTarget} L/v</span>
      <span>${fuel.completedLapsSampled}v</span>
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
