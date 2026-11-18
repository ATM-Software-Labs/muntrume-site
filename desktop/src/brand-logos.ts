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

const MULTICOLOR_BRAND_SVGS: Record<string, string> = {
  "logo-lambo": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M4 3.5 L12 2 L20 3.5 L19 14.5 C18.5 18 15.5 20.5 12 22 C8.5 20.5 5.5 18 5 14.5 Z" fill="#111317" stroke="#EAB308" stroke-width="1.8"/>
    <path d="M8.5 14.5 L10.5 10.5 L13.5 9.5 L16 11.5 L14.5 15.5 L11.5 16 Z" fill="#FACC15"/>
    <path d="M14.5 9.5 L17.5 7.5 M15.5 10.5 L18 9" stroke="#FACC15" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`,
  "logo-ferrari": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M4.5 3.5 H19.5 V14 C19.5 17.8 16 20.4 12 22 C8 20.4 4.5 17.8 4.5 14 Z" fill="#FACC15" stroke="#B45309" stroke-width="1.2"/>
    <rect x="5.2" y="4.2" width="4.5" height="2" fill="#16A34A"/>
    <rect x="9.7" y="4.2" width="4.6" height="2" fill="#FFFFFF"/>
    <rect x="14.3" y="4.2" width="4.5" height="2" fill="#DC2626"/>
    <path d="M10.5 17.5 L11 13.5 L9.5 11.5 L12.5 8.5 L14.5 10 L13.5 13.5 L14.5 17.5" stroke="#111317" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  "logo-porsche": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M4.5 3.5 L12 2.2 L19.5 3.5 L18.5 14.5 C17.8 18 15 20.4 12 21.8 C9 20.4 6.2 18 5.5 14.5 Z" fill="#EAB308" stroke="#FDE047" stroke-width="1.2"/>
    <path d="M6 5 H12 V11 H6 Z M12 11 H18 V16.5 H12 Z" fill="#DC2626"/>
    <path d="M6 7.5 H12 M12 13.5 H18" stroke="#111317" stroke-width="1.5"/>
    <rect x="9.8" y="8.5" width="4.4" height="5.5" rx="1" fill="#FACC15" stroke="#111317" stroke-width="1"/>
  </svg>`,
  "logo-bmw": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <circle cx="12" cy="12" r="9.5" fill="#111317" stroke="#CBD5E1" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="6" fill="#FFFFFF"/>
    <path d="M12 6 A6 6 0 0 1 18 12 H12 Z" fill="#1D4ED8"/>
    <path d="M6 12 A6 6 0 0 0 12 18 V12 Z" fill="#1D4ED8"/>
  </svg>`,
  "logo-mercedes": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <circle cx="12" cy="12" r="9.5" fill="#0F172A" stroke="#00D2BE" stroke-width="1.6"/>
    <path d="M12 3.2 V12 M12 12 L4.5 16.5 M12 12 L19.5 16.5" stroke="#F8FAFC" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  "logo-mclaren": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <rect x="2.5" y="4.5" width="19" height="15" rx="4" fill="#18120B" stroke="#FF8000" stroke-width="1.4"/>
    <path d="M5.5 15.5 C9.5 10.5, 14.5 8.5, 19 8.5 C16.5 11.5, 14.5 14, 13.5 15.5 C12.5 13.5, 10 13.5, 5.5 15.5 Z" fill="#FF8000"/>
  </svg>`,
  "logo-aston": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M2 10.5 H22 L19.5 14.5 H4.5 Z" fill="#006F62" stroke="#34D399" stroke-width="1.2"/>
    <rect x="8.5" y="11" width="7" height="2.6" rx="0.8" fill="#F8FAFC"/>
  </svg>`,
  "logo-audi": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <circle cx="6" cy="12" r="3.3" stroke="#F8FAFC" stroke-width="1.5"/>
    <circle cx="10" cy="12" r="3.3" stroke="#E2E8F0" stroke-width="1.5"/>
    <circle cx="14" cy="12" r="3.3" stroke="#F8FAFC" stroke-width="1.5"/>
    <circle cx="18" cy="12" r="3.3" stroke="#EF4444" stroke-width="1.5"/>
  </svg>`,
  "logo-chevy": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M3 10 H8.5 V8 H15.5 V10 H21 L19.5 14 H15.5 V16 H8.5 V14 H4.5 Z" fill="#EAB308" stroke="#FEF08A" stroke-width="1.2"/>
  </svg>`,
  "logo-ford": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <ellipse cx="12" cy="12" rx="9.8" ry="5.8" fill="#1D4ED8" stroke="#93C5FD" stroke-width="1.5"/>
    <path d="M7.5 12 H16.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  "logo-cadillac": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <path d="M4 4 H20 L18.5 15 L12 20.5 L5.5 15 Z" fill="#111317" stroke="#EAB308" stroke-width="1.6"/>
    <rect x="6.5" y="6.5" width="5" height="4" fill="#DC2626"/>
    <rect x="12.5" y="6.5" width="5" height="4" fill="#2563EB"/>
    <rect x="6.5" y="11.5" width="5" height="4" fill="#FACC15"/>
    <rect x="12.5" y="11.5" width="5" height="4" fill="#F8FAFC"/>
  </svg>`,
  "logo-acura": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <circle cx="12" cy="12" r="9.2" fill="#18181B" stroke="#F43F5E" stroke-width="1.6"/>
    <path d="M12 5.5 L7.5 17.5 M12 5.5 L16.5 17.5 M9 13.5 H15" stroke="#F8FAFC" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`,
  "logo-dallara": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <polygon points="12,3 21,12 12,21 3,12" fill="#064E3B" stroke="#10B981" stroke-width="1.6"/>
    <path d="M9.5 8.5 H13 C15 8.5 16 10 16 12 C16 14 15 15.5 13 15.5 H9.5 Z" stroke="#F8FAFC" stroke-width="1.6"/>
  </svg>`,
  "logo-toyota": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <ellipse cx="12" cy="12" rx="9.5" ry="6.5" stroke="#EF4444" stroke-width="1.6"/>
    <ellipse cx="12" cy="12" rx="3.2" ry="6.2" stroke="#F8FAFC" stroke-width="1.4"/>
    <ellipse cx="12" cy="9.5" rx="6.5" ry="2.6" stroke="#F8FAFC" stroke-width="1.4"/>
  </svg>`,
  "logo-mazda": `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full">
    <circle cx="12" cy="12" r="9" fill="#18181B" stroke="#F43F5E" stroke-width="1.6"/>
    <path d="M6.5 10.5 Q12 15.5 17.5 10.5 Q14.5 15.5 12 16.5 Q9.5 15.5 6.5 10.5 Z" fill="#F8FAFC"/>
  </svg>`,
};

const FALLBACK_BRAND_RULES: Array<[RegExp, { logo: string; name: string; color: string }]> = [
  [/mercedes|amg|merc|w12|w13/i, { logo: "logo-mercedes", name: "Mercedes-AMG", color: "#00D2BE" }],
  [/porsche|911|992|991|963|718|cayman/i, { logo: "logo-porsche", name: "Porsche", color: "#D5001C" }],
  [/ferrari|296|488|499p/i, { logo: "logo-ferrari", name: "Ferrari", color: "#FACC15" }],
  [/bmw|m4|m8|m2|hybridv8|lmdh/i, { logo: "logo-bmw", name: "BMW", color: "#1C69D4" }],
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
  [/dallara|superformula|sf23|p217|f3|ir04/i, { logo: "logo-dallara", name: "Dallara", color: "#10B981" }],
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

function resolveBrandSvg(logoId: string, color: string): string | null {
  if (MULTICOLOR_BRAND_SVGS[logoId]) return MULTICOLOR_BRAND_SVGS[logoId];
  const d = OFFICIAL_BRAND_PATHS[logoId];
  if (!d) return null;
  return `<svg viewBox="0 0 24 24" fill="currentColor" style="color:${color}" class="w-full h-full"><path d="${d}"/></svg>`;
}

function computeCarBrandInfo(carNameOrFolder: string): CarBrandInfo {
  const key = normKey(carNameOrFolder);
  const catalogHit = CATALOG_BRAND_BY_KEY.get(key);
  if (catalogHit) {
    const svg = resolveBrandSvg(catalogHit.logo, catalogHit.color);
    if (svg) {
      return {
        id: catalogHit.logo.replace(/^logo-/, ""),
        name: catalogHit.name,
        color: catalogHit.color,
        bg: `${catalogHit.color}22`,
        svg,
      };
    }
  }

  for (const [regex, meta] of FALLBACK_BRAND_RULES) {
    if (regex.test(carNameOrFolder) || regex.test(key)) {
      const svg = resolveBrandSvg(meta.logo, meta.color);
      if (svg) {
        return {
          id: meta.logo.replace(/^logo-/, ""),
          name: meta.name,
          color: meta.color,
          bg: `${meta.color}22`,
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
