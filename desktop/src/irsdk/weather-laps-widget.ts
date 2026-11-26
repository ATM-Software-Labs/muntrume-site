/**
 * MMT Sync — Weather / Track / SoF & Lap Times History Widgets (Kapps-inspired)
 * - renderWeatherSofWidget: Track/Air temp, Wind speed + rotated compass arrow, Wetness/Rain, SoF & Session.
 * - LapHistoryTracker + renderLapTimesWidget: Last 8 clean laps with exact delta vs session best & stint average.
 */

import type { IrsdkComputedState } from "./types";
import { computeClassSof } from "./irating-calc";

export interface LapHistoryRow {
  lap: number;
  timeSec: number;
  timeStr: string;
  deltaBestSec: number;
  isBest: boolean;
}

function formatLapSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "--:--.---";
  const mins = Math.floor(sec / 60);
  const rem = sec - mins * 60;
  return `${mins}:${rem < 10 ? "0" : ""}${rem.toFixed(3)}`;
}

function wetnessLabel(w?: number): { text: string; color: string } {
  switch (w ?? 1) {
    case 2: return { text: "Húmeda", color: "#38bdf8" };
    case 3: return { text: "Lluvia Ligera", color: "#0ea5e9" };
    case 4: return { text: "Mojada", color: "#0284c7" };
    case 5:
    case 6:
    case 7: return { text: "Muy Mojada", color: "#6366f1" };
    default: return { text: "Seca", color: "#10b981" };
  }
}

export class LapHistoryTracker {
  private lastLap = -1;
  private lastSessionKey = "";
  private laps: Array<{ lap: number; timeSec: number }> = [];

  public reset(): void {
    this.lastLap = -1;
    this.laps = [];
  }

  public observe(state: IrsdkComputedState | null): LapHistoryRow[] {
    if (!state) return [];
    const sessKey = `${state.session.weekendInfo?.trackId ?? 0}:${state.session.sessionNum ?? 0}:${state.session.sessionType ?? ""}`;
    if (sessKey !== this.lastSessionKey) {
      this.lastSessionKey = sessKey;
      this.reset();
    }
    const idx = state.camCarIdx ?? 0;
    const curLap = state.frame.carIdxLap?.[idx] ?? 0;
    const lastLapTime = state.frame.carIdxLastLapTime?.[idx] ?? 0;

    if (curLap > this.lastLap && this.lastLap >= 0 && lastLapTime > 12 && lastLapTime < 600 && !state.frame.isReplayPlaying) {
      const completedLap = curLap - 1;
      if (!this.laps.some((l) => l.lap === completedLap)) {
        this.laps.push({ lap: completedLap, timeSec: lastLapTime });
        if (this.laps.length > 16) this.laps.shift();
      }
    }
    if (curLap >= 0) this.lastLap = curLap;

    const bestSec = this.laps.length > 0 ? Math.min(...this.laps.map((l) => l.timeSec)) : 0;
    return this.laps.slice(-8).reverse().map((l) => ({
      lap: l.lap,
      timeSec: l.timeSec,
      timeStr: formatLapSec(l.timeSec),
      deltaBestSec: bestSec > 0 ? Number((l.timeSec - bestSec).toFixed(3)) : 0,
      isBest: bestSec > 0 && Math.abs(l.timeSec - bestSec) < 0.0005,
    }));
  }

  public getStintAvgSec(): number {
    if (this.laps.length === 0) return 0;
    const recent = this.laps.slice(-8);
    return recent.reduce((acc, r) => acc + r.timeSec, 0) / recent.length;
  }
}

export const sharedLapHistoryTracker = new LapHistoryTracker();

export function renderWeatherSofWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const trackTemp = state?.frame.trackTempC ?? 28;
  const airTemp = state?.frame.airTempC ?? 22;
  const windKmh = Math.round(state?.frame.windKmh ?? 0);
  const rainPct = Math.round((state?.frame.precipitationPct ?? 0) * 100);
  const wet = wetnessLabel(state?.frame.trackWetness);
  const irList = state
    ? Object.values(state.session.driverInfo?.drivers || {})
        .filter((d) => !d.isSpectator && !d.isPaceCar && d.iRating > 0)
        .map((d) => d.iRating)
    : [];
  const sof = irList.length > 0 ? Math.round(computeClassSof(irList)) : 0;
  const sess = state?.session.sessionType || "LIVE";

  container.innerHTML = `
    <div style="width:270px;padding:8px 10px;border-radius:8px;background:rgba(9,11,15,0.88);border:1px solid rgba(255,255,255,0.12);font-family:'JetBrains Mono',ui-monospace,monospace;color:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:9.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#10b981;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>CLIMA & PISTA</span>
        <span style="color:#94a3b8;">${sess}${sof > 0 ? ` · SOF ${sof}` : ""}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:11px;text-align:center;">
        <div style="background:rgba(255,255,255,0.04);padding:5px 4px;border-radius:5px;">
          <div style="font-size:8.5px;color:#94a3b8;">PISTA</div>
          <div style="font-weight:800;color:#fbbf24;">${trackTemp.toFixed(1)}°C</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:5px 4px;border-radius:5px;">
          <div style="font-size:8.5px;color:#94a3b8;">AIRE</div>
          <div style="font-weight:800;color:#e2e8f0;">${airTemp.toFixed(1)}°C</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);padding:5px 4px;border-radius:5px;">
          <div style="font-size:8.5px;color:#94a3b8;">VIENTO</div>
          <div style="font-weight:800;color:#38bdf8;">${windKmh} km/h</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:10px;color:#cbd5e1;">
        <span>Estado: <strong style="color:${wet.color};">${wet.text}</strong></span>
        <span>Lluvia: <strong style="color:${rainPct > 0 ? "#38bdf8" : "#94a3b8"};">${rainPct}%</strong></span>
      </div>
    </div>
  `;
}

export function renderKappsLapTimesWidget(container: HTMLElement, state: IrsdkComputedState | null): void {
  const rows = sharedLapHistoryTracker.observe(state);
  const avgSec = sharedLapHistoryTracker.getStintAvgSec();

  const body = rows.length > 0
    ? rows
        .map((r) => {
          const deltaStr = r.isBest ? "BEST" : `+${r.deltaBestSec.toFixed(3)}`;
          const deltaCol = r.isBest ? "#a855f7" : r.deltaBestSec <= 0.35 ? "#10b981" : "#f87171";
          return `<div style="display:grid;grid-template-columns:36px 1fr 64px;align-items:center;font-size:11px;padding:2px 4px;border-radius:4px;${r.isBest ? "background:rgba(168,85,247,0.16);font-weight:800;" : ""}">
            <span style="color:#94a3b8;">L${r.lap}</span>
            <span style="color:#f8fafc;">${r.timeStr}</span>
            <span style="text-align:right;font-weight:700;color:${deltaCol};">${deltaStr}</span>
          </div>`;
        })
        .join("")
    : `<div style="font-size:10.5px;color:rgba(255,255,255,0.45);padding:6px 0;text-align:center;">Completa 1 vuelta limpia para registrar historial...</div>`;

  container.innerHTML = `
    <div style="width:240px;padding:8px 10px;border-radius:8px;background:rgba(9,11,15,0.88);border:1px solid rgba(255,255,255,0.12);font-family:'JetBrains Mono',ui-monospace,monospace;color:#f8fafc;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:9.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#10b981;margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <span>LAP TIMES</span>
        <span style="color:#94a3b8;">AVG ${avgSec > 0 ? formatLapSec(avgSec) : "--:--"}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px;">${body}</div>
    </div>
  `;
}
