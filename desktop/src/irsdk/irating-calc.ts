import type { IrsdkComputedState, LeaderboardEntry } from "./types";

export interface LiveIRatingEstimate {
  sof: number;
  delta: number;
  currentIr: number;
  projectedIr: number;
  classFieldSize: number;
  myClassPos: number;
}

const BR1 = 1600 / Math.LN2;

/**
 * Estimates Strength of Field (SOF) and live iRating gain/loss for the active
 * driver in their car class using iRacing's pairwise Elo model.
 */
export function estimateLiveIRating(state: IrsdkComputedState | null): LiveIRatingEstimate | null {
  if (!state || !state.leaderboard || state.leaderboard.length < 2) return null;

  const activeIdx = state.camCarIdx;
  const driverByIdx = new Map<number, number>();
  for (const d of Object.values(state.session.driverInfo?.drivers ?? {})) {
    if (d.iRating > 0 && !d.isSpectator) {
      driverByIdx.set(d.carIdx, d.iRating);
    }
  }

  const activeEntry = state.leaderboard.find((e) => e.carIdx === activeIdx || e.isActiveCam);
  if (!activeEntry) return null;

  const myIr = driverByIdx.get(activeEntry.carIdx) ?? 0;
  if (myIr <= 0) return null;

  const myClass = activeEntry.carClassShortName;
  const classPeers: Array<{ entry: LeaderboardEntry; ir: number }> = [];
  for (const entry of state.leaderboard) {
    if (myClass && entry.carClassShortName !== myClass) continue;
    const ir = driverByIdx.get(entry.carIdx) ?? 0;
    if (ir > 0) classPeers.push({ entry, ir });
  }

  const n = classPeers.length;
  if (n < 2) return null;

  // SOF = br1 * ln(N / sum(exp(-ir / br1)))
  let expSum = 0;
  for (const p of classPeers) {
    expSum += Math.exp(-p.ir / BR1);
  }
  const sof = Math.round(BR1 * Math.log(n / expSum));

  // Pairwise expected score vs actual finish order in class
  const myRank = classPeers.findIndex((p) => p.entry.carIdx === activeEntry.carIdx);
  if (myRank < 0) return null;

  const kFactor = 200 / n;
  let deltaSum = 0;
  for (let j = 0; j < n; j++) {
    if (j === myRank) continue;
    const oppIr = classPeers[j].ir;
    const expectedWin = 1 / (1 + Math.exp((oppIr - myIr) / BR1));
    const actualWin = myRank < j ? 1 : 0;
    deltaSum += (actualWin - expectedWin) * kFactor;
  }

  const delta = Math.round(deltaSum);
  return {
    sof,
    delta,
    currentIr: myIr,
    projectedIr: Math.max(0, myIr + delta),
    classFieldSize: n,
    myClassPos: myRank + 1,
  };
}

export function formatIRatingDelta(delta: number): string {
  return delta >= 0 ? `+${delta} iR` : `${delta} iR`;
}

export function formatSofShort(sof: number): string {
  if (sof >= 1000) return `${(sof / 1000).toFixed(1)}k`;
  return `${sof}`;
}

export function computeClassSof(iRatings: number[]): number {
  const valid = iRatings.filter((ir) => ir > 0);
  if (valid.length === 0) return 0;
  let expSum = 0;
  for (const ir of valid) expSum += Math.exp(-ir / BR1);
  return Math.round(BR1 * Math.log(valid.length / expSum));
}

/**
 * Estimates live projected iRating gain/loss for every driver in the leaderboard,
 * grouped by CarClassID (or carClassShortName) using iRacing's pairwise Elo model.
 */
export function estimateAllDriversIRatingDeltas(state: IrsdkComputedState | null): Map<number, number> {
  const result = new Map<number, number>();
  if (!state || !state.leaderboard || state.leaderboard.length < 2) return result;

  const driverByIdx = new Map<number, number>();
  for (const d of Object.values(state.session.driverInfo?.drivers ?? {})) {
    if (d.iRating > 0 && !d.isSpectator) {
      driverByIdx.set(d.carIdx, d.iRating);
    }
  }

  const byClass = new Map<string, Array<{ carIdx: number; ir: number; clsPos: number }>>();
  for (const entry of state.leaderboard) {
    const ir = driverByIdx.get(entry.carIdx) ?? 0;
    if (ir <= 0) continue;
    const cls = entry.carClassId ? `id_${entry.carClassId}` : (entry.carClassShortName || "default");
    let list = byClass.get(cls);
    if (!list) {
      list = [];
      byClass.set(cls, list);
    }
    list.push({ carIdx: entry.carIdx, ir, clsPos: entry.classPosition || entry.position });
  }

  for (const peers of byClass.values()) {
    peers.sort((a, b) => a.clsPos - b.clsPos);
    const n = peers.length;
    if (n < 2) continue;
    const kFactor = 200 / n;
    for (let i = 0; i < n; i++) {
      const myIr = peers[i].ir;
      let deltaSum = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const expectedWin = 1 / (1 + Math.exp((peers[j].ir - myIr) / BR1));
        const actualWin = i < j ? 1 : 0;
        deltaSum += (actualWin - expectedWin) * kFactor;
      }
      result.set(peers[i].carIdx, Math.round(deltaSum));
    }
  }

  return result;
}
