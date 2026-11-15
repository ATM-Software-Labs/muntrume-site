import type { IrsdkComputedState } from "./types";

export interface ProximityStatus {
  leftActive: boolean;
  leftDouble: boolean;
  rightActive: boolean;
  rightDouble: boolean;
  isThreeWide: boolean;
  amberCount: number;
}

/**
 * Computes lateral & nearby car proximity from iRacing's CarLeftRight SDK enum
 * (0=Clear, 1=Left, 2=Right, 3=3-Wide, 4=2 Left, 5=2 Right) and CarIdxLapDistPct.
 */
export function computeProximityStatus(state: IrsdkComputedState | null): ProximityStatus {
  if (!state) {
    return { leftActive: false, leftDouble: false, rightActive: false, rightDouble: false, isThreeWide: false, amberCount: 0 };
  }

  const clr = state.frame.carLeftRight ?? 0;
  const leftActive = clr === 1 || clr === 3 || clr === 4;
  const rightActive = clr === 2 || clr === 3 || clr === 5;
  const leftDouble = clr === 4;
  const rightDouble = clr === 5;
  const isThreeWide = clr === 3;

  // Count nearby cars within ±1.5% of track length using CarIdxLapDistPct
  let amberCount = 0;
  const myPct = state.frame.carIdxLapDistPct[state.camCarIdx] ?? -1;
  if (myPct >= 0) {
    for (let i = 0; i < state.frame.carIdxLapDistPct.length; i++) {
      if (i === state.camCarIdx) continue;
      const other = state.frame.carIdxLapDistPct[i];
      if (other < 0 || state.frame.carIdxOnPitRoad[i]) continue;
      let diff = Math.abs(other - myPct);
      if (diff > 0.5) diff = 1 - diff;
      if (diff <= 0.015) amberCount++;
    }
  }

  return { leftActive, leftDouble, rightActive, rightDouble, isThreeWide, amberCount };
}

function wingHtml(side: "left" | "right", active: boolean, doubleCar: boolean, amberNear: boolean): string {
  const isRed = active;
  const isAmber = !isRed && amberNear;
  const borderClass = isRed
    ? "border-rose-500/80 bg-rose-950/75 animate-pulse"
    : isAmber
    ? "border-amber-400/70 bg-amber-950/60"
    : "border-white/10 bg-[#0a0c10]/65";

  const barColor = isRed ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.85)]" : isAmber ? "bg-amber-400" : "bg-white/15";
  const label = isRed ? (doubleCar ? "2x COCHE" : side === "left" ? "IZQ" : "DER") : isAmber ? "CERCA" : "LIBRE";
  const textClass = isRed ? "text-rose-200" : isAmber ? "text-amber-200" : "text-white/40";

  return `
    <div class="w-[110px] h-[140px] rounded-xl border ${borderClass} p-2 flex flex-col items-center justify-between transition-colors shadow-lg">
      <span class="text-[9px] font-mono font-bold tracking-wider uppercase ${textClass}">${side === "left" ? "◀ " + label : label + " ▶"}</span>
      <div class="flex items-center justify-center gap-1.5 flex-1 w-full">
        <div class="w-4 h-20 rounded-md ${barColor} transition-all"></div>
        ${doubleCar ? `<div class="w-4 h-16 rounded-md ${barColor} opacity-80"></div>` : ""}
      </div>
      <span class="text-[9px] font-mono ${textClass}">${isRed ? "PARALELO" : isAmber ? "ATENTO" : "OK"}</span>
    </div>
  `;
}

export function renderMirrorProximityWings(container: HTMLElement, state: IrsdkComputedState | null): void {
  const prox = computeProximityStatus(state);
  const activeAny = prox.leftActive || prox.rightActive || prox.amberCount > 0;

  // Auto-hide when completely clear unless in HUD edit mode
  const isEditing = document.documentElement.classList.contains("overlay-editing");
  container.style.opacity = activeAny || isEditing ? "1" : "0.18";

  const threeWideBadge = prox.isThreeWide
    ? `<div class="px-3 py-0.5 rounded-full bg-rose-600/95 border border-rose-300 text-white font-mono text-[10px] font-black tracking-widest uppercase animate-pulse shadow-lg">⚠ 3-WIDE ⚠</div>`
    : `<div class="h-5"></div>`;

  const html = `
    <div class="flex flex-col items-center gap-1">
      ${threeWideBadge}
      <div class="flex items-start justify-between w-[780px] max-w-[96vw]">
        ${wingHtml("left", prox.leftActive, prox.leftDouble, prox.amberCount > 0)}
        <div class="w-[540px] shrink-0 pointer-events-none"></div>
        ${wingHtml("right", prox.rightActive, prox.rightDouble, prox.amberCount > 0)}
      </div>
    </div>
  `;
  if (container.dataset.lastHtml !== html) {
    container.dataset.lastHtml = html;
    container.innerHTML = html;
  }
}
