export interface SignalSample {
  dist: number;
  speed: number;
  thr: number;
  brk: number;
  gear: number;
  steering?: number;
}

export interface CornerKeyEvent {
  brakePointDist: number;
  peakBrakeDist: number;
  peakBrakePct: number;
  trailBrakingPct: number;
  fullThrottleDist: number | null;
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 1.5) return 0;
  if (v > 98.5) return 100;
  return v;
}

/**
 * Applies pedal deadzones (<1.5% -> 0%, >98.5% -> 100%) and zero-phase 3-point smoothing
 * to remove electrical micro-jitter without delaying braking initiation.
 */
export function cleanTelemetrySignals<T extends SignalSample>(samples: T[]): T[] {
  if (!samples || samples.length === 0) return [];
  const deadzoned = samples.map((s) => ({
    ...s,
    thr: clampPct(s.thr),
    brk: clampPct(s.brk),
  }));
  if (deadzoned.length < 3) return deadzoned;
  return deadzoned.map((s, i) => {
    if (i === 0 || i === deadzoned.length - 1) return s;
    const prev = deadzoned[i - 1];
    const next = deadzoned[i + 1];
    // Preserve sharp initial brake application (no phase lag when brk jumps from 0 -> >5%)
    const smoothBrk = prev.brk === 0 && s.brk > 5
      ? s.brk
      : clampPct((prev.brk + s.brk * 2 + next.brk) / 4);
    const smoothThr = prev.thr === 0 && s.thr > 5
      ? s.thr
      : clampPct((prev.thr + s.thr * 2 + next.thr) / 4);
    return {
      ...s,
      thr: Math.round(smoothThr * 10) / 10,
      brk: Math.round(smoothBrk * 10) / 10,
    };
  });
}

/** Detects key driving events per braking zone: Brake Point, Peak Brake, Trail-Braking % and Full Throttle. */
export function detectCornerKeyEvents(samples: SignalSample[]): CornerKeyEvent[] {
  const events: CornerKeyEvent[] = [];
  if (!samples || samples.length < 5) return events;

  let i = 0;
  while (i < samples.length) {
    if (samples[i].brk > 5) {
      const bpDist = samples[i].dist;
      let peakBrk = samples[i].brk;
      let peakDist = samples[i].dist;
      let brakingSamples = 0;
      let trailSamples = 0;
      let j = i;
      while (j < samples.length && samples[j].brk > 2) {
        brakingSamples++;
        if (samples[j].brk > peakBrk) {
          peakBrk = samples[j].brk;
          peakDist = samples[j].dist;
        }
        if (samples[j].brk < peakBrk * 0.9 && Math.abs(samples[j].steering ?? 0) > 0.08) {
          trailSamples++;
        }
        j++;
      }
      if (peakBrk >= 18 && j - i >= 2) {
        let ftDist: number | null = null;
        for (let k = j; k < Math.min(samples.length, j + 160); k++) {
          if (samples[k].thr >= 98.5) {
            ftDist = samples[k].dist;
            break;
          }
          if (samples[k].brk > 10) break;
        }
        events.push({
          brakePointDist: bpDist,
          peakBrakeDist: peakDist,
          peakBrakePct: Math.round(peakBrk),
          trailBrakingPct: brakingSamples > 0 ? Math.round((trailSamples / brakingSamples) * 100) : 0,
          fullThrottleDist: ftDist,
        });
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return events;
}
