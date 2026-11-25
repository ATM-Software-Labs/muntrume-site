import { BUILTIN_DECALS, getCarById } from "./catalog";
import type { DecalLayer, SkinDesignState, ZoneKey, ZoneRect } from "./types";

export interface CompositeOptions {
  size: number;
  templateCanvas?: HTMLCanvasElement | null;
  partsOverlayCanvas?: HTMLCanvasElement | null;
  showTemplateOverlay?: boolean;
  templateOpacity?: number;
  showZonesOverlay?: boolean;
  selectedZone?: ZoneKey | null;
  selectedDecalId?: string | null;
  forExport?: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();

function loadImageCached(key: string, src: string): Promise<HTMLImageElement | null> {
  const existing = imageCache.get(key);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(key, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getDecalSource(decal: DecalLayer): { key: string; src: string } | null {
  if (decal.kind === "custom" && decal.dataUrl) {
    return { key: `custom:${decal.id}:${decal.dataUrl.slice(0, 48)}`, src: decal.dataUrl };
  }
  if (decal.kind === "builtin" && decal.assetId) {
    const asset = BUILTIN_DECALS.find((b) => b.id === decal.assetId);
    if (!asset) return null;
    const svg = asset.svg(decal.color || "#ffffff");
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return { key: `builtin:${asset.id}:${decal.color}`, src: encoded };
  }
  return null;
}

function drawCarbonPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scalePx: number): void {
  const tile = document.createElement("canvas");
  const s = Math.max(8, Math.round(scalePx));
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  tctx.fillStyle = "rgba(255,255,255,0.035)";
  tctx.fillRect(0, 0, s / 2, s / 2);
  tctx.fillRect(s / 2, s / 2, s / 2, s / 2);
  tctx.fillStyle = "rgba(0,0,0,0.22)";
  tctx.fillRect(s / 2, 0, s / 2, s / 2);
  tctx.fillRect(0, s / 2, s / 2, s / 2);

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function zonePx(z: ZoneRect, size: number): { x: number; y: number; w: number; h: number } {
  return { x: z.x * size, y: z.y * size, w: z.w * size, h: z.h * size };
}

function drawPatternGeometry(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number): void {
  const { palette, pattern, spec } = state;

  // Base full-body coat (subtle rich gradient so it never looks like flat dead black)
  const baseGrad = ctx.createLinearGradient(0, 0, size, size);
  baseGrad.addColorStop(0, palette.primary);
  baseGrad.addColorStop(1, pattern === "freeform" ? palette.primary : palette.secondary);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  if (spec.finish === "carbon" || spec.carbonAccent) {
    drawCarbonPattern(ctx, 0, 0, size, size, size / 128);
  }

  // Modo Diseño Libre: lienzo 100 % limpio sin trazos ni gráficos impuestos
  if (pattern === "freeform") {
    return;
  }

  // Todos los patrones pintan geometría fluida a lienzo completo (2048×2048) sin cajas rectangulares flotantes
  if (pattern === "endurance") {
    // Sweeping motorsport diagonal aerodynamic bands across the entire UV
    ctx.save();
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.58);
    ctx.lineTo(size, size * 0.22);
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();

    // Primary sharp accent spear
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(12, size * 0.022);
    ctx.beginPath();
    ctx.moveTo(-size * 0.05, size * 0.60);
    ctx.lineTo(size * 1.05, size * 0.20);
    ctx.stroke();

    // Parallel fine motorsport pinstripe
    ctx.strokeStyle = palette.detail;
    ctx.lineWidth = Math.max(4, size * 0.006);
    ctx.beginPath();
    ctx.moveTo(-size * 0.05, size * 0.555);
    ctx.lineTo(size * 1.05, size * 0.155);
    ctx.stroke();

    // Subtle secondary chevron accent on lower body
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(6, size * 0.01);
    ctx.beginPath();
    ctx.moveTo(-size * 0.05, size * 0.84);
    ctx.lineTo(size * 1.05, size * 0.44);
    ctx.stroke();
    ctx.restore();
  } else if (pattern === "sprint") {
    // Classic bold twin center racing stripes running cleanly down the full UV center axis
    const cx = size * 0.5;
    const stripeW = size * 0.055;
    const gap = size * 0.018;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(cx - gap / 2 - stripeW, 0, stripeW, size);
    ctx.fillRect(cx + gap / 2, 0, stripeW, size);

    // Crisp outer pinstripes
    ctx.fillStyle = palette.detail;
    const pinW = Math.max(3, size * 0.005);
    ctx.fillRect(cx - gap / 2 - stripeW - pinW * 2.4, 0, pinW, size);
    ctx.fillRect(cx + gap / 2 + stripeW + pinW * 1.4, 0, pinW, size);
  } else if (pattern === "carbon-stealth") {
    // Full exposed carbon weave + sleek razor-thin diagonal stealth highlights (zero solid blocks)
    drawCarbonPattern(ctx, 0, 0, size, size, size / 140);
    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(5, size * 0.008);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.34);
    ctx.lineTo(size, size * 0.64);
    ctx.moveTo(0, size * 0.66);
    ctx.lineTo(size, size * 0.36);
    ctx.stroke();

    ctx.strokeStyle = palette.detail;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = Math.max(2, size * 0.003);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.32);
    ctx.lineTo(size, size * 0.62);
    ctx.stroke();
    ctx.restore();
  } else if (pattern === "tricolor") {
    // Classic 3-stripe diagonal factory motorsport livery across the full body
    const colors = [palette.secondary, palette.accent, palette.detail];
    const bandW = size * 0.065;
    ctx.save();
    colors.forEach((c, idx) => {
      ctx.fillStyle = c;
      const ox = size * 0.32 + idx * bandW * 1.18;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox + bandW, 0);
      ctx.lineTo(ox - size * 0.38 + bandW, size);
      ctx.lineTo(ox - size * 0.38, size);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  } else {
    // Clean minimal: factory-team two-tone split with a refined single pinstripe
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(0, size * 0.64, size, size * 0.36);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.632, size, Math.max(5, size * 0.008));
    ctx.fillStyle = palette.detail;
    ctx.fillRect(0, size * 0.622, size, Math.max(2, size * 0.003));
  }
}

function getFontFamily(style: SkinDesignState["fontStyle"]): string {
  if (style === "condensed-gt") return "'Barlow Condensed', 'Impact', 'Arial Narrow', sans-serif";
  if (style === "mono-tech") return "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
  return "'Inter', 'Segoe UI', system-ui, sans-serif";
}

function drawDriverNumbers(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number): void {
  if (!state.showNumberOnCar) return;
  const num = (state.customNumber || "16").trim();
  const fontFam = getFontFamily(state.fontStyle);

  // Roof & hood numbers (avoiding official iRacing side door number plates unless user wants them)
  const roof = zonePx(state.zones.roof, size);
  const hood = zonePx(state.zones.hood, size);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Roof dorsal
  ctx.fillStyle = state.palette.numberColor === state.palette.secondary ? state.palette.detail : state.palette.detail;
  ctx.font = `900 ${Math.round(roof.h * 0.44)}px ${fontFam}`;
  ctx.fillText(num, roof.x + roof.w * 0.5, roof.y + roof.h * 0.58);

  // Hood corner mini dorsal
  const badgeW = hood.w * 0.22;
  const badgeH = hood.h * 0.22;
  const bx = hood.x + hood.w * 0.74;
  const by = hood.y + hood.h * 0.72;
  ctx.fillStyle = state.palette.numberBg;
  ctx.fillRect(bx, by, badgeW, badgeH);
  ctx.strokeStyle = state.palette.accent;
  ctx.lineWidth = Math.max(2, size * 0.0025);
  ctx.strokeRect(bx, by, badgeW, badgeH);

  ctx.fillStyle = state.palette.numberColor;
  ctx.font = `900 ${Math.round(badgeH * 0.68)}px ${fontFam}`;
  ctx.fillText(num, bx + badgeW / 2, by + badgeH / 2 + 1);
  ctx.restore();
}

async function drawDecals(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number, selectedDecalId?: string | null, forExport?: boolean): Promise<void> {
  for (const decal of state.decals) {
    const positions = decal.mirrorX
      ? [
          { x: decal.x, y: decal.y, rot: decal.rotation },
          { x: 1 - decal.x, y: decal.y, rot: -decal.rotation },
        ]
      : [{ x: decal.x, y: decal.y, rot: decal.rotation }];

    let img: HTMLImageElement | null = null;
    if (decal.kind !== "text") {
      const srcInfo = getDecalSource(decal);
      if (srcInfo) {
        img = await loadImageCached(srcInfo.key, srcInfo.src);
      }
    }

    for (let idx = 0; idx < positions.length; idx++) {
      const pos = positions[idx];
      const cx = pos.x * size;
      const cy = pos.y * size;
      const drawW = decal.scale * size;

      ctx.save();
      ctx.globalAlpha = Math.max(0.05, Math.min(1, decal.opacity));
      ctx.translate(cx, cy);
      ctx.rotate((pos.rot * Math.PI) / 180);

      let drawH = drawW * 0.35;
      if (decal.kind === "shape") {
        ctx.fillStyle = decal.color || "#00e699";
        if (decal.shapeType === "circle") {
          drawH = drawW;
          ctx.beginPath();
          ctx.arc(0, 0, drawW / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (decal.shapeType === "triangle") {
          drawH = drawW * 0.85;
          ctx.beginPath();
          ctx.moveTo(0, -drawH / 2);
          ctx.lineTo(drawW / 2, drawH / 2);
          ctx.lineTo(-drawW / 2, drawH / 2);
          ctx.closePath();
          ctx.fill();
        } else {
          // Freeform stripe / rectangle
          drawH = drawW * 0.22;
          ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
        }
      } else if (decal.kind === "text") {
        const fontFam = getFontFamily(state.fontStyle);
        const fontSize = Math.max(12, Math.round(drawW * 0.24));
        ctx.font = `800 ${fontSize}px ${fontFam}`;
        ctx.fillStyle = decal.color || "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(decal.text || decal.name, 0, 0);
        drawH = fontSize * 1.25;
      } else if (img) {
        const aspect = img.naturalHeight > 0 && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.35;
        drawH = drawW * aspect;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      if (!forExport && idx === 0 && selectedDecalId === decal.id) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#00ff9d";
        ctx.lineWidth = Math.max(2, size * 0.0025);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-drawW / 2 - 4, -drawH / 2 - 4, drawW + 8, drawH + 8);
      }
      ctx.restore();
    }
  }
}

function drawZonesOverlay(
  ctx: CanvasRenderingContext2D,
  zones: Record<ZoneKey, ZoneRect>,
  size: number,
  selectedZone?: ZoneKey | null,
): void {
  ctx.save();
  for (const z of Object.values(zones)) {
    const r = zonePx(z, size);
    const isSel = selectedZone === z.key;
    ctx.strokeStyle = z.restricted
      ? "rgba(239, 68, 68, 0.92)"
      : isSel
        ? "#00ff9d"
        : "rgba(56, 189, 248, 0.72)";
    ctx.lineWidth = isSel ? Math.max(3, size * 0.0035) : Math.max(1.5, size * 0.002);
    ctx.setLineDash(z.restricted ? [8, 5] : isSel ? [] : [5, 5]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    if (z.restricted) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.14)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    } else if (isSel) {
      ctx.fillStyle = "rgba(0, 255, 157, 0.09)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Label pill
    ctx.setLineDash([]);
    const fontSize = Math.max(11, Math.round(size * 0.013));
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    const tag = z.restricted ? `${z.label} · NO TAPAR` : z.label;
    const tw = ctx.measureText(tag).width + 12;
    const th = fontSize + 8;
    ctx.fillStyle = z.restricted ? "rgba(185, 28, 28, 0.9)" : isSel ? "rgba(5, 150, 105, 0.95)" : "rgba(9, 13, 20, 0.85)";
    ctx.fillRect(r.x, Math.max(0, r.y - th), tw, th);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(tag, r.x + 6, Math.max(th / 2, r.y - th / 2));

    // Resize handle on bottom-right for selected zone
    if (isSel) {
      const hs = Math.max(10, size * 0.012);
      ctx.fillStyle = "#00ff9d";
      ctx.fillRect(r.x + r.w - hs / 2, r.y + r.h - hs / 2, hs, hs);
    }
  }
  ctx.restore();
}

async function drawBrandEmblemPreview(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number): Promise<void> {
  const car = getCarById(state.carId);
  if (!car.logoPath) return;
  const img = await loadImageCached(`brand:${car.logoPath}`, car.logoPath);
  if (!img) return;

  const hood = zonePx(state.zones.hood, size);
  const fBump = zonePx(state.zones.frontBumper, size);
  const rBump = zonePx(state.zones.rearBumper, size);

  const drawBadge = (cx: number, cy: number, badgeSize: number) => {
    const aspect = img.naturalHeight > 0 && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
    const w = aspect >= 1 ? badgeSize / aspect : badgeSize;
    const h = aspect >= 1 ? badgeSize : badgeSize * aspect;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 4;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  };

  // Nose emblem (top of hood) + front & rear bumper badges (simulates iRacing's in-game Car Decals layer)
  drawBadge(hood.x + hood.w * 0.5, hood.y + hood.h * 0.14, size * 0.042);
  drawBadge(fBump.x + fBump.w * 0.5, fBump.y + fBump.h * 0.45, size * 0.036);
  drawBadge(rBump.x + rBump.w * 0.5, rBump.y + rBump.h * 0.52, size * 0.034);
}

function drawBrushStrokes(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number): void {
  const strokes = state.strokes;
  if (!Array.isArray(strokes) || strokes.length === 0) return;

  const paintPath = (pts: Array<{ x: number; y: number }>, color: string, widthNorm: number, flipX: boolean) => {
    if (pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, widthNorm * size);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      const px = (flipX ? 1 - pts[0].x : pts[0].x) * size;
      const py = pts[0].y * size;
      ctx.beginPath();
      ctx.arc(px, py, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      pts.forEach((p, i) => {
        const px = (flipX ? 1 - p.x : p.x) * size;
        const py = p.y * size;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
    ctx.restore();
  };

  for (const st of strokes) {
    paintPath(st.points, st.color, st.size, false);
    if (st.mirrorX) paintPath(st.points, st.color, st.size, true);
  }
}

export async function renderSkinToCanvas(
  canvas: HTMLCanvasElement,
  state: SkinDesignState,
  opts: CompositeOptions,
): Promise<void> {
  const { size } = opts;
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo obtener contexto Canvas 2D.");

  ctx.clearRect(0, 0, size, size);
  drawPatternGeometry(ctx, state, size);
  drawBrushStrokes(ctx, state, size);
  drawDriverNumbers(ctx, state, size);
  await drawDecals(ctx, state, size, opts.selectedDecalId, opts.forExport);

  // Official iRacing Parts / Decals / Lights / Contingencies layer from local PSD (preserved on export!)
  if (opts.partsOverlayCanvas) {
    ctx.save();
    ctx.drawImage(opts.partsOverlayCanvas, 0, 0, size, size);
    ctx.restore();
  }

  if (!opts.forExport && opts.showTemplateOverlay && opts.templateCanvas) {
    ctx.save();
    ctx.globalAlpha = opts.templateOpacity ?? 0.45;
    ctx.drawImage(opts.templateCanvas, 0, 0, size, size);
    ctx.restore();
  }

  if (!opts.forExport && opts.showZonesOverlay) {
    drawZonesOverlay(ctx, state.zones, size, opts.selectedZone);
  }
}

/**
 * Generates an iRacing-compatible Spec Map (car_spec_<id>.tga):
 * Red channel = Metallic (0..255)
 * Green channel = Roughness (0..255)
 * Blue channel = Clearcoat (0..255)
 */
export function renderSpecMapToCanvas(canvas: HTMLCanvasElement, state: SkinDesignState, size: number): void {
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo obtener contexto Canvas 2D para Spec Map.");

  const r = Math.round((state.spec.metallic / 100) * 255);
  const g = Math.round((state.spec.roughness / 100) * 255);
  const b = Math.round((state.spec.clearcoat / 100) * 255);

  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, size, size);

  // Satin-matte contrast on bumpers and carbon zones
  const carbonR = Math.min(255, Math.round(r * 0.5 + 30));
  const carbonG = Math.min(255, Math.round(Math.max(g, 130)));
  const carbonB = Math.round(b * 0.45);
  ctx.fillStyle = `rgb(${carbonR}, ${carbonG}, ${carbonB})`;

  for (const key of ["frontBumper", "rearBumper"] as const) {
    const z = zonePx(state.zones[key], size);
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }

  // Glossy metallic highlight on rear wing & mirrors
  const accentR = Math.min(255, Math.round(r + 50));
  const accentG = Math.max(16, Math.round(g * 0.55));
  const accentB = Math.min(255, Math.round(Math.max(b, 210)));
  ctx.fillStyle = `rgb(${accentR}, ${accentG}, ${accentB})`;
  for (const key of ["rearWing", "mirrors"] as const) {
    const z = zonePx(state.zones[key], size);
    ctx.fillRect(z.x, z.y, z.w, z.h);
  }
}
