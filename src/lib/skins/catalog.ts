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

export const CAR_PROFILES: CarProfile[] = [
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
    id: "audir8lmsevo2gt3",
    name: "Audi R8 LMS EVO II GT3",
    brand: "Audi",
    category: "GT3",
    iracingFolder: "audir8lmsevo2gt3",
    logoPath: "/assets/brand/logos/logo-audi.svg",
    notes: "Sideblade lateral muy reconocible para acentos en verde MMT o carbono.",
    defaultZones: makeBaseZones({
      mirrors: { x: 0.06, y: 0.09, w: 0.17, h: 0.09 },
    }),
  },
  {
    id: "bmwm4gt3",
    name: "BMW M4 GT3",
    brand: "BMW",
    category: "GT3",
    iracingFolder: "bmwm4gt3",
    logoPath: "/assets/brand/logos/logo-bmw.svg",
    notes: "Laterales muy limpios y planos, excelentes para franjas diagonales y sponsors.",
    defaultZones: makeBaseZones({
      hood: { x: 0.29, y: 0.05, w: 0.42, h: 0.26 },
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
    defaultZones: makeBaseZones({
      hood: { x: 0.28, y: 0.04, w: 0.44, h: 0.28 },
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

export function createInitialDesign(carId = "porsche992rgt3", driverId = "albertot", presetId: PresetDefinition["id"] = "endurance"): SkinDesignState {
  const car = CAR_PROFILES.find((c) => c.id === carId) ?? CAR_PROFILES[0];
  const driver = DRIVER_PROFILES.find((d) => d.id === driverId) ?? DRIVER_PROFILES[0];
  const preset = SKIN_PRESETS.find((p) => p.id === presetId) ?? SKIN_PRESETS[0];

  return {
    version: 1,
    name: `${preset.name} · ${car.brand} #${driver.number}`,
    carId: car.id,
    driverId: driver.id,
    customDriverName: driver.name,
    customNumber: driver.number,
    customerId: driver.customerId,
    resolution: 2048,
    pattern: preset.id,
    palette: { ...preset.palette },
    spec: { ...preset.spec },
    fontStyle: preset.fontStyle,
    showNumberOnCar: true,
    zones: cloneZones(car.defaultZones),
    decals: createDefaultDecals(),
    updatedAt: new Date().toISOString(),
  };
}

export function getCarById(id: string): CarProfile {
  return CAR_PROFILES.find((c) => c.id === id) ?? CAR_PROFILES[0];
}

export function getDriverById(id: string): DriverProfile {
  return DRIVER_PROFILES.find((d) => d.id === id) ?? DRIVER_PROFILES[0];
}
