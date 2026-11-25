import { readPsd, type Layer } from "ag-psd";
import { decodeTgaToImageData } from "./tga-codec";
import type { TemplateAnalysisResult, ZoneKey, ZoneRect } from "./types";

export interface LoadedTemplate {
  canvas: HTMLCanvasElement;
  /** Official iRacing Wireframe / Number Blocks guide layer (never exported) */
  wireframeCanvas?: HTMLCanvasElement | null;
  /** Official iRacing Parts / Car_decal / Car_Mandatory layer (composited above paint) */
  partsOverlayCanvas?: HTMLCanvasElement | null;
  /** Official iRacing Mask layer used for clean panel bounding-box detection */
  maskCanvas?: HTMLCanvasElement | null;
  width: number;
  height: number;
  filename: string;
  format: string;
  layerCount?: number;
}

const SKIP_GROUP_RE = /custom\s*spec\s*map|car\s*patterns|imsa\s*style\s*size|pit\s*box|pitboard/i;
const WIRE_LAYER_RE = /^wire(frame)?$|\bwireframe\b|uv\s*grid/i;
const NUMBER_BLOCK_RE = /number\s*blocks?/i;
const MASK_LAYER_RE = /^mask$/i;
const MANDATORY_PARTS_RE = /car[_\s-]*mandatory|car[_\s-]*decal|color\s*change\s*logos/i;
const BASE_FILL_RE = /^(base|main\s*car\s*body|paintable\s*area|background|base\s*paint)$/i;

interface WalkOpts {
  includeHidden?: boolean;
  alphaMultiplier?: number;
}

function drawMatchingPsdLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[] | undefined,
  matcher: (layer: Layer, path: string[]) => boolean,
  opts: WalkOpts = {},
  path: string[] = [],
): number {
  if (!Array.isArray(layers)) return 0;
  let drawn = 0;
  for (const layer of layers) {
    const name = String(layer.name || "").trim();
    if (SKIP_GROUP_RE.test(name)) continue;

    const isGroup = Array.isArray(layer.children) && layer.children.length > 0;
    const nextPath = [...path, name];

    if (isGroup) {
      // Never descend into hidden groups unless explicitly requested
      if (layer.hidden && !opts.includeHidden) continue;
      drawn += drawMatchingPsdLayers(ctx, layer.children, matcher, opts, nextPath);
      continue;
    }

    if (layer.hidden && !opts.includeHidden) continue;
    if (!layer.canvas) continue;
    if (!matcher(layer, nextPath)) continue;

    ctx.save();
    const baseAlpha = typeof layer.opacity === "number" ? Math.max(0, Math.min(1, layer.opacity)) : 1;
    ctx.globalAlpha = baseAlpha * (opts.alphaMultiplier ?? 1);
    if (layer.blendMode && layer.blendMode !== "normal" && layer.blendMode !== "pass through") {
      const bm = layer.blendMode as GlobalCompositeOperation;
      if (["multiply", "screen", "overlay", "darken", "lighten"].includes(bm)) {
        ctx.globalCompositeOperation = bm;
      }
    }
    ctx.drawImage(layer.canvas, layer.left ?? 0, layer.top ?? 0);
    ctx.restore();
    drawn++;
  }
  return drawn;
}

function countPsdLayers(layers: Layer[] | undefined): number {
  if (!Array.isArray(layers)) return 0;
  let total = 0;
  for (const l of layers) {
    total += 1 + countPsdLayers(l.children);
  }
  return total;
}

export async function loadTemplateFile(file: File): Promise<LoadedTemplate> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".psd")) {
    const buf = await file.arrayBuffer();
    const psd = readPsd(buf, {
      skipThumbnail: true,
      skipCompositeImageData: true,
      skipLayerImageData: false,
    });
    const w = psd.width || 2048;
    const h = psd.height || 2048;

    // 1. Crisp UV Wireframe + Number Blocks guide (includeHidden: true because iRacing hides Wire & Number Blocks by default!)
    const wfCanvas = document.createElement("canvas");
    wfCanvas.width = w;
    wfCanvas.height = h;
    const wfCtx = wfCanvas.getContext("2d");
    let wfCount = 0;
    if (wfCtx) {
      wfCount += drawMatchingPsdLayers(
        wfCtx,
        psd.children,
        (l) => WIRE_LAYER_RE.test(String(l.name || "").trim()),
        { includeHidden: true, alphaMultiplier: 0.9 },
      );
      wfCount += drawMatchingPsdLayers(
        wfCtx,
        psd.children,
        (l) => NUMBER_BLOCK_RE.test(String(l.name || "").trim()),
        { includeHidden: true, alphaMultiplier: 0.32 },
      );
    }

    // 2. Clean Mask layer (for panel detection & wireframe fallback if a PSD has no Wire layer)
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext("2d");
    const maskCount = maskCtx
      ? drawMatchingPsdLayers(
          maskCtx,
          psd.children,
          (l) => MASK_LAYER_RE.test(String(l.name || "").trim()),
          { includeHidden: true, alphaMultiplier: 1 },
        )
      : 0;

    if (wfCount === 0 && maskCount > 0 && wfCtx) {
      wfCtx.save();
      wfCtx.globalAlpha = 0.35;
      wfCtx.drawImage(maskCanvas, 0, 0);
      wfCtx.restore();
      wfCount = maskCount;
    }

    // 3. Official Car Decals & Mandatory Parts (headlights, grilles, brand emblems — NEVER Spec Map or Base fill!)
    const partsCanvas = document.createElement("canvas");
    partsCanvas.width = w;
    partsCanvas.height = h;
    const pCtx = partsCanvas.getContext("2d");
    const partsCount = pCtx
      ? drawMatchingPsdLayers(
          pCtx,
          psd.children,
          (l) => {
            const n = String(l.name || "").trim();
            if (BASE_FILL_RE.test(n) || MASK_LAYER_RE.test(n) || WIRE_LAYER_RE.test(n)) return false;
            return MANDATORY_PARTS_RE.test(n);
          },
          { includeHidden: false, alphaMultiplier: 1 },
        )
      : 0;

    // 4. Analysis canvas (prefer crisp Mask, otherwise Wireframe)
    const analysisCanvas = maskCount > 0 ? maskCanvas : wfCanvas;

    return {
      canvas: analysisCanvas,
      wireframeCanvas: wfCount > 0 ? wfCanvas : null,
      partsOverlayCanvas: partsCount > 0 ? partsCanvas : null,
      maskCanvas: maskCount > 0 ? maskCanvas : null,
      width: w,
      height: h,
      filename: file.name,
      format: "PSD",
      layerCount: countPsdLayers(psd.children),
    };
  }

  if (lower.endsWith(".tga")) {
    const buf = await file.arrayBuffer();
    const imgData = decodeTgaToImageData(buf);
    const canvas = document.createElement("canvas");
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo inicializar Canvas 2D.");
    ctx.putImageData(imgData, 0, 0);
    return { canvas, width: imgData.width, height: imgData.height, filename: file.name, format: "TGA" };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de plantilla."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Formato de imagen no válido. Usa PNG, TGA o WEBP."));
    el.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar Canvas 2D.");
  ctx.drawImage(img, 0, 0);

  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    filename: file.name,
    format: lower.endsWith(".png") ? "PNG" : lower.endsWith(".webp") ? "WEBP" : "IMAGE",
  };
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixels: number;
}

/**
 * Analyzes an uploaded iRacing template using alpha-channel masks and Sobel edge/wireframe density
 * to extract bounding boxes for major paintable car panels (hood, roof, sides, wing, mirrors, bumpers).
 */
export function analyzeTemplateZones(
  template: LoadedTemplate,
  fallbackZones: Record<ZoneKey, ZoneRect>,
): TemplateAnalysisResult {
  const GRID = 256;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = GRID;
  sampleCanvas.height = GRID;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      width: template.width,
      height: template.height,
      format: template.format,
      detectedZones: {},
      panelCount: 0,
      hasAlphaMask: false,
      wireframeDensity: 0,
      summary: "No se pudo inicializar el analizador de lienzo.",
    };
  }

  ctx.drawImage(template.canvas, 0, 0, GRID, GRID);
  const img = ctx.getImageData(0, 0, GRID, GRID).data;

  // 1. Detect whether template uses transparent background (alpha mask) or opaque background with wireframe/panels
  let transparentCount = 0;
  const lum = new Float32Array(GRID * GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const a = img[i * 4 + 3];
    if (a < 220) transparentCount++;
    lum[i] = 0.299 * img[i * 4] + 0.587 * img[i * 4 + 1] + 0.114 * img[i * 4 + 2];
  }
  const hasAlphaMask = transparentCount > GRID * GRID * 0.08;

  // Estimate dominant corner background luminance for opaque templates
  const bgLum =
    (lum[0] + lum[GRID - 1] + lum[(GRID - 1) * GRID] + lum[GRID * GRID - 1]) / 4;

  // 2. Build active mask: either alpha > 32 OR Sobel gradient / luminance delta from background
  const mask = new Uint8Array(GRID * GRID);
  let edgePixels = 0;

  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      const gx =
        -lum[idx - GRID - 1] +
        lum[idx - GRID + 1] -
        2 * lum[idx - 1] +
        2 * lum[idx + 1] -
        lum[idx + GRID - 1] +
        lum[idx + GRID + 1];
      const gy =
        -lum[idx - GRID - 1] -
        2 * lum[idx - GRID] -
        lum[idx - GRID + 1] +
        lum[idx + GRID - 1] +
        2 * lum[idx + GRID] +
        lum[idx + GRID + 1];
      const grad = Math.hypot(gx, gy);
      if (grad > 68) edgePixels++;

      if (hasAlphaMask) {
        if (img[idx * 4 + 3] > 32) mask[idx] = 1;
      } else {
        if (Math.abs(lum[idx] - bgLum) > 20 || grad > 60) {
          mask[idx] = 1;
        }
      }
    }
  }

  // Dilate slightly (1px) so wireframe lines merge into cohesive panel regions
  const dilated = new Uint8Array(GRID * GRID);
  for (let y = 1; y < GRID - 1; y++) {
    for (let x = 1; x < GRID - 1; x++) {
      const idx = y * GRID + x;
      if (
        mask[idx] ||
        mask[idx - 1] ||
        mask[idx + 1] ||
        mask[idx - GRID] ||
        mask[idx + GRID]
      ) {
        dilated[idx] = 1;
      }
    }
  }

  // 3. Connected-component flood fill to find bounding boxes of distinct panels
  const visited = new Uint8Array(GRID * GRID);
  const boxes: BBox[] = [];
  const queue = new Int32Array(GRID * GRID);

  for (let start = 0; start < GRID * GRID; start++) {
    if (!dilated[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    let minX = GRID;
    let minY = GRID;
    let maxX = 0;
    let maxY = 0;
    let pixels = 0;

    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % GRID;
      const cy = (cur - cx) / GRID;
      pixels++;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;

      if (cx > 0 && dilated[cur - 1] && !visited[cur - 1]) {
        visited[cur - 1] = 1;
        queue[tail++] = cur - 1;
      }
      if (cx < GRID - 1 && dilated[cur + 1] && !visited[cur + 1]) {
        visited[cur + 1] = 1;
        queue[tail++] = cur + 1;
      }
      if (cy > 0 && dilated[cur - GRID] && !visited[cur - GRID]) {
        visited[cur - GRID] = 1;
        queue[tail++] = cur - GRID;
      }
      if (cy < GRID - 1 && dilated[cur + GRID] && !visited[cur + GRID]) {
        visited[cur + GRID] = 1;
        queue[tail++] = cur + GRID;
      }
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    // Ignore tiny noise (< 14x10 px) or full-canvas background box (> 92% of UV)
    if (pixels >= 90 && bw >= 12 && bh >= 8 && !(bw > GRID * 0.92 && bh > GRID * 0.92)) {
      boxes.push({ minX, minY, maxX, maxY, pixels });
    }
  }

  boxes.sort((a, b) => b.pixels - a.pixels);

  // 4. Match detected panels to semantic car zones by normalized UV position & aspect ratio
  const detectedZones: Partial<Record<ZoneKey, ZoneRect>> = {};
  const usedBoxIdx = new Set<number>();

  const candidateKeys: ZoneKey[] = [
    "hood",
    "roof",
    "leftSide",
    "rightSide",
    "rearWing",
    "frontBumper",
    "rearBumper",
    "mirrors",
  ];

  for (const key of candidateKeys) {
    const ref = fallbackZones[key];
    const refCx = ref.x + ref.w / 2;
    const refCy = ref.y + ref.h / 2;
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < Math.min(boxes.length, 28); i++) {
      if (usedBoxIdx.has(i)) continue;
      const b = boxes[i];
      const nx = b.minX / GRID;
      const ny = b.minY / GRID;
      const nw = (b.maxX - b.minX + 1) / GRID;
      const nh = (b.maxY - b.minY + 1) / GRID;
      const cx = nx + nw / 2;
      const cy = ny + nh / 2;
      const dist = Math.hypot(cx - refCx, cy - refCy);
      const sizeDiff = Math.abs(nw - ref.w) + Math.abs(nh - ref.h);
      const score = dist * 1.4 + sizeDiff * 0.6;
      if (score < 0.45 && score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      usedBoxIdx.add(bestIdx);
      const b = boxes[bestIdx];
      detectedZones[key] = {
        ...ref,
        x: Number((b.minX / GRID).toFixed(3)),
        y: Number((b.minY / GRID).toFixed(3)),
        w: Number(((b.maxX - b.minX + 1) / GRID).toFixed(3)),
        h: Number(((b.maxY - b.minY + 1) / GRID).toFixed(3)),
        detectedConfidence: Math.max(0.45, Math.min(0.98, Number((1 - bestScore).toFixed(2)))),
      };
    }
  }

  const matchedCount = Object.keys(detectedZones).length;
  const wireframeDensity = Number(((edgePixels / (GRID * GRID)) * 100).toFixed(1));
  const summary =
    matchedCount > 0
      ? `Detectadas ${boxes.length} regiones útiles (${matchedCount}/8 zonas mapeadas automáticamente, ${hasAlphaMask ? "máscara alfa" : "análisis de bordes"}, densidad wireframe ${wireframeDensity}%). Ajusta cualquier caja manualmente en el lienzo.`
      : `Plantilla cargada (${template.width}×${template.height} ${template.format}). No se aislaron paneles independientes (plantilla muy densa o plana); se mantienen las zonas base del coche listas para ajuste manual.`;

  return {
    width: template.width,
    height: template.height,
    format: template.format,
    detectedZones,
    panelCount: boxes.length,
    hasAlphaMask,
    wireframeDensity,
    summary,
  };
}
