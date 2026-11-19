import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { selectableCategories } from "../src/lib/rating-series.ts";

const history = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/rating-history.json"), "utf8"));

const licences = {
  albertot: [
    { category: "sports_car", irating: 3141 },
    { category: "formula", irating: 2542 },
    { category: "oval", irating: 1575 },
    { category: "dirt_oval", irating: null },
    { category: "dirt_road", irating: null },
  ],
  mateob: [
    { category: "sports_car", irating: 2448 },
    { category: "formula", irating: 1426 },
    { category: "oval", irating: null },
    { category: "dirt_oval", irating: null },
    { category: "dirt_road", irating: null },
  ],
  eduardoc: [
    { category: "sports_car", irating: 1843 },
    { category: "formula", irating: null },
    { category: "oval", irating: null },
    { category: "dirt_oval", irating: null },
    { category: "dirt_road", irating: null },
  ],
};

test("category controls follow real licence iRatings", () => {
  assert.deepEqual(selectableCategories(history.albertot, licences.albertot), ["sports_car", "formula", "oval"]);
  assert.deepEqual(selectableCategories(history.mateob, licences.mateob), ["sports_car", "formula"]);
  assert.deepEqual(selectableCategories(history.eduardoc, licences.eduardoc), ["sports_car"]);
});

test("a fetched point opens a category the static licence still marks as empty", () => {
  const history = {
    dirt_road: [{ date: "2026-11-19", label: "19 Nov 2026", irating: 1480, sr: 2.6, source: "iracing" as const }],
  };
  assert.deepEqual(
    selectableCategories(history, [{ category: "dirt_road", irating: null }]),
    ["dirt_road"],
  );
});
