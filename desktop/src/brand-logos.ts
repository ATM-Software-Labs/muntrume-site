import { NEUTRAL_BRAND_MARK, OFFICIAL_BRAND_PATHS } from "./cars/brand-icons";
import { colorForLogo, NEUTRAL_BRAND_HEX } from "./cars/brand-colors";
import { CAR_CATALOG_LIST } from "./cars/catalog";
import { BRAND_LOGO_ASSETS, brandLogoSvg } from "./cars/brand-logo-assets";

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

interface BrandRule {
  logo: string;
  name: string;
}

const FALLBACK_BRAND_RULES: Array<[RegExp, BrandRule]> = [
  [/raygr|gr22/i, { logo: "logo-ford", name: "Ford" }],
  [/formulavee|volkswagen/i, { logo: "logo-vw", name: "Volkswagen" }],
  [/mercedes|amg|merc|w12|w13/i, { logo: "logo-mercedes", name: "Mercedes-AMG" }],
  [/porsche|911|992|991|963|718|cayman/i, { logo: "logo-porsche", name: "Porsche" }],
  [/ferrari|296|488|499p/i, { logo: "logo-ferrari", name: "Ferrari" }],
  [/bmw|m4|m8|m2|hybridv8|lmdh/i, { logo: "logo-bmw", name: "BMW" }],
  [/audi|r8|rs3/i, { logo: "logo-audi", name: "Audi" }],
  [/lamborghini|lambo|huracan|sc63/i, { logo: "logo-lambo", name: "Lamborghini" }],
  [/mclaren|720s|570s/i, { logo: "logo-mclaren", name: "McLaren" }],
  [/aston|amvantage|amvalkyrie|dbr9/i, { logo: "logo-aston", name: "Aston Martin" }],
  [/cadillac|vseries/i, { logo: "logo-cadillac", name: "Cadillac" }],
  [/acura|arx06|nsx/i, { logo: "logo-acura", name: "Acura" }],
  [/corvette|chevy|chevrolet|camaro|silverado|impala|montecarlo|vette|c8r|c6r|z06/i, { logo: "logo-chevy", name: "Chevrolet" }],
  [/ford|mustang|specracer|fiesta|thunderbird|fusion/i, { logo: "logo-ford", name: "Ford" }],
  [/toyota|gr86|supra|tundra|camry/i, { logo: "logo-toyota", name: "Toyota" }],
  [/mazda|mx5/i, { logo: "logo-mazda", name: "Mazda" }],
  [/honda|civic/i, { logo: "logo-honda", name: "Honda" }],
  [/hyundai|elantra|veloster/i, { logo: "logo-hyundai", name: "Hyundai" }],
  [/renault|clio/i, { logo: "logo-renault", name: "Renault" }],
  [/formulair04|dallara|superformula|sfl|sf23|p217|ir18|ir01|dw12/i, { logo: "logo-dallara", name: "Dallara" }],
  [/tatuus|usf2000|indypro|pm18/i, { logo: "logo-tatuus", name: "Tatuus" }],
  [/ligier|jsp320/i, { logo: "logo-ligier", name: "Ligier" }],
  [/nissan/i, { logo: "logo-nissan", name: "Nissan" }],
  [/lotus/i, { logo: "logo-lotus", name: "Lotus" }],
  [/radical/i, { logo: "logo-radical", name: "Radical" }],
  [/caterham/i, { logo: "logo-caterham", name: "Caterham" }],
  [/pontiac/i, { logo: "logo-pontiac", name: "Pontiac" }],
  [/buick/i, { logo: "logo-buick", name: "Buick" }],
  [/holden|commodore/i, { logo: "logo-holden", name: "Holden" }],
  [/skip|rt2000/i, { logo: "logo-skip", name: "Skip Barber" }],
  [/kia|optima/i, { logo: "logo-kia", name: "Kia" }],
  [/subaru|wrx/i, { logo: "logo-subaru", name: "Subaru" }],
  [/williams|fw31/i, { logo: "logo-williams", name: "Williams" }],
  [/ruf|rt12/i, { logo: "logo-ruf", name: "Ruf" }],
  [/riley/i, { logo: "logo-riley", name: "Riley" }],
  [/lotus49|lotus79|lotus/i, { logo: "logo-lotus", name: "Lotus" }],
];

function neutralSvg(color: string): string {
  return `<svg viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd" clip-rule="evenodd" style="color:${color}" class="w-full h-full"><path fill-rule="evenodd" d="${NEUTRAL_BRAND_MARK}"/></svg>`;
}

const DEFAULT_BRAND: CarBrandInfo = {
  id: "neutral",
  name: "Sin marca",
  color: NEUTRAL_BRAND_HEX,
  bg: `${NEUTRAL_BRAND_HEX}22`,
  svg: neutralSvg(NEUTRAL_BRAND_HEX),
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
  const colored = brandLogoSvg(logoId, 32);
  if (colored) return colored;
  const d = OFFICIAL_BRAND_PATHS[logoId];
  if (!d || d === NEUTRAL_BRAND_MARK) return null;
  return `<svg viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd" clip-rule="evenodd" style="color:${color}" class="w-full h-full"><path fill-rule="evenodd" d="${d}"/></svg>`;
}

function computeCarBrandInfo(carNameOrFolder: string): CarBrandInfo {
  const key = normKey(carNameOrFolder);
  const catalogHit = CATALOG_BRAND_BY_KEY.get(key);
  if (catalogHit) {
    const finalColor = colorForLogo(catalogHit.logo).hex;
    const svg = buildOfficialSvg(catalogHit.logo, finalColor) ?? neutralSvg(finalColor);
    return {
      id: catalogHit.logo.replace(/^logo-/, ""),
      name: catalogHit.name,
      color: finalColor,
      bg: `${finalColor}22`,
      svg,
    };
  }

  for (const [regex, meta] of FALLBACK_BRAND_RULES) {
    if (regex.test(carNameOrFolder) || regex.test(key)) {
      const finalColor = colorForLogo(meta.logo).hex;
      const svg = buildOfficialSvg(meta.logo, finalColor);
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

export interface SupportedBrandCar {
  carFolder: string;
  model: string;
  legacy: boolean;
}

export interface SupportedBrandEntry {
  id: string;
  logoId: string;
  name: string;
  color: string;
  colorKind: "brand" | "neutral";
  logoVerified: boolean;
  path: string;
  carPath: string;
  carPaths: string[];
  cars: SupportedBrandCar[];
  sampleModel: string;
  svg: string;
  sourceUrl: string;
  license: string;
}

export function getSupportedBrandsCatalog(): SupportedBrandEntry[] {
  const groups = new Map<string, SupportedBrandEntry>();

  const sortedCars = [...CAR_CATALOG_LIST].sort((a, b) => a.carFolder.localeCompare(b.carFolder));
  for (const car of sortedCars) {
    const info = getCarBrandInfo(car.carFolder);
    const logoId = `logo-${info.id}`;
    const key = info.name;
    let entry = groups.get(key);
    if (!entry) {
      const color = colorForLogo(logoId);
      const asset = BRAND_LOGO_ASSETS[logoId];
      const path = OFFICIAL_BRAND_PATHS[logoId] || NEUTRAL_BRAND_MARK;
      entry = {
        id: info.id,
        logoId,
        name: info.name,
        color: info.color,
        colorKind: color.kind,
        logoVerified: Boolean(asset),
        path,
        carPath: car.carFolder,
        carPaths: [],
        cars: [],
        sampleModel: `${car.brand} ${car.model}`,
        svg: info.svg,
        sourceUrl: asset?.sourceUrl ?? "",
        license: asset?.license ?? "",
      };
      groups.set(key, entry);
    }
    if (!entry.carPaths.includes(car.carFolder)) {
      entry.carPaths.push(car.carFolder);
      entry.cars.push({ carFolder: car.carFolder, model: car.model, legacy: car.legacy });
    }
  }

  for (const entry of groups.values()) {
    entry.carPath = entry.carPaths[0] || entry.id;
    entry.sampleModel = entry.carPaths.join(" ");
  }

  return [...groups.values()].sort((a, b) => {
    if (a.name === "Sin fabricante único") return 1;
    if (b.name === "Sin fabricante único") return -1;
    return a.name.localeCompare(b.name, "es");
  });
}
