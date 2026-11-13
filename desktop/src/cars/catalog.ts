export type CarClass = "GTP" | "LMP2" | "LMP3" | "GT3" | "GT4" | "GTE" | "Formula" | "Touring" | "Oval" | "Dirt" | "Prototype";

export interface CarMetadata {
  readonly carFolder: string;
  readonly brand: string;
  readonly model: string;
  readonly carClass: CarClass;
  readonly svgLogoId: string;
  readonly accentColor: string;
}

const CAR_CATALOG_LIST: readonly CarMetadata[] = [
  // GTP
  { carFolder: "porsche963gtp", brand: "Porsche", model: "963 GTP", carClass: "GTP", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "porsche963", brand: "Porsche", model: "963 GTP", carClass: "GTP", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "ferrari499p", brand: "Ferrari", model: "499P", carClass: "GTP", svgLogoId: "logo-ferrari", accentColor: "#ef4444" },
  { carFolder: "bmwmhybridv8", brand: "BMW", model: "M Hybrid V8", carClass: "GTP", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "bmwlmdh", brand: "BMW", model: "M Hybrid V8", carClass: "GTP", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "acuraarx06gtp", brand: "Acura", model: "ARX-06 GTP", carClass: "GTP", svgLogoId: "logo-acura", accentColor: "#e2e8f0" },
  { carFolder: "cadillacvseriesrgtp", brand: "Cadillac", model: "V-Series.R GTP", carClass: "GTP", svgLogoId: "logo-cadillac", accentColor: "#facc15" },
  { carFolder: "amvalkyriegtp", brand: "Aston Martin", model: "Valkyrie AMR-LMH", carClass: "GTP", svgLogoId: "logo-aston", accentColor: "#10b981" },
  // LMP2 / LMP3
  { carFolder: "dallarap217", brand: "Dallara", model: "P217 LMP2", carClass: "LMP2", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "ligierjsp320", brand: "Ligier", model: "JS P320 LMP3", carClass: "LMP3", svgLogoId: "logo-ligier", accentColor: "#38bdf8" },
  // GT3
  { carFolder: "ferrari296gt3", brand: "Ferrari", model: "296 GT3", carClass: "GT3", svgLogoId: "logo-ferrari", accentColor: "#ef4444" },
  { carFolder: "porsche992rgt3", brand: "Porsche", model: "911 GT3 R (992)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "bmwm4gt3", brand: "BMW", model: "M4 GT3", carClass: "GT3", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "mercedesamggt3", brand: "Mercedes-AMG", model: "GT3", carClass: "GT3", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1" },
  { carFolder: "mercedesamgevogt3", brand: "Mercedes-AMG", model: "GT3 EVO", carClass: "GT3", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1" },
  { carFolder: "audir8gt3", brand: "Audi", model: "R8 LMS GT3", carClass: "GT3", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "audir8lmsevo2gt3", brand: "Audi", model: "R8 LMS EVO II GT3", carClass: "GT3", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "mclaren720sgt3", brand: "McLaren", model: "720S GT3 EVO", carClass: "GT3", svgLogoId: "logo-mclaren", accentColor: "#fb923c" },
  { carFolder: "chevyvettez06rgt3", brand: "Chevrolet", model: "Corvette Z06 GT3.R", carClass: "GT3", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "fordmustanggt3", brand: "Ford", model: "Mustang GT3", carClass: "GT3", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "lamborghinievogt3", brand: "Lamborghini", model: "Huracán GT3 EVO2", carClass: "GT3", svgLogoId: "logo-lambo", accentColor: "#eab308" },
  { carFolder: "acuransxevo22gt3", brand: "Acura", model: "NSX GT3 EVO 22", carClass: "GT3", svgLogoId: "logo-acura", accentColor: "#e2e8f0" },
  { carFolder: "amvantageevogt3", brand: "Aston Martin", model: "Vantage GT3 EVO", carClass: "GT3", svgLogoId: "logo-aston", accentColor: "#10b981" },
  // GT4 / GTE / Cup
  { carFolder: "amvantagegt4", brand: "Aston Martin", model: "Vantage GT4", carClass: "GT4", svgLogoId: "logo-aston", accentColor: "#10b981" },
  { carFolder: "bmwm4gt4", brand: "BMW", model: "M4 GT4", carClass: "GT4", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "bmwm4evogt4", brand: "BMW", model: "M4 GT4 EVO", carClass: "GT4", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "fordmustanggt4", brand: "Ford", model: "Mustang GT4", carClass: "GT4", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "mclaren570sgt4", brand: "McLaren", model: "570S GT4", carClass: "GT4", svgLogoId: "logo-mclaren", accentColor: "#fb923c" },
  { carFolder: "mercedesamggt4", brand: "Mercedes-AMG", model: "GT4", carClass: "GT4", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1" },
  { carFolder: "porsche718gt4", brand: "Porsche", model: "718 Cayman GT4", carClass: "GT4", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "porsche992cup", brand: "Porsche", model: "911 GT3 Cup (992)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "porsche9922cup", brand: "Porsche", model: "911 GT3 Cup (992.2)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "ferrari488gte", brand: "Ferrari", model: "488 GTE", carClass: "GTE", svgLogoId: "logo-ferrari", accentColor: "#ef4444" },
  { carFolder: "bmwm8gte", brand: "BMW", model: "M8 GTE", carClass: "GTE", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "c8rvettegte", brand: "Chevrolet", model: "Corvette C8.R GTE", carClass: "GTE", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "porsche991rsr", brand: "Porsche", model: "911 RSR", carClass: "GTE", svgLogoId: "logo-porsche", accentColor: "#d97706" },
  { carFolder: "fordgt2017", brand: "Ford", model: "GT Le Mans", carClass: "GTE", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  // Touring / Production / Supercars
  { carFolder: "bmwm2csr", brand: "BMW", model: "M2 CS Racing", carClass: "Touring", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "bmwm2g87", brand: "BMW", model: "M2 (G87)", carClass: "Touring", svgLogoId: "logo-bmw", accentColor: "#38bdf8" },
  { carFolder: "toyotagr86", brand: "Toyota", model: "GR86", carClass: "Touring", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "renaultcliocup", brand: "Renault", model: "Clio R.S. V", carClass: "Touring", svgLogoId: "logo-renault", accentColor: "#facc15" },
  { carFolder: "hondacivictyper", brand: "Honda", model: "Civic Type R TCR", carClass: "Touring", svgLogoId: "logo-honda", accentColor: "#ef4444" },
  { carFolder: "hyundaielantracn7", brand: "Hyundai", model: "Elantra N TCR", carClass: "Touring", svgLogoId: "logo-hyundai", accentColor: "#38bdf8" },
  { carFolder: "hyundaivelostern", brand: "Hyundai", model: "Veloster N TCR", carClass: "Touring", svgLogoId: "logo-hyundai", accentColor: "#38bdf8" },
  { carFolder: "audirs3lms", brand: "Audi", model: "RS 3 LMS TCR", carClass: "Touring", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "audirs3lmsgen2", brand: "Audi", model: "RS 3 LMS Gen2", carClass: "Touring", svgLogoId: "logo-audi", accentColor: "#f87171" },
  { carFolder: "supercarsfordmustanggen3", brand: "Ford", model: "Mustang Gen3 Supercar", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "supercarschevycamarogen3", brand: "Chevrolet", model: "Camaro Gen3 Supercar", carClass: "Touring", svgLogoId: "logo-chevy", accentColor: "#fbbf24" },
  { carFolder: "v8supercarsholden2019", brand: "Holden", model: "Commodore ZB", carClass: "Touring", svgLogoId: "logo-holden", accentColor: "#ef4444" },
  // Formula
  { carFolder: "superformulalights324", brand: "Dallara", model: "SF Lights 324", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "superformulasf23honda", brand: "Honda", model: "Super Formula SF23", carClass: "Formula", svgLogoId: "logo-honda", accentColor: "#ef4444" },
  { carFolder: "superformulasf23toyota", brand: "Toyota", model: "Super Formula SF23", carClass: "Formula", svgLogoId: "logo-toyota", accentColor: "#ef4444" },
  { carFolder: "dallaraf3", brand: "Dallara", model: "F3", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "dallarair18", brand: "Dallara", model: "IR18 IndyCar", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "dallarair01", brand: "Dallara", model: "iR-01", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#60a5fa" },
  { carFolder: "mercedesw13", brand: "Mercedes-AMG", model: "F1 W13 E Performance", carClass: "Formula", svgLogoId: "logo-mercedes", accentColor: "#00e5ff" },
  { carFolder: "formulair04", brand: "FIA", model: "Formula 4", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "raygr22", brand: "Ray", model: "FF1600", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  { carFolder: "formulavee", brand: "Formula Vee", model: "FVee", carClass: "Formula", svgLogoId: "logo-fia", accentColor: "#22d3ee" },
  // Prototype
  { carFolder: "radicalsr8", brand: "Radical", model: "SR8", carClass: "Prototype", svgLogoId: "logo-radical", accentColor: "#10b981" },
  { carFolder: "specracer", brand: "Ford", model: "Spec Racer Ford", carClass: "Prototype", svgLogoId: "logo-ford", accentColor: "#3b82f6" },
  { carFolder: "nissangtpzxt", brand: "Nissan", model: "GTP ZX-T", carClass: "Prototype", svgLogoId: "logo-nissan", accentColor: "#ef4444" },
];

const CAR_BY_FOLDER = new Map<string, CarMetadata>(
  CAR_CATALOG_LIST.map((car) => [car.carFolder.toLowerCase(), car]),
);

const BRAND_RULES: ReadonlyArray<{
  match: readonly string[];
  brand: string;
  svgLogoId: string;
  accentColor: string;
  defaultClass: CarClass;
}> = [
  { match: ["ferrari"], brand: "Ferrari", svgLogoId: "logo-ferrari", accentColor: "#ef4444", defaultClass: "GT3" },
  { match: ["bmw"], brand: "BMW", svgLogoId: "logo-bmw", accentColor: "#38bdf8", defaultClass: "GT3" },
  { match: ["porsche", "992", "963", "991", "718"], brand: "Porsche", svgLogoId: "logo-porsche", accentColor: "#d97706", defaultClass: "GT3" },
  { match: ["mercedes"], brand: "Mercedes-AMG", svgLogoId: "logo-mercedes", accentColor: "#cbd5e1", defaultClass: "GT3" },
  { match: ["audi"], brand: "Audi", svgLogoId: "logo-audi", accentColor: "#f87171", defaultClass: "GT3" },
  { match: ["ford", "mustang", "f150", "fusion", "thunderbird", "specracer"], brand: "Ford", svgLogoId: "logo-ford", accentColor: "#3b82f6", defaultClass: "GT3" },
  { match: ["chevy", "chevrolet", "vette", "camaro", "silverado", "montecarlo", "c6r", "c8r"], brand: "Chevrolet", svgLogoId: "logo-chevy", accentColor: "#fbbf24", defaultClass: "GT3" },
  { match: ["lamborghini"], brand: "Lamborghini", svgLogoId: "logo-lambo", accentColor: "#eab308", defaultClass: "GT3" },
  { match: ["mclaren"], brand: "McLaren", svgLogoId: "logo-mclaren", accentColor: "#fb923c", defaultClass: "GT3" },
  { match: ["acura", "hpd"], brand: "Acura", svgLogoId: "logo-acura", accentColor: "#e2e8f0", defaultClass: "GTP" },
  { match: ["aston", "amvantage", "amvalkyrie"], brand: "Aston Martin", svgLogoId: "logo-aston", accentColor: "#10b981", defaultClass: "GT3" },
  { match: ["cadillac"], brand: "Cadillac", svgLogoId: "logo-cadillac", accentColor: "#facc15", defaultClass: "GTP" },
  { match: ["toyota", "supra", "tundra", "camry"], brand: "Toyota", svgLogoId: "logo-toyota", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["honda"], brand: "Honda", svgLogoId: "logo-honda", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["hyundai"], brand: "Hyundai", svgLogoId: "logo-hyundai", accentColor: "#38bdf8", defaultClass: "Touring" },
  { match: ["mx5", "mx"], brand: "Mazda", svgLogoId: "logo-mazda", accentColor: "#e2e8f0", defaultClass: "Touring" },
  { match: ["renault"], brand: "Renault", svgLogoId: "logo-renault", accentColor: "#facc15", defaultClass: "Touring" },
  { match: ["nissan"], brand: "Nissan", svgLogoId: "logo-nissan", accentColor: "#ef4444", defaultClass: "Prototype" },
  { match: ["holden"], brand: "Holden", svgLogoId: "logo-holden", accentColor: "#ef4444", defaultClass: "Touring" },
  { match: ["dallara"], brand: "Dallara", svgLogoId: "logo-dallara", accentColor: "#60a5fa", defaultClass: "Formula" },
  { match: ["ligier"], brand: "Ligier", svgLogoId: "logo-ligier", accentColor: "#38bdf8", defaultClass: "LMP3" },
  { match: ["caterham"], brand: "Caterham", svgLogoId: "logo-caterham", accentColor: "#10b981", defaultClass: "Touring" },
  { match: ["radical"], brand: "Radical", svgLogoId: "logo-radical", accentColor: "#10b981", defaultClass: "Prototype" },
  { match: ["lotus"], brand: "Lotus", svgLogoId: "logo-lotus", accentColor: "#facc15", defaultClass: "Formula" },
  { match: ["buick"], brand: "Buick", svgLogoId: "logo-buick", accentColor: "#94a3b8", defaultClass: "Oval" },
  { match: ["pontiac"], brand: "Pontiac", svgLogoId: "logo-pontiac", accentColor: "#ef4444", defaultClass: "Oval" },
];

const BRAND_SVG_INNER: Record<string, string> = {
  "logo-bmw": `<circle cx="12" cy="12" r="9.5" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/><path d="M12 4.5A7.5 7.5 0 0 1 19.5 12H12z" fill="#38bdf8"/><path d="M12 19.5A7.5 7.5 0 0 1 4.5 12H12z" fill="#38bdf8"/><path d="M12 4.5A7.5 7.5 0 0 0 4.5 12H12z" fill="#f8fafc"/><path d="M12 19.5A7.5 7.5 0 0 0 19.5 12H12z" fill="#f8fafc"/>`,
  "logo-audi": `<g fill="none" stroke="#e2e8f0" stroke-width="1.6"><circle cx="5.4" cy="12" r="2.7"/><circle cx="9.8" cy="12" r="2.7"/><circle cx="14.2" cy="12" r="2.7"/><circle cx="18.6" cy="12" r="2.7"/></g>`,
  "logo-mercedes": `<circle cx="12" cy="12" r="9.5" fill="none" stroke="#cbd5e1" stroke-width="1.6"/><path d="M12 3v9m0 0-7.5 4.8M12 12l7.5 4.8" stroke="#e2e8f0" stroke-width="1.7" stroke-linecap="round"/>`,
  "logo-ferrari": `<path d="M6 4h12v9c0 4.2-6 7.5-6 7.5S6 17.2 6 13z" fill="#facc15" stroke="#ca8a04" stroke-width="1.2"/><path d="M6 4h4v2H6z" fill="#16a34a"/><path d="M10 4h4v2h-4z" fill="#f8fafc"/><path d="M14 4h4v2h-4z" fill="#dc2626"/><path d="M12 8.5c1.5 1.5 1.8 4 .2 6.8-.9-1.5-1.2-3.2-.2-6.8z" fill="#090d12"/>`,
  "logo-porsche": `<path d="M6 4h12v9c0 4.2-6 7.5-6 7.5S6 17.2 6 13z" fill="#d97706" stroke="#fbbf24" stroke-width="1.2"/><path d="M6 4h6v5.5H6zM12 9.5h6V15h-6z" fill="#dc2626" fill-opacity="0.85"/><path d="M6 9.5h12M12 4v15" stroke="#090d12" stroke-width="1"/>`,
  "logo-ford": `<ellipse cx="12" cy="12" rx="10" ry="5.5" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.4"/><text x="12" y="14.5" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-style="italic" font-weight="800" font-size="7.5">Ford</text>`,
  "logo-chevy": `<path d="M3 10.2h5.2V8h7.6v2.2H21l-1.6 3.6h-3.6V16H8.2v-2.2H4.6z" fill="#fbbf24" stroke="#fef08a" stroke-width="1"/>`,
  "logo-aston": `<path d="M2.5 9.5 12 12l9.5-2.5-2.5 4.2-7 1.3-7-1.3z" fill="#e2e8f0" stroke="#10b981" stroke-width="1"/><path d="M5 11.2h14" stroke="#090d12" stroke-width="0.9"/>`,
  "logo-lambo": `<path d="M6 4.5 12 3l6 1.5v8.8c0 3.8-6 7.4-6 7.4s-6-3.6-6-7.4z" fill="#090d12" stroke="#eab308" stroke-width="1.5"/><path d="M9 14c1-2.5 2.5-4.5 5.2-5-1 1.8-.5 3.6.8 5-2 0-3.8-.5-6 0z" fill="#eab308"/>`,
  "logo-mclaren": `<path d="M4 15.5c3.5-5 10.5-7.5 16.5-5.5-4 1.2-7.5 3.8-9.5 6.8 1.5-2.5.8-4.5-7-1.3z" fill="#fb923c"/>`,
  "logo-acura": `<path d="M12 3.5 5 19h2.8l4.2-9.8L16.2 19H19z" fill="#e2e8f0"/><path d="M8.5 14.5h7" stroke="#e2e8f0" stroke-width="1.6"/>`,
  "logo-cadillac": `<path d="M5 5h14v9l-7 6-7-6z" fill="#090d12" stroke="#facc15" stroke-width="1.4"/><path d="M7 7h5v4H7z" fill="#dc2626"/><path d="M12 7h5v4h-5z" fill="#2563eb"/><path d="M7 11h10v3l-5 4-5-4z" fill="#facc15"/>`,
  "logo-toyota": `<ellipse cx="12" cy="12" rx="9.5" ry="6.2" fill="none" stroke="#ef4444" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="3" ry="6" fill="none" stroke="#ef4444" stroke-width="1.4"/><ellipse cx="12" cy="9.2" rx="6" ry="2.2" fill="none" stroke="#ef4444" stroke-width="1.3"/>`,
  "logo-honda": `<rect x="4" y="4.5" width="16" height="15" rx="3" fill="none" stroke="#ef4444" stroke-width="1.5"/><path d="M8 7.5v9M16 7.5v9M8 12h8" stroke="#f8fafc" stroke-width="1.8" stroke-linecap="round"/>`,
  "logo-mazda": `<circle cx="12" cy="12" r="9" fill="none" stroke="#cbd5e1" stroke-width="1.5"/><path d="M5.5 9.5 12 14.5l6.5-5" fill="none" stroke="#e2e8f0" stroke-width="1.7" stroke-linecap="round"/>`,
  "logo-hyundai": `<ellipse cx="12" cy="12" rx="9.5" ry="5.8" fill="none" stroke="#38bdf8" stroke-width="1.5"/><path d="M9.5 8 7.5 16M16.5 8l-2 8M8.5 12.5l7-1.2" stroke="#e2e8f0" stroke-width="1.6" stroke-linecap="round"/>`,
  "logo-renault": `<path d="M12 3 19 12l-7 9-7-9z" fill="none" stroke="#facc15" stroke-width="1.8"/><path d="M12 6.5 16 12l-4 5.5L8 12z" fill="none" stroke="#facc15" stroke-width="1.2"/>`,
  "logo-nissan": `<circle cx="12" cy="12" r="8" fill="none" stroke="#cbd5e1" stroke-width="1.6"/><rect x="3" y="9.8" width="18" height="4.4" rx="1" fill="#090d12" stroke="#ef4444" stroke-width="1.2"/>`,
};

export function resolveCarMetadata(carFolder: string): CarMetadata | null {
  const raw = carFolder.trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = CAR_BY_FOLDER.get(key) ?? CAR_BY_FOLDER.get(raw.toLowerCase());
  if (exact) return exact;

  for (const rule of BRAND_RULES) {
    if (rule.match.some((m) => key.includes(m))) {
      return {
        carFolder: raw,
        brand: rule.brand,
        model: raw,
        carClass: rule.defaultClass,
        svgLogoId: rule.svgLogoId,
        accentColor: rule.accentColor,
      };
    }
  }
  return null;
}

export function filterCarsByClass(carClass?: CarClass): readonly CarMetadata[] {
  if (!carClass) return CAR_CATALOG_LIST;
  return CAR_CATALOG_LIST.filter((c) => c.carClass === carClass);
}

/**
 * Returns raw inner SVG markup for a manufacturer logo, or a crisp monogram fallback.
 */
function brandSvgInner(meta: CarMetadata): string {
  return (
    BRAND_SVG_INNER[meta.svgLogoId] ??
    `<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="${meta.accentColor}" fill-opacity="0.16" stroke="${meta.accentColor}" stroke-width="1.5"/><text x="12" y="15.5" text-anchor="middle" fill="${meta.accentColor}" font-family="monospace" font-weight="800" font-size="9">${meta.brand.slice(0, 2).toUpperCase()}</text>`
  );
}

/**
 * Generates an inline SVG element for the car's manufacturer emblem.
 */
export function createBrandBadgeElement(meta: CarMetadata, size = 20): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("shrink-0");
  svg.innerHTML = brandSvgInner(meta);
  return svg;
}
