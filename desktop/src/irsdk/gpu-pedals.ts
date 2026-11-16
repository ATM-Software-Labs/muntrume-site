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
  ghostEnabled?: boolean;
  ghostThrottle?: number;
  ghostBrake?: number;
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
      dpr: number;
      thrRing: Float32Array;
      brkRing: Float32Array;
      gThrRing: Float32Array;
      gBrkRing: Float32Array;
      gValidRing: Uint8Array;
      ringHead: number;
      ringCount: number;
      telemetry: PedalsSample;
      lastSampleMs: number;
      rafId: number | null;
    }
  >();

  private initContainer(container: HTMLElement) {
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    container.innerHTML = `<canvas data-mmt-pedals-canvas width="${280 * dpr}" height="${38 * dpr}" style="width:280px;height:38px;background:rgba(10,12,16,0.55);border-radius:3px;display:block;"></canvas>`;

    const canvas = container.querySelector("[data-mmt-pedals-canvas]") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx && dpr !== 1) {
      ctx.scale(dpr, dpr);
    }

    const cap = 130;
    const refs = {
      canvas,
      ctx,
      dpr,
      thrRing: new Float32Array(cap),
      brkRing: new Float32Array(cap),
      gThrRing: new Float32Array(cap),
      gBrkRing: new Float32Array(cap),
      gValidRing: new Uint8Array(cap),
      ringHead: 0,
      ringCount: 0,
      telemetry: { throttle: 0, brake: 0, clutch: 0, steering: 0, speedKmh: 0, gear: 0 } as PedalsSample,
      lastSampleMs: 0,
      rafId: null as number | null,
    };
    this.refsMap.set(container, refs);
    return refs;
  }

  private drawFrame(refs: {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | null;
    dpr: number;
    thrRing: Float32Array;
    brkRing: Float32Array;
    gThrRing: Float32Array;
    gBrkRing: Float32Array;
    gValidRing: Uint8Array;
    ringHead: number;
    ringCount: number;
    telemetry: PedalsSample;
  }): void {
    const ctx = refs.ctx;
    if (!ctx) return;

    const sample = refs.telemetry;
    const thr = Math.max(0, Math.min(1, sample.throttle || 0));
    const brk = Math.max(0, Math.min(1, sample.brake || 0));
    const clt = Math.max(0, Math.min(1, sample.clutch || 0));
    const hasGhost = Boolean(sample.ghostEnabled && (sample.ghostBrake != null || sample.ghostThrottle != null));
    const gThr = Math.max(0, Math.min(1, sample.ghostThrottle ?? 0));
    const gBrk = Math.max(0, Math.min(1, sample.ghostBrake ?? 0));

    const cap = refs.thrRing.length;
    refs.thrRing[refs.ringHead] = thr;
    refs.brkRing[refs.ringHead] = brk;
    refs.gThrRing[refs.ringHead] = gThr;
    refs.gBrkRing[refs.ringHead] = gBrk;
    refs.gValidRing[refs.ringHead] = hasGhost ? 1 : 0;
    refs.ringHead = (refs.ringHead + 1) % cap;
    if (refs.ringCount < cap) refs.ringCount++;

    ctx.clearRect(0, 0, 280, 38);

    // 1. Traza en tiempo real (130px x 32px, x: 4..134, y: 3..35)
    const traceX = 4;
    const traceY = 3;
    const traceW = 130;
    const traceH = 32;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(traceX, traceY + traceH * 0.5);
    ctx.lineTo(traceX + traceW, traceY + traceH * 0.5);
    ctx.stroke();

    const len = refs.ringCount;
    if (len > 1) {
      const step = traceW / (cap - 1);
      const startX = traceX + traceW - (len - 1) * step;
      const oldest = refs.ringCount < cap ? 0 : refs.ringHead;

      // Ghost Compare dashed lines (1.5s ahead best-lap reference)
      if (sample.ghostEnabled) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1.5;

        ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
        ctx.beginPath();
        let startedBrk = false;
        for (let i = 0; i < len; i++) {
          const idx = (oldest + i) % cap;
          if (!refs.gValidRing[idx]) continue;
          const x = startX + i * step;
          const y = traceY + traceH - 1 - refs.gBrkRing[idx] * (traceH - 2);
          if (!startedBrk) { ctx.moveTo(x, y); startedBrk = true; }
          else ctx.lineTo(x, y);
        }
        if (startedBrk) ctx.stroke();

        ctx.strokeStyle = "rgba(16, 185, 129, 0.45)";
        ctx.beginPath();
        let startedThr = false;
        for (let i = 0; i < len; i++) {
          const idx = (oldest + i) % cap;
          if (!refs.gValidRing[idx]) continue;
          const x = startX + i * step;
          const y = traceY + traceH - 1 - refs.gThrRing[idx] * (traceH - 2);
          if (!startedThr) { ctx.moveTo(x, y); startedThr = true; }
          else ctx.lineTo(x, y);
        }
        if (startedThr) ctx.stroke();
        ctx.restore();
      }

      // Brake (#ef4444, 2px)
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        const x = startX + i * step;
        const y = traceY + traceH - 1 - refs.brkRing[idx] * (traceH - 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Throttle (#10b981, 2px)
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        const x = startX + i * step;
        const y = traceY + traceH - 1 - refs.thrRing[idx] * (traceH - 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. 3 Barras verticales finas (4px cada una): Embrague (azul), Freno (rojo), Gas (verde)
    const barY = 4;
    const barH = 30;
    const bars: Array<{ x: number; val: number; color: string }> = [
      { x: 141, val: clt, color: "#38bdf8" },
      { x: 148, val: brk, color: "#ef4444" },
      { x: 155, val: thr, color: "#10b981" },
    ];
    for (const b of bars) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(b.x, barY, 4, barH);
      const fillH = Math.round(b.val * barH);
      if (fillH > 0) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, barY + barH - fillH, 4, fillH);
      }
    }

    // 3. Marcha y Velocidad (52px, x: 165..217)
    const gearVal = Math.round(sample.gear ?? 0);
    const gearStr = gearVal < 0 ? "R" : gearVal === 0 ? "N" : String(gearVal);
    const kmh = Math.max(0, Math.round(sample.speedKmh ?? 0));

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 17px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(gearStr, 191, 13);

    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(`${kmh} km/h`, 191, 29);

    // 4. Aro de Volante Minimalista (30px x 30px, center x: 254, y: 19)
    const cx = 254;
    const cy = 19;
    const radius = 11.5;
    const rotRad = -(Number.isFinite(sample.steering) ? sample.steering : 0);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotRad);

    // Thin white rim
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle inner spoke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-radius + 2, 0);
    ctx.lineTo(radius - 2, 0);
    ctx.stroke();

    // Top marker (red/green)
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2 - 0.24, -Math.PI / 2 + 0.24);
    ctx.stroke();

    ctx.restore();
  }

  public render(container: HTMLElement, sample: PedalsSample): void {
    let refs = this.refsMap.get(container);
    if (!refs || !container.contains(refs.canvas)) {
      refs = this.initContainer(container);
    }

    refs.telemetry = sample;
    refs.lastSampleMs = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (typeof requestAnimationFrame === "undefined") {
      this.drawFrame(refs);
      return;
    }

    if (refs.rafId === null) {
      const tick = () => {
        if (!container.isConnected || (typeof document !== "undefined" && document.hidden)) {
          refs!.rafId = null;
          return;
        }
        this.drawFrame(refs!);
        const now = performance.now();
        if (now - refs!.lastSampleMs > 1500) {
          refs!.rafId = null;
          return;
        }
        refs!.rafId = requestAnimationFrame(tick);
      };
      refs.rafId = requestAnimationFrame(tick);
    }
  }
}
