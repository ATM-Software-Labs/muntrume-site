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
      <div class="p-2.5 rounded-xl bg-black/85 border border-white/10 text-white font-mono select-none" style="will-change: transform;">
        <!-- Header Spotter Status Banner -->
        <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider">
          <span class="text-r-muted">Radar 360° / Spotter</span>
          <span class="px-2 py-0.5 rounded text-[9px] font-black tracking-tight"
            style="background-color: ${spotter.alertColor}25; color: ${spotter.alertColor}; border: 1px solid ${spotter.alertColor}80">
            ${spotter.label}
          </span>
        </div>

        <!-- Radar Graphical Field -->
        <div class="relative w-48 h-32 mx-auto flex items-center justify-center">
          <!-- Concentric Oval Distance Rings -->
          <div class="absolute inset-0 rounded-[50%] border border-white/5 pointer-events-none"></div>
          <div class="absolute inset-3 rounded-[50%] border border-white/10 pointer-events-none"></div>
          <div class="absolute inset-6 rounded-[50%] border border-white/15 pointer-events-none"></div>

          <!-- Ahead Zone -->
          <div class="absolute top-1 inset-x-0 text-center">
            <span class="text-[9px] text-amber-300 font-bold tabular-nums">${aheadDist}</span>
          </div>

          <!-- Left Spotter Wing Indicator -->
          <div class="absolute left-1 inset-y-6 w-5 rounded-lg border flex items-center justify-center transition-colors ${leftPulse}">
            <span class="text-[8px] font-black text-black">IZQ</span>
          </div>

          <!-- Center Car (Player) -->
          <div class="relative z-10 w-9 h-14 rounded-md bg-emerald-500/20 border-2 border-emerald-400 flex flex-col items-center justify-between p-1 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <div class="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
            <span class="text-[8px] font-black text-emerald-300">TÚ</span>
            <div class="w-4 h-0.5 bg-emerald-400/50"></div>
          </div>

          <!-- Right Spotter Wing Indicator -->
          <div class="absolute right-1 inset-y-6 w-5 rounded-lg border flex items-center justify-center transition-colors ${rightPulse}">
            <span class="text-[8px] font-black text-black">DER</span>
          </div>

          <!-- Behind Zone -->
          <div class="absolute bottom-1 inset-x-0 text-center">
            <span class="text-[9px] text-sky-300 font-bold tabular-nums">${behindDist}</span>
          </div>
        </div>
      </div>
    `;
  }
}
