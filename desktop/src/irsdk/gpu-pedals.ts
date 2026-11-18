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
      cltRing: Float32Array;
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
    container.innerHTML = `<canvas data-mmt-pedals-canvas width="${280 * dpr}" height="${82 * dpr}" style="width:280px;height:82px;background:rgba(9,11,15,0.88);border:1px solid rgba(255,255,255,0.12);border-radius:3px;display:block;"></canvas>`;

    const canvas = container.querySelector("[data-mmt-pedals-canvas]") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx && dpr !== 1) {
      ctx.scale(dpr, dpr);
    }

    const cap = 160;
    const refs = {
      canvas,
      ctx,
      dpr,
      thrRing: new Float32Array(cap),
      brkRing: new Float32Array(cap),
      cltRing: new Float32Array(cap),
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
    cltRing: Float32Array;
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
    refs.cltRing[refs.ringHead] = clt;
    refs.gThrRing[refs.ringHead] = gThr;
    refs.gBrkRing[refs.ringHead] = gBrk;
    refs.gValidRing[refs.ringHead] = hasGhost ? 1 : 0;
    refs.ringHead = (refs.ringHead + 1) % cap;
    if (refs.ringCount < cap) refs.ringCount++;

    ctx.clearRect(0, 0, 280, 82);

    // 1. Área de trazas nítidas 280x82 (192x74, x: 4..196, y: 4..78) con guías 25/50/75%
    const traceX = 4;
    const traceY = 4;
    const traceW = 192;
    const traceH = 74;
    const absAlert = Boolean(sample.absActive);
    const brakeColor = absAlert ? "#facc15" : "#ef4444";
    const brakeFill = absAlert ? "rgba(250, 204, 21, 0.28)" : "rgba(239, 68, 68, 0.18)";

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    for (const pct of [0.25, 0.5, 0.75]) {
      const gy = traceY + traceH * (1 - pct);
      ctx.beginPath();
      ctx.moveTo(traceX, gy);
      ctx.lineTo(traceX + traceW, gy);
      ctx.stroke();
    }

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

      // Clutch (#3b82f6, 2px)
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        const x = startX + i * step;
        const y = traceY + traceH - 1 - refs.cltRing[idx] * (traceH - 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Brake (#ef4444 normal, #facc15 bright yellow on ABS/LOCK)
      ctx.beginPath();
      ctx.moveTo(startX, traceY + traceH - 1);
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        ctx.lineTo(startX + i * step, traceY + traceH - 1 - refs.brkRing[idx] * (traceH - 2));
      }
      ctx.lineTo(startX + (len - 1) * step, traceY + traceH - 1);
      ctx.closePath();
      ctx.fillStyle = brakeFill;
      ctx.fill();

      ctx.strokeStyle = brakeColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        const x = startX + i * step;
        const y = traceY + traceH - 1 - refs.brkRing[idx] * (traceH - 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Throttle (#10b981, 2px + soft gradient fill)
      ctx.beginPath();
      ctx.moveTo(startX, traceY + traceH - 1);
      for (let i = 0; i < len; i++) {
        const idx = (oldest + i) % cap;
        ctx.lineTo(startX + i * step, traceY + traceH - 1 - refs.thrRing[idx] * (traceH - 2));
      }
      ctx.lineTo(startX + (len - 1) * step, traceY + traceH - 1);
      ctx.closePath();
      ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
      ctx.fill();

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

    // 2. 3 Barras verticales instantáneas (x: 204..248) con % debajo + Badge ABS / LOCK en amarillo
    const barY = absAlert ? 18 : 6;
    const barH = absAlert ? 44 : 56;
    const bars: Array<{ x: number; val: number; color: string }> = [
      { x: 204, val: clt, color: "#3b82f6" },
      { x: 220, val: brk, color: brakeColor },
      { x: 236, val: thr, color: "#10b981" },
    ];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (absAlert) {
      ctx.fillStyle = "#facc15";
      ctx.fillRect(202, 4, 72, 11);
      ctx.fillStyle = "#090b0f";
      ctx.font = "900 8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillText("ABS / LOCK", 238, 10);
    }
    for (const b of bars) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(b.x, barY, 9, barH);
      const fillH = Math.round(b.val * barH);
      if (fillH > 0) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, barY + barH - fillH, 9, fillH);
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "700 8px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillText(`${Math.round(b.val * 100)}`, b.x + 4.5, 73);
    }

    // 3. Marcha + Velocidad a la derecha (x: 252..278)
    const gearVal = Math.round(sample.gear ?? 0);
    const gearStr = gearVal < 0 ? "R" : gearVal === 0 ? "N" : String(gearVal);
    const kmh = Math.max(0, Math.round(sample.speedKmh ?? 0));

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(gearStr, 265, 32);

    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    ctx.fillText(`${kmh}`, 265, 50);
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

const wheelSvgImgCache = new Map<string, HTMLImageElement>();

function resolveWheelProfile(carPath?: string): "lambo_gt3" | "ferrari_gt3" | "porsche_gt3" | "gt3_yoke" | "formula" | "round" {
  const p = (carPath || "").toLowerCase();
  if (p.includes("lamborghini") || p.includes("huracan")) return "lambo_gt3";
  if (p.includes("ferrari") || p.includes("499p") || p.includes("296")) return "ferrari_gt3";
  if (p.includes("porsche") || p.includes("992") || p.includes("963")) return "porsche_gt3";
  if (p.includes("formula") || p.includes("dallara") || p.includes("ir18") || p.includes("sf23") || p.includes("sfl") || p.includes("f4") || p.includes("f3") || p.includes("lmp") || p.includes("cadillac") || p.includes("acura") || p.includes("bmwhybrid")) return "formula";
  if (p.includes("gt3") || p.includes("gte") || p.includes("gt4") || p.includes("m4") || p.includes("amg") || p.includes("mclaren") || p.includes("aston") || p.includes("corvette") || p.includes("mustang") || p.includes("audi") || p.includes("nsx")) return "gt3_yoke";
  return "round";
}

function buildSteeringWheelSvg(profile: ReturnType<typeof resolveWheelProfile>): string {
  if (profile === "lambo_gt3") {
    // Lamborghini Huracán GT3 EVO2: yugo abierto, carbono, detalles amarillos, cinta roja derecha y 3 diales (verde/amarillo/naranja)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <defs>
        <linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#272b33"/><stop offset="100%" stop-color="#111317"/></linearGradient>
      </defs>
      <!-- Aro exterior tipo GT3 recortado arriba -->
      <path d="M22 34 C12 48, 12 82, 24 96 C32 105, 48 108, 64 108 C80 108, 96 105, 104 96 C116 82, 116 48, 106 34 L94 40 C100 52, 100 76, 92 88 C85 95, 75 96, 64 96 C53 96, 43 95, 36 88 C28 76, 28 52, 34 40 Z" fill="#14171c" stroke="#2f3540" stroke-width="2"/>
      <!-- Cinta superior roja lado derecho estilo Huracán GT3 EVO2 -->
      <path d="M88 30 L103 36 L98 46 L84 39 Z" fill="#ef4444"/>
      <path d="M25 36 L40 30 L44 39 L30 46 Z" fill="#eab308" opacity="0.85"/>
      <!-- Cuerpo central fibra de carbono y placa amarilla -->
      <rect x="30" y="46" width="68" height="36" rx="10" fill="url(#cb)" stroke="#3b4250" stroke-width="1.5"/>
      <path d="M36 52 H92 L88 76 H40 Z" fill="#eab308" opacity="0.9"/>
      <rect x="48" y="50" width="32" height="24" rx="4" fill="#181b20"/>
      <!-- Empuñaduras grises laterales -->
      <rect x="20" y="42" width="12" height="24" rx="5" fill="#64748b"/>
      <rect x="96" y="42" width="12" height="24" rx="5" fill="#64748b"/>
      <!-- Botones superiores -->
      <circle cx="42" cy="48" r="3.5" fill="#22c55e"/>
      <circle cx="86" cy="48" r="3.5" fill="#ef4444"/>
      <circle cx="38" cy="64" r="3" fill="#eab308"/>
      <circle cx="90" cy="64" r="3" fill="#38bdf8"/>
      <!-- 3 Diales rotativos inferiores (Verde, Amarillo central, Naranja) -->
      <circle cx="64" cy="62" r="7.5" fill="#eab308" stroke="#111" stroke-width="1.5"/>
      <circle cx="64" cy="62" r="3" fill="#111"/>
      <circle cx="49" cy="73" r="8" fill="#22c55e" stroke="#111" stroke-width="1.5"/>
      <circle cx="49" cy="73" r="3.2" fill="#111"/>
      <circle cx="79" cy="73" r="8" fill="#f97316" stroke="#111" stroke-width="1.5"/>
      <circle cx="79" cy="73" r="3.2" fill="#111"/>
    </svg>`;
  }
  if (profile === "ferrari_gt3") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <path d="M22 36 C12 52, 12 80, 26 95 C38 106, 90 106, 102 95 C116 80, 116 52, 106 36 L94 42 C101 54, 100 76, 90 86 C78 95, 50 95, 38 86 C28 76, 27 54, 34 42 Z" fill="#16181d" stroke="#374151" stroke-width="2"/>
      <rect x="32" y="48" width="64" height="32" rx="9" fill="#1f242d" stroke="#4b5563" stroke-width="1.5"/>
      <rect x="56" y="46" width="16" height="6" rx="2" fill="#facc15"/>
      <circle cx="46" cy="66" r="6.5" fill="#ef4444" stroke="#111" stroke-width="1.5"/>
      <circle cx="64" cy="64" r="6.5" fill="#eab308" stroke="#111" stroke-width="1.5"/>
      <circle cx="82" cy="66" r="6.5" fill="#38bdf8" stroke="#111" stroke-width="1.5"/>
      <circle cx="40" cy="52" r="3" fill="#22c55e"/>
      <circle cx="88" cy="52" r="3" fill="#ef4444"/>
    </svg>`;
  }
  if (profile === "porsche_gt3") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <path d="M24 38 C12 54, 14 82, 28 96 C42 106, 86 106, 100 96 C114 82, 116 54, 104 38 L92 44 C99 56, 98 76, 88 86 C76 94, 52 94, 40 86 C30 76, 29 56, 36 44 Z" fill="#14171c" stroke="#334155" stroke-width="2"/>
      <rect x="32" y="48" width="64" height="32" rx="8" fill="#1e222a" stroke="#475569" stroke-width="1.5"/>
      <rect x="58" y="47" width="12" height="5" rx="1.5" fill="#f8fafc"/>
      <circle cx="48" cy="66" r="6.5" fill="#38bdf8" stroke="#111" stroke-width="1.5"/>
      <circle cx="80" cy="66" r="6.5" fill="#eab308" stroke="#111" stroke-width="1.5"/>
      <circle cx="64" cy="62" r="5" fill="#ef4444"/>
    </svg>`;
  }
  if (profile === "formula") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <rect x="16" y="38" width="96" height="52" rx="14" fill="#15181e" stroke="#3f4756" stroke-width="2.5"/>
      <rect x="44" y="42" width="40" height="20" rx="3" fill="#090d14" stroke="#10b981" stroke-width="1.2"/>
      <circle cx="32" cy="54" r="4" fill="#ef4444"/>
      <circle cx="96" cy="54" r="4" fill="#22c55e"/>
      <circle cx="48" cy="74" r="6" fill="#eab308"/>
      <circle cx="64" cy="74" r="6" fill="#38bdf8"/>
      <circle cx="80" cy="74" r="6" fill="#f97316"/>
    </svg>`;
  }
  if (profile === "gt3_yoke") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
      <path d="M22 36 C12 52, 12 80, 26 95 C38 106, 90 106, 102 95 C116 80, 116 52, 106 36 L94 42 C101 54, 100 76, 90 86 C78 95, 50 95, 38 86 C28 76, 27 54, 34 42 Z" fill="#15181e" stroke="#3b4250" stroke-width="2"/>
      <rect x="32" y="48" width="64" height="32" rx="9" fill="#1e232b" stroke="#475569" stroke-width="1.5"/>
      <rect x="58" y="46" width="12" height="5" rx="1.5" fill="#eab308"/>
      <circle cx="48" cy="66" r="6.5" fill="#22c55e" stroke="#111" stroke-width="1.5"/>
      <circle cx="64" cy="64" r="6" fill="#eab308" stroke="#111" stroke-width="1.5"/>
      <circle cx="80" cy="66" r="6.5" fill="#f97316" stroke="#111" stroke-width="1.5"/>
    </svg>`;
  }
  // Volante redondo deportivo (MX-5, TCR, Cup, calle)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <circle cx="64" cy="64" r="48" fill="none" stroke="#1c2028" stroke-width="11"/>
    <circle cx="64" cy="64" r="48" fill="none" stroke="#384152" stroke-width="2"/>
    <rect x="59" y="10" width="10" height="11" rx="2" fill="#eab308"/>
    <path d="M20 64 H108 M64 64 V108" stroke="#262c36" stroke-width="9" stroke-linecap="round"/>
    <circle cx="64" cy="64" r="14" fill="#161920" stroke="#475569" stroke-width="2"/>
  </svg>`;
}

function getCachedWheelImage(profile: ReturnType<typeof resolveWheelProfile>): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = wheelSvgImgCache.get(profile);
  if (!img) {
    img = new Image();
    img.src = "data:image/svg+xml;utf8," + encodeURIComponent(buildSteeringWheelSvg(profile));
    wheelSvgImgCache.set(profile, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function renderCenteredSteeringWheel(canvas: HTMLCanvasElement, steeringRad: number, carPath?: string): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const rot = -(Number.isFinite(steeringRad) ? steeringRad : 0);
  const profile = resolveWheelProfile(carPath);
  const img = getCachedWheelImage(profile);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  if (img) {
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}
