/**
 * MMT Sync — Live Ghost Telemetry Trace (Prompt 103)
 * Records the current session's best lap into a fixed ~24 KB Float32Array buffer
 * (1000 buckets x 3 channels) indexed by LapDistPct, and samples 1.5s ahead.
 */

const BUCKETS = 1000;

export class GhostTraceRecorder {
  private curThrottle = new Float32Array(BUCKETS);
  private curBrake = new Float32Array(BUCKETS);
  private curSpeed = new Float32Array(BUCKETS);
  private bestThrottle = new Float32Array(BUCKETS);
  private bestBrake = new Float32Array(BUCKETS);
  private bestSpeed = new Float32Array(BUCKETS);

  private lastLap = -1;
  private bestLapTime = 0;
  private hasGhost = false;
  private curSamples = 0;

  public reset(): void {
    this.lastLap = -1;
    this.bestLapTime = 0;
    this.hasGhost = false;
    this.curSamples = 0;
    this.curThrottle.fill(0);
    this.curBrake.fill(0);
    this.curSpeed.fill(0);
  }

  public update(
    lapDistPct: number,
    lap: number,
    lastLapTime: number,
    throttle: number,
    brake: number,
    speedKmh: number,
    estLapTimeS: number = 90
  ): { throttle: number; brake: number } | null {
    if (lap > 0 && this.lastLap !== -1 && lap > this.lastLap) {
      if (
        lastLapTime > 10 &&
        this.curSamples >= 50 &&
        (this.bestLapTime === 0 || lastLapTime <= this.bestLapTime)
      ) {
        this.bestLapTime = lastLapTime;
        this.bestThrottle.set(this.curThrottle);
        this.bestBrake.set(this.curBrake);
        this.bestSpeed.set(this.curSpeed);
        this.hasGhost = true;
      }
      this.curSamples = 0;
    }
    if (lap > 0) {
      this.lastLap = lap;
    }

    if (lapDistPct >= 0 && lapDistPct <= 1) {
      const idx = Math.min(BUCKETS - 1, Math.max(0, Math.floor(lapDistPct * BUCKETS)));
      this.curThrottle[idx] = Math.max(0, Math.min(1, throttle));
      this.curBrake[idx] = Math.max(0, Math.min(1, brake));
      this.curSpeed[idx] = Math.max(0, speedKmh);
      this.curSamples++;
    }

    if (!this.hasGhost || lapDistPct < 0) return null;

    const lapSec = this.bestLapTime > 10 ? this.bestLapTime : Math.max(20, estLapTimeS);
    const lookaheadPct = 1.5 / lapSec;
    const aheadPct = (lapDistPct + lookaheadPct) % 1;
    const aheadIdx = Math.min(BUCKETS - 1, Math.max(0, Math.floor(aheadPct * BUCKETS)));
    return {
      throttle: this.bestThrottle[aheadIdx],
      brake: this.bestBrake[aheadIdx],
    };
  }
}
