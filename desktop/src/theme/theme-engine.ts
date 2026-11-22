/**
 * MMT Sync — Theme Engine, Custom CSS & Layout Export/Import (Bloque 16)
 * Dynamic CSS Variables (--mmt-bg, --mmt-accent, --mmt-border, --mmt-font-mono, --mmt-scale)
 * Predefined themes: Dark Carbon, Minimal Transparent, High Contrast, Retro TV.
 * Widget Column Toggles & Ordering.
 * 1-Click JSON & mmt-layout:// shareable layout exporter/importer.
 */

export type ThemePreset = "dark-carbon" | "minimal-transparent" | "high-contrast" | "retro-tv";
export type BrandLogoMode = "original" | "white" | "black";

export interface ThemeVariables {
  bg: string;
  cardBg: string;
  accent: string;
  accentGlow: string;
  border: string;
  fontMono: string;
  radius: string;
  scale: number;
  opacity: number;
}

export const THEME_PRESETS: Record<ThemePreset, { name: string; vars: ThemeVariables; description: string }> = {
  "dark-carbon": {
    name: "Dark Carbon",
    description: "Fibra de carbono oscura con acentos cyan neón y máxima nitidez en simracing.",
    vars: {
      bg: "#090d12",
      cardBg: "rgba(9, 13, 18, 0.92)",
      accent: "#00e5ff",
      accentGlow: "rgba(0, 229, 255, 0.3)",
      border: "rgba(255, 255, 255, 0.12)",
      fontMono: "'JetBrains Mono', monospace",
      radius: "12px",
      scale: 1.0,
      opacity: 0.95,
    },
  },
  "minimal-transparent": {
    name: "Minimal Transparent",
    description: "Fondo 100% transparente y bordes ultrafinos optimizados para capturas OBS / Twitch.",
    vars: {
      bg: "transparent",
      cardBg: "rgba(0, 0, 0, 0.45)",
      accent: "#00e699",
      accentGlow: "rgba(0, 230, 153, 0.25)",
      border: "rgba(255, 255, 255, 0.08)",
      fontMono: "'JetBrains Mono', monospace",
      radius: "6px",
      scale: 1.0,
      opacity: 0.85,
    },
  },
  "high-contrast": {
    name: "High Contrast",
    description: "Negro absoluto y bordes blancos definidos para visibilidad extrema bajo el sol.",
    vars: {
      bg: "#000000",
      cardBg: "#050505",
      accent: "#eab308",
      accentGlow: "rgba(234, 179, 8, 0.4)",
      border: "#ffffff",
      fontMono: "'JetBrains Mono', monospace",
      radius: "4px",
      scale: 1.05,
      opacity: 1.0,
    },
  },
  "retro-tv": {
    name: "Retro TV",
    description: "Fósforo verde CRT retro noventero estilo telemetría clásica de Le Mans.",
    vars: {
      bg: "#08140c",
      cardBg: "rgba(8, 20, 12, 0.95)",
      accent: "#22c55e",
      accentGlow: "rgba(34, 197, 94, 0.35)",
      border: "rgba(34, 197, 94, 0.45)",
      fontMono: "'JetBrains Mono', monospace",
      radius: "16px",
      scale: 0.95,
      opacity: 0.96,
    },
  },
};

export interface RelativeColumnsConfig {
  carNumber: boolean;
  driverName: boolean;
  brandIcon: boolean;
  carClass: boolean;
  license: boolean;
  iRating: boolean;
  delta: boolean;
  pitStatus: boolean;
}

export interface LeaderboardColumnsConfig {
  position: boolean;
  classPosition: boolean;
  carNumber: boolean;
  driverName: boolean;
  brandIcon: boolean;
  gap: boolean;
  interval: boolean;
  bestLap: boolean;
  lastLap: boolean;
  license: boolean;
  iRating: boolean;
  pitStatus: boolean;
}

export interface FuelColumnsConfig {
  remainingL: boolean;
  remainingPct: boolean;
  avgBurn: boolean;
  lapsRemaining: boolean;
  fuelToAdd: boolean;
  safetyMargin: boolean;
}

export interface WidgetColumnsConfig {
  relative: RelativeColumnsConfig;
  leaderboard: LeaderboardColumnsConfig;
  fuel: FuelColumnsConfig;
}

export const DEFAULT_COLUMNS_CONFIG: WidgetColumnsConfig = {
  relative: {
    carNumber: true,
    driverName: true,
    brandIcon: true,
    carClass: true,
    license: true,
    iRating: true,
    delta: true,
    pitStatus: true,
  },
  leaderboard: {
    position: true,
    classPosition: true,
    carNumber: true,
    driverName: true,
    brandIcon: true,
    gap: true,
    interval: true,
    bestLap: true,
    lastLap: true,
    license: true,
    iRating: true,
    pitStatus: true,
  },
  fuel: {
    remainingL: true,
    remainingPct: true,
    avgBurn: true,
    lapsRemaining: true,
    fuelToAdd: true,
    safetyMargin: true,
  },
};

export interface MmtExportableLayout {
  version: "1.0";
  timestamp: number;
  author?: string;
  theme: {
    preset: ThemePreset;
    customVars?: Partial<ThemeVariables>;
    customCss?: string;
  };
  columns: WidgetColumnsConfig;
  positions?: Record<string, { left: string; top: string; scale?: number; visible?: boolean }>;
}

const THEME_STORAGE_KEY = "mmt_theme_config_v1";
const COLUMNS_STORAGE_KEY = "mmt_columns_config_v1";
const CUSTOM_CSS_KEY = "mmt_custom_css_v1";
const BRAND_LOGO_MODE_KEY = "mmt_brand_logo_mode_v1";

export class ThemeEngine {
  private static instance: ThemeEngine;
  private currentPreset: ThemePreset = "dark-carbon";
  private brandLogoMode: BrandLogoMode = "original";
  private customVars: Partial<ThemeVariables> = {};
  private customCss = "";
  private columns: WidgetColumnsConfig = JSON.parse(JSON.stringify(DEFAULT_COLUMNS_CONFIG));
  private listeners: Array<() => void> = [];

  private constructor() {
    this.loadFromStorage();
    this.applyToDom();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === BRAND_LOGO_MODE_KEY || e.key === THEME_STORAGE_KEY) {
          this.loadFromStorage();
          this.applyToDom();
          this.notify();
        }
      });
    }
  }

  public static getInstance(): ThemeEngine {
    if (!ThemeEngine.instance) {
      ThemeEngine.instance = new ThemeEngine();
    }
    return ThemeEngine.instance;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const rawTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (rawTheme) {
        const parsed = JSON.parse(rawTheme);
        if (parsed.preset && THEME_PRESETS[parsed.preset as ThemePreset]) {
          this.currentPreset = parsed.preset as ThemePreset;
        }
        if (parsed.customVars && typeof parsed.customVars === "object") {
          this.customVars = parsed.customVars;
        }
      }

      const rawLogoMode = localStorage.getItem(BRAND_LOGO_MODE_KEY);
      if (rawLogoMode === "original" || rawLogoMode === "white" || rawLogoMode === "black") {
        this.brandLogoMode = rawLogoMode;
      }

      const rawCustomCss = localStorage.getItem(CUSTOM_CSS_KEY);
      if (rawCustomCss) {
        this.customCss = rawCustomCss;
      }

      const rawColumns = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (rawColumns) {
        const parsed = JSON.parse(rawColumns);
        if (parsed && typeof parsed === "object") {
          this.columns = {
            relative: { ...DEFAULT_COLUMNS_CONFIG.relative, ...parsed.relative },
            leaderboard: { ...DEFAULT_COLUMNS_CONFIG.leaderboard, ...parsed.leaderboard },
            fuel: { ...DEFAULT_COLUMNS_CONFIG.fuel, ...parsed.fuel },
          };
        }
      }
    } catch (e) {
      console.warn("[theme-engine] Error loading stored theme settings:", e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({
          preset: this.currentPreset,
          customVars: this.customVars,
        })
      );
      localStorage.setItem(BRAND_LOGO_MODE_KEY, this.brandLogoMode);
      localStorage.setItem(CUSTOM_CSS_KEY, this.customCss);
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(this.columns));
    } catch (e) {
      console.warn("[theme-engine] Error saving theme settings:", e);
    }
    this.notify();
  }

  public getPreset(): ThemePreset {
    return this.currentPreset;
  }

  public setPreset(preset: ThemePreset): void {
    if (!THEME_PRESETS[preset]) return;
    this.currentPreset = preset;
    this.applyToDom();
    this.saveToStorage();
  }

  public getBrandLogoMode(): BrandLogoMode {
    return this.brandLogoMode;
  }

  public setBrandLogoMode(mode: BrandLogoMode): void {
    if (mode !== "original" && mode !== "white" && mode !== "black") return;
    this.brandLogoMode = mode;
    this.applyToDom();
    this.saveToStorage();
  }

  public setCustomVars(vars: Partial<ThemeVariables>): void {
    this.customVars = { ...this.customVars, ...vars };
    this.applyToDom();
    this.saveToStorage();
  }

  public setCustomCss(cssText: string): void {
    this.customCss = cssText;
    this.applyToDom();
    this.saveToStorage();
  }

  public getCustomCss(): string {
    return this.customCss;
  }

  public getActiveVariables(): ThemeVariables {
    const base = THEME_PRESETS[this.currentPreset].vars;
    return { ...base, ...this.customVars };
  }

  public applyToDom(): void {
    if (typeof document === "undefined") return;
    const vars = this.getActiveVariables();
    const root = document.documentElement;

    root.style.setProperty("--mmt-bg", vars.bg);
    root.style.setProperty("--mmt-card-bg", vars.cardBg);
    root.style.setProperty("--mmt-accent", vars.accent);
    root.style.setProperty("--mmt-accent-glow", vars.accentGlow);
    root.style.setProperty("--mmt-border", vars.border);
    root.style.setProperty("--mmt-font-mono", vars.fontMono);
    root.style.setProperty("--mmt-radius", vars.radius);
    root.style.setProperty("--mmt-scale", String(vars.scale));
    root.style.setProperty("--mmt-opacity", String(vars.opacity));

    root.setAttribute("data-mmt-theme", this.currentPreset);
    root.setAttribute("data-brand-logo-mode", this.brandLogoMode);

    // Apply or update custom CSS style tag
    let styleEl = document.getElementById("mmt-custom-css-host") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "mmt-custom-css-host";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = this.customCss || "";
  }

  // --- Column Configuration Methods ---

  public getColumnsConfig(): WidgetColumnsConfig {
    return this.columns;
  }

  public toggleColumn<W extends keyof WidgetColumnsConfig, C extends keyof WidgetColumnsConfig[W]>(
    widget: W,
    column: C,
    enabled?: boolean
  ): boolean {
    const current = (this.columns[widget] as any)[column];
    const next = typeof enabled === "boolean" ? enabled : !current;
    (this.columns[widget] as any)[column] = next;
    this.saveToStorage();
    return next;
  }

  public setColumnsConfig(config: WidgetColumnsConfig): void {
    this.columns = JSON.parse(JSON.stringify(config));
    this.saveToStorage();
  }

  // --- Layout Export & Import (1 Clic JSON & mmt-layout://) ---

  public exportLayoutJson(author = "Muntrume Pilot"): string {
    let positions: Record<string, { left: string; top: string }> | undefined;
    try {
      if (typeof localStorage !== "undefined") {
        const rawPos = localStorage.getItem("mmt_float_hud_positions");
        if (rawPos) positions = JSON.parse(rawPos);
      }
    } catch {}

    const payload: MmtExportableLayout = {
      version: "1.0",
      timestamp: Date.now(),
      author,
      theme: {
        preset: this.currentPreset,
        customVars: this.customVars,
        customCss: this.customCss,
      },
      columns: this.columns,
      positions,
    };

    return JSON.stringify(payload, null, 2);
  }

  public exportMmtLayoutUrl(): string {
    const json = this.exportLayoutJson();
    let b64 = "";
    if (typeof btoa !== "undefined") {
      b64 = btoa(unescape(encodeURIComponent(json)));
    } else if (typeof (globalThis as any).Buffer !== "undefined") {
      b64 = (globalThis as any).Buffer.from(json, "utf-8").toString("base64");
    }
    return `mmt-layout://${b64}`;
  }

  public importLayout(raw: string): boolean {
    try {
      let json = raw.trim();
      if (json.startsWith("mmt-layout://")) {
        const b64 = json.replace("mmt-layout://", "");
        if (typeof atob !== "undefined") {
          json = decodeURIComponent(escape(atob(b64)));
        } else if (typeof (globalThis as any).Buffer !== "undefined") {
          json = (globalThis as any).Buffer.from(b64, "base64").toString("utf-8");
        }
      }

      const parsed = JSON.parse(json) as MmtExportableLayout;
      if (!parsed || parsed.version !== "1.0") {
        throw new Error("Formato de layout incompatible");
      }

      if (parsed.theme) {
        if (parsed.theme.preset && THEME_PRESETS[parsed.theme.preset]) {
          this.currentPreset = parsed.theme.preset;
        }
        if (parsed.theme.customVars) {
          this.customVars = parsed.theme.customVars;
        }
        if (typeof parsed.theme.customCss === "string") {
          this.customCss = parsed.theme.customCss;
        }
      }

      if (parsed.columns) {
        this.columns = {
          relative: { ...DEFAULT_COLUMNS_CONFIG.relative, ...parsed.columns.relative },
          leaderboard: { ...DEFAULT_COLUMNS_CONFIG.leaderboard, ...parsed.columns.leaderboard },
          fuel: { ...DEFAULT_COLUMNS_CONFIG.fuel, ...parsed.columns.fuel },
        };
      }

      if (parsed.positions && typeof localStorage !== "undefined") {
        localStorage.setItem("mmt_float_hud_positions", JSON.stringify(parsed.positions));
      }

      this.applyToDom();
      this.saveToStorage();
      return true;
    } catch (e) {
      console.error("[theme-engine] Error al importar layout:", e);
      return false;
    }
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {}
    }
  }
}
