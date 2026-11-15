/**
 * MMT Sync — Car Brand SVG Helper
 * Resolves carPath to official manufacturer SVG icon matching muntru.me.
 */

import { getCarBrandInfo } from "../brand-logos";

const brandSvgCache = new Map<string, string>();

export function getCarBrandSvg(carPath: string, size: number = 12): string {
  const cacheKey = `${carPath || ""}|${size}`;
  const cached = brandSvgCache.get(cacheKey);
  if (cached) return cached;

  const brand = getCarBrandInfo(carPath || "");
  const sizedSvg = brand.svg.replace(
    /<svg\b([^>]*)>/i,
    (_m, attrs: string) => {
      const cleanAttrs = attrs.replace(/\s*(width|height|style|class)="[^"]*"/gi, "");
      return `<svg${cleanAttrs} class="mmt-brand-svg" width="${size}" height="${size}" style="width:${size}px;height:${size}px;max-width:${size}px;max-height:${size}px;display:block;flex-shrink:0;color:${brand.color}">`;
    },
  );
  const html = `<span class="mmt-brand-svg inline-flex items-center justify-center shrink-0 overflow-hidden" style="width:${size}px;height:${size}px;min-width:${size}px;min-height:${size}px;max-width:${size}px;max-height:${size}px;color:${brand.color}" title="${brand.name}">${sizedSvg}</span>`;
  if (brandSvgCache.size > 256) brandSvgCache.clear();
  brandSvgCache.set(cacheKey, html);
  return html;
}
