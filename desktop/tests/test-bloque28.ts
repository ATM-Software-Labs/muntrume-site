import assert from "node:assert/strict";
import {
  resolveCarPathFromTelemetry,
  classifyCaptureScreenshot,
  validateUploadFilename,
  filterPhotosByStrictCarPath,
  type TelemetryState,
} from "../src/gallery/car-path-validator";

console.log("🧪 Iniciando Test Suite Bloque 28: Validador de Galería por CarPath iRacing...");

// 1. Test CarPath Resolution from CamCarIdx
{
  const telemetry: TelemetryState = {
    CamCarIdx: 2,
    PlayerCarIdx: 0,
    DriverInfo: {
      Drivers: [
        { CarIdx: 0, CarPath: "porsche992rgt3", CarScreenName: "Porsche 911 GT3 R" },
        { CarIdx: 1, CarPath: "bmwm4gt3", CarScreenName: "BMW M4 GT3" },
        { CarIdx: 2, CarPath: "ferrari296gt3", CarScreenName: "Ferrari 296 GT3" },
      ],
    },
  };

  const resolved = resolveCarPathFromTelemetry(telemetry);
  assert.equal(resolved, "ferrari296gt3", "Debe resolver CamCarIdx (índice 2) como Ferrari 296 GT3");
  console.log("  ✔ CarPath resuelto correctamente desde CamCarIdx (ferrari296gt3)");
}

// 2. Test Screenshot Auto-classification
{
  const telemetry: TelemetryState = {
    CamCarIdx: 1,
    DriverInfo: {
      Drivers: [
        { CarIdx: 0, CarPath: "ferrari296gt3", CarScreenName: "Ferrari 296 GT3" },
        { CarIdx: 1, CarPath: "porsche9922cup", CarScreenName: "Porsche 911 GT3 Cup (992.2)" },
      ],
    },
  };

  const capture = classifyCaptureScreenshot({ telemetry, timestamp: 1731600000000 });
  assert.equal(capture.carPath, "porsche9922cup");
  assert.equal(capture.filename, "mmt_capture_porsche9922cup_1731600000000.png");
  assert.equal(capture.metadata.verified, true);
  console.log("  ✔ Captura autoclasificada de fábrica con CarPath exacto de iRacing (porsche9922cup)");
}

// 3. Test Upload Validation with Brand Mismatch Detection
{
  // Mismatch: uploading Ferrari file into Porsche category
  const res1 = validateUploadFilename("ferrari_296_spa_race.jpg", "porsche992rgt3");
  assert.equal(res1.isValid, false, "Debe detectar discordancia entre Ferrari y Porsche");
  assert.equal(res1.detectedBrand, "FERRARI");
  assert.equal(res1.targetBrand, "PORSCHE");
  assert.ok(res1.warning?.includes("Aviso de Discordancia"));
  console.log("  ✔ Detector de discordancia bloqueó subida de Ferrari hacia carpeta Porsche");

  // Valid: uploading Porsche photo into Porsche category
  const res2 = validateUploadFilename("porsche_992_nurburgring.png", "porsche992rgt3");
  assert.equal(res2.isValid, true, "Debe permitir subida coincidente");
  console.log("  ✔ Validación exitosa para archivo coincidente (Porsche -> Porsche)");

  // Missing target car
  const res3 = validateUploadFilename("stint_lap.png", "");
  assert.equal(res3.isValid, false, "Debe rechazar subidas sin coche de destino obligatorio");
  console.log("  ✔ Rechazo obligatorio de subidas sin selección de coche de destino");
}

// 4. Test Strict Database / Catalog Filtering
{
  const mockPhotos = [
    { id: "1", carPath: "porsche992rgt3", title: "Porsche Turn 1" },
    { id: "2", carPath: "ferrari296gt3", title: "Ferrari Mistake in Porsche" },
    { id: "3", carPath: "", title: "Unassociated Orphan Photo" },
    { id: "4", carPath: "porsche992rgt3", title: "Porsche Sunset" },
  ];

  const porscheFiltered = filterPhotosByStrictCarPath(mockPhotos, "porsche992rgt3");
  assert.equal(porscheFiltered.length, 2, "Solo deben pasar fotos con carPath estrictamente Porsche");
  assert.deepEqual(porscheFiltered.map((p) => p.id), ["1", "4"]);
  console.log("  ✔ Filtrado estricto eliminó fotos huérfanas y fotos con carPath de otra marca");
}

console.log("🏁 Test Suite Bloque 28 superada al 100%!");
