/**
 * MMT Sync — iRacing SDK Core Types (Bloque 1)
 * High-performance, memory-safe data structures for telemetry, relative, leaderboard and fuel.
 */

export interface Driver {
  carIdx: number;
  userName: string;
  abbrevName: string;
  initials: string;
  userId: number;
  teamId: number;
  teamName: string;
  carNumber: string;
  carNumberRaw: number;
  carPath: string;
  carClassId: number;
  carScreenName: string;
  carScreenNameShort: string;
  carClassShortName: string;
  carClassColor: string;
  carClassEstLapTime: number;
  iRating: number;
  licLevel: number;
  licSubLevel: number;
  licString: string;
  licColor: string;
  isPaceCar: boolean;
  isSpectator: boolean;
  isAi: boolean;
}

export interface DriverInfo {
  drivers: Record<number, Driver>;
  driverCarEstLapTime: number;
  driverCarIdx: number;
}

export interface WeekendInfo {
  trackName: string;
  trackConfigName: string;
  trackId: number;
  trackLengthM: number;
  category: "Road" | "Oval" | "DirtRoad" | "DirtOval" | string;
  sessionType: string;
  seasonId?: number;
  seasonYear?: number;
  seasonQuarter?: number;
}

export interface SessionInfoState {
  update: number;
  weekendInfo: WeekendInfo;
  driverInfo: DriverInfo;
  sessionType: "Practice" | "Qualify" | "Warmup" | "Race" | "Offline" | string;
  sessionNum: number;
}

/**
 * 10-15 Hz Telemetry Frame for arrays and multi-car physics
 */
export interface IrsdkTelemetryFrame {
  sessionTime: number;
  sessionTimeRemain: number;
  sessionLapsRemainEx: number;
  sessionState: number;
  sessionFlags: number;
  sessionNum: number;

  camCarIdx: number;
  playerCarIdx: number;
  isReplayPlaying: boolean;
  onPitRoad: boolean;

  speedKmh: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  clutch: number;
  steering: number;

  fuelLevel: number;
  fuelLevelPct: number;

  // 64-car arrays from SDK
  carIdxLapDistPct: number[];
  carIdxPosition: number[];
  carIdxClassPosition: number[];
  carIdxF2Time: number[];
  carIdxEstTime: number[];
  carIdxBestLapTime: number[];
  carIdxLastLapTime: number[];
  carIdxLap: number[];
  carIdxOnPitRoad: boolean[];
  carIdxTrackSurface: number[];
}

export interface RelativeEntry {
  carIdx: number;
  carNumber: string;
  driverName: string;
  abbrevName: string;
  carPath: string;
  carScreenName: string;
  carClassShortName: string;
  carClassColor: string;
  licString: string;
  licBadgeColor: string;
  iRatingStr: string;
  diffPct: number;
  deltaSeconds: number;
  deltaStr: string;
  isActiveCam: boolean;
  isAhead: boolean;
  onPitRoad: boolean;
  trackSurface: number;
}

export interface LeaderboardEntry {
  position: number;
  classPosition: number;
  carIdx: number;
  carNumber: string;
  driverName: string;
  abbrevName: string;
  carPath: string;
  carScreenName: string;
  carClassShortName: string;
  carClassColor: string;
  licString: string;
  licBadgeColor: string;
  iRatingStr: string;
  bestLapTime: number;
  bestLapStr: string;
  lastLapTime: number;
  lastLapStr: string;
  gapSeconds: number;
  gapStr: string;
  intervalSeconds: number;
  intervalStr: string;
  onPitRoad: boolean;
  isActiveCam: boolean;
  lapsCompleted: number;
}

export interface FuelCalculation {
  isValid: boolean;
  reasonNotReady: string | null;
  fuelRemainingL: number;
  fuelRemainingPct: number;
  avgBurnPerLap: number;
  maxBurnPerLap: number;
  liftAndCoastTarget: number;
  lapsRemaining: number;
  fuelNeededToFinish: number;
  fuelToAdd: number;
  safetyMarginL: number;
  stintLapsRemaining: number;
  completedLapsSampled: number;
}

export interface IrsdkComputedState {
  camCarIdx: number;
  playerCarIdx: number;
  isReplayPlaying: boolean;
  onPitRoad: boolean;
  activeDriver: Driver | null;
  relative: {
    entries: RelativeEntry[];
    carAhead: RelativeEntry | null;
    carBehind: RelativeEntry | null;
  };
  leaderboard: LeaderboardEntry[];
  fuel: FuelCalculation;
  frame: IrsdkTelemetryFrame;
  session: SessionInfoState;
}
