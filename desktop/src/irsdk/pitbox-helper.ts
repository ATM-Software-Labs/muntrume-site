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
      container.innerHTML = `
        <div class="p-2 rounded-xl bg-black/80 border border-white/10 text-white font-mono select-none">
          <div class="flex items-center justify-between pb-1 border-b border-white/10 text-[10px] font-bold text-r-muted uppercase tracking-wider">
            <span>Pitbox Helper</span>
            <span class="text-[9px] text-white/40">EN PISTA</span>
          </div>
          <div class="p-2 text-center text-xs text-white/40">Listo para entrada en pitlane</div>
        </div>
      `;
      return;
    }

    const ev = this.evaluatePitState(state);

    const speedCardClass = ev.isSpeeding
      ? "bg-rose-500/30 border-rose-500 text-rose-300 animate-pulse"
      : "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";

    const stallActionClass = ev.shouldBrakeNow
      ? "bg-rose-600 text-white animate-bounce font-black"
      : "bg-white/10 text-amber-300";

    container.innerHTML = `
      <div class="p-2.5 rounded-xl bg-black/90 border border-white/15 text-white font-mono select-none shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider">
          <span class="text-amber-400">Pit Lane Activo</span>
          <span class="px-2 py-0.5 rounded text-[9px] font-black ${ev.isSpeeding ? "bg-rose-500 text-white" : "bg-emerald-500/30 text-emerald-300"}">
            ${ev.isSpeeding ? "¡EXCESO DE VELOCIDAD!" : "LIMITADOR OK"}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- Speed vs Pit Limit -->
          <div class="p-2 rounded-lg border flex flex-col justify-between ${speedCardClass}">
            <span class="text-[9px] uppercase font-bold text-white/70">Velocidad</span>
            <div class="flex items-baseline gap-1 my-0.5">
              <span class="text-2xl font-black tabular-nums">${ev.speedKmh}</span>
              <span class="text-[10px] text-white/60">/ ${ev.limitKmh} km/h</span>
            </div>
            <span class="text-[9px] tabular-nums font-bold">
              ${ev.speedDelta > 0 ? `+${ev.speedDelta} km/h` : `${ev.speedDelta} km/h`}
            </span>
          </div>

          <!-- Stall Distance / Countdown -->
          <div class="p-2 rounded-lg bg-black/40 border border-white/10 flex flex-col justify-between">
            <span class="text-[9px] uppercase font-bold text-white/70">Tu Cajón de Parada</span>
            <div class="flex items-baseline gap-1 my-0.5">
              <span class="text-2xl font-black text-amber-400 tabular-nums">${ev.distToStall > 0 ? ev.distToStall : "0"}</span>
              <span class="text-[10px] text-white/60">m</span>
            </div>
            <span class="px-1.5 py-0.2 rounded text-[9px] text-center font-bold uppercase ${stallActionClass}">
              ${ev.shouldBrakeNow ? "¡FRENAR YA!" : ev.distToStall > 0 ? "Aproximación" : "En Caja"}
            </span>
          </div>
        </div>

        <!-- Pit Timers -->
        <div class="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-white/70">
          <div>En Pitlane: <strong class="text-white tabular-nums">${ev.inPitSec}s</strong></div>
          <div>Parado en Caja: <strong class="text-amber-400 tabular-nums">${ev.stopSec}s</strong></div>
        </div>
      </div>
    `;
  }
}
