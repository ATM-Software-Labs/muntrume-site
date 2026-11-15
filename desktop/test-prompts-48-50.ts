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

  console.log("ALL PROMPTS 48-50 TESTS PASSED");
}

void runTests();
