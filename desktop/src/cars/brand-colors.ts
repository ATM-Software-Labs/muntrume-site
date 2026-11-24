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
  "logo-ford": { hex: "#2563EB", kind: "brand" },
  "logo-ferrari": { hex: "#FF2800", kind: "brand" },
  "logo-bmw": { hex: "#0066B1", kind: "brand" },
  "logo-mercedes": { hex: "#A4A9AD", kind: "neutral" },
  "logo-audi": { hex: "#C0C0C0", kind: "neutral" },
  "logo-lambo": { hex: "#C6A664", kind: "brand" },
  "logo-mclaren": { hex: "#FF8000", kind: "brand" },
  "logo-aston": { hex: "#00A88F", kind: "brand" },
  "logo-porsche": { hex: "#D4AF37", kind: "brand" },
  "logo-chevy": { hex: "#C5A017", kind: "brand" },
  "logo-cadillac": { hex: "#C0C0C0", kind: "neutral" },
  "logo-acura": { hex: "#C0C0C0", kind: "neutral" },
  "logo-toyota": { hex: "#EB0A1E", kind: "brand" },
  "logo-mazda": { hex: "#D11842", kind: "brand" },
  "logo-honda": { hex: "#E40521", kind: "brand" },
  "logo-hyundai": { hex: "#3898FF", kind: "brand" },
  "logo-renault": { hex: "#FFCC00", kind: "brand" },
  "logo-nissan": { hex: "#E11D48", kind: "brand" },
  "logo-vw": { hex: "#2563EB", kind: "brand" },
  "logo-lotus": { hex: "#007A4D", kind: "brand" },
  "logo-dallara": { hex: "#FDC300", kind: "brand" },
  "logo-ligier": { hex: "#3B82F6", kind: "brand" },
  "logo-radical": { hex: "#F5C400", kind: "brand" },
  "logo-caterham": { hex: "#00A86B", kind: "brand" },
  "logo-holden": { hex: "#E11D48", kind: "brand" },
  "logo-buick": { hex: "#C0C0C0", kind: "neutral" },
  "logo-pontiac": { hex: "#E31C23", kind: "brand" },
  "logo-tatuus": { hex: "#DC2626", kind: "brand" },
  "logo-neutral": { hex: NEUTRAL_BRAND_HEX, kind: "neutral" },
  "logo-kia": { hex: "#94A3B8", kind: "neutral" },
  "logo-subaru": { hex: "#2563EB", kind: "brand" },
  "logo-williams": { hex: "#38BDF8", kind: "brand" },
  "logo-ruf": { hex: "#16A34A", kind: "brand" },
  "logo-riley": { hex: "#64748B", kind: "neutral" },
  "logo-ram": { hex: "#94A3B8", kind: "neutral" },
  "logo-skip": { hex: "#EC2028", kind: "brand" },
  "logo-fia": { hex: "#1D4ED8", kind: "brand" },
  "logo-nascar": { hex: "#FACC15", kind: "brand" },
  "logo-dirtcar": { hex: "#F59E0B", kind: "brand" },
  "logo-usac": { hex: "#EF4444", kind: "brand" },
  "logo-woo": { hex: "#EF4444", kind: "brand" },
  "logo-lucasoil": { hex: "#1D4ED8", kind: "brand" },
  "logo-carstour": { hex: "#EF4444", kind: "brand" },
};

export function colorForLogo(logoId: string): BrandColor {
  return BRAND_COLORS[logoId] ?? { hex: NEUTRAL_BRAND_HEX, kind: "neutral" };
}
