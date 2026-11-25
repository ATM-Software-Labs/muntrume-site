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

async function renderTgaBuffers(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
): Promise<{ diffuseTga: Uint8Array; specTga: Uint8Array; size: number }> {
  const size = state.resolution;
  onProgress?.(`Renderizando textura base ${size}×${size}px...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  await renderSkinToCanvas(workCanvas, state, { size, forExport: true });

  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo de exportación.");
  const diffuseData = ctx.getImageData(0, 0, size, size);

  onProgress?.(`Codificando car_${sanitizeCustomerId(state.customerId)}.tga (24-bit sin compresión)...`);
  const diffuseTga = encodeTgaFromImageData(diffuseData, false);

  onProgress?.(`Generando car_spec_${sanitizeCustomerId(state.customerId)}.tga...`);
  renderSpecMapToCanvas(workCanvas, state, size);
  const specData = ctx.getImageData(0, 0, size, size);
  const specTga = encodeTgaFromImageData(specData, false);

  // Release large 4K backing buffer immediately
  workCanvas.width = 1;
  workCanvas.height = 1;

  return { diffuseTga, specTga, size };
}

export async function exportSingleDiffuseTga(
  state: SkinDesignState,
  onProgress?: (msg: string) => void,
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const size = state.resolution;
  onProgress?.(`Renderizando car_${cid}.tga (${size}×${size}px)...`);

  const workCanvas = document.createElement("canvas");
  workCanvas.width = size;
  workCanvas.height = size;
  await renderSkinToCanvas(workCanvas, state, { size, forExport: true });
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo leer el lienzo.");
  const tga = encodeTgaFromImageData(ctx.getImageData(0, 0, size, size), false);
  workCanvas.width = 1;
  workCanvas.height = 1;

  const filename = `car_${cid}.tga`;
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

  const filename = `car_spec_${cid}.tga`;
  triggerDownload(new Blob([tga.buffer as ArrayBuffer], { type: "image/x-tga" }), filename);
  return filename;
}

function buildReadmeTxt(car: CarProfile, state: SkinDesignState, shots: PhotoGuideShot[]): string {
  const cid = sanitizeCustomerId(state.customerId);
  const lines = [
    `MUNTRUME MOTORSPORT — PAQUETE DE SKIN iRACING (skins.muntru.me)`,
    `================================================================`,
    `Diseño:       ${state.name}`,
    `Coche:        ${car.name} (carpeta: ${car.iracingFolder})`,
    `Piloto:       ${state.customDriverName} #${state.customNumber}`,
    `Customer ID:  ${cid}`,
    `Resolución:   ${state.resolution}x${state.resolution} px (TGA 24-bit sin compresión RLE)`,
    `Acabado Spec: ${state.spec.finish} (Metallic ${state.spec.metallic}% / Roughness ${state.spec.roughness}% / Clearcoat ${state.spec.clearcoat}%)`,
    ``,
    `1) INSTALACIÓN LOCAL EN iRACING`,
    `--------------------------------`,
    `Copia los archivos TGA dentro de:`,
    `  Documents\\iRacing\\paint\\${car.iracingFolder}\\`,
    `  - car_${cid}.tga`,
    `  - car_spec_${cid}.tga`,
    `Pulsa Ctrl+R dentro del simulador para recargar la pintura al instante.`,
    ``,
    `2) SUBIDA A TRADING PAINTS (PASOS MANUALES)`,
    `-------------------------------------------`,
    `Trading Paints no ofrece API pública de subida automática.`,
    `  a) Entra en https://www.tradingpaints.com/ y abre "My Paints" -> ${car.name}`,
    `  b) Sube car_${cid}.tga como archivo principal (Paint File).`,
    `  c) Sube car_spec_${cid}.tga como Spec Map (opcional pero recomendado).`,
    `  d) Añade las capturas recomendadas abajo en la galería de Showroom.`,
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
): Promise<string> {
  const cid = sanitizeCustomerId(state.customerId);
  const { diffuseTga, specTga } = await renderTgaBuffers(state, onProgress);

  onProgress?.("Empaquetando archivo .ZIP listo para iRacing...");
  const zip = new JSZip();
  const folderPath = `paint/${car.iracingFolder}`;
  zip.file(`${folderPath}/car_${cid}.tga`, diffuseTga);
  zip.file(`${folderPath}/car_spec_${cid}.tga`, specTga);
  zip.file("design-preset.json", JSON.stringify(state, null, 2));
  zip.file("LEEME-TRADING-PAINTS.txt", buildReadmeTxt(car, state, shots));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const zipName = `MMT_${car.iracingFolder}_${cid}_${state.resolution}px.zip`;
  triggerDownload(blob, zipName);
  return zipName;
}

export function exportPresetJson(state: SkinDesignState): string {
  const filename = `mmt-skin-${state.carId}-${sanitizeCustomerId(state.customerId)}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
  return filename;
}
