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
    const speedColor = ev.isSpeeding ? "text-rose-400 animate-pulse" : "text-emerald-300";
    const borderColor = ev.isSpeeding ? "border-rose-500/80" : "border-amber-400/50";

    container.innerHTML = `
      <div class="w-[280px] h-[26px] px-2.5 rounded border ${borderColor} bg-[#0a0c10]/94 text-white font-mono text-[11px] tabular-nums flex items-center justify-between select-none shadow-md whitespace-nowrap">
        <span class="text-amber-400 font-extrabold tracking-wide">IN PIT LANE</span>
        <span class="${speedColor} font-black">${ev.speedKmh}<span class="text-white/45 font-normal">/${ev.limitKmh}</span></span>
        <span class="text-white/90 font-bold">${ev.stopSec.toFixed(1)}s</span>
      </div>
    `;
  }
}
