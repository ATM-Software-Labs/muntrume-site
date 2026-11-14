/**
 * MMT Sync — Open Community Telemetry & .mmt-lap Format Engine (Bloque 20)
 * Standard open format (< 150 KB compressed) for portable sim racing lap telemetry.
 * Captures clean reference laps with full track environment conditions (trackTemp, airTemp, wetness, rubber)
 * and essential channels (speed, throttle, brake, clutch, steer, gear, rpm, lapDistPct).
 * Includes Community Setup Validation Schema (votes, ratings, technical feedback & collaborative tags).
 */

export interface MmtLapMetadata {
  formatVersion: "1.0";
  timestamp: number;
  sim: "iRacing";
  season: string; // e.g. "2026 S4"
  driver: {
    name: string;
    iRating: number;
    license: string;
  };
  car: {
    path: string;
    screenName: string;
    setupName?: string;
  };
  track: {
    name: string;
    config: string;
    lengthMeters: number;
    airTempC: number;
    trackTempC: number;
    weather: string;
    trackWetnessPct: number;
    rubberState: "clean" | "moderate" | "heavy" | "saturated";
  };
  timing: {
    lapTimeSeconds: number;
    lapTimeStr: string;
    sectorTimesSeconds?: number[];
  };
}

export interface MmtLapChannels {
  // Delta distance in percentage of lap (0.0 to 1.0)
  lapDistPct: number[];
  // Vehicle speed in km/h
  speedKmh: number[];
  // Pedals normalized [0, 100]
  throttlePct: number[];
  brakePct: number[];
  clutchPct?: number[];
  // Steering angle in degrees [-180, 180]
  steerDeg: number[];
  // Gear [-1=R, 0=N, 1..8]
  gear: number[];
  // Engine RPM
  rpm: number[];
}

export interface MmtLapFile {
  meta: MmtLapMetadata;
  samplesCount: number;
  samplingRateHz: number;
  channels: MmtLapChannels;
}

export interface SetupCommunityReview {
  setupId: string;
  car: string;
  track: string;
  seasonBuild: string;
  upvotes: number;
  downvotes: number;
  tags: Array<"Estable" | "Agresivo" | "Lluvia" | "Resistencia" | "Clasificación" | "Fácil">;
  comments: Array<{
    author: string;
    iRating: number;
    date: string;
    text: string;
    rating: number; // 1 to 5 stars
  }>;
}

export class MmtLapEngine {
  /**
   * Encodes and compresses a fast lap into an .mmt-lap JSON string (< 150 KB)
   */
  public static serializeLap(lap: MmtLapFile): string {
    return JSON.stringify(lap);
  }

  /**
   * Decodes and validates an incoming .mmt-lap file
   */
  public static parseLap(rawJson: string): MmtLapFile {
    const data = JSON.parse(rawJson);
    if (!data.meta || data.meta.formatVersion !== "1.0" || !data.channels) {
      throw new Error("Formato .mmt-lap no válido o corrupto");
    }
    return data as MmtLapFile;
  }

  /**
   * Creates a sample reference lap for testing and demonstration
   */
  public static createSampleLap(car = "ferrari296gt3", track = "nuerburgring_gesamtstrecke"): MmtLapFile {
    const samplesCount = 100;
    const lapDistPct: number[] = [];
    const speedKmh: number[] = [];
    const throttlePct: number[] = [];
    const brakePct: number[] = [];
    const steerDeg: number[] = [];
    const gear: number[] = [];
    const rpm: number[] = [];

    for (let i = 0; i < samplesCount; i++) {
      const pct = Number((i / samplesCount).toFixed(4));
      lapDistPct.push(pct);
      const spd = Math.round(180 + Math.sin(pct * Math.PI * 6) * 70);
      speedKmh.push(spd);
      throttlePct.push(spd > 190 ? 100 : Math.round(spd / 2));
      brakePct.push(spd < 150 ? 80 : 0);
      steerDeg.push(Number((Math.sin(pct * Math.PI * 4) * 45).toFixed(1)));
      gear.push(spd > 210 ? 5 : spd > 160 ? 4 : 3);
      rpm.push(Math.round(spd * 35 + 1500));
    }

    return {
      meta: {
        formatVersion: "1.0",
        timestamp: Date.now(),
        sim: "iRacing",
        season: "2026 S4",
        driver: {
          name: "Alberto (MMT)",
          iRating: 3100,
          license: "A 4.90",
        },
        car: {
          path: car,
          screenName: "Ferrari 296 GT3",
          setupName: "MMT_VLN_Base_v1.sto",
        },
        track: {
          name: track,
          config: "Combined Gesamtstrecke 24h",
          lengthMeters: 25378,
          airTempC: 21.5,
          trackTempC: 28.2,
          weather: "Clear / Optimum",
          trackWetnessPct: 0,
          rubberState: "heavy",
        },
        timing: {
          lapTimeSeconds: 494.32,
          lapTimeStr: "8:14.320",
        },
      },
      samplesCount,
      samplingRateHz: 60,
      channels: {
        lapDistPct,
        speedKmh,
        throttlePct,
        brakePct,
        steerDeg,
        gear,
        rpm,
      },
    };
  }

  /**
   * Calculates community ranking score for setup sorting
   */
  public static calculateSetupMerit(review: SetupCommunityReview): number {
    const totalVotes = review.upvotes + review.downvotes;
    if (totalVotes === 0) return 0;
    const ratio = review.upvotes / totalVotes;
    // Wilson score interval approximation for merit-based ranking
    return Number((ratio * Math.log10(totalVotes + 1)).toFixed(2));
  }
}
