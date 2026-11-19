import assert from "node:assert/strict";
import {
  hasBlockedPathSegment,
  isAllowedManifestPath,
  isAllowedRemoteWallpaper,
} from "../src/lib/wallpaper-allowlist.ts";

const official = {
  isOfficialPress: true,
  sourceType: "official_press",
};

assert.equal(
  isAllowedRemoteWallpaper("https://s100.iracing.com/wp-content/uploads/2024/06/ford-mustang-gt3-04.jpg", official),
  true,
);
assert.equal(
  isAllowedRemoteWallpaper("https://ir-core-sites.iracing.com/members/member_images/cars/carid_206/shot_ss_5_screen_full.jpg", official),
  true,
);
assert.equal(
  isAllowedRemoteWallpaper("https://s100.iracing.com/wp-content/uploads/2024/06/ford.jpg", { isOfficialPress: false, sourceType: "official_press" }),
  false,
);
assert.equal(
  isAllowedRemoteWallpaper("https://muntru.me/assets/img/hero-bg.webp", official),
  false,
);
assert.equal(hasBlockedPathSegment("https://muntru.me/assets/brand/escudo.jpg"), true);
assert.equal(hasBlockedPathSegment("https://cdn.example.com/internal/setup/photo.jpg"), true);
assert.equal(hasBlockedPathSegment("/assets/img/coche1.webp"), false);

const manifest = new Set(["/assets/img/coche1.webp", "/assets/img/race1.webp"]);
assert.equal(isAllowedManifestPath("/assets/img/coche1.webp", manifest), true);
assert.equal(isAllowedManifestPath("/assets/img/series/imsa.jpg", manifest), false);
assert.equal(isAllowedManifestPath("/assets/img/hero-bg.webp", manifest), false);
assert.equal(isAllowedManifestPath("/assets/cars/ferrari296gt3.webp", new Set(["/assets/cars/ferrari296gt3.webp"])), false);
assert.equal(isAllowedManifestPath("/assets/brand/logo.svg", new Set(["/assets/brand/logo.svg"])), false);

console.log("wallpaper allowlist ok");
