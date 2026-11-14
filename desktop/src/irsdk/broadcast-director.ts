/**
 * MMT Sync — BroadcastDirector (Prompt 37)
 * Auto-Camera battle/fastest-lap selector (CamSwitchPos) and parallel-battle Replay Highlights Clipper.
 */

import { finiteOr } from "../core/math-guards";
import type { LeaderboardEntry } from "./types";

export interface CameraSwitchCommand {
  type: "CamSwitchPos";
  carIdx: number;
  carNumber: string;
  driverName: string;
  reason: "close_battle" | "fastest_lap";
  gapSeconds: number | null;
  sessionTimeS: number;
}

export interface HighlightClip {
  id: string;
  sessionTimeS: number;
  formattedTime: string;
  carNumber: string;
  driverName: string;
  reason: "parallel_battle" | "manual";
  durationS: number;
  createdAt: string;
}

export interface BroadcastDirectorConfig {
  enabled: boolean;
  autoClipEnabled: boolean;
  minHoldSeconds: number;
  battleGapThresholdS: number;
  parallelMinSeconds: number;
}

export function formatSessionTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(finiteOr(seconds, 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export class BroadcastDirector {
  private config: BroadcastDirectorConfig = {
    enabled: false,
    autoClipEnabled: true,
    minHoldSeconds: 8,
    battleGapThresholdS: 0.4,
    parallelMinSeconds: 3,
  };
  private lastSwitchAtS = -999;
  private currentCamCarIdx: number | null = null;
  private knownBestLapS = Infinity;
  private parallelStartS: number | null = null;
  private parallelClippedForStreak = false;
  private clips: HighlightClip[] = [];
  private lastCommand: CameraSwitchCommand | null = null;

  public configure(patch: Partial<BroadcastDirectorConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  public getConfig(): BroadcastDirectorConfig {
    return { ...this.config };
  }

  public getClips(): HighlightClip[] {
    return [...this.clips];
  }

  public getLastCommand(): CameraSwitchCommand | null {
    return this.lastCommand;
  }

  public evaluateCamera(
    leaderboard: LeaderboardEntry[],
    sessionTimeS: number,
  ): CameraSwitchCommand | null {
    if (!this.config.enabled || leaderboard.length < 2) return null;
    if (sessionTimeS - this.lastSwitchAtS < this.config.minHoldSeconds) return null;

    // 1. Check for a newly set fastest lap
    for (const entry of leaderboard) {
      if (entry.bestLapTime > 15 && entry.bestLapTime < this.knownBestLapS) {
        const isInitial = this.knownBestLapS === Infinity;
        this.knownBestLapS = entry.bestLapTime;
        if (!isInitial && entry.carIdx !== this.currentCamCarIdx) {
          return this.emitSwitch(entry, "fastest_lap", null, sessionTimeS);
        }
      }
    }

    // 2. Find closest on-track battle (INT < battleGapThresholdS)
    const onTrack = leaderboard.filter((e) => !e.onPitRoad);
    let bestTarget: LeaderboardEntry | null = null;
    let smallestGap = Infinity;

    for (let i = 1; i < onTrack.length; i++) {
      const ahead = onTrack[i - 1];
      const chasing = onTrack[i];
      const gap = Math.abs(finiteOr(chasing.intervalSeconds, 99));
      if (gap > 0 && gap < this.config.battleGapThresholdS && gap < smallestGap) {
        smallestGap = gap;
        bestTarget = chasing;
        void ahead;
      }
    }

    if (bestTarget && bestTarget.carIdx !== this.currentCamCarIdx) {
      return this.emitSwitch(bestTarget, "close_battle", Number(smallestGap.toFixed(2)), sessionTimeS);
    }

    return null;
  }

  private emitSwitch(
    entry: LeaderboardEntry,
    reason: CameraSwitchCommand["reason"],
    gapSeconds: number | null,
    sessionTimeS: number,
  ): CameraSwitchCommand {
    this.lastSwitchAtS = sessionTimeS;
    this.currentCamCarIdx = entry.carIdx;
    const cmd: CameraSwitchCommand = {
      type: "CamSwitchPos",
      carIdx: entry.carIdx,
      carNumber: entry.carNumber,
      driverName: entry.abbrevName || entry.driverName,
      reason,
      gapSeconds,
      sessionTimeS,
    };
    this.lastCommand = cmd;
    return cmd;
  }

  public observeParallelBattle(
    carLeftRight: number,
    sessionTimeS: number,
    carNumber: string,
    driverName: string,
  ): HighlightClip | null {
    if (carLeftRight > 0) {
      if (this.parallelStartS === null) {
        this.parallelStartS = sessionTimeS;
        this.parallelClippedForStreak = false;
      }
      const elapsed = sessionTimeS - this.parallelStartS;
      if (this.config.autoClipEnabled && !this.parallelClippedForStreak && elapsed >= this.config.parallelMinSeconds) {
        this.parallelClippedForStreak = true;
        return this.addClip(sessionTimeS, carNumber, driverName, "parallel_battle", elapsed);
      }
    } else {
      this.parallelStartS = null;
      this.parallelClippedForStreak = false;
    }
    return null;
  }

  public addManualClip(sessionTimeS: number, carNumber: string, driverName: string): HighlightClip {
    return this.addClip(sessionTimeS, carNumber, driverName, "manual", 0);
  }

  private addClip(
    sessionTimeS: number,
    carNumber: string,
    driverName: string,
    reason: HighlightClip["reason"],
    durationS: number,
  ): HighlightClip {
    const clip: HighlightClip = {
      id: `clip_${Date.now()}_${this.clips.length + 1}`,
      sessionTimeS: Number(finiteOr(sessionTimeS, 0).toFixed(1)),
      formattedTime: formatSessionTimestamp(sessionTimeS),
      carNumber,
      driverName,
      reason,
      durationS: Number(durationS.toFixed(1)),
      createdAt: new Date().toISOString(),
    };
    this.clips.unshift(clip);
    return clip;
  }

  public exportCsv(): string {
    const header = "timestamp,session_seconds,car_number,driver,reason,duration_s,created_at";
    const rows = this.clips.map(
      (c) => `${c.formattedTime},${c.sessionTimeS},${c.carNumber},"${c.driverName.replace(/"/g, '""')}",${c.reason},${c.durationS},${c.createdAt}`,
    );
    return [header, ...rows].join("\n");
  }
}

export function renderBroadcastDirectorWidget(container: HTMLElement, director: BroadcastDirector): void {
  const cfg = director.getConfig();
  const cmd = director.getLastCommand();
  const clips = director.getClips().slice(0, 5);

  const clipsHtml =
    clips.length === 0
      ? `<div class="text-[11px] text-white/45">Sin clips marcados todavía (CarLeftRight &gt; 3s o botón manual).</div>`
      : clips
          .map(
            (c) => `
          <div class="flex items-center justify-between text-[11px] py-1 border-b border-white/10 last:border-0">
            <span class="text-emerald-300 font-bold">${c.formattedTime}</span>
            <span class="text-white">#${c.carNumber} ${c.driverName}</span>
            <span class="px-1.5 py-0.5 rounded bg-white/10 text-[9px] text-white/70">${c.reason === "parallel_battle" ? "PARALELO 3s+" : "MANUAL"}</span>
          </div>
        `,
          )
          .join("");

  container.innerHTML = `
    <div class="space-y-2 font-mono text-xs">
      <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span class="text-[10px] uppercase tracking-wider text-white/60">Broadcast Director (OBS)</span>
        <span class="px-1.5 py-0.5 rounded text-[9px] ${cfg.enabled ? "bg-rose-500/20 text-rose-300" : "bg-white/10 text-white/60"}">
          ${cfg.enabled ? "AUTO-CAM ON" : "MANUAL"}
        </span>
      </div>
      <div class="p-2 rounded bg-black/40 border border-white/10 text-[11px]">
        ${
          cmd
            ? `Último cambio: <strong class="text-white">#${cmd.carNumber} ${cmd.driverName}</strong> (${cmd.reason === "close_battle" ? `Batalla ${cmd.gapSeconds}s` : "Vuelta rápida"})`
            : `Esperando batalla &lt; ${cfg.battleGapThresholdS}s o vuelta rápida (hold ${cfg.minHoldSeconds}s).`
        }
      </div>
      <div class="space-y-1">${clipsHtml}</div>
    </div>
  `;
}
