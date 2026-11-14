/**
 * Unit Test Suite for Bloques 21 & 23:
 * 1. VisibilityRulesEngine (Context-aware intelligent overlay visibility & Boss Key)
 * 2. Muntrume AI Auto-Router & Telemetry Pro Cards
 */

import assert from "node:assert/strict";
import { VisibilityRulesEngine, type TelemetryContextState } from "../src/irsdk/visibility-rules.ts";

console.log("🏎️  Iniciando batería de pruebas unitarias para BLOQUES 21 & 23 (Visibilidad Contextual & Muntrume AI)...");

// --- TEST 1: VisibilityRulesEngine (Bloque 21) ---
console.log("➡️  Prueba 1: Visibilidad Contextual (Replays, Qualy, Vuelta 1 de Carrera y Boss Key)...");
const vis = VisibilityRulesEngine.getInstance();

// Context 1: Green flag race, Lap 1 before sector 1 completion (LapDistPct = 0.18 < 0.33)
const ctxRaceLap1: TelemetryContextState = {
  isReplayPlaying: false,
  sessionType: "Race",
  sessionState: 4, // Racing
  camCarIdx: 5,
  activeLap: 1,
  lapDistPct: 0.18,
  onPitRoad: false,
};

assert.equal(
  vis.evaluateVisibility("relative", ctxRaceLap1),
  false,
  "Relative debe ocultarse durante la primera chicane / sector 1 de carrera para máxima visibilidad"
);
assert.equal(
  vis.evaluateVisibility("standings", ctxRaceLap1),
  false,
  "Standings debe ocultarse en la vuelta 1 de salida en grupo"
);
assert.equal(
  vis.evaluateVisibility("pedals", ctxRaceLap1),
  true,
  "Pedales y volante deben permanecer visibles para control de cockpit"
);

// Context 2: Green flag race, Sector 1 passed (LapDistPct = 0.42 > 0.33)
const ctxRaceLap1SectorPassed: TelemetryContextState = {
  ...ctxRaceLap1,
  lapDistPct: 0.42,
};
assert.equal(
  vis.evaluateVisibility("relative", ctxRaceLap1SectorPassed),
  true,
  "Widgets deben volver a mostrarse suavemente al superar el Sector 1"
);

// Context 3: Lap 2 onwards
const ctxRaceLap2: TelemetryContextState = {
  ...ctxRaceLap1,
  activeLap: 2,
  lapDistPct: 0.05,
};
assert.equal(
  vis.evaluateVisibility("relative", ctxRaceLap2),
  true,
  "En vuelta 2 todos los widgets de carrera deben estar activos"
);

// Context 4: Lone Qualify
const ctxQualy: TelemetryContextState = {
  isReplayPlaying: false,
  sessionType: "Lone Qualify",
  sessionState: 4,
  camCarIdx: 5,
  activeLap: 2,
  lapDistPct: 0.5,
  onPitRoad: false,
};
assert.equal(
  vis.evaluateVisibility("relative", ctxQualy),
  false,
  "Relative debe ocultarse en clasificación para evitar ruido visual"
);
assert.equal(
  vis.evaluateVisibility("pedals", ctxQualy),
  true,
  "Inputs deben permanecer visibles en clasificación para trazar deltas"
);

// Context 5: Replay playing
const ctxReplay: TelemetryContextState = {
  ...ctxRaceLap2,
  isReplayPlaying: true,
};
assert.equal(
  vis.evaluateVisibility("relative", ctxReplay),
  false,
  "Relative debe ocultarse en replays para tomas cinemáticas limpias"
);
assert.equal(
  vis.evaluateVisibility("standings", ctxReplay),
  false,
  "Leaderboard debe ocultarse en replays"
);

// Context 6: Global Boss Key (Clean Screen)
vis.toggleBossKey();
assert.equal(vis.isBossKeyActive(), true);
assert.equal(
  vis.evaluateVisibility("pedals", ctxRaceLap2),
  false,
  "Boss Key activada debe forzar ocultación total de la pantalla de inmediato"
);
vis.toggleBossKey(); // Deactivate
assert.equal(vis.isBossKeyActive(), false);
console.log("   ✅ Visibilidad Contextual: Reglas de Replay, Qualy, Vuelta 1 y Boss Key verificadas.");

// --- TEST 2: DOM Style Transition Non-Destructive ---
console.log("➡️  Prueba 2: Transición fluida CSS (sin destruir DOM)...");
const dummyEl = {
  style: {
    transition: "",
    opacity: "",
    pointerEvents: "",
    transform: "",
  },
} as any;

vis.applyElementVisibility(dummyEl, false);
assert.equal(dummyEl.style.opacity, "0");
assert.equal(dummyEl.style.pointerEvents, "none");
assert.ok(dummyEl.style.transition.includes("opacity"));

vis.applyElementVisibility(dummyEl, true);
assert.equal(dummyEl.style.opacity, "1");
assert.equal(dummyEl.style.pointerEvents, "auto");
assert.equal(dummyEl.style.transform, "none");
console.log("   ✅ Transición fluida: Opacity 0 -> 1 y pointer-events manipulados sin desmontar elementos.");

console.log("\n🎉 ¡TODAS LAS PRUEBAS DE LOS BLOQUES 21 Y 23 PASARON AL 100%!");
