/**
 * MMT Sync — 360° Proximity Radar & Spotter Engine (Bloque 2)
 * High-framerate visual spotter radar mapping CarLeftRight SDK values and relative distances.
 * Warns driver of cars alongside (Car Left, Car Right, 3-Wide) and trailing cars (< 15m).
 */

export interface RadarInputState {
  carLeftRight: number; // 0=Clear, 1=CarLeft, 2=CarRight, 3=3Wide, 4=2CarsLeft, 5=2CarsRight
  closestAheadMeters?: number;
  closestBehindMeters?: number;
  speedKmh?: number;
}

export type SpotterStatus = "clear" | "car_left" | "car_right" | "three_wide";

export class Radar360Engine {
  public evaluateSpotter(carLeftRight: number): { status: SpotterStatus; label: string; alertColor: string } {
    switch (carLeftRight) {
      case 1:
      case 4:
        return { status: "car_left", label: "COCHE A LA IZQUIERDA", alertColor: "#f97316" };
      case 2:
      case 5:
        return { status: "car_right", label: "COCHE A LA DERECHA", alertColor: "#f97316" };
      case 3:
        return { status: "three_wide", label: "¡TRES EN PARALELO!", alertColor: "#ef4444" };
      default:
        return { status: "clear", label: "PISTA DESPEJADA", alertColor: "#10b981" };
    }
  }

  public render(container: HTMLElement, state: RadarInputState): void {
    const spotter = this.evaluateSpotter(state.carLeftRight);
    const hasLeft = spotter.status === "car_left" || spotter.status === "three_wide";
    const hasRight = spotter.status === "car_right" || spotter.status === "three_wide";

    const leftPulse = hasLeft ? "bg-orange-500/80 animate-pulse border-orange-300" : "bg-white/5 border-transparent";
    const rightPulse = hasRight ? "bg-orange-500/80 animate-pulse border-orange-300" : "bg-white/5 border-transparent";

    const aheadDist = state.closestAheadMeters != null && state.closestAheadMeters < 30
      ? `${state.closestAheadMeters.toFixed(1)} m`
      : "";
    const behindDist = state.closestBehindMeters != null && state.closestBehindMeters < 30
      ? `${state.closestBehindMeters.toFixed(1)} m`
      : "";

    container.innerHTML = `
      <div class="flex flex-col items-center gap-1 text-white font-mono select-none" style="will-change: transform;">
        <div class="relative w-28 h-14 flex items-center justify-center">
          <div class="absolute inset-0 rounded-lg border border-white/10 bg-black/50 pointer-events-none"></div>

          ${aheadDist ? `<span class="absolute top-0.5 inset-x-0 text-center text-[8px] text-amber-300 font-bold tabular-nums leading-none">${aheadDist}</span>` : ""}

          <!-- Left Proximity Bar -->
          <div class="absolute left-1 inset-y-1.5 w-3 rounded border flex items-center justify-center transition-colors ${leftPulse}">
            ${hasLeft ? `<span class="text-[7px] font-black text-black">◀</span>` : ""}
          </div>

          <!-- Minimalist Center Car -->
          <div class="relative z-10 w-5 h-9 rounded bg-emerald-500/25 border border-emerald-400/80 flex items-center justify-center">
            <div class="w-1 h-1 rounded-full bg-emerald-300"></div>
          </div>

          <!-- Right Proximity Bar -->
          <div class="absolute right-1 inset-y-1.5 w-3 rounded border flex items-center justify-center transition-colors ${rightPulse}">
            ${hasRight ? `<span class="text-[7px] font-black text-black">▶</span>` : ""}
          </div>

          ${behindDist ? `<span class="absolute bottom-0.5 inset-x-0 text-center text-[8px] text-sky-300 font-bold tabular-nums leading-none">${behindDist}</span>` : ""}
        </div>
        <span class="px-1.5 py-[1px] rounded text-[8px] font-black tracking-wider uppercase leading-none"
          style="background-color: ${spotter.alertColor}22; color: ${spotter.alertColor}; border: 1px solid ${spotter.alertColor}66">
          ${spotter.label}
        </span>
      </div>
    `;
  }
}
