/**
 * MMT Sync — Car Brand SVG Helper
 * Resolves carPath to official manufacturer SVG icon or clean badge.
 */

import { OFFICIAL_BRAND_PATHS } from "../cars/brand-icons";

export function getCarBrandSvg(carPath: string, size: number = 14): string {
  const clean = (carPath || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  let iconKey: string | null = null;
  if (clean.includes("ferrari")) iconKey = "logo-ferrari";
  else if (clean.includes("porsche") || clean.includes("992") || clean.includes("963")) iconKey = "logo-porsche";
  else if (clean.includes("bmw") || clean.includes("m4") || clean.includes("m8")) iconKey = "logo-bmw";
  else if (clean.includes("mercedes") || clean.includes("amg")) iconKey = "logo-mercedes";
  else if (clean.includes("cadillac") || clean.includes("vseries")) iconKey = "logo-cadillac";
  else if (clean.includes("mclaren") || clean.includes("720s")) iconKey = "logo-mclaren";
  else if (clean.includes("lamborghini") || clean.includes("lambo") || clean.includes("huracan")) iconKey = "logo-lambo";
  else if (clean.includes("dallara") || clean.includes("p217") || clean.includes("f3") || clean.includes("ir18")) iconKey = "logo-dallara";
  else if (clean.includes("ligier") || clean.includes("jsp320")) iconKey = "logo-ligier";
  else if (clean.includes("mazda") || clean.includes("mx5")) iconKey = "logo-mazda";
  else if (clean.includes("honda") || clean.includes("civic")) iconKey = "logo-honda";
  else if (clean.includes("lotus")) iconKey = "logo-lotus";
  else if (clean.includes("radical")) iconKey = "logo-radical";
  else if (clean.includes("caterham")) iconKey = "logo-caterham";
  else if (clean.includes("formula") || clean.includes("vee") || clean.includes("ray")) iconKey = "logo-formula";

  if (iconKey && OFFICIAL_BRAND_PATHS[iconKey]) {
    const path = OFFICIAL_BRAND_PATHS[iconKey];
    return `<svg class="inline-block shrink-0 fill-current opacity-90" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;
  }

  // Fallback text badge
  const shortName = carPath.slice(0, 4).toUpperCase();
  return `<span class="px-1 py-0.2 rounded text-[8px] font-bold bg-white/10 text-white/80">${shortName}</span>`;
}
