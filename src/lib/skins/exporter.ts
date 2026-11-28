import JSZip from "jszip";
import { renderSkinToCanvas, renderSpecMapToCanvas } from "./compositor";
import { encodeTgaFromImageData } from "./tga-codec";
import type { CarProfile, PhotoGuideShot, SkinDesignState } from "./types";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function sanitizeCustomerId(raw: string): string {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  return digits || "000000";
}

function getExportBasePrefix(carId: string): string {
  if (carId === "helmet") return "helmet";
  if (carId === "suit") return "suit";
  return "car";
}

/**
 * Trading Paints strictly requires 2048x2048 24-bit uncompressed .TGA (~12.0 MB).
 * When the user selects 4096px (4K), we supersample at 4096px and downsample with
 * high-quality filtering to 2048x2048 so logos/lines stay razor-sharp while Trading Paints
 * accepts the file 100% of the time.
 */
async function renderTradingPaintsTgaImageData(
  state: SkinDesignState,
  numberModeOverride: "sim-stamped" | "custom-number",
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<ImageData> {
  const TARGET_TGA_SIZE = 2048;
  const renderSize = state.resolution === 4096 ? 4096 : 2048;
  const workCanvas = document.createElement("canvas");
  workCanvas.width = renderSize;
  workCanvas.height = renderSize;

  await renderSkinToCanvas(workCanvas, state, {
    size: renderSize,
    partsOverlayCanvas,
    psdPatternCanvas,
    forExport: true,
    numberModeOverride,
  });

  let finalCanvas = workCanvas;
  if (renderSize !== TARGET_TGA_SIZE) {
    finalCanvas = document.createElement("canvas");
    finalCanvas.width = TARGET_TGA_SIZE;
    finalCanvas.height = TARGET_TGA_SIZE;
    const fCtx = finalCanvas.getContext("2d", { willReadFrequently: true });
    if (!fCtx) throw new Error("No se pudo crear el lienzo 2048×2048 para Trading Paints.");
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = "high";
    fCtx.drawImage(workCanvas, 0, 0, TARGET_TGA_SIZE, TARGET_TGA_SIZE);
    workCanvas.width = 1;
    workCanvas.height = 1;
  }

  const ctx = finalCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo de exportación.");
  const data = ctx.getImageData(0, 0, TARGET_TGA_SIZE, TARGET_TGA_SIZE);
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = 255;
  finalCanvas.width = 1;
  finalCanvas.height = 1;
  return data;
}

async function renderTgaBuffers(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<{ diffuseTga: Uint8Array; customNumTga: Uint8Array | null; specTga: Uint8Array; size: number }> {
  const TARGET_TGA_SIZE = 2048;
  const cid = sanitizeCustomerId(state.customerId);
  const isCustomNumber = (state.numberMode || "sim-stamped") === "custom-number";
  onProgress?.(`Renderizando textura Trading Paints 2048×2048px${state.resolution === 4096 ? " (supersampling 4K)" : ""}...`);

  const diffuseData = await renderTradingPaintsTgaImageData(state, "sim-stamped", partsOverlayCanvas, psdPatternCanvas);
  onProgress?.(`Codificando car_${cid}.tga (24-bit TGA 2.0 · 2048px)...`);
  const diffuseTga = encodeTgaFromImageData(diffuseData, false);

  let customNumTga: Uint8Array | null = null;
  if (isCustomNumber) {
    onProgress?.(`Renderizando dorsal fijo car_num_${cid}.tga...`);
    const numData = await renderTradingPaintsTgaImageData(state, "custom-number", partsOverlayCanvas, psdPatternCanvas);
    customNumTga = encodeTgaFromImageData(numData, false);
  }

  onProgress?.(`Generando car_spec_${cid}.tga (2048px)...`);
  const specCanvas = document.createElement("canvas");
  specCanvas.width = TARGET_TGA_SIZE;
  specCanvas.height = TARGET_TGA_SIZE;
  renderSpecMapToCanvas(specCanvas, state, TARGET_TGA_SIZE);
  const sCtx = specCanvas.getContext("2d", { willReadFrequently: true });
  if (!sCtx) throw new Error("No se pudo leer el Spec Map.");
  const specData = sCtx.getImageData(0, 0, TARGET_TGA_SIZE, TARGET_TGA_SIZE);
  const specTga = encodeTgaFromImageData(specData, false);
  specCanvas.width = 1;
  specCanvas.height = 1;

  return { diffuseTga, customNumTga, specTga, size: TARGET_TGA_SIZE };
}

export async function exportSingleDiffuseTga(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  onProgress?.(`Renderizando car_${cid}.tga (2048×2048px Trading Paints)...`);
  const diffuseData = await renderTradingPaintsTgaImageData(state, "sim-stamped", partsOverlayCanvas, psdPatternCanvas);
  const tga = encodeTgaFromImageData(diffuseData, false);

  const prefix = getExportBasePrefix(state.carId);
  const filename = `${prefix}_${cid}.tga`;
  triggerDownload(new Blob([tga.buffer as ArrayBuffer], { type: "image/x-tga" }), filename);
  return filename;
}

export async function exportSingleCustomNumberTga(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  onProgress?.(`Renderizando dorsal fijo car_num_${cid}.tga (2048×2048px)...`);
  const numData = await renderTradingPaintsTgaImageData(state, "custom-number", partsOverlayCanvas, psdPatternCanvas);
  const tga = encodeTgaFromImageData(numData, false);

  const prefix = getExportBasePrefix(state.carId);
  const filename = `${prefix}_num_${cid}.tga`;
  triggerDownload(new Blob([tga.buffer as ArrayBuffer], { type: "image/x-tga" }), filename);
  return filename;
}

export async function exportSingleSpecTga(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const size = 2048;
  onProgress?.(`Generando car_spec_${cid}.tga (2048×2048px)...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  renderSpecMapToCanvas(workCanvas, state, size);
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo Spec Map.");
  const tga = encodeTgaFromImageData(ctx.getImageData(0, 0, size, size), false);
  workCanvas.width = 1;
  workCanvas.height = 1;

  const prefix = getExportBasePrefix(state.carId);
  const filename = `${prefix}_spec_${cid}.tga`;
  triggerDownload(new Blob([tga.buffer as ArrayBuffer], { type: "image/x-tga" }), filename);
  return filename;
}

export async function exportSingleDiffusePng(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const size = state.resolution;
  const workCanvas = document.createElement("canvas");
  onProgress?.(`Renderizando pintura .PNG ${size}×${size}px...`);
  await renderSkinToCanvas(workCanvas, state, {
    size,
    partsOverlayCanvas,
    psdPatternCanvas,
    forExport: true,
    numberModeOverride: state.numberMode || "sim-stamped",
  });
  const blob = await new Promise<Blob | null>((resolve) => workCanvas.toBlob((b) => resolve(b), "image/png"));
  workCanvas.width = 1;
  workCanvas.height = 1;
  if (!blob) throw new Error("No se pudo generar el archivo PNG.");
  const prefix = getExportBasePrefix(state.carId);
  const filename = `${prefix}_${cid}_${size}px.png`;
  triggerDownload(blob, filename);
  return filename;
}

export async function exportSingleSpecPng(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const size = state.resolution;
  const workCanvas = document.createElement("canvas");
  onProgress?.(`Renderizando Spec Map .PNG ${size}×${size}px...`);
  renderSpecMapToCanvas(workCanvas, state, size);
  const blob = await new Promise<Blob | null>((resolve) => workCanvas.toBlob((b) => resolve(b), "image/png"));
  workCanvas.width = 1;
  workCanvas.height = 1;
  if (!blob) throw new Error("No se pudo generar el Spec Map PNG.");
  const prefix = getExportBasePrefix(state.carId);
  const filename = `${prefix}_spec_${cid}_${size}px.png`;
  triggerDownload(blob, filename);
  return filename;
}

function buildReadmeTxt(car: CarProfile, state: SkinDesignState, shots: PhotoGuideShot[]): string {
  const cid = sanitizeCustomerId(state.customerId);
  const isCustomNum = (state.numberMode || "sim-stamped") === "custom-number";
  const lines = [
    `MUNTRUME MOTORSPORT — PAQUETE DE SKIN iRACING (skins.muntru.me)`,
    `================================================================`,
    `Diseño:       ${state.name}`,
    `Coche:        ${car.name} (carpeta: ${car.iracingFolder})`,
    `Piloto:       ${state.customDriverName} #${state.customNumber}`,
    `Customer ID:  ${cid}`,
    `Modo Dorsal:  ${isCustomNum ? "Custom Number (car_num_<id>.tga + base limpia)" : "Oficial / Sim-Stamped (placas protegidas para iRacing)"}`,
    `Resolución:   ${state.resolution}x${state.resolution} px (TGA 24-bit sin compresión RLE)`,
    `Acabado Spec: ${state.spec.finish} (Metallic ${state.spec.metallic}% / Roughness ${state.spec.roughness}% / Clearcoat ${state.spec.clearcoat}%)`,
    ``,
    `1) INSTALACIÓN LOCAL EN iRACING`,
    `--------------------------------`,
    `Copia los archivos TGA dentro de:`,
    `  Documents\\iRacing\\paint\\${car.iracingFolder}\\`,
    `  - car_${cid}.tga          (Pintura base limpia / Sim-Stamped)`,
    ...(isCustomNum ? [`  - car_num_${cid}.tga      (Pintura con dorsal fijo #${state.customNumber} / Custom Number)`] : []),
    `  - car_spec_${cid}.tga     (Acabado metálico/mate/carbono)`,
    `Pulsa Ctrl+R dentro del simulador para recargar la pintura al instante.`,
    ``,
    `2) SUBIDA A TRADING PAINTS (QUÉ ARCHIVO VA EN CADA CASILLA)`,
    `-----------------------------------------------------------`,
    `  a) Entra en https://www.tradingpaints.com/ -> "My Paints" -> ${car.name}`,
    `  b) Casilla "Sim-Stamped Number Paint (Upload a paint)":`,
    `     -> Sube car_${cid}.tga (respeta las placas oficiales de iRacing).`,
    ...(isCustomNum
      ? [
          `  c) Casilla "Custom Number Paint" (ligas / endurance / dorsal personalizado):`,
          `     -> Sube car_num_${cid}.tga (incluye el dorsal #${state.customNumber} estampado).`,
          `     -> Asegúrate de activar "Hide car numbers" en Trading Paints Downloader.`,
        ]
      : []),
    `  d) Casilla "Add spec map or decal layer":`,
    `     -> Copia car_spec_${cid}.tga en Documents\\iRacing\\paint\\${car.iracingFolder}\\, abre el coche en iRacing`,
    `        (genera car_spec_${cid}.mip) y sube ese archivo .mip.`,
    ``,
    `3) GUÍA DE CAPTURAS PARA TRADING PAINTS / MUNTRU.ME`,
    `---------------------------------------------------`,
    ...shots.flatMap((s) => [
      `[${s.title}] -> ${s.filename}`,
      `  Circuito: ${s.circuit}`,
      `  Luz/Clima: ${s.timeAndWeather}`,
      `  Cámara: ${s.cameraSetup}`,
      ...s.checklist.map((c) => `  - ${c}`),
      ``,
    ]),
  ];
  return lines.join("\r\n");
}

export async function exportIracingZipBundle(
  car: CarProfile,
  state: SkinDesignState,
  shots: PhotoGuideShot[],
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const { diffuseTga, customNumTga, specTga } = await renderTgaBuffers(state, onProgress, partsOverlayCanvas, psdPatternCanvas);

  onProgress?.("Empaquetando archivo .ZIP listo para iRacing...");
  const zip = new JSZip();
  const folderPath = `paint/${car.iracingFolder}`;
  zip.file(`${folderPath}/car_${cid}.tga`, diffuseTga);
  if (customNumTga) {
    zip.file(`${folderPath}/car_num_${cid}.tga`, customNumTga);
  }
  zip.file(`${folderPath}/car_spec_${cid}.tga`, specTga);
  zip.file("design-preset.json", JSON.stringify(state, null, 2));
  zip.file("LEEME-TRADING-PAINTS.txt", buildReadmeTxt(car, state, shots));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const modeTag = customNumTga ? "CustomNum" : "SimStamped";
  const zipName = `MMT_${car.iracingFolder}_${cid}_${modeTag}_${state.resolution}px.zip`;
  triggerDownload(blob, zipName);
  return zipName;
}

export async function exportDirectToIracingFolder(
  paintRootHandle: any,
  car: CarProfile,
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string[]> {
  const cid = sanitizeCustomerId(state.customerId);
  const { diffuseTga, customNumTga, specTga } = await renderTgaBuffers(state, onProgress, partsOverlayCanvas, psdPatternCanvas);

  const folderName = (car.iracingFolder || state.carId || "generic").toLowerCase();
  const targetDir =
    paintRootHandle.name?.toLowerCase() === folderName
      ? paintRootHandle
      : await paintRootHandle.getDirectoryHandle(folderName, { create: true });

  const writeFile = async (filename: string, data: Uint8Array) => {
    const fh = await targetDir.getFileHandle(filename, { create: true });
    const writable = await fh.createWritable();
    await writable.write(data.buffer as ArrayBuffer);
    await writable.close();
  };

  const written: string[] = [];
  onProgress?.(`Escribiendo directamente en paint\\${folderName}\\...`);
  await writeFile(`car_${cid}.tga`, diffuseTga);
  written.push(`car_${cid}.tga`);
  if (customNumTga) {
    await writeFile(`car_num_${cid}.tga`, customNumTga);
    written.push(`car_num_${cid}.tga`);
  }
  await writeFile(`car_spec_${cid}.tga`, specTga);
  written.push(`car_spec_${cid}.tga`);

  return written;
}

export function exportPresetJson(state: SkinDesignState): string {
  const filename = `mmt-skin-${state.carId}-${sanitizeCustomerId(state.customerId)}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
  return filename;
}
