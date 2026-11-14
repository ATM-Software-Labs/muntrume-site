/**
 * Muntrume Motorsport — Galería & Mapeador CarPath iRacing (Bloque 28)
 *
 * 1. Saneamiento estricto: relación 1:1 entre imágenes y DriverInfo.Drivers[CamCarIdx].CarPath
 * 2. Autoclasificación en tiempo real de capturas MMT Sync
 * 3. Validador de subida de archivos con detector de discordancias de marca
 */

export interface TelemetryDriver {
  CarIdx?: number;
  UserName?: string;
  CarNumber?: string;
  CarPath?: string;
  CarClassShortName?: string;
  CarScreenName?: string;
  IsSpectator?: number;
}

export interface TelemetryState {
  CamCarIdx?: number;
  PlayerCarIdx?: number;
  DriverCarPath?: string;
  DriverInfo?: {
    DriverCarIdx?: number;
    Drivers?: TelemetryDriver[];
  };
}

export interface ClassifiedCapture {
  filename: string;
  carPath: string;
  carScreenName: string;
  timestamp: number;
  camCarIdx: number;
  metadata: {
    origin: "mmt_sync_autotag";
    iracingCarPath: string;
    verified: boolean;
  };
}

export interface UploadValidationResult {
  isValid: boolean;
  detectedBrand?: string;
  targetBrand?: string;
  warning?: string;
}

const BRAND_PATTERNS: Record<string, RegExp> = {
  ferrari: /(ferrari|296|488|499p|f296)/i,
  porsche: /(porsche|911|992|718|cayman|963)/i,
  bmw: /(bmw|m4|m2|m8|lmdh)/i,
  mercedes: /(mercedes|amg)/i,
  mclaren: /(mclaren|720s|570s|macla)/i,
  chevrolet: /(corvette|chevy|z06|c8r|c6r|camaro)/i,
  astonmartin: /(aston|vantage|valkyrie|dbr9)/i,
  lamborghini: /(lamborghini|lambo|huracan|hurac[aá]n)/i,
  audi: /(audi|r8|rs3)/i,
  ford: /(ford|mustang)/i,
  toyota: /(toyota|gr86|supra|sf23)/i,
  honda: /(honda|civic|nsx|acura)/i,
};

/**
 * 1. Resuelve el CarPath exacto desde el SDK de iRacing
 * leyendo DriverInfo.Drivers[CamCarIdx].CarPath de la memoria.
 */
export function resolveCarPathFromTelemetry(telemetry?: TelemetryState | null): string {
  if (!telemetry) return "unknown";
  const activeIdx = Number.isInteger(telemetry.CamCarIdx)
    ? (telemetry.CamCarIdx as number)
    : Number.isInteger(telemetry.PlayerCarIdx)
    ? (telemetry.PlayerCarIdx as number)
    : Number.isInteger(telemetry.DriverInfo?.DriverCarIdx)
    ? (telemetry.DriverInfo?.DriverCarIdx as number)
    : 0;

  const drivers = telemetry.DriverInfo?.Drivers;
  if (Array.isArray(drivers) && drivers[activeIdx]) {
    const raw = drivers[activeIdx].CarPath || "";
    if (raw) return sanitizeCarPath(raw);
  }

  if (telemetry.DriverCarPath) {
    return sanitizeCarPath(telemetry.DriverCarPath);
  }

  return "unknown";
}

/**
 * 2. Autoclasificación con iRacing al Guardar Capturas
 * Guarda la captura con su ID de coche real en el nombre y metadatos.
 */
export function classifyCaptureScreenshot(params: {
  telemetry?: TelemetryState | null;
  rawFilename?: string;
  timestamp?: number;
}): ClassifiedCapture {
  const ts = params.timestamp || Date.now();
  const carPath = resolveCarPathFromTelemetry(params.telemetry);
  const activeIdx = params.telemetry?.CamCarIdx ?? params.telemetry?.PlayerCarIdx ?? 0;
  const drivers = params.telemetry?.DriverInfo?.Drivers;
  const carScreenName = (Array.isArray(drivers) && drivers[activeIdx]?.CarScreenName) || carPath;

  const cleanCar = carPath.replace(/[^a-z0-9_-]/g, "");
  const filename = `mmt_capture_${cleanCar}_${ts}.png`;

  return {
    filename,
    carPath: cleanCar,
    carScreenName,
    timestamp: ts,
    camCarIdx: activeIdx,
    metadata: {
      origin: "mmt_sync_autotag",
      iracingCarPath: carPath,
      verified: carPath !== "unknown",
    },
  };
}

/**
 * 3. Validador de Subida de Archivos con Detección de Discordancia
 * Si el usuario arrastra un archivo que menciona "Ferrari" hacia un Porsche, lanza aviso.
 */
export function validateUploadFilename(
  filename: string,
  targetCarPath: string
): UploadValidationResult {
  const normFile = String(filename || "").toLowerCase();
  const normTarget = sanitizeCarPath(targetCarPath);

  if (!normTarget || normTarget === "unknown") {
    return {
      isValid: false,
      warning: "Debes seleccionar un coche de destino obligatorio antes de subir la imagen.",
    };
  }

  // Identificar marca de destino
  let targetBrand = "";
  for (const [brand, pattern] of Object.entries(BRAND_PATTERNS)) {
    if (pattern.test(normTarget)) {
      targetBrand = brand;
      break;
    }
  }

  // Identificar marcas sospechosas en el nombre del archivo
  let detectedBrand = "";
  for (const [brand, pattern] of Object.entries(BRAND_PATTERNS)) {
    if (pattern.test(normFile)) {
      detectedBrand = brand;
      break;
    }
  }

  // Si se detecta una marca en el archivo y no coincide con la del coche objetivo
  if (detectedBrand && targetBrand && detectedBrand !== targetBrand) {
    const brandLabel = detectedBrand.toUpperCase();
    const targetLabel = targetBrand.toUpperCase();
    return {
      isValid: false,
      detectedBrand: brandLabel,
      targetBrand: targetLabel,
      warning: `Aviso de Discordancia: El archivo '${filename}' parece ser de ${brandLabel}, pero estás intentando asociarlo a un ${targetLabel} (${normTarget}).`,
    };
  }

  return { isValid: true, targetBrand: targetBrand.toUpperCase() };
}

/**
 * 4. Saneamiento estricto de la base de datos / catálogo
 * Excluye cualquier imagen sin carPath o con discordancia.
 */
export function filterPhotosByStrictCarPath<T extends { carPath?: string }>(
  photos: readonly T[],
  expectedCarPath: string
): T[] {
  const target = sanitizeCarPath(expectedCarPath);
  if (!target || target === "unknown") return [];
  return photos.filter((p) => {
    if (!p || !p.carPath) return false;
    return sanitizeCarPath(p.carPath) === target;
  });
}

function sanitizeCarPath(path: string): string {
  return String(path || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "");
}
