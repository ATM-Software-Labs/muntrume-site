export type CarClass = "GTP" | "LMP2" | "GT3" | "GT4" | "Formula" | "Touring" | "Prototype";

export interface CarMetadata {
  readonly carFolder: string;
  readonly brand: string;
  readonly model: string;
  readonly carClass: CarClass;
  readonly svgLogoId: string;
}

const CAR_CATALOG_LIST: readonly CarMetadata[] = [
  { carFolder: "porsche963gtp", brand: "Porsche", model: "963 GTP", carClass: "GTP", svgLogoId: "logo-porsche" },
  { carFolder: "ferrari499p", brand: "Ferrari", model: "499P", carClass: "GTP", svgLogoId: "logo-ferrari" },
  { carFolder: "bmwmhybridv8", brand: "BMW", model: "M Hybrid V8", carClass: "GTP", svgLogoId: "logo-bmw" },
  { carFolder: "dallarap217", brand: "Dallara", model: "P217 LMP2", carClass: "LMP2", svgLogoId: "logo-dallara" },
  { carFolder: "ferrari296gt3", brand: "Ferrari", model: "296 GT3", carClass: "GT3", svgLogoId: "logo-ferrari" },
  { carFolder: "porsche992rgt3", brand: "Porsche", model: "911 GT3 R (992)", carClass: "GT3", svgLogoId: "logo-porsche" },
  { carFolder: "bmwm4gt3", brand: "BMW", model: "M4 GT3", carClass: "GT3", svgLogoId: "logo-bmw" },
  { carFolder: "superformulalights324", brand: "Dallara", model: "SF Lights 324", carClass: "Formula", svgLogoId: "logo-dallara" },
  { carFolder: "formulair04", brand: "FIA", model: "Formula 4", carClass: "Formula", svgLogoId: "logo-fia" },
];

const CAR_BY_FOLDER = new Map<string, CarMetadata>(
  CAR_CATALOG_LIST.map((car) => [car.carFolder.toLowerCase(), car]),
);

export function resolveCarMetadata(carFolder: string): CarMetadata | null {
  return CAR_BY_FOLDER.get(carFolder.trim().toLowerCase()) ?? null;
}

export function filterCarsByClass(carClass?: CarClass): readonly CarMetadata[] {
  if (!carClass) return CAR_CATALOG_LIST;
  return CAR_CATALOG_LIST.filter((c) => c.carClass === carClass);
}
