/**
 * MMT Sync — Fuel Computer Engine (Bloque 1)
 * High-resilience fuel calculation. Strictly shields against division by zero (NaN/Infinity),
 * disables calculations on pit road or in replays (showing -- L), and computes 5-lap average,
 * max burn, lift & coast, and exact fuel to add with +0.2 L safety margin.
 */

import type { FuelCalculation, IrsdkTelemetryFrame } from "./types";

export class FuelCalculator {
  private lastLapNumber: number = -1;
  private lapStartFuel: number = 0;
  private completedLapsBurn: number[] = []; // Last 5 valid completed lap consumptions
  private wasOnPitRoad: boolean = false;
  private safetyMarginL: number = 0.2;

  /**
   * Resets telemetry session history
   */
  public reset(): void {
    this.lastLapNumber = -1;
    this.lapStartFuel = 0;
    this.completedLapsBurn = [];
    this.wasOnPitRoad = false;
  }

  /**
   * Processes a telemetry frame and computes fuel metrics
   */
  public update(frame: IrsdkTelemetryFrame, estLapTimeS: number = 90.0): FuelCalculation {
    const currentFuel = frame.fuelLevel;
    const currentFuelPct = frame.fuelLevelPct;
    const activeCarIdx = frame.camCarIdx >= 0 && frame.camCarIdx <= 63 ? frame.camCarIdx : frame.playerCarIdx;
    const lapNum = (frame.carIdxLap && frame.carIdxLap[activeCarIdx]) ?? 0;
    const onPit = !!frame.onPitRoad || (frame.carIdxOnPitRoad && !!frame.carIdxOnPitRoad[activeCarIdx]);
    const isReplay = !!frame.isReplayPlaying;

    // Detect lap completion to track fuel burn per lap
    if (this.lastLapNumber === -1) {
      if (lapNum > 0 && !onPit && !isReplay && currentFuel > 0) {
        this.lastLapNumber = lapNum;
        this.lapStartFuel = currentFuel;
      }
    } else if (lapNum > this.lastLapNumber) {
      // Completed a lap! Check validity
      if (!this.wasOnPitRoad && !onPit && !isReplay && this.lapStartFuel > currentFuel) {
        const burn = this.lapStartFuel - currentFuel;
        // Plausibility check (between 0.5 L and 15.0 L per lap)
        if (burn >= 0.5 && burn <= 15.0) {
          this.completedLapsBurn.push(burn);
          if (this.completedLapsBurn.length > 5) {
            this.completedLapsBurn.shift();
          }
        }
      }
      this.lastLapNumber = lapNum;
      this.lapStartFuel = currentFuel;
      this.wasOnPitRoad = onPit;
    }

    if (onPit) {
      this.wasOnPitRoad = true;
    }

    // Shielding conditions: Pit road, Replay, or less than 1 valid lap
    let isValid = true;
    let reasonNotReady: string | null = null;

    if (isReplay) {
      isValid = false;
      reasonNotReady = "Replay en curso";
    } else if (onPit) {
      isValid = false;
      reasonNotReady = "En calle de boxes";
    } else if (this.completedLapsBurn.length < 1) {
      isValid = false;
      reasonNotReady = "Calibrando (falta 1 vuelta limpia)";
    } else if (currentFuel <= 0 || !isFinite(currentFuel)) {
      isValid = false;
      reasonNotReady = "Sin lectura de combustible";
    }

    // Default safe values when not valid (avoiding NaN or Infinity)
    if (!isValid) {
      return {
        isValid: false,
        reasonNotReady,
        fuelRemainingL: isFinite(currentFuel) && currentFuel > 0 ? Number(currentFuel.toFixed(1)) : 0,
        fuelRemainingPct: isFinite(currentFuelPct) && currentFuelPct > 0 ? Number(currentFuelPct.toFixed(3)) : 0,
        avgBurnPerLap: 0,
        maxBurnPerLap: 0,
        liftAndCoastTarget: 0,
        lapsRemaining: 0,
        fuelNeededToFinish: 0,
        fuelToAdd: 0,
        safetyMarginL: this.safetyMarginL,
        stintLapsRemaining: 0,
        completedLapsSampled: this.completedLapsBurn.length,
      };
    }

    // 1. Average burn of last 5 valid completed laps
    const sumBurn = this.completedLapsBurn.reduce((a, b) => a + b, 0);
    const count = this.completedLapsBurn.length;
    const avgBurn = count > 0 ? sumBurn / count : 0;
    const maxBurn = count > 0 ? Math.max(...this.completedLapsBurn) : 0;

    // 2. Lift & Coast saving target (5% less than average burn)
    const liftAndCoast = avgBurn > 0 ? avgBurn * 0.95 : 0;

    // 3. Estimate laps remaining in race/session
    let lapsRemaining = 0;
    if (frame.sessionLapsRemainEx > 0 && frame.sessionLapsRemainEx < 500) {
      lapsRemaining = frame.sessionLapsRemainEx;
    } else if (frame.sessionTimeRemain > 0 && estLapTimeS > 10) {
      lapsRemaining = Math.max(0, Math.ceil(frame.sessionTimeRemain / estLapTimeS));
    }

    // 4. Stint laps remaining with current fuel onboard
    const stintLapsRemaining = avgBurn > 0 ? currentFuel / avgBurn : 0;

    // 5. Fuel needed to finish with +0.2 L safety margin
    const fuelNeeded = lapsRemaining * avgBurn;
    const fuelDeficit = fuelNeeded - currentFuel;
    const fuelToAdd = fuelDeficit > 0 ? fuelDeficit + this.safetyMarginL : 0;

    // Guarantee finite, non-negative numbers
    const safeNum = (v: number, decimals: number = 2) => (isFinite(v) && v >= 0 ? Number(v.toFixed(decimals)) : 0);

    return {
      isValid: true,
      reasonNotReady: null,
      fuelRemainingL: safeNum(currentFuel, 1),
      fuelRemainingPct: safeNum(currentFuelPct, 3),
      avgBurnPerLap: safeNum(avgBurn, 2),
      maxBurnPerLap: safeNum(maxBurn, 2),
      liftAndCoastTarget: safeNum(liftAndCoast, 2),
      lapsRemaining: safeNum(lapsRemaining, 0),
      fuelNeededToFinish: safeNum(fuelNeeded, 1),
      fuelToAdd: safeNum(fuelToAdd, 1),
      safetyMarginL: this.safetyMarginL,
      stintLapsRemaining: safeNum(stintLapsRemaining, 1),
      completedLapsSampled: count,
    };
  }

  /**
   * Helper to format fuel widget values safely
   */
  public static formatLiters(value: number, isValid: boolean): string {
    if (!isValid || value <= 0 || !isFinite(value)) return "-- L";
    return `${value.toFixed(1)} L`;
  }
}
