/**
 * MMT Sync — Relative Radar Engine (Bloque 1)
 * Computes exact gap relative to CamCarIdx (both live and replays), resolving start/finish line wraparound.
 * Slices 4 cars ahead and 4 cars behind.
 */

import type { DriverInfo, IrsdkTelemetryFrame, RelativeEntry } from "./types";

export function formatIRating(ir: number): string {
  if (!ir || ir <= 0) return "—";
  if (ir >= 1000) {
    return `${(ir / 1000).toFixed(1)}k`;
  }
  return String(ir);
}

export function formatDeltaSeconds(sec: number): string {
  const abs = Math.abs(sec);
  if (abs < 0.05) return "PACE";
  const sign = sec > 0 ? "+" : "-";
  return `${sign}${abs.toFixed(1)}s`;
}

export class RelativeEngine {
  /**
   * Calculates the relative list centered on CamCarIdx
   */
  public compute(
    frame: IrsdkTelemetryFrame,
    driverInfo: DriverInfo
  ): {
    activeCarIdx: number;
    entries: RelativeEntry[];
    carAhead: RelativeEntry | null;
    carBehind: RelativeEntry | null;
  } {
    // 1. Resolve active car: CamCarIdx is authoritative (live and replay)
    let activeCarIdx = frame.camCarIdx;
    if (activeCarIdx === undefined || activeCarIdx < 0 || activeCarIdx > 63) {
      activeCarIdx = frame.playerCarIdx >= 0 && frame.playerCarIdx <= 63 ? frame.playerCarIdx : 0;
    }

    const drivers = driverInfo.drivers;
    const lapDistPcts = frame.carIdxLapDistPct || [];
    const trackSurfaces = frame.carIdxTrackSurface || [];
    const onPitRoads = frame.carIdxOnPitRoad || [];

    const activeDistPct = lapDistPcts[activeCarIdx] ?? 0;
    const baselineEstLap = driverInfo.driverCarEstLapTime > 10 ? driverInfo.driverCarEstLapTime : 90.0;

    const allCandidates: Array<{
      entry: RelativeEntry;
      diffPct: number;
      deltaSeconds: number;
    }> = [];

    // 2. Iterate through all valid drivers present in YAML
    for (const [idxStr, driver] of Object.entries(drivers)) {
      const idx = Number(idxStr);
      if (idx < 0 || idx > 63) continue;

      const distPct = lapDistPcts[idx];
      // Filter cars not loaded in the world or disconnected
      if (distPct === undefined || distPct < 0) continue;

      const surface = trackSurfaces[idx] ?? 3;
      if (surface === -1) continue; // NotInWorld

      const onPit = !!onPitRoads[idx];
      const isActive = idx === activeCarIdx;

      // 3. Wraparound logic across start/finish line
      let diffPct = distPct - activeDistPct;
      if (diffPct > 0.5) {
        diffPct -= 1.0;
      } else if (diffPct < -0.5) {
        diffPct += 1.0;
      }

      // 4. Time delta calculation in seconds
      const estLap = driver.carClassEstLapTime > 10 ? driver.carClassEstLapTime : baselineEstLap;
      // In iRacing standard convention: ahead of us has delta < 0 (they are ahead on track), behind is > 0
      // diffPct > 0 means car is ahead in lap distance, so delta = -diffPct * estLap
      const deltaSeconds = -diffPct * estLap;

      const entry: RelativeEntry = {
        carIdx: idx,
        carNumber: driver.carNumber || String(idx),
        driverName: driver.userName,
        abbrevName: driver.abbrevName || driver.userName,
        carPath: driver.carPath,
        carScreenName: driver.carScreenName,
        carClassShortName: driver.carClassShortName || "GT",
        carClassColor: driver.carClassColor || "#38bdf8",
        licString: driver.licString,
        licBadgeColor: driver.licColor,
        iRatingStr: formatIRating(driver.iRating),
        diffPct,
        deltaSeconds,
        deltaStr: isActive ? "REF" : formatDeltaSeconds(deltaSeconds),
        isActiveCam: isActive,
        isAhead: diffPct > 0,
        onPitRoad: onPit,
        trackSurface: surface,
      };

      allCandidates.push({ entry, diffPct, deltaSeconds });
    }

    // 5. Separate into Ahead (diffPct > 0), Active (diffPct === 0), and Behind (diffPct < 0)
    const activeItem = allCandidates.find((c) => c.entry.isActiveCam);

    // Cars ahead: sorted ascending by diffPct (closest ahead first: smallest positive diffPct)
    const ahead = allCandidates
      .filter((c) => !c.entry.isActiveCam && c.diffPct > 0)
      .sort((a, b) => a.diffPct - b.diffPct);

    // Cars behind: sorted descending by diffPct (closest behind first: largest negative diffPct, closest to 0)
    const behind = allCandidates
      .filter((c) => !c.entry.isActiveCam && c.diffPct < 0)
      .sort((a, b) => b.diffPct - a.diffPct);

    const carAhead = ahead.length > 0 ? ahead[0].entry : null;
    const carBehind = behind.length > 0 ? behind[0].entry : null;

    // Pick up to 4 ahead, in reverse so furthest ahead is on top:
    // [Ahead 4, Ahead 3, Ahead 2, Ahead 1, ACTIVE, Behind 1, Behind 2, Behind 3, Behind 4]
    const sliceAhead = ahead.slice(0, 4).reverse().map((c) => c.entry);
    const sliceBehind = behind.slice(0, 4).map((c) => c.entry);

    const finalEntries: RelativeEntry[] = [];
    sliceAhead.forEach((e) => finalEntries.push(e));
    if (activeItem) {
      finalEntries.push(activeItem.entry);
    } else {
      // Fallback virtual active entry if missing
      const fallbackDriver = drivers[activeCarIdx];
      finalEntries.push({
        carIdx: activeCarIdx,
        carNumber: fallbackDriver?.carNumber || String(activeCarIdx),
        driverName: fallbackDriver?.userName || "Tú",
        abbrevName: fallbackDriver?.abbrevName || "Tú",
        carPath: fallbackDriver?.carPath || "car",
        carScreenName: fallbackDriver?.carScreenName || "Car",
        carClassShortName: fallbackDriver?.carClassShortName || "Class",
        carClassColor: "#10b981",
        licString: fallbackDriver?.licString || "A 4.0",
        licBadgeColor: "#10b981",
        iRatingStr: formatIRating(fallbackDriver?.iRating || 2500),
        diffPct: 0,
        deltaSeconds: 0,
        deltaStr: "REF",
        isActiveCam: true,
        isAhead: false,
        onPitRoad: !!onPitRoads[activeCarIdx],
        trackSurface: 3,
      });
    }
    sliceBehind.forEach((e) => finalEntries.push(e));

    return {
      activeCarIdx,
      entries: finalEntries,
      carAhead,
      carBehind,
    };
  }
}
