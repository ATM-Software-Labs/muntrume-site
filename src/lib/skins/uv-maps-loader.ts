/**
 * Loads calibrated per-car iRacing UV JSON maps bundled from src/data/uv-maps/*.json.
 * Provides instant local access to real zone coordinates (hood, roof, sides, wing, bumpers,
 * mirrors, sponsor_blocks, restricted_number_plates) for both the 2D editor and 3D Auto-Fit projection.
 */

import type { WorkerUvResponse } from "./vault-client";

const rawModules = import.meta.glob("../../data/uv-maps/*.json", { eager: true }) as Record<
  string,
  { default?: WorkerUvResponse } | WorkerUvResponse
>;

const UV_MAPS_BY_SLUG = new Map<string, WorkerUvResponse>();

for (const [filePath, mod] of Object.entries(rawModules)) {
  const data = (mod && typeof mod === "object" && "default" in mod ? mod.default : mod) as WorkerUvResponse | undefined;
  if (!data || !data.car_slug) continue;
  const slug = data.car_slug.toLowerCase();
  UV_MAPS_BY_SLUG.set(slug, data);
  const folder = (data.iracing_folder || "").toLowerCase();
  if (folder && !UV_MAPS_BY_SLUG.has(folder)) {
    UV_MAPS_BY_SLUG.set(folder, data);
  }
  const baseName = filePath.split("/").pop()?.replace(/\.json$/i, "").toLowerCase();
  if (baseName && !UV_MAPS_BY_SLUG.has(baseName)) {
    UV_MAPS_BY_SLUG.set(baseName, data);
  }
}

const SLUG_ALIASES: Record<string, string> = {
  chevrolet_corvette_z06_gt3r: "chevyvettez06rgt3",
  corvette_z06_gt3r: "chevyvettez06rgt3",
  aston_martin_vantage_evo_gt3: "amvantageevogt3",
  astonmartinvantagegt3: "amvantageevogt3",
  audi_r8_lms_evo_ii_gt3: "audir8lmsevo2gt3",
  mclaren_720s_evo_gt3: "mclaren720sgt3",
  mercedes_amg_gt3_2020: "mercedesamggt3",
  mercedesamgevogt3: "mercedesamggt3",
  porsche_992r_gt3: "porsche992rgt3",
  ferrari_296_gt3: "ferrari296gt3",
  ford_mustang_gt3: "fordmustanggt3",
  lamborghini_evo_gt3: "lamborghinievogt3",
  bmw_m4_gt3: "bmwm4gt3",
};

export function getLocalUvMap(carSlug: string): WorkerUvResponse | null {
  const key = (carSlug || "").toLowerCase();
  const aliased = SLUG_ALIASES[key] || key;
  return UV_MAPS_BY_SLUG.get(key) ?? UV_MAPS_BY_SLUG.get(aliased) ?? null;
}

export function getLocalUvMapCount(): number {
  return UV_MAPS_BY_SLUG.size;
}
