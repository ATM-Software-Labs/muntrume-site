/**
 * MMT Sync — iRacing SDK Client Coordinator (Bloque 1)
 * High-performance dispatcher:
 * - Updates SessionInfo only when SessionInfoUpdate increments.
 * - Computes Relative, Leaderboard, and Fuel state at 10-15 Hz.
 * - Exposes fast 60 Hz input updates.
 */

import { RelativeEngine } from "./relative-engine";
import { LeaderboardEngine } from "./leaderboard-engine";
import { FuelCalculator } from "./fuel-calculator";
import { parseSessionInfoYaml } from "./yaml-parser";
import { MockTelemetryProvider } from "./mock-telemetry";
import type {
  IrsdkComputedState,
  IrsdkTelemetryFrame,
  SessionInfoState,
} from "./types";

export type IrsdkListener = (state: IrsdkComputedState) => void;

export class IrsdkClient {
  private static instance: IrsdkClient | null = null;

  private relativeEngine: RelativeEngine = new RelativeEngine();
  private leaderboardEngine: LeaderboardEngine = new LeaderboardEngine();
  private fuelCalculator: FuelCalculator = new FuelCalculator();
  private mockProvider: MockTelemetryProvider = new MockTelemetryProvider();

  private sessionState: SessionInfoState;
  private lastSessionInfoUpdate: number = -1;
  private listeners: Set<IrsdkListener> = new Set();
  private isSimulated: boolean = true;
  private simTimer: number | null = null;

  private latestState: IrsdkComputedState | null = null;

  public static getInstance(): IrsdkClient {
    if (!IrsdkClient.instance) {
      IrsdkClient.instance = new IrsdkClient();
    }
    return IrsdkClient.instance;
  }

  constructor() {
    this.sessionState = this.mockProvider.getSessionInfo();
    this.lastSessionInfoUpdate = this.sessionState.update;
  }

  public subscribe(listener: IrsdkListener): () => void {
    this.listeners.add(listener);
    if (this.latestState) {
      listener(this.latestState);
    }
    return () => this.listeners.delete(listener);
  }

  public getLatestState(): IrsdkComputedState | null {
    return this.latestState;
  }

  /**
   * Sets the session info YAML only when update integer increments
   */
  public updateSessionInfo(yaml: string, updateNum: number): void {
    if (updateNum <= this.lastSessionInfoUpdate && this.lastSessionInfoUpdate !== -1) {
      return; // Skip duplicate / stale updates
    }
    this.sessionState = parseSessionInfoYaml(yaml, updateNum);
    this.lastSessionInfoUpdate = updateNum;
  }

  /**
   * Processes a live or replay telemetry frame at 10-15 Hz
   */
  public processTelemetryFrame(frame: IrsdkTelemetryFrame): IrsdkComputedState {
    const camCarIdx =
      frame.camCarIdx >= 0 && frame.camCarIdx <= 63
        ? frame.camCarIdx
        : frame.playerCarIdx >= 0 && frame.playerCarIdx <= 63
        ? frame.playerCarIdx
        : 0;

    const activeDriver = this.sessionState.driverInfo.drivers[camCarIdx] || null;

    // 1. Relative computation
    const relative = this.relativeEngine.compute(frame, this.sessionState.driverInfo);

    // 2. Leaderboard computation
    const leaderboard = this.leaderboardEngine.compute(
      frame,
      this.sessionState.driverInfo,
      this.sessionState.sessionType
    );

    // 3. Fuel calculation
    const baselineEstLap =
      activeDriver?.carClassEstLapTime && activeDriver.carClassEstLapTime > 10
        ? activeDriver.carClassEstLapTime
        : this.sessionState.driverInfo.driverCarEstLapTime;
    const fuel = this.fuelCalculator.update(frame, baselineEstLap);

    const computed: IrsdkComputedState = {
      camCarIdx,
      playerCarIdx: frame.playerCarIdx,
      isReplayPlaying: !!frame.isReplayPlaying,
      onPitRoad: !!frame.onPitRoad,
      activeDriver,
      relative: {
        entries: relative.entries,
        carAhead: relative.carAhead,
        carBehind: relative.carBehind,
      },
      leaderboard,
      fuel,
      frame,
      session: this.sessionState,
    };

    this.latestState = computed;
    this.listeners.forEach((cb) => {
      try {
        cb(computed);
      } catch (err) {
        console.error("[irsdk-client] listener error:", err);
      }
    });

    return computed;
  }

  /**
   * Starts mock simulated stream for testing & offline mode
   */
  public startSimulation(intervalMs: number = 70): void {
    if (this.simTimer) return;
    this.isSimulated = true;
    this.simTimer = window.setInterval(() => {
      const frame = this.mockProvider.nextFrame(false, false);
      this.processTelemetryFrame(frame);
    }, intervalMs);
  }

  public stopSimulation(): void {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    this.isSimulated = false;
  }

  public isSimulating(): boolean {
    return this.isSimulated;
  }
}
