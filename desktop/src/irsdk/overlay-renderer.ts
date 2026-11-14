/**
 * MMT Sync — Kapps 2027 Style Overlay Renderers (Bloque 1)
 * High performance, tabular numeric typography, hardware accelerated classes.
 * Renders Relative Radar (4 ahead, active, 4 behind), Multiclass Standings, and Fuel Computer.
 */

import type { IrsdkComputedState, LeaderboardEntry, RelativeEntry } from "./types";
import { getCarBrandSvg } from "./brand-helper";

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

  const headerHtml = `
    <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
      <div class="flex items-center gap-1.5">
        <span class="text-r-muted">Radar Relativo</span>
        <span class="text-[9px] text-white/40 font-mono">±4 COCHES</span>
      </div>
      <span class="px-1.5 py-0.5 rounded text-[9px] font-mono ${
        isReplay ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
      }">
        ${isReplay ? "REPLAY" : "VIVO"} · #${activeCar?.carNumber || state.camCarIdx}
      </span>
    </div>
  `;

  const rowsHtml = entries
    .map((e: RelativeEntry) => {
      const isSelf = e.isActiveCam;
      const rowBg = isSelf
        ? "bg-emerald-500/20 border-emerald-500/50 shadow-sm"
        : "bg-black/50 border-white/5 hover:border-white/15";

      const deltaClass = isSelf
        ? "text-emerald-400 font-bold"
        : e.isAhead
        ? "text-amber-400 font-bold"
        : "text-sky-300 font-bold";

      const pitBadge = e.onPitRoad
        ? `<span class="px-1 py-0.2 rounded text-[8px] bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold">PIT</span>`
        : "";

      return `
        <div class="flex items-center justify-between gap-1.5 p-1.5 rounded-lg border transition-colors ${rowBg} font-mono">
          <!-- Left: Class + Car Number + Brand + Driver -->
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="px-1 py-0.5 rounded text-[9px] font-bold tracking-tight" style="background-color: ${e.carClassColor}25; color: ${e.carClassColor}; border: 1px solid ${e.carClassColor}50">
              ${e.carClassShortName}
            </span>
            <span class="w-6 text-[11px] font-black text-right ${isSelf ? "text-emerald-300" : "text-white/80"}">
              #${e.carNumber}
            </span>
            ${getCarBrandSvg(e.carPath, 13)}
            <span class="truncate text-[11px] font-medium ${isSelf ? "text-emerald-300 font-bold" : "text-white/90"}">
              ${isSelf ? `${e.abbrevName} (Tú)` : e.abbrevName}
            </span>
            ${pitBadge}
          </div>

          <!-- Right: License & iRating + Delta -->
          <div class="flex items-center gap-2 shrink-0">
            <span class="px-1.5 py-0.5 rounded text-[9px] bg-white/10 tabular-nums font-medium" style="color: ${e.licBadgeColor}">
              ${e.licString.split(" ")[0]} · ${e.iRatingStr}
            </span>
            <span class="w-12 text-right text-xs tabular-nums ${deltaClass}">
              ${e.deltaStr}
            </span>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    ${headerHtml}
    <div class="space-y-1 font-mono text-xs select-none">
      ${rowsHtml}
    </div>
  `;
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
  const isPractice =
    state.session.sessionType.toLowerCase().includes("practice") ||
    state.session.sessionType.toLowerCase().includes("warmup");

  const activeLap = state.frame.carIdxLap[state.camCarIdx] || 1;
  const totalLaps = state.frame.sessionLapsRemainEx > 0 ? activeLap + state.frame.sessionLapsRemainEx : 0;
  const lapStr = totalLaps > 0 ? `VUELTA ${activeLap} / ${totalLaps}` : `VUELTA ${activeLap}`;

  const headerHtml = `
    <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
      <span class="text-r-muted">Clasificación (${isPractice ? "Práctica" : "Carrera"})</span>
      <span class="text-[9px] text-r-muted font-mono">${isPractice ? "TIEMPOS" : lapStr}</span>
    </div>
  `;

  // Display top 8 drivers
  const sliceList = leaderboard.slice(0, 8);

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
        ? "bg-emerald-500/20 border-emerald-500/50 shadow-sm"
        : "bg-black/50 border-white/5";

      const timeVal = isPractice
        ? e.bestLapStr
        : isLeader
        ? "LÍDER"
        : e.gapStr;

      const pitBadge = e.onPitRoad
        ? `<span class="px-1 py-0.2 rounded text-[8px] bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold">PIT</span>`
        : "";

      return `
        <div class="flex items-center justify-between gap-1.5 p-1.5 rounded-lg border transition-colors ${rowBg} font-mono text-xs">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-5 text-[11px] font-bold ${posClass}">P${e.position}</span>
            <span class="px-1 py-0.2 rounded text-[8px] font-bold" style="background-color: ${e.carClassColor}25; color: ${e.carClassColor}">
              ${e.carClassShortName}
            </span>
            ${getCarBrandSvg(e.carPath, 12)}
            <span class="truncate text-[11px] ${isSelf ? "text-emerald-300 font-bold" : "text-white/90 font-medium"}">
              #${e.carNumber} ${e.abbrevName}
            </span>
            ${pitBadge}
          </div>
          <div class="shrink-0 text-right">
            <span class="tabular-nums font-mono text-[11px] ${isLeader ? "text-amber-400 font-bold" : isSelf ? "text-emerald-400 font-bold" : "text-white/80"}">
              ${timeVal}
            </span>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    ${headerHtml}
    <div class="space-y-1 font-mono text-xs select-none">
      ${rowsHtml}
    </div>
  `;
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
    <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10">
      <span class="text-[10px] uppercase text-r-muted font-bold tracking-wider">Ordenador de Combustible</span>
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

  container.innerHTML = `
    ${headerHtml}
    <div class="grid grid-cols-2 gap-2 text-xs font-mono select-none">
      <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-r-muted block text-[10px]">A BORDO</span>
        <strong class="text-white text-base tabular-nums">${fuel.fuelRemainingL} L</strong>
      </div>
      <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-r-muted block text-[10px]">VUELTAS RESTANTES</span>
        <strong class="text-r-accent text-base tabular-nums">${fuel.stintLapsRemaining} v</strong>
      </div>
      <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-r-muted block text-[10px]">CONSUMO MEDIO (5V)</span>
        <strong class="text-white text-sm tabular-nums">${fuel.avgBurnPerLap} L/v</strong>
      </div>
      <div class="p-1.5 rounded-lg bg-black/40 border border-white/5">
        <span class="text-r-muted block text-[10px]">REPOSTAR (+0.2L MARGEN)</span>
        <strong class="${toAddClass} text-sm tabular-nums font-bold">${toAddStr}</strong>
      </div>
    </div>
    <div class="mt-2 flex items-center justify-between text-[9px] text-r-muted font-mono pt-1.5 border-t border-white/5">
      <span>MÁX: ${fuel.maxBurnPerLap} L/v</span>
      <span class="text-emerald-400">LIFT & COAST: ${fuel.liftAndCoastTarget} L/v</span>
      <span>${fuel.completedLapsSampled} v calculadas</span>
    </div>
  `;
}
