/**
 * Prompt 30.2: Test de Integridad de Galería y CarPath
 * - Verifica que admin.astro no tenga carPath duplicados en selectores
 * - Verifica que src/data/paddock-gallery.ts tenga carPath estricto y sin discordancias de marca
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateUploadFilename } from "../src/gallery/car-path-validator.ts";
import { PADDOCK_ALBUMS } from "../../src/data/paddock-gallery.ts";

console.log("🖼️  [Prompt 30.2] Validando integridad de Galería y CarPath...");

// 1. Verificar selectores en src/pages/admin.astro sin duplicados
const adminAstroPath = path.resolve(process.cwd(), "../src/pages/admin.astro");
const adminHtml = fs.readFileSync(adminAstroPath, "utf8");

for (const selectId of ["adminGalleryCarSelect", "adminUploadCarPath"]) {
  const match = adminHtml.match(new RegExp(`id="${selectId}"[\\s\\S]*?</select>`));
  assert.ok(match, `Selector #${selectId} debe existir en admin.astro`);
  const values = [...match[0].matchAll(/value="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((v) => v !== "" && v !== "all");
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const v of values) {
    if (seen.has(v)) duplicates.push(v);
    seen.add(v);
  }
  assert.deepEqual(duplicates, [], `Duplicados encontrados en #${selectId}: ${duplicates.join(", ")}`);
  console.log(`   ✅ #${selectId}: ${values.length} modelos únicos sin duplicados.`);
}

// 2. Verificar que todos los álbumes y sus fotos tengan carPath y no haya mezcla de marcas
assert.ok(PADDOCK_ALBUMS.length > 0, "PADDOCK_ALBUMS no debe estar vacío");
let totalPhotos = 0;
for (const album of PADDOCK_ALBUMS) {
  assert.ok(album.carPath && album.carPath.trim().length > 0, `Álbum '${album.slug}' sin carPath`);
  for (const photo of album.photos) {
    totalPhotos++;
    assert.ok(photo.carPath && photo.carPath.trim().length > 0, `Foto '${photo.id}' sin carPath`);
    if (photo.carPath === "multiclass" || photo.carPath === "team_engineering") continue;

    const checkSrc = validateUploadFilename(path.basename(photo.img), photo.carPath);
    assert.equal(
      checkSrc.isValid,
      true,
      `Discordancia de marca en foto '${photo.id}' (img=${photo.img}, carPath=${photo.carPath}): ${checkSrc.warning}`
    );
  }
}
assert.ok(totalPhotos > 0, "Debe haber fotos en PADDOCK_ALBUMS");
console.log(`   ✅ PADDOCK_ALBUMS: ${PADDOCK_ALBUMS.length} álbumes y ${totalPhotos} fotos validadas con CarPath estricto.`);

console.log("✅ [Prompt 30.2] Integridad de Galería y CarPath al 100%.");
