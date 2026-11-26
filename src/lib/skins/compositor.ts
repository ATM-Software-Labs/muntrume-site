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

  // Base 100 % opaca y sólida sobre todo el lienzo
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, size, size);

  if (spec.finish === "carbon" || spec.carbonAccent) {
    drawCarbonPattern(ctx, 0, 0, size, size, size / 112);
  }

  // Modo Diseño Libre: pintura base sólida limpia sin gráficos impuestos
  if (pattern === "freeform") {
    ctx.restore();
    return;
  }

  if (pattern === "endurance") {
    // Livery pro Endurance (bloques aerodinámicos opacos multi-capa estilo IMSA / WEC)
    // 1. Bloque superior e inferior en color secundario con corte angular agresivo
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(size * 0.18, size * 0.34);
    ctx.lineTo(0, size * 0.28);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(size, size);
    ctx.lineTo(size * 0.24, size);
    ctx.lineTo(size * 0.62, size * 0.56);
    ctx.lineTo(size, size * 0.42);
    ctx.closePath();
    ctx.fill();

    // 2. Cuña principal de acento motorsport (gruesa, sólida y equilibrada)
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.72);
    ctx.lineTo(size * 0.68, size * 0.36);
    ctx.lineTo(size, size * 0.24);
    ctx.lineTo(size, size * 0.34);
    ctx.lineTo(size * 0.66, size * 0.48);
    ctx.lineTo(0, size * 0.84);
    ctx.closePath();
    ctx.fill();

    // 3. Franja superior de contraste y borde nítido en color detalle
    ctx.fillStyle = palette.detail;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.69);
    ctx.lineTo(size * 0.68, size * 0.33);
    ctx.lineTo(size, size * 0.21);
    ctx.lineTo(size, size * 0.235);
    ctx.lineTo(size * 0.68, size * 0.355);
    ctx.lineTo(0, size * 0.715);
    ctx.closePath();
    ctx.fill();

    // 4. Bandas aerodinámicas secundarias en extremos opuestos (cobertura homogénea en capó, laterales y alerón)
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.16);
    ctx.lineTo(size * 0.34, 0);
    ctx.lineTo(size * 0.44, 0);
    ctx.lineTo(0, size * 0.24);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = palette.detail;
    ctx.beginPath();
    ctx.moveTo(size * 0.56, size);
    ctx.lineTo(size, size * 0.74);
    ctx.lineTo(size, size * 0.79);
    ctx.lineTo(size * 0.64, size);
    ctx.closePath();
    ctx.fill();
  } else if (pattern === "sprint") {
    // Livery Sprint Factory: bloques laterales en secundario + doble franja racing gruesa + puntas aerodinámicas
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(0, 0, size * 0.22, size);
    ctx.fillRect(size * 0.78, 0, size * 0.22, size);

    // Bandas de separación lateral en acento
    ctx.fillStyle = palette.accent;
    ctx.fillRect(size * 0.22, 0, size * 0.025, size);
    ctx.fillRect(size * 0.755, 0, size * 0.025, size);

    // Doble franja central racing sólida
    const cx = size * 0.5;
    const stripeW = size * 0.068;
    const gap = size * 0.022;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(cx - gap / 2 - stripeW, 0, stripeW, size);
    ctx.fillRect(cx + gap / 2, 0, stripeW, size);

    // Filetes exteriores de alto contraste
    ctx.fillStyle = palette.detail;
    const pinW = Math.max(5, size * 0.008);
    ctx.fillRect(cx - gap / 2 - stripeW - pinW * 2.2, 0, pinW, size);
    ctx.fillRect(cx + gap / 2 + stripeW + pinW * 1.2, 0, pinW, size);
  } else if (pattern === "carbon-stealth") {
    // Livery Carbono / Stealth geométrico (facetas angulares estilo Lamborghini Squadra Corse / Audi Sport)
    drawCarbonPattern(ctx, 0, 0, size, size, size / 110);

    // Facetas geométricas sólidas en secundario
    ctx.fillStyle = palette.secondary;
    const facets: Array<Array<[number, number]>> = [
      [[0, 0], [0.55, 0], [0.28, 0.42], [0, 0.34]],
      [[1, 0.12], [1, 0.64], [0.58, 0.46], [0.76, 0.16]],
      [[0, 0.58], [0.46, 0.74], [0.32, 1], [0, 1]],
      [[0.52, 0.62], [1, 0.82], [1, 1], [0.42, 1]],
    ];
    for (const poly of facets) {
      ctx.beginPath();
      poly.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px * size, py * size);
        else ctx.lineTo(px * size, py * size);
      });
      ctx.closePath();
      ctx.fill();
    }

    // Fragmentos afilados de acento neón
    ctx.fillStyle = palette.accent;
    const shards: Array<Array<[number, number]>> = [
      [[0, 0.33], [0.30, 0.41], [0.27, 0.46], [0, 0.38]],
      [[0.56, 0.45], [1, 0.62], [1, 0.68], [0.53, 0.50]],
      [[0, 0.56], [0.48, 0.73], [0.45, 0.77], [0, 0.61]],
      [[0.52, 0.61], [1, 0.80], [1, 0.84], [0.50, 0.65]],
    ];
    for (const poly of shards) {
      ctx.beginPath();
      poly.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px * size, py * size);
        else ctx.lineTo(px * size, py * size);
      });
      ctx.closePath();
      ctx.fill();
    }

    // Filos finos en color detalle
    ctx.strokeStyle = palette.detail;
    ctx.lineWidth = Math.max(3, size * 0.0045);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.315);
    ctx.lineTo(size * 0.31, size * 0.395);
    ctx.moveTo(size * 0.55, size * 0.435);
    ctx.lineTo(size, size * 0.605);
    ctx.stroke();
  } else if (pattern === "tricolor") {
    // Livery Tricolor Motorsport oficial (3 bandas anchas sólidas cruzando toda la carrocería + bloques de contraste)
    ctx.fillStyle = palette.secondary;
    ctx.beginPath();
    ctx.moveTo(size * 0.55, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(size * 0.15, size);
    ctx.closePath();
    ctx.fill();

    const colors = [palette.detail, palette.accent, palette.primary];
    const bandW = size * 0.085;
    colors.forEach((c, idx) => {
      ctx.fillStyle = c;
      const ox = size * 0.38 + idx * bandW * 1.05;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox + bandW, 0);
      ctx.lineTo(ox - size * 0.42 + bandW, size);
      ctx.lineTo(ox - size * 0.42, size);
      ctx.closePath();
      ctx.fill();
    });
  } else {
    // Clean Minimal Factory: carrocería bitono sólida de escudería oficial con doble banda de cintura
    ctx.fillStyle = palette.secondary;
    ctx.fillRect(0, size * 0.56, size, size * 0.44);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.54, size, size * 0.028);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(0, size * 0.525, size, size * 0.01);
  }

  ctx.restore();
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
