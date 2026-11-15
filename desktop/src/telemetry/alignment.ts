export interface DistanceTelemetryPoint {
  dist: number;
  speed: number;
  thr: number;
  brk: number;
  gear: number;
  steering: number;
  lapTimeS?: number;
  x?: number;
  y?: number;
}

export interface AlignedDistancePoint extends DistanceTelemetryPoint {
  lapTimeS: number;
}

export interface SessionCompatibilityInfo {
  carPath?: string;
  trackName?: string;
}

function normId(val: string | undefined): string {
  return String(val || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Checks that CarPath and TrackName match before comparing two telemetry sessions. */
export function areSessionsCompatible(a: SessionCompatibilityInfo, b: SessionCompatibilityInfo): boolean {
  const carA = normId(a.carPath);
  const carB = normId(b.carPath);
  const trkA = normId(a.trackName);
  const trkB = normId(b.trackName);
  if (!carA || !carB || !trkA || !trkB) return false;
  return carA === carB && (trkA === trkB || trkA.includes(trkB) || trkB.includes(trkA));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Resamples telemetry samples onto a fixed distance grid (default 1m steps from 0 to trackLengthM)
 * using linear interpolation so slower/faster laps stay aligned corner-by-corner.
 */
export function resampleTrackByDistance(
  samples: DistanceTelemetryPoint[],
  trackLengthM: number,
  stepM = 1,
): AlignedDistancePoint[] {
  if (!samples || samples.length === 0) return [];
  const sorted = samples
    .filter((s) => Number.isFinite(s.dist))
    .slice()
    .sort((a, b) => a.dist - b.dist);
  if (sorted.length === 0) return [];

  const maxD = Math.max(1, Number.isFinite(trackLengthM) && trackLengthM > 0
    ? trackLengthM
    : sorted[sorted.length - 1].dist);
  const step = Math.max(1, stepM);
  const out: AlignedDistancePoint[] = [];

  let cursor = 0;
  for (let d = 0; d <= maxD; d += step) {
    while (cursor < sorted.length - 2 && sorted[cursor + 1].dist < d) {
      cursor++;
    }
    const s0 = sorted[cursor];
    const s1 = sorted[Math.min(sorted.length - 1, cursor + 1)];
    const span = s1.dist - s0.dist;
    const frac = span > 1e-4 ? Math.max(0, Math.min(1, (d - s0.dist) / span)) : 0;

    const t0 = Number.isFinite(s0.lapTimeS) ? (s0.lapTimeS as number) : 0;
    const t1 = Number.isFinite(s1.lapTimeS) ? (s1.lapTimeS as number) : t0;

    const pt: AlignedDistancePoint = {
      dist: d,
      speed: lerp(s0.speed, s1.speed, frac),
      thr: lerp(s0.thr, s1.thr, frac),
      brk: lerp(s0.brk, s1.brk, frac),
      gear: Math.round(lerp(s0.gear, s1.gear, frac)),
      steering: lerp(s0.steering, s1.steering, frac),
      lapTimeS: lerp(t0, t1, frac),
    };
    if (typeof s0.x === "number" && typeof s1.x === "number" && Number.isFinite(s0.x) && Number.isFinite(s1.x)) {
      pt.x = lerp(s0.x, s1.x, frac);
    }
    if (typeof s0.y === "number" && typeof s1.y === "number" && Number.isFinite(s0.y) && Number.isFinite(s1.y)) {
      pt.y = lerp(s0.y, s1.y, frac);
    }
    out.push(pt);
  }
  return out;
}

/**
 * Computes accumulated time delta delta(d) = t_user(d) - t_ref(d) on a distance-aligned grid,
 * ensuring delta(0) === 0.000 and delta(end) === userLapTimeS - refLapTimeS when provided.
 */
export function computeDistanceDelta(
  userGrid: AlignedDistancePoint[],
  refGrid: AlignedDistancePoint[],
  userLapTimeS?: number,
  refLapTimeS?: number,
): number[] {
  const n = Math.min(userGrid.length, refGrid.length);
  if (n === 0) return [];
  const baseOffset = userGrid[0].lapTimeS - refGrid[0].lapTimeS;
  const raw = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    raw[i] = (userGrid[i].lapTimeS - refGrid[i].lapTimeS) - baseOffset;
  }
  raw[0] = 0;
  if (
    n > 1 &&
    typeof userLapTimeS === "number" &&
    typeof refLapTimeS === "number" &&
    Number.isFinite(userLapTimeS) &&
    Number.isFinite(refLapTimeS) &&
    userLapTimeS > 0 &&
    refLapTimeS > 0
  ) {
    const targetEnd = userLapTimeS - refLapTimeS;
    const rawEnd = raw[n - 1];
    const correction = targetEnd - rawEnd;
    if (Math.abs(correction) > 1e-6) {
      for (let i = 1; i < n; i++) {
        raw[i] += correction * (i / (n - 1));
      }
    }
    raw[n - 1] = targetEnd;
  }
  return raw;
}
