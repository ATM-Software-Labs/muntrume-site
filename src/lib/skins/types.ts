export type ResolutionMode = 2048 | 4096;

export type FinishType = "gloss" | "satin" | "matte" | "metallic" | "chrome" | "carbon";

export type ZoneKey =
  | "hood"
  | "roof"
  | "leftSide"
  | "rightSide"
  | "rearWing"
  | "mirrors"
  | "frontBumper"
  | "rearBumper"
  | "numberPlateLeft"
  | "numberPlateRight";

export interface ZoneRect {
  key: ZoneKey;
  label: string;
  /** Normalized 0..1 coordinates on UV map */
  x: number;
  y: number;
  w: number;
  h: number;
  restricted?: boolean;
  detectedConfidence?: number;
}

export type CarCategory = "GT3" | "GTP / Hypercar" | "LMP2 / LMP3" | "GT4 & Cup" | "Fórmula" | "TCR & Producción";

export interface CarProfile {
  id: string;
  name: string;
  brand: string;
  category: CarCategory;
  iracingFolder: string;
  logoPath: string;
  notes: string;
  defaultZones: Record<ZoneKey, ZoneRect>;
}

export interface DriverProfile {
  id: string;
  name: string;
  shortName: string;
  number: string;
  customerId: string;
  nationality: string;
  accentHex?: string;
}

export type PatternStyle =
  | "solid-factory"
  | "pearl-shift"
  | "carbon-exposed"
  | "forged-carbon"
  | "stealth-camo"
  | "hex-stealth"
  | "topo-flow"
  | "halftone-pro"
  | "brushed-metal"
  | "freeform"
  // Legacy aliases kept for backwards compatibility with saved presets
  | "endurance"
  | "sprint"
  | "carbon-stealth"
  | "tricolor"
  | "clean-minimal"
  | "geo-camo"
  | "hex-tech"
  | "apex-fade"
  | "heritage-gulf"
  | "factory-chevron"
  | "lightning-drift";

export type SurfaceTexture = "none" | "carbon" | "hex-mesh" | "speed-lines" | "metallic-flake";

export interface BrushStroke {
  color: string;
  size: number;
  mirrorX: boolean;
  points: Array<{ x: number; y: number }>;
}

export interface PaletteConfig {
  primary: string;
  secondary: string;
  accent: string;
  detail: string;
  numberColor: string;
  numberBg: string;
}

export interface SpecConfig {
  finish: FinishType;
  /** 0..100 iRacing Red channel (Metallic) */
  metallic: number;
  /** 0..100 iRacing Green channel (Roughness) */
  roughness: number;
  /** 0..100 iRacing Blue channel (Clearcoat) */
  clearcoat: number;
  carbonAccent: boolean;
}

export interface DecalLayer {
  id: string;
  name: string;
  kind: "builtin" | "custom" | "text" | "shape";
  assetId?: string;
  dataUrl?: string;
  text?: string;
  shapeType?: "stripe" | "triangle" | "circle";
  color: string;
  /** Normalized 0..1 position */
  x: number;
  y: number;
  /** Normalized 0.02..0.6 width scale */
  scale: number;
  /** Degrees -180..180 */
  rotation: number;
  opacity: number;
  mirrorX: boolean;
  zoneHint?: ZoneKey;
}

export interface ZonePaintOverride {
  color?: string;
  finish?: FinishType;
}

export interface SkinDesignState {
  version: number;
  name: string;
  carId: string;
  driverId: string;
  customDriverName: string;
  customNumber: string;
  customerId: string;
  resolution: ResolutionMode;
  pattern: PatternStyle;
  surfaceTexture?: SurfaceTexture;
  psdPatternName?: string | null;
  palette: PaletteConfig;
  spec: SpecConfig;
  fontStyle: "racing-bold" | "condensed-gt" | "mono-tech";
  showNumberOnCar: boolean;
  zones: Record<ZoneKey, ZoneRect>;
  zoneOverrides?: Partial<Record<ZoneKey, ZonePaintOverride>>;
  decals: DecalLayer[];
  strokes?: BrushStroke[];
  updatedAt: string;
}

export interface PresetDefinition {
  id: PatternStyle;
  name: string;
  tagline: string;
  palette: PaletteConfig;
  spec: SpecConfig;
  fontStyle: SkinDesignState["fontStyle"];
}

export interface TemplateAnalysisResult {
  width: number;
  height: number;
  format: string;
  detectedZones: Partial<Record<ZoneKey, ZoneRect>>;
  panelCount: number;
  hasAlphaMask: boolean;
  wireframeDensity: number;
  summary: string;
}

export interface GeminiDesignSuggestion {
  title: string;
  rationale: string;
  pattern: PatternStyle;
  palette: PaletteConfig;
  finish: FinishType;
  sponsorTips: string[];
}

export interface PhotoGuideShot {
  id: string;
  title: string;
  filename: string;
  circuit: string;
  timeAndWeather: string;
  cameraSetup: string;
  checklist: string[];
}

export interface GeminiPhotoAdaptation {
  summary: string;
  recommendedCircuit: string;
  lightingNote: string;
  shots: PhotoGuideShot[];
}

export interface GeminiDesignReview {
  score: number;
  verdict: string;
  contrastNotes: string[];
  legibilityNotes: string[];
  exportChecklist: string[];
}
