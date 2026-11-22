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
  hideInTrack?: boolean;
  hideInReplay: boolean;
  hideInQualy: boolean;
  hideInRaceLap1: boolean;
  hideInPitLane: boolean;
  lap1SectorThreshold: number; // default 0.33 (end of sector 1)
}

export type ReplayHudMode = "full" | "replay_clean" | "hidden";

export type VisibilityWidgetId =
  | "relative"
  | "standings"
  | "fuel"
  | "pedals"
  | "radar"
  | "pitbox"
  | "digiflag"
  | "waveform"
  | "trackmap"
  | "flatmap"
  | "traffic";

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
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: true,
    hideInRaceLap1: true,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  standings: {
    hideInTrack: false,
    hideInReplay: false,
    hideInQualy: false,
    hideInRaceLap1: true,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  fuel: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: true,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  pedals: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  radar: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  pitbox: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  digiflag: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  waveform: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  trackmap: {
    hideInTrack: false,
    hideInReplay: false,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  flatmap: {
    hideInTrack: false,
    hideInReplay: false,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: false,
    lap1SectorThreshold: 0.33,
  },
  traffic: {
    hideInTrack: false,
    hideInReplay: true,
    hideInQualy: false,
    hideInRaceLap1: false,
    hideInPitLane: true,
    lap1SectorThreshold: 0.33,
  },
};

const VISIBILITY_STORAGE_KEY = "mmt_visibility_rules_v1";

export class VisibilityRulesEngine {
  private static instance: VisibilityRulesEngine;
  private rules: Record<VisibilityWidgetId, WidgetVisibilityRuleConfig>;
  private bossKeyActive = false; // Clean Screen panic mode
  private replayHudMode: ReplayHudMode = "full";
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

  public getReplayHudMode(): ReplayHudMode {
    return this.replayHudMode;
  }

  public setReplayHudMode(mode: ReplayHudMode): void {
    this.replayHudMode = mode;
    this.notify();
  }

  public cycleReplayHudMode(): ReplayHudMode {
    this.replayHudMode =
      this.replayHudMode === "full"
        ? "replay_clean"
        : this.replayHudMode === "replay_clean"
          ? "hidden"
          : "full";
    this.notify();
    return this.replayHudMode;
  }

  /**
   * Evaluates contextual conditions and decides whether widget should be visible
   */
  public evaluateVisibility(widgetId: VisibilityWidgetId, ctx: TelemetryContextState): boolean {
    // 1. Boss Key / Clean Screen or "hidden" Replay HUD mode overrides everything
    if (this.bossKeyActive || this.replayHudMode === "hidden") {
      return false;
    }

    const rule = this.rules[widgetId] || DEFAULT_VISIBILITY_RULES[widgetId];
    const inReplay = ctx.isReplayPlaying || ctx.sessionState === 6 || this.replayHudMode === "replay_clean";

    // 2a. Hide in Replays (IsReplayPlaying === true, SessionState === 6, or replay_clean)
    if (rule.hideInReplay && inReplay) {
      return false;
    }

    // 2b. Hide while driving on track
    if (rule.hideInTrack && !inReplay) {
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
