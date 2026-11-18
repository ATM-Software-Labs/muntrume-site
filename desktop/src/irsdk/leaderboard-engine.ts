/**
 * MMT Sync — Multiclass Leaderboard Engine (Bloque 1)
 * Sorts by CarIdxPosition (in Race/Qualify) or CarIdxBestLapTime (in Practice).
 * Calculates GAP and INT, and displays PIT indicators.
 */

import type { DriverInfo, IrsdkTelemetryFrame, LeaderboardEntry, SessionResultPosition } from "./types";
import { formatIRating } from "./relative-engine";

export function formatLapTime(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "--:--.---";
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
  private initialPosByCarIdx = new Map<number, number>();
  private recentLapsByCarIdx = new Map<number, number[]>();
  private lastRecordedLapByCarIdx = new Map<number, number>();
  private bestLapTrackByCarIdx = new Map<number, { time: number; lap: number }>();
  private lastPitLapByCarIdx = new Map<number, number>();
  private pitCountByCarIdx = new Map<number, number>();
  private wasInPitByCarIdx = new Map<number, boolean>();
  private lastSessionNum = -1;

  /**
   * Computes the sorted leaderboard table
   */
  public compute(
    frame: IrsdkTelemetryFrame,
    driverInfo: DriverInfo,
    sessionType: string = "Practice",
    sessionResults?: Record<number, SessionResultPosition>
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
    const lapDistPcts = frame.carIdxLapDistPct || [];
    const onPitRoads = frame.carIdxOnPitRoad || [];
    const trackSurfaces = frame.carIdxTrackSurface || [];

    const isPracticeOrWarmup =
      sessionType.toLowerCase().includes("practice") ||
      sessionType.toLowerCase().includes("warmup") ||
      sessionType.toLowerCase().includes("offline");

    if (frame.sessionNum !== this.lastSessionNum) {
      this.lastSessionNum = frame.sessionNum;
      this.initialPosByCarIdx.clear();
      this.recentLapsByCarIdx.clear();
      this.lastRecordedLapByCarIdx.clear();
      this.bestLapTrackByCarIdx.clear();
      this.lastPitLapByCarIdx.clear();
      this.pitCountByCarIdx.clear();
      this.wasInPitByCarIdx.clear();
    }
    const activePlayerLap = lapsDone[activeCarIdx] ?? 0;

    // Detect if CarIdxClassPosition is 0-based (real iRacing SDK: 0 = P1, -1 = invalid)
    const hasZeroClassPos = classPositions.some((cp, i) => cp === 0 && (trackSurfaces[i] ?? 3) >= 0 && !!drivers[i]);

    const rawList: Array<{
      carIdx: number;
      position: number;
      classPosition: number;
      bestLap: number;
      lastLap: number;
      f2Time: number;
      laps: number;
      lapDistPct: number;
      onPit: boolean;
    }> = [];

    for (const [idxStr, _driver] of Object.entries(drivers)) {
      const idx = Number(idxStr);
      if (idx < 0 || idx > 63) continue;

      const res = sessionResults?.[idx];
      const surface = trackSurfaces[idx] ?? 3;
      if (!isPracticeOrWarmup && surface === -1 && !(res && (res.fastestTime > 0 || res.position > 0))) continue;

      const pos = (positions[idx] > 0 ? positions[idx] : 0) || res?.position || 0;
      const rawCp = classPositions[idx];
      const sdkClassPos = rawCp !== undefined && rawCp >= 0
        ? (hasZeroClassPos ? rawCp + 1 : rawCp)
        : 0;
      const resClassPos = res && res.classPosition >= 0
        ? (hasZeroClassPos && res.classPosition === 0 ? 1 : res.classPosition)
        : 0;
      const classPos = sdkClassPos || resClassPos || 0;
      const best = (bestLapTimes[idx] > 0 ? bestLapTimes[idx] : 0) || res?.fastestTime || 0;
      const last = (lastLapTimes[idx] > 0 ? lastLapTimes[idx] : 0) || res?.lastTime || 0;
      const f2 = (f2Times[idx] > 0 ? f2Times[idx] : 0) || res?.timeGap || 0;
      const laps = (lapsDone[idx] > 0 ? lapsDone[idx] : 0) || res?.lapsComplete || 0;
      const lapDistPct = lapDistPcts[idx] ?? 0;
      const onPit = !!onPitRoads[idx];

      rawList.push({
        carIdx: idx,
        position: pos,
        classPosition: classPos,
        bestLap: best,
        lastLap: last,
        f2Time: f2,
        laps,
        lapDistPct,
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

    // Build finalized leaderboard entries with per-class GAP, INT, PIT/OUT & recent laps
    const result: LeaderboardEntry[] = [];
    const classLeaders = new Map<string, { bestLap: number; f2Gap: number; prevGap: number; count: number }>();

    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      const driver = drivers[item.carIdx];
      if (!driver) continue;

      const rank = i + 1;
      const clsKey = (driver.carClassShortName || "ALL").toUpperCase();
      const clsState = classLeaders.get(clsKey) ?? { bestLap: 0, f2Gap: 0, prevGap: 0, count: 0 };
      clsState.count += 1;
      // Always assign sequential 1, 2, 3... within each class so P1 is strictly 1
      const clsRank = clsState.count;
      const isClassLeader = clsRank === 1;

      const wasPit = this.wasInPitByCarIdx.get(item.carIdx) ?? false;
      if (item.onPit && !wasPit && item.laps > 0) {
        this.pitCountByCarIdx.set(item.carIdx, (this.pitCountByCarIdx.get(item.carIdx) ?? 0) + 1);
      }
      this.wasInPitByCarIdx.set(item.carIdx, item.onPit);

      // Track last 3 valid laps, best lap number, and pit/out status
      if (item.lastLap > 0 && item.laps > (this.lastRecordedLapByCarIdx.get(item.carIdx) ?? 0)) {
        this.lastRecordedLapByCarIdx.set(item.carIdx, item.laps);
        const hist = this.recentLapsByCarIdx.get(item.carIdx) ?? [];
        hist.push(item.lastLap);
        if (hist.length > 3) hist.shift();
        this.recentLapsByCarIdx.set(item.carIdx, hist);
      }
      if (item.bestLap > 0) {
        const prevBest = this.bestLapTrackByCarIdx.get(item.carIdx);
        if (!prevBest || item.bestLap < prevBest.time - 0.0005) {
          this.bestLapTrackByCarIdx.set(item.carIdx, { time: item.bestLap, lap: Math.max(1, item.laps) });
        }
      }
      if (item.onPit) {
        this.lastPitLapByCarIdx.set(item.carIdx, item.laps);
      }
      const lastPitLap = this.lastPitLapByCarIdx.get(item.carIdx);
      const lapsSincePit = lastPitLap !== undefined && item.laps >= lastPitLap ? item.laps - lastPitLap : undefined;
      const pitStatus: "PIT" | "OUT" | "" = item.onPit
        ? "PIT"
        : lapsSincePit !== undefined && lapsSincePit <= 1 && item.laps > 0
          ? "OUT"
          : "";

      let gap = 0;
      let interval = 0;

      if (isPracticeOrWarmup) {
        if (isClassLeader) {
          clsState.bestLap = item.bestLap;
          clsState.prevGap = item.bestLap;
        } else if (item.bestLap > 0 && clsState.bestLap > 0) {
          gap = item.bestLap - clsState.bestLap;
          interval = clsState.prevGap > 0 ? Math.max(0, item.bestLap - clsState.prevGap) : gap;
          clsState.prevGap = item.bestLap;
        }
      } else {
        const refLapSec = clsState.bestLap > 10 ? clsState.bestLap : (item.bestLap > 10 ? item.bestLap : (item.lastLap > 10 ? item.lastLap : 105));
        const curProgress = Math.max(0, item.laps) + Math.max(0, Math.min(0.9999, item.lapDistPct));
        if (isClassLeader) {
          clsState.bestLap = refLapSec;
          clsState.f2Gap = curProgress;
          clsState.prevGap = 0;
        } else {
          const lapDiff = Math.max(0, clsState.f2Gap - curProgress);
          const liveGap = lapDiff * refLapSec;
          gap = liveGap > 0.001 ? liveGap : (item.f2Time > 0 ? item.f2Time : 0);
          interval = clsState.prevGap > 0 ? Math.max(0, gap - clsState.prevGap) : gap;
          clsState.prevGap = gap;
        }
      }
      classLeaders.set(clsKey, clsState);

      const resolvedPos = item.position > 0 ? item.position : rank;
      if (!isPracticeOrWarmup && clsRank > 0 && !this.initialPosByCarIdx.has(item.carIdx)) {
        this.initialPosByCarIdx.set(item.carIdx, clsRank);
      }
      const startPos = this.initialPosByCarIdx.get(item.carIdx) ?? clsRank;
      const posDelta = !isPracticeOrWarmup && startPos > 0 && clsRank > 0 ? startPos - clsRank : 0;
      const lapDelta = activePlayerLap > 0 && item.laps > 0 ? item.laps - activePlayerLap : 0;

      result.push({
        position: resolvedPos,
        classPosition: clsRank,
        carClassId: driver.carClassId,
        posDelta,
        lapDelta,
        carIdx: item.carIdx,
        userId: driver.userId,
        cust_id: driver.userId,
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
        iRatingExact: driver.iRating > 0 ? driver.iRating : 0,
        bestLapTime: item.bestLap,
        bestLapNum: this.bestLapTrackByCarIdx.get(item.carIdx)?.lap,
        bestLapStr: formatLapTime(item.bestLap),
        lastLapTime: item.lastLap,
        lastLapStr: formatLapTime(item.lastLap),
        recentLaps: [...(this.recentLapsByCarIdx.get(item.carIdx) ?? (item.lastLap > 0 ? [item.lastLap] : []))],
        gapSeconds: gap,
        gapStr: formatGap(gap, isClassLeader),
        intervalSeconds: interval,
        intervalStr: isClassLeader ? "LÍDER" : interval > 0 ? `+${interval.toFixed(3)}` : "—",
        onPitRoad: item.onPit,
        pitStatus,
        lapsSincePit,
        pitCount: this.pitCountByCarIdx.get(item.carIdx) ?? 0,
        isActiveCam: item.carIdx === activeCarIdx,
        lapsCompleted: item.laps,
      });
    }

    return result;
  }
}
