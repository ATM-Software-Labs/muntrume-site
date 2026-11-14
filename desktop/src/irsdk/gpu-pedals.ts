/**
 * MMT Sync — GPU-Accelerated Pedals & Steering Overlay (Bloque 2)
 * 60 FPS hardware-accelerated pedal bars and steering wheel gauge.
 * Uses CSS transform: scaleY / rotate / translate3d to avoid layout thrashing and CPU rasterization.
 * Includes Trail Braking peak trace, FFB clipping monitor, and ABS/TC indicators.
 */

export interface PedalsSample {
  throttle: number; // 0.0 to 1.0
  brake: number; // 0.0 to 1.0
  clutch?: number; // 0.0 to 1.0
  steering: number; // radians (-12.5 to 12.5)
  speedKmh?: number;
  gear?: number;
  rpm?: number;
  absActive?: boolean;
  tcActive?: boolean;
  ffbPct?: number; // 0.0 to 1.0 or percentage
}

export class GpuPedalsEngine {
  private lastBrakePeak = 0;
  private lastBrakePeakTime = 0;
  private peakHoldMs = 1200;

  public computePedalState(sample: PedalsSample, now = Date.now()) {
    const thr = Math.max(0, Math.min(1, sample.throttle));
    const brk = Math.max(0, Math.min(1, sample.brake));
    const clt = Math.max(0, Math.min(1, sample.clutch || 0));

    // Trail braking peak tracking
    if (brk > this.lastBrakePeak) {
      this.lastBrakePeak = brk;
      this.lastBrakePeakTime = now;
    } else if (now - this.lastBrakePeakTime > this.peakHoldMs) {
      // Exponential decay
      this.lastBrakePeak = Math.max(brk, this.lastBrakePeak * 0.94);
    }

    // Steering degrees
    const steerDeg = sample.steering * 57.2957795;
    const steerDisplay = steerDeg.toFixed(1);

    // FFB estimation based on explicit ffbPct or steering torque & velocity
    const ffbNorm = sample.ffbPct != null
      ? Math.max(0, Math.min(1, sample.ffbPct > 1 ? sample.ffbPct / 100 : sample.ffbPct))
      : Math.min(
          1.0,
          Math.abs(sample.steering) * 0.75 + ((sample.speedKmh || 0) > 60 ? 0.25 : 0.05)
        );
    const isFfbClipping = ffbNorm >= 0.95;

    return {
      throttlePct: Math.round(thr * 100),
      brakePct: Math.round(brk * 100),
      clutchPct: Math.round(clt * 100),
      brakePeakPct: Math.round(this.lastBrakePeak * 100),
      steerDeg,
      steerDisplay,
      ffbNorm,
      ffbPct: Math.round(ffbNorm * 100),
      isFfbClipping,
      absActive: Boolean(sample.absActive || (brk > 0.82 && (sample.speedKmh || 0) > 40)),
      tcActive: Boolean(sample.tcActive || (thr > 0.9 && (sample.speedKmh || 0) < 50)),
    };
  }

  public render(container: HTMLElement, sample: PedalsSample): void {
    const p = this.computePedalState(sample);

    const ffbColor = p.isFfbClipping ? "#ef4444" : "#94a3b8";
    const absClass = p.absActive
      ? "bg-amber-400 text-black shadow-[0_0_8px_#facc15] font-black"
      : "bg-white/5 text-white/20";
    const tcClass = p.tcActive
      ? "bg-sky-400 text-black shadow-[0_0_8px_#38bdf8] font-black"
      : "bg-white/5 text-white/20";

    container.innerHTML = `
      <div class="p-2 rounded-xl bg-black/85 border border-white/10 text-white font-mono select-none" style="will-change: transform;">
        <!-- Header -->
        <div class="flex items-center justify-between pb-1.5 mb-2 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider">
          <span class="text-r-muted">Pedales &amp; Volante (GPU 60 FPS)</span>
          <div class="flex items-center gap-1.5 text-[8px]">
            <span class="px-1.5 py-0.2 rounded ${absClass}">ABS</span>
            <span class="px-1.5 py-0.2 rounded ${tcClass}">TC</span>
            <span class="px-1.5 py-0.2 rounded font-bold ${p.isFfbClipping ? "bg-rose-500 text-white animate-pulse" : "bg-white/10 text-white/50"}">FFB</span>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_auto] gap-3 items-center">
          <!-- 3 Vertical GPU Bars -->
          <div class="flex items-end gap-2.5 h-24">
            <!-- Clutch Bar -->
            <div class="flex flex-col items-center gap-1 h-full">
              <span class="text-[9px] text-white/60 tabular-nums">${p.clutchPct}%</span>
              <div class="w-4 flex-1 bg-white/5 rounded-md overflow-hidden relative border border-white/10">
                <div class="absolute inset-x-0 bottom-0 bg-sky-400 rounded-sm origin-bottom"
                  style="height: 100%; transform: scaleY(${p.clutchPct / 100}) translate3d(0,0,0); will-change: transform; transition: transform 16ms linear;"></div>
              </div>
              <span class="text-[9px] font-bold text-sky-400">CLT</span>
            </div>

            <!-- Brake Bar (with Trail Peak) -->
            <div class="flex flex-col items-center gap-1 h-full">
              <span class="text-[9px] text-rose-300 font-bold tabular-nums">${p.brakePct}%</span>
              <div class="w-6 flex-1 bg-white/5 rounded-md overflow-hidden relative border border-white/10">
                <!-- Peak Line -->
                <div class="absolute inset-x-0 border-b-2 border-amber-300 z-10 origin-bottom"
                  style="bottom: ${p.brakePeakPct}%; will-change: bottom;"></div>
                <!-- Main Brake Bar -->
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-rose-600 to-rose-400 rounded-sm origin-bottom"
                  style="height: 100%; transform: scaleY(${p.brakePct / 100}) translate3d(0,0,0); will-change: transform; transition: transform 16ms linear;"></div>
              </div>
              <span class="text-[9px] font-black text-rose-400">BRK</span>
            </div>

            <!-- Throttle Bar -->
            <div class="flex flex-col items-center gap-1 h-full">
              <span class="text-[9px] text-emerald-300 font-bold tabular-nums">${p.throttlePct}%</span>
              <div class="w-6 flex-1 bg-white/5 rounded-md overflow-hidden relative border border-white/10">
                <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-sm origin-bottom"
                  style="height: 100%; transform: scaleY(${p.throttlePct / 100}) translate3d(0,0,0); will-change: transform; transition: transform 16ms linear;"></div>
              </div>
              <span class="text-[9px] font-black text-emerald-400">GAS</span>
            </div>

            <!-- FFB Level Bar -->
            <div class="flex flex-col items-center gap-1 h-full">
              <span class="text-[9px] text-white/50 tabular-nums">${p.ffbPct}%</span>
              <div class="w-2.5 flex-1 bg-white/5 rounded-md overflow-hidden relative border border-white/10">
                <div class="absolute inset-x-0 bottom-0 rounded-sm origin-bottom"
                  style="height: 100%; background-color: ${ffbColor}; transform: scaleY(${p.ffbPct / 100}) translate3d(0,0,0); will-change: transform;"></div>
              </div>
              <span class="text-[8px] text-white/50">FF</span>
            </div>
          </div>

          <!-- Steering Wheel SVG (Hardware Rotated) -->
          <div class="flex flex-col items-center justify-center p-2 rounded-lg bg-black/40 border border-white/5">
            <div class="relative w-20 h-20 flex items-center justify-center">
              <svg viewBox="0 0 100 100" class="w-full h-full drop-shadow-md origin-center"
                style="transform: rotate(${p.steerDeg}deg) translate3d(0,0,0); will-change: transform; transition: transform 16ms linear;">
                <!-- Wheel Rim -->
                <circle cx="50" cy="50" r="44" fill="none" stroke="#262626" stroke-width="9" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="#404040" stroke-width="2" />
                <!-- Top Center Marker (Yellow) -->
                <path d="M 47 6 A 44 44 0 0 1 53 6" fill="none" stroke="#facc15" stroke-width="9" stroke-linecap="butt" />
                <!-- Center Hub -->
                <circle cx="50" cy="50" r="16" fill="#171717" stroke="#525252" stroke-width="2" />
                <!-- Spokes -->
                <rect x="6" y="47" width="30" height="6" rx="2" fill="#333" />
                <rect x="64" y="47" width="30" height="6" rx="2" fill="#333" />
                <rect x="47" y="64" width="6" height="30" rx="2" fill="#333" />
                <circle cx="50" cy="50" r="5" fill="#00e699" />
              </svg>
            </div>
            <div class="mt-1 text-center font-mono">
              <span class="text-xs font-black tabular-nums ${Math.abs(p.steerDeg) > 90 ? "text-amber-300" : "text-white"}">${p.steerDisplay}°</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
