import { OFFICIAL_BRAND_PATHS } from "./cars/brand-icons";
import { CAR_CATALOG_LIST } from "./cars/catalog";

export interface CarBrandInfo {
  id: string;
  name: string;
  color: string;
  bg: string;
  svg: string;
}

const normKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const CATALOG_BRAND_BY_KEY = new Map(
  CAR_CATALOG_LIST.map((c) => [
    normKey(c.carFolder),
    { logo: c.svgLogoId, name: c.brand, color: c.accentColor },
  ])
);

const BRAND_ACCENT_OVERRIDE: Record<string, string> = {
  "logo-lambo": "#EAB308",
  "logo-ferrari": "#FACC15",
  "logo-porsche": "#EF4444",
  "logo-bmw": "#3B82F6",
  "logo-mercedes": "#00D2BE",
  "logo-mclaren": "#FF8000",
  "logo-aston": "#10B981",
  "logo-audi": "#E2E8F0",
  "logo-cadillac": "#D4AF37",
  "logo-acura": "#F43F5E",
  "logo-chevy": "#EAB308",
  "logo-ford": "#3B82F6",
  "logo-toyota": "#EF4444",
  "logo-mazda": "#F43F5E",
  "logo-honda": "#EF4444",
  "logo-dallara": "#00E699",
};

const FALLBACK_BRAND_RULES: Array<[RegExp, { logo: string; name: string; color: string }]> = [
  [/mercedes|amg|merc|w12|w13/i, { logo: "logo-mercedes", name: "Mercedes-AMG", color: "#00D2BE" }],
  [/porsche|911|992|991|963|718|cayman/i, { logo: "logo-porsche", name: "Porsche", color: "#EF4444" }],
  [/ferrari|296|488|499p/i, { logo: "logo-ferrari", name: "Ferrari", color: "#FACC15" }],
  [/bmw|m4|m8|m2|hybridv8|lmdh/i, { logo: "logo-bmw", name: "BMW", color: "#3B82F6" }],
  [/audi|r8|rs3/i, { logo: "logo-audi", name: "Audi", color: "#E2E8F0" }],
  [/lamborghini|lambo|huracan|sc63/i, { logo: "logo-lambo", name: "Lamborghini", color: "#EAB308" }],
  [/mclaren|720s|570s/i, { logo: "logo-mclaren", name: "McLaren", color: "#FF8000" }],
  [/aston|amvantage|amvalkyrie|dbr9/i, { logo: "logo-aston", name: "Aston Martin", color: "#10B981" }],
  [/cadillac|vseries/i, { logo: "logo-cadillac", name: "Cadillac", color: "#D4AF37" }],
  [/acura|arx06|nsx/i, { logo: "logo-acura", name: "Acura", color: "#F43F5E" }],
  [/corvette|chevy|chevrolet|camaro|silverado|impala|montecarlo|vette|c8r|c6r|z06/i, { logo: "logo-chevy", name: "Chevrolet", color: "#EAB308" }],
  [/ford|mustang/i, { logo: "logo-ford", name: "Ford", color: "#3B82F6" }],
  [/toyota|gr86/i, { logo: "logo-toyota", name: "Toyota", color: "#EF4444" }],
  [/mazda|mx5/i, { logo: "logo-mazda", name: "Mazda", color: "#F43F5E" }],
  [/honda|civic|hpd/i, { logo: "logo-honda", name: "Honda", color: "#EF4444" }],
  [/hyundai|elantra|veloster/i, { logo: "logo-hyundai", name: "Hyundai", color: "#38BDF8" }],
  [/renault|clio/i, { logo: "logo-renault", name: "Renault", color: "#FACC15" }],
  [/dallara|superformula|sf23|p217|f3|ir04/i, { logo: "logo-dallara", name: "Dallara", color: "#00E699" }],
  [/ligier|jsp320/i, { logo: "logo-ligier", name: "Ligier", color: "#38BDF8" }],
  [/nissan/i, { logo: "logo-nissan", name: "Nissan", color: "#EF4444" }],
  [/lotus/i, { logo: "logo-lotus", name: "Lotus", color: "#22C55E" }],
  [/radical/i, { logo: "logo-radical", name: "Radical", color: "#F59E0B" }],
  [/caterham/i, { logo: "logo-caterham", name: "Caterham", color: "#10B981" }],
  [/formulavee|raygr|skip|f1600/i, { logo: "logo-formula", name: "Formula", color: "#94A3B8" }],
  [/pontiac/i, { logo: "logo-pontiac", name: "Pontiac", color: "#DC2626" }],
  [/buick/i, { logo: "logo-buick", name: "Buick", color: "#2563EB" }],
  [/holden|commodore/i, { logo: "logo-holden", name: "Holden", color: "#DC2626" }],
  [/fiaf4|formula4|\bf4\b/i, { logo: "logo-fia", name: "FIA", color: "#38BDF8" }],
  [/dirt|sprintcar|latemodel|midget|ump|streetstock/i, { logo: "logo-dirt", name: "Dirt", color: "#F59E0B" }],
  [/nascar|stockcar|arca|truck|legends|modified/i, { logo: "logo-oval", name: "Oval", color: "#FBBF24" }],
];

const DEFAULT_BRAND: CarBrandInfo = {
  id: "motorsport",
  name: "Motorsport",
  color: "#10b981",
  bg: "rgba(16, 185, 129, 0.12)",
  svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><circle cx="12" cy="12" r="8.5" stroke="#10b981" stroke-width="1.5"/><path d="M8 15.5 12 7l4 8.5-4-2-4 2Z" fill="#10b981"/></svg>`,
};

const brandInfoCache = new Map<string, CarBrandInfo>();

export function getCarBrandInfo(carNameOrFolder: string): CarBrandInfo {
  const rawKey = String(carNameOrFolder || "");
  const cached = brandInfoCache.get(rawKey);
  if (cached) return cached;
  const info = computeCarBrandInfo(rawKey);
  if (brandInfoCache.size > 256) brandInfoCache.clear();
  brandInfoCache.set(rawKey, info);
  return info;
}

function buildOfficialSvg(logoId: string, color: string): string | null {
  const d = OFFICIAL_BRAND_PATHS[logoId];
  if (!d) return null;
  const finalColor = BRAND_ACCENT_OVERRIDE[logoId] || color;
  return `<svg viewBox="0 0 24 24" fill="${finalColor}" fill-rule="evenodd" clip-rule="evenodd" style="color:${finalColor}" class="w-full h-full"><path fill-rule="evenodd" d="${d}"/></svg>`;
}

function computeCarBrandInfo(carNameOrFolder: string): CarBrandInfo {
  const key = normKey(carNameOrFolder);
  const catalogHit = CATALOG_BRAND_BY_KEY.get(key);
  if (catalogHit) {
    const svg = buildOfficialSvg(catalogHit.logo, catalogHit.color);
    const finalColor = BRAND_ACCENT_OVERRIDE[catalogHit.logo] || catalogHit.color;
    if (svg) {
      return {
        id: catalogHit.logo.replace(/^logo-/, ""),
        name: catalogHit.name,
        color: finalColor,
        bg: `${finalColor}22`,
        svg,
      };
    }
  }

  for (const [regex, meta] of FALLBACK_BRAND_RULES) {
    if (regex.test(carNameOrFolder) || regex.test(key)) {
      const svg = buildOfficialSvg(meta.logo, meta.color);
      const finalColor = BRAND_ACCENT_OVERRIDE[meta.logo] || meta.color;
      if (svg) {
        return {
          id: meta.logo.replace(/^logo-/, ""),
          name: meta.name,
          color: finalColor,
          bg: `${finalColor}22`,
          svg,
        };
      }
    }
  }

  return DEFAULT_BRAND;
}

export function createBrandLogoBadge(carNameOrFolder: string, size: "sm" | "md" = "md"): HTMLSpanElement {
  const brand = getCarBrandInfo(carNameOrFolder);
  const el = document.createElement("span");
  const dims = size === "sm" ? "w-6 h-6 p-1 rounded-lg" : "w-8 h-8 p-1.5 rounded-xl";
  el.className = `inline-flex items-center justify-center shrink-0 border ${dims}`;
  el.style.background = brand.bg;
  el.style.borderColor = `${brand.color}44`;
  el.title = brand.name;
  el.innerHTML = brand.svg;
  return el;
}
