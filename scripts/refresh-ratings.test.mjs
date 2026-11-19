import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  appendSnapshots,
  assertHistory,
  madridStamp,
  normalizeLicense,
  snapshotsFromMembers,
} from "./refresh-ratings.mjs";

const historyFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/rating-history.json");

test("Madrid stamp follows CET and CEST", () => {
  const winter = madridStamp(new Date("2026-01-15T06:15:00Z"));
  assert.equal(winter.date, "2026-01-15");
  assert.equal(winter.hour, 7);
  assert.equal(winter.label, "15 Jan 2026");

  const winterEarly = madridStamp(new Date("2026-01-15T05:15:00Z"));
  assert.equal(winterEarly.hour, 6);
  assert.equal(winterEarly.date, "2026-01-15");

  const summer = madridStamp(new Date("2026-07-15T05:15:00Z"));
  assert.equal(summer.date, "2026-07-15");
  assert.equal(summer.hour, 7);
  assert.equal(summer.label, "15 Jul 2026");
});

test("licence normalisation keeps only measured iRating and SR", () => {
  assert.equal(normalizeLicense({ category: "road", irating: 3000, safety_rating: 3 }), null);
  assert.equal(normalizeLicense({ category: "sports_car", irating: 0, safety_rating: 2.5 }), null);
  assert.equal(normalizeLicense({ category: "sports_car", irating: null, safety_rating: 2.5 }), null);
  assert.equal(normalizeLicense({ category: "sports_car", irating: 3141 }), null);
  assert.deepEqual(
    normalizeLicense({ category: "formula_car", irating: 2542.4, safety_rating: 2.37, group_name: "Class C" }),
    { category: "formula", irating: 2542, sr: 2.37, classLabel: "Class C" },
  );
  assert.equal(normalizeLicense({ category: "sports_car", irating: 3141, safety_rating: 313 }).sr, 3.13);
});

test("snapshots ignore categories without a real iRating", () => {
  const { updates, skipped } = snapshotsFromMembers(
    [{
      cust_id: 993381,
      licenses: [
        { category: "sports_car", irating: 3141, safety_rating: 3.13, group_name: "Class A" },
        { category: "dirt_road", irating: 0, safety_rating: 2.45, group_name: "Rookie" },
        { category: "road", irating: 1800, safety_rating: 3 },
      ],
    }],
    [{ slug: "albertot", custId: "993381" }, { slug: "mateob", custId: "1134615" }],
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0].category, "sports_car");
  assert.equal(updates[0].irating, 3141);
  assert.ok(skipped.some((item) => item.slug === "mateob" && item.reason === "missing_member"));
  assert.ok(skipped.some((item) => item.category === "dirt_road"));
  assert.ok(skipped.some((item) => item.category === "road"));
});

test("append adds the Madrid day and does not fill the gap or invent a series", () => {
  const history = {
    albertot: {
      sports_car: [
        { date: "2026-11-06", label: "6 Nov 2026", irating: 3141, sr: 3.13 },
      ],
    },
  };
  const stamp = { date: "2026-11-19", label: "19 Nov 2026", hour: 7 };
  const first = appendSnapshots(history, [
    { slug: "albertot", category: "sports_car", irating: 3120, sr: 3.2, classLabel: "Class A" },
    { slug: "albertot", category: "dirt_road", irating: 0, sr: 2.5 },
    { slug: "nobody", category: "sports_car", irating: 2000, sr: 3 },
  ], stamp);
  assert.equal(first.changed, true);
  assert.equal(first.added, 1);
  assert.deepEqual(first.history.albertot.sports_car.map((point) => point.date), ["2026-11-06", "2026-11-19"]);
  assert.equal(first.history.albertot.sports_car[0].irating, 3141);
  assert.equal(first.history.albertot.sports_car[1].source, "iracing");
  assert.equal(first.history.albertot.dirt_road, undefined);
  assert.equal(first.history.nobody, undefined);
  assert.deepEqual(history.albertot.sports_car, [
    { date: "2026-11-06", label: "6 Nov 2026", irating: 3141, sr: 3.13 },
  ]);

  const same = appendSnapshots(first.history, [
    { slug: "albertot", category: "sports_car", irating: 3120, sr: 3.2, classLabel: "Class A" },
  ], stamp);
  assert.equal(same.changed, false);
  assert.equal(same.history.albertot.sports_car.length, 2);

  const later = appendSnapshots(first.history, [
    { slug: "albertot", category: "sports_car", irating: 3100, sr: 3.11, classLabel: "Class A" },
  ], stamp);
  assert.equal(later.changed, true);
  assert.equal(later.history.albertot.sports_car.length, 2);
  assert.equal(later.history.albertot.sports_car[1].irating, 3100);

  const empty = appendSnapshots(history, [], stamp);
  assert.equal(empty.changed, false);
  assert.deepEqual(empty.history, history);
});

test("a failed shape is rejected and the published file round-trips", () => {
  const raw = fs.readFileSync(historyFile, "utf8");
  const history = JSON.parse(raw);
  assertHistory(history);
  assert.equal(`${JSON.stringify(history, null, 2)}\n`, raw);
  assert.throws(() => assertHistory({
    albertot: { sports_car: [{ date: "2026-11-19", label: "x", irating: 0, sr: 2.5 }] },
  }));
});
