/**
 * Daily iRating / Safety Rating snapshot.
 *
 * Reads the roster in src/data/pilotos.json, asks the iRacing Data API for each
 * member licence, and appends one point for the current Europe/Madrid date.
 * A category is written only when both iRating (> 0) and Safety Rating are
 * present. Nothing is interpolated. If auth or the fetch fails, the history
 * file is left untouched and the process exits 1.
 *
 * Secrets (GitHub Actions → this repo → Settings → Secrets and variables → Actions):
 *   IRACING_CLIENT_ID
 *   IRACING_CLIENT_SECRET
 *   IRACING_USERNAME          (MMT_CANBUS_TX is accepted as an alias)
 *   IRACING_PASSWORD          (MMT_CANBUS_RX is accepted as an alias)
 *
 * The same four names are the Cloudflare Worker secrets in muntrume-worker-private.
 * Manual runs (`workflow_dispatch` or `--force`) ignore the 07:00 Madrid gate.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY_FILE = path.join(ROOT, "src/data/rating-history.json");
const ROSTER_FILE = path.join(ROOT, "src/data/pilotos.json");
const UA = "muntrume-ratings-refresh";

const CATEGORY_MAP = {
  oval: "oval",
  sports_car: "sports_car",
  formula_car: "formula",
  formula: "formula",
  dirt_oval: "dirt_oval",
  dirt_road: "dirt_road",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function sha256b64(value) {
  return createHash("sha256").update(value, "utf8").digest("base64");
}

export function madridStamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = Number(pick("hour"));
  return {
    date: `${year}-${month}-${day}`,
    hour: Number.isFinite(hour) ? hour : 0,
    label: `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`,
  };
}

export function readCredentials(env = process.env) {
  const id = String(env.IRACING_CLIENT_ID || "").trim();
  const secret = String(env.IRACING_CLIENT_SECRET || "");
  const user = String(env.IRACING_USERNAME || env.MMT_CANBUS_TX || "").trim();
  const pass = String(env.IRACING_PASSWORD ?? env.MMT_CANBUS_RX ?? "");
  const missing = [];
  if (!id) missing.push("IRACING_CLIENT_ID");
  if (!secret) missing.push("IRACING_CLIENT_SECRET");
  if (!user) missing.push("IRACING_USERNAME");
  if (!pass) missing.push("IRACING_PASSWORD");
  return { id, secret, user, pass, missing };
}

export function normalizeLicense(lic) {
  if (!lic || typeof lic !== "object") return null;
  const category = CATEGORY_MAP[String(lic.category || "")];
  if (!category) return null;
  const rawIr = Number(lic.irating);
  if (!Number.isFinite(rawIr) || rawIr <= 0) return null;
  const irating = Math.round(rawIr);
  if (irating < 1 || irating > 20000) return null;
  let sr = Number(lic.safety_rating ?? lic.sr);
  if (!Number.isFinite(sr)) return null;
  if (sr > 4.99 && sr <= 499) sr = sr / 100;
  sr = Math.round(sr * 100) / 100;
  if (sr < 0.01 || sr > 4.99) return null;
  let classLabel = typeof lic.group_name === "string" ? lic.group_name.trim().replace(/\s+/g, " ") : "";
  if (/^class\s+[a-d]$/i.test(classLabel)) classLabel = classLabel.replace(/^class/i, "Class");
  if (/^rookie$/i.test(classLabel)) classLabel = "Rookie";
  if (!/^(Class [A-D]|Rookie)$/.test(classLabel)) classLabel = "";
  return { category, irating, sr, ...(classLabel ? { classLabel } : {}) };
}

export function snapshotsFromMembers(members, roster) {
  const byId = new Map();
  for (const member of members || []) {
    if (member && member.cust_id != null) byId.set(String(member.cust_id), member);
  }
  const updates = [];
  const skipped = [];
  for (const driver of roster) {
    const member = byId.get(String(driver.custId));
    if (!member) {
      skipped.push({ slug: driver.slug, reason: "missing_member" });
      continue;
    }
    const licenses = Array.isArray(member.licenses) ? member.licenses : [];
    if (!licenses.length) {
      skipped.push({ slug: driver.slug, reason: "no_licenses" });
      continue;
    }
    for (const lic of licenses) {
      const point = normalizeLicense(lic);
      if (!point) {
        skipped.push({ slug: driver.slug, category: lic && lic.category, reason: "not_real" });
        continue;
      }
      updates.push({ slug: driver.slug, ...point });
    }
  }
  return { updates, skipped };
}

export function appendSnapshots(history, updates, stamp) {
  const next = structuredClone(history);
  let changed = false;
  let added = 0;
  for (const update of updates) {
    const point = normalizeLicense({
      category: update.category,
      irating: update.irating,
      safety_rating: update.sr,
      group_name: update.classLabel,
    });
    if (!point) continue;
    const driver = next[update.slug];
    if (!driver || typeof driver !== "object" || Array.isArray(driver)) continue;
    if (!Array.isArray(driver[point.category])) driver[point.category] = [];
    const series = driver[point.category];
    const entry = {
      date: stamp.date,
      label: stamp.label,
      irating: point.irating,
      sr: point.sr,
      source: "iracing",
      ...(point.classLabel ? { classLabel: point.classLabel } : {}),
    };
    const last = series[series.length - 1];
    if (last && last.date > stamp.date) continue;
    if (last && last.date === stamp.date) {
      const same = last.irating === entry.irating
        && Number(last.sr) === entry.sr
        && (last.classLabel || "") === (entry.classLabel || "")
        && last.label === entry.label
        && last.source === "iracing";
      if (same) continue;
      series[series.length - 1] = entry;
      changed = true;
      added += 1;
      continue;
    }
    series.push(entry);
    changed = true;
    added += 1;
  }
  return { history: next, changed, added };
}

export function assertHistory(history) {
  if (!history || typeof history !== "object" || Array.isArray(history)) throw new Error("history_shape");
  for (const [slug, cats] of Object.entries(history)) {
    if (!cats || typeof cats !== "object" || Array.isArray(cats)) throw new Error(`bad slug ${slug}`);
    for (const [cat, series] of Object.entries(cats)) {
      if (!Array.isArray(series)) throw new Error(`bad series ${slug}.${cat}`);
      let prev = "";
      const seen = new Set();
      for (const point of series) {
        if (!point || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)) throw new Error(`bad date ${slug}.${cat}`);
        if (seen.has(point.date)) throw new Error(`duplicate ${slug}.${cat} ${point.date}`);
        if (prev && point.date < prev) throw new Error(`unsorted ${slug}.${cat}`);
        if (!Number.isInteger(point.irating) || point.irating < 1 || point.irating > 20000) {
          throw new Error(`bad irating ${slug}.${cat}`);
        }
        if (typeof point.sr !== "number" || point.sr < 0.01 || point.sr > 4.99) throw new Error(`bad sr ${slug}.${cat}`);
        seen.add(point.date);
        prev = point.date;
      }
    }
  }
}

export function loadRoster(file = ROSTER_FILE) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return (data.drivers || [])
    .filter((driver) => driver && driver.slug && /^\d{1,10}$/.test(String(driver.custId)))
    .map((driver) => ({ slug: driver.slug, custId: String(driver.custId) }));
}

async function irData(apiPath, token, retried = false) {
  const response = await fetch(`https://members-ng.iracing.com/data${apiPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": UA,
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!retried && (response.status === 429 || response.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return irData(apiPath, token, true);
  }
  if (!response.ok) throw new Error(`data ${response.status}`);
  const payload = await response.json();
  if (payload && typeof payload.link === "string") {
    const linked = await fetch(payload.link, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
    });
    if (!linked.ok) throw new Error(`s3 ${linked.status}`);
    return linked.json();
  }
  return payload;
}

async function iracingToken(creds) {
  const form = new URLSearchParams({
    grant_type: "password_limited",
    client_id: creds.id,
    client_secret: sha256b64(creds.secret + creds.id.toLowerCase()),
    username: creds.user,
    password: sha256b64(creds.pass + creds.user.toLowerCase()),
    scope: "iracing.auth",
  });
  const response = await fetch("https://oauth.iracing.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: form,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`oauth ${response.status}`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error("oauth sin token");
  return payload.access_token;
}

function memberList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.members)) return payload.members;
  return [];
}

function setChanged(changed) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `changed=${changed ? "true" : "false"}\n`);
}

export async function refreshRatings({ env = process.env, now = new Date(), force = false, historyFile = HISTORY_FILE } = {}) {
  const stamp = madridStamp(now);
  if (!force && stamp.hour < 7) {
    console.log(`Europe/Madrid ${stamp.date} ${String(stamp.hour).padStart(2, "0")}:xx is before 07:00. History file was not modified.`);
    return { changed: false, skipped: "before_madrid_morning" };
  }
  const creds = readCredentials(env);
  if (creds.missing.length) {
    throw new Error(`Missing ${creds.missing.join(", ")}. History file was not modified.`);
  }
  const beforeText = fs.readFileSync(historyFile, "utf8");
  const history = JSON.parse(beforeText);
  const roster = loadRoster();
  const token = await iracingToken(creds);
  const payload = await irData(`/member/get?cust_ids=${roster.map((driver) => driver.custId).join(",")}&include_licenses=true`, token);
  const members = memberList(payload);
  if (!members.length) throw new Error("member/get returned no members. History file was not modified.");
  const { updates, skipped } = snapshotsFromMembers(members, roster);
  if (!updates.length) {
    const reasons = skipped.map((item) => `${item.slug}${item.category ? ":" + item.category : ""}:${item.reason}`).join(", ");
    throw new Error(`No real licence values. History file was not modified. ${reasons}`);
  }
  const result = appendSnapshots(history, updates, stamp);
  if (!result.changed) {
    console.log(`Europe/Madrid ${stamp.date}: real values already stored. History file was not modified.`);
    return { changed: false, added: 0, stamp };
  }
  assertHistory(result.history);
  const nextText = `${JSON.stringify(result.history, null, 2)}\n`;
  const tmp = `${historyFile}.tmp`;
  fs.writeFileSync(tmp, nextText);
  try {
    assertHistory(JSON.parse(fs.readFileSync(tmp, "utf8")));
    fs.renameSync(tmp, historyFile);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
  console.log(`Europe/Madrid ${stamp.date}: appended ${result.added} real rating point(s).`);
  return { changed: true, added: result.added, stamp };
}

async function main() {
  const force = process.argv.includes("--force");
  try {
    const result = await refreshRatings({ force });
    setChanged(result.changed);
  } catch (error) {
    setChanged(false);
    console.error(error instanceof Error ? error.message : "refresh failed");
    process.exitCode = 1;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
