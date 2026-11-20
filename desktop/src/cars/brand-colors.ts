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
  "logo-dallara": { hex: "#FDC300", kind: "brand" },
  "logo-ligier": { hex: "#132451", kind: "brand" },
  "logo-radical": { hex: "#F5C400", kind: "brand" },
  "logo-caterham": { hex: "#FFFFFF", kind: "brand" },
  "logo-holden": { hex: "#C0C0C0", kind: "brand" },
  "logo-buick": { hex: "#C0C0C0", kind: "neutral" },
  "logo-pontiac": { hex: "#E31C23", kind: "brand" },
  "logo-tatuus": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-neutral": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-kia": { hex: "#FFFFFF", kind: "brand" },
  "logo-subaru": { hex: "#013C74", kind: "brand" },
  "logo-williams": { hex: "#FFFFFF", kind: "brand" },
  "logo-ruf": { hex: "#185533", kind: "brand" },
  "logo-riley": { hex: "#FFFFFF", kind: "brand" },
  "logo-ram": { hex: "#FFFFFF", kind: "brand" },
  "logo-skip": { hex: "#EC2028", kind: "brand" },
};

export function colorForLogo(logoId: string): BrandColor {
  return BRAND_COLORS[logoId] ?? { hex: NEUTRAL_BRAND_HEX, kind: "neutral" };
}
