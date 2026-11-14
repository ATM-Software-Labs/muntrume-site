/**
 * Unit Test Suite for Bloques 16 al 20:
 * Open-Source Architecture & Total Customization Suite
 * Tests:
 * 1. Theme Engine & Column Editor (Bloque 16)
 * 2. 1-Click JSON & mmt-layout:// Exporter/Importer (Bloque 16)
 * 3. Local Telemetry Bus & Plugin SDK (Bloque 17)
 * 4. Community i18n & custom_lang.json (Bloque 18)
 * 5. Open Telemetry .mmt-lap & Setup Merit Ranking (Bloque 20)
 */

import assert from "node:assert/strict";
import { ThemeEngine, THEME_PRESETS } from "../src/theme/theme-engine.ts";
import { LocalTelemetryBus } from "../src/plugins/telemetry-bus.ts";
import { PluginLoader } from "../src/plugins/plugin-loader.ts";
import { I18nManager } from "../src/i18n/i18n-manager.ts";
import { MmtLapEngine, type SetupCommunityReview } from "../src/telemetry/mmt-lap.ts";

console.log("🚀  Iniciando batería de pruebas unitarias para BLOQUES 16 al 20 (Open-Source & Customización)...");

// --- TEST 1: Theme Engine (Bloque 16) ---
console.log("➡️  Prueba 1: Theme Engine (Variables CSS & Presets)...");
const theme = ThemeEngine.getInstance();

assert.ok(THEME_PRESETS["dark-carbon"]);
assert.ok(THEME_PRESETS["minimal-transparent"]);
assert.ok(THEME_PRESETS["high-contrast"]);
assert.ok(THEME_PRESETS["retro-tv"]);

theme.setPreset("high-contrast");
assert.equal(theme.getPreset(), "high-contrast");
const vars = theme.getActiveVariables();
assert.equal(vars.bg, "#000000");
assert.equal(vars.accent, "#eab308");

theme.setCustomCss(".mmt-hud-widget { border-width: 2px; }");
assert.ok(theme.getCustomCss().includes(".mmt-hud-widget"));
console.log("   ✅ Theme Engine: Presets dinámicos y CSS personalizado verificados.");

// --- TEST 2: Column Editor & Layout Export/Import (Bloque 16) ---
console.log("➡️  Prueba 2: Editor de Columnas y Exportación en 1 Clic (mmt-layout://)...");
const initialDelta = theme.getColumnsConfig().relative.delta;
const toggled = theme.toggleColumn("relative", "delta");
assert.equal(toggled, !initialDelta);
theme.toggleColumn("relative", "delta", true); // Restore to true

// Export JSON
const jsonExport = theme.exportLayoutJson("Alberto Trujillo");
assert.ok(jsonExport.includes('"version": "1.0"'));
assert.ok(jsonExport.includes('"author": "Alberto Trujillo"'));

// Export mmt-layout://
const urlExport = theme.exportMmtLayoutUrl();
assert.ok(urlExport.startsWith("mmt-layout://"), "Debe comenzar con el protocolo mmt-layout://");

// Import back
const imported = theme.importLayout(urlExport);
assert.equal(imported, true, "Debe importar correctamente desde mmt-layout://");
console.log("   ✅ Editor de Columnas & Layouts: Importación/Exportación en 1 Clic 100% funcional.");

// --- TEST 3: Local Telemetry Bus & Plugins (Bloque 17) ---
console.log("➡️  Prueba 3: Bus de Telemetría Local & Cargador de Plugins...");
const bus = LocalTelemetryBus.getInstance();
let receivedFrame = false;

const unsubscribe = bus.subscribe((payload) => {
  if (payload.type === "mmt_telemetry_frame") {
    receivedFrame = true;
    assert.equal(payload.inputs.speedKmh, 210);
    assert.equal(payload.inputs.gear, 4);
  }
});

// Mock dispatch test
bus.publish(
  {
    camCarIdx: 5,
    playerCarIdx: 5,
    isReplayPlaying: false,
    onPitRoad: false,
    activeDriver: { carPath: "ferrari296gt3", carScreenName: "Ferrari 296", carNumber: "16" } as any,
    session: { weekendInfo: { trackName: "Spa", trackConfigName: "GP", category: "Road" }, sessionType: "Race" } as any,
    frame: { carIdxLap: [0, 0, 0, 0, 0, 12], sessionFlags: 0 } as any,
    relative: { entries: [] } as any,
    leaderboard: [],
    fuel: { fuelRemainingL: 45, avgBurnPerLap: 3.2, stintLapsRemaining: 14, fuelToAdd: 0 } as any,
  } as any,
  210,
  { throttle: 1.0, brake: 0.0, clutch: 0.0, steering: 0.05, gear: 4, rpm: 7400 }
);

assert.equal(receivedFrame, true, "El bus de telemetría debe entregar los frames a los suscriptores");
unsubscribe();

// Plugin Loader test
const pluginLoader = PluginLoader.getInstance();
const plugins = pluginLoader.getPlugins();
assert.ok(plugins.length >= 1, "Debe registrar al menos el plugin starter example-gforce-meter");
assert.equal(plugins[0].manifest.id, "example-gforce-meter");
console.log("   ✅ Telemetry Bus & Plugins: Emisión normalizada y registro de starter plugin exactos.");

// --- TEST 4: Community i18n & custom_lang.json (Bloque 18) ---
console.log("➡️  Prueba 4: Sistema de Internacionalización (i18n)...");
const i18n = I18nManager.getInstance();

i18n.setLocale("es");
assert.equal(i18n.t("spotter.clear"), "PISTA DESPEJADA");

i18n.setLocale("en");
assert.equal(i18n.t("spotter.clear"), "CLEAR TRACK");

i18n.setLocale("pt");
assert.equal(i18n.t("spotter.clear"), "PISTA LIVRE");

i18n.setLocale("de");
assert.equal(i18n.t("spotter.clear"), "STRECKE FREI");

i18n.setLocale("fr");
assert.equal(i18n.t("spotter.clear"), "PISTE DÉGAGÉE");

i18n.setLocale("it");
assert.equal(i18n.t("spotter.clear"), "PISTA LIBERA");

// Custom language load test
const customLangLoaded = i18n.loadCustomLang(JSON.stringify({
  "spotter.clear": "PISTA NETTA (DIALETTO)"
}));
assert.equal(customLangLoaded, true);
assert.equal(i18n.t("spotter.clear"), "PISTA NETTA (DIALETTO)");
i18n.setLocale("es"); // Restore
console.log("   ✅ i18n: Diccionarios comunitarios ES/EN/PT/DE/FR/IT y custom_lang.json validados.");

// --- TEST 5: Open Telemetry (.mmt-lap) & Setup Validation (Bloque 20) ---
console.log("➡️  Prueba 5: Formato Abierto .mmt-lap & Validación de Setups...");
const sampleLap = MmtLapEngine.createSampleLap();
const serialized = MmtLapEngine.serializeLap(sampleLap);

// Verify compression and lightweight size (< 150 KB)
const sizeBytes = Buffer.byteLength(serialized, "utf-8");
assert.ok(sizeBytes < 150 * 1024, `El tamaño debe ser inferior a 150 KB (actual: ${sizeBytes} bytes)`);

const parsedLap = MmtLapEngine.parseLap(serialized);
assert.equal(parsedLap.meta.formatVersion, "1.0");
assert.equal(parsedLap.meta.track.trackTempC, 28.2);
assert.equal(parsedLap.meta.track.rubberState, "heavy");
assert.equal(parsedLap.channels.speedKmh.length, 100);

// Setup merit ranking calculation
const review1: SetupCommunityReview = {
  setupId: "ferrari_vln_1",
  car: "ferrari296gt3",
  track: "nuerburgring",
  seasonBuild: "2026 S4",
  upvotes: 48,
  downvotes: 2,
  tags: ["Estable", "Resistencia"],
  comments: [],
};
const merit = MmtLapEngine.calculateSetupMerit(review1);
assert.ok(merit > 1.5, "El mérito comunitario debe ponderar positivamente los votos de pilotos");
console.log("   ✅ Formato .mmt-lap (< 150 KB) y algoritmo de mérito comunitario comprobados.");

console.log("\n🎉 ¡TODAS LAS PRUEBAS DE LOS BLOQUES 16 AL 20 PASARON AL 100%! Arquitectura lista para la comunidad.");
