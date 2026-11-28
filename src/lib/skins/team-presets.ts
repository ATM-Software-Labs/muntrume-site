import type {
  DecalLayer,
  PaletteConfig,
  PatternStyle,
  SkinDesignState,
  SpecConfig,
  ZoneKey,
  ZoneRect,
} from "./types";

export type TeamSlotId =
  | "hood_main"
  | "doors_side"
  | "rear_wing"
  | "rear_bumper"
  | "front_splitter_fenders"
  | "roof_banner"
  | "side_skirts"
  | "safety_fia";

export type MmtBrandStyle = "modern" | "classic";

export interface TeamSlotCoord {
  /** Normalized center X (0..1) on the UV map */
  u: number;
  /** Normalized center Y (0..1) on the UV map */
  v: number;
  /** Normalized target width (0..1) */
  width: number;
  /** Normalized target height (0..1) */
  height: number;
  /** Rotation in degrees for primary placement */
  rotation: number;
  /** Optional paired opposite-side placement (e.g., right door 180° so text never renders backwards) */
  pair?: {
    u: number;
    v: number;
    rotation: number;
    zoneHint: ZoneKey;
  };
  zoneHint: ZoneKey;
}

export interface TeamSlotMeta {
  id: TeamSlotId;
  label: string;
  shortLabel: string;
  description: string;
  defaultColor: string;
}

export const TEAM_SLOT_ORDER: TeamSlotId[] = [
  "hood_main",
  "doors_side",
  "rear_wing",
  "rear_bumper",
  "front_splitter_fenders",
  "roof_banner",
  "side_skirts",
  "safety_fia",
];

export const TEAM_SLOT_META: Record<TeamSlotId, TeamSlotMeta> = {
  hood_main: {
    id: "hood_main",
    label: "Capó Principal",
    shortLabel: "Capó",
    description: "Logo principal de Muntrume Motorsport (MMT) centrado en el capó",
    defaultColor: "#ffffff",
  },
  doors_side: {
    id: "doors_side",
    label: "Puertas Izq. / Der.",
    shortLabel: "Puertas L/R",
    description: "Logo principal en ambos laterales (0° izq. / 180° der., sin texto invertido)",
    defaultColor: "#ffffff",
  },
  rear_wing: {
    id: "rear_wing",
    label: "Alerón Trasero",
    shortLabel: "Alerón",
    description: "Plano superior del alerón trasero (MMT / muntru.me)",
    defaultColor: "#ffffff",
  },
  rear_bumper: {
    id: "rear_bumper",
    label: "Paragolpes Trasero",
    shortLabel: "Trasera",
    description: "URL oficial muntru.me centrada y legible en la trasera",
    defaultColor: "#ffffff",
  },
  front_splitter_fenders: {
    id: "front_splitter_fenders",
    label: "Aletas Del. / Frontal",
    shortLabel: "Aletas / Front",
    description: "Slots de sponsors técnicos en aletas delanteras y parachoques frontal",
    defaultColor: "#ffffff",
  },
  roof_banner: {
    id: "roof_banner",
    label: "Techo / Banner",
    shortLabel: "Techo",
    description: "Logo superior, bandera o marca sobre el techo",
    defaultColor: "#ffffff",
  },
  side_skirts: {
    id: "side_skirts",
    label: "Faldones / Taloneras L/R",
    shortLabel: "Faldones L/R",
    description: "Sponsors técnicos inferiores en ambos faldones (0° izq. / 180° der.)",
    defaultColor: "#ffffff",
  },
  safety_fia: {
    id: "safety_fia",
    label: "Clase / Seguridad FIA",
    shortLabel: "Clase / FIA",
    description: "Distintivo de categoría (GT3 PRO, 24H, TOW) en morro/aleta",
    defaultColor: "#ffffff",
  },
};

export interface QuickSlotAsset {
  id: string;
  label: string;
  shortLabel: string;
  category: "mmt" | "web" | "sponsor";
  /** Either a builtin decal id or an SVG/PNG path */
  kind: "builtin" | "svg-path";
  assetId?: string;
  src?: string;
  defaultColor: string;
  /** Visual preview tint on dark UI */
  previewBg?: string;
}

export const QUICK_SLOT_ASSETS: QuickSlotAsset[] = [
  {
    id: "slot-mmt-escudo",
    label: "Escudo MMT Vector",
    shortLabel: "Escudo MMT",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-escudo-vector.svg",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-classic-logo",
    label: "Logo Clásico MMT (Original)",
    shortLabel: "Clásico MMT",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/img/logo.png",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-classic-crest",
    label: "Escudo Heráldico Clásico",
    shortLabel: "Heráldico",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/brand/muntrume-escudo-heraldico.jpg",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-classic-icon",
    label: "Icono Clásico MMT 512",
    shortLabel: "Icono Clásico",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/img/icon-512.png",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-classic-press",
    label: "Cabecera Prensa Clásica",
    shortLabel: "Prensa MMT",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/img/email-logo.png",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-crest",
    label: "Escudo MMT Vector (Tint)",
    shortLabel: "Crest MMT",
    category: "mmt",
    kind: "builtin",
    assetId: "mmt-crest",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-wordmark-white",
    label: "MUNTRUME Blanco",
    shortLabel: "MMT Blanco",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-wordmark-light.svg",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-wordmark-dark",
    label: "MUNTRUME Negro",
    shortLabel: "MMT Negro",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-wordmark-dark.svg",
    defaultColor: "#090b0f",
    previewBg: "#e2e8f0",
  },
  {
    id: "slot-mmt-wordmark-tint",
    label: "MUNTRUME Wordmark (Color)",
    shortLabel: "Wordmark",
    category: "mmt",
    kind: "builtin",
    assetId: "mmt-wordmark",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-mono-white",
    label: "Monograma MMT Blanco",
    shortLabel: "Mono Blanco",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-mono-white.svg",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-monogram",
    label: "Monograma MTM",
    shortLabel: "MTM",
    category: "mmt",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-monogram-mtm.svg",
    defaultColor: "#00e699",
  },
  {
    id: "slot-muntru-url-white",
    label: "muntru.me Blanco",
    shortLabel: "muntru.me (B)",
    category: "web",
    kind: "builtin",
    assetId: "muntru-url",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-muntru-url-emerald",
    label: "muntru.me Esmeralda",
    shortLabel: "muntru.me (V)",
    category: "web",
    kind: "builtin",
    assetId: "muntru-url",
    defaultColor: "#00e699",
  },
  {
    id: "slot-muntru-url-dark",
    label: "muntru.me Negro",
    shortLabel: "muntru.me (N)",
    category: "web",
    kind: "builtin",
    assetId: "muntru-url",
    defaultColor: "#090b0f",
    previewBg: "#e2e8f0",
  },
  {
    id: "slot-atm-labs",
    label: "ATM Software Labs",
    shortLabel: "ATM Labs",
    category: "sponsor",
    kind: "builtin",
    assetId: "atm-labs",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-telemetry",
    label: "Badge Telemetría MMT",
    shortLabel: "Telemetría",
    category: "sponsor",
    kind: "svg-path",
    src: "/assets/skins/team/muntrume-telemetry-badge.svg",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-mmt-chevrons",
    label: "Chevrons MMT Racing",
    shortLabel: "Chevrons",
    category: "sponsor",
    kind: "builtin",
    assetId: "mmt-stripe-chevron",
    defaultColor: "#00e699",
  },
  {
    id: "slot-fia-tow",
    label: "TOW Remolque FIA",
    shortLabel: "TOW FIA",
    category: "sponsor",
    kind: "builtin",
    assetId: "fia-tow-arrow",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-fia-fire",
    label: "Extintor FIA (E)",
    shortLabel: "Extintor E",
    category: "sponsor",
    kind: "builtin",
    assetId: "fia-fire-e",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-fia-power",
    label: "Corta-corrientes FIA",
    shortLabel: "Power Cut",
    category: "sponsor",
    kind: "builtin",
    assetId: "fia-power-cut",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-class-gt3",
    label: "Placa GT3 PRO",
    shortLabel: "GT3 PRO",
    category: "sponsor",
    kind: "builtin",
    assetId: "class-gt3-pro",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-class-24h",
    label: "Badge 24H Endurance",
    shortLabel: "24H Enduro",
    category: "sponsor",
    kind: "builtin",
    assetId: "class-24h-enduro",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-aero-labs",
    label: "AERO LABS Composites",
    shortLabel: "Aero Labs",
    category: "sponsor",
    kind: "builtin",
    assetId: "tech-aero-labs",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-apex-tires",
    label: "APEX Compound Tires",
    shortLabel: "Apex Tires",
    category: "sponsor",
    kind: "builtin",
    assetId: "tech-slick-grip",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-telemetry-pro",
    label: "TELEMETRY PRO Data",
    shortLabel: "Telemetría+",
    category: "sponsor",
    kind: "builtin",
    assetId: "tech-telemetry-pro",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-octane-fuel",
    label: "OCTANE 102 Race Fuel",
    shortLabel: "Octane 102",
    category: "sponsor",
    kind: "builtin",
    assetId: "tech-race-fuel",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-flag-esp",
    label: "Bandera España (ESP)",
    shortLabel: "ESP 🇪🇸",
    category: "sponsor",
    kind: "builtin",
    assetId: "flag-esp",
    defaultColor: "#ffffff",
  },
  {
    id: "slot-flag-eu",
    label: "Bandera Europa (EU)",
    shortLabel: "EU 🇪🇺",
    category: "sponsor",
    kind: "builtin",
    assetId: "flag-eu",
    defaultColor: "#ffffff",
  },
];

/**
 * Pixel-calibrated per-car UV layout coordinates (normalized 0..1) verified against real 2048x2048
 * iRacing paint templates and active Muntrume Motorsport skins (`mis_skins_reales_993381`).
 * Any car not listed falls back to `resolveTeamLayoutForCar()`.
 */
export const TEAM_LAYOUT_ZONES: Record<string, Partial<Record<TeamSlotId, TeamSlotCoord>>> = {
  porsche992rgt3: {
    hood_main: { u: 0.16, v: 0.635, width: 0.13, height: 0.13, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.57,
      v: 0.89,
      width: 0.22,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.57, v: 0.37, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.19, v: 0.055, width: 0.26, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.70, v: 0.09, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.08, v: 0.635, width: 0.10, height: 0.04, rotation: 90, zoneHint: "frontBumper" },
    roof_banner: { u: 0.62, v: 0.635, width: 0.16, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.68,
      v: 0.96,
      width: 0.12,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.68, v: 0.305, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.34, v: 0.52, width: 0.055, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  bmwm4gt3: {
    hood_main: { u: 0.25, v: 0.65, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.56,
      v: 0.89,
      width: 0.20,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.56, v: 0.37, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.835, v: 0.185, width: 0.24, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.90, v: 0.65, width: 0.12, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.055,
      v: 0.53,
      width: 0.09,
      height: 0.04,
      rotation: 90,
      zoneHint: "frontBumper",
      pair: { u: 0.055, v: 0.77, rotation: 90, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.60, v: 0.65, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.56,
      v: 0.955,
      width: 0.15,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.56, v: 0.31, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.36, v: 0.52, width: 0.055, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  ferrari296gt3: {
    hood_main: { u: 0.17, v: 0.50, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.54,
      v: 0.805,
      width: 0.26,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.54, v: 0.195, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.84, v: 0.915, width: 0.24, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.935, v: 0.50, width: 0.13, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.78,
      v: 0.74,
      width: 0.11,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.78, v: 0.26, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.52, v: 0.50, width: 0.14, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.52,
      v: 0.865,
      width: 0.18,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.135, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.51, v: 0.59, width: 0.06, height: 0.04, rotation: 0, zoneHint: "hood" },
  },
  mclaren720sgt3: {
    hood_main: { u: 0.12, v: 0.585, width: 0.11, height: 0.11, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.57,
      v: 0.85,
      width: 0.20,
      height: 0.07,
      rotation: -18,
      zoneHint: "leftSide",
      pair: { u: 0.57, v: 0.315, rotation: 162, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.16, v: 0.115, width: 0.24, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.695, v: 0.105, width: 0.13, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.28,
      v: 0.72,
      width: 0.075,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.28, v: 0.45, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.55, v: 0.585, width: 0.15, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.625,
      v: 0.945,
      width: 0.13,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.625, v: 0.23, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.875, v: 0.585, width: 0.09, height: 0.045, rotation: 90, zoneHint: "rearBumper" },
  },
  mercedesamggt3: {
    hood_main: { u: 0.19, v: 0.65, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.52,
      v: 0.90,
      width: 0.22,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.39, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.17, v: 0.035, width: 0.22, height: 0.06, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.57, v: 0.08, width: 0.16, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.28, v: 0.22, width: 0.11, height: 0.045, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.49, v: 0.65, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.45,
      v: 0.965,
      width: 0.14,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.45, v: 0.325, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.31, v: 0.23, width: 0.06, height: 0.04, rotation: 0, zoneHint: "frontBumper" },
  },
  lamborghinievogt3: {
    hood_main: { u: 0.20, v: 0.67, width: 0.14, height: 0.14, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.52,
      v: 0.915,
      width: 0.22,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.425, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.17, v: 0.04, width: 0.24, height: 0.065, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.54, v: 0.07, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.045, v: 0.67, width: 0.10, height: 0.04, rotation: 90, zoneHint: "frontBumper" },
    roof_banner: { u: 0.54, v: 0.67, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.52,
      v: 0.965,
      width: 0.15,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.375, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.39, v: 0.67, width: 0.08, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  fordmustanggt3: {
    hood_main: { u: 0.27, v: 0.50, width: 0.16, height: 0.16, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.67,
      v: 0.77,
      width: 0.22,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.67, v: 0.23, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.395, v: 0.025, width: 0.16, height: 0.045, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.93, v: 0.50, width: 0.14, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.085,
      v: 0.34,
      width: 0.09,
      height: 0.04,
      rotation: 90,
      zoneHint: "frontBumper",
      pair: { u: 0.085, v: 0.66, rotation: 90, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.61, v: 0.50, width: 0.17, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.54,
      v: 0.84,
      width: 0.15,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.54, v: 0.16, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: {
      u: 0.81,
      v: 0.855,
      width: 0.07,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.81, v: 0.145, rotation: 180, zoneHint: "rightSide" },
    },
  },
  chevyvettez06rgt3: {
    hood_main: { u: 0.21, v: 0.66, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.62,
      v: 0.92,
      width: 0.22,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.62, v: 0.41, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.51, v: 0.27, width: 0.24, height: 0.06, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.76, v: 0.08, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.20, v: 0.12, width: 0.14, height: 0.045, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.54, v: 0.66, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.58,
      v: 0.97,
      width: 0.15,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.58, v: 0.345, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.93, v: 0.66, width: 0.08, height: 0.04, rotation: 90, zoneHint: "rearBumper" },
  },
  astonmartinvantagegt3: {
    hood_main: { u: 0.19, v: 0.615, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.52,
      v: 0.875,
      width: 0.20,
      height: 0.08,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.355, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.87, v: 0.175, width: 0.20, height: 0.06, rotation: -90, zoneHint: "rearWing" },
    rear_bumper: { u: 0.945, v: 0.615, width: 0.14, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.26, v: 0.08, width: 0.14, height: 0.045, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.575, v: 0.615, width: 0.15, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.50,
      v: 0.96,
      width: 0.14,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.50, v: 0.27, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.85, v: 0.615, width: 0.08, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
  },
  acuransxevo22gt3: {
    hood_main: { u: 0.21, v: 0.635, width: 0.14, height: 0.14, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.50,
      v: 0.915,
      width: 0.20,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.50, v: 0.355, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.82, v: 0.225, width: 0.22, height: 0.06, rotation: 180, zoneHint: "rearWing" },
    rear_bumper: { u: 0.28, v: 0.17, width: 0.16, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.17,
      v: 0.785,
      width: 0.09,
      height: 0.04,
      rotation: 22,
      zoneHint: "frontBumper",
      pair: { u: 0.17, v: 0.485, rotation: 158, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.49, v: 0.635, width: 0.14, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.41,
      v: 0.865,
      width: 0.16,
      height: 0.04,
      rotation: -6,
      zoneHint: "leftSide",
      pair: { u: 0.41, v: 0.405, rotation: 174, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.955, v: 0.635, width: 0.07, height: 0.04, rotation: 90, zoneHint: "rearBumper" },
  },
  audir8lmsevo2gt3: {
    hood_main: { u: 0.18, v: 0.635, width: 0.13, height: 0.13, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.52,
      v: 0.885,
      width: 0.20,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.385, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.47, v: 0.115, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.82, v: 0.25, width: 0.14, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.24, v: 0.185, width: 0.14, height: 0.045, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.50, v: 0.635, width: 0.15, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.52,
      v: 0.955,
      width: 0.15,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.315, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.20, v: 0.74, width: 0.055, height: 0.04, rotation: 0, zoneHint: "hood" },
  },
  ferrari499p: {
    hood_main: { u: 0.115, v: 0.615, width: 0.11, height: 0.11, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.67,
      v: 0.905,
      width: 0.20,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.67, v: 0.325, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.18, v: 0.16, width: 0.24, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.90,
      v: 0.915,
      width: 0.10,
      height: 0.04,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.90, v: 0.315, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: {
      u: 0.13,
      v: 0.73,
      width: 0.10,
      height: 0.04,
      rotation: 55,
      zoneHint: "frontBumper",
      pair: { u: 0.13, v: 0.50, rotation: 125, zoneHint: "frontBumper" },
    },
    roof_banner: {
      u: 0.57,
      v: 0.66,
      width: 0.11,
      height: 0.05,
      rotation: 0,
      zoneHint: "roof",
      pair: { u: 0.57, v: 0.57, rotation: 180, zoneHint: "roof" },
    },
    side_skirts: {
      u: 0.16,
      v: 0.91,
      width: 0.10,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.16, v: 0.315, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.23, v: 0.66, width: 0.055, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  porsche963gtp: {
    hood_main: { u: 0.24, v: 0.54, width: 0.11, height: 0.11, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.67,
      v: 0.94,
      width: 0.22,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.67, v: 0.145, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.07, v: 0.83, width: 0.22, height: 0.06, rotation: 90, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.955,
      v: 0.845,
      width: 0.09,
      height: 0.04,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.955, v: 0.235, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: {
      u: 0.24,
      v: 0.79,
      width: 0.10,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.24, v: 0.295, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.63, v: 0.54, width: 0.12, height: 0.08, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.52,
      v: 0.87,
      width: 0.14,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.21, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.21, v: 0.605, width: 0.055, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  bmwlmdh: {
    hood_main: { u: 0.56, v: 0.545, width: 0.13, height: 0.13, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.64,
      v: 0.83,
      width: 0.20,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.64, v: 0.255, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.23, v: 0.93, width: 0.26, height: 0.07, rotation: 180, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.22,
      v: 0.165,
      width: 0.20,
      height: 0.05,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.21, v: 0.10, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: {
      u: 0.17,
      v: 0.845,
      width: 0.09,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.17, v: 0.245, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.28, v: 0.20, width: 0.14, height: 0.05, rotation: 0, zoneHint: "roof" },
    side_skirts: {
      u: 0.85,
      v: 0.89,
      width: 0.10,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.85, v: 0.20, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.35, v: 0.79, width: 0.06, height: 0.04, rotation: 0, zoneHint: "leftSide" },
  },
  cadillacvseriesrgtp: {
    hood_main: { u: 0.155, v: 0.545, width: 0.10, height: 0.10, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.56,
      v: 0.865,
      width: 0.18,
      height: 0.06,
      rotation: -18,
      zoneHint: "leftSide",
      pair: { u: 0.56, v: 0.225, rotation: 162, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.16, v: 0.935, width: 0.26, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.11, v: 0.035, width: 0.15, height: 0.04, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.20,
      v: 0.645,
      width: 0.10,
      height: 0.04,
      rotation: 165,
      zoneHint: "frontBumper",
      pair: { u: 0.20, v: 0.445, rotation: -15, zoneHint: "frontBumper" },
    },
    roof_banner: {
      u: 0.23,
      v: 0.175,
      width: 0.18,
      height: 0.05,
      rotation: 0,
      zoneHint: "roof",
      pair: { u: 0.23, v: 0.105, rotation: 180, zoneHint: "roof" },
    },
    side_skirts: {
      u: 0.73,
      v: 0.925,
      width: 0.16,
      height: 0.045,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.73, v: 0.165, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.475, v: 0.675, width: 0.05, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
  acuraarx06gtp: {
    hood_main: { u: 0.145, v: 0.525, width: 0.10, height: 0.10, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.58,
      v: 0.84,
      width: 0.18,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.58, v: 0.21, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.26, v: 0.94, width: 0.28, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.84,
      v: 0.555,
      width: 0.18,
      height: 0.05,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.84, v: 0.495, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: {
      u: 0.10,
      v: 0.84,
      width: 0.08,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.10, v: 0.21, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.54, v: 0.525, width: 0.12, height: 0.07, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.75,
      v: 0.78,
      width: 0.12,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.75, v: 0.275, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.38, v: 0.82, width: 0.06, height: 0.04, rotation: 0, zoneHint: "leftSide" },
  },
  dallarap217: {
    hood_main: { u: 0.81, v: 0.50, width: 0.11, height: 0.11, rotation: -90, zoneHint: "hood" },
    doors_side: {
      u: 0.42,
      v: 0.85,
      width: 0.18,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.42, v: 0.15, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.055, v: 0.84, width: 0.20, height: 0.06, rotation: 90, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.30,
      v: 0.54,
      width: 0.18,
      height: 0.05,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.30, v: 0.46, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: {
      u: 0.87,
      v: 0.645,
      width: 0.11,
      height: 0.04,
      rotation: 180,
      zoneHint: "frontBumper",
      pair: { u: 0.87, v: 0.355, rotation: 0, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.68, v: 0.50, width: 0.10, height: 0.06, rotation: -90, zoneHint: "roof" },
    side_skirts: {
      u: 0.36,
      v: 0.795,
      width: 0.12,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.36, v: 0.205, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.855, v: 0.50, width: 0.05, height: 0.04, rotation: -90, zoneHint: "hood" },
  },
  porsche992cup: {
    hood_main: { u: 0.30, v: 0.65, width: 0.16, height: 0.16, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.585,
      v: 0.935,
      width: 0.16,
      height: 0.09,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.585, v: 0.375, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.70, v: 0.075, width: 0.28, height: 0.08, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.675, v: 0.235, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.105, v: 0.65, width: 0.10, height: 0.04, rotation: 90, zoneHint: "frontBumper" },
    roof_banner: { u: 0.625, v: 0.65, width: 0.16, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.455,
      v: 0.905,
      width: 0.10,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.455, v: 0.405, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.375, v: 0.76, width: 0.05, height: 0.04, rotation: 0, zoneHint: "hood" },
  },
  porsche718gt4: {
    hood_main: { u: 0.35, v: 0.62, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.60,
      v: 0.91,
      width: 0.18,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.60, v: 0.33, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.16, v: 0.15, width: 0.22, height: 0.06, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.88, v: 0.055, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.135, v: 0.495, width: 0.10, height: 0.04, rotation: 90, zoneHint: "frontBumper" },
    roof_banner: { u: 0.65, v: 0.62, width: 0.16, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.59,
      v: 0.985,
      width: 0.16,
      height: 0.035,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.59, v: 0.255, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.31, v: 0.71, width: 0.08, height: 0.04, rotation: 15, zoneHint: "hood" },
  },
  bmwm4g82gt4: {
    hood_main: { u: 0.26, v: 0.375, width: 0.14, height: 0.14, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.52,
      v: 0.64,
      width: 0.18,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.52, v: 0.11, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.115, v: 0.84, width: 0.22, height: 0.06, rotation: -90, zoneHint: "rearWing" },
    rear_bumper: { u: 0.92, v: 0.375, width: 0.14, height: 0.05, rotation: 90, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.085,
      v: 0.245,
      width: 0.08,
      height: 0.04,
      rotation: 90,
      zoneHint: "frontBumper",
      pair: { u: 0.085, v: 0.505, rotation: 90, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.56, v: 0.375, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.60,
      v: 0.715,
      width: 0.15,
      height: 0.035,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.60, v: 0.03, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.615, v: 0.535, width: 0.06, height: 0.05, rotation: 90, zoneHint: "roof" },
  },
  mercedesamggt4: {
    hood_main: { u: 0.20, v: 0.595, width: 0.15, height: 0.15, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.465,
      v: 0.86,
      width: 0.22,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.465, v: 0.34, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.68, v: 0.065, width: 0.24, height: 0.07, rotation: 180, zoneHint: "rearWing" },
    rear_bumper: { u: 0.94, v: 0.595, width: 0.14, height: 0.05, rotation: -90, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.25, v: 0.06, width: 0.14, height: 0.045, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.56, v: 0.595, width: 0.16, height: 0.09, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.48,
      v: 0.945,
      width: 0.16,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.48, v: 0.245, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.33, v: 0.73, width: 0.05, height: 0.04, rotation: 0, zoneHint: "hood" },
  },
  formulair04: {
    hood_main: { u: 0.23, v: 0.545, width: 0.11, height: 0.07, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.235,
      v: 0.93,
      width: 0.18,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.235, v: 0.17, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: {
      u: 0.75,
      v: 0.285,
      width: 0.16,
      height: 0.05,
      rotation: 0,
      zoneHint: "rearWing",
      pair: { u: 0.92, v: 0.285, rotation: 0, zoneHint: "rearWing" },
    },
    rear_bumper: { u: 0.59, v: 0.825, width: 0.16, height: 0.06, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.59,
      v: 0.035,
      width: 0.12,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.92, v: 0.035, rotation: 0, zoneHint: "frontBumper" },
    },
    roof_banner: {
      u: 0.74,
      v: 0.595,
      width: 0.14,
      height: 0.06,
      rotation: 0,
      zoneHint: "roof",
      pair: { u: 0.74, v: 0.50, rotation: 180, zoneHint: "roof" },
    },
    side_skirts: {
      u: 0.28,
      v: 0.97,
      width: 0.14,
      height: 0.035,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.28, v: 0.13, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.26, v: 0.735, width: 0.05, height: 0.035, rotation: 0, zoneHint: "hood" },
  },
  dallaraf3: {
    hood_main: { u: 0.70, v: 0.63, width: 0.10, height: 0.07, rotation: -90, zoneHint: "hood" },
    doors_side: {
      u: 0.51,
      v: 0.805,
      width: 0.24,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.51, v: 0.455, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.42, v: 0.09, width: 0.26, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.89, v: 0.11, width: 0.14, height: 0.08, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.11, v: 0.15, width: 0.16, height: 0.06, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.49, v: 0.625, width: 0.18, height: 0.06, rotation: 180, zoneHint: "roof" },
    side_skirts: {
      u: 0.53,
      v: 0.885,
      width: 0.16,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.53, v: 0.375, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.34, v: 0.625, width: 0.05, height: 0.04, rotation: 0, zoneHint: "hood" },
  },
  superformulalights324: {
    hood_main: { u: 0.28, v: 0.50, width: 0.11, height: 0.07, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.55,
      v: 0.78,
      width: 0.20,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.55, v: 0.22, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.16, v: 0.895, width: 0.20, height: 0.06, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.89, v: 0.87, width: 0.16, height: 0.05, rotation: 180, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.06,
      v: 0.695,
      width: 0.09,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.06, v: 0.305, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: {
      u: 0.79,
      v: 0.57,
      width: 0.14,
      height: 0.05,
      rotation: 0,
      zoneHint: "roof",
      pair: { u: 0.79, v: 0.43, rotation: 180, zoneHint: "roof" },
    },
    side_skirts: {
      u: 0.57,
      v: 0.835,
      width: 0.16,
      height: 0.035,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.57, v: 0.165, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.22, v: 0.57, width: 0.045, height: 0.035, rotation: 0, zoneHint: "hood" },
  },
  superformulasf23: {
    hood_main: { u: 0.21, v: 0.50, width: 0.11, height: 0.06, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.54,
      v: 0.805,
      width: 0.20,
      height: 0.06,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.54, v: 0.195, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.10, v: 0.87, width: 0.18, height: 0.06, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: {
      u: 0.68,
      v: 0.525,
      width: 0.15,
      height: 0.05,
      rotation: 0,
      zoneHint: "rearBumper",
      pair: { u: 0.68, v: 0.475, rotation: 180, zoneHint: "rearBumper" },
    },
    front_splitter_fenders: { u: 0.19, v: 0.33, width: 0.14, height: 0.05, rotation: -14, zoneHint: "frontBumper" },
    roof_banner: { u: 0.35, v: 0.50, width: 0.09, height: 0.05, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.35,
      v: 0.555,
      width: 0.12,
      height: 0.035,
      rotation: 10,
      zoneHint: "leftSide",
      pair: { u: 0.35, v: 0.445, rotation: 170, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.11, v: 0.50, width: 0.045, height: 0.035, rotation: 90, zoneHint: "hood" },
  },
  mx5: {
    hood_main: { u: 0.18, v: 0.605, width: 0.18, height: 0.18, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.58,
      v: 0.845,
      width: 0.26,
      height: 0.08,
      rotation: -6,
      zoneHint: "leftSide",
      pair: { u: 0.58, v: 0.365, rotation: 174, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.75, v: 0.20, width: 0.22, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.635, v: 0.545, width: 0.20, height: 0.06, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: { u: 0.295, v: 0.12, width: 0.20, height: 0.06, rotation: 0, zoneHint: "frontBumper" },
    roof_banner: { u: 0.495, v: 0.655, width: 0.14, height: 0.05, rotation: 0, zoneHint: "roof" },
    side_skirts: {
      u: 0.42,
      v: 0.965,
      width: 0.18,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.42, v: 0.25, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: {
      u: 0.19,
      v: 0.82,
      width: 0.08,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.19, v: 0.39, rotation: 180, zoneHint: "rightSide" },
    },
  },
  toyotagr86: {
    hood_main: { u: 0.22, v: 0.59, width: 0.16, height: 0.16, rotation: 90, zoneHint: "hood" },
    doors_side: {
      u: 0.81,
      v: 0.845,
      width: 0.20,
      height: 0.07,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.81, v: 0.35, rotation: 180, zoneHint: "rightSide" },
    },
    rear_wing: { u: 0.73, v: 0.15, width: 0.24, height: 0.07, rotation: 0, zoneHint: "rearWing" },
    rear_bumper: { u: 0.28, v: 0.07, width: 0.18, height: 0.05, rotation: 0, zoneHint: "rearBumper" },
    front_splitter_fenders: {
      u: 0.10,
      v: 0.74,
      width: 0.09,
      height: 0.04,
      rotation: 0,
      zoneHint: "frontBumper",
      pair: { u: 0.10, v: 0.45, rotation: 180, zoneHint: "frontBumper" },
    },
    roof_banner: { u: 0.62, v: 0.59, width: 0.16, height: 0.10, rotation: 90, zoneHint: "roof" },
    side_skirts: {
      u: 0.45,
      v: 0.94,
      width: 0.14,
      height: 0.04,
      rotation: 0,
      zoneHint: "leftSide",
      pair: { u: 0.45, v: 0.255, rotation: 180, zoneHint: "rightSide" },
    },
    safety_fia: { u: 0.34, v: 0.48, width: 0.05, height: 0.04, rotation: 90, zoneHint: "hood" },
  },
};

function clamp01(v: number): number {
  return Math.max(0.02, Math.min(0.98, v));
}

/**
 * Intelligent Auto-Fit fallback: computes exact normalized `(u, v, width, height, rotation)`
 * for every TeamSlotId from any car's active UV zones (`state.zones`), blending with
 * calibrated `TEAM_LAYOUT_ZONES` overrides when available.
 */
export function resolveTeamLayoutForCar(
  carId: string,
  zones: Record<ZoneKey, ZoneRect>,
): Record<TeamSlotId, TeamSlotCoord> {
  const z = zones;
  const hood = z.hood;
  const roof = z.roof;
  const left = z.leftSide;
  const right = z.rightSide;
  const wing = z.rearWing;
  const front = z.frontBumper;
  const rear = z.rearBumper;

  // Detect horizontal iRacing UV layout (nose on left, roof center-right, sides stacked vertically)
  const isHorizontalUv = hood.x + hood.w * 0.5 < roof.x + roof.w * 0.5;
  const topRot = isHorizontalUv ? 90 : 0;
  const wingRot = wing.h > wing.w * 1.25 ? 90 : 0;
  const rearRot = rear.h > rear.w * 1.25 ? 90 : 0;
  const frontRot = front.h > front.w * 1.25 ? 90 : 0;

  const autoFit: Record<TeamSlotId, TeamSlotCoord> = {
    hood_main: {
      u: clamp01(hood.x + hood.w * 0.5),
      v: clamp01(hood.y + hood.h * 0.5),
      width: Number(Math.min(0.18, Math.max(0.08, Math.min(hood.w, hood.h) * 0.48)).toFixed(3)),
      height: Number(Math.min(0.18, Math.max(0.08, Math.min(hood.w, hood.h) * 0.48)).toFixed(3)),
      rotation: topRot,
      zoneHint: "hood",
    },
    doors_side: {
      u: clamp01(left.x + left.w * 0.56),
      v: clamp01(left.y + left.h * 0.52),
      width: Number(Math.min(0.24, Math.max(0.11, left.w * 0.40)).toFixed(3)),
      height: Number(Math.min(0.10, Math.max(0.05, left.h * 0.55)).toFixed(3)),
      rotation: 0,
      zoneHint: "leftSide",
      pair: {
        u: clamp01(right.x + right.w * 0.56),
        v: clamp01(right.y + right.h * 0.48),
        rotation: isHorizontalUv ? 180 : 0,
        zoneHint: "rightSide",
      },
    },
    rear_wing: {
      u: clamp01(wing.x + wing.w * 0.5),
      v: clamp01(wing.y + wing.h * 0.5),
      width: Number(Math.min(0.24, Math.max(0.11, Math.max(wing.w, wing.h) * 0.64)).toFixed(3)),
      height: Number(Math.min(0.09, Math.max(0.04, Math.min(wing.w, wing.h) * 0.55)).toFixed(3)),
      rotation: wingRot,
      zoneHint: "rearWing",
    },
    rear_bumper: {
      u: clamp01(rear.x + rear.w * 0.5),
      v: clamp01(rear.y + rear.h * 0.5),
      width: Number(Math.min(0.18, Math.max(0.09, Math.max(rear.w, rear.h) * 0.38)).toFixed(3)),
      height: Number(Math.min(0.07, Math.max(0.04, Math.min(rear.w, rear.h) * 0.55)).toFixed(3)),
      rotation: rearRot,
      zoneHint: "rearBumper",
    },
    front_splitter_fenders: {
      u: clamp01(front.x + front.w * 0.5),
      v: clamp01(front.y + front.h * 0.5),
      width: Number(Math.min(0.18, Math.max(0.09, Math.max(front.w, front.h) * 0.34)).toFixed(3)),
      height: Number(Math.min(0.07, Math.max(0.04, Math.min(front.w, front.h) * 0.48)).toFixed(3)),
      rotation: frontRot,
      zoneHint: "frontBumper",
    },
    roof_banner: {
      u: clamp01(roof.x + roof.w * 0.5),
      v: clamp01(roof.y + roof.h * 0.35),
      width: Number(Math.min(0.14, Math.max(0.08, Math.min(roof.w, roof.h) * 0.48)).toFixed(3)),
      height: Number(Math.min(0.08, Math.max(0.05, Math.min(roof.w, roof.h) * 0.34)).toFixed(3)),
      rotation: topRot,
      zoneHint: "roof",
    },
    side_skirts: {
      u: clamp01(left.x + left.w * 0.50),
      v: clamp01(left.y + left.h * 0.86),
      width: Number(Math.min(0.17, Math.max(0.09, left.w * 0.30)).toFixed(3)),
      height: Number(Math.min(0.05, Math.max(0.03, left.h * 0.28)).toFixed(3)),
      rotation: 0,
      zoneHint: "leftSide",
      pair: {
        u: clamp01(right.x + right.w * 0.50),
        v: clamp01(right.y + right.h * 0.14),
        rotation: isHorizontalUv ? 180 : 0,
        zoneHint: "rightSide",
      },
    },
    safety_fia: {
      u: clamp01(hood.x + hood.w * 0.24),
      v: clamp01(hood.y + hood.h * 0.78),
      width: 0.065,
      height: 0.045,
      rotation: topRot,
      zoneHint: "hood",
    },
  };

  const specific = TEAM_LAYOUT_ZONES[carId.toLowerCase()];
  if (!specific) return autoFit;
  return {
    hood_main: specific.hood_main ?? autoFit.hood_main,
    doors_side: specific.doors_side ?? autoFit.doors_side,
    rear_wing: specific.rear_wing ?? autoFit.rear_wing,
    rear_bumper: specific.rear_bumper ?? autoFit.rear_bumper,
    front_splitter_fenders: specific.front_splitter_fenders ?? autoFit.front_splitter_fenders,
    roof_banner: specific.roof_banner ?? autoFit.roof_banner,
    side_skirts: specific.side_skirts ?? autoFit.side_skirts,
    safety_fia: specific.safety_fia ?? autoFit.safety_fia,
  };
}

/**
 * Returns rich, category-aware default logos for all 8 slots, adapting automatically to
 * GT3 / GTP / LMP / Cup / TCR / Formula and honoring the user's Modern vs Classic MMT logo style.
 */
export function buildCategoryAwareTeamSlots(
  category: string,
  baseSlots: Partial<Record<TeamSlotId, SlotAssignment>>,
  brandStyle: MmtBrandStyle = "modern",
): Partial<Record<TeamSlotId, SlotAssignment>> {
  const cat = (category || "").toLowerCase();
  const isProto = /gtp|hypercar|lmp/.test(cat);
  const isFormula = /fórmula|formula/.test(cat);
  const isGt3 = /gt3/.test(cat);

  const out: Partial<Record<TeamSlotId, SlotAssignment>> = { ...baseSlots };

  // Honor Classic (paddock/marca original) vs Modern (futuristic SVG) brand logos
  if (brandStyle === "classic") {
    out.hood_main = { assetId: "slot-mmt-classic-logo", color: "#ffffff" };
    out.roof_banner = { assetId: "slot-mmt-classic-icon", color: "#ffffff" };
  }

  // Enrich with category-specific technical sponsors & FIA class badges
  if (isProto) {
    out.front_splitter_fenders = out.front_splitter_fenders ?? { assetId: "slot-telemetry-pro", color: "#ffffff" };
    out.side_skirts = { assetId: "slot-octane-fuel", color: "#ffffff" };
    out.safety_fia = { assetId: "slot-class-24h", color: "#ffffff" };
  } else if (isGt3) {
    out.front_splitter_fenders = out.front_splitter_fenders ?? { assetId: "slot-aero-labs", color: "#ffffff" };
    out.side_skirts = { assetId: "slot-apex-tires", color: "#ffffff" };
    out.safety_fia = { assetId: "slot-class-gt3", color: "#ffffff" };
  } else if (isFormula) {
    out.front_splitter_fenders = { assetId: "slot-telemetry-pro", color: "#ffffff" };
    out.side_skirts = { assetId: "slot-aero-labs", color: "#ffffff" };
    out.safety_fia = { assetId: "slot-fia-tow", color: "#ffffff" };
  } else {
    out.front_splitter_fenders = out.front_splitter_fenders ?? { assetId: "slot-atm-labs", color: "#ffffff" };
    out.side_skirts = { assetId: "slot-apex-tires", color: "#ffffff" };
    out.safety_fia = { assetId: "slot-fia-tow", color: "#ffffff" };
  }
  return out;
}

export interface SlotAssignment {
  assetId: string;
  color?: string;
}

export interface TeamPresetDefinition {
  id: string;
  name: string;
  tagline: string;
  pattern: PatternStyle;
  palette: PaletteConfig;
  spec: SpecConfig;
  fontStyle: SkinDesignState["fontStyle"];
  showNumberOnCar: boolean;
  defaultBrandStyle?: MmtBrandStyle;
  slots: Partial<Record<TeamSlotId, SlotAssignment>>;
}

export const MMT_TEAM_PRESETS: TeamPresetDefinition[] = [
  {
    id: "mmt-official-endurance",
    name: "Muntrume Motorsport (MMT) Oficial",
    tagline: "Identidad oficial MMT: grafito esmeralda satinado, escudos en capó/puertas y muntru.me en alerón/trasera",
    pattern: "pearl-shift",
    palette: {
      primary: "#0f1722",
      secondary: "#1a2c3a",
      accent: "#00e699",
      detail: "#f8fafc",
      numberColor: "#090b0f",
      numberBg: "#f8fafc",
    },
    spec: { finish: "satin", metallic: 28, roughness: 32, clearcoat: 78, carbonAccent: false },
    fontStyle: "racing-bold",
    showNumberOnCar: false,
    defaultBrandStyle: "modern",
    slots: {
      hood_main: { assetId: "slot-mmt-escudo", color: "#ffffff" },
      doors_side: { assetId: "slot-mmt-wordmark-white", color: "#ffffff" },
      rear_wing: { assetId: "slot-muntru-url-white", color: "#ffffff" },
      rear_bumper: { assetId: "slot-muntru-url-emerald", color: "#00e699" },
      front_splitter_fenders: { assetId: "slot-atm-labs", color: "#ffffff" },
      roof_banner: { assetId: "slot-mmt-monogram", color: "#00e699" },
    },
  },
  {
    id: "mmt-classic-green-white",
    name: "MMT Clásico Verde / Blanco",
    tagline: "Esquema clásico oficial Muntrume (verde racing + blanco + negro) con escudo heráldico clásico",
    pattern: "iracing-works-01",
    palette: {
      primary: "#0e8f48",
      secondary: "#f8fafc",
      accent: "#0b0f14",
      detail: "#00e699",
      numberColor: "#090b0f",
      numberBg: "#f8fafc",
    },
    spec: { finish: "gloss", metallic: 16, roughness: 18, clearcoat: 92, carbonAccent: false },
    fontStyle: "racing-bold",
    showNumberOnCar: false,
    defaultBrandStyle: "classic",
    slots: {
      hood_main: { assetId: "slot-mmt-classic-logo", color: "#ffffff" },
      doors_side: { assetId: "slot-mmt-wordmark-white", color: "#ffffff" },
      rear_wing: { assetId: "slot-muntru-url-white", color: "#ffffff" },
      rear_bumper: { assetId: "slot-muntru-url-white", color: "#ffffff" },
      front_splitter_fenders: { assetId: "slot-aero-labs", color: "#ffffff" },
      roof_banner: { assetId: "slot-mmt-classic-icon", color: "#ffffff" },
    },
  },
  {
    id: "mmt-sprint-white",
    name: "MMT Sprint Blanco Glaciar",
    tagline: "Base blanca de alta visibilidad con logos oscuros, acento esmeralda MMT y acabado brillo",
    pattern: "solid-factory",
    palette: {
      primary: "#f1f5f9",
      secondary: "#0f172a",
      accent: "#00e699",
      detail: "#090b0f",
      numberColor: "#ffffff",
      numberBg: "#0f172a",
    },
    spec: { finish: "gloss", metallic: 12, roughness: 14, clearcoat: 94, carbonAccent: false },
    fontStyle: "condensed-gt",
    showNumberOnCar: false,
    defaultBrandStyle: "modern",
    slots: {
      hood_main: { assetId: "slot-mmt-escudo", color: "#090b0f" },
      doors_side: { assetId: "slot-mmt-wordmark-dark", color: "#090b0f" },
      rear_wing: { assetId: "slot-muntru-url-dark", color: "#090b0f" },
      rear_bumper: { assetId: "slot-muntru-url-dark", color: "#090b0f" },
      front_splitter_fenders: { assetId: "slot-mmt-chevrons", color: "#00e699" },
      roof_banner: { assetId: "slot-mmt-monogram", color: "#00e699" },
    },
  },
  {
    id: "mmt-carbon-24h",
    name: "MMT Carbono 24H Endurance",
    tagline: "Fibra de carbono expuesta con detalles esmeralda neón y máxima legibilidad nocturna",
    pattern: "carbon-exposed",
    palette: {
      primary: "#090d14",
      secondary: "#131c28",
      accent: "#00ff9d",
      detail: "#ffffff",
      numberColor: "#090b0f",
      numberBg: "#00ff9d",
    },
    spec: { finish: "carbon", metallic: 40, roughness: 44, clearcoat: 62, carbonAccent: true },
    fontStyle: "mono-tech",
    showNumberOnCar: false,
    defaultBrandStyle: "modern",
    slots: {
      hood_main: { assetId: "slot-mmt-escudo", color: "#ffffff" },
      doors_side: { assetId: "slot-mmt-wordmark-white", color: "#ffffff" },
      rear_wing: { assetId: "slot-muntru-url-emerald", color: "#00ff9d" },
      rear_bumper: { assetId: "slot-muntru-url-white", color: "#ffffff" },
      front_splitter_fenders: { assetId: "slot-mmt-telemetry", color: "#ffffff" },
      roof_banner: { assetId: "slot-mmt-mono-white", color: "#ffffff" },
    },
  },
];

export const SLOT_DECAL_PREFIX = "mmt-slot-";

export function makeSlotDecalId(slotId: TeamSlotId, side: "main" | "pair" = "main"): string {
  return `${SLOT_DECAL_PREFIX}${slotId}-${side}`;
}

export function getSlotAssetById(id: string): QuickSlotAsset | undefined {
  return QUICK_SLOT_ASSETS.find((a) => a.id === id);
}

/**
 * Builds properly oriented, aspect-ratio-preserving DecalLayer(s) for a specific TeamSlotId.
 * Doors and paired zones automatically get 0° (left) and 180° (right) so text is never backwards.
 */
export function buildDecalsForSlot(
  slotId: TeamSlotId,
  asset: QuickSlotAsset,
  layout: Record<TeamSlotId, TeamSlotCoord>,
  colorOverride?: string,
): DecalLayer[] {
  const coord = layout[slotId];
  const meta = TEAM_SLOT_META[slotId];
  const color = colorOverride || asset.defaultColor || meta.defaultColor;

  const makeLayer = (
    side: "main" | "pair",
    u: number,
    v: number,
    rotation: number,
    zoneHint: ZoneKey,
    suffix: string,
  ): DecalLayer => {
    if (asset.kind === "builtin" && asset.assetId) {
      return {
        id: makeSlotDecalId(slotId, side),
        name: `${asset.shortLabel} · ${meta.shortLabel}${suffix}`,
        kind: "builtin",
        assetId: asset.assetId,
        color,
        x: u,
        y: v,
        scale: coord.width,
        rotation,
        opacity: 1,
        mirrorX: false,
        zoneHint,
      };
    }
    return {
      id: makeSlotDecalId(slotId, side),
      name: `${asset.shortLabel} · ${meta.shortLabel}${suffix}`,
      kind: "custom",
      assetId: asset.id,
      dataUrl: asset.src,
      color,
      x: u,
      y: v,
      scale: coord.width,
      rotation,
      opacity: 1,
      mirrorX: false,
      zoneHint,
    };
  };

  const out: DecalLayer[] = [
    makeLayer("main", coord.u, coord.v, coord.rotation, coord.zoneHint, coord.pair ? " (Izq)" : ""),
  ];
  if (coord.pair) {
    out.push(
      makeLayer("pair", coord.pair.u, coord.pair.v, coord.pair.rotation, coord.pair.zoneHint, " (Der)"),
    );
  }
  return out;
}

/**
 * Portable fleet-wide team preset JSON format.
 * Stores semantic slot assignments instead of hardcoded car UV coordinates, so importing it
 * on any other GT3 / GTP / Cup / Formula car automatically remaps every logo to that car's layout.
 */
export interface PortableTeamPreset {
  kind: "mmt-team-preset-v1";
  id: string;
  name: string;
  createdAt: string;
  sourceCarId: string;
  pattern: PatternStyle;
  palette: PaletteConfig;
  spec: SpecConfig;
  fontStyle: SkinDesignState["fontStyle"];
  showNumberOnCar: boolean;
  slots: Partial<Record<TeamSlotId, SlotAssignment>>;
}

export const TEAM_PRESETS_STORAGE_KEY = "mmt_skins_fleet_presets_v1";

export function extractCurrentSlotsFromDecals(decals: DecalLayer[]): Partial<Record<TeamSlotId, SlotAssignment>> {
  const result: Partial<Record<TeamSlotId, SlotAssignment>> = {};
  for (const slotId of TEAM_SLOT_ORDER) {
    const mainId = makeSlotDecalId(slotId, "main");
    const layer = decals.find((d) => d.id === mainId);
    if (!layer) continue;
    const matched = QUICK_SLOT_ASSETS.find(
      (a) =>
        a.id === layer.assetId ||
        (a.kind === "svg-path" && a.src === layer.dataUrl) ||
        (a.kind === "builtin" && a.assetId === layer.assetId && a.defaultColor.toLowerCase() === (layer.color || "").toLowerCase()) ||
        (a.kind === "builtin" && a.assetId === layer.assetId),
    );
    if (matched) {
      result[slotId] = { assetId: matched.id, color: layer.color };
    }
  }
  return result;
}

export function loadSavedFleetPresets(): PortableTeamPreset[] {
  try {
    const raw = localStorage.getItem(TEAM_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PortableTeamPreset[];
    return Array.isArray(arr) ? arr.filter((p) => p && p.kind === "mmt-team-preset-v1") : [];
  } catch {
    return [];
  }
}

export function saveFleetPreset(preset: PortableTeamPreset): PortableTeamPreset[] {
  const existing = loadSavedFleetPresets().filter((p) => p.name.toLowerCase() !== preset.name.toLowerCase());
  const next = [preset, ...existing].slice(0, 16);
  try {
    localStorage.setItem(TEAM_PRESETS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function deleteFleetPreset(id: string): PortableTeamPreset[] {
  const next = loadSavedFleetPresets().filter((p) => p.id !== id);
  try {
    localStorage.setItem(TEAM_PRESETS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
