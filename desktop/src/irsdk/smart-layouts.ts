/**
 * MMT Sync — Smart Layouts & Streamer Mode Engine (Bloque 2)
 * Dynamic widget position, scale, opacity, and visibility management.
 * Automatically switches layout profiles matching Category (GT3, Formula, Oval)
 * and Session Type (Practice, Qualy, Race).
 * Controls OBS/Streamer mode and auto-hides edit bars during on-track running.
 */

export type OverlayWidgetId =
  | "relative"
  | "standings"
  | "fuel"
  | "pedals"
  | "radar"
  | "pitbox"
  | "digiflag"
  | "trackmap"
  | "flatmap"
  | "traffic";

export type SessionColumnKey =
  | "position"
  | "classBadge"
  | "carNumber"
  | "brandLogo"
  | "posGained"
  | "iRating"
  | "license"
  | "gap"
  | "lastLap"
  | "pitStatus";

export type SessionColumnMatrix = Record<SessionColumnKey, Record<SessionMode, boolean>>;

export const DEFAULT_COLUMN_MATRIX: SessionColumnMatrix = {
  position:   { race: true,  qualy: true,  practice: true  },
  classBadge: { race: true,  qualy: true,  practice: true  },
  carNumber:  { race: true,  qualy: true,  practice: true  },
  brandLogo:  { race: true,  qualy: true,  practice: true  },
  posGained:  { race: true,  qualy: false, practice: false },
  iRating:    { race: true,  qualy: true,  practice: true  },
  license:    { race: true,  qualy: true,  practice: false },
  gap:        { race: true,  qualy: true,  practice: true  },
  lastLap:    { race: true,  qualy: true,  practice: true  },
  pitStatus:  { race: true,  qualy: false, practice: true  },
};

const COLUMN_MATRIX_KEY = "mmt_column_matrix_v1";

export interface WidgetLayoutConfig {
  visible: boolean;
  x: number; // percentage or px
  y: number;
  scale: number; // 0.7 to 1.5
  opacity: number; // 0.3 to 1.0
}

export type DisciplineCategory = "gt3" | "formula" | "oval" | "general";
export type SessionMode = "practice" | "qualy" | "race";

export interface SmartLayoutProfile {
  id: string;
  name: string;
  category: DisciplineCategory;
  session: SessionMode;
  widgets: Record<OverlayWidgetId, WidgetLayoutConfig>;
}

const STORAGE_KEY = "mmt_smart_layouts_v1";
const SETTINGS_KEY = "mmt_smart_layouts_settings_v1";

export const DEFAULT_WIDGET_CONFIGS: Record<OverlayWidgetId, WidgetLayoutConfig> = {
  // Top-left: Leaderboard
  standings: { visible: true, x: 16, y: 16, scale: 1.0, opacity: 0.95 },
  // Bottom-left: Relative Radar
  relative: { visible: true, x: 16, y: 560, scale: 1.0, opacity: 0.95 },
  // Bottom-center: Hardware-accelerated Pedals
  pedals: { visible: true, x: 580, y: 820, scale: 1.0, opacity: 0.95 },
  // Center-low / Steering area: 360° Radar
  radar: { visible: true, x: 860, y: 780, scale: 1.0, opacity: 0.95 },
  // Center-high / Windshield: DigiFlag
  digiflag: { visible: true, x: 860, y: 40, scale: 1.1, opacity: 1.0 },
  // Right-mid / Pit Lane: Pitbox Helper
  pitbox: { visible: true, x: 1450, y: 280, scale: 1.0, opacity: 0.95 },
  // Bottom-right: Fuel Computer
  fuel: { visible: true, x: 1450, y: 640, scale: 1.0, opacity: 0.95 },
  // Top-right: Track Map
  trackmap: { visible: true, x: 1450, y: 16, scale: 1.0, opacity: 0.9 },
  // Top-center: Flat Linear Track Map (iOverlay Pro-Free)
  flatmap: { visible: true, x: 560, y: 14, scale: 1.0, opacity: 0.92 },
  // Center-upper: Multiclass Traffic Indicator (iOverlay Pro-Free)
  traffic: { visible: true, x: 820, y: 110, scale: 1.0, opacity: 0.96 },
};

export function createDefaultProfile(category: DisciplineCategory, session: SessionMode): SmartLayoutProfile {
  const profileId = `${category}_${session}`;
  const widgets: Record<OverlayWidgetId, WidgetLayoutConfig> = JSON.parse(JSON.stringify(DEFAULT_WIDGET_CONFIGS));

  // Category & session specific tweaks
  if (category === "oval") {
    // In ovals, relative and radar are critical, fuel is lower priority in qualy
    widgets.radar.scale = 1.15;
    widgets.radar.y = 740;
    if (session === "qualy") widgets.fuel.visible = false;
  } else if (category === "formula") {
    // Open wheelers benefit from wider peripheral view, pedals more compact
    widgets.pedals.scale = 0.9;
    widgets.radar.scale = 1.1;
  } else if (category === "gt3") {
    // Endurance GT3: Fuel is always on top priority
    widgets.fuel.scale = 1.05;
  }

  // Qualy vs Practice vs Race specifics
  if (session === "practice") {
    widgets.pitbox.visible = false;
  } else if (session === "qualy") {
    widgets.standings.scale = 1.05;
  }

  return {
    id: profileId,
    name: `${category.toUpperCase()} · ${session.toUpperCase()}`,
    category,
    session,
    widgets,
  };
}

export class SmartLayoutManager {
  private static instance: SmartLayoutManager;
  private profiles: Map<string, SmartLayoutProfile> = new Map();
  private activeProfileId = "general_race";
  private streamerMode = false;
  private focusMode = false;
  private autoProfileSwitching = true;
  private columnMatrix: SessionColumnMatrix = JSON.parse(JSON.stringify(DEFAULT_COLUMN_MATRIX));
  private listeners: Array<() => void> = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): SmartLayoutManager {
    if (!SmartLayoutManager.instance) {
      SmartLayoutManager.instance = new SmartLayoutManager();
    }
    return SmartLayoutManager.instance;
  }

  private loadFromStorage(): void {
    const categories: DisciplineCategory[] = ["gt3", "formula", "oval", "general"];
    const sessions: SessionMode[] = ["practice", "qualy", "race"];

    // Initialize all default profiles
    for (const c of categories) {
      for (const s of sessions) {
        const p = createDefaultProfile(c, s);
        this.profiles.set(p.id, p);
      }
    }

    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [id, prof] of Object.entries(parsed)) {
            if (this.profiles.has(id)) {
              this.profiles.set(id, prof as SmartLayoutProfile);
            }
          }
        }
      }
      const rawCols = localStorage.getItem(COLUMN_MATRIX_KEY);
      if (rawCols) {
        const parsedCols = JSON.parse(rawCols);
        if (parsedCols && typeof parsedCols === "object") {
          for (const k of Object.keys(DEFAULT_COLUMN_MATRIX) as SessionColumnKey[]) {
            if (parsedCols[k] && typeof parsedCols[k] === "object") {
              this.columnMatrix[k] = {
                race: Boolean(parsedCols[k].race ?? DEFAULT_COLUMN_MATRIX[k].race),
                qualy: Boolean(parsedCols[k].qualy ?? DEFAULT_COLUMN_MATRIX[k].qualy),
                practice: Boolean(parsedCols[k].practice ?? DEFAULT_COLUMN_MATRIX[k].practice),
              };
            }
          }
        }
      }
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        const s = JSON.parse(rawSettings);
        if (typeof s.streamerMode === "boolean") this.streamerMode = s.streamerMode;
        if (typeof s.focusMode === "boolean") this.focusMode = s.focusMode;
        if (typeof s.autoProfileSwitching === "boolean") this.autoProfileSwitching = s.autoProfileSwitching;
        if (s.activeProfileId && this.profiles.has(s.activeProfileId)) this.activeProfileId = s.activeProfileId;
      }
    } catch (e) {
      console.warn("[smart-layouts] Error reading stored layouts:", e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const obj: Record<string, SmartLayoutProfile> = {};
      this.profiles.forEach((p, k) => {
        obj[k] = p;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      localStorage.setItem(COLUMN_MATRIX_KEY, JSON.stringify(this.columnMatrix));
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          activeProfileId: this.activeProfileId,
          streamerMode: this.streamerMode,
          focusMode: this.focusMode,
          autoProfileSwitching: this.autoProfileSwitching,
        })
      );
    } catch (e) {
      console.warn("[smart-layouts] Error saving layouts:", e);
    }
    this.notify();
  }

  public resolveCategory(rawCategory: string, carPath = ""): DisciplineCategory {
    const c = (rawCategory || "").toLowerCase();
    const cp = (carPath || "").toLowerCase();

    if (c.includes("oval") || cp.includes("stock") || cp.includes("nascar") || cp.includes("truck")) {
      return "oval";
    }
    if (
      c.includes("formula") ||
      c.includes("open") ||
      c.includes("indy") ||
      cp.includes("formula") ||
      cp.includes("dallara") ||
      cp.includes("sf23")
    ) {
      return "formula";
    }
    if (
      c.includes("road") ||
      c.includes("sports") ||
      c.includes("gt3") ||
      c.includes("gt4") ||
      c.includes("cup") ||
      cp.includes("gt3") ||
      cp.includes("gt4") ||
      cp.includes("911") ||
      cp.includes("ferrari") ||
      cp.includes("bmw")
    ) {
      return "gt3";
    }
    return "general";
  }

  public resolveSession(rawSessionType: string): SessionMode {
    const s = (rawSessionType || "").toLowerCase();
    if (s.includes("qual") || s.includes("lone")) return "qualy";
    if (s.includes("prac") || s.includes("warm") || s.includes("test")) return "practice";
    return "race";
  }

  /**
   * Matches live category and session and activates matching profile if auto-switching is enabled
   */
  public matchAndActivate(rawCategory: string, rawSessionType: string, carPath = ""): string {
    if (!this.autoProfileSwitching) return this.activeProfileId;
    const cat = this.resolveCategory(rawCategory, carPath);
    const ses = this.resolveSession(rawSessionType);
    const targetId = `${cat}_${ses}`;

    if (this.profiles.has(targetId) && this.activeProfileId !== targetId) {
      this.activeProfileId = targetId;
      this.saveToStorage();
    }
    return this.activeProfileId;
  }

  public getActiveProfile(): SmartLayoutProfile {
    return this.profiles.get(this.activeProfileId) || this.profiles.get("general_race")!;
  }

  public getWidgetConfig(widgetId: OverlayWidgetId): WidgetLayoutConfig {
    const p = this.getActiveProfile();
    return p.widgets[widgetId] || DEFAULT_WIDGET_CONFIGS[widgetId];
  }

  public setWidgetConfig(widgetId: OverlayWidgetId, patch: Partial<WidgetLayoutConfig>): void {
    const p = this.getActiveProfile();
    if (p.widgets[widgetId]) {
      p.widgets[widgetId] = { ...p.widgets[widgetId], ...patch };
      this.saveToStorage();
    }
  }

  public toggleStreamerMode(): boolean {
    this.streamerMode = !this.streamerMode;
    this.saveToStorage();
    return this.streamerMode;
  }

  public isStreamerMode(): boolean {
    return this.streamerMode;
  }

  public setAutoProfileSwitching(enabled: boolean): void {
    this.autoProfileSwitching = enabled;
    this.saveToStorage();
  }

  public isAutoProfileSwitching(): boolean {
    return this.autoProfileSwitching;
  }

  public setFocusMode(enabled: boolean): void {
    this.focusMode = enabled;
    this.saveToStorage();
  }

  public isFocusMode(): boolean {
    return this.focusMode;
  }

  public getColumnMatrix(): SessionColumnMatrix {
    return this.columnMatrix;
  }

  public setColumnVisible(col: SessionColumnKey, session: SessionMode, visible: boolean): void {
    if (!this.columnMatrix[col]) return;
    this.columnMatrix[col][session] = visible;
    this.saveToStorage();
  }

  public isColumnVisibleForSession(col: SessionColumnKey, rawSessionType: string): boolean {
    const s = (rawSessionType || "").toLowerCase();
    const mode: SessionMode = s.includes("qual") ? "qualy" : s.includes("prac") || s.includes("test") ? "practice" : "race";
    return Boolean(this.columnMatrix[col]?.[mode] ?? true);
  }

  /**
   * Automatically controls overlay top edit bar:
   * Visible in Pit Road for easy repositioning; hidden on track for pure 60 FPS driving.
   */
  public computeEditBarVisibility(onPitRoad: boolean, userLocked = false): boolean {
    if (userLocked) return false;
    // On pit road: show editing bar. On track: automatically hide.
    return onPitRoad;
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
