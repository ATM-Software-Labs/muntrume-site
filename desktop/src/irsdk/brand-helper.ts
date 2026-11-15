/**
 * MMT Sync — Car Brand SVG Helper
 * Resolves carPath to official manufacturer SVG icon matching muntru.me.
 */

import { getCarBrandInfo } from "../brand-logos";

export function getCarBrandSvg(carPath: string, size: number = 14): string {
  const brand = getCarBrandInfo(carPath || "");
  return `<span class="inline-flex items-center justify-center shrink-0" style="width:${size}px;height:${size}px;color:${brand.color}" title="${brand.name}">${brand.svg}</span>`;
}
