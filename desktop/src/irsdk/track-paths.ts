/**
 * Normalized 0..1000 2D track polygons for major iRacing circuits + 1-lap VelocityX/Y/Yaw auto-mapper (Prompt 152).
 */
export type TrackPoint = readonly [number, number];

const TRACK_POLYGONS: Record<string, readonly TrackPoint[]> = {
  spa: [[500,880],[360,820],[280,760],[230,680],[200,560],[190,420],[160,260],[210,130],[320,100],[460,180],[590,220],[720,160],[840,210],[870,340],[770,460],[690,560],[740,690],[660,790],[570,860],[500,880]],
  monza: [[220,760],[540,760],[780,760],[860,710],[820,620],[680,520],[740,390],[850,280],[810,160],[640,140],[430,220],[230,280],[150,390],[170,540],[140,680],[220,760]],
  fuji: [[260,720],[780,720],[870,660],[820,560],[650,510],[560,390],[680,270],[610,180],[410,220],[250,300],[170,430],[160,620],[260,720]],
  sebring: [[200,740],[620,740],[830,690],[860,550],[730,440],[790,290],[690,170],[490,210],[390,340],[240,270],[140,380],[190,550],[150,680],[200,740]],
  daytona: [[240,760],[760,760],[880,620],[840,340],[690,210],[500,200],[310,210],[160,340],[120,620],[240,760]],
  barcelona: [[220,750],[740,750],[860,670],[800,550],[640,490],[730,350],[820,240],[670,150],[470,210],[330,300],[180,410],[140,590],[220,750]],
  silverstone: [[280,770],[640,760],[830,660],[860,480],[720,380],[790,230],[650,140],[450,190],[320,310],[180,260],[140,420],[210,600],[280,770]],
  imola: [[210,740],[560,720],[820,670],[860,540],[740,430],[650,310],[740,180],[570,130],[370,230],[230,350],[150,520],[210,740]],
  suzuka: [[220,730],[520,740],[780,680],[870,530],[770,380],[620,390],[510,270],[630,150],[430,140],[290,260],[380,430],[220,540],[150,660],[220,730]],
  nurburgring: [[240,760],[630,750],[840,650],[850,480],[700,390],[790,240],[640,140],[420,190],[270,310],[160,470],[180,650],[240,760]],
  watkins: [[220,750],[620,760],[820,660],[840,470],[710,330],[780,190],[580,140],[380,220],[260,360],[160,540],[220,750]],
  atlanta: [[220,750],[660,740],[850,620],[830,430],[660,320],[750,180],[530,140],[340,240],[230,410],[160,600],[220,750]],
  lemans: [[240,790],[580,790],[830,720],[870,560],[850,360],[820,170],[620,120],[390,190],[240,320],[160,510],[180,690],[240,790]],
};

const MATCHERS: Array<[RegExp, string]> = [
  [/spa/i, "spa"],
  [/monza/i, "monza"],
  [/fuji/i, "fuji"],
  [/sebring/i, "sebring"],
  [/daytona/i, "daytona"],
  [/barcelona|catalunya/i, "barcelona"],
  [/silverstone/i, "silverstone"],
  [/imola|dino ferrari/i, "imola"],
  [/suzuka/i, "suzuka"],
  [/n[uü]rburgring|nordschleife/i, "nurburgring"],
  [/watkins/i, "watkins"],
  [/road atlanta/i, "atlanta"],
  [/le mans|sarthe/i, "lemans"],
];

interface AutoRecordState {
  trackKey: string;
  lastLap: number;
  points: Array<{ pct: number; x: number; y: number }>;
  x: number;
  y: number;
  lastTs: number;
}

let recorder: AutoRecordState | null = null;

function normalizePoints(raw: Array<[number, number]>): TrackPoint[] {
  if (raw.length < 4) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of raw) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = Math.max(1, maxX - minX, maxY - minY);
  const padX = (span - (maxX - minX)) / 2;
  const padY = (span - (maxY - minY)) / 2;
  return raw.map(([x, y]) => [
    Math.round(80 + ((x - minX + padX) / span) * 840),
    Math.round(80 + ((y - minY + padY) / span) * 840),
  ]);
}

export function observeTrackAutoMap(
  trackName: string,
  lap: number,
  pct: number,
  vx = 0,
  vy = 0,
  nowMs = performance.now(),
): void {
  const key = trackName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (!key || getPresetTrackPolygon(trackName)) return;
  if (typeof localStorage !== "undefined" && localStorage.getItem(`mmt_track_poly_${key}`)) return;

  if (!recorder || recorder.trackKey !== key) {
    recorder = { trackKey: key, lastLap: lap, points: [], x: 0, y: 0, lastTs: nowMs };
    return;
  }
  const dt = Math.min(0.25, Math.max(0.01, (nowMs - recorder.lastTs) / 1000));
  recorder.lastTs = nowMs;
  recorder.x += vx * dt;
  recorder.y += vy * dt;

  if (lap > recorder.lastLap && recorder.points.length >= 24) {
    const sorted = [...recorder.points].sort((a, b) => a.pct - b.pct);
    const poly = normalizePoints(sorted.map((p) => [p.x, p.y]));
    if (poly.length >= 12) {
      poly.push(poly[0]);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`mmt_track_poly_${key}`, JSON.stringify(poly));
      }
    }
    recorder.points = [];
  }
  recorder.lastLap = lap;
  if (pct >= 0 && pct <= 1 && (recorder.points.length === 0 || Math.abs(pct - recorder.points[recorder.points.length - 1].pct) >= 0.015)) {
    recorder.points.push({ pct, x: recorder.x, y: recorder.y });
  }
}

export function getPresetTrackPolygon(trackName: string): readonly TrackPoint[] | null {
  for (const [re, id] of MATCHERS) {
    if (re.test(trackName)) return TRACK_POLYGONS[id];
  }
  return null;
}

export function resolveTrackPolygon(trackName: string): readonly TrackPoint[] | null {
  const preset = getPresetTrackPolygon(trackName);
  if (preset) return preset;
  const key = trackName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (key && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(`mmt_track_poly_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 8) return parsed;
      }
    } catch {}
  }
  return null;
}

export function samplePolygonAtPct(poly: readonly TrackPoint[], pct: number, w: number, h: number): { x: number; y: number } {
  const clamped = ((pct % 1) + 1) % 1;
  const n = poly.length - 1;
  const f = clamped * n;
  const i = Math.floor(f) % n;
  const t = f - Math.floor(f);
  const [x0, y0] = poly[i];
  const [x1, y1] = poly[i + 1];
  const nx = x0 + (x1 - x0) * t;
  const ny = y0 + (y1 - y0) * t;
  return {
    x: (nx / 1000) * w,
    y: (ny / 1000) * h,
  };
}
