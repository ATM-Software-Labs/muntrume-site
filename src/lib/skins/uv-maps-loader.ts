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
  const baseName = filePath.split("/").pop()?.replace(/\.json$/i, "").toLowerCase();
  if (baseName && !UV_MAPS_BY_SLUG.has(baseName)) {
    UV_MAPS_BY_SLUG.set(baseName, data);
  }
}

export function getLocalUvMap(carSlug: string): WorkerUvResponse | null {
  return UV_MAPS_BY_SLUG.get((carSlug || "").toLowerCase()) ?? null;
}

export function getLocalUvMapCount(): number {
  return UV_MAPS_BY_SLUG.size;
}
