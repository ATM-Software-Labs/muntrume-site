import assert from "node:assert/strict";
import { PitExitPredictor } from "../src/irsdk/pit-exit-predictor";
import { TireThermalEngine } from "../src/irsdk/tire-thermal-widget";
import { AeroSuspensionAnalyzer } from "../src/telemetry/aero-analyzer";
import { BroadcastDirector } from "../src/irsdk/broadcast-director";
import type { LeaderboardEntry } from "../src/irsdk/types";

console.log("🧪 [Prompts 34-37] Iniciando suite de verificación de módulos de ingeniería...");

// 1. Prompt 34: PitExitPredictor
const pit = new PitExitPredictor();
pit.observePitTransition("spa", true, 100);
const cal = pit.observePitTransition("spa", false, 128);
assert.ok(cal && cal.pitLossSeconds > 15 && cal.pitLossSeconds < 40, "Calibración automática de pit lane válida");
const pred = pit.predict({
  trackKey: "spa",
  activeCarIdx: 0,
  activeLapDistPct: 0.9,
  estLapTimeS: 100,
  cars: [
    { carIdx: 1, carNumber: "22", driverName: "A. Driver", carClassShortName: "GT3", lapDistPct: 0.665, onPitRoad: false, isLapped: true },
    { carIdx: 2, carNumber: "44", driverName: "B. Driver", carClassShortName: "GT3", lapDistPct: 0.64, onPitRoad: false },
  ],
});
assert.ok(pred.trafficWarning, "Debe avisar de tráfico doblado cerca de la salida de boxes");
assert.equal(pred.aheadCar?.carNumber, "22");

// 2. Prompt 35: TireThermalEngine
const tire = new TireThermalEngine();
const snap1 = tire.evaluate({
  onPitRoad: false,
  LF: { innerC: 55, middleC: 75, outerC: 100, pressureKpa: 160 },
  RF: { innerC: 80, middleC: 78, outerC: 74, pressureKpa: 162 },
  LR: { innerC: 72, middleC: 72, outerC: 70, pressureKpa: 158 },
  RR: { innerC: 71, middleC: 71, outerC: 69, pressureKpa: 158 },
});
assert.equal(snap1.corners.LF.innerState, "cold");
assert.equal(snap1.corners.LF.middleState, "optimal");
assert.equal(snap1.corners.LF.outerState, "hot");
assert.equal(snap1.corners.RF.camberDeltaC, 6);

const snap2 = tire.evaluate({
  onPitRoad: false,
  LF: { innerC: 84, middleC: 80, outerC: 76, pressureKpa: 170 },
  RF: { innerC: 82, middleC: 79, outerC: 75, pressureKpa: 172 },
  LR: { innerC: 75, middleC: 74, outerC: 72, pressureKpa: 165 },
  RR: { innerC: 74, middleC: 73, outerC: 71, pressureKpa: 165 },
});
assert.equal(snap2.corners.LF.deltaKpa, 10);
assert.ok(snap2.corners.LF.deltaPsi > 1.4 && snap2.corners.LF.deltaPsi < 1.5);

// 3. Prompt 36: AeroSuspensionAnalyzer
const aero = new AeroSuspensionAnalyzer();
const report = aero.analyze([
  { distM: 100, lapTimeS: 5, speedKmh: 70, throttle: 0.4, brake: 0, steeringRad: 0.2, lfRideHeightMm: 35, rfRideHeightMm: 35, lrRideHeightMm: 55, rrRideHeightMm: 55, lfShockDeflMm: 20 },
  { distM: 500, lapTimeS: 12, speedKmh: 250, throttle: 1, brake: 0, steeringRad: 0, lfRideHeightMm: 18, rfRideHeightMm: 18, lrRideHeightMm: 32, rrRideHeightMm: 32, lfShockDeflMm: 45 },
  { distM: 750, lapTimeS: 16, speedKmh: 180, throttle: 0, brake: 0.9, steeringRad: 0, lfRideHeightMm: 0, rfRideHeightMm: 0.4, lrRideHeightMm: 48, rrRideHeightMm: 48, lfShockDeflMm: 58 },
]);
assert.equal(report.staticRakeMm, 20);
assert.equal(report.highSpeedRakeMm, 14);
assert.equal(report.aeroCompressionMm, 6);
assert.equal(report.bottomingEvents.length, 1);
assert.equal(report.bottomingEvents[0].phase, "braking");

// 4. Prompt 37: BroadcastDirector
const director = new BroadcastDirector();
director.configure({ enabled: true, minHoldSeconds: 5, battleGapThresholdS: 0.4, parallelMinSeconds: 3 });
const fakeLb: LeaderboardEntry[] = [
  { position: 1, classPosition: 1, carIdx: 1, carNumber: "16", driverName: "A. Trujillo", abbrevName: "A. Trujillo", carPath: "ferrari296gt3", carScreenName: "Ferrari 296 GT3", carClassShortName: "GT3", carClassColor: "#fff", licString: "A", licBadgeColor: "#fff", iRatingStr: "3k", bestLapTime: 100, bestLapStr: "1:40", lastLapTime: 100, lastLapStr: "1:40", gapSeconds: 0, gapStr: "-", intervalSeconds: 0, intervalStr: "-", onPitRoad: false, isActiveCam: true, lapsCompleted: 5 },
  { position: 2, classPosition: 2, carIdx: 2, carNumber: "24", driverName: "M. Berbis", abbrevName: "M. Berbis", carPath: "porsche992rgt3", carScreenName: "Porsche 992 GT3 R", carClassShortName: "GT3", carClassColor: "#fff", licString: "A", licBadgeColor: "#fff", iRatingStr: "3k", bestLapTime: 100.2, bestLapStr: "1:40", lastLapTime: 100.2, lastLapStr: "1:40", gapSeconds: 0.25, gapStr: "+0.25", intervalSeconds: 0.25, intervalStr: "+0.25", onPitRoad: false, isActiveCam: false, lapsCompleted: 5 },
];
const cmd = director.evaluateCamera(fakeLb, 100);
assert.ok(cmd && cmd.type === "CamSwitchPos" && cmd.carIdx === 2 && cmd.reason === "close_battle");
assert.equal(director.observeParallelBattle(1, 200, "16", "A. Trujillo"), null);
const clip = director.observeParallelBattle(1, 203.5, "16", "A. Trujillo");
assert.ok(clip && clip.reason === "parallel_battle");
assert.ok(director.exportCsv().includes("parallel_battle"));

console.log("✅ [Prompts 34-37] Todos los módulos de ingeniería verificados al 100%.");
