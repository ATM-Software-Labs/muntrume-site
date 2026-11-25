import type { CarProfile, DecalLayer, DriverProfile, PresetDefinition, SkinDesignState, ZoneKey, ZoneRect } from "./types";

function makeBaseZones(overrides: Partial<Record<ZoneKey, Partial<ZoneRect>>> = {}): Record<ZoneKey, ZoneRect> {
  const base: Record<ZoneKey, ZoneRect> = {
    hood: { key: "hood", label: "Capó", x: 0.30, y: 0.06, w: 0.40, h: 0.24 },
    roof: { key: "roof", label: "Techo", x: 0.34, y: 0.33, w: 0.32, h: 0.22 },
    leftSide: { key: "leftSide", label: "Lateral Izq.", x: 0.03, y: 0.32, w: 0.27, h: 0.44 },
    rightSide: { key: "rightSide", label: "Lateral Der.", x: 0.70, y: 0.32, w: 0.27, h: 0.44 },
    rearWing: { key: "rearWing", label: "Alerón Trasero", x: 0.28, y: 0.80, w: 0.44, h: 0.12 },
    mirrors: { key: "mirrors", label: "Retrovisores", x: 0.05, y: 0.08, w: 0.18, h: 0.10 },
    frontBumper: { key: "frontBumper", label: "Parachoques Del.", x: 0.26, y: 0.58, w: 0.48, h: 0.11 },
    rearBumper: { key: "rearBumper", label: "Parachoques Tras.", x: 0.26, y: 0.70, w: 0.48, h: 0.09 },
    numberPlateLeft: { key: "numberPlateLeft", label: "Placa Dorsal Izq. (iRacing)", x: 0.10, y: 0.47, w: 0.12, h: 0.12, restricted: true },
    numberPlateRight: { key: "numberPlateRight", label: "Placa Dorsal Der. (iRacing)", x: 0.78, y: 0.47, w: 0.12, h: 0.12, restricted: true },
  };
  for (const [k, patch] of Object.entries(overrides)) {
    const key = k as ZoneKey;
    if (patch && base[key]) {
      base[key] = { ...base[key], ...patch };
    }
  }
  return base;
}

export const CAR_CATEGORY_ORDER = [
  "GT3",
  "GTP / Hypercar",
  "LMP2 / LMP3",
  "GT4 & Cup",
  "Fórmula",
  "TCR & Producción",
] as const;

export const CAR_PROFILES: CarProfile[] = [
  // ─── GT3 (orden alfabético) ───
  {
    id: "acuransxgt3evo22",
    name: "Acura NSX GT3 EVO 22",
    brand: "Acura",
    category: "GT3",
    iracingFolder: "acuransxgt3evo22",
    logoPath: "/assets/brand/logos/logo-acura.svg",
    notes: "Laterales estilizados con tomas de aire traseras; capó bajo con gran visibilidad.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "astonmartinvantagegt3",
    name: "Aston Martin Vantage GT3 EVO",
    brand: "Aston Martin",
    category: "GT3",
    iracingFolder: "astonmartinvantagegt3",
    logoPath: "/assets/brand/logos/logo-aston.svg",
    notes: "Parrilla frontal ancha y capó largo; gran espacio lateral para sponsors.",
    defaultZones: makeBaseZones({ hood: { x: 0.28, y: 0.05, w: 0.44, h: 0.26 } }),
  },
  {
    id: "audir8lmsevo2gt3",
    name: "Audi R8 LMS EVO II GT3",
    brand: "Audi",
    category: "GT3",
    iracingFolder: "audir8lmsevo2gt3",
    logoPath: "/assets/brand/logos/logo-audi.svg",
    notes: "Sideblade lateral muy reconocible para acentos en verde MMT o carbono.",
    defaultZones: makeBaseZones({ mirrors: { x: 0.06, y: 0.09, w: 0.17, h: 0.09 } }),
  },
  {
    id: "bmwm4gt3",
    name: "BMW M4 GT3",
    brand: "BMW",
    category: "GT3",
    iracingFolder: "bmwm4gt3",
    logoPath: "/assets/brand/logos/logo-bmw.svg",
    notes: "Laterales muy limpios y planos, excelentes para franjas diagonales y sponsors.",
    defaultZones: makeBaseZones({ hood: { x: 0.29, y: 0.05, w: 0.42, h: 0.26 } }),
  },
  {
    id: "chevyvettez06rgt3",
    name: "Chevrolet Corvette Z06 GT3.R",
    brand: "Chevrolet",
    category: "GT3",
    iracingFolder: "chevyvettez06rgt3",
    logoPath: "/assets/brand/logos/logo-chevy.svg",
    notes: "Líneas angulosas con tomas laterales en boomerang; ideal para acentos neón.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "ferrari296gt3",
    name: "Ferrari 296 GT3",
    brand: "Ferrari",
    category: "GT3",
    iracingFolder: "ferrari296gt3",
    logoPath: "/assets/brand/logos/logo-ferrari.svg",
    notes: "Frontal afilado y paso de rueda marcado; placas de dorsal centradas en puerta.",
    defaultZones: makeBaseZones({
      hood: { x: 0.32, y: 0.06, w: 0.36, h: 0.23 },
      frontBumper: { x: 0.24, y: 0.58, w: 0.52, h: 0.11 },
    }),
  },
  {
    id: "fordmustanggt3",
    name: "Ford Mustang GT3",
    brand: "Ford",
    category: "GT3",
    iracingFolder: "fordmustanggt3",
    logoPath: "/assets/brand/logos/logo-ford.svg",
    notes: "Capó largo y ancho ideal para el emblema MMT grande; laterales altos.",
    defaultZones: makeBaseZones({
      hood: { x: 0.28, y: 0.05, w: 0.44, h: 0.27 },
      roof: { x: 0.35, y: 0.35, w: 0.30, h: 0.20 },
    }),
  },
  {
    id: "lamborghinievogt3",
    name: "Lamborghini Huracán GT3 EVO",
    brand: "Lamborghini",
    category: "GT3",
    iracingFolder: "lamborghinievogt3",
    logoPath: "/assets/brand/logos/logo-lambo.svg",
    notes: "Geometría angular; las líneas diagonales siguen muy bien las aristas del capó.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "mclaren720sgt3",
    name: "McLaren 720S GT3 EVO",
    brand: "McLaren",
    category: "GT3",
    iracingFolder: "mclaren720sgt3",
    logoPath: "/assets/brand/logos/logo-mclaren.svg",
    notes: "Laterales esculpidos con tomas de aire; mantener logos por encima del corte de puerta.",
    defaultZones: makeBaseZones({
      leftSide: { x: 0.03, y: 0.30, w: 0.27, h: 0.45 },
      rightSide: { x: 0.70, y: 0.30, w: 0.27, h: 0.45 },
    }),
  },
  {
    id: "mercedesamggt3",
    name: "Mercedes-AMG GT3 2020",
    brand: "Mercedes-AMG",
    category: "GT3",
    iracingFolder: "mercedesamggt3",
    logoPath: "/assets/brand/logos/logo-mercedes.svg",
    notes: "Capó muy largo con rejillas; evitar texto pequeño sobre las branquias.",
    defaultZones: makeBaseZones({ hood: { x: 0.28, y: 0.04, w: 0.44, h: 0.28 } }),
  },
  {
    id: "porsche992rgt3",
    name: "Porsche 911 GT3 R (992)",
    brand: "Porsche",
    category: "GT3",
    iracingFolder: "porsche992rgt3",
    logoPath: "/assets/brand/logos/logo-porsche.svg",
    notes: "Capó inclinado con entrada central; alerón swan-neck en zona inferior del UV.",
    defaultZones: makeBaseZones({
      hood: { x: 0.31, y: 0.05, w: 0.38, h: 0.25 },
      rearWing: { x: 0.26, y: 0.81, w: 0.48, h: 0.11 },
    }),
  },

  // ─── GTP / Hypercar ───
  {
    id: "acuraarx06gtp",
    name: "Acura ARX-06 GTP",
    brand: "Acura",
    category: "GTP / Hypercar",
    iracingFolder: "acuraarx06gtp",
    logoPath: "/assets/brand/logos/logo-acura.svg",
    notes: "Prototipo LMDh con aleta de tiburón amplia para sponsors principales.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "bmwlmdh",
    name: "BMW M Hybrid V8",
    brand: "BMW",
    category: "GTP / Hypercar",
    iracingFolder: "bmwlmdh",
    logoPath: "/assets/brand/logos/logo-bmw.svg",
    notes: "Pontones largos y limpios; excelente superficie superior en morro.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "cadillacvseriesrgtp",
    name: "Cadillac V-Series.R GTP",
    brand: "Cadillac",
    category: "GTP / Hypercar",
    iracingFolder: "cadillacvseriesrgtp",
    logoPath: "/assets/brand/logos/logo-cadillac.svg",
    notes: "Aristas marcadas en pontones y aleta trasera alta.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "ferrari499p",
    name: "Ferrari 499P",
    brand: "Ferrari",
    category: "GTP / Hypercar",
    iracingFolder: "ferrari499p",
    logoPath: "/assets/brand/logos/logo-ferrari.svg",
    notes: "Hypercar LMH con doble plano trasero y gran superficie en aleta central.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "porsche963gtp",
    name: "Porsche 963 GTP",
    brand: "Porsche",
    category: "GTP / Hypercar",
    iracingFolder: "porsche963gtp",
    logoPath: "/assets/brand/logos/logo-porsche.svg",
    notes: "Prototipo LMDh oficial de resistencia; gran visibilidad en cubierta motor.",
    defaultZones: makeBaseZones(),
  },

  // ─── LMP2 / LMP3 ───
  {
    id: "dallarap217",
    name: "Dallara P217 LMP2",
    brand: "Dallara",
    category: "LMP2 / LMP3",
    iracingFolder: "dallarap217",
    logoPath: "/assets/brand/logos/logo-dallara.svg",
    notes: "Prototipo LMP2; cuidar la unión del morro y la aleta dorsal.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "ligierjsp320",
    name: "Ligier JS P320 LMP3",
    brand: "Ligier",
    category: "LMP2 / LMP3",
    iracingFolder: "ligierjsp320",
    logoPath: "/assets/brand/logos/logo-ligier.svg",
    notes: "Prototipo LMP3 con pasos de rueda amplios para dorsales y sponsors.",
    defaultZones: makeBaseZones(),
  },

  // ─── GT4 & Cup ───
  {
    id: "amvantagegt4",
    name: "Aston Martin Vantage GT4",
    brand: "Aston Martin",
    category: "GT4 & Cup",
    iracingFolder: "amvantagegt4",
    logoPath: "/assets/brand/logos/logo-aston.svg",
    notes: "GT4 de líneas limpias con capó amplio.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "bmwm4g82gt4",
    name: "BMW M4 G82 GT4",
    brand: "BMW",
    category: "GT4 & Cup",
    iracingFolder: "bmwm4g82gt4",
    logoPath: "/assets/brand/logos/logo-bmw.svg",
    notes: "GT4 muy equilibrado para franjas laterales y dorsales grandes.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "mercedesamggt4",
    name: "Mercedes-AMG GT4",
    brand: "Mercedes-AMG",
    category: "GT4 & Cup",
    iracingFolder: "mercedesamggt4",
    logoPath: "/assets/brand/logos/logo-mercedes.svg",
    notes: "Capó largo estilo GT3 con laterales muy limpios.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "porsche718gt4",
    name: "Porsche 718 Cayman GT4 Clubsport MR",
    brand: "Porsche",
    category: "GT4 & Cup",
    iracingFolder: "porsche718gt4",
    logoPath: "/assets/brand/logos/logo-porsche.svg",
    notes: "Compacto y estilizado; mantener sponsors centrados en puertas.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "porsche992cup",
    name: "Porsche 911 GT3 Cup (992)",
    brand: "Porsche",
    category: "GT4 & Cup",
    iracingFolder: "porsche992cup",
    logoPath: "/assets/brand/logos/logo-porsche.svg",
    notes: "Monomarca 992 Cup; ideal para decoraciones limpias de alta visibilidad.",
    defaultZones: makeBaseZones(),
  },

  // ─── Fórmula ───
  {
    id: "dallaraf3",
    name: "Dallara F3",
    brand: "Dallara",
    category: "Fórmula",
    iracingFolder: "dallaraf3",
    logoPath: "/assets/brand/logos/logo-dallara.svg",
    notes: "Monoplaza con pontones largos y cubierta motor estrecha.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "formulair04",
    name: "FIA F4",
    brand: "FIA",
    category: "Fórmula",
    iracingFolder: "formulair04",
    logoPath: "/assets/brand/logos/logo-fia.svg",
    notes: "Fórmula 4 con morro limpio para escudo MMT y dorsal frontal.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "superformulalights324",
    name: "Super Formula Lights (324)",
    brand: "Dallara",
    category: "Fórmula",
    iracingFolder: "superformulalights324",
    logoPath: "/assets/brand/logos/logo-dallara.svg",
    notes: "Halo y pontones modernos ideales para sponsors largos.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "superformulasf23",
    name: "Super Formula SF23",
    brand: "Toyota / Honda",
    category: "Fórmula",
    iracingFolder: "superformulasf23",
    logoPath: "/assets/brand/logos/logo-toyota.svg",
    notes: "Monoplaza de alta carga con gran superficie en cubierta motor y alerón.",
    defaultZones: makeBaseZones(),
  },

  // ─── TCR & Producción ───
  {
    id: "hyundaielantrantc",
    name: "Hyundai Elantra N TC",
    brand: "Hyundai",
    category: "TCR & Producción",
    iracingFolder: "hyundaielantrantc",
    logoPath: "/assets/brand/logos/logo-hyundai.svg",
    notes: "Turismo TCR con laterales altos y techo muy visible.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "mx5",
    name: "Mazda MX-5 Cup",
    brand: "Mazda",
    category: "TCR & Producción",
    iracingFolder: "mx5 mx52016",
    logoPath: "/assets/brand/logos/logo-mazda.svg",
    notes: "Descapotable compacto; gran visibilidad en capó y pasos de rueda.",
    defaultZones: makeBaseZones(),
  },
  {
    id: "toyotagr86",
    name: "Toyota GR86",
    brand: "Toyota",
    category: "TCR & Producción",
    iracingFolder: "toyotagr86",
    logoPath: "/assets/brand/logos/logo-toyota.svg",
    notes: "Coupé ligero ideal para franjas limpias y sponsors laterales.",
    defaultZones: makeBaseZones(),
  },
];

export const DRIVER_PROFILES: DriverProfile[] = [
  { id: "albertot", name: "Alberto Trujillo", shortName: "TRUJILLO", number: "16", customerId: "994512", nationality: "ESP", accentHex: "#10b981" },
  { id: "mateob", name: "Mateo Berbis", shortName: "BERBIS", number: "1", customerId: "1012480", nationality: "ESP", accentHex: "#38bdf8" },
  { id: "eduardoc", name: "Eduardo Chongkan", shortName: "CHONGKAN", number: "22", customerId: "1048215", nationality: "ESP", accentHex: "#f59e0b" },
  { id: "juanluc", name: "Juanlu Carrillo", shortName: "CARRILLO", number: "44", customerId: "1084320", nationality: "ESP", accentHex: "#22c55e" },
  { id: "custom", name: "Piloto Personalizado", shortName: "MMT", number: "77", customerId: "123456", nationality: "ESP", accentHex: "#10b981" },
];

export const SKIN_PRESETS: PresetDefinition[] = [
  {
    id: "endurance",
    name: "MMT Endurance",
    tagline: "Base grafito, flechas esmeralda MMT y techo de alta visibilidad",
    palette: {
      primary: "#0d131a",
      secondary: "#18222e",
      accent: "#00e699",
      detail: "#f8fafc",
      numberColor: "#090b0f",
      numberBg: "#f8fafc",
    },
    spec: { finish: "satin", metallic: 28, roughness: 34, clearcoat: 72, carbonAccent: true },
    fontStyle: "racing-bold",
  },
  {
    id: "sprint",
    name: "MMT Sprint",
    tagline: "Contraste agresivo blanco glaciar + esmeralda + negro competición",
    palette: {
      primary: "#f1f5f9",
      secondary: "#0f172a",
      accent: "#10b981",
      detail: "#020617",
      numberColor: "#ffffff",
      numberBg: "#0f172a",
    },
    spec: { finish: "gloss", metallic: 12, roughness: 14, clearcoat: 92, carbonAccent: false },
    fontStyle: "condensed-gt",
  },
  {
    id: "carbon-stealth",
    name: "Carbono / Oscuro",
    tagline: "Fibra de carbono expuesta con filos neón verde y acentos metálicos",
    palette: {
      primary: "#090b0f",
      secondary: "#141923",
      accent: "#00ff9d",
      detail: "#38bdf8",
      numberColor: "#00ff9d",
      numberBg: "#090b0f",
    },
    spec: { finish: "carbon", metallic: 42, roughness: 48, clearcoat: 55, carbonAccent: true },
    fontStyle: "mono-tech",
  },
  {
    id: "tricolor",
    name: "Tricolor Motorsport",
    tagline: "Franjas diagonales clásicas de fábrica adaptadas a Muntrume",
    palette: {
      primary: "#111827",
      secondary: "#047857",
      accent: "#38bdf8",
      detail: "#f8fafc",
      numberColor: "#090b0f",
      numberBg: "#f8fafc",
    },
    spec: { finish: "metallic", metallic: 68, roughness: 24, clearcoat: 88, carbonAccent: false },
    fontStyle: "racing-bold",
  },
  {
    id: "clean-minimal",
    name: "Limpio Minimal",
    tagline: "Diseño sobrio de escudería oficial con acentos finos y máxima legibilidad",
    palette: {
      primary: "#131a22",
      secondary: "#1e293b",
      accent: "#10b981",
      detail: "#e2e8f0",
      numberColor: "#090b0f",
      numberBg: "#e2e8f0",
    },
    spec: { finish: "matte", metallic: 10, roughness: 78, clearcoat: 20, carbonAccent: false },
    fontStyle: "condensed-gt",
  },
];

export interface BuiltinDecalAsset {
  id: string;
  label: string;
  svg: (color: string) => string;
}

export const BUILTIN_DECALS: BuiltinDecalAsset[] = [
  {
    id: "mmt-wordmark",
    label: "MUNTRUME Wordmark",
    svg: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 90"><rect x="6" y="14" width="12" height="62" rx="2" fill="#00e699"/><text x="32" y="64" fill="${c}" font-family="Inter,Segoe UI,Arial,sans-serif" font-weight="900" font-size="52" letter-spacing="4">MUNTRUME</text></svg>`,
  },
  {
    id: "mmt-crest",
    label: "MMT Shield Crest",
    svg: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220"><path d="M110 14 L196 48 V116 C196 164 156 196 110 208 C64 196 24 164 24 116 V48 Z" fill="#090d12" stroke="#00e699" stroke-width="10"/><path d="M58 148 V76 L88 118 L110 86 L132 118 L162 76 V148" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "muntru-url",
    label: "MUNTRU.ME Domain",
    svg: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 70"><text x="190" y="50" text-anchor="middle" fill="${c}" font-family="Inter,Segoe UI,Arial,sans-serif" font-weight="800" font-size="42" letter-spacing="6">MUNTRU.ME</text></svg>`,
  },
  {
    id: "atm-labs",
    label: "ATM Software Labs",
    svg: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 72"><rect x="4" y="10" width="66" height="52" rx="8" fill="#00e699"/><text x="37" y="47" text-anchor="middle" fill="#090b0f" font-family="Inter,Arial,sans-serif" font-weight="900" font-size="28">ATM</text><text x="84" y="46" fill="${c}" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="26" letter-spacing="3">SOFTWARE LABS</text></svg>`,
  },
  {
    id: "mmt-stripe-chevron",
    label: "Chevrons MMT",
    svg: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90"><polygon points="20,80 70,10 110,10 60,80" fill="${c}"/><polygon points="95,80 145,10 185,10 135,80" fill="${c}" opacity="0.8"/><polygon points="170,80 220,10 260,10 210,80" fill="${c}" opacity="0.55"/></svg>`,
  },
];

export function cloneZones(zones: Record<ZoneKey, ZoneRect>): Record<ZoneKey, ZoneRect> {
  const out = {} as Record<ZoneKey, ZoneRect>;
  for (const [k, v] of Object.entries(zones)) {
    out[k as ZoneKey] = { ...v };
  }
  return out;
}

export function createDefaultDecals(): DecalLayer[] {
  return [
    {
      id: "decal-hood-crest",
      name: "Escudo MMT Capó",
      kind: "builtin",
      assetId: "mmt-crest",
      color: "#f8fafc",
      x: 0.5,
      y: 0.17,
      scale: 0.14,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
      zoneHint: "hood",
    },
    {
      id: "decal-side-wordmark",
      name: "MUNTRUME Lateral",
      kind: "builtin",
      assetId: "mmt-wordmark",
      color: "#f8fafc",
      x: 0.165,
      y: 0.65,
      scale: 0.22,
      rotation: 0,
      opacity: 0.96,
      mirrorX: true,
      zoneHint: "leftSide",
    },
    {
      id: "decal-wing-url",
      name: "MUNTRU.ME Alerón",
      kind: "builtin",
      assetId: "muntru-url",
      color: "#090b0f",
      x: 0.5,
      y: 0.86,
      scale: 0.30,
      rotation: 0,
      opacity: 1,
      mirrorX: false,
      zoneHint: "rearWing",
    },
  ];
}

export function createInitialDesign(carId = "porsche992rgt3", driverId = "albertot", presetId: PresetDefinition["id"] = "freeform"): SkinDesignState {
  const car = CAR_PROFILES.find((c) => c.id === carId) ?? CAR_PROFILES[0];
  const driver = DRIVER_PROFILES.find((d) => d.id === driverId) ?? DRIVER_PROFILES[0];
  const preset = SKIN_PRESETS.find((p) => p.id === presetId) ?? SKIN_PRESETS[0];

  return {
    version: 2,
    name: `MMT · ${car.name} #${driver.number}`,
    carId: car.id,
    driverId: driver.id,
    customDriverName: driver.name,
    customNumber: driver.number,
    customerId: driver.customerId,
    resolution: 2048,
    pattern: "freeform",
    palette: { ...preset.palette },
    spec: { ...preset.spec, carbonAccent: false },
    fontStyle: preset.fontStyle,
    showNumberOnCar: false,
    zones: cloneZones(car.defaultZones),
    decals: [],
    strokes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function getCarById(id: string): CarProfile {
  return CAR_PROFILES.find((c) => c.id === id) ?? CAR_PROFILES[0];
}

export function getDriverById(id: string): DriverProfile {
  return DRIVER_PROFILES.find((d) => d.id === id) ?? DRIVER_PROFILES[0];
}
