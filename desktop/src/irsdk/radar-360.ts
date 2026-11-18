/**
 * MMT Sync — Kapps / Helicorsa Lateral Proximity Radar Engine
 * Invisible (opacity: 0) when CarLeftRight === 0 or in Replay.
 * Renders clean center car silhouette + amber (#f59e0b) for 1 car alongside (1/2/3)
 * and intense red (#ef4444) for 2 cars (4/5), 3-wide, or longitudinal distance < 1.5 m.
 */

import type { IrsdkComputedState } from "./types";

export interface RadarInputState {
  carLeftRight: number; // 0=Clear, 1=CarLeft, 2=CarRight, 3=3Wide, 4=2CarsLeft, 5=2CarsRight
  closestAheadMeters?: number;
  closestBehindMeters?: number;
  minLongitudinalMeters?: number | null;
  speedKmh?: number;
  isReplayPlaying?: boolean;
}

export type SpotterStatus = "clear" | "car_left" | "car_right" | "three_wide";

export class Radar360Engine {
  public evaluateSpotter(carLeftRight: number): { status: SpotterStatus; label: string; alertColor: string } {
    switch (carLeftRight) {
      case 1:
        return { status: "car_left", label: "CAR LEFT", alertColor: "#f59e0b" };
      case 4:
        return { status: "car_left", label: "2 LEFT", alertColor: "#ef4444" };
      case 2:
        return { status: "car_right", label: "CAR RIGHT", alertColor: "#f59e0b" };
      case 5:
        return { status: "car_right", label: "2 RIGHT", alertColor: "#ef4444" };
      case 3:
        return { status: "three_wide", label: "3-WIDE", alertColor: "#ef4444" };
      default:
        return { status: "clear", label: "CLEAR", alertColor: "#10b981" };
    }
  }

  public render(container: HTMLElement, state: RadarInputState): void {
    const clr = state.carLeftRight ?? 0;
    const isEditing = typeof document !== "undefined" && document.documentElement.classList.contains("overlay-editing");
    const isHidden = !isEditing && (Boolean(state.isReplayPlaying) || clr === 0);

    container.style.opacity = isHidden ? "0" : "1";
    container.style.transition = "opacity 120ms ease";

    if (isHidden) {
      return;
    }

    const spotter = this.evaluateSpotter(clr);
    const hasLeft = clr === 1 || clr === 3 || clr === 4;
    const hasRight = clr === 2 || clr === 3 || clr === 5;
    const isDoubleLeft = clr === 4;
    const isDoubleRight = clr === 5;
    const isVeryClose = state.minLongitudinalMeters != null && state.minLongitudinalMeters < 1.5;

    const leftColor = isDoubleLeft || isVeryClose || clr === 3 ? "#ef4444" : "#f59e0b";
    const rightColor = isDoubleRight || isVeryClose || clr === 3 ? "#ef4444" : "#f59e0b";

    const distTag = state.minLongitudinalMeters != null && state.minLongitudinalMeters < 12
      ? `${state.minLongitudinalMeters.toFixed(1)}m`
      : "";

    container.innerHTML = `
      <div class="flex flex-col items-center gap-1 text-white font-mono tabular-nums select-none pointer-events-none" style="will-change: transform;">
        <div class="relative w-[136px] h-[64px] rounded-[3px] flex items-center justify-center" style="background: rgba(9, 11, 15, 0.88); border: 1px solid rgba(255, 255, 255, 0.12);">
          <!-- Left Proximity Block(s) -->
          <div class="absolute left-[10px] inset-y-[8px] flex items-center gap-[3px]">
            ${hasLeft ? `<div class="w-[14px] h-full rounded-[2px]" style="background:${leftColor};box-shadow:0 0 10px ${leftColor}88;"></div>` : `<div class="w-[14px] h-full rounded-[2px] bg-white/[0.04]"></div>`}
            ${isDoubleLeft ? `<div class="w-[10px] h-[82%] rounded-[2px]" style="background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.6);"></div>` : ""}
          </div>

          <!-- Center Own Car Silhouette -->
          <div class="relative z-10 w-[22px] h-[44px] rounded-[3px] flex flex-col items-center justify-between py-[4px]" style="background: rgba(16, 185, 129, 0.22); border: 1.5px solid #10b981;">
            <div class="w-[10px] h-[4px] rounded-[1px] bg-emerald-300/90"></div>
            <div class="w-[12px] h-[2px] rounded-full bg-emerald-400/50"></div>
          </div>

          <!-- Right Proximity Block(s) -->
          <div class="absolute right-[10px] inset-y-[8px] flex items-center gap-[3px]">
            ${isDoubleRight ? `<div class="w-[10px] h-[82%] rounded-[2px]" style="background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,0.6);"></div>` : ""}
            ${hasRight ? `<div class="w-[14px] h-full rounded-[2px]" style="background:${rightColor};box-shadow:0 0 10px ${rightColor}88;"></div>` : `<div class="w-[14px] h-full rounded-[2px] bg-white/[0.04]"></div>`}
          </div>
        </div>
        <div class="flex items-center gap-1.5 px-2 py-[1px] rounded-[3px] text-[9.5px] font-black tracking-wider uppercase leading-tight"
          style="background: rgba(9, 11, 15, 0.88); color: ${spotter.alertColor}; border: 1px solid ${spotter.alertColor}66;">
          <span>${spotter.label}</span>
          ${distTag ? `<span class="text-white/75">${distTag}</span>` : ""}
        </div>
      </div>
    `;
  }
}

const helicorsaEngine = new Radar360Engine();

/**
 * Computes longitudinal distance from carIdxLapDistPct * trackLengthMeters and renders Kapps/Helicorsa radar.
 */
export function renderHelicorsaRadar(container: HTMLElement, state: IrsdkComputedState | null): void {
  if (!state) {
    helicorsaEngine.render(container, { carLeftRight: 0, isReplayPlaying: true });
    return;
  }

  const clr = state.frame.carLeftRight ?? 0;
  const trackLenM = Math.max(1000, state.session.weekendInfo?.trackLengthM || 4500);
  const myPct = state.frame.carIdxLapDistPct[state.camCarIdx] ?? -1;
  let minLongMeters: number | null = null;

  if (myPct >= 0 && clr !== 0) {
    for (let i = 0; i < state.frame.carIdxLapDistPct.length; i++) {
      if (i === state.camCarIdx) continue;
      const other = state.frame.carIdxLapDistPct[i];
      if (other < 0 || state.frame.carIdxOnPitRoad[i]) continue;
      let diff = other - myPct;
      if (diff > 0.5) diff -= 1;
      if (diff < -0.5) diff += 1;
      const distM = Math.abs(diff * trackLenM);
      if (minLongMeters === null || distM < minLongMeters) {
        minLongMeters = distM;
      }
    }
  }

  helicorsaEngine.render(container, {
    carLeftRight: clr,
    minLongitudinalMeters: minLongMeters,
    isReplayPlaying: Boolean(state.isReplayPlaying),
  });
}
