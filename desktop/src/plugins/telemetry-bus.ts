/**
 * MMT Sync — Local Telemetry Bus & WebSocket Server Bridge (Bloque 17)
 * Emits normalized simulator state (CamCarIdx, drivers, timing, inputs, flags, events)
 * to localhost:9090 and iframe widgets at 60 Hz / 10 Hz in clean JSON format.
 */

import type { IrsdkComputedState } from "../irsdk/types";

export interface NormalizedBusPayload {
  type: "mmt_telemetry_frame";
  timestamp: number;
  camCarIdx: number;
  playerCarIdx: number;
  isReplay: boolean;
  onPitRoad: boolean;
  car: {
    path: string;
    screenName: string;
    number: string;
  };
  track: {
    name: string;
    config: string;
    category: string;
  };
  session: {
    type: string;
    activeLap: number;
    flags: number;
  };
  inputs: {
    throttle: number; // 0.0 to 1.0
    brake: number; // 0.0 to 1.0
    clutch: number; // 0.0 to 1.0
    steeringDeg: number;
    speedKmh: number;
    gear: number;
    rpm: number;
  };
  fuel: {
    remainingL: number;
    avgBurn: number;
    lapsRemaining: number;
    fuelToAdd: number;
  };
  relative: Array<{
    carIdx: number;
    carNumber: string;
    driverName: string;
    carClass: string;
    deltaStr: string;
    deltaSeconds: number;
    isAhead: boolean;
    isActiveCam: boolean;
    onPitRoad: boolean;
  }>;
  leaderboard: Array<{
    position: number;
    classPosition: number;
    carNumber: string;
    driverName: string;
    carClass: string;
    gapStr: string;
    bestLapStr: string;
    onPitRoad: boolean;
    isActiveCam: boolean;
  }>;
}

export type BusListener = (payload: NormalizedBusPayload) => void;

export class LocalTelemetryBus {
  private static instance: LocalTelemetryBus;
  private listeners: Set<BusListener> = new Set();
  private ws: WebSocket | null = null;
  private wsConnected = false;
  private wsUrl = "ws://localhost:9090";
  private lastEmitTime = 0;
  private minIntervalMs = 16; // ~60 Hz max

  private constructor() {
    this.initWebSocketClient();
  }

  public static getInstance(): LocalTelemetryBus {
    if (!LocalTelemetryBus.instance) {
      LocalTelemetryBus.instance = new LocalTelemetryBus();
    }
    return LocalTelemetryBus.instance;
  }

  private initWebSocketClient(): void {
    if (typeof WebSocket === "undefined") return;
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.wsConnected = true;
        console.log(`[telemetry-bus] WebSocket connected to ${this.wsUrl}`);
      };
      this.ws.onclose = () => {
        this.wsConnected = false;
        // Retry connection gracefully in background every 10 seconds
        setTimeout(() => this.initWebSocketClient(), 10000);
      };
      this.ws.onerror = () => {
        this.wsConnected = false;
      };
    } catch {
      this.wsConnected = false;
    }
  }

  public normalizeState(state: IrsdkComputedState, speedKmh: number, inputs: { throttle: number; brake: number; clutch: number; steering: number; gear: number; rpm: number }): NormalizedBusPayload {
    const activeDriver = state.activeDriver;
    const frame = state.frame;
    const session = state.session;

    return {
      type: "mmt_telemetry_frame",
      timestamp: Date.now(),
      camCarIdx: state.camCarIdx,
      playerCarIdx: state.playerCarIdx,
      isReplay: state.isReplayPlaying,
      onPitRoad: state.onPitRoad,
      car: {
        path: activeDriver?.carPath || "",
        screenName: activeDriver?.carScreenName || "",
        number: activeDriver?.carNumber || String(state.camCarIdx),
      },
      track: {
        name: session.weekendInfo?.trackName || "",
        config: session.weekendInfo?.trackConfigName || "",
        category: session.weekendInfo?.category || "",
      },
      session: {
        type: session.sessionType || "",
        activeLap: frame.carIdxLap[state.camCarIdx] || 1,
        flags: frame.sessionFlags || 0,
      },
      inputs: {
        throttle: inputs.throttle,
        brake: inputs.brake,
        clutch: inputs.clutch,
        steeringDeg: Number((inputs.steering * 57.2958).toFixed(1)),
        speedKmh: Math.round(speedKmh),
        gear: inputs.gear,
        rpm: Math.round(inputs.rpm),
      },
      fuel: {
        remainingL: state.fuel.fuelRemainingL,
        avgBurn: state.fuel.avgBurnPerLap,
        lapsRemaining: state.fuel.stintLapsRemaining,
        fuelToAdd: state.fuel.fuelToAdd,
      },
      relative: state.relative.entries.map((e) => ({
        carIdx: e.carIdx,
        carNumber: e.carNumber,
        driverName: e.abbrevName,
        carClass: e.carClassShortName,
        deltaStr: e.deltaStr,
        deltaSeconds: e.deltaSeconds,
        isAhead: e.isAhead,
        isActiveCam: e.isActiveCam,
        onPitRoad: e.onPitRoad,
      })),
      leaderboard: state.leaderboard.slice(0, 10).map((e) => ({
        position: e.position,
        classPosition: e.classPosition,
        carNumber: e.carNumber,
        driverName: e.abbrevName,
        carClass: e.carClassShortName,
        gapStr: e.gapStr,
        bestLapStr: e.bestLapStr,
        onPitRoad: e.onPitRoad,
        isActiveCam: e.isActiveCam,
      })),
    };
  }

  public publish(state: IrsdkComputedState, speedKmh: number, inputs: { throttle: number; brake: number; clutch: number; steering: number; gear: number; rpm: number }): void {
    const now = Date.now();
    if (now - this.lastEmitTime < this.minIntervalMs) return;
    this.lastEmitTime = now;

    const payload = this.normalizeState(state, speedKmh, inputs);

    // 1. Notify internal in-process subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (e) {
        console.error("[telemetry-bus] Error notifying listener:", e);
      }
    });

    // 2. Broadcast to embedded plugin iframes via postMessage
    if (typeof window !== "undefined") {
      window.postMessage(payload, "*");
    }

    // 3. Send over local WebSocket if connected
    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {}
    }
  }

  public subscribe(listener: BusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSubscriberCount(): number {
    return this.listeners.size;
  }
}
