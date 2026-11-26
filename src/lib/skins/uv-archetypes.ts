import type { ZoneKey, ZoneRect } from "./types";
import { getLocalUvMap } from "./uv-maps-loader";
import { mapWorkerUvToZones } from "./vault-client";

export type UvArchetype = "gt3_gt4" | "prototype_gtp" | "open_wheel" | "stock_nascar" | "tcr_touring";

export interface LazyUvResult {
  zones: Record<ZoneKey, ZoneRect>;
  archetype: UvArchetype;
  source: "local-calibration" | "lazy-json" | "archetype-base";
  wireframeUrl: string | null;
}

const CALIBRATION_STORAGE_KEY = "mmt_skins_uv_calibrations_v1";
const lazyUvCache = new Map<string, LazyUvResult>();

function buildZones(coords: Record<ZoneKey, { x: number; y: number; w: number; h: number }>): Record<ZoneKey, ZoneRect> {
  return {
    hood: { key: "hood", label: "Capó", ...coords.hood },
    roof: { key: "roof", label: "Techo", ...coords.roof },
    leftSide: { key: "leftSide", label: "Lateral Izq.", ...coords.leftSide },
    rightSide: { key: "rightSide", label: "Lateral Der.", ...coords.rightSide },
    rearWing: { key: "rearWing", label: "Alerón Trasero", ...coords.rearWing },
    mirrors: { key: "mirrors", label: "Retrovisores", ...coords.mirrors },
    frontBumper: { key: "frontBumper", label: "Parachoques Del.", ...coords.frontBumper },
    rearBumper: { key: "rearBumper", label: "Parachoques Tras.", ...coords.rearBumper },
    numberPlateLeft: { key: "numberPlateLeft", label: "Placa Dorsal Izq. (iRacing)", ...coords.numberPlateLeft, restricted: true },
    numberPlateRight: { key: "numberPlateRight", label: "Placa Dorsal Der. (iRacing)", ...coords.numberPlateRight, restricted: true },
  };
}

const ARCHETYPE_ZONES: Record<UvArchetype, Record<ZoneKey, ZoneRect>> = {
  gt3_gt4: buildZones({
    hood: { x: 0.30, y: 0.06, w: 0.40, h: 0.24 },
    roof: { x: 0.34, y: 0.33, w: 0.32, h: 0.22 },
    leftSide: { x: 0.03, y: 0.32, w: 0.27, h: 0.44 },
    rightSide: { x: 0.70, y: 0.32, w: 0.27, h: 0.44 },
    rearWing: { x: 0.28, y: 0.80, w: 0.44, h: 0.12 },
    mirrors: { x: 0.05, y: 0.08, w: 0.18, h: 0.10 },
    frontBumper: { x: 0.26, y: 0.58, w: 0.48, h: 0.11 },
    rearBumper: { x: 0.26, y: 0.70, w: 0.48, h: 0.09 },
    numberPlateLeft: { x: 0.10, y: 0.47, w: 0.12, h: 0.12 },
    numberPlateRight: { x: 0.78, y: 0.47, w: 0.12, h: 0.12 },
  }),
  prototype_gtp: buildZones({
    hood: { x: 0.32, y: 0.05, w: 0.36, h: 0.25 },
    roof: { x: 0.38, y: 0.32, w: 0.24, h: 0.24 },
    leftSide: { x: 0.04, y: 0.24, w: 0.26, h: 0.54 },
    rightSide: { x: 0.70, y: 0.24, w: 0.26, h: 0.54 },
    rearWing: { x: 0.20, y: 0.76, w: 0.60, h: 0.09 },
    mirrors: { x: 0.06, y: 0.08, w: 0.14, h: 0.08 },
    frontBumper: { x: 0.28, y: 0.01, w: 0.44, h: 0.06 },
    rearBumper: { x: 0.30, y: 0.86, w: 0.40, h: 0.08 },
    numberPlateLeft: { x: 0.12, y: 0.44, w: 0.11, h: 0.11 },
    numberPlateRight: { x: 0.77, y: 0.44, w: 0.11, h: 0.11 },
  }),
  open_wheel: buildZones({
    hood: { x: 0.39, y: 0.06, w: 0.22, h: 0.34 },
    roof: { x: 0.42, y: 0.42, w: 0.16, h: 0.20 },
    leftSide: { x: 0.08, y: 0.36, w: 0.26, h: 0.42 },
    rightSide: { x: 0.66, y: 0.36, w: 0.26, h: 0.42 },
    rearWing: { x: 0.24, y: 0.76, w: 0.52, h: 0.11 },
    mirrors: { x: 0.06, y: 0.14, w: 0.12, h: 0.07 },
    frontBumper: { x: 0.22, y: 0.01, w: 0.56, h: 0.06 },
    rearBumper: { x: 0.34, y: 0.88, w: 0.32, h: 0.07 },
    numberPlateLeft: { x: 0.14, y: 0.50, w: 0.12, h: 0.10 },
    numberPlateRight: { x: 0.74, y: 0.50, w: 0.12, h: 0.10 },
  }),
  stock_nascar: buildZones({
    hood: { x: 0.27, y: 0.05, w: 0.46, h: 0.27 },
    roof: { x: 0.32, y: 0.34, w: 0.36, h: 0.23 },
    leftSide: { x: 0.02, y: 0.28, w: 0.28, h: 0.50 },
    rightSide: { x: 0.70, y: 0.28, w: 0.28, h: 0.50 },
    rearWing: { x: 0.26, y: 0.84, w: 0.48, h: 0.08 },
    mirrors: { x: 0.04, y: 0.06, w: 0.14, h: 0.08 },
    frontBumper: { x: 0.24, y: 0.60, w: 0.52, h: 0.10 },
    rearBumper: { x: 0.24, y: 0.72, w: 0.52, h: 0.10 },
    numberPlateLeft: { x: 0.08, y: 0.44, w: 0.16, h: 0.16 },
    numberPlateRight: { x: 0.76, y: 0.44, w: 0.16, h: 0.16 },
  }),
  tcr_touring: buildZones({
    hood: { x: 0.31, y: 0.06, w: 0.38, h: 0.23 },
    roof: { x: 0.34, y: 0.32, w: 0.32, h: 0.24 },
    leftSide: { x: 0.03, y: 0.30, w: 0.27, h: 0.46 },
    rightSide: { x: 0.70, y: 0.30, w: 0.27, h: 0.46 },
    rearWing: { x: 0.30, y: 0.83, w: 0.40, h: 0.09 },
    mirrors: { x: 0.05, y: 0.08, w: 0.16, h: 0.09 },
    frontBumper: { x: 0.26, y: 0.58, w: 0.48, h: 0.11 },
    rearBumper: { x: 0.26, y: 0.71, w: 0.48, h: 0.10 },
    numberPlateLeft: { x: 0.10, y: 0.46, w: 0.12, h: 0.12 },
    numberPlateRight: { x: 0.78, y: 0.46, w: 0.12, h: 0.12 },
  }),
};

export function resolveArchetypeFromCategory(category?: string, carSlug = ""): UvArchetype {
  const s = `${category || ""} ${carSlug}`.toLowerCase();
  if (/gtp|lmp|proto|hypercar|499p|963|arx06|vseries|p217|jsp320/.test(s)) return "prototype_gtp";
  if (/fórmula|formula|open|indy|sf23|sfl|ir18|f4|f3|ff1600|vee/.test(s)) return "open_wheel";
  if (/nascar|oval|stock|xfinity|truck|arca|dirt|sprintcar|midget|latemodel/.test(s)) return "stock_nascar";
  if (/tcr|touring|producción|produccion|mx5|gr86|clio|civic|elantra|rs3/.test(s)) return "tcr_touring";
  return "gt3_gt4";
}

export function getArchetypeZones(category?: string, carSlug = ""): Record<ZoneKey, ZoneRect> {
  const arch = resolveArchetypeFromCategory(category, carSlug);
  const src = ARCHETYPE_ZONES[arch];
  const out = {} as Record<ZoneKey, ZoneRect>;
  for (const k of Object.keys(src) as ZoneKey[]) {
    out[k] = { ...src[k] };
  }
  return out;
}

export function loadSavedCalibration(carSlug: string): Record<ZoneKey, ZoneRect> | null {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, Record<ZoneKey, ZoneRect>>;
    return all[carSlug] || null;
  } catch {
    return null;
  }
}

export function saveLocalCalibration(carSlug: string, zones: Record<ZoneKey, ZoneRect>): void {
  try {
    const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Record<ZoneKey, ZoneRect>>) : {};
    all[carSlug] = zones;
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(all));
    lazyUvCache.delete(carSlug);
  } catch {}
}

/**
 * Resolves a car's UV map with zero broken HTTP fetches.
 * Priority: 1) User localStorage calibration -> 2) Bundled src/data/uv-maps/<slug>.json -> 3) Category archetype base.
 */
export async function lazyLoadCarUv(carSlug: string, category?: string): Promise<LazyUvResult> {
  const archetype = resolveArchetypeFromCategory(category, carSlug);
  const localSaved = loadSavedCalibration(carSlug);
  if (localSaved) {
    return { zones: localSaved, archetype, source: "local-calibration", wireframeUrl: null };
  }

  const cached = lazyUvCache.get(carSlug);
  if (cached) return cached;

  const baseZones = getArchetypeZones(category, carSlug);
  const bundled = getLocalUvMap(carSlug);
  if (bundled) {
    const zones = mapWorkerUvToZones(bundled, baseZones);
    const result: LazyUvResult = {
      zones,
      archetype,
      source: "lazy-json",
      wireframeUrl: null,
    };
    lazyUvCache.set(carSlug, result);
    return result;
  }

  const fallbackResult: LazyUvResult = {
    zones: baseZones,
    archetype,
    source: "archetype-base",
    wireframeUrl: null,
  };
  lazyUvCache.set(carSlug, fallbackResult);
  return fallbackResult;
}
