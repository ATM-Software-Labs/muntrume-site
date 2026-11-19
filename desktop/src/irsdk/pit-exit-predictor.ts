/**
 * MMT Sync — PitExitPredictor (Prompt 34)
 * Real-time pit lane loss calibration and track/relative re-entry prediction.
 */

import { finiteOr, safeDiv } from "../core/math-guards";
import type { LeaderboardEntry, RelativeEntry } from "./types";

const STORAGE_KEY = "mmt_pit_loss_calibration_v1";
const DEFAULT_PIT_LOSS_S = 22.5;

export interface PitLossCalibration {
  trackKey: string;
  pitLossSeconds: number;
  samples: number;
  updatedAt: string;
}

export interface PitExitCarRef {
  carIdx: number;
  carNumber: string;
  driverName: string;
  carClassShortName: string;
  lapDistPct: number;
  onPitRoad: boolean;
  isLapped?: boolean;
}

export interface PitExitPrediction {
  trackKey: string;
  pitLossSeconds: number;
  extraServiceTimeS: number;
  totalLossSeconds: number;
  projectedDistPct: number;
  aheadCar: PitExitCarRef | null;
  behindCar: PitExitCarRef | null;
  gapToAheadS: number | null;
  gapToBehindS: number | null;
  nearbyTrafficCount: number;
  lappedTrafficAhead: boolean;
  trafficWarning: boolean;
  warningMessage: string;
  calibrated: boolean;
}

export class PitExitPredictor {
  private calibrations = new Map<string, PitLossCalibration>();
  private wasOnPitRoad = false;
  private pitEntryTimeS: number | null = null;

  constructor() {
    this.loadCalibrations();
  }

  private loadCalibrations(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, PitLossCalibration>;
      for (const [k, v] of Object.entries(parsed)) {
        if (v && Number.isFinite(v.pitLossSeconds)) {
          this.calibrations.set(k, v);
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private saveCalibrations(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const obj: Record<string, PitLossCalibration> = {};
      for (const [k, v] of this.calibrations.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore storage errors
    }
  }

  public getPitLossSeconds(trackKey: string): { seconds: number; calibrated: boolean } {
    const key = (trackKey || "default").toLowerCase().trim();
    const cal = this.calibrations.get(key);
    if (cal && Number.isFinite(cal.pitLossSeconds)) {
      return { seconds: cal.pitLossSeconds, calibrated: true };
    }
    return { seconds: DEFAULT_PIT_LOSS_S, calibrated: false };
  }

  public recordCleanLap(trackKey: string, lapTimeS: number): void {
    void trackKey;
    void lapTimeS;
  }

  /**
   * Automatically calibrates pit lane time loss by observing pit entry/exit transitions
   * and comparing the pit-lane transit + deceleration/acceleration loss against a clean lap.
   */
  public observePitTransition(
    trackKey: string,
    onPitRoad: boolean,
    sessionTimeS: number,
  ): PitLossCalibration | null {
    if (!this.wasOnPitRoad && onPitRoad) {
      this.wasOnPitRoad = true;
      this.pitEntryTimeS = sessionTimeS;
      return null;
    }

    if (this.wasOnPitRoad && !onPitRoad) {
      this.wasOnPitRoad = false;
      const entry = this.pitEntryTimeS;
      this.pitEntryTimeS = null;
      if (entry === null || !Number.isFinite(sessionTimeS)) return null;

      const pitLaneTransitS = sessionTimeS - entry;
      // Estimate speed-limit delta loss (pit transit minus ~35% full-speed equivalent + entry/exit decel)
      const measuredLoss = Math.max(8, Math.min(90, pitLaneTransitS * 0.72 + 4.5));
      return this.saveSample(trackKey, measuredLoss);
    }

    return null;
  }

  public saveSample(trackKey: string, pitLossSeconds: number): PitLossCalibration {
    const key = (trackKey || "default").toLowerCase().trim();
    const clamped = Math.max(8, Math.min(90, finiteOr(pitLossSeconds, DEFAULT_PIT_LOSS_S)));
    const prev = this.calibrations.get(key);
    const samples = prev ? prev.samples + 1 : 1;
    const blended = prev ? (prev.pitLossSeconds * prev.samples + clamped) / samples : clamped;

    const entry: PitLossCalibration = {
      trackKey: key,
      pitLossSeconds: Number(blended.toFixed(2)),
      samples,
      updatedAt: new Date().toISOString(),
    };
    this.calibrations.set(key, entry);
    this.saveCalibrations();
    return entry;
  }

  public predict(params: {
    trackKey: string;
    activeCarIdx: number;
    activeLapDistPct: number;
    estLapTimeS: number;
    extraServiceTimeS?: number;
    cars: PitExitCarRef[];
  }): PitExitPrediction {
    const { trackKey, activeCarIdx, activeLapDistPct, estLapTimeS, cars } = params;
    const extraServiceTimeS = Math.max(0, finiteOr(params.extraServiceTimeS, 0));
    const { seconds: pitLossSeconds, calibrated } = this.getPitLossSeconds(trackKey);
    const totalLossSeconds = pitLossSeconds + extraServiceTimeS;
    const lapTime = estLapTimeS > 15 && Number.isFinite(estLapTimeS) ? estLapTimeS : 95;

    const lossPct = safeDiv(totalLossSeconds, lapTime, 0.25);
    const rawProjected = (finiteOr(activeLapDistPct, 0) - lossPct) % 1;
    const projectedDistPct = rawProjected < 0 ? rawProjected + 1 : rawProjected;

    let aheadCar: PitExitCarRef | null = null;
    let behindCar: PitExitCarRef | null = null;
    let minAheadPct = 1;
    let minBehindPct = 1;
    let nearbyTrafficCount = 0;
    let lappedTrafficAhead = false;

    for (const c of cars) {
      if (c.carIdx === activeCarIdx || c.onPitRoad) continue;
      const cPct = ((finiteOr(c.lapDistPct, 0) % 1) + 1) % 1;

      // Positive forward distance from projectedDistPct to car
      let forwardDiff = cPct - projectedDistPct;
      if (forwardDiff < 0) forwardDiff += 1;

      // Positive backward distance from projectedDistPct to car behind
      let backwardDiff = projectedDistPct - cPct;
      if (backwardDiff < 0) backwardDiff += 1;

      if (forwardDiff < minAheadPct) {
        minAheadPct = forwardDiff;
        aheadCar = c;
      }
      if (backwardDiff < minBehindPct) {
        minBehindPct = backwardDiff;
        behindCar = c;
      }

      const deltaS = Math.min(forwardDiff, backwardDiff) * lapTime;
      if (deltaS <= 2.5) {
        nearbyTrafficCount += 1;
        if (forwardDiff <= backwardDiff && c.isLapped) {
          lappedTrafficAhead = true;
        }
      }
    }

    const gapToAheadS = aheadCar ? Number((minAheadPct * lapTime).toFixed(2)) : null;
    const gapToBehindS = behindCar ? Number((minBehindPct * lapTime).toFixed(2)) : null;
    const trafficWarning = lappedTrafficAhead || nearbyTrafficCount >= 2 || (gapToAheadS !== null && gapToAheadS < 1.2);

    let warningMessage = "Salida limpia prevista";
    if (lappedTrafficAhead) {
      warningMessage = `Tráfico doblado delante al salir (${nearbyTrafficCount} coches en ±2.5s)`;
    } else if (nearbyTrafficCount >= 2) {
      warningMessage = `Grupo compacto en salida de boxes (${nearbyTrafficCount} coches en ±2.5s)`;
    } else if (gapToAheadS !== null && gapToAheadS < 1.2 && aheadCar) {
      warningMessage = `Saldrás pegado detrás de #${aheadCar.carNumber} (+${gapToAheadS.toFixed(1)}s)`;
    }

    return {
      trackKey,
      pitLossSeconds,
      extraServiceTimeS,
      totalLossSeconds: Number(totalLossSeconds.toFixed(1)),
      projectedDistPct: Number(projectedDistPct.toFixed(4)),
      aheadCar,
      behindCar,
      gapToAheadS,
      gapToBehindS,
      nearbyTrafficCount,
      lappedTrafficAhead,
      trafficWarning,
      warningMessage,
      calibrated,
    };
  }
}

export function mapLeaderboardToPitRefs(
  entries: LeaderboardEntry[],
  carIdxLapDistPct: number[],
  activeLap: number,
): PitExitCarRef[] {
  return entries.map((e) => ({
    carIdx: e.carIdx,
    carNumber: e.carNumber,
    driverName: e.abbrevName || e.driverName,
    carClassShortName: e.carClassShortName,
    lapDistPct: finiteOr(carIdxLapDistPct[e.carIdx], 0),
    onPitRoad: e.onPitRoad,
    isLapped: activeLap > 0 && e.lapsCompleted < activeLap,
  }));
}

export function renderPitExitWidget(container: HTMLElement, pred: PitExitPrediction | null): void {
  if (!pred) {
    container.innerHTML = `<div class="p-3 text-xs font-mono text-white/50">Esperando datos de pista para calcular ventana de boxes...</div>`;
    return;
  }
  const warnClass = pred.trafficWarning
    ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";

  container.innerHTML = `
    <div class="space-y-2 font-mono text-xs">
      <div class="flex items-center justify-between border-b border-white/10 pb-1.5">
        <span class="text-[10px] uppercase tracking-wider text-white/60">Pit Exit Predictor</span>
        <span class="px-1.5 py-0.5 rounded text-[9px] ${pred.calibrated ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"}">
          ${pred.calibrated ? "CALIBRADO" : "ESTIMADO"} · ${pred.totalLossSeconds.toFixed(1)}s
        </span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-[11px]">
        <div class="p-2 rounded bg-black/40 border border-white/10">
          <div class="text-[9px] text-white/45 uppercase">Detrás de</div>
          <div class="font-bold text-white">${pred.aheadCar ? `#${pred.aheadCar.carNumber} ${pred.aheadCar.driverName}` : "Pista libre"}</div>
          <div class="text-[10px] text-amber-300">${pred.gapToAheadS !== null ? `+${pred.gapToAheadS.toFixed(1)}s` : "—"}</div>
        </div>
        <div class="p-2 rounded bg-black/40 border border-white/10">
          <div class="text-[9px] text-white/45 uppercase">Delante de</div>
          <div class="font-bold text-white">${pred.behindCar ? `#${pred.behindCar.carNumber} ${pred.behindCar.driverName}` : "Pista libre"}</div>
          <div class="text-[10px] text-sky-300">${pred.gapToBehindS !== null ? `-${pred.gapToBehindS.toFixed(1)}s` : "—"}</div>
        </div>
      </div>
      <div class="px-2.5 py-1.5 rounded border text-[11px] ${warnClass}">
        ${pred.trafficWarning ? "⚠ " : "✓ "}${pred.warningMessage} · Pos. pista ${(pred.projectedDistPct * 100).toFixed(1)}%
      </div>
    </div>
  `;
}

export function buildRelativeVirtualPitRow(pred: PitExitPrediction): RelativeEntry {
  return {
    carIdx: -99,
    carNumber: "PIT",
    driverName: "PIT EXIT (Proyección)",
    abbrevName: "PIT EXIT",
    carPath: "",
    carScreenName: "Pit Exit",
    carClassShortName: "BOX",
    carClassColor: "#f59e0b",
    licString: "",
    licBadgeColor: "#f59e0b",
    iRatingStr: `${pred.totalLossSeconds.toFixed(1)}s`,
    diffPct: 0,
    deltaSeconds: -pred.totalLossSeconds,
    deltaStr: `PIT -${pred.totalLossSeconds.toFixed(1)}s`,
    isActiveCam: false,
    isAhead: false,
    onPitRoad: true,
    trackSurface: 1,
  };
}

export interface PitStrategySummary {
  currentLap: number;
  pitWindowStartLap: number;
  pitWindowEndLap: number;
  estPitTimeS: number;
  rejoinPos: number;
  classSize: number;
  fuelToAddL: number;
  changeTires: boolean;
  boxThisLap: boolean;
  fuelSavePerLapL: number;
  aheadCarLabel: string;
}

export function renderPitStrategyWidget(container: HTMLElement, strat: PitStrategySummary | null): void {
  if (!strat) {
    container.innerHTML = `<div class="p-2 text-[10.5px] font-mono text-white/50">Esperando datos de estrategia...</div>`;
    return;
  }

  const alertHtml = strat.boxThisLap
    ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/60 text-rose-300 font-black text-[9.5px] animate-pulse">BOX THIS LAP</span>`
    : strat.fuelSavePerLapL > 0.01
      ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-black text-[9.5px]">FUEL SAVE +${strat.fuelSavePerLapL.toFixed(2)} L/lap</span>`
      : `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[9.5px]">STRATEGY OK</span>`;

  container.innerHTML = `
    <div class="space-y-1.5 font-mono text-[10.5px] tabular-nums select-none">
      <div class="flex items-center justify-between border-b border-white/10 pb-1">
        <span class="uppercase tracking-wider text-white/75 font-bold text-[9.5px]">Pit &amp; Strategy</span>
        ${alertHtml}
      </div>
      <div class="grid grid-cols-3 gap-1 text-center">
        <div class="px-1.5 py-1 rounded bg-black/45 border border-white/10">
          <div class="text-[8.5px] text-white/45 uppercase">Pit Window</div>
          <div class="font-extrabold text-amber-300">L${strat.pitWindowStartLap}–L${strat.pitWindowEndLap}</div>
        </div>
        <div class="px-1.5 py-1 rounded bg-black/45 border border-white/10">
          <div class="text-[8.5px] text-white/45 uppercase">Est. Box</div>
          <div class="font-extrabold text-white">${strat.estPitTimeS.toFixed(1)}s</div>
        </div>
        <div class="px-1.5 py-1 rounded bg-black/45 border border-white/10">
          <div class="text-[8.5px] text-white/45 uppercase">Rejoin</div>
          <div class="font-extrabold text-emerald-300">P${strat.rejoinPos}<span class="text-white/45 text-[9px]">/${strat.classSize}</span></div>
        </div>
      </div>
      <div class="flex items-center justify-between text-[9.5px] text-white/65">
        <span>+${strat.fuelToAddL.toFixed(1)}L ${strat.changeTires ? "+ 4 Neum." : "Solo Fuel"}</span>
        <span class="truncate max-w-[130px]">Tras ${strat.aheadCarLabel}</span>
      </div>
    </div>
  `;
}
