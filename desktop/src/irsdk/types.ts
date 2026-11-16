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

export interface SessionResultPosition {
  carIdx: number;
  position: number;
  classPosition: number;
  fastestTime: number;
  lastTime: number;
  lapsComplete: number;
  timeGap: number;
}

export interface SessionInfoState {
  update: number;
  weekendInfo: WeekendInfo;
  driverInfo: DriverInfo;
  sessionType: "Practice" | "Qualify" | "Warmup" | "Race" | "Offline" | string;
  sessionNum: number;
  sessionResults?: Record<number, Record<number, SessionResultPosition>>;
  sectors?: Array<{ sectorNum: number; startPct: number }>;
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
  trackTempC?: number;
  airTempC?: number;
  windKmh?: number;
  precipitationPct?: number;
  trackWetness?: number;
  carLeftRight?: number;
  isOnTrack?: boolean;

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
  carIdxSessionFlags?: number[];
  tireTempsC?: number[];
  tireWearPct?: number[];
  brakeAbsActive?: boolean;
  engineWarnings?: number;
}

export interface RelativeEntry {
  carIdx: number;
  userId?: number;
  cust_id?: number | string;
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
  iRatingExact?: number;
  position?: number;
  lastLapStr?: string;
  sessionFlags?: number;
  lapDelta?: number;
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
  posDelta?: number;
  lapDelta?: number;
  carIdx: number;
  userId?: number;
  cust_id?: number | string;
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
  iRatingExact?: number;
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
  fuelSurplusL?: number;
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
