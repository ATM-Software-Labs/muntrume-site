/**
 * MMT Sync — Mock iRacing SDK Session & Telemetry Generator (Bloque 1)
 * Simulates a realistic multiclass IMSA race (GTP, LMP2, GT3) at Sebring
 * with 16 drivers, dynamic relative wraparound, pit stops, and fuel burn.
 */

import type { IrsdkTelemetryFrame, SessionInfoState } from "./types";
import { parseSessionInfoYaml } from "./yaml-parser";

export const MOCK_SESSION_INFO_YAML = `
WeekendInfo:
  TrackName: "sebring international raceway"
  TrackConfigName: "international"
  TrackID: 95
  Category: "Road"
  TrackLength: "6.02 km"
  SessionType: "Race"

DriverInfo:
  DriverCarIdx: 3
  DriverCarEstLapTime: 118.4
  Drivers:
  - CarIdx: 0
    UserName: "Pace Car"
    CarNumber: "0"
    CarPath: "safetycar"
    CarClassShortName: "PACE"
    CarIsPaceCar: 1
    IsSpectator: 0
  - CarIdx: 1
    UserName: "Mathieu Jaminet"
    AbbrevName: "M. Jaminet"
    CarNumber: "6"
    CarPath: "porsche963gtp"
    CarScreenName: "Porsche 963 GTP"
    CarClassShortName: "GTP"
    CarClassColor: 0xe11d48
    CarClassEstLapTime: 108.2
    IRating: 6240
    LicString: "A 4.99"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 2
    UserName: "Felipe Nasr"
    AbbrevName: "F. Nasr"
    CarNumber: "7"
    CarPath: "porsche963gtp"
    CarScreenName: "Porsche 963 GTP"
    CarClassShortName: "GTP"
    CarClassColor: 0xe11d48
    CarClassEstLapTime: 108.5
    IRating: 5890
    LicString: "A 4.85"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 3
    UserName: "Alberto (Tú)"
    AbbrevName: "Alberto"
    CarNumber: "16"
    CarPath: "ferrari296gt3"
    CarScreenName: "Ferrari 296 GT3"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 119.5
    IRating: 2840
    LicString: "A 3.90"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 4
    UserName: "Renger van der Zande"
    AbbrevName: "R. v.d. Zande"
    CarNumber: "01"
    CarPath: "cadillacvseriesrgtp"
    CarScreenName: "Cadillac V-Series.R"
    CarClassShortName: "GTP"
    CarClassColor: 0xe11d48
    CarClassEstLapTime: 108.8
    IRating: 5120
    LicString: "A 4.50"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 5
    UserName: "Ben Keating"
    AbbrevName: "B. Keating"
    CarNumber: "52"
    CarPath: "dallarap217"
    CarScreenName: "Dallara P217 LMP2"
    CarClassShortName: "LMP2"
    CarClassColor: 0x10b981
    CarClassEstLapTime: 113.2
    IRating: 4100
    LicString: "A 4.10"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 6
    UserName: "Paul Di Resta"
    AbbrevName: "P. Di Resta"
    CarNumber: "22"
    CarPath: "dallarap217"
    CarScreenName: "Dallara P217 LMP2"
    CarClassShortName: "LMP2"
    CarClassColor: 0x10b981
    CarClassEstLapTime: 113.5
    IRating: 4650
    LicString: "A 4.60"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 7
    UserName: "Daniel Juncadella"
    AbbrevName: "D. Juncadella"
    CarNumber: "97"
    CarPath: "mercedesamggt3"
    CarScreenName: "Mercedes-AMG GT3"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 119.8
    IRating: 4950
    LicString: "A 4.75"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 8
    UserName: "Raffaele Marciello"
    AbbrevName: "R. Marciello"
    CarNumber: "46"
    CarPath: "bmwm4gt3"
    CarScreenName: "BMW M4 GT3"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 119.3
    IRating: 6100
    LicString: "A 4.95"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 9
    UserName: "Kevin Estre"
    AbbrevName: "K. Estre"
    CarNumber: "912"
    CarPath: "porsche992rgt3"
    CarScreenName: "Porsche 992 GT3 R"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 119.4
    IRating: 5800
    LicString: "A 4.88"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 10
    UserName: "Alex Riberas"
    AbbrevName: "A. Riberas"
    CarNumber: "23"
    CarPath: "amvantageevogt3"
    CarScreenName: "Aston Martin Vantage GT3"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 120.1
    IRating: 3450
    LicString: "B 3.80"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 11
    UserName: "Albert Costa"
    AbbrevName: "A. Costa"
    CarNumber: "34"
    CarPath: "ferrari296gt3"
    CarScreenName: "Ferrari 296 GT3"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 119.6
    IRating: 4890
    LicString: "A 4.65"
    CarIsPaceCar: 0
    IsSpectator: 0
  - CarIdx: 12
    UserName: "Spectator Admin"
    CarNumber: "999"
    CarPath: "camera"
    CarClassShortName: "SPEC"
    CarIsPaceCar: 0
    IsSpectator: 1

SessionInfo:
  SessionType: "Race"
  SessionNum: 2
`;

export class MockTelemetryProvider {
  private sessionState: SessionInfoState;
  private currentTick: number = 0;
  private fuelRemaining: number = 48.5;
  private completedLaps: number = 3;

  constructor() {
    this.sessionState = parseSessionInfoYaml(MOCK_SESSION_INFO_YAML, 1);
  }

  public getSessionInfo(): SessionInfoState {
    return this.sessionState;
  }

  /**
   * Generates next simulated frame at ~10-15 Hz
   */
  public nextFrame(isReplay: boolean = false, onPit: boolean = false): IrsdkTelemetryFrame {
    this.currentTick += 0.1;
    const t = this.currentTick;

    // Simulate player active car (CarIdx 3 - Alberto)
    const activeCarIdx = 3;
    const playerDistPct = ((t * 0.008) % 1.0);

    // Cars around track with realistic speed offsets
    const carIdxLapDistPct = new Array(64).fill(-1);
    const carIdxPosition = new Array(64).fill(0);
    const carIdxClassPosition = new Array(64).fill(0);
    const carIdxF2Time = new Array(64).fill(0);
    const carIdxEstTime = new Array(64).fill(119.5);
    const carIdxBestLapTime = new Array(64).fill(0);
    const carIdxLastLapTime = new Array(64).fill(0);
    const carIdxLap = new Array(64).fill(this.completedLaps);
    const carIdxOnPitRoad = new Array(64).fill(false);
    const carIdxTrackSurface = new Array(64).fill(3);

    // GTPs (Cars 1, 2, 4)
    carIdxLapDistPct[1] = ((t * 0.010 + 0.35) % 1.0);
    carIdxPosition[1] = 1;
    carIdxClassPosition[1] = 1;
    carIdxBestLapTime[1] = 108.192;
    carIdxLastLapTime[1] = 108.450;
    carIdxF2Time[1] = 0;

    carIdxLapDistPct[2] = ((t * 0.010 + 0.33) % 1.0);
    carIdxPosition[2] = 2;
    carIdxClassPosition[2] = 2;
    carIdxBestLapTime[2] = 108.410;
    carIdxLastLapTime[2] = 108.620;
    carIdxF2Time[2] = 2.15;

    carIdxLapDistPct[4] = ((t * 0.010 + 0.30) % 1.0);
    carIdxPosition[4] = 3;
    carIdxClassPosition[4] = 3;
    carIdxBestLapTime[4] = 108.750;
    carIdxLastLapTime[4] = 109.010;
    carIdxF2Time[4] = 5.40;

    // LMP2s (Cars 5, 6)
    carIdxLapDistPct[5] = ((t * 0.009 + 0.15) % 1.0);
    carIdxPosition[5] = 4;
    carIdxClassPosition[5] = 1;
    carIdxBestLapTime[5] = 113.120;
    carIdxF2Time[5] = 14.20;

    carIdxLapDistPct[6] = ((t * 0.009 + 0.12) % 1.0);
    carIdxPosition[6] = 5;
    carIdxClassPosition[6] = 2;
    carIdxBestLapTime[6] = 113.480;
    carIdxF2Time[6] = 17.80;

    // GT3s (Cars 8, 9, 3-Alberto, 7, 11, 10)
    // Car 8 (P1 GT3)
    carIdxLapDistPct[8] = ((playerDistPct + 0.035) % 1.0);
    carIdxPosition[8] = 6;
    carIdxClassPosition[8] = 1;
    carIdxBestLapTime[8] = 119.240;
    carIdxLastLapTime[8] = 119.410;
    carIdxF2Time[8] = 32.10;

    // Car 9 (P2 GT3, immediately ahead of Alberto)
    carIdxLapDistPct[9] = ((playerDistPct + 0.012) % 1.0);
    carIdxPosition[9] = 7;
    carIdxClassPosition[9] = 2;
    carIdxBestLapTime[9] = 119.390;
    carIdxLastLapTime[9] = 119.550;
    carIdxF2Time[9] = 34.60;

    // Car 3 (Alberto - P3 GT3)
    carIdxLapDistPct[3] = playerDistPct;
    carIdxPosition[3] = 8;
    carIdxClassPosition[3] = 3;
    carIdxBestLapTime[3] = 119.510;
    carIdxLastLapTime[3] = 119.680;
    carIdxF2Time[3] = 35.85;
    carIdxOnPitRoad[3] = onPit;

    // Car 7 (P4 GT3, immediately behind Alberto)
    carIdxLapDistPct[7] = ((playerDistPct - 0.015 + 1.0) % 1.0);
    carIdxPosition[7] = 9;
    carIdxClassPosition[7] = 4;
    carIdxBestLapTime[7] = 119.780;
    carIdxLastLapTime[7] = 119.920;
    carIdxF2Time[7] = 37.10;

    // Car 11 (P5 GT3)
    carIdxLapDistPct[11] = ((playerDistPct - 0.038 + 1.0) % 1.0);
    carIdxPosition[11] = 10;
    carIdxClassPosition[11] = 5;
    carIdxBestLapTime[11] = 119.620;
    carIdxLastLapTime[11] = 119.850;
    carIdxF2Time[11] = 39.95;

    // Car 10 (P6 GT3, in pit)
    carIdxLapDistPct[10] = ((playerDistPct - 0.080 + 1.0) % 1.0);
    carIdxPosition[10] = 11;
    carIdxClassPosition[10] = 6;
    carIdxBestLapTime[10] = 120.110;
    carIdxLastLapTime[10] = 135.200;
    carIdxF2Time[10] = 55.40;
    carIdxOnPitRoad[10] = true;

    // Fuel simulation (slow drain of ~3.15 L/lap)
    this.fuelRemaining = Math.max(5.0, this.fuelRemaining - 0.003);

    return {
      sessionTime: 1200 + t,
      sessionTimeRemain: 1800 - t,
      sessionLapsRemainEx: 15,
      sessionState: 4, // Racing
      sessionFlags: 0x00000004, // Green flag
      sessionNum: 2,

      camCarIdx: activeCarIdx,
      playerCarIdx: activeCarIdx,
      isReplayPlaying: isReplay,
      onPitRoad: onPit,

      speedKmh: 165 + Math.sin(t * 1.5) * 60,
      rpm: 7200 + Math.sin(t * 1.5) * 1100,
      gear: 4,
      throttle: Math.max(0, Math.sin(t * 1.5)),
      brake: Math.max(0, -Math.sin(t * 1.5)),
      clutch: 0,
      steering: Math.sin(t * 0.8) * 0.35,

      fuelLevel: this.fuelRemaining,
      fuelLevelPct: this.fuelRemaining / 100.0,

      carIdxLapDistPct,
      carIdxPosition,
      carIdxClassPosition,
      carIdxF2Time,
      carIdxEstTime,
      carIdxBestLapTime,
      carIdxLastLapTime,
      carIdxLap,
      carIdxOnPitRoad,
      carIdxTrackSurface,
    };
  }
}
