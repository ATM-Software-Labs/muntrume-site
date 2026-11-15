import { IrsdkClient } from "../irsdk/irsdk-client";
import type { IrsdkTelemetryFrame } from "../irsdk/types";

export type MonitorType = "single" | "triple" | "vr";
export type HudVisualTheme = "dark-carbon" | "minimal-transparent" | "high-contrast";

export interface OnboardingPrefs {
  monitorType: MonitorType;
  hudTheme: HudVisualTheme;
  spotterEnabled: boolean;
}

const FIRST_RUN_KEY = "mmt_first_run_done";
const PREFS_KEY = "mmt_onboarding_prefs";

const DEFAULT_PREFS: OnboardingPrefs = {
  monitorType: "single",
  hudTheme: "dark-carbon",
  spotterEnabled: true,
};

export function isFirstRun(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markFirstRunDone(): void {
  try {
    localStorage.setItem(FIRST_RUN_KEY, "1");
  } catch {
    // ignore storage errors
  }
}

export function loadOnboardingPrefs(): OnboardingPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<OnboardingPrefs>;
    return {
      monitorType: parsed.monitorType === "triple" || parsed.monitorType === "vr" ? parsed.monitorType : "single",
      hudTheme:
        parsed.hudTheme === "minimal-transparent" || parsed.hudTheme === "high-contrast"
          ? parsed.hudTheme
          : "dark-carbon",
      spotterEnabled: typeof parsed.spotterEnabled === "boolean" ? parsed.spotterEnabled : true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveOnboardingPrefs(prefs: OnboardingPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
  applyOnboardingVisuals(prefs);
}

export function applyOnboardingVisuals(prefs: OnboardingPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.hudTheme = prefs.hudTheme;
  root.dataset.monitorMode = prefs.monitorType;
  root.dataset.spotterEnabled = prefs.spotterEnabled ? "1" : "0";
}

const DEMO_SESSION_YAML = `---
WeekendInfo:
 TrackName: fuji gp
 TrackDisplayName: Fuji International Speedway
 TrackConfigName: Grand Prix
 TrackID: 390
 TrackLength: 4.56 km
 Category: Road
 SessionType: Practice
DriverInfo:
 DriverCarIdx: 0
 DriverCarEstLapTime: 97.420
 Drivers:
 - CarIdx: 0
   UserName: Piloto Demo MMT
   AbbrevName: Demo P.
   Initials: PD
   UserID: 999001
   CarNumber: "48"
   CarNumberRaw: 48
   CarPath: bmwm4gt3
   CarScreenName: BMW M4 GT3
   CarScreenNameShort: BMW M4 GT3
   CarClassShortName: GT3
   CarClassColor: 0x00d97e
   CarClassEstLapTime: 97.420
   IRating: 2450
   LicLevel: 18
   LicSubLevel: 340
   LicString: A 3.40
   LicColor: 0x0153db
   IsSpectator: 0
   CarIsPaceCar: 0
   CarIsAI: 0
 - CarIdx: 1
   UserName: Marc Vermeer
   AbbrevName: Vermeer M.
   Initials: MV
   UserID: 999002
   CarNumber: "12"
   CarNumberRaw: 12
   CarPath: porsche992gt3r
   CarScreenName: Porsche 911 GT3 R (992)
   CarScreenNameShort: Porsche GT3 R
   CarClassShortName: GT3
   CarClassColor: 0x00d97e
   CarClassEstLapTime: 97.100
   IRating: 2890
   LicLevel: 19
   LicSubLevel: 410
   LicString: A 4.10
   LicColor: 0x0153db
   IsSpectator: 0
   CarIsPaceCar: 0
   CarIsAI: 0
 - CarIdx: 2
   UserName: Lucas Moretti
   AbbrevName: Moretti L.
   Initials: LM
   UserID: 999003
   CarNumber: "7"
   CarNumberRaw: 7
   CarPath: ferrari296gt3
   CarScreenName: Ferrari 296 GT3
   CarScreenNameShort: Ferrari 296
   CarClassShortName: GT3
   CarClassColor: 0x00d97e
   CarClassEstLapTime: 98.050
   IRating: 2120
   LicLevel: 15
   LicSubLevel: 280
   LicString: B 2.80
   LicColor: 0x00c702
   IsSpectator: 0
   CarIsPaceCar: 0
   CarIsAI: 0
`;

/**
 * Generates a realistic 60 FPS simulated telemetry loop so pilots can position
 * and scale overlays without launching iRacing.
 */
export class DemoOverlaySimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  isRunning(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null) return;
    const client = IrsdkClient.getInstance();
    client.updateSessionInfo(DEMO_SESSION_YAML, 1);

    this.timer = setInterval(() => {
      this.tickCount++;
      const t = this.tickCount / 60; // seconds at 60 FPS
      const lapTime = 97.42;
      const pct = (t % lapTime) / lapTime;
      const phase = pct * Math.PI * 2;

      // Synthetic cornering profile (straight -> heavy braking -> apex -> exit)
      const brakeWave = Math.max(0, Math.sin(phase * 3 - 0.5));
      const isBraking = brakeWave > 0.65;
      const throttle = isBraking ? 0.05 : Math.min(1, Math.max(0.25, 0.72 + 0.32 * Math.cos(phase * 3)));
      const brake = isBraking ? Math.min(0.95, (brakeWave - 0.65) * 2.8) : 0;
      const speedKmh = Math.max(72, Math.min(268, 175 + 88 * Math.cos(phase * 3)));
      const gear = speedKmh > 235 ? 6 : speedKmh > 195 ? 5 : speedKmh > 155 ? 4 : speedKmh > 115 ? 3 : 2;
      const rpm = 4800 + ((speedKmh % 42) / 42) * 3100;
      const steering = Math.sin(phase * 3 + 0.4) * 0.45;

      const empty64Num = new Array<number>(64).fill(-1);
      const empty64Bool = new Array<boolean>(64).fill(false);
      const lapDist = [...empty64Num];
      lapDist[0] = pct;
      lapDist[1] = (pct + 0.024) % 1;
      lapDist[2] = (pct + 0.978) % 1;

      const pos = new Array<number>(64).fill(0);
      pos[0] = 2;
      pos[1] = 1;
      pos[2] = 3;

      const bestLap = [...empty64Num];
      bestLap[0] = 97.42;
      bestLap[1] = 97.11;
      bestLap[2] = 98.05;

      const lastLap = [...empty64Num];
      lastLap[0] = 97.68;
      lastLap[1] = 97.29;
      lastLap[2] = 98.41;

      const laps = new Array<number>(64).fill(0);
      laps[0] = 4 + Math.floor(t / lapTime);
      laps[1] = laps[0];
      laps[2] = laps[0];

      const surface = new Array<number>(64).fill(3);

      const frame: IrsdkTelemetryFrame = {
        sessionTime: t,
        sessionTimeRemain: Math.max(0, 1800 - t),
        sessionLapsRemainEx: 20,
        sessionState: 4,
        sessionFlags: 0x0004,
        sessionNum: 0,
        camCarIdx: 0,
        playerCarIdx: 0,
        isReplayPlaying: false,
        onPitRoad: false,
        speedKmh,
        rpm,
        gear,
        throttle,
        brake,
        clutch: 0,
        steering,
        fuelLevel: Math.max(2, 48.5 - t * 0.03),
        fuelLevelPct: Math.max(0.05, 0.48 - t * 0.0003),
        trackTempC: 27.4,
        airTempC: 21.2,
        windKmh: 9.5,
        carIdxLapDistPct: lapDist,
        carIdxPosition: pos,
        carIdxClassPosition: pos,
        carIdxF2Time: [...empty64Num],
        carIdxEstTime: [...empty64Num],
        carIdxBestLapTime: bestLap,
        carIdxLastLapTime: lastLap,
        carIdxLap: laps,
        carIdxOnPitRoad: empty64Bool,
        carIdxTrackSurface: surface,
      };

      client.processTelemetryFrame(frame);
    }, 1000 / 60);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const demoOverlaySimulator = new DemoOverlaySimulator();
