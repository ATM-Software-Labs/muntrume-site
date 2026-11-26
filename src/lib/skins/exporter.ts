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

async function renderTgaBuffers(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<{ diffuseTga: Uint8Array; customNumTga: Uint8Array | null; specTga: Uint8Array; size: number }> {
  const size = state.resolution;
  const cid = sanitizeCustomerId(state.customerId);
  const isCustomNumber = (state.numberMode || "sim-stamped") === "custom-number";
  onProgress?.(`Renderizando textura base ${size}×${size}px...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  // Base car_<id>.tga is ALWAYS rendered clean (sim-stamped) so iRacing never overlaps numbers
  await renderSkinToCanvas(workCanvas, state, {
    size,
    partsOverlayCanvas,
    psdPatternCanvas,
    forExport: true,
    numberModeOverride: "sim-stamped",
  });

  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo de exportación.");
  const diffuseData = ctx.getImageData(0, 0, size, size);
  for (let i = 3; i < diffuseData.data.length; i += 4) diffuseData.data[i] = 255;

  onProgress?.(`Codificando car_${cid}.tga (base limpia 24-bit)...`);
  const diffuseTga = encodeTgaFromImageData(diffuseData, false);

  let customNumTga: Uint8Array | null = null;
  if (isCustomNumber) {
    onProgress?.(`Renderizando dorsal fijo car_num_${cid}.tga...`);
    await renderSkinToCanvas(workCanvas, state, {
      size,
      partsOverlayCanvas,
      psdPatternCanvas,
      forExport: true,
      numberModeOverride: "custom-number",
    });
    const numData = ctx.getImageData(0, 0, size, size);
    for (let i = 3; i < numData.data.length; i += 4) numData.data[i] = 255;
    customNumTga = encodeTgaFromImageData(numData, false);
  }

  onProgress?.(`Generando car_spec_${cid}.tga...`);
  renderSpecMapToCanvas(workCanvas, state, size);
  const specData = ctx.getImageData(0, 0, size, size);
  const specTga = encodeTgaFromImageData(specData, false);

  // Release large 4K backing buffer immediately
  workCanvas.width = 1;
  workCanvas.height = 1;

  return { diffuseTga, customNumTga, specTga, size };
}

export async function exportSingleDiffuseTga(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
  partsOverlayCanvas?: HTMLCanvasElement | null,
  psdPatternCanvas?: HTMLCanvasElement | null,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const size = state.resolution;
  onProgress?.(`Renderizando car_${cid}.tga (${size}×${size}px)...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  await renderSkinToCanvas(workCanvas, state, {
    size,
    partsOverlayCanvas,
    psdPatternCanvas,
    forExport: true,
    numberModeOverride: "sim-stamped",
  });
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo.");
  const diffuseData = ctx.getImageData(0, 0, size, size);
  for (let i = 3; i < diffuseData.data.length; i += 4) diffuseData.data[i] = 255;
  const tga = encodeTgaFromImageData(diffuseData, false);
  workCanvas.width = 1;
  workCanvas.height = 1;

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
  const size = state.resolution;
  onProgress?.(`Renderizando dorsal fijo car_num_${cid}.tga (${size}×${size}px)...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  await renderSkinToCanvas(workCanvas, state, {
    size,
    partsOverlayCanvas,
    psdPatternCanvas,
    forExport: true,
    numberModeOverride: "custom-number",
  });
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo.");
  const numData = ctx.getImageData(0, 0, size, size);
  for (let i = 3; i < numData.data.length; i += 4) numData.data[i] = 255;
  const tga = encodeTgaFromImageData(numData, false);
  workCanvas.width = 1;
  workCanvas.height = 1;

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
  const size = state.resolution;
  onProgress?.(`Generando car_spec_${cid}.tga (${size}×${size}px)...`);

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
