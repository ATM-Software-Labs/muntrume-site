import { decodeTgaToImageData } from "./tga-codec";
import type { TemplateAnalysisResult, ZoneKey, ZoneRect } from "./types";

export interface LoadedTemplate {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  filename: string;
  format: string;
}

export async function loadTemplateFile(file: File): Promise<LoadedTemplate> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".psd")) {
    throw new Error(
      "Los archivos .PSD deben exportarse primero como PNG o TGA (capa Wireframe/Mask o plantilla aplanada) desde Photoshop/Photopea para analizarlos localmente sin servidor.",
    );
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
