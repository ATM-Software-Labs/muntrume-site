import { BUILTIN_DECALS, getCarById } from "./catalog";
import { DEFAULT_STAMPS } from "./stamps-library";
import type { DecalLayer, FinishType, NumberPlateMode, PaletteConfig, PatternStyle, SkinDesignState, SurfaceTexture, ZoneKey, ZoneRect } from "./types";

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
  /** Optional imported finished skin (.TGA/.PNG/.PSD) edited as the base paint layer */
  importedSkinCanvas?: HTMLCanvasElement | null;
  restrictedPlates?: ReservedGuideBox[];
  seriesSlots?: ReservedGuideBox[];
  showTemplateOverlay?: boolean;
  templateOpacity?: number;
  showZonesOverlay?: boolean;
  selectedZone?: ZoneKey | null;
  selectedDecalId?: string | null;
  forExport?: boolean;
  /** When true (3D WebGL preview), omits 2D iRacing Car_Mandatory & full-UV 2D sticker sheets so no stray lights/grilles/banners bleed onto approximate 3D panels */
  for3dPreview?: boolean;
  /** Override number rendering mode (used by exporter to generate both clean car_<id>.tga and stamped car_num_<id>.tga) */
  numberModeOverride?: NumberPlateMode;
}

const imageCache = new Map<string, HTMLImageElement>();

let activeImportedSkinCanvas: HTMLCanvasElement | null = null;
let activeImportedSkinName = "";
let activeKitMandatoryCanvas: HTMLCanvasElement | null = null;

export function setImportedBaseSkin(canvas: HTMLCanvasElement | null, filename = ""): void {
  activeImportedSkinCanvas = canvas;
  activeImportedSkinName = canvas ? filename : "";
}

export function setKitCarMandatoryCanvas(canvas: HTMLCanvasElement | null): void {
  activeKitMandatoryCanvas = canvas;
}

export function getImportedBaseSkin(): { canvas: HTMLCanvasElement | null; filename: string } {
  return { canvas: activeImportedSkinCanvas, filename: activeImportedSkinName };
}

/**
 * Samples the average paint color around the outer perimeter of a normalized UV box
 * so the smart "Tapar logo" patch tool blends seamlessly with the surrounding bodywork.
 */
export function sampleSurroundingPaintColor(
  u: number,
  v: number,
  w: number,
  h: number,
  fallback = "#111827",
): string {
  const src = activeImportedSkinCanvas;
  if (!src || src.width < 4 || src.height < 4) return fallback;
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallback;
  const W = src.width;
  const H = src.height;
  const x0 = Math.max(0, Math.min(W - 1, Math.round((u - w * 0.55) * W)));
  const x1 = Math.max(0, Math.min(W - 1, Math.round((u + w * 0.55) * W)));
  const y0 = Math.max(0, Math.min(H - 1, Math.round((v - h * 0.55) * H)));
  const y1 = Math.max(0, Math.min(H - 1, Math.round((v + h * 0.55) * H)));
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  const samplePt = (px: number, py: number) => {
    const d = ctx.getImageData(px, py, 1, 1).data;
    if (d[3] > 20) {
      rSum += d[0];
      gSum += d[1];
      bSum += d[2];
      count++;
    }
  };
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    const sx = Math.round(x0 + (x1 - x0) * t);
    const sy = Math.round(y0 + (y1 - y0) * t);
    samplePt(sx, y0);
    samplePt(sx, y1);
    samplePt(x0, sy);
    samplePt(x1, sy);
  }
  if (!count) return fallback;
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(rSum / count)}${toHex(gSum / count)}${toHex(bSum / count)}`;
}

function loadRawImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadImageCached(key: string, src: string): Promise<HTMLImageElement | null> {
  const existing = imageCache.get(key);
  if (existing && existing.complete && existing.naturalWidth > 0) {
    return existing;
  }

  // Ensure external SVGs without explicit width/height render crisply on <canvas>
  if (/\.svg(?:[?#].*)?$/i.test(src) && !src.startsWith("data:")) {
    try {
      const resp = await fetch(src);
      if (resp.ok) {
        let svgText = await resp.text();
        // Unwrap <image href="...webp"/> wrappers directly to their real raster asset
        const wrappedRaster = svgText.match(/<image[^>]+href=["']([^"']+\.(?:webp|png|jpg|jpeg))["']/i);
        if (wrappedRaster && wrappedRaster[1]) {
          const baseDir = src.slice(0, src.lastIndexOf("/") + 1);
          const rasterUrl = wrappedRaster[1].startsWith("/") || /^https?:/.test(wrappedRaster[1])
            ? wrappedRaster[1]
            : `${baseDir}${wrappedRaster[1]}`;
          const rImg = await loadRawImage(rasterUrl);
          if (rImg && rImg.naturalWidth > 0) {
            imageCache.set(key, rImg);
            return rImg;
          }
        }
        // Inject explicit width/height from viewBox if missing so naturalWidth/Height are always exact
        if (!/\bwidth\s*=/i.test(svgText.slice(0, 260)) || !/\bheight\s*=/i.test(svgText.slice(0, 260))) {
          const vb = svgText.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
          const w = vb ? Math.max(64, Math.round(Number(vb[1]) * 4)) : 512;
          const h = vb ? Math.max(64, Math.round(Number(vb[2]) * 4)) : 512;
          svgText = svgText.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
        }
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
        const sImg = await loadRawImage(dataUrl);
        if (sImg && sImg.naturalWidth > 0) {
          imageCache.set(key, sImg);
          return sImg;
        }
      }
    } catch {
      // Fall through to standard image load
    }
  }

  const img = await loadRawImage(src);
  if (img && img.naturalWidth > 0) {
    imageCache.set(key, img);
    return img;
  }
  return null;
}

function ensureCrispSvgSize(svg: string): string {
  if (/\bwidth\s*=/i.test(svg.slice(0, 260)) && /\bheight\s*=/i.test(svg.slice(0, 260))) {
    return svg;
  }
  const vb = svg.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  let w = vb ? Number(vb[1]) : 512;
  let h = vb ? Number(vb[2]) : 512;
  if (w > 0 && h > 0) {
    const targetMax = 1600;
    const scale = targetMax / Math.max(w, h);
    w = Math.max(128, Math.round(w * scale));
    h = Math.max(128, Math.round(h * scale));
  } else {
    w = 1024;
    h = 1024;
  }
  return svg.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
}

function getDecalSource(decal: DecalLayer): { key: string; src: string } | null {
  if (decal.kind === "custom" && decal.dataUrl) {
    return { key: `custom:${decal.id}:${decal.dataUrl.slice(0, 48)}`, src: decal.dataUrl };
  }
  if (decal.kind === "builtin" && decal.assetId) {
    const stamp = DEFAULT_STAMPS.find((s) => s.id === decal.assetId);
    if (stamp) {
      const svg = ensureCrispSvgSize(stamp.svg(decal.color || "#00e699"));
      const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return { key: `stamp:${stamp.id}:${decal.color}`, src: encoded };
    }
    const asset = BUILTIN_DECALS.find((b) => b.id === decal.assetId);
    if (!asset) return null;
    const svg = ensureCrispSvgSize(asset.svg(decal.color || "#ffffff"));
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
  } else if (pattern === "racing-stripes") {
    // Franjas Le Mans / GT horizontales alineadas al eje real de iRacing
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const cy = size * 0.59;
    const sw = size * 0.048;
    const gap = size * 0.016;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, cy - sw - gap * 0.5, size, sw);
    ctx.fillRect(0, cy + gap * 0.5, size, sw);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(0, cy - sw - gap * 0.5 - size * 0.012, size, size * 0.008);
    ctx.fillRect(0, cy + sw + gap * 0.5 + size * 0.004, size, size * 0.008);
  } else if (pattern === "tricolor-works") {
    // Tricolor Escudería (Works: 3 bandas diagonales limpias)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    ctx.rotate(-0.38);
    ctx.fillStyle = secColor;
    ctx.fillRect(-size, -size * 0.24, size * 2, size * 0.22);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(-size, -size * 0.02, size * 2, size * 0.11);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(-size, size * 0.09, size * 2, size * 0.04);
    ctx.restore();
  } else if (pattern === "checkered-flag") {
    // Bandera a Cuadros GT con degradado elegante
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, palette.primary);
    g.addColorStop(1, secColor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const cells = 24;
    const step = size / cells;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        if ((gx + gy) % 2 !== 0) continue;
        const fade = Math.max(0, Math.min(1, (gx / cells - 0.15) * 1.15));
        if (fade <= 0.04) continue;
        ctx.fillStyle = (gx + gy) % 4 === 0 ? palette.accent : palette.detail;
        ctx.globalAlpha = fade * 0.26;
        ctx.fillRect(gx * step, gy * step, step, step);
      }
    }
    ctx.globalAlpha = 1;
  } else if (pattern === "apex-shards") {
    // Fragmentos Apex Racing (geometría agresiva de alto contraste)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const poly = (pts: Array<[number, number]>, col: string, alpha: number) => {
      ctx.save();
      ctx.fillStyle = col;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * size, y * size) : ctx.lineTo(x * size, y * size)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    poly([[0, 0.18], [0.58, 0], [0.42, 0.36], [0, 0.44]], secColor, 0.9);
    poly([[0.48, 0.32], [1, 0.12], [1, 0.56], [0.34, 0.62]], secColor, 0.78);
    poly([[0, 0.66], [0.72, 0.54], [0.56, 1], [0, 1]], secColor, 0.85);
    poly([[0.22, 0.28], [0.68, 0.18], [0.64, 0.25], [0.18, 0.35]], palette.accent, 0.85);
    poly([[0.36, 0.72], [0.88, 0.60], [0.84, 0.67], [0.32, 0.79]], palette.accent, 0.85);
    poly([[0.44, 0.26], [0.74, 0.19], [0.72, 0.22], [0.42, 0.29]], palette.detail, 0.7);
  } else if (pattern === "speed-gradient") {
    // Degradado Aero Racing tricolor fluido
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, palette.primary);
    g.addColorStop(0.5, secColor);
    g.addColorStop(0.85, palette.accent);
    g.addColorStop(1, palette.primary);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (pattern === "grid-circuit") {
    // Telemetría / Circuito Tech
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const step = Math.max(16, Math.round(size / 28));
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = Math.max(1, size * 0.0012);
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = palette.accent;
    for (let x = step; x < size; x += step * 4) {
      for (let y = step; y < size; y += step * 4) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
  } else if (pattern === "martini-heritage") {
    // Franjas clásicas Martini / Heritage de competición
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const cy = size * 0.5;
    const band = (offset: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, cy + offset * size, size, h * size);
    };
    band(-0.11, 0.042, secColor);
    band(-0.062, 0.026, palette.detail);
    band(-0.032, 0.064, palette.accent);
    band(0.036, 0.026, palette.detail);
    band(0.068, 0.042, secColor);
  } else if (pattern === "gulf-classic") {
    // Banda central clásica Le Mans / Gulf con filete fino
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const bw = size * 0.24;
    const bx = (size - bw) / 2;
    ctx.fillStyle = palette.detail;
    ctx.fillRect(bx - size * 0.012, 0, bw + size * 0.024, size);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(bx, 0, bw, size);
    ctx.fillStyle = secColor;
    ctx.fillRect(0, size * 0.78, size, size * 0.22);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.765, size, size * 0.015);
  } else if (pattern === "jps-pinstripe") {
    // Estilo JPS / Doble filete dorado de alta precisión
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = palette.accent;
    const pad = size * 0.035;
    ctx.lineWidth = Math.max(3, size * 0.008);
    ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);
    ctx.lineWidth = Math.max(2, size * 0.004);
    ctx.strokeRect(pad * 1.7, pad * 1.7, size - pad * 3.4, size - pad * 3.4);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.492, size, size * 0.006);
    ctx.fillRect(0, size * 0.506, size, size * 0.006);
  } else if (pattern === "dazzle-test") {
    // Camuflaje Dazzle de test invernal F1 / GT3
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size * 0.5, size * 0.5);
    ctx.rotate(-0.42);
    const stripeW = Math.max(14, size * 0.024);
    for (let i = -size; i < size; i += stripeW * 2.1) {
      ctx.fillStyle = i % 2 === 0 ? secColor : palette.detail;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(i, -size, stripeW * 0.9, size * 2);
    }
    ctx.rotate(0.84);
    for (let i = -size; i < size; i += stripeW * 4.5) {
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.42;
      ctx.fillRect(i, -size, stripeW * 0.5, size * 2);
    }
    ctx.restore();
  } else if (pattern === "chevron-works") {
    // Chevrons angulados de equipo oficial de fábrica
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const drawChev = (xOff: number, w: number, col: string, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(size * xOff, 0);
      ctx.lineTo(size * (xOff + w), 0);
      ctx.lineTo(size * (xOff + w + 0.16), size * 0.5);
      ctx.lineTo(size * (xOff + w), size);
      ctx.lineTo(size * xOff, size);
      ctx.lineTo(size * (xOff + 0.16), size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    drawChev(0.14, 0.14, secColor, 0.92);
    drawChev(0.32, 0.08, palette.accent, 0.95);
    drawChev(0.44, 0.04, palette.detail, 0.85);
    drawChev(0.68, 0.12, secColor, 0.78);
  } else if (pattern === "endurance-split") {
    // Corte diagonal Endurance 24H (WEC / IMSA Pro)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.beginPath();
    ctx.moveTo(size * 0.42, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(size * 0.24, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(size * 0.39, 0);
    ctx.lineTo(size * 0.44, 0);
    ctx.lineTo(size * 0.26, size);
    ctx.lineTo(size * 0.21, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.detail;
    ctx.beginPath();
    ctx.moveTo(size * 0.46, 0);
    ctx.lineTo(size * 0.478, 0);
    ctx.lineTo(size * 0.298, size);
    ctx.lineTo(size * 0.28, size);
    ctx.closePath();
    ctx.fill();
  } else if (pattern === "iracing-works-01") {
    // Paint Shop #01: Works Nose & Roof 3-Color Band
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.fillRect(0, 0, size * 0.36, size);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(size * 0.34, 0, size * 0.045, size);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(size * 0.395, 0, size * 0.015, size);
  } else if (pattern === "iracing-gt-02") {
    // Paint Shop #02: GT Side-Sweep (dynamic sweeping motorsport diagonal)
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.56);
    ctx.lineTo(size, size * 0.16);
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.52);
    ctx.lineTo(size, size * 0.12);
    ctx.lineTo(size, size * 0.175);
    ctx.lineTo(0, size * 0.575);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.detail;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.495);
    ctx.lineTo(size, size * 0.095);
    ctx.lineTo(size, size * 0.112);
    ctx.lineTo(0, size * 0.512);
    ctx.closePath();
    ctx.fill();
  } else if (pattern === "iracing-enduro-03") {
    // Paint Shop #03: Endurance Dual-Stripe + Lower Sill
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.fillRect(0, size * 0.74, size, size * 0.26);
    ctx.fillRect(0, 0, size, size * 0.18);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.45, size, size * 0.036);
    ctx.fillRect(0, size * 0.515, size, size * 0.036);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(0, size * 0.73, size, size * 0.014);
    ctx.fillRect(0, size * 0.18, size, size * 0.014);
  } else if (pattern === "iracing-apex-04") {
    // Paint Shop #04: Apex Split-Body Front/Rear Contrast
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.beginPath();
    ctx.moveTo(size * 0.55, 0);
    ctx.lineTo(size, 0);
    ctx.lineTo(size, size);
    ctx.lineTo(size * 0.35, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(size * 0.50, 0);
    ctx.lineTo(size * 0.56, 0);
    ctx.lineTo(size * 0.36, size);
    ctx.lineTo(size * 0.30, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.detail;
    ctx.beginPath();
    ctx.moveTo(size * 0.47, 0);
    ctx.lineTo(size * 0.49, 0);
    ctx.lineTo(size * 0.29, size);
    ctx.lineTo(size * 0.27, size);
    ctx.closePath();
    ctx.fill();
  } else if (pattern === "iracing-sprint-05") {
    // Paint Shop #05: Sprint Rocker Wedge
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.80);
    ctx.lineTo(size * 0.65, size * 0.62);
    ctx.lineTo(size, size * 0.38);
    ctx.lineTo(size, size);
    ctx.lineTo(0, size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.77);
    ctx.lineTo(size * 0.64, size * 0.59);
    ctx.lineTo(size, size * 0.34);
    ctx.lineTo(size, size * 0.39);
    ctx.lineTo(size * 0.65, size * 0.63);
    ctx.lineTo(0, size * 0.81);
    ctx.closePath();
    ctx.fill();
  } else if (pattern === "iracing-blade-06") {
    // Paint Shop #06: Aero Side-Blade & Roof Trim
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.beginPath();
    ctx.moveTo(size * 0.12, size * 0.22);
    ctx.lineTo(size * 0.88, size * 0.22);
    ctx.lineTo(size * 0.78, size * 0.44);
    ctx.lineTo(size * 0.04, size * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.12, size * 0.78);
    ctx.lineTo(size * 0.88, size * 0.78);
    ctx.lineTo(size * 0.78, size * 0.56);
    ctx.lineTo(size * 0.04, size * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.47, size, size * 0.06);
  } else if (pattern === "iracing-rally-07") {
    // Paint Shop #07: Motorsport Triple-Slash
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    const slash = (x0: number, w: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(size * x0, 0);
      ctx.lineTo(size * (x0 + w), 0);
      ctx.lineTo(size * (x0 + w - 0.28), size);
      ctx.lineTo(size * (x0 - 0.28), size);
      ctx.closePath();
      ctx.fill();
    };
    slash(0.32, 0.16, secColor);
    slash(0.52, 0.09, palette.accent);
    slash(0.64, 0.045, palette.detail);
    slash(0.80, 0.14, secColor);
  } else if (pattern === "iracing-factory-08") {
    // Paint Shop #08: Clean Factory Works Trim
    ctx.fillStyle = palette.primary;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = secColor;
    ctx.fillRect(0, size * 0.86, size, size * 0.14);
    ctx.fillRect(0, 0, size, size * 0.10);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, size * 0.835, size, size * 0.028);
    ctx.fillRect(0, size * 0.10, size, size * 0.025);
    ctx.fillStyle = palette.detail;
    ctx.fillRect(0, size * 0.822, size, size * 0.01);
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

function drawDriverNumbers(
  ctx: CanvasRenderingContext2D,
  state: SkinDesignState,
  size: number,
  effectiveMode: NumberPlateMode,
): void {
  // Never paint synthetic driver names or roof/hood numbers by default.
  // In official Sim-Stamped mode iRacing renders numbers on the official IMSA/GT3 plates.
  // Only in explicit Custom Number mode do we stamp the number inside the exact IMSA/GT3 side plates.
  if (effectiveMode !== "custom-number") {
    return;
  }

  const num = (state.customNumber || "16").trim();
  const fontFam = getFontFamily(state.fontStyle);

  ctx.save();
  const plateKeys: Array<"numberPlateLeft" | "numberPlateRight"> = ["numberPlateLeft", "numberPlateRight"];
  for (const key of plateKeys) {
    const z = state.zones[key];
    if (!z || z.w <= 0.01 || z.h <= 0.01) continue;
    const p = zonePx(z, size);
    const radius = Math.max(4, Math.min(p.w, p.h) * 0.08);
    const isRight = key === "numberPlateRight";

    ctx.save();
    ctx.translate(p.x + p.w * 0.5, p.y + p.h * 0.5);
    if (isRight) ctx.rotate(Math.PI);

    ctx.beginPath();
    ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, radius);
    ctx.fillStyle = state.palette.numberBg;
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, size * 0.003);
    ctx.strokeStyle = state.palette.accent;
    ctx.stroke();

    // Top accent strip inside IMSA/GT3 plate
    const barH = Math.max(4, p.h * 0.14);
    ctx.fillStyle = state.palette.accent;
    ctx.fillRect(-p.w / 2 + 2, -p.h / 2 + 2, Math.max(0, p.w - 4), barH);

    // Driver number centered strictly inside the official IMSA/GT3 plate
    const fontSize = Math.max(16, Math.round(Math.min(p.w * 0.62, p.h * 0.62)));
    ctx.font = `900 ${fontSize}px ${fontFam}`;
    ctx.fillStyle = state.palette.numberColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, 0, barH * 0.5);
    ctx.restore();
  }
  ctx.restore();
}

async function drawDecals(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number, selectedDecalId?: string | null, forExport?: boolean, for3dPreview = false): Promise<void> {
  // Always draw full-UV official sheets underneath user logos/URLs so user text & muntru.me sit cleanly on top
  const orderedDecals = [...state.decals].sort((a, b) => {
    const aSheet = a.id.startsWith("official-uv-") && a.scale >= 0.95 ? 0 : 1;
    const bSheet = b.id.startsWith("official-uv-") && b.scale >= 0.95 ? 0 : 1;
    return aSheet - bSheet;
  });
  for (const decal of orderedDecals) {
    // Skip hidden layers (eye toggle), never bake wireframe guide into exported TGA,
    // and never project full-UV 2D iRacing sticker sheets onto approximate 3D preview meshes
    if (decal.opacity <= 0.001) continue;
    if ((forExport || for3dPreview) && decal.id.includes("-wireframe")) continue;
    // Full-UV 2D iRacing sticker sheets align 1:1 on iRacing's 2D UV map & exported .TGA,
    // never project them onto approximate 3D preview meshes (prevents white headlight/bumper blotches)
    if (for3dPreview && decal.id.startsWith("official-uv-") && decal.scale >= 0.95) continue;
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
      if (decal.kind === "patch") {
        // Smart logo/text cover-up patch with soft feathered edges matching surrounding paint
        drawH = (decal.patchH ?? decal.scale * 0.52) * size;
        const rad = Math.min(drawW, drawH) * 0.16;
        ctx.fillStyle = decal.color || "#111827";
        ctx.shadowColor = decal.color || "#111827";
        ctx.shadowBlur = Math.max(4, Math.min(drawW, drawH) * 0.12);
        ctx.beginPath();
        ctx.roundRect(-drawW / 2, -drawH / 2, drawW, drawH, rad);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (decal.kind === "shape") {
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
        const labelText = decal.text || decal.name;
        const fontSize = Math.max(12, Math.round(drawW * 0.24));
        ctx.font = `800 ${fontSize}px ${fontFam}`;
        drawH = fontSize * 1.28;
        // Seamless paint-matched backing strip for custom web URLs / rear bumper text
        // so racing stripes or stock manufacturer URLs (e.g. bmw-m.com) never strike through the text
        if (decal.id.includes("team-web") || decal.zoneHint === "rearBumper") {
          const metrics = ctx.measureText(labelText);
          const padX = Math.max(10, fontSize * 0.55);
          const padY = Math.max(6, fontSize * 0.32);
          const boxW = Math.max(drawW * 0.9, metrics.width + padX * 2);
          const boxH = fontSize + padY * 2;
          ctx.fillStyle = state.palette.primary || "#0f1722";
          ctx.beginPath();
          ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, Math.max(4, boxH * 0.18));
          ctx.fill();
        }
        ctx.fillStyle = decal.color || "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, 0, 0);
      } else if (img) {
        const isFullUv = decal.scale >= 0.95 && Math.abs(pos.x - 0.5) < 0.05 && Math.abs(pos.y - 0.5) < 0.05;
        const aspect = isFullUv
          ? 1
          : img.naturalHeight > 0 && img.naturalWidth > 0
            ? img.naturalHeight / img.naturalWidth
            : 0.35;
        drawH = drawW * aspect;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      }

      if (!forExport && idx === 0 && selectedDecalId === decal.id && decal.scale < 0.95) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#00ff9d";
        ctx.lineWidth = Math.max(2, size * 0.0025);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-drawW / 2 - 4, -drawH / 2 - 4, drawW + 8, drawH + 8);
        // Bottom-right resize handle
        ctx.setLineDash([]);
        const hs = Math.max(10, size * 0.014);
        ctx.fillStyle = "#00ff9d";
        ctx.fillRect(drawW / 2 + 4 - hs / 2, drawH / 2 + 4 - hs / 2, hs, hs);
        ctx.strokeStyle = "#061018";
        ctx.lineWidth = 2;
        ctx.strokeRect(drawW / 2 + 4 - hs / 2, drawH / 2 + 4 - hs / 2, hs, hs);
      }
      ctx.restore();
    }
  }
}

const ZONE_GUIDE_COLORS: Record<ZoneKey, { stroke: string; fill: string; badge: string; arrow?: string }> = {
  hood: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.11)", badge: "rgba(3, 105, 161, 0.92)", arrow: "▲ MORRO" },
  roof: { stroke: "#818cf8", fill: "rgba(129, 140, 248, 0.11)", badge: "rgba(67, 56, 202, 0.92)", arrow: "▲ FRENTE" },
  leftSide: { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.10)", badge: "rgba(4, 120, 87, 0.92)" },
  rightSide: { stroke: "#10b981", fill: "rgba(16, 185, 129, 0.10)", badge: "rgba(4, 120, 87, 0.92)" },
  rearWing: { stroke: "#c084fc", fill: "rgba(192, 132, 252, 0.12)", badge: "rgba(126, 34, 206, 0.92)" },
  frontBumper: { stroke: "#fb923c", fill: "rgba(251, 146, 60, 0.12)", badge: "rgba(194, 65, 12, 0.92)" },
  rearBumper: { stroke: "#f472b6", fill: "rgba(244, 114, 182, 0.12)", badge: "rgba(190, 24, 93, 0.92)" },
  mirrors: { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.13)", badge: "rgba(180, 83, 9, 0.92)" },
  numberPlateLeft: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.16)", badge: "rgba(185, 28, 28, 0.94)" },
  numberPlateRight: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.16)", badge: "rgba(185, 28, 28, 0.94)" },
};

function drawZonePaintOverrides(ctx: CanvasRenderingContext2D, state: SkinDesignState, size: number): void {
  const overrides = state.zoneOverrides;
  if (!overrides) return;
  for (const [k, ov] of Object.entries(overrides)) {
    if (!ov || (!ov.color && !ov.finish)) continue;
    const z = state.zones[k as ZoneKey];
    if (!z || z.restricted) continue;
    const r = zonePx(z, size);
    ctx.save();
    if (ov.color) {
      ctx.fillStyle = ov.color;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (ov.finish === "carbon") {
      drawCarbonPattern(ctx, r.x, r.y, r.w, r.h, size / 128);
    }
    ctx.restore();
  }
}

function drawZonesOverlay(
  ctx: CanvasRenderingContext2D,
  state: SkinDesignState,
  size: number,
  selectedZone?: ZoneKey | null,
): void {
  ctx.save();
  for (const z of Object.values(state.zones)) {
    if (z.restricted) continue; // Placas de dorsal ya se dibujan con drawReservedGuidesOverlay
    const r = zonePx(z, size);
    const isSel = selectedZone === z.key;
    const theme = ZONE_GUIDE_COLORS[z.key] || {
      stroke: "#38bdf8",
      fill: "rgba(56, 189, 248, 0.1)",
      badge: "rgba(9, 13, 20, 0.88)",
    };
    const ov = state.zoneOverrides?.[z.key];

    // 1. Relleno translúcido por pieza para diferenciar visualmente cada parte del coche
    ctx.fillStyle = isSel ? "rgba(0, 255, 157, 0.18)" : theme.fill;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // 2. Borde técnico fino
    ctx.strokeStyle = isSel ? "#00ff9d" : theme.stroke;
    ctx.lineWidth = isSel ? Math.max(3, size * 0.0034) : Math.max(1.5, size * 0.0018);
    ctx.setLineDash(isSel ? [] : [7, 5]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    // 3. Esquineros técnicos en L (estética plantilla oficial CAD / iRacing)
    const arm = Math.min(Math.max(10, size * 0.016), r.w * 0.22, r.h * 0.22);
    ctx.lineWidth = isSel ? Math.max(3.5, size * 0.0038) : Math.max(2.2, size * 0.0024);
    ctx.beginPath();
    // Top-left
    ctx.moveTo(r.x, r.y + arm); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + arm, r.y);
    // Top-right
    ctx.moveTo(r.x + r.w - arm, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w, r.y + arm);
    // Bottom-left
    ctx.moveTo(r.x, r.y + r.h - arm); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x + arm, r.y + r.h);
    // Bottom-right
    ctx.moveTo(r.x + r.w - arm, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h - arm);
    ctx.stroke();

    // 4. Etiqueta grande y nítida centrada dentro de cada pieza del coche
    const fontSize = Math.max(11, Math.round(size * 0.014));
    ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
    const customMark = ov && (ov.color || ov.finish) ? " ●" : "";
    const tag = `${z.label.toUpperCase()}${customMark}`;
    const tw = ctx.measureText(tag).width + 16;
    const th = fontSize + 10;
    const bx = r.x + Math.max(4, (r.w - tw) / 2);
    const by = r.y + Math.max(4, (r.h - th) / 2);

    ctx.fillStyle = isSel ? "rgba(5, 150, 105, 0.96)" : theme.badge;
    ctx.fillRect(bx, by, tw, th);
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, tw, th);

    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(tag, bx + tw / 2, by + th / 2 + 0.5);

    // 5. Flecha de orientación frontal (▲ MORRO / ▲ FRENTE) en Capó y Techo
    if (theme.arrow && r.h > th * 2.1) {
      const aFont = Math.max(9, Math.round(size * 0.01));
      ctx.font = `700 ${aFont}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.fillText(theme.arrow, r.x + r.w / 2, r.y + aFont + 5);
    }

    // 6. Tirador de redimensionado en la pieza seleccionada
    if (isSel) {
      const hs = Math.max(10, size * 0.013);
      ctx.fillStyle = "#00ff9d";
      ctx.fillRect(r.x + r.w - hs / 2, r.y + r.h - hs / 2, hs, hs);
      ctx.strokeStyle = "#061018";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + r.w - hs / 2, r.y + r.h - hs / 2, hs, hs);
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

  const effectiveNumberMode: NumberPlateMode = opts.numberModeOverride ?? state.numberMode ?? "sim-stamped";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, size, size);
  const importedBase = opts.importedSkinCanvas ?? activeImportedSkinCanvas;
  if (importedBase) {
    ctx.save();
    const flt = state.importedSkinFilter;
    if (flt && (flt.hue !== 0 || flt.sat !== 100 || flt.bright !== 100)) {
      ctx.filter = `hue-rotate(${flt.hue}deg) saturate(${flt.sat}%) brightness(${flt.bright}%)`;
    }
    ctx.drawImage(importedBase, 0, 0, size, size);
    ctx.restore();
  } else {
    drawPatternGeometry(ctx, state, size, opts.psdPatternCanvas);
  }
  drawZonePaintOverrides(ctx, state, size);
  drawBrushStrokes(ctx, state, size);
  drawDriverNumbers(ctx, state, size, effectiveNumberMode);
  await drawDecals(ctx, state, size, opts.selectedDecalId, opts.forExport, opts.for3dPreview);

  // Official iRacing Parts / Car_Mandatory layer (lights, grilles, vents, carbon trim — shown in 2D UV & PNG/TGA export, omitted in 3D preview so it never bleeds onto approximate 3D bodywork)
  const mandatoryLayer = opts.for3dPreview ? null : (opts.partsOverlayCanvas ?? activeKitMandatoryCanvas);
  if (mandatoryLayer) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mandatoryLayer, 0, 0, size, size);
    ctx.restore();
  }

  if (!opts.forExport && opts.showTemplateOverlay && opts.templateCanvas) {
    ctx.save();
    ctx.globalAlpha = opts.templateOpacity ?? 0.45;
    ctx.drawImage(opts.templateCanvas, 0, 0, size, size);
    ctx.restore();
  }

  // En modo Sim-Stamped, mostrar siempre la máscara visual "Zona reservada por iRacing" sobre placas de dorsal
  if (!opts.forExport && (opts.showTemplateOverlay || effectiveNumberMode === "sim-stamped")) {
    drawReservedGuidesOverlay(
      ctx,
      state,
      size,
      opts.restrictedPlates,
      opts.showTemplateOverlay ? opts.seriesSlots : undefined,
      effectiveNumberMode === "sim-stamped",
    );
  }

  if (!opts.forExport && opts.showZonesOverlay) {
    drawZonesOverlay(ctx, state, size, opts.selectedZone);
  }
}

function drawReservedGuidesOverlay(
  ctx: CanvasRenderingContext2D,
  state: SkinDesignState,
  size: number,
  restrictedPlates?: ReservedGuideBox[],
  seriesSlots?: ReservedGuideBox[],
  showSimStampedMask = true,
): void {
  const placedTags: Array<{ x: number; y: number; w: number; h: number }> = [];

  const drawBoxes = (
    boxes: ReservedGuideBox[],
    stroke: string,
    fill: string,
    badgeBg: string,
    shortPrefix: string,
    hatchLabel?: string,
  ) => {
    boxes.forEach((b, idx) => {
      if (!b || b.w <= 0.01 || b.h <= 0.01) return;
      const x = b.x * size;
      const y = b.y * size;
      const w = b.w * size;
      const h = b.h * size;

      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);

      // Subtle diagonal safety hatch for Sim-Stamped protected zones
      if (hatchLabel) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.strokeStyle = "rgba(239, 68, 68, 0.28)";
        ctx.lineWidth = Math.max(1.5, size * 0.0018);
        const step = Math.max(12, Math.round(size * 0.014));
        for (let d = -h; d < w + h; d += step) {
          ctx.beginPath();
          ctx.moveTo(x + d, y);
          ctx.lineTo(x + d - h, y + h);
          ctx.stroke();
        }
        const innerFs = Math.max(9, Math.round(Math.min(w * 0.11, size * 0.0115)));
        ctx.font = `800 ${innerFs}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "rgba(254, 202, 202, 0.92)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(hatchLabel, x + w / 2, y + h / 2);
        ctx.restore();
      }

      ctx.strokeStyle = stroke;
      ctx.lineWidth = Math.max(1.8, size * 0.002);
      ctx.setLineDash([Math.max(5, size * 0.006), Math.max(3, size * 0.004)]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      const label = `${shortPrefix} #${idx + 1}`;
      const fontSize = Math.max(9, Math.round(size * 0.0105));
      ctx.font = `800 ${fontSize}px Inter, system-ui, sans-serif`;
      const textW = ctx.measureText(label).width;
      const padX = Math.max(4, size * 0.004);
      const tagW = textW + padX * 2;
      const tagH = fontSize + 5;
      let tagY = Math.max(2, y - tagH - 2);
      for (const prev of placedTags) {
        if (x < prev.x + prev.w + 2 && x + tagW + 2 > prev.x && tagY < prev.y + prev.h + 2 && tagY + tagH + 2 > prev.y) {
          tagY = y + h + 2;
        }
      }
      placedTags.push({ x, y: tagY, w: tagW, h: tagH });
      ctx.fillStyle = badgeBg;
      ctx.fillRect(x, tagY, tagW, tagH);
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + padX, tagY + tagH / 2);
      ctx.restore();
    });
  };

  // 1. Huecos reservados de DORSAL iRacing (solo en modo Sim-Stamped)
  if (showSimStampedMask) {
    const numBoxes: ReservedGuideBox[] =
      Array.isArray(restrictedPlates) && restrictedPlates.length > 0
        ? restrictedPlates.slice(0, 4)
        : [
            {
              x: state.zones.numberPlateLeft.x,
              y: state.zones.numberPlateLeft.y,
              w: state.zones.numberPlateLeft.w,
              h: state.zones.numberPlateLeft.h,
            },
            {
              x: state.zones.numberPlateRight.x,
              y: state.zones.numberPlateRight.y,
              w: state.zones.numberPlateRight.w,
              h: state.zones.numberPlateRight.h,
            },
          ];

    drawBoxes(
      numBoxes,
      "rgba(239, 68, 68, 0.90)",
      "rgba(239, 68, 68, 0.14)",
      "rgba(185, 28, 28, 0.92)",
      "ZONA RESERVADA iRACING",
      "RESERVADO iRACING",
    );
  }

  // 2. Huecos reservados de DECALS DE CATEGORÍA / SERIE (ámbar)
  if (Array.isArray(seriesSlots) && seriesSlots.length > 0) {
    drawBoxes(
      seriesSlots.slice(0, 3),
      "rgba(245, 158, 11, 0.85)",
      "rgba(245, 158, 11, 0.10)",
      "rgba(180, 83, 9, 0.92)",
      "SERIE",
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

  // Per-part Spec Map overrides (e.g. Carbon hood, Matte roof, Chrome mirrors)
  if (state.zoneOverrides) {
    const finishToRgb = (f: FinishType): [number, number, number] => {
      switch (f) {
        case "gloss": return [30, 36, 235];
        case "satin": return [66, 92, 178];
        case "matte": return [20, 210, 38];
        case "metallic": return [189, 61, 224];
        case "chrome": return [245, 25, 250];
        case "carbon": return [107, 122, 140];
      }
    };
    for (const [k, ov] of Object.entries(state.zoneOverrides)) {
      if (!ov?.finish) continue;
      const z = state.zones[k as ZoneKey];
      if (!z || z.restricted) continue;
      const [zr, zg, zb] = finishToRgb(ov.finish);
      const px = zonePx(z, size);
      ctx.fillStyle = `rgb(${zr}, ${zg}, ${zb})`;
      ctx.fillRect(px.x, px.y, px.w, px.h);
    }
  }
}
