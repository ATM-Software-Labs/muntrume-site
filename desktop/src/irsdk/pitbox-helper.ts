/**
 * MMT Sync — Pitbox Helper & Speed Limiter Engine (Bloque 2)
 * High precision pit lane guidance: Pit Speed delta, countdown to your specific pit stall,
 * brake marker warning for pit entry/box, and pitstop service stopwatch.
 */

export interface PitboxInputState {
  onPitRoad: boolean;
  speedKmh: number;
  pitSpeedLimitKmh: number;
  distanceToStallMeters?: number; // Distance in meters to player's specific stall
  pitServiceTimeSeconds?: number;
  inPitTimeSeconds?: number;
}

export class PitboxHelperEngine {
  private pitEntryTime: number | null = null;
  private pitStopTime: number | null = null;

  public evaluatePitState(state: PitboxInputState, now = Date.now()) {
    const limit = state.pitSpeedLimitKmh > 0 ? state.pitSpeedLimitKmh : 80;
    const speed = state.speedKmh || 0;
    const speedDelta = speed - limit;
    const isSpeeding = speedDelta > 0.5;

    // Track pit entry & stop timings
    if (state.onPitRoad) {
      if (!this.pitEntryTime) this.pitEntryTime = now;
      if (speed < 1.0) {
        if (!this.pitStopTime) this.pitStopTime = now;
      }
    } else {
      this.pitEntryTime = null;
      this.pitStopTime = null;
    }

    const inPitSec = this.pitEntryTime ? Math.max(0, (now - this.pitEntryTime) / 1000) : 0;
    const stopSec = this.pitStopTime ? Math.max(0, (now - this.pitStopTime) / 1000) : 0;

    const distToStall = state.distanceToStallMeters ?? 0;
    const shouldBrakeNow = state.onPitRoad && distToStall > 0 && distToStall <= 15;

    return {
      limitKmh: limit,
      speedKmh: Math.round(speed),
      speedDelta: Number(speedDelta.toFixed(1)),
      isSpeeding,
      distToStall: Math.max(0, Math.round(distToStall)),
      shouldBrakeNow,
      inPitSec: Number(inPitSec.toFixed(1)),
      stopSec: Number(stopSec.toFixed(1)),
    };
  }

  public render(container: HTMLElement, state: PitboxInputState): void {
    if (!state.onPitRoad) {
      if (container.innerHTML !== "") container.innerHTML = "";
      return;
    }

    const ev = this.evaluatePitState(state);
    const nearLimit = !ev.isSpeeding && ev.speedDelta >= -2.0;
    const boxBg = ev.isSpeeding
      ? "bg-rose-950/95 border-rose-500 animate-pulse"
      : nearLimit
      ? "bg-amber-950/90 border-amber-400"
      : "bg-emerald-950/85 border-emerald-500/70";
    const speedColor = ev.isSpeeding
      ? "text-rose-300"
      : nearLimit
      ? "text-amber-300"
      : "text-emerald-300";

    const hasDist = ev.distToStall > 0;
    const distPct = hasDist ? Math.max(0, Math.min(100, 100 - (ev.distToStall / 120) * 100)) : 0;
    const distBarHtml = hasDist
      ? `<div class="mt-1 w-full h-2.5 rounded-[2px] bg-black/60 overflow-hidden relative border border-white/10">
           <div class="h-full transition-all duration-75 ${ev.shouldBrakeNow ? "bg-[#00ff88]" : "bg-amber-400"}" style="width:${distPct.toFixed(0)}%"></div>
           <span class="absolute inset-0 flex items-center justify-center text-[8.5px] font-black tracking-wider ${ev.shouldBrakeNow ? "text-[#00ff88]" : "text-white"}">${ev.shouldBrakeNow ? "FRENA / STOP" : `CAJÓN ${ev.distToStall} m`}</span>
         </div>`
      : "";

    container.innerHTML = `
      <div class="w-[280px] px-2.5 py-1.5 rounded-[3px] border ${boxBg} text-white font-mono tabular-nums select-none shadow-lg">
        <div class="flex items-center justify-between text-[11px] whitespace-nowrap">
          <span class="text-amber-300 font-extrabold tracking-wide">${ev.isSpeeding ? "EXCESO PIT" : "PIT LIMITER"}</span>
          <span class="${speedColor} text-sm font-black">${ev.speedKmh}<span class="text-white/55 text-[10px] font-normal">/${ev.limitKmh} km/h</span></span>
          <span class="text-white/90 font-bold text-[10.5px]">${ev.stopSec.toFixed(1)}s</span>
        </div>
        ${distBarHtml}
      </div>
    `;
  }
}
