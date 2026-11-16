import assert from "node:assert";
import { webcrypto } from "node:crypto";
import {
  detectProfileConflict,
  decryptProfileEnvelope,
  encryptProfileSnapshot,
  MAX_PROFILE_BYTES,
  type UserProfileSnapshot,
} from "./src/sync/user-profile-sync";
import { ActiveTrackCoach, buildReferenceCorners, isRaceSession } from "./src/telemetry/active-track-coach";
import { getCalendarContentStatus } from "./src/features-48-50";
import type { SignalSample } from "./src/telemetry/signal-cleaner";
import { buildCompactStandingsWindow, buildZeroBloatStandings } from "./src/irsdk/overlay-renderer";
import type { LeaderboardEntry } from "./src/irsdk/types";

// Polyfill browser globals for Node test runner
const memStorage = new Map<string, string>();
(globalThis as unknown as Record<string, unknown>).localStorage = {
  getItem: (k: string) => memStorage.get(k) ?? null,
  setItem: (k: string, v: string) => { memStorage.set(k, v); },
  removeItem: (k: string) => { memStorage.delete(k); },
};
if (!globalThis.crypto) {
  (globalThis as unknown as Record<string, unknown>).crypto = webcrypto;
}

async function runTests() {
  // 1. Prompt 49: Encrypted profile sync (< 50 KB) + conflict detection
  const sampleProfile: UserProfileSnapshot = {
    version: 1,
    updatedAt: 1794750000000,
    deviceLabel: "Rig Principal",
    overlayLayouts: { standings: { x: 24, y: 40, scale: 1 } },
    visibilityRules: { hideInReplay: true, hideInQualy: false, hideInRaceLap1: true },
    driverTags: [{ name: "Rival #12", tag: "rival" }],
    trackWalkNotes: { fuji_gp: "T1 frenada 100m, T3 trail-brake largo" },
    preferences: { monitorType: "triple", hudTheme: "dark-carbon", spotterEnabled: true },
  };

  const envelope = await encryptProfileSnapshot(sampleProfile, "secret-pilot-token");
  assert(envelope.bytes > 0 && envelope.bytes <= MAX_PROFILE_BYTES, "Encrypted profile must be < 50 KB");
  const decrypted = await decryptProfileEnvelope(envelope, "secret-pilot-token");
  assert.strictEqual(decrypted.deviceLabel, "Rig Principal");
  assert.strictEqual(decrypted.trackWalkNotes.fuji_gp, sampleProfile.trackWalkNotes.fuji_gp);

  assert.strictEqual(detectProfileConflict(1000, 5000), "cloud_newer");
  assert.strictEqual(detectProfileConflict(5000, 1000), "local_newer");
  assert.strictEqual(detectProfileConflict(5000, 5200), "in_sync");

  // 2. Prompt 50: ActiveTrackCoach (Practice alerts vs Race auto-off)
  const refSamples: SignalSample[] = [
    { dist: 50, speed: 252, thr: 100, brk: 0, gear: 6 },
    { dist: 100, speed: 250, thr: 100, brk: 0, gear: 6 },
    { dist: 150, speed: 245, thr: 100, brk: 0, gear: 6 },
    { dist: 200, speed: 240, thr: 0, brk: 85, gear: 5 },
    { dist: 230, speed: 165, thr: 0, brk: 95, gear: 4 },
    { dist: 260, speed: 110, thr: 0, brk: 45, gear: 3 },
    { dist: 290, speed: 92, thr: 20, brk: 10, gear: 2 },
    { dist: 330, speed: 125, thr: 100, brk: 0, gear: 3 },
    { dist: 380, speed: 168, thr: 100, brk: 0, gear: 4 },
    { dist: 430, speed: 205, thr: 100, brk: 0, gear: 5 },
  ];

  const corners = buildReferenceCorners(refSamples);
  assert(corners.length === 1, "Should detect 1 corner in synthetic reference lap");
  assert.strictEqual(corners[0].brakePointDist, 200);
  assert.strictEqual(corners[0].apexSpeedKmh, 92);

  const coach = new ActiveTrackCoach();
  coach.setReferenceSamples(refSamples);
  coach.updateSettings({ enabled: true, volume: 0.3 });

  assert.strictEqual(isRaceSession("Race"), true);
  assert.strictEqual(isRaceSession("Practice"), false);

  // Race session -> silent (null)
  const raceAlert = coach.evaluateLiveTick(
    { sessionType: "Race", distM: 222, speedKmh: 220, brakePct: 60, nowMs: 10_000 },
    false,
  );
  assert.strictEqual(raceAlert, null, "Coach must be auto-disabled in Race");

  // Practice session: braking >15m late (222m vs 200m = +22m)
  const lateBrakeAlert = coach.evaluateLiveTick(
    { sessionType: "Practice", distM: 222, speedKmh: 220, brakePct: 60, nowMs: 20_000 },
    false,
  );
  assert(lateBrakeAlert && lateBrakeAlert.type === "late_brake", "Should trigger late_brake alert in Practice");

  // Practice session: slow apex (82 km/h vs 92 km/h = -10 km/h)
  const slowApexAlert = coach.evaluateLiveTick(
    { sessionType: "Practice", distM: 290, speedKmh: 82, brakePct: 0, nowMs: 40_000 },
    false,
  );
  assert(slowApexAlert && slowApexAlert.type === "slow_apex", "Should trigger slow_apex alert in Practice");

  // 3. Calendar content status helper
  const status = getCalendarContentStatus("Fuji International Speedway - Grand Prix", []);
  assert.strictEqual(status.installed, true);
  assert.strictEqual(status.refTrackKey, "fuji");

  // 4. Prompt 51: Compact Standings window on a 40-car grid (P22 active)
  const grid40: LeaderboardEntry[] = Array.from({ length: 40 }, (_, i) => ({
    position: i + 1,
    classPosition: i + 1,
    carIdx: i,
    carNumber: String(i + 1),
    driverName: `Driver ${i + 1}`,
    abbrevName: `D. ${i + 1}`,
    carPath: "bmwm4gt3",
    carScreenName: "BMW M4 GT3",
    carClassShortName: "GT3",
    carClassColor: "#00d97e",
    licString: "A 3.50",
    licBadgeColor: "#0153db",
    iRatingStr: "2.5k",
    bestLapTime: 97 + i * 0.1,
    bestLapStr: "1:37.000",
    lastLapTime: 97.2 + i * 0.1,
    lastLapStr: "1:37.200",
    gapSeconds: i * 0.5,
    gapStr: i === 0 ? "LEADER" : `+${(i * 0.5).toFixed(1)}s`,
    intervalSeconds: 0.5,
    intervalStr: "+0.5s",
    onPitRoad: false,
    isActiveCam: i === 21, // P22
    lapsCompleted: 5,
  }));
  const compact = buildCompactStandingsWindow(grid40);
  assert(compact.length <= 11, `Compact standings should be <= 11 rows, got ${compact.length}`);
  assert(compact.some((r) => r.kind === "separator"), "Should include separator when P22 is outside Top 6");
  assert(
    compact.some((r) => r.kind === "entry" && r.entry.position === 22),
    "Should include active P22 car",
  );

  // Prompt 121: Zero-Bloat 60-car multiclass Standings cap
  const grid60 = Array.from({ length: 60 }, (_, i) => ({
    carIdx: i,
    position: i + 1,
    classPosition: (i % 30) + 1,
    carNumber: `${i + 1}`,
    abbrevName: `D${i + 1}`,
    teamName: `T${i + 1}`,
    carClassShortName: i < 30 ? "GTP" : "GT3",
    carClassColor: i < 30 ? "#ef4444" : "#38bdf8",
    iRating: 2500,
    licString: "A 4.99",
    lastLapTime: 90,
    bestLapTime: 89,
    gapToLeader: i * 0.5,
    onPitRoad: false,
    isActiveCam: i === 51, // P22 in GT3
    lapsCompleted: 5,
  }));
  const zb = buildZeroBloatStandings(grid60);
  const zbEntries = zb.filter((r): r is Extract<typeof r, { kind: "entry" }> => r.kind === "entry");
  assert(zbEntries.length <= 15, `Zero-bloat standings should have <= 15 driver rows, got ${zbEntries.length}`);
  assert(zbEntries.every((r) => r.entry.carClassShortName === "GT3"), "Should filter to active GT3 class");
  assert(zbEntries.some((r) => r.entry.carIdx === 51), "Should include active player car");

  console.log("ALL PROMPTS 48-50 TESTS PASSED");
}

void runTests();
