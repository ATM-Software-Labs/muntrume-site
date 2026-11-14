/**
 * Prompt 30.1: Mock del SDK de iRacing (mock-irsdk.test.ts)
 * Valida tramas de telemetría en 4 escenarios críticos:
 * (a) Coche parado en boxes (OnPitRoad: true)
 * (b) Salida de carrera en Vuelta 1 (SessionState: 4, CarIdxLap: 1)
 * (c) Modo repetición enfocando otro coche (IsReplayPlaying: true, CamCarIdx: 12)
 * (d) Cruce por línea de meta (LapDistPct pasando de 0.99 a 0.01)
 */

import assert from "node:assert/strict";
import { parseSessionInfoYaml } from "../src/irsdk/yaml-parser.ts";
import { RelativeEngine } from "../src/irsdk/relative-engine.ts";
import { LeaderboardEngine } from "../src/irsdk/leaderboard-engine.ts";
import { FuelCalculator } from "../src/irsdk/fuel-calculator.ts";
import { VisibilityRulesEngine } from "../src/irsdk/visibility-rules.ts";
import type { IrsdkTelemetryFrame } from "../src/irsdk/types.ts";

console.log("🏎️  [Prompt 30.1] Iniciando suite mock-irsdk.test.ts...");

function buildSession() {
  const drivers = Array.from({ length: 16 }, (_, i) => `
  - CarIdx: ${i}
    UserName: "Pilot ${i}"
    CarNumber: "${10 + i}"
    CarPath: "${i % 2 === 0 ? "porsche992rgt3" : "ferrari296gt3"}"
    CarScreenName: "${i % 2 === 0 ? "Porsche 911 GT3 R (992)" : "Ferrari 296 GT3"}"
    CarClassShortName: "GT3"
    CarClassColor: 0x38bdf8
    CarClassEstLapTime: 100.0
    IRating: ${2000 + i * 100}
    LicString: "A 4.00"
    CarIsPaceCar: ${i === 0 ? 1 : 0}
    IsSpectator: 0`).join("");

  return parseSessionInfoYaml(`
WeekendInfo:
  TrackName: "Circuit de Spa-Francorchamps"
  TrackLength: "7.00 km"
SessionInfo:
  Sessions:
  - SessionNum: 0
    SessionType: "Race"
DriverInfo:
  DriverCarIdx: 1
  DriverCarEstLapTime: 100.0
  Drivers:${drivers}
`, 1);
}

function baseFrame(overrides: Partial<IrsdkTelemetryFrame> = {}): IrsdkTelemetryFrame {
  const n = 16;
  const zeros = () => new Array(n).fill(0);
  const falses = () => new Array(n).fill(false);
  return {
    timestamp: Date.now(),
    sessionTime: 120.0,
    sessionTimeRemain: 1800,
    sessionLapsRemain: 20,
    sessionState: 4,
    sessionFlags: 0,
    sessionNum: 0,
    sessionInfoUpdate: 1,
    isReplayPlaying: false,
    camCarIdx: 1,
    playerCarIdx: 1,
    onPitRoad: false,
    fuelLevel: 45.0,
    fuelLevelPct: 0.5,
    fuelUsePerHour: 0,
    lap: 1,
    lapDistPct: 0.5,
    lapBestLapTime: 0,
    lapLastLapTime: 0,
    lapCurrentLapTime: 45.0,
    lapDeltaToBestLap: 0,
    speed: 55.0,
    rpm: 6500,
    gear: 4,
    throttle: 1.0,
    brake: 0.0,
    clutch: 1.0,
    steeringWheelAngle: 0.0,
    carIdxLap: new Array(n).fill(1),
    carIdxLapCompleted: new Array(n).fill(0),
    carIdxLapDistPct: new Array(n).fill(0.5),
    carIdxPosition: Array.from({ length: n }, (_, i) => i),
    carIdxClassPosition: Array.from({ length: n }, (_, i) => i),
    carIdxEstTime: zeros(),
    carIdxF2Time: zeros(),
    carIdxBestLapTime: new Array(n).fill(101.2),
    carIdxLastLapTime: new Array(n).fill(101.5),
    carIdxOnPitRoad: falses(),
    carIdxTrackSurface: new Array(n).fill(3),
    carIdxGear: new Array(n).fill(4),
    carIdxRpm: new Array(n).fill(6500),
    carLeftRight: 0,
    ...overrides,
  };
}

const session = buildSession();
const visibility = VisibilityRulesEngine.getInstance();
const relEngine = new RelativeEngine();
const lbEngine = new LeaderboardEngine();

// --- Escenario (a): Coche parado en boxes (OnPitRoad: true) ---
console.log("➡️  Escenario (a): Coche parado en boxes (OnPitRoad: true)...");
const fuelPit = new FuelCalculator();
const pitFrame = baseFrame({
  onPitRoad: true,
  speed: 0,
  fuelLevel: 60.0,
  carIdxOnPitRoad: [false, true, ...new Array(14).fill(false)],
});
const pitFuelRes = fuelPit.update(pitFrame, 100.0);
assert.equal(pitFuelRes.isValid, false, "Fuel en boxes debe marcar isValid=false");
assert.equal(FuelCalculator.formatLiters(pitFuelRes.fuelPerLapAvg, pitFuelRes.isValid), "-- L");
assert.ok(Number.isFinite(pitFuelRes.fuelRemainingL), "fuelRemainingL nunca debe ser NaN");

const relPit = relEngine.compute(pitFrame, session.driverInfo);
const lbPit = lbEngine.compute(pitFrame, session.driverInfo, "Race");
assert.ok(relPit.entries.every((r) => Number.isFinite(r.deltaSeconds)), "Relative sin NaN en boxes");
assert.ok(lbPit.length > 0, "Leaderboard válido en boxes");

// --- Escenario (b): Salida de carrera en Vuelta 1 (SessionState: 4, CarIdxLap: 1) ---
console.log("➡️  Escenario (b): Salida de carrera en Vuelta 1...");
const lap1Frame = baseFrame({
  sessionState: 4,
  lap: 1,
  lapDistPct: 0.12,
  carIdxLap: new Array(16).fill(1),
  carIdxLapDistPct: Array.from({ length: 16 }, (_, i) => 0.12 - i * 0.005),
});
const visCtxLap1 = {
  isReplayPlaying: false,
  sessionType: "Race",
  sessionState: 4,
  camCarIdx: 1,
  activeLap: 1,
  lapDistPct: 0.12,
  onPitRoad: false,
};
assert.equal(visibility.evaluateVisibility("relative", visCtxLap1), false, "Relative oculto en salida Vuelta 1");
assert.equal(visibility.evaluateVisibility("standings", visCtxLap1), false, "Standings oculto en salida Vuelta 1");
assert.equal(visibility.evaluateVisibility("pedals", visCtxLap1), true, "Pedales visibles en salida Vuelta 1");

// Tras pasar el primer sector (0.45 > 0.33), los widgets vuelven a mostrarse
assert.equal(
  visibility.evaluateVisibility("relative", { ...visCtxLap1, lapDistPct: 0.45 }),
  true,
  "Relative vuelve a mostrarse pasado el sector 1"
);

// --- Escenario (c): Modo repetición enfocando otro coche (IsReplayPlaying: true, CamCarIdx: 12) ---
console.log("➡️  Escenario (c): Modo repetición enfocando CamCarIdx: 12...");
const replayFrame = baseFrame({
  isReplayPlaying: true,
  playerCarIdx: 1,
  camCarIdx: 12,
  carIdxLapDistPct: Array.from({ length: 16 }, (_, i) => (i === 12 ? 0.75 : 0.25 + i * 0.02)),
});
const fuelReplay = new FuelCalculator();
const replayFuelRes = fuelReplay.update(replayFrame, 100.0);
assert.equal(replayFuelRes.isValid, false, "Fuel deshabilitado en modo Replay");
assert.equal(FuelCalculator.formatLiters(replayFuelRes.fuelPerLapAvg, replayFuelRes.isValid), "-- L");

const relReplay = relEngine.compute(replayFrame, session.driverInfo);
assert.equal(relReplay.activeCarIdx, 12, "Relative debe usar CamCarIdx (12) y no PlayerCarIdx (1) en replay");
const activeRow = relReplay.entries.find((r) => r.carIdx === 12);
assert.ok(activeRow && activeRow.deltaSeconds === 0, "Coche activo en replay debe ser carIdx 12 con delta 0");

const visReplayCtx = {
  isReplayPlaying: true,
  sessionType: "Race",
  sessionState: 4,
  camCarIdx: 12,
  activeLap: 5,
  lapDistPct: 0.75,
  onPitRoad: false,
};
assert.equal(visibility.evaluateVisibility("relative", visReplayCtx), false, "Relative oculto en replay");
assert.equal(visibility.evaluateVisibility("pedals", visReplayCtx), true, "Pedales permitidos en replay por defecto");

// --- Escenario (d): Cruce por línea de meta (LapDistPct pasando de 0.99 a 0.01) ---
console.log("➡️  Escenario (d): Cruce por línea de meta (0.99 -> 0.01)...");
const distWrap = new Array(16).fill(0.5);
distWrap[1] = 0.01; // CamCar acaba de cruzar meta
distWrap[2] = 0.99; // Coche justo detrás (0.02 vuelta = ~2.0s detrás)
distWrap[3] = 0.03; // Coche justo delante (0.02 vuelta = ~2.0s delante)
const wrapFrame = baseFrame({
  camCarIdx: 1,
  lapDistPct: 0.01,
  carIdxLapDistPct: distWrap,
});
const relWrap = relEngine.compute(wrapFrame, session.driverInfo);
const behind = relWrap.entries.find((r) => r.carIdx === 2);
const ahead = relWrap.entries.find((r) => r.carIdx === 3);
assert.ok(behind && behind.deltaSeconds > 1.5 && behind.deltaSeconds < 2.5, `Delta detrás inválido: ${behind?.deltaSeconds}`);
assert.ok(ahead && ahead.deltaSeconds < -1.5 && ahead.deltaSeconds > -2.5, `Delta delante inválido: ${ahead?.deltaSeconds}`);

console.log("✅ [Prompt 30.1] Todos los escenarios mock-irsdk.test.ts superados sin NaN ni regresiones.");
