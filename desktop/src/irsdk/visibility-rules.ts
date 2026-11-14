/**
 * MMT Sync — VisibilityRulesEngine (Bloque 21)
 * Context-aware intelligent widget visibility management for iRacing:
 * - hideInReplay: IsReplayPlaying === true (or SessionState === 6 / IsInGarage)
 * - hideInQualy: SessionType === 'Lone Qualify' | 'Open Qualify'
 * - hideInRaceLap1: SessionType === 'Race' & SessionState === 4 & CarIdxLap <= 1 (or LapDistPct < 0.33)
 * - hideInPitLane: OnPitRoad === true (focus on pitbox helper)
 * Smooth 60 FPS CSS transitions (opacity: 0 -> 1 & pointer-events: none) without DOM thrashing.
 * Global Boss Key / Clean Screen panic shortcut (F9 / Ctrl+H).
 */

export interface WidgetVisibilityRuleConfig {
  hideInReplay: boolean;
  hideInQualy: boolean;
  hideInRaceLap1: boolean;
  hideInPitLane: boolean;
  lap1SectorThreshold: number; // default 0.33 (end of sector 1)
}

export type VisibilityWidgetId =
  | "relative"
  | "standings"
  | "fuel"
  | "pedals"
  | "radar"
  | "pitbox"
  | "digiflag"
  | "waveform";

export interface TelemetryContextState {
  isReplayPlaying: boolean;
  sessionType: string;
  sessionState: number; // 4 = Racing
  camCarIdx: number;
  activeLap: number;
  lapDistPct: number;
  onPitRoad: boolean;
}

export const DEFAULT_VISIBILITY_RULES: Record<VisibilityWidgetId, WidgetVisibilityRuleConfig> = {
  relative: {
    hideInReplay: true,
    hideInQualy: true,
    hideInRaceLap1: true,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  standings: {
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: true,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  fuel: {
    hideInReplay: true,
    hideInQualy: true,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  pedals: {
    hideInReplay: false,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  radar: {
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  pitbox: {
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  digiflag: {
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  waveform: {
    hideInReplay: false,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
};

const VISIBILITY_STORAGE_KEY = "mmt_visibility_rules_v1";

export class VisibilityRulesEngine {
  private static instance: VisibilityRulesEngine;
  private rules: Record<VisibilityWidgetId, WidgetVisibilityRuleConfig>;
  private bossKeyActive = false; // Clean Screen panic mode
  private listeners: Array<() => void> = [];

  private constructor() {
    this.rules = JSON.parse(JSON.stringify(DEFAULT_VISIBILITY_RULES));
    this.loadFromStorage();
  }

  public static getInstance(): VisibilityRulesEngine {
    if (!VisibilityRulesEngine.instance) {
      VisibilityRulesEngine.instance = new VisibilityRulesEngine();
    }
    return VisibilityRulesEngine.instance;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          for (const [id, conf] of Object.entries(parsed)) {
            if (this.rules[id as VisibilityWidgetId]) {
              this.rules[id as VisibilityWidgetId] = {
                ...this.rules[id as VisibilityWidgetId],
                ...(conf as Partial<WidgetVisibilityRuleConfig>),
              };
            }
          }
        }
      }
    } catch {}
  }

  public saveToStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(this.rules));
    } catch {}
    this.notify();
  }

  public getRules(): Record<VisibilityWidgetId, WidgetVisibilityRuleConfig> {
    return this.rules;
  }

  public getWidgetRule(widgetId: VisibilityWidgetId): WidgetVisibilityRuleConfig {
    return this.rules[widgetId] || DEFAULT_VISIBILITY_RULES[widgetId];
  }

  public setWidgetRule(widgetId: VisibilityWidgetId, patch: Partial<WidgetVisibilityRuleConfig>): void {
    if (this.rules[widgetId]) {
      this.rules[widgetId] = { ...this.rules[widgetId], ...patch };
      this.saveToStorage();
    }
  }

  public toggleBossKey(): boolean {
    this.bossKeyActive = !this.bossKeyActive;
    this.notify();
    return this.bossKeyActive;
  }

  public isBossKeyActive(): boolean {
    return this.bossKeyActive;
  }

  /**
   * Evaluates contextual conditions and decides whether widget should be visible
   */
  public evaluateVisibility(widgetId: VisibilityWidgetId, ctx: TelemetryContextState): boolean {
    // 1. Boss Key / Clean Screen overrides everything
    if (this.bossKeyActive) {
      return false;
    }

    const rule = this.rules[widgetId] || DEFAULT_VISIBILITY_RULES[widgetId];

    // 2. Hide in Replays (IsReplayPlaying === true or SessionState === 6 / InGarage)
    if (rule.hideInReplay && (ctx.isReplayPlaying || ctx.sessionState === 6)) {
      return false;
    }

    // 3. Hide in Qualy (Lone Qualify or Open Qualify)
    const sessionLower = (ctx.sessionType || "").toLowerCase();
    const isQualy = sessionLower.includes("qual");
    if (rule.hideInQualy && isQualy) {
      return false;
    }

    // 4. Hide in Race Lap 1 (SessionType === Race & SessionState === 4 / Racing)
    const isRace = sessionLower.includes("race");
    if (rule.hideInRaceLap1 && isRace && ctx.sessionState === 4) {
      // In lap 1 until configured sector threshold or start of lap 2
      if (ctx.activeLap <= 1 && ctx.lapDistPct < rule.lap1SectorThreshold) {
        return false;
      }
    }

    // 5. Hide in Pit Lane
    if (rule.hideInPitLane && ctx.onPitRoad) {
      return false;
    }

    return true;
  }

  /**
   * Applies smooth CSS transition to element without dismantling DOM
   */
  public applyElementVisibility(element: HTMLElement | null, visible: boolean): void {
    if (!element) return;
    element.style.transition = "opacity 280ms cubic-bezier(0.4, 0, 0.2, 1), transform 280ms cubic-bezier(0.4, 0, 0.2, 1)";
    if (visible) {
      element.style.opacity = "1";
      element.style.pointerEvents = "auto";
      element.style.transform = "none";
    } else {
      element.style.opacity = "0";
      element.style.pointerEvents = "none";
      element.style.transform = "scale(0.98)";
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
