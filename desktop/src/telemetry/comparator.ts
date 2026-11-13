import { clamp, finiteOr, safeDiv } from "../core/math-guards";
import type {
  AlignedTelemetryPoint,
  LapComparisonResult,
  TelemetrySample,
} from "./types";

function normalizeSamples(raw: readonly TelemetrySample[]): TelemetrySample[] {
  const clean: TelemetrySample[] = [];
  for (const s of raw) {
    const distM = finiteOr(s.distM, NaN);
    const lapTimeS = finiteOr(s.lapTimeS, NaN);
    if (!Number.isFinite(distM) || !Number.isFinite(lapTimeS) || distM < 0) {
      continue;
    }
    clean.push({
      distM,
      lapTimeS,
      speedKmh: Math.max(0, finiteOr(s.speedKmh, 0)),
      throttle: clamp(s.throttle, 0, 1),
      brake: clamp(s.brake, 0, 1),
      steeringRad: finiteOr(s.steeringRad, 0),
      x: s.x !== undefined && Number.isFinite(s.x) ? s.x : undefined,
      y: s.y !== undefined && Number.isFinite(s.y) ? s.y : undefined,
    });
  }
  clean.sort((a, b) => a.distM - b.distM);
  return clean;
}

function interpolateAtDistance(
  samples: readonly TelemetrySample[],
  targetDistM: number,
  cursor: { index: number },
): TelemetrySample {
  const n = samples.length;
  if (n === 1) return samples[0];

  while (cursor.index < n - 2 && samples[cursor.index + 1].distM < targetDistM) {
    cursor.index += 1;
  }

  const a = samples[cursor.index];
  const b = samples[Math.min(cursor.index + 1, n - 1)];
  if (targetDistM <= a.distM) return a;
  if (targetDistM >= b.distM) return b;

  const t = clamp(safeDiv(targetDistM - a.distM, b.distM - a.distM, 0), 0, 1);
  return {
    distM: targetDistM,
    lapTimeS: a.lapTimeS + (b.lapTimeS - a.lapTimeS) * t,
    speedKmh: a.speedKmh + (b.speedKmh - a.speedKmh) * t,
    throttle: a.throttle + (b.throttle - a.throttle) * t,
    brake: a.brake + (b.brake - a.brake) * t,
    steeringRad: a.steeringRad + (b.steeringRad - a.steeringRad) * t,
  };
}

/**
 * Estimates trail-braking quality [0..100] from brake-release overlap with steering.
 */
export function computeTrailBrakingScore(samples: readonly TelemetrySample[]): number {
  let brakingPoints = 0;
  let trailOverlapPoints = 0;

  for (const s of samples) {
    if (s.brake > 0.05) {
      brakingPoints += 1;
      if (s.brake < 0.75 && Math.abs(s.steeringRad) > 0.08) {
        trailOverlapPoints += 1;
      }
    }
  }

  if (brakingPoints === 0) return 0;
  return clamp(safeDiv(trailOverlapPoints, brakingPoints, 0) * 100, 0, 100);
}

/**
 * Aligns a user lap against a reference ("Coach Alien") lap by track distance.
 */
export function compareLapsByDistance(
  userLap: readonly TelemetrySample[],
  refLap: readonly TelemetrySample[],
  stepM = 5,
): LapComparisonResult {
  const user = normalizeSamples(userLap);
  const ref = normalizeSamples(refLap);

  if (user.length === 0 || ref.length === 0) {
    return {
      points: [],
      finalDeltaS: 0,
      trailBrakingScore: 0,
      avgSpeedDiffKmh: 0,
    };
  }

  const minDist = Math.max(user[0].distM, ref[0].distM);
  const maxDist = Math.min(user[user.length - 1].distM, ref[ref.length - 1].distM);
  const safeStep = Math.max(1, finiteOr(stepM, 5));

  if (maxDist <= minDist) {
    return {
      points: [],
      finalDeltaS: 0,
      trailBrakingScore: computeTrailBrakingScore(user),
      avgSpeedDiffKmh: 0,
    };
  }

  const points: AlignedTelemetryPoint[] = [];
  const userCursor = { index: 0 };
  const refCursor = { index: 0 };
  let speedDiffSum = 0;

  for (let d = minDist; d <= maxDist; d += safeStep) {
    const u = interpolateAtDistance(user, d, userCursor);
    const r = interpolateAtDistance(ref, d, refCursor);
    const deltaS = finiteOr(u.lapTimeS - r.lapTimeS, 0);
    const speedDiffKmh = finiteOr(u.speedKmh - r.speedKmh, 0);
    speedDiffSum += speedDiffKmh;

    points.push({
      distM: d,
      userTimeS: u.lapTimeS,
      refTimeS: r.lapTimeS,
      deltaS,
      userSpeedKmh: u.speedKmh,
      refSpeedKmh: r.speedKmh,
      speedDiffKmh,
      userThrottle: u.throttle,
      refThrottle: r.throttle,
      userBrake: u.brake,
      refBrake: r.brake,
      userSteeringRad: u.steeringRad,
      refSteeringRad: r.steeringRad,
    });
  }

  const finalDeltaS = points.length > 0 ? points[points.length - 1].deltaS : 0;
  return {
    points,
    finalDeltaS,
    trailBrakingScore: computeTrailBrakingScore(user),
    avgSpeedDiffKmh: safeDiv(speedDiffSum, points.length, 0),
  };
}
