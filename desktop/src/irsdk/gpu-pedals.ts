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

  private refsMap = new WeakMap<
    HTMLElement,
    {
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D | null;
      history: Array<{ thr: number; brk: number }>;
      cltBar: HTMLElement;
      brkBar: HTMLElement;
      brkPeak: HTMLElement;
      thrBar: HTMLElement;
      cltPct: HTMLElement;
      brkPct: HTMLElement;
      thrPct: HTMLElement;
      absPill: HTMLElement;
      tcPill: HTMLElement;
      ffbPill: HTMLElement;
      wheelSvg: SVGSVGElement;
      steerDeg: HTMLElement;
    }
  >();

  private initContainer(container: HTMLElement) {
    container.innerHTML = `
      <div class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#0a0c10]/92 border border-white/10 text-white font-mono select-none">
        <!-- Live 60 FPS Telemetry Trace -->
        <div class="flex flex-col gap-1">
          <canvas data-mmt-trace width="128" height="46" class="rounded bg-black/70 border border-white/10 block"></canvas>
          <div class="flex items-center justify-between text-[8px] tracking-wider uppercase font-bold">
            <div class="flex items-center gap-1">
              <span data-mmt-abs class="px-1 rounded bg-white/5 text-white/25">ABS</span>
              <span data-mmt-tc class="px-1 rounded bg-white/5 text-white/25">TC</span>
              <span data-mmt-ffb class="px-1 rounded bg-white/5 text-white/40">FFB</span>
            </div>
            <span class="text-white/35">60Hz</span>
          </div>
        </div>

        <!-- 3 Slim Pro Bars -->
        <div class="flex items-end gap-1.5 h-[58px]">
          <div class="flex flex-col items-center gap-0.5 h-full">
            <span data-mmt-clt-pct class="text-[8px] text-sky-300/80 tabular-nums leading-none">0</span>
            <div class="w-2 flex-1 bg-white/5 rounded-sm overflow-hidden relative border border-white/10">
              <div data-mmt-clt-bar class="absolute inset-x-0 bottom-0 h-full bg-sky-400 origin-bottom" style="transform: scaleY(0) translate3d(0,0,0); will-change: transform;"></div>
            </div>
            <span class="text-[8px] font-bold text-sky-400 leading-none">C</span>
          </div>
          <div class="flex flex-col items-center gap-0.5 h-full">
            <span data-mmt-brk-pct class="text-[8px] text-rose-300 font-bold tabular-nums leading-none">0</span>
            <div class="w-3 flex-1 bg-white/5 rounded-sm overflow-hidden relative border border-white/10">
              <div data-mmt-brk-peak class="absolute inset-x-0 border-b border-amber-300 z-10" style="bottom: 0%;"></div>
              <div data-mmt-brk-bar class="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-rose-600 to-rose-400 origin-bottom" style="transform: scaleY(0) translate3d(0,0,0); will-change: transform;"></div>
            </div>
            <span class="text-[8px] font-black text-rose-400 leading-none">B</span>
          </div>
          <div class="flex flex-col items-center gap-0.5 h-full">
            <span data-mmt-thr-pct class="text-[8px] text-emerald-300 font-bold tabular-nums leading-none">0</span>
            <div class="w-3 flex-1 bg-white/5 rounded-sm overflow-hidden relative border border-white/10">
              <div data-mmt-thr-bar class="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-emerald-600 to-emerald-400 origin-bottom" style="transform: scaleY(0) translate3d(0,0,0); will-change: transform;"></div>
            </div>
            <span class="text-[8px] font-black text-emerald-400 leading-none">T</span>
          </div>
        </div>

        <!-- Sleek GT3 / Formula Steering Wheel -->
        <div class="flex flex-col items-center justify-center pl-1.5 border-l border-white/10">
          <div class="w-11 h-11 flex items-center justify-center">
            <svg data-mmt-wheel viewBox="0 0 100 100" class="w-full h-full origin-center" style="will-change: transform;">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2f3a" stroke-width="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#475569" stroke-width="1.5" />
              <path d="M 46 8 A 42 42 0 0 1 54 8" fill="none" stroke="#00e699" stroke-width="10" stroke-linecap="butt" />
              <path d="M 12 50 L 34 50 M 66 50 L 88 50 M 50 66 L 50 88" stroke="#1e293b" stroke-width="8" stroke-linecap="round" />
              <circle cx="50" cy="50" r="14" fill="#0f172a" stroke="#334155" stroke-width="2" />
              <circle cx="50" cy="50" r="4" fill="#00e699" />
            </svg>
          </div>
          <span data-mmt-steer class="mt-0.5 text-[10px] font-bold tabular-nums text-white/90 leading-none">0.0°</span>
        </div>
      </div>
    `;

    const canvas = container.querySelector("[data-mmt-trace]") as HTMLCanvasElement;
    const refs = {
      canvas,
      ctx: canvas.getContext("2d"),
      history: [] as Array<{ thr: number; brk: number }>,
      cltBar: container.querySelector("[data-mmt-clt-bar]") as HTMLElement,
      brkBar: container.querySelector("[data-mmt-brk-bar]") as HTMLElement,
      brkPeak: container.querySelector("[data-mmt-brk-peak]") as HTMLElement,
      thrBar: container.querySelector("[data-mmt-thr-bar]") as HTMLElement,
      cltPct: container.querySelector("[data-mmt-clt-pct]") as HTMLElement,
      brkPct: container.querySelector("[data-mmt-brk-pct]") as HTMLElement,
      thrPct: container.querySelector("[data-mmt-thr-pct]") as HTMLElement,
      absPill: container.querySelector("[data-mmt-abs]") as HTMLElement,
      tcPill: container.querySelector("[data-mmt-tc]") as HTMLElement,
      ffbPill: container.querySelector("[data-mmt-ffb]") as HTMLElement,
      wheelSvg: container.querySelector("[data-mmt-wheel]") as SVGSVGElement,
      steerDeg: container.querySelector("[data-mmt-steer]") as HTMLElement,
    };
    this.refsMap.set(container, refs);
    return refs;
  }

  public render(container: HTMLElement, sample: PedalsSample): void {
    const p = this.computePedalState(sample);
    let refs = this.refsMap.get(container);
    if (!refs || !container.contains(refs.canvas)) {
      refs = this.initContainer(container);
    }

    // Fast GPU transforms (no DOM rebuild)
    refs.cltBar.style.transform = `scaleY(${p.clutchPct / 100}) translate3d(0,0,0)`;
    refs.brkBar.style.transform = `scaleY(${p.brakePct / 100}) translate3d(0,0,0)`;
    refs.brkPeak.style.bottom = `${p.brakePeakPct}%`;
    refs.thrBar.style.transform = `scaleY(${p.throttlePct / 100}) translate3d(0,0,0)`;
    refs.wheelSvg.style.transform = `rotate(${(-p.steerDeg).toFixed(1)}deg) translate3d(0,0,0)`;

    refs.cltPct.textContent = String(p.clutchPct);
    refs.brkPct.textContent = String(p.brakePct);
    refs.thrPct.textContent = String(p.throttlePct);
    refs.steerDeg.textContent = `${p.steerDisplay}°`;
    refs.steerDeg.className = `mt-0.5 text-[10px] font-bold tabular-nums leading-none ${
      Math.abs(p.steerDeg) > 90 ? "text-amber-300" : "text-white/90"
    }`;

    refs.absPill.className = p.absActive
      ? "px-1 rounded bg-amber-400 text-black font-black"
      : "px-1 rounded bg-white/5 text-white/25";
    refs.tcPill.className = p.tcActive
      ? "px-1 rounded bg-sky-400 text-black font-black"
      : "px-1 rounded bg-white/5 text-white/25";
    refs.ffbPill.className = p.isFfbClipping
      ? "px-1 rounded bg-rose-500 text-white font-black"
      : "px-1 rounded bg-white/5 text-white/40";

    // Draw 60 FPS scrolling trace
    const thr = Math.max(0, Math.min(1, sample.throttle));
    const brk = Math.max(0, Math.min(1, sample.brake));
    refs.history.push({ thr, brk });
    if (refs.history.length > 64) refs.history.shift();

    const ctx = refs.ctx;
    if (ctx) {
      const w = refs.canvas.width;
      const h = refs.canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle 50% horizontal guide
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(w, h * 0.5);
      ctx.stroke();

      const len = refs.history.length;
      if (len > 1) {
        const step = w / 63;
        const startX = w - (len - 1) * step;

        // Brake trace (rose)
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = startX + i * step;
          const y = h - 2 - refs.history[i].brk * (h - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Throttle trace (emerald)
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
          const x = startX + i * step;
          const y = h - 2 - refs.history[i].thr * (h - 4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  }
}
