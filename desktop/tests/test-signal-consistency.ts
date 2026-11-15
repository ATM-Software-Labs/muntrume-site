import assert from "node:assert/strict";
import { cleanTelemetrySignals, detectCornerKeyEvents } from "../src/telemetry/signal-cleaner";
import { analyzeStintConsistency } from "../src/telemetry/consistency";

const noisy = [
  { dist: 0, speed: 240, thr: 99.1, brk: 0.9, gear: 6, steering: 0 },
  { dist: 100, speed: 238, thr: 0.8, brk: 82, gear: 5, steering: 0.02 },
  { dist: 150, speed: 150, thr: 0.5, brk: 55, gear: 3, steering: 0.35 },
  { dist: 200, speed: 120, thr: 30, brk: 12, gear: 2, steering: 0.45 },
  { dist: 250, speed: 155, thr: 99.2, brk: 1.0, gear: 3, steering: 0.1 },
];

const cleaned = cleanTelemetrySignals(noisy);
assert.equal(cleaned[0].thr, 100);
assert.equal(cleaned[0].brk, 0);
assert.equal(cleaned[1].brk, 82);
assert.equal(cleaned[4].thr, 100);

const events = detectCornerKeyEvents(cleaned);
assert.equal(events.length, 1);
assert.equal(events[0].brakePointDist, 100);
assert.equal(events[0].peakBrakeDist, 100);
assert.equal(events[0].fullThrottleDist, 250);
assert.ok(events[0].trailBrakingPct > 0);

const stint = analyzeStintConsistency([
  { lapNum: 1, lapTimeS: 110.2, topSpeedKmh: 250, deltaS: 12, isValid: false, invalidReason: "Boxes" },
  { lapNum: 2, lapTimeS: 97.6, topSpeedKmh: 255, deltaS: 0.2, isValid: true },
  { lapNum: 3, lapTimeS: 97.4, topSpeedKmh: 256, deltaS: 0.0, isValid: true },
  { lapNum: 4, lapTimeS: 97.8, topSpeedKmh: 255, deltaS: 0.4, isValid: true },
]);
assert.equal(stint.cleanCount, 3);
assert.equal(stint.discardedCount, 1);
assert.ok(stint.optimalLapS <= 97.4);
assert.ok(stint.consistencyScore >= 90);

console.log("✅ test-signal-consistency.ts: cleanTelemetrySignals, detectCornerKeyEvents y analyzeStintConsistency OK");
