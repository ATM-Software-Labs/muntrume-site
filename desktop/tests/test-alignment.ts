import assert from "node:assert/strict";
import { areSessionsCompatible, computeDistanceDelta, resampleTrackByDistance } from "../src/telemetry/alignment";

const refSamples = [
  { dist: 0, speed: 220, thr: 100, brk: 0, gear: 5, steering: 0, lapTimeS: 0 },
  { dist: 500, speed: 120, thr: 0, brk: 80, gear: 3, steering: 0.4, lapTimeS: 9.0 },
  { dist: 1000, speed: 240, thr: 100, brk: 0, gear: 6, steering: 0, lapTimeS: 18.0 },
];

const userSamples = [
  { dist: 0, speed: 220, thr: 100, brk: 0, gear: 5, steering: 0, lapTimeS: 0 },
  { dist: 500, speed: 110, thr: 0, brk: 85, gear: 3, steering: 0.45, lapTimeS: 9.4 },
  { dist: 1000, speed: 235, thr: 100, brk: 0, gear: 6, steering: 0, lapTimeS: 18.75 },
];

const refGrid = resampleTrackByDistance(refSamples, 1000, 1);
const userGrid = resampleTrackByDistance(userSamples, 1000, 1);
assert.equal(refGrid.length, 1001);
assert.equal(userGrid.length, 1001);
assert.equal(Math.round(refGrid[250].speed), 170);

const deltas = computeDistanceDelta(userGrid, refGrid, 18.75, 18.0);
assert.equal(deltas[0], 0);
assert.ok(Math.abs(deltas[deltas.length - 1] - 0.75) < 1e-6);

assert.equal(areSessionsCompatible({ carPath: "bmwm4gt3", trackName: "Fuji" }, { carPath: "bmwm4gt3", trackName: "Fuji Speedway" }), true);
assert.equal(areSessionsCompatible({ carPath: "bmwm4gt3", trackName: "Fuji" }, { carPath: "ferrari296gt3", trackName: "Fuji" }), false);

console.log("✅ test-alignment.ts: resampleTrackByDistance, computeDistanceDelta y areSessionsCompatible OK");
