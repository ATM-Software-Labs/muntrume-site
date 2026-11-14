/**
 * MMT Sync — Multiclass Leaderboard Engine (Bloque 1)
 * Sorts by CarIdxPosition (in Race/Qualify) or CarIdxBestLapTime (in Practice).
 * Calculates GAP and INT, and displays PIT indicators.
 */

import type { DriverInfo, IrsdkTelemetryFrame, LeaderboardEntry } from "./types";
import { formatIRating } from "./relative-engine";

export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "—:——.———";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, "0")}`;
}

export function formatGap(seconds: number, isLeader: boolean): string {
  if (isLeader) return "LÍDER";
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "—";
  return `+${seconds.toFixed(2)}s`;
}

export class LeaderboardEngine {
  /**
   * Computes the sorted leaderboard table
   */
  public compute(
    frame: IrsdkTelemetryFrame,
    driverInfo: DriverInfo,
    sessionType: string = "Practice"
  ): LeaderboardEntry[] {
    let activeCarIdx = frame.camCarIdx;
    if (activeCarIdx === undefined || activeCarIdx < 0 || activeCarIdx > 63) {
      activeCarIdx = frame.playerCarIdx >= 0 && frame.playerCarIdx <= 63 ? frame.playerCarIdx : 0;
    }

    const drivers = driverInfo.drivers;
    const positions = frame.carIdxPosition || [];
    const classPositions = frame.carIdxClassPosition || [];
    const f2Times = frame.carIdxF2Time || [];
    const bestLapTimes = frame.carIdxBestLapTime || [];
    const lastLapTimes = frame.carIdxLastLapTime || [];
    const lapsDone = frame.carIdxLap || [];
    const onPitRoads = frame.carIdxOnPitRoad || [];
    const trackSurfaces = frame.carIdxTrackSurface || [];

    const isPracticeOrWarmup =
      sessionType.toLowerCase().includes("practice") ||
      sessionType.toLowerCase().includes("warmup") ||
      sessionType.toLowerCase().includes("offline");

    const rawList: Array<{
      carIdx: number;
      position: number;
      classPosition: number;
      bestLap: number;
      lastLap: number;
      f2Time: number;
      laps: number;
      onPit: boolean;
    }> = [];

    for (const [idxStr, _driver] of Object.entries(drivers)) {
      const idx = Number(idxStr);
      if (idx < 0 || idx > 63) continue;

      const surface = trackSurfaces[idx] ?? 3;
      if (surface === -1) continue; // NotInWorld

      const pos = positions[idx] || 0;
      const classPos = classPositions[idx] || 0;
      const best = bestLapTimes[idx] || 0;
      const last = lastLapTimes[idx] || 0;
      const f2 = f2Times[idx] || 0;
      const laps = lapsDone[idx] || 0;
      const onPit = !!onPitRoads[idx];

      rawList.push({
        carIdx: idx,
        position: pos,
        classPosition: classPos,
        bestLap: best,
        lastLap: last,
        f2Time: f2,
        laps,
        onPit,
      });
    }

    // Sorting algorithm:
    // In Practice without established valid positions: sort by best lap time (> 0 ascending)
    if (isPracticeOrWarmup) {
      rawList.sort((a, b) => {
        const aHasLap = a.bestLap > 0;
        const bHasLap = b.bestLap > 0;
        if (aHasLap && bHasLap) return a.bestLap - b.bestLap;
        if (aHasLap) return -1;
        if (bHasLap) return 1;
        return a.carIdx - b.carIdx;
      });
    } else {
      // Race / Qualify: sort by overall position (pos > 0 first ascending)
      rawList.sort((a, b) => {
        const aHasPos = a.position > 0;
        const bHasPos = b.position > 0;
        if (aHasPos && bHasPos) return a.position - b.position;
        if (aHasPos) return -1;
        if (bHasPos) return 1;
        // Fallback to laps completed descending
        if (b.laps !== a.laps) return b.laps - a.laps;
        return a.carIdx - b.carIdx;
      });
    }

    // Build finalized leaderboard entries with GAP and INT
    const result: LeaderboardEntry[] = [];
    let leaderRefLapTime = 0;
    let prevCarTime = 0;

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      const driver = drivers[item.carIdx];
      if (!driver) continue;

      const rank = i + 1;
      const isLeader = i === 0;

      let gap = 0;
      let interval = 0;

      if (isPracticeOrWarmup) {
        if (isLeader) {
          leaderRefLapTime = item.bestLap;
          gap = 0;
          interval = 0;
          prevCarTime = item.bestLap;
        } else if (item.bestLap > 0 && leaderRefLapTime > 0) {
          gap = item.bestLap - leaderRefLapTime;
          interval = prevCarTime > 0 ? item.bestLap - prevCarTime : gap;
          prevCarTime = item.bestLap;
        }
      } else {
        // Race: Use CarIdxF2Time or rank deltas
        if (isLeader) {
          gap = 0;
          interval = 0;
          prevCarTime = 0;
        } else {
          // f2Time in iRacing can be seconds behind leader or car ahead
          gap = item.f2Time > 0 ? item.f2Time : (rank - 1) * 0.8;
          interval = prevCarTime > 0 ? Math.max(0.05, gap - prevCarTime) : gap;
          prevCarTime = gap;
        }
      }

      result.push({
        position: item.position > 0 ? item.position : rank,
        classPosition: item.classPosition > 0 ? item.classPosition : rank,
        carIdx: item.carIdx,
        carNumber: driver.carNumber,
        driverName: driver.userName,
        abbrevName: driver.abbrevName,
        carPath: driver.carPath,
        carScreenName: driver.carScreenName,
        carClassShortName: driver.carClassShortName,
        carClassColor: driver.carClassColor,
        licString: driver.licString,
        licBadgeColor: driver.licColor,
        iRatingStr: formatIRating(driver.iRating),
        bestLapTime: item.bestLap,
        bestLapStr: formatLapTime(item.bestLap),
        lastLapTime: item.lastLap,
        lastLapStr: formatLapTime(item.lastLap),
        gapSeconds: gap,
        gapStr: formatGap(gap, isLeader),
        intervalSeconds: interval,
        intervalStr: isLeader ? "LÍDER" : `+${interval.toFixed(2)}s`,
        onPitRoad: item.onPit,
        isActiveCam: item.carIdx === activeCarIdx,
        lapsCompleted: item.laps,
      });
    }

    return result;
  }
}
