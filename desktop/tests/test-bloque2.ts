/**
 * Unit Test Suite for Bloque 2 (Kapps 2027 Visual Overlays, 60 FPS, GPU Pedals,
 * Radar 360°, Pitbox Helper, DigiFlag, Driver Tags & Smart Layouts).
 */

import assert from "node:assert/strict";
import { DriverTagsManager } from "../src/irsdk/driver-tags.ts";
import { SmartLayoutManager } from "../src/irsdk/smart-layouts.ts";
import { GpuPedalsEngine } from "../src/irsdk/gpu-pedals.ts";
import { Radar360Engine } from "../src/irsdk/radar-360.ts";
import { PitboxHelperEngine } from "../src/irsdk/pitbox-helper.ts";
import { DigiFlagEngine } from "../src/irsdk/digi-flag.ts";

console.log("🏁  Iniciando batería de pruebas unitarias para BLOQUE 2 (Overlays Kapps 2027)...");

// --- TEST 1: Driver Tags Engine (Local Persistence & Badges) ---
console.log("➡️  Prueba 1: Driver Tags Engine...");
const tagsMgr = DriverTagsManager.getInstance();

tagsMgr.setTag("16", "rival", "Piloto muy agresivo en frenada T1");
tagsMgr.setTag("Max Verstappen", "clean", "Limpio en paralelos");
tagsMgr.setTag("993381", "friend", "Compañero de equipo MMT");

const tag16 = tagsMgr.getTag("16");
assert.ok(tag16, "Debe existir tag para #16");
assert.equal(tag16?.type, "rival");
assert.equal(tag16?.notes, "Piloto muy agresivo en frenada T1");

const tagMax = tagsMgr.getTag("max verstappen");
assert.ok(tagMax, "Debe resolver tag insensible a mayúsculas/minúsculas");
assert.equal(tagMax?.type, "clean");

const badgeHtml = tagsMgr.renderBadgeHtml("16");
assert.ok(badgeHtml.includes("RIVAL"), "El badge HTML debe contener la etiqueta RIVAL");
assert.ok(badgeHtml.includes("rgba(239, 68, 68"), "El badge HTML debe usar el color rojo de alerta");

tagsMgr.removeTag("16");
assert.equal(tagsMgr.getTag("16"), null, "El tag eliminado ya no debe existir");
console.log("   ✅ Driver Tags: Asignación, normalización de claves, badges visuales y eliminación correctas.");

// --- TEST 2: Smart Layouts & Streamer Mode ---
console.log("➡️  Prueba 2: Smart Layouts & Streamer Mode...");
const layoutMgr = SmartLayoutManager.getInstance();

assert.equal(layoutMgr.resolveCategory("Sports Car GT3", "ferrari296gt3"), "gt3");
assert.equal(layoutMgr.resolveCategory("Formula Super Formula", "sf23"), "formula");
assert.equal(layoutMgr.resolveCategory("NASCAR Cup Series", "stockcar_chevrolet"), "oval");
assert.equal(layoutMgr.resolveCategory("Rallycross", "beetle"), "general");

assert.equal(layoutMgr.resolveSession("Lone Qualifying"), "qualy");
assert.equal(layoutMgr.resolveSession("Practice 2"), "practice");
assert.equal(layoutMgr.resolveSession("Race"), "race");

// Auto-switch profile test
const activeId = layoutMgr.matchAndActivate("GT3 Challenge", "Qualifying", "ferrari296gt3");
assert.equal(activeId, "gt3_qualy", "Debe activar el perfil gt3_qualy automáticamente");

// On-track auto-hide test: Top edit bar must hide on track, appear on pit road
assert.equal(layoutMgr.computeEditBarVisibility(false), false, "En pista (onPitRoad=false) debe ocultar la barra de edición");
assert.equal(layoutMgr.computeEditBarVisibility(true), true, "En boxes (onPitRoad=true) debe mostrar la barra de edición");

// Streamer Mode toggle
const initialStreamer = layoutMgr.isStreamerMode();
layoutMgr.toggleStreamerMode();
assert.equal(layoutMgr.isStreamerMode(), !initialStreamer, "Debe alternar el modo Streamer");
layoutMgr.toggleStreamerMode(); // Restore
console.log("   ✅ Smart Layouts: Resolución de categorías/sesiones y auto-ocultación en pista verificadas.");

// --- TEST 3: GPU Pedals & Steering (60 FPS Accelerators) ---
console.log("➡️  Prueba 3: GPU Pedals & Steering Engine...");
const pedals = new GpuPedalsEngine();

const pState1 = pedals.computePedalState({
  throttle: 0.85,
  brake: 0.95,
  clutch: 0.0,
  steering: 0.523599, // ~30 degrees
  speedKmh: 180,
  ffbPct: 0.98,
}, 1000);

assert.equal(pState1.throttlePct, 85);
assert.equal(pState1.brakePct, 95);
assert.equal(pState1.brakePeakPct, 95);
assert.equal(Math.round(pState1.steerDeg), 30);
assert.equal(pState1.absActive, true, "Freno > 82% a 180 km/h debe activar indicador ABS");
assert.equal(pState1.isFfbClipping, true, "Alta torsión de volante y velocidad debe alertar clipping de FFB");

// Trail braking decay test after peak hold
const pState2 = pedals.computePedalState({
  throttle: 0.1,
  brake: 0.3,
  clutch: 0.0,
  steering: 0.2,
  speedKmh: 120,
}, 3000); // 2000ms later (> peakHoldMs)

assert.equal(pState2.brakePct, 30);
assert.ok(pState2.brakePeakPct < 95 && pState2.brakePeakPct >= 30, "El pico de trail braking debe decaer exponencialmente");
console.log("   ✅ GPU Pedals: Normalización, pico con decaimiento, volante angular y alertas ABS/FFB verificadas.");

// --- TEST 4: 360° Proximity Radar & Spotter ---
console.log("➡️  Prueba 4: 360° Radar & Spotter Engine...");
const radar = new Radar360Engine();

const spotClear = radar.evaluateSpotter(0);
assert.equal(spotClear.status, "clear");
assert.equal(spotClear.label, "PISTA DESPEJADA");

const spotLeft = radar.evaluateSpotter(1);
assert.equal(spotLeft.status, "car_left");
assert.equal(spotLeft.label, "COCHE A LA IZQUIERDA");

const spotRight = radar.evaluateSpotter(2);
assert.equal(spotRight.status, "car_right");
assert.equal(spotRight.label, "COCHE A LA DERECHA");

const spot3Wide = radar.evaluateSpotter(3);
assert.equal(spot3Wide.status, "three_wide");
assert.equal(spot3Wide.label, "¡TRES EN PARALELO!");
console.log("   ✅ Radar 360°: Evaluación de CarLeftRight (despejado, izq, dcha, 3-wide) exacta.");

// --- TEST 5: Pitbox Helper & Speed Limiter ---
console.log("➡️  Prueba 5: Pitbox Helper & Speed Limiter...");
const pitbox = new PitboxHelperEngine();

// Safe in pit lane
const pitSafe = pitbox.evaluatePitState({
  onPitRoad: true,
  speedKmh: 58.5,
  pitSpeedLimitKmh: 60.0,
  distanceToStallMeters: 45,
}, 10000);

assert.equal(pitSafe.isSpeeding, false, "58.5 km/h bajo límite de 60 km/h no debe dar exceso");
assert.equal(pitSafe.speedDelta, -1.5);
assert.equal(pitSafe.shouldBrakeNow, false);

// Speeding in pit lane
const pitSpeeding = pitbox.evaluatePitState({
  onPitRoad: true,
  speedKmh: 61.2,
  pitSpeedLimitKmh: 60.0,
  distanceToStallMeters: 12,
}, 12000);

assert.equal(pitSpeeding.isSpeeding, true, "61.2 km/h sobre límite de 60 km/h debe activar advertencia de exceso");
assert.equal(pitSpeeding.shouldBrakeNow, true, "A 12 metros del cajón debe activar orden de frenada");
console.log("   ✅ Pitbox Helper: Delta de velocidad, detección de exceso y aproximación al cajón verificadas.");

// --- TEST 6: DigiFlag Session Flags Decoder (Bitmask & Priority) ---
console.log("➡️  Prueba 6: DigiFlag Engine (Bitmask & Prioridad)...");
const digiFlag = new DigiFlagEngine();

// Test green flag
const greenFlags = digiFlag.decodeFlags(0x00000004); // Green
assert.equal(greenFlags.length, 1);
assert.equal(greenFlags[0].type, "green");

// Test multiple flags simultaneously (Meatball + Yellow Local + White)
// Meatball (0x00040000) + Yellow (0x00000008) + White (0x00000002)
const multiFlags = digiFlag.decodeFlags(0x00040000 | 0x00000008 | 0x00000002);
assert.equal(multiFlags.length, 3);
assert.equal(multiFlags[0].type, "meatball", "Meatball debe tener la prioridad más alta");
assert.equal(multiFlags[1].type, "yellow_local", "Bandera amarilla local debe ser segunda prioridad");
assert.equal(multiFlags[2].type, "white", "Bandera blanca debe ser tercera prioridad");

// Test Disqualification
const dqFlags = digiFlag.decodeFlags(0x00010000);
assert.equal(dqFlags[0].type, "disqualify", "Descalificación debe tener máxima prioridad");
console.log("   ✅ DigiFlag: Decodificación bitwise multivariable y priorización de banderas de seguridad exactas.");

console.log("\n🎉 ¡TODAS LAS PRUEBAS DEL BLOQUE 2 PASARON AL 100%! Overlays Kapps 2027 listos para producción.");
