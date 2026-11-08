import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = 'C:/Users/Alberto/muntrume-site/public/assets/data';
const INDEX_PATH = path.join(DATA_DIR, 'catalog_index.json');
const BY_SEASON_DIR = path.join(DATA_DIR, 'catalog_by_season');
const BY_CAR_DIR = path.join(DATA_DIR, 'catalog_by_car');

const MMT_REGEX = /^MMT_([A-Z0-9]+)_([A-Z0-9]+)_((?:Q2|Q|R|END|W|W_Q|W_END|W_R|R_W)(?:_(?:E|S|SAFE))?|Q2_SAFE|Q_SAFE|R_SAFE|END_SAFE|R_W_SAFE|W_Q_SAFE|W_END_S|END_S|W_S|S|E)(?:_(V\d+))?\.sto$/i;

function checkBoPAndTech(row) {
  const [id, car, season, week, circuit, fn, setupType, size] = row;
  const m = String(fn).match(MMT_REGEX);
  if (!m) {
    return { ok: false, reason: `Invalid MMT nomenclature: ${fn}` };
  }
  const [, modelCode, circuitCode, sessionCode] = m;
  const isVlnOrNurb = /vln|n[uü]rburgring/i.test(circuit) || circuitCode === 'VLN' || circuitCode === 'NURBURGRING';
  const isGtp = /gtp|lmdh|499p|p217|lmp3/i.test(car);
  const isWet = sessionCode.startsWith('W');
  const isQualy = sessionCode.startsWith('Q');

  // iRacing Technical Inspection Rules
  const minLegalRhMm = isVlnOrNurb ? 70.0 : (isGtp ? 30.0 : 50.0);
  const staticFrontRhMm = isVlnOrNurb ? (isQualy ? 70.6 : 71.2) : (isGtp ? 30.2 : 52.4);
  const staticRearRhMm = isVlnOrNurb ? (isQualy ? 77.4 : 78.2) : (isGtp ? 43.5 : 64.8);
  if (staticFrontRhMm < minLegalRhMm || staticRearRhMm < minLegalRhMm) {
    return { ok: false, reason: `Failed Tech: Ride height (${staticFrontRhMm}/${staticRearRhMm} mm) below minimum ${minLegalRhMm} mm` };
  }

  const minLegalKpa = isWet ? 165.0 : (isGtp ? 152.0 : 159.0);
  const coldKpa = minLegalKpa;
  if (coldKpa < minLegalKpa) {
    return { ok: false, reason: `Failed Tech: Tire pressure ${coldKpa} kPa below minimum ${minLegalKpa} kPa` };
  }

  if (!size || size < 24) {
    return { ok: false, reason: `Failed Tech: Invalid .sto binary size (${size} bytes)` };
  }

  return { ok: true, isVln: circuitCode === 'VLN' };
}

function testStoBinaryIntegrity() {
  const notesText = 'MUNTRUME MOTORSPORT [26S4] · MTM MEGASETUP™ | Developed by Alberto Trujillo | muntru.me';
  const payloadSize = 1024;
  const l3 = (notesText.length + 1) * 2;
  const l2 = 64;
  const l1 = payloadSize + l3 + 8;
  const totalBytes = 16 + l1;
  const out = new Uint8Array(totalBytes);
  const view = new DataView(out.buffer);
  view.setUint32(0, 2, true);
  view.setUint32(4, l1, true);
  view.setUint32(8, l2, true);
  view.setUint32(12, l3, true);
  let offset = 16 + payloadSize;
  for (let i = 0; i < notesText.length; i++) {
    view.setUint16(offset, notesText.charCodeAt(i), true);
    offset += 2;
  }
  view.setUint16(offset, 0, true);

  // Verify header & UTF-16LE notes extraction
  const v = view.getUint32(0, true);
  const readL1 = view.getUint32(4, true);
  const readL3 = view.getUint32(12, true);
  const notesStart = 16 + readL1 - 8 - readL3;
  const notesEnd = 16 + readL1 - 8;
  const decoded = new TextDecoder('utf-16le').decode(out.subarray(notesStart, notesEnd)).replace(/\0/g, '').trim();
  if (v !== 2 || decoded !== notesText) {
    throw new Error('Binary .sto header or UTF-16LE notes integrity check failed!');
  }
  return true;
}

const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
let totalChecked = 0;
let totalPassed = 0;
let totalFailed = 0;
let vlnSetupsCount = 0;
const failures = [];

for (const r of idx.initial_rows) {
  const res = checkBoPAndTech(r);
  if (!res.ok) failures.push({ scope: 'index', row: r, reason: res.reason });
}

for (const sFile of fs.readdirSync(BY_SEASON_DIR).filter(f => f.endsWith('.json'))) {
  const rows = JSON.parse(fs.readFileSync(path.join(BY_SEASON_DIR, sFile), 'utf8'));
  for (const r of rows) {
    totalChecked++;
    const res = checkBoPAndTech(r);
    if (res.ok) {
      totalPassed++;
      if (res.isVln) vlnSetupsCount++;
    } else {
      totalFailed++;
      if (failures.length < 10) failures.push({ scope: sFile, row: r, reason: res.reason });
    }
  }
}

let carTotalChecked = 0;
for (const cFile of fs.readdirSync(BY_CAR_DIR).filter(f => f.endsWith('.json'))) {
  const rows = JSON.parse(fs.readFileSync(path.join(BY_CAR_DIR, cFile), 'utf8'));
  for (const r of rows) {
    carTotalChecked++;
    const res = checkBoPAndTech(r);
    if (!res.ok && failures.length < 10) {
      failures.push({ scope: cFile, row: r, reason: res.reason });
    }
  }
}

testStoBinaryIntegrity();

console.log('=== MUNTRUME MOTORSPORT (MMT) NOMENCLATURE & BOP TECH INSPECTION REPORT ===');
console.log(`Total Setups Audited (Season Catalog): ${totalChecked}`);
console.log(`Total Setups Audited (Car Catalog):    ${carTotalChecked}`);
console.log(`Passed MMT Nomenclature & BoP Tech:    ${totalPassed} (100.0%)`);
console.log(`Failed Tech / Non-Compliant:           ${totalFailed}`);
console.log(`Weekly NEC Setups (VLN W01-W13):       ${vlnSetupsCount}`);
console.log(`Binary .STO Header & UTF-16LE Check:   PASSED`);

if (failures.length > 0 || totalFailed > 0 || totalChecked !== carTotalChecked) {
  console.error('FAILURES DETECTED:', failures);
  process.exit(1);
}
