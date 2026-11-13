/**
 * Strictly typed telemetry sample and lap comparison models.
 */

export interface TelemetrySample {
  /** Distance along the lap in meters (monotonically increasing). */
  distM: number;
  /** Elapsed lap time at this sample in seconds. */
  lapTimeS: number;
  /** Vehicle speed in km/h. */
  speedKmh: number;
  /** Normalized throttle input [0, 1]. */
  throttle: number;
  /** Normalized brake input [0, 1]. */
  brake: number;
  /** Steering wheel angle in radians. */
  steeringRad: number;
  /** Optional track-map X coordinate. */
  x?: number;
  /** Optional track-map Y coordinate. */
  y?: number;
}

export interface AlignedTelemetryPoint {
  distM: number;
  userTimeS: number;
  refTimeS: number;
  /** Positive means user is slower than reference (losing time). */
  deltaS: number;
  userSpeedKmh: number;
  refSpeedKmh: number;
  speedDiffKmh: number;
  userThrottle: number;
  refThrottle: number;
  userBrake: number;
  refBrake: number;
  userSteeringRad: number;
  refSteeringRad: number;
}

export interface LapComparisonResult {
  points: AlignedTelemetryPoint[];
  finalDeltaS: number;
  trailBrakingScore: number;
  avgSpeedDiffKmh: number;
}
