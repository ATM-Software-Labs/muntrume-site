import { detectCornerKeyEvents, type SignalSample } from "./signal-cleaner";

export interface ReferenceCornerTarget {
  cornerIndex: number;
  brakePointDist: number;
  apexDist: number;
  apexSpeedKmh: number;
}

export interface CoachAlert {
  type: "late_brake" | "slow_apex";
  cornerIndex: number;
  message: string;
  deltaValue: number;
}

export interface CoachLiveInput {
  sessionType: string;
  distM: number;
  speedKmh: number;
  brakePct: number;
  nowMs?: number;
}

const COACH_SETTINGS_KEY = "mmt_active_coach_settings";

export interface CoachSettings {
  enabled: boolean;
  volume: number; // 0..1
}

export function loadCoachSettings(): CoachSettings {
  try {
    const raw = localStorage.getItem(COACH_SETTINGS_KEY);
    if (!raw) return { enabled: true, volume: 0.35 };
    const parsed = JSON.parse(raw) as Partial<CoachSettings>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
      volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : 0.35,
    };
  } catch {
    return { enabled: true, volume: 0.35 };
  }
}

export function saveCoachSettings(settings: CoachSettings): void {
  try {
    localStorage.setItem(COACH_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function isRaceSession(sessionType: string): boolean {
  const s = (sessionType || "").toLowerCase();
  return s.includes("race") || s.includes("carrera");
}

export function buildReferenceCorners(samples: SignalSample[]): ReferenceCornerTarget[] {
  if (!samples || samples.length < 10) return [];
  const events = detectCornerKeyEvents(samples);
  const targets: ReferenceCornerTarget[] = [];

  events.forEach((ev, idx) => {
    const windowEnd = ev.fullThrottleDist !== null && ev.fullThrottleDist > ev.brakePointDist
      ? ev.fullThrottleDist
      : ev.brakePointDist + 220;

    let minSpeed = Infinity;
    let apexDist = ev.brakePointDist + 60;
    for (const s of samples) {
      if (s.dist >= ev.brakePointDist && s.dist <= windowEnd && s.speed < minSpeed) {
        minSpeed = s.speed;
        apexDist = s.dist;
      }
    }

    if (Number.isFinite(minSpeed) && minSpeed > 15) {
      targets.push({
        cornerIndex: idx + 1,
        brakePointDist: Math.round(ev.brakePointDist),
        apexDist: Math.round(apexDist),
        apexSpeedKmh: Math.round(minSpeed * 10) / 10,
      });
    }
  });

  return targets;
}

export function playCoachTone(type: "late_brake" | "slow_apex", volume = 0.35): void {
  if (typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    const now = ctx.currentTime;
    const peakGain = Math.max(0.02, Math.min(0.4, volume * 0.25));

    if (type === "late_brake") {
      // Soft two-step descending chime
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(520, now + 0.09);
    } else {
      // Soft low apex warning tone
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.setValueAtTime(360, now + 0.11);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // ignore audio policy restrictions
  }
}

export class ActiveTrackCoach {
  private corners: ReferenceCornerTarget[] = [];
  private lastAlertByCorner = new Map<string, number>();
  private wasBrakingBeforeTarget = new Set<number>();
  private settings: CoachSettings = loadCoachSettings();

  setReferenceSamples(samples: SignalSample[]): void {
    this.corners = buildReferenceCorners(samples);
    this.lastAlertByCorner.clear();
    this.wasBrakingBeforeTarget.clear();
  }

  getCorners(): ReferenceCornerTarget[] {
    return this.corners;
  }

  getSettings(): CoachSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<CoachSettings>): void {
    this.settings = {
      enabled: patch.enabled ?? this.settings.enabled,
      volume: patch.volume !== undefined ? Math.max(0, Math.min(1, patch.volume)) : this.settings.volume,
    };
    saveCoachSettings(this.settings);
  }

  evaluateLiveTick(input: CoachLiveInput, playAudio = true): CoachAlert | null {
    if (!this.settings.enabled || this.corners.length === 0) return null;
    // Automatically disabled in Race sessions so it never distracts the driver
    if (isRaceSession(input.sessionType)) return null;

    const now = input.nowMs ?? Date.now();
    const cooldownMs = 12_000;

    for (const corner of this.corners) {
      // Track if pilot already initiated braking near or before reference Brake Point
      if (input.distM >= corner.brakePointDist - 35 && input.distM <= corner.brakePointDist + 14) {
        if (input.brakePct > 5) {
          this.wasBrakingBeforeTarget.add(corner.cornerIndex);
        }
      } else if (input.distM < corner.brakePointDist - 60) {
        this.wasBrakingBeforeTarget.delete(corner.cornerIndex);
      }

      // 1. Late braking check (> 15m late)
      const brakeDelta = input.distM - corner.brakePointDist;
      if (
        brakeDelta > 15 &&
        brakeDelta <= 75 &&
        input.brakePct > 5 &&
        !this.wasBrakingBeforeTarget.has(corner.cornerIndex)
      ) {
        const key = `brake:${corner.cornerIndex}`;
        const last = this.lastAlertByCorner.get(key) ?? 0;
        if (now - last > cooldownMs) {
          this.lastAlertByCorner.set(key, now);
          const meters = Math.round(brakeDelta);
          if (playAudio) playCoachTone("late_brake", this.settings.volume);
          return {
            type: "late_brake",
            cornerIndex: corner.cornerIndex,
            deltaValue: meters,
            message: `Curva ${corner.cornerIndex}: Frenada +${meters}m tarde vs ref`,
          };
        }
      }

      // 2. Apex speed loss check (> 5 km/h slower at apex)
      if (Math.abs(input.distM - corner.apexDist) <= 12) {
        const speedLoss = corner.apexSpeedKmh - input.speedKmh;
        if (speedLoss > 5) {
          const key = `apex:${corner.cornerIndex}`;
          const last = this.lastAlertByCorner.get(key) ?? 0;
          if (now - last > cooldownMs) {
            this.lastAlertByCorner.set(key, now);
            const kmh = Math.round(speedLoss);
            if (playAudio) playCoachTone("slow_apex", this.settings.volume);
            return {
              type: "slow_apex",
              cornerIndex: corner.cornerIndex,
              deltaValue: kmh,
              message: `Curva ${corner.cornerIndex}: Vértice -${kmh} km/h vs ref`,
            };
          }
        }
      }
    }

    return null;
  }
}

export const activeTrackCoach = new ActiveTrackCoach();
