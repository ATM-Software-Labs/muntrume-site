/**
 * MMT Sync — Car Brand SVG Helper
 * Resolves carPath to official manufacturer SVG icon matching muntru.me.
 */

import { getCarBrandInfo } from "../brand-logos";

export function getCarBrandSvg(carPath: string, size: number = 14): string {
  const brand = getCarBrandInfo(carPath || "");
  const sizedSvg = brand.svg.replace(
    /<svg\b([^>]*)>/i,
    (_m, attrs: string) => {
      const cleanAttrs = attrs.replace(/\s*(width|height|style|class)="[^"]*"/gi, "");
      return `<svg${cleanAttrs} width="${size}" height="${size}" style="width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;display:block;flex-shrink:0;color:${brand.color}">`;
    },
  );
  return `<span class="inline-flex items-center justify-center shrink-0 overflow-hidden" style="width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;color:${brand.color}" title="${brand.name}">${sizedSvg}</span>`;
}
