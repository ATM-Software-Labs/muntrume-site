import { BUILTIN_DECALS, getCarById } from "./catalog";
import type { DecalLayer, PaletteConfig, PatternStyle, SkinDesignState, SurfaceTexture, ZoneKey, ZoneRect } from "./types";

export interface ReservedGuideBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface CompositeOptions {
  size: number;
  templateCanvas?: HTMLCanvasElement | null;
  partsOverlayCanvas?: HTMLCanvasElement | null;
  /** Optional official iRacing Car Pattern RGB layer from a locally loaded PSD */
  psdPatternCanvas?: HTMLCanvasElement | null;
  restrictedPlates?: ReservedGuideBox[];
  seriesSlots?: ReservedGuideBox[];
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "#000000").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0");
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return [16, 24, 36];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * If the user picks the same color for Primary & Secondary (monochrome livery),
 * derive a subtle tonal step so layered graphics remain sleek instead of vanishing.
 */
function resolveTonalSecondary(primary: string, secondary: string): string {
  const [r1, g1, b1] = hexToRgb(primary);
  const [r2, g2, b2] = hexToRgb(secondary);
  const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
  if (diff >= 18) return secondary;
  const lum = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
  const delta = lum > 140 ? -22 : 24;
  return rgbToHex(r1 + delta, g1 + delta, b1 + delta);
}

let psdPatternCacheKey = "";
let psdPatternCacheCanvas: HTMLCanvasElement | null = null;

/**
 * Recolors an official iRacing 3-channel RGB Car Pattern layer (Red = Primary, Green = Secondary, Blue = Accent)
 * purely client-side so local .PSD templates can use all 25 native car patterns with custom MMT palettes.
 */
function drawRecoloredPsdPattern(
  ctx: CanvasRenderingContext2D,
  patternCanvas: HTMLCanvasElement,
  palette: PaletteConfig,
  size: number,
  patternTag: string,
): void {
  const workSize = Math.min(size, 1024);
  const key = `${patternTag}:${workSize}:${palette.primary}:${palette.secondary}:${palette.accent}`;
  if (psdPatternCacheKey !== key || !psdPatternCacheCanvas) {
    const tmp = document.createElement("canvas");
    tmp.width = workSize;
    tmp.height = workSize;
    const tctx = tmp.getContext("2d", { willReadFrequently: true });
    if (!tctx) return;
    tctx.drawImage(patternCanvas, 0, 0, workSize, workSize);
    const img = tctx.getImageData(0, 0, workSize, workSize);
    const data = img.data;
    const [r1, g1, b1] = hexToRgb(palette.primary);
    const [r2, g2, b2] = hexToRgb(palette.secondary);
    const [r3, g3, b3] = hexToRgb(palette.accent);

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 8) {
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
        data[i + 3] = 255;
        continue;
      }
      const wR = data[i] / 255;
      const wG = data[i + 1] / 255;
      const wB = data[i + 2] / 255;
      const sum = wR + wG + wB;
      if (sum < 0.04) {
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
      } else {
        const inv = sum > 1 ? 1 / sum : 1;
        const nR = wR * inv;
        const nG = wG * inv;
        const nB = wB * inv;
        const rem = Math.max(0, 1 - (nR + nG + nB));
        data[i] = Math.min(255, Math.round(r1 * (nR + rem) + r2 * nG + r3 * nB));
        data[i + 1] = Math.min(255, Math.round(g1 * (nR + rem) + g2 * nG + g3 * nB));
        data[i + 2] = Math.min(255, Math.round(b1 * (nR + rem) + b2 * nG + b3 * nB));
      }
      data[i + 3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    psdPatternCacheCanvas = tmp;
    psdPatternCacheKey = key;
  }

  ctx.save();
  ctx.drawImage(psdPatternCacheCanvas, 0, 0, size, size);
  ctx.restore();
}

/**
 * Authentic diagonal 2×2 twill carbon fiber weave (never looks like a transparency checkerboard).
 */
function drawCarbonPattern(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, scalePx: number): void {
  const tile = document.createElement("canvas");
  const s = Math.max(8, Math.min(16, Math.round(scalePx)));
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;

  // Fine diagonal 2x2 twill weave lines instead of blocky 50% checkerboard squares
  tctx.strokeStyle = "rgba(0,0,0,0.11)";
  tctx.lineWidth = Math.max(1.2, s * 0.16);
  tctx.beginPath();
  tctx.moveTo(-s * 0.25, s * 0.75);
  tctx.lineTo(s * 0.75, -s * 0.25);
  tctx.moveTo(s * 0.25, s * 1.25);
  tctx.lineTo(s * 1.25, s * 0.25);
  tctx.stroke();

  tctx.strokeStyle = "rgba(255,255,255,0.045)";
  tctx.lineWidth = Math.max(1, s * 0.1);
  tctx.beginPath();
  tctx.moveTo(0, s * 0.5);
  tctx.lineTo(s * 0.5, 0);
  tctx.moveTo(s * 0.5, s);
  tctx.lineTo(s, s * 0.5);
  tctx.stroke();

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawHalftoneDots(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  angleRad: number,
  density = 34,
): void {
  ctx.save();
  ctx.fillStyle = color;
  const step = size / density;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  for (let gy = 0; gy <= density; gy++) {
    for (let gx = 0; gx <= density; gx++) {
      const u = gx / density;
      const v = gy / density;
      // Smooth diagonal wave intensity (0..1)
      const proj = (u - 0.5) * cos + (v - 0.5) * sin + 0.5;
      const t = Math.max(0, Math.min(1, (proj - 0.22) / 0.65));
      if (t <= 0.06) continue;
      const radius = step * 0.42 * Math.pow(t, 1.25);
      ctx.globalAlpha = 0.18 + t * 0.68;
      ctx.beginPath();
      ctx.arc(gx * step, gy * step, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawHexMeshTexture(ctx: CanvasRenderingContext2D, size: number, strokeColor: string, alpha = 0.16): void {
  const tile = document.createElement("canvas");
  const r = Math.max(7, Math.round(size / 88));
  const dx = r * 1.5;
  const dy = r * Math.sqrt(3);
  tile.width = Math.round(dx * 2);
  tile.height = Math.round(dy);
  const tctx = tile.getContext("2d");
  if (!tctx) return;

  tctx.strokeStyle = strokeColor;
  tctx.globalAlpha = alpha;
  tctx.lineWidth = Math.max(1, r * 0.14);

  const drawHex = (cx: number, cy: number) => {
    tctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(ang);
      const py = cy + r * Math.sin(ang);
      if (i === 0) tctx.moveTo(px, py);
      else tctx.lineTo(px, py);
    }
    tctx.closePath();
    tctx.stroke();
  };

  drawHex(0, 0);
  drawHex(dx * 2, 0);
  drawHex(dx, dy / 2);
  drawHex(0, dy);
  drawHex(dx * 2, dy);

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawSpeedLinesTexture(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  const tile = document.createElement("canvas");
  const s = Math.max(24, Math.round(size / 36));
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  tctx.strokeStyle = color;
  tctx.globalAlpha = 0.11;
  tctx.lineWidth = Math.max(1.2, s * 0.07);
  tctx.beginPath();
  tctx.moveTo(-s * 0.25, s * 0.75);
  tctx.lineTo(s * 0.75, -s * 0.25);
  tctx.moveTo(s * 0.25, s * 1.25);
  tctx.lineTo(s * 1.25, s * 0.25);
  tctx.stroke();

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawMetallicFlakeTexture(ctx: CanvasRenderingContext2D, size: number): void {
  const tile = document.createElement("canvas");
  const s = 64;
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  // Deterministic fine metallic flake sparkle
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 140; i++) {
    const px = Math.floor(rand() * s);
    const py = Math.floor(rand() * s);
    const bright = rand() > 0.45;
    tctx.fillStyle = bright ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)";
    tctx.fillRect(px, py, 1.5, 1.5);
  }
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawSurfaceTexture(ctx: CanvasRenderingContext2D, texture: SurfaceTexture | undefined, palette: PaletteConfig, size: number): void {
  if (!texture || texture === "none") return;
  if (texture === "carbon") {
    drawCarbonPattern(ctx, 0, 0, size, size, size / 112);
  } else if (texture === "hex-mesh") {
    drawHexMeshTexture(ctx, size, palette.detail || "#ffffff", 0.14);
  } else if (texture === "speed-lines") {
    drawSpeedLinesTexture(ctx, size, palette.detail || "#ffffff");
  } else if (texture === "metallic-flake") {
    drawMetallicFlakeTexture(ctx, size);
  }
}

function zonePx(z: ZoneRect, size: number): { x: number; y: number; w: number; h: number } {
  return { x: z.x * size, y: z.y * size, w: z.w * size, h: z.h * size };
}

function drawForgedCarbonTexture(ctx: CanvasRenderingContext2D, size: number, baseHex: string, accentHex: string): void {
  const tile = document.createElement("canvas");
  const s = 128;
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;

  tctx.fillStyle = baseHex;
  tctx.fillRect(0, 0, s, s);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Organic Lamborghini-style forged carbon flakes (wraps seamlessly on any UV panel orientation)
  for (let i = 0; i < 85; i++) {
    const cx = rand() * s;
    const cy = rand() * s;
    const w = 10 + rand() * 20;
    const h = 5 + rand() * 11;
    const ang = rand() * Math.PI;
    const isLight = rand() > 0.45;
    tctx.save();
    tctx.translate(cx, cy);
    tctx.rotate(ang);
    tctx.fillStyle = isLight ? "rgba(255,255,255,0.085)" : "rgba(0,0,0,0.28)";
    tctx.beginPath();
    tctx.moveTo(-w * 0.5, -h * 0.3);
    tctx.lineTo(w * 0.45, -h * 0.5);
    tctx.lineTo(w * 0.5, h * 0.35);
    tctx.lineTo(-w * 0.35, h * 0.5);
    tctx.closePath();
    tctx.fill();
    tctx.restore();
  }

  // Subtle accent metallic flecks
  tctx.fillStyle = accentHex;
  tctx.globalAlpha = 0.08;
  for (let i = 0; i < 12; i++) {
    tctx.fillRect(rand() * s, rand() * s, 5 + rand() * 8, 2 + rand() * 3);
  }

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawBrushedMetalTexture(ctx: CanvasRenderingContext2D, size: number): void {
  const tile = document.createElement("canvas");
  const s = 128;
  tile.width = s;
  tile.height = s;
  const tctx = tile.getContext("2d");
  if (!tctx) return;

  let seed = 9001;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < s; y += 2) {
    const bright = rand() > 0.5;
    tctx.fillStyle = bright ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.055)";
    tctx.fillRect(0, y, s, 1);
  }
  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return;
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function normalizeUvSafePattern(p: PatternStyle): PatternStyle {
  switch (p) {
    case "endurance":
    case "apex-fade":
    case "clean-minimal":
    case "heritage-gulf":
      return "pearl-shift";
    case "carbon-stealth":
      return "carbon-exposed";
    case "geo-camo":
      return "stealth-camo";
    case "hex-tech":
      return "hex-stealth";
    case "sprint":
    case "tricolor":
    case "factory-chevron":
    case "lightning-drift":
      return "topo-flow";
    default:
      return p;
  }
}

function drawPatternCore(
  ctx: CanvasRenderingContext2D,
  rawPattern: PatternStyle,
  palette: PaletteConfig,
  size: number,
  carbonBase: boolean,
  surfaceTexture?: SurfaceTexture,
  psdPatternCanvas?: HTMLCanvasElement | null,
  psdPatternName?: string | null,
): void {
  // Base 100 % opaca y sólida sobre todo el lienzo
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, size, size);

  // Si hay un Car Pattern RGB oficial del .PSD cargado en local, usarlo 1:1
  if (psdPatternCanvas) {
    drawRecoloredPsdPattern(ctx, psdPatternCanvas, palette, size, psdPatternName || "psd-pattern");
    if (carbonBase) drawCarbonPattern(ctx, 0, 0, size, size, size / 112);
    drawSurfaceTexture(ctx, surfaceTexture, palette, size);
    ctx.restore();
    return;
  }

  const pattern = normalizeUvSafePattern(rawPattern);
  const secColor = resolveTonalSecondary(palette.primary, palette.secondary);

  if (pattern === "solid-factory" || pattern === "freeform") {
    // Pintura pura de concesionario / equipo oficial (0 cortes en UV)
  } else if (pattern === "pearl-shift") {
    // Degradado perlado / camaleón ultra-suave (sin cortes bruscos en paneles rotados)
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.52, secColor);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Sutil velo iridiscente del color acento
    const sheen = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
    sheen.addColorStop(0, palette.accent);
    sheen.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  } else if (pattern === "carbon-exposed") {
    // Carbono Expuesto 2x2 Twill fino sobre base oscura/tintada
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, secColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawCarbonPattern(ctx, 0, 0, size, size, size / 128);
  } else if (pattern === "forged-carbon") {
    // Carbono Forjado estilo Lamborghini Squadra Corse (100% seamless en cualquier orientación UV)
    drawForgedCarbonTexture(ctx, size, palette.primary, palette.accent);
  } else if (pattern === "stealth-camo") {
    // Camuflaje Prototipo Tonal (discreto, uniforme, sin líneas chillonas cortadas)
    const tile = document.createElement("canvas");
    const ts = 256;
    tile.width = ts;
    tile.height = ts;
    const tctx = tile.getContext("2d");
    if (tctx) {
      tctx.fillStyle = palette.primary;
      tctx.fillRect(0, 0, ts, ts);
      const drawTilePoly = (pts: Array<[number, number]>, col: string, alpha: number) => {
        tctx.save();
        tctx.fillStyle = col;
        tctx.globalAlpha = alpha;
        tctx.beginPath();
        pts.forEach(([x, y], i) => (i === 0 ? tctx.moveTo(x * ts, y * ts) : tctx.lineTo(x * ts, y * ts)));
        tctx.closePath();
        tctx.fill();
        tctx.restore();
      };
      drawTilePoly([[0, 0], [0.48, 0.08], [0.32, 0.44], [0, 0.36]], secColor, 0.78);
      drawTilePoly([[0.55, 0], [1, 0], [0.88, 0.38], [0.46, 0.28]], secColor, 0.62);
      drawTilePoly([[0.18, 0.48], [0.72, 0.36], [0.64, 0.78], [0.10, 0.72]], secColor, 0.85);
      drawTilePoly([[0.68, 0.56], [1, 0.44], [1, 0.92], [0.58, 0.86]], secColor, 0.7);
      drawTilePoly([[0.32, 0.22], [0.58, 0.14], [0.54, 0.28], [0.28, 0.34]], palette.accent, 0.22);
      drawTilePoly([[0.12, 0.78], [0.48, 0.68], [0.44, 0.84], [0.08, 0.92]], palette.accent, 0.18);
      const pat = ctx.createPattern(tile, "repeat");
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, size, size);
      }
    }
  } else if (pattern === "hex-stealth") {
    // Malla Hexagonal Tonal sobre degradado suave
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.55, secColor);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawHexMeshTexture(ctx, size, palette.accent, 0.24);
    drawHexMeshTexture(ctx, size, palette.detail, 0.08);
  } else if (pattern === "topo-flow") {
    // Curvas Topográficas Fluidas (uniformes y elegantes en cualquier panel rotado)
    const g = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, secColor);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const rings = 16;
    for (let i = 0; i < rings; i++) {
      const t = i / rings;
      ctx.strokeStyle = i % 3 === 0 ? palette.accent : palette.detail;
      ctx.globalAlpha = i % 3 === 0 ? 0.42 : 0.14;
      ctx.lineWidth = Math.max(1.5, size * (i % 3 === 0 ? 0.004 : 0.0022));
      ctx.beginPath();
      const baseY = size * (0.03 + t * 0.96);
      const amp = size * (0.045 + Math.sin(t * Math.PI) * 0.06);
      ctx.moveTo(-size * 0.05, baseY);
      ctx.bezierCurveTo(size * 0.3, baseY - amp, size * 0.65, baseY + amp, size * 1.05, baseY - amp * 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (pattern === "halftone-pro") {
    // Degradado Halftone Suave sin líneas cortadas
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.55, secColor);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawHalftoneDots(ctx, size, palette.accent, Math.PI * 0.25, 36);
  } else if (pattern === "brushed-metal") {
    // Titanio / Aluminio Cepillado fino de fábrica
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.5, secColor);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    drawBrushedMetalTexture(ctx, size);
  }

  if (carbonBase && pattern !== "carbon-exposed") {
    drawCarbonPattern(ctx, 0, 0, size, size, size / 128);
  }
  drawSurfaceTexture(ctx, surfaceTexture, palette, size);
  ctx.restore();
}

function drawPatternGeometry(
  ctx: CanvasRenderingContext2D,
  state: SkinDesignState,
  size: number,
  psdPatternCanvas?: HTMLCanvasElement | null,
): void {
  drawPatternCore(
    ctx,
    state.pattern,
    state.palette,
    size,
    state.spec.finish === "carbon" || state.spec.carbonAccent,
    state.surfaceTexture,
    psdPatternCanvas,
    state.psdPatternName,
  );
}

/**
 * Renders a crisp mini-preview thumbnail for the visual pattern gallery in the Design tab.
 */
export function renderPatternThumbnail(
  canvas: HTMLCanvasElement,
  pattern: PatternStyle,
  palette: PaletteConfig,
  surfaceTexture?: SurfaceTexture,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const s = canvas.width || 96;
  ctx.clearRect(0, 0, s, s);
  drawPatternCore(ctx, pattern, palette, s, pattern === "carbon-stealth", surfaceTexture, null, null);
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
  drawPatternGeometry(ctx, state, size, opts.psdPatternCanvas);
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

  // Huecos reservados para DORSAL (iRacing) y DECALS DE CATEGORÍA / SERIE (solo guía visual, nunca se exportan)
  if (!opts.forExport && opts.showTemplateOverlay) {
    drawReservedGuidesOverlay(ctx, state, size, opts.restrictedPlates, opts.seriesSlots);
  }

  if (!opts.forExport && opts.showZonesOverlay) {
    drawZonesOverlay(ctx, state.zones, size, opts.selectedZone);
  }
}

function drawReservedGuidesOverlay(
  ctx: CanvasRenderingContext2D,
  state: SkinDesignState,
  size: number,
  restrictedPlates?: ReservedGuideBox[],
  seriesSlots?: ReservedGuideBox[],
): void {
  const drawBoxes = (
    boxes: ReservedGuideBox[],
    stroke: string,
    fill: string,
    badgeBg: string,
    defaultLabel: string,
  ) => {
    for (const b of boxes) {
      if (!b || b.w <= 0.01 || b.h <= 0.01) continue;
      const x = b.x * size;
      const y = b.y * size;
      const w = b.w * size;
      const h = b.h * size;

      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(2, size * 0.0024);
      ctx.setLineDash([Math.max(6, size * 0.007), Math.max(4, size * 0.0045)]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      const label = b.label || defaultLabel;
      const fontSize = Math.max(10, Math.round(size * 0.012));
      ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
      const textW = ctx.measureText(label).width;
      const padX = Math.max(5, size * 0.005);
      const tagH = fontSize + 6;
      const tagY = Math.max(2, y - tagH - 2);
      ctx.fillStyle = badgeBg;
      ctx.fillRect(x, tagY, textW + padX * 2, tagH);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + padX, tagY + tagH / 2);
      ctx.restore();
    }
  };

  // 1. Huecos reservados de DORSAL iRacing (rojo)
  const numBoxes: ReservedGuideBox[] =
    Array.isArray(restrictedPlates) && restrictedPlates.length > 0
      ? restrictedPlates
      : [
          {
            x: state.zones.numberPlateLeft.x,
            y: state.zones.numberPlateLeft.y,
            w: state.zones.numberPlateLeft.w,
            h: state.zones.numberPlateLeft.h,
            label: "DORSAL IZQ. (iRacing)",
          },
          {
            x: state.zones.numberPlateRight.x,
            y: state.zones.numberPlateRight.y,
            w: state.zones.numberPlateRight.w,
            h: state.zones.numberPlateRight.h,
            label: "DORSAL DER. (iRacing)",
          },
        ];

  drawBoxes(
    numBoxes,
    "rgba(239, 68, 68, 0.92)",
    "rgba(239, 68, 68, 0.16)",
    "rgba(185, 28, 28, 0.92)",
    "DORSAL # (NO TAPAR)",
  );

  // 2. Huecos reservados de DECALS DE CATEGORÍA / SERIE (ámbar)
  if (Array.isArray(seriesSlots) && seriesSlots.length > 0) {
    drawBoxes(
      seriesSlots.slice(0, 4),
      "rgba(245, 158, 11, 0.90)",
      "rgba(245, 158, 11, 0.12)",
      "rgba(180, 83, 9, 0.92)",
      "SERIE / CATEGORÍA",
    );
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
