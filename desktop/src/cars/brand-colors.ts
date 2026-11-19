/**
 * Colores de marca para el HUD y /overlay/brands/.
 * "brand": hex habitualmente publicado para esa marca.
 * "neutral": no hay un único color oficial verificable; plata neutra, sin acento inventado.
 */
export const NEUTRAL_BRAND_HEX = "#C0C0C0";

export interface BrandColor {
  readonly hex: string;
  readonly kind: "brand" | "neutral";
}

export const BRAND_COLORS: Record<string, BrandColor> = {
  "logo-ford": { hex: "#003478", kind: "brand" },
  "logo-ferrari": { hex: "#FF2800", kind: "brand" },
  "logo-bmw": { hex: "#0066B1", kind: "brand" },
  "logo-mercedes": { hex: "#A4A9AD", kind: "neutral" },
  "logo-audi": { hex: "#C0C0C0", kind: "neutral" },
  "logo-lambo": { hex: "#C6A664", kind: "brand" },
  "logo-mclaren": { hex: "#FF8000", kind: "brand" },
  "logo-aston": { hex: "#00594F", kind: "brand" },
  "logo-porsche": { hex: "#C0C0C0", kind: "neutral" },
  "logo-chevy": { hex: "#C5A017", kind: "brand" },
  "logo-cadillac": { hex: "#C0C0C0", kind: "neutral" },
  "logo-acura": { hex: "#C0C0C0", kind: "neutral" },
  "logo-toyota": { hex: "#EB0A1E", kind: "brand" },
  "logo-mazda": { hex: "#910A2A", kind: "brand" },
  "logo-honda": { hex: "#E40521", kind: "brand" },
  "logo-hyundai": { hex: "#002C5F", kind: "brand" },
  "logo-renault": { hex: "#FFCC00", kind: "brand" },
  "logo-nissan": { hex: "#C3002F", kind: "brand" },
  "logo-vw": { hex: "#001E50", kind: "brand" },
  "logo-lotus": { hex: "#004225", kind: "brand" },
  "logo-dallara": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-ligier": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-radical": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-caterham": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-holden": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-buick": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-pontiac": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-tatuus": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-neutral": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
};

export function colorForLogo(logoId: string): BrandColor {
  return BRAND_COLORS[logoId] ?? { hex: NEUTRAL_BRAND_HEX, kind: "neutral" };
}
