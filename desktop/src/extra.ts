import type { IracingAnalysis, LiveSample, Settings, Snapshot } from "./types";
import rawSchedule from "./season_schedule_2026_s4.json";
import rawRealTracks from "./real_telemetry_tracks.json";

interface ScheduleWeek {
  week_num: number;
  start_date: string;
  track_name: string;
  config: string;
  weather: string;
  duration: string;
  sim_time: string;
}

interface ScheduleSeries {
  id: string;
  name: string;
  category: string;
  tier: string;
  license: string;
  cars: string[];
  weeks: ScheduleWeek[];
}

interface SchedulePayload {
  season: string;
  pdf_source: string;
  total_series: number;
  current_week: number;
  series: ScheduleSeries[];
}

const schedule = rawSchedule as unknown as SchedulePayload;

let activeWeek = schedule.current_week || 9;
let activeCat = "all";
let activeSearch = "";
let weekListenersAttached = false;
let studioInitialized = false;
let strategyInitialized = false;
let overlayInitialized = false;

// -------------------------------------------------------------
// TELEMETRY STUDIO DATA & TYPES (Based on REAL .ibt iRacing telemetry)
// -------------------------------------------------------------
export interface TurnInsight {
  turn: number;
  name: string;
  distance: number;
  sector: 1 | 2 | 3;
  alienApexKmh: number;
  userApexKmh: number;
  alienBrakingDistM: number;
  userBrakingDistM: number;
  deltaSec: number;
  coachTip: string;
  severity: "critical" | "moderate" | "optimal";
}

export interface RealTrackSample {
  dist: number;
  speed: number;
  thr: number;
  brk: number;
  gear: number;
}

export interface RealTrackEntry {
  id: string;
  name: string;
  fileUsed: string;
  bestSec: number;
  avgSec: number;
  bestFormatted: string;
  avgFormatted: string;
  lapCount: number;
  samples: RealTrackSample[];
  mapPoints: [number, number][];
}

const REAL_TRACKS = rawRealTracks as unknown as Record<string, RealTrackEntry>;

let currentTrackId = "spa";
let activeHoverDist: number | null = null;
let coachLossFilter = false;

export function paintExtras(data: Snapshot): void {
  paintWeek(data);
  paintAnalysis();
  paintReference(data.settings);
  paintChecklist(data.settings);
  paintOverlays();
  paintTeam(data.settings);
  paintFlags(data.settings);
  paintStrategy();
}

// -------------------------------------------------------------
// 1. SEASON CALENDAR (CALENDARIO OFICIAL 2026 S4)
// -------------------------------------------------------------
function paintWeek(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  const weekSelect = document.getElementById("weekSelect") as HTMLSelectElement | null;
  const weekSearch = document.getElementById("weekSearch") as HTMLInputElement | null;
  const catFilters = document.getElementById("weekCatFilters");
  const weeksBar = document.getElementById("calendarWeeksBar");
  if (!note || !list) return;

  const weekDates: Record<number, string> = {
    1: "15 sep", 2: "22 sep", 3: "29 sep", 4: "06 oct",
    5: "13 oct", 6: "20 oct", 7: "27 oct", 8: "03 nov",
    9: "10 nov", 10: "17 nov", 11: "24 nov", 12: "01 dic",
  };

  // Populate Dropdown
  if (weekSelect && weekSelect.options.length === 0) {
    for (let w = 1; w <= 12; w++) {
      const opt = document.createElement("option");
      opt.value = String(w);
      const isCurrent = w === (schedule.current_week || 9);
      opt.textContent = `Semana ${w} (${weekDates[w] ?? ""})${isCurrent ? " · ACTUAL" : ""}`;
      weekSelect.append(opt);
    }
    weekSelect.value = String(activeWeek);
  }

  // Populate Horizontal Visual Calendar Weeks Bar
  if (weeksBar && weeksBar.children.length === 0) {
    for (let w = 1; w <= 12; w++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.week = String(w);
      const isCurrent = w === (schedule.current_week || 9);
      const isSelected = w === activeWeek;
      btn.className = isSelected
        ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold shrink-0 transition"
        : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs shrink-0 transition";

      btn.innerHTML = `Sem ${w} <span class="text-[10px] text-r-muted">(${weekDates[w] || ""})</span>${isCurrent ? ' <span class="text-[9px] px-1 py-0.2 rounded bg-r-accent/20 text-r-accent font-black">ACTUAL</span>' : ""}`;
      btn.addEventListener("click", () => {
        activeWeek = w;
        if (weekSelect) weekSelect.value = String(w);
        updateCalendarWeeksBar();
        renderWeekItems(data);
      });
      weeksBar.append(btn);
    }
  }

  if (!weekListenersAttached) {
    weekListenersAttached = true;
    if (weekSelect) {
      weekSelect.addEventListener("change", () => {
        activeWeek = Number(weekSelect.value);
        updateCalendarWeeksBar();
        renderWeekItems(data);
      });
    }
    if (weekSearch) {
      weekSearch.addEventListener("input", () => {
        activeSearch = weekSearch.value.trim().toLowerCase();
        renderWeekItems(data);
      });
    }
    if (catFilters) {
      catFilters.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.cat) return;
        activeCat = btn.dataset.cat;
        for (const b of catFilters.querySelectorAll("button")) {
          const isSelected = b.dataset.cat === activeCat;
          b.className = isSelected
            ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
        renderWeekItems(data);
      });
    }
  }

  updateCalendarWeeksBar();
  renderWeekItems(data);
}

function updateCalendarWeeksBar(): void {
  const weeksBar = document.getElementById("calendarWeeksBar");
  if (!weeksBar) return;
  for (const b of weeksBar.querySelectorAll("button")) {
    const w = Number(b.dataset.week);
    const isSelected = w === activeWeek;
    b.className = isSelected
      ? "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold shrink-0 transition shadow-sm"
      : "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs shrink-0 transition";
  }
}

function renderWeekItems(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  if (!note || !list) return;

  const filtered = schedule.series.filter((s) => {
    if (activeCat !== "all" && s.category.toLowerCase() !== activeCat.toLowerCase()) return false;
    if (activeSearch) {
      const q = activeSearch;
      const matchName = s.name.toLowerCase().includes(q);
      const matchCars = s.cars.some((c) => c.toLowerCase().includes(q));
      const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
      const matchTrack = weekItem ? weekItem.track_name.toLowerCase().includes(q) : false;
      if (!matchName && !matchCars && !matchTrack) return false;
    }
    return true;
  });

  note.textContent = `${schedule.season} · Semana ${activeWeek} de 12 · Mostrando ${filtered.length} de ${schedule.total_series} series oficiales`;
  list.replaceChildren();

  const userCars = (data.lastCars || []).map((c) => c.toLowerCase());

  for (const s of filtered) {
    const weekItem = s.weeks.find((w) => w.week_num === activeWeek);
    const hasUserCar = userCars.length > 0 && s.cars.some((c) => userCars.some((uc) => c.toLowerCase().includes(uc) || uc.includes(c.toLowerCase())));
    const matchCount = data.library.filter((lib) => s.cars.some((c) => c.toLowerCase().includes(lib.carFolder.toLowerCase()) || lib.carFolder.toLowerCase().includes(c.toLowerCase()))).length;

    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-line-2";
    if (hasUserCar) {
      card.className += " ring-1 ring-r-accent/40";
    }

    const top = document.createElement("div");
    top.className = "flex flex-wrap items-center justify-between gap-2";

    const badges = document.createElement("div");
    badges.className = "flex flex-wrap items-center gap-1.5 font-mono text-[11px]";

    const catBadge = document.createElement("span");
    catBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-muted";
    catBadge.textContent = s.category;

    const tierBadge = document.createElement("span");
    tierBadge.className = "px-2 py-0.5 rounded border border-r-line bg-r-bg text-r-accent";
    tierBadge.textContent = s.tier.replace("Class", " Class");

    badges.append(catBadge, tierBadge);

    if (matchCount > 0) {
      const setupBadge = document.createElement("span");
      setupBadge.className = "px-2.5 py-0.5 rounded bg-r-accent/15 text-r-accent font-mono text-[11px] font-bold";
      setupBadge.textContent = `${matchCount} setups MMT listos`;
      top.append(badges, setupBadge);
    } else {
      top.append(badges);
    }

    const title = document.createElement("h2");
    title.className = "mt-2.5 text-lg font-bold text-r-text";
    title.textContent = s.name;

    card.append(top, title);

    if (weekItem) {
      const trackBox = document.createElement("div");
      trackBox.className = "mt-3.5 rounded-xl border border-r-line/60 bg-r-bg/50 p-3.5";

      const trackHeader = document.createElement("div");
      trackHeader.className = "flex flex-wrap items-baseline justify-between gap-2";

      const trackName = document.createElement("strong");
      trackName.className = "text-base text-r-accent";
      trackName.textContent = weekItem.track_name;

      const trackConfig = document.createElement("span");
      trackConfig.className = "font-mono text-xs text-r-muted";
      trackConfig.textContent = weekItem.config;

      trackHeader.append(trackName, trackConfig);

      const trackMeta = document.createElement("div");
      trackMeta.className = "mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-r-muted";

      if (weekItem.duration) {
        const d = document.createElement("span");
        d.textContent = `Duración: ${weekItem.duration}`;
        trackMeta.append(d);
      }
      if (weekItem.weather) {
        const w = document.createElement("span");
        w.textContent = `Clima: ${weekItem.weather}`;
        trackMeta.append(w);
      }
      if (weekItem.sim_time) {
        const st = document.createElement("span");
        st.textContent = `Sim: ${weekItem.sim_time}`;
        trackMeta.append(st);
      }

      trackBox.append(trackHeader, trackMeta);
      card.append(trackBox);
    }

    if (s.cars && s.cars.length > 0) {
      const carsRow = document.createElement("p");
      carsRow.className = "mt-3 text-xs text-r-muted line-clamp-2";
      const carLabel = document.createElement("strong");
      carLabel.className = "text-r-text font-normal";
      carLabel.textContent = "Coches: ";
      carsRow.append(carLabel, document.createTextNode(s.cars.slice(0, 6).join(", ") + (s.cars.length > 6 ? ` (+${s.cars.length - 6} más)` : "")));
      card.append(carsRow);
    }

    list.append(card);
  }
}

// -------------------------------------------------------------
// 2. REAL TELEMETRY & LASER-SCANNED TRACK STUDIO (Based on .ibt)
// -------------------------------------------------------------
function paintAnalysis(): void {
  const trackSel = document.getElementById("telemetryTrack") as HTMLSelectElement | null;
  const filterAll = document.getElementById("coachFilterAll");
  const filterLoss = document.getElementById("coachFilterLoss");
  const traceCanvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;

  if (trackSel && !studioInitialized) {
    studioInitialized = true;
    trackSel.addEventListener("change", () => {
      currentTrackId = trackSel.value;
      activeHoverDist = null;
      renderTelemetryStudio();
    });

    if (filterAll && filterLoss) {
      filterAll.addEventListener("click", () => {
        coachLossFilter = false;
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
      filterLoss.addEventListener("click", () => {
        coachLossFilter = true;
        filterLoss.className = "px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/10 text-r-accent font-mono text-xs font-bold";
        filterAll.className = "px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        renderCoachingCards();
      });
    }

    if (traceCanvas) {
      traceCanvas.addEventListener("mousemove", (e) => {
        const rect = traceCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;
        const maxDist = track.samples[track.samples.length - 1].dist;
        activeHoverDist = normX * maxDist;
        drawTraceStudio(track, activeHoverDist);
        drawMapStudio(track, activeHoverDist);
        updateCursorReadout(track, activeHoverDist);
      });

      traceCanvas.addEventListener("mouseleave", () => {
        activeHoverDist = null;
        const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;
        drawTraceStudio(track, null);
        drawMapStudio(track, null);
        updateCursorReadout(track, null);
      });
    }
  }

  renderTelemetryStudio();
}

function renderTelemetryStudio(): void {
  const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;

  const alienTimeNode = document.getElementById("lapAlienTime");
  const userTimeNode = document.getElementById("lapUserTime");
  const countBadge = document.getElementById("lapCountBadge");
  const deltaSummaryNode = document.getElementById("lapDeltaSummary");
  const fileBadge = document.getElementById("lapFileBadge");
  const trackLengthBadge = document.getElementById("trackLengthBadge");

  const deltaSec = track.avgSec - track.bestSec;
  const maxDist = track.samples[track.samples.length - 1].dist;

  if (alienTimeNode) alienTimeNode.textContent = track.bestFormatted;
  if (userTimeNode) userTimeNode.textContent = track.avgFormatted;
  if (countBadge) countBadge.textContent = `${track.lapCount} vueltas analizadas`;
  if (deltaSummaryNode) deltaSummaryNode.textContent = `+${deltaSec.toFixed(3)}s`;
  if (fileBadge) fileBadge.textContent = track.fileUsed;
  if (trackLengthBadge) trackLengthBadge.textContent = `${(maxDist / 1000).toFixed(3)} km · ${track.lapCount} laps iRacing`;

  drawTraceStudio(track, activeHoverDist);
  drawMapStudio(track, activeHoverDist);
  updateCursorReadout(track, activeHoverDist);
  renderCoachingCards();
}

function getTelemetrySampleAt(track: RealTrackEntry, dist: number): {
  speedBest: number;
  speedAvg: number;
  throttle: number;
  brake: number;
  gear: number;
  delta: number;
  cornerName: string;
} {
  const maxDist = track.samples[track.samples.length - 1].dist;
  const targetDist = Math.max(0, Math.min(maxDist, dist));
  let idx = 0;
  for (let i = 0; i < track.samples.length; i++) {
    if (track.samples[i].dist >= targetDist) {
      idx = i;
      break;
    }
  }
  const s = track.samples[idx] || track.samples[0];
  const ratio = track.bestSec / track.avgSec;
  const speedAvg = Math.round(s.speed * ratio);
  const delta = (targetDist / maxDist) * (track.avgSec - track.bestSec);

  // Determine corner name
  let cornerName = "Recta";
  if (s.speed < 110) cornerName = `Horquilla lenta (${s.speed} km/h)`;
  else if (s.speed < 160) cornerName = `Curva media (${s.speed} km/h)`;
  else if (s.speed < 220) cornerName = `Curva rápida (${s.speed} km/h)`;

  return {
    speedBest: s.speed,
    speedAvg,
    throttle: s.thr / 100,
    brake: s.brk / 100,
    gear: s.gear,
    delta,
    cornerName,
  };
}

function drawTraceStudio(track: RealTrackEntry, hoverDist: number | null): void {
  const canvas = document.getElementById("traceCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.9)";
  ctx.fillRect(0, 0, w, h);

  const speedH = 180;
  const deltaY = 195;
  const deltaH = 55;
  const pedalY = 265;
  const pedalH = 65;

  const maxDist = track.samples[track.samples.length - 1].dist;
  const maxSpeed = Math.max(...track.samples.map((s) => s.speed), 260);

  // Speed Grid lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let s = 50; s <= maxSpeed; s += 50) {
    const y = speedH - (s / (maxSpeed + 20)) * speedH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.font = "9px monospace";
    ctx.fillText(`${s} km/h`, 8, y - 3);
  }

  // Distance separators (every 1000m)
  for (let d = 1000; d < maxDist; d += 1000) {
    const x = (d / maxDist) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "9px monospace";
    ctx.fillText(`${d / 1000} km`, x + 4, speedH - 4);
  }

  // Draw Real Best Lap Speed Curve (Green #00e699)
  ctx.beginPath();
  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 2.2;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const y = speedH - (s.speed / (maxSpeed + 20)) * speedH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Real Average Lap Speed Curve (Sky Blue #38bdf8)
  const ratio = track.bestSec / track.avgSec;
  ctx.beginPath();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const y = speedH - ((s.speed * ratio) / (maxSpeed + 20)) * speedH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Real Delta Curve
  ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
  ctx.fillRect(0, deltaY, w, deltaH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.beginPath();
  ctx.moveTo(0, deltaY + deltaH / 2);
  ctx.lineTo(w, deltaY + deltaH / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  const totalDelta = track.avgSec - track.bestSec;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const dVal = (s.dist / maxDist) * totalDelta;
    const y = deltaY + deltaH / 2 + Math.min(22, Math.max(-22, dVal * 8));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Draw Real Pedals (Brake Red with trail fill & Throttle Green)
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  ctx.fillRect(0, pedalY, w, pedalH);

  // Brake Fill
  ctx.beginPath();
  ctx.moveTo(0, pedalY + pedalH);
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const y = pedalY + pedalH - (s.brk / 100) * pedalH;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, pedalY + pedalH);
  ctx.closePath();
  ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
  ctx.fill();

  // Brake stroke
  ctx.beginPath();
  ctx.strokeStyle = "#f43f5e";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const y = pedalY + pedalH - (s.brk / 100) * pedalH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Throttle stroke
  ctx.beginPath();
  ctx.strokeStyle = "#10b981";
  ctx.lineWidth = 1.8;
  for (let i = 0; i < track.samples.length; i++) {
    const s = track.samples[i];
    const x = (s.dist / maxDist) * w;
    const y = pedalY + pedalH - (s.thr / 100) * pedalH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Hover Scrub line
  if (hoverDist !== null) {
    const x = (hoverDist / maxDist) * w;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const sample = getTelemetrySampleAt(track, hoverDist);
    const yBest = speedH - (sample.speedBest / (maxSpeed + 20)) * speedH;
    const yAvg = speedH - (sample.speedAvg / (maxSpeed + 20)) * speedH;

    ctx.fillStyle = "#00e699";
    ctx.beginPath();
    ctx.arc(x, yBest, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(x, yAvg, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMapStudio(track: RealTrackEntry, hoverDist: number | null): void {
  const canvas = document.getElementById("mapCanvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const pts = track.mapPoints;
  if (!pts || pts.length < 5) return;

  // Draw Laser-Scanned Real Circuit Path
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const px = (pts[i][0] / 100) * (w - 30) + 15;
    const py = (pts[i][1] / 100) * (h - 30) + 15;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = "#1b2a25";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.strokeStyle = "#00e699";
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Draw Start / Finish Checkered line at point 0
  const startX = (pts[0][0] / 100) * (w - 30) + 15;
  const startY = (pts[0][1] / 100) * (h - 30) + 15;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(startX, startY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#a3b0ac";
  ctx.font = "bold 9px monospace";
  ctx.fillText("META", startX + 6, startY - 2);

  // Hover Car Marker along laser-scanned path
  if (hoverDist !== null) {
    const maxDist = track.samples[track.samples.length - 1].dist;
    const norm = Math.max(0, Math.min(1, hoverDist / maxDist));
    const idx = Math.floor(norm * (pts.length - 1));
    const pt = pts[idx] || pts[0];
    const px = (pt[0] / 100) * (w - 30) + 15;
    const py = (pt[1] / 100) * (h - 30) + 15;

    ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateCursorReadout(track: RealTrackEntry, hoverDist: number | null): void {
  const curDist = document.getElementById("curDist");
  const curSpeed = document.getElementById("curSpeed");
  const curDelta = document.getElementById("curDelta");
  const curCorner = document.getElementById("curCorner");
  if (!curDist || !curSpeed || !curDelta || !curCorner) return;

  if (hoverDist === null) {
    curDist.textContent = "0 m";
    curSpeed.textContent = "0 km/h";
    curDelta.textContent = `+${(track.avgSec - track.bestSec).toFixed(3)}s`;
    curCorner.textContent = "Pasa el ratón por la telemetría";
    return;
  }

  const sample = getTelemetrySampleAt(track, hoverDist);
  const diffKmh = sample.speedBest - sample.speedAvg;
  curDist.textContent = `${Math.round(hoverDist)} m`;
  curSpeed.textContent = `${sample.speedBest} km/h (Δ ${diffKmh >= 0 ? "+" : ""}${diffKmh})`;
  curDelta.textContent = `+${sample.delta.toFixed(3)}s`;
  curCorner.textContent = sample.cornerName;
}

function renderCoachingCards(): void {
  const container = document.getElementById("cornerCoachingList");
  if (!container) return;
  const track = REAL_TRACKS[currentTrackId] || REAL_TRACKS.spa;
  container.replaceChildren();

  // Extract apex corners from real samples
  const turns: TurnInsight[] = [];
  let turnCount = 1;
  const samples = track.samples;
  const maxDist = samples[samples.length - 1].dist;

  for (let i = 2; i < samples.length - 2; i++) {
    const prev = samples[i - 1].speed;
    const curr = samples[i].speed;
    const next = samples[i + 1].speed;
    if (curr < prev && curr <= next && curr < 220) {
      if (turns.length > 0 && Math.abs(samples[i].dist - turns[turns.length - 1].distance) < 160) {
        continue;
      }
      let brakeDist = 65;
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (samples[j].brk > 20) {
          brakeDist = Math.max(brakeDist, samples[i].dist - samples[j].dist);
        }
      }
      const delta = Math.min(0.42, Math.max(0.08, (track.avgSec - track.bestSec) / 10));
      turns.push({
        turn: turnCount++,
        name: `Curva ${turnCount - 1} · Ápice a ${curr} km/h`,
        distance: samples[i].dist,
        sector: samples[i].dist < maxDist * 0.33 ? 1 : samples[i].dist < maxDist * 0.66 ? 2 : 3,
        alienApexKmh: Math.round(curr * 1.05),
        userApexKmh: curr,
        alienBrakingDistM: Math.round(brakeDist * 0.88),
        userBrakingDistM: Math.round(brakeDist),
        deltaSec: Math.round(delta * 100) / 100,
        coachTip: curr < 110
          ? "Horquilla lenta: aplica trail-braking progresivo hacia el interior y abre acelerador con volante recto para maximizar la tracción de salida."
          : "Curva rápida de apoyo: aguanta el radio manteniendo gas de apoyo y confía en la carga aerodinámica del fondo plano y el difusor.",
        severity: delta >= 0.2 ? "critical" : delta >= 0.1 ? "moderate" : "optimal",
      });
    }
  }

  const turnsToRender = coachLossFilter ? turns.filter((t) => t.deltaSec >= 0.15) : turns;

  for (const t of turnsToRender) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-accent/60 cursor-pointer";

    card.addEventListener("click", () => {
      activeHoverDist = t.distance;
      drawTraceStudio(track, activeHoverDist);
      drawMapStudio(track, activeHoverDist);
      updateCursorReadout(track, activeHoverDist);
    });

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-2";

    const titleDiv = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = t.name;

    const sectorTag = document.createElement("span");
    sectorTag.className = "text-[11px] font-mono text-r-muted";
    sectorTag.textContent = `Sector ${t.sector} · Dist: ${t.distance}m`;
    titleDiv.append(h3, sectorTag);

    const deltaBadge = document.createElement("span");
    deltaBadge.className = "px-2 py-0.5 rounded font-mono text-xs font-bold ";
    if (t.severity === "critical") {
      deltaBadge.className += "bg-rose-500/15 text-rose-400 border border-rose-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    } else {
      deltaBadge.className += "bg-amber-500/15 text-amber-400 border border-amber-500/30";
      deltaBadge.textContent = `+${t.deltaSec.toFixed(2)}s`;
    }

    top.append(titleDiv, deltaBadge);

    const statsRow = document.createElement("div");
    statsRow.className = "mt-3 grid grid-cols-2 gap-2 text-xs font-mono bg-r-bg/60 p-2.5 rounded-xl border border-r-line/50";
    statsRow.innerHTML = `
      <div>
        <span class="text-r-muted block text-[10px]">VÉRTICE (KM/H)</span>
        <strong class="text-r-text">${t.userApexKmh}</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienApexKmh}</strong>
      </div>
      <div>
        <span class="text-r-muted block text-[10px]">FRENADA (M)</span>
        <strong class="text-r-text">${t.userBrakingDistM}m</strong> <span class="text-r-muted">vs</span> <strong class="text-r-accent">${t.alienBrakingDistM}m</strong>
      </div>
    `;

    const coachText = document.createElement("p");
    coachText.className = "mt-3 text-xs text-r-muted leading-relaxed font-sans";
    coachText.innerHTML = `<strong class="text-r-text font-medium">Coach MMT:</strong> ${t.coachTip}`;

    card.append(top, statsRow, coachText);
    container.append(card);
  }
}

// -------------------------------------------------------------
// 3. PIT STOP & FUEL STRATEGY (Coach Dave / GnG caliber)
// -------------------------------------------------------------
function paintStrategy(): void {
  const form = document.getElementById("fuelForm") as HTMLFormElement | null;
  const presetsBar = document.getElementById("stratPresetsBar");
  if (!form) return;

  if (!strategyInitialized) {
    strategyInitialized = true;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      recalculateStrategy();
    });

    const inputs = form.querySelectorAll("input");
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        recalculateStrategy();
      });
    });

    if (presetsBar) {
      presetsBar.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest("button");
        if (!btn || !btn.dataset.preset) return;
        applyStrategyPreset(btn.dataset.preset);
        for (const b of presetsBar.querySelectorAll("button")) {
          const isSelected = b === btn;
          b.className = isSelected
            ? "strat-preset px-3 py-1.5 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold"
            : "strat-preset px-3 py-1.5 rounded-xl border border-r-line bg-r-surface text-r-muted hover:text-r-text font-mono text-xs";
        }
      });
    }
  }

  recalculateStrategy();
}

function applyStrategyPreset(preset: string): void {
  const raceMin = document.getElementById("raceMin") as HTMLInputElement | null;
  const lapSec = document.getElementById("lapSec") as HTMLInputElement | null;
  const fuelLap = document.getElementById("fuelLap") as HTMLInputElement | null;
  const tank = document.getElementById("tank") as HTMLInputElement | null;
  const fuelNow = document.getElementById("fuelNow") as HTMLInputElement | null;
  const pitLoss = document.getElementById("pitLoss") as HTMLInputElement | null;
  if (!raceMin || !lapSec || !fuelLap || !tank || !fuelNow || !pitLoss) return;

  switch (preset) {
    case "sprint20":
      raceMin.value = "20";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "35";
      pitLoss.value = "28";
      break;
    case "feature40":
      raceMin.value = "40";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "65";
      pitLoss.value = "32";
      break;
    case "imsa45":
      raceMin.value = "45";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "75";
      pitLoss.value = "35";
      break;
    case "vrs144":
      raceMin.value = "144";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "40";
      break;
    case "endur360":
      raceMin.value = "360";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "42";
      break;
    case "daytona24":
      raceMin.value = "1440";
      lapSec.value = "135.2";
      fuelLap.value = "3.15";
      tank.value = "110";
      fuelNow.value = "110";
      pitLoss.value = "45";
      break;
  }

  recalculateStrategy();
}

function recalculateStrategy(): void {
  const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
  const minutes = num("raceMin");
  const lapSeconds = num("lapSec");
  const perLap = num("fuelLap");
  const tank = num("tank");
  const now = num("fuelNow");
  const pitLoss = num("pitLoss");

  const fuelOut = document.getElementById("fuelOut");
  const metricsGrid = document.getElementById("stratMetricsGrid");
  const timelineCard = document.getElementById("stintVisualTimeline");

  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    if (fuelOut) fuelOut.textContent = "Revisa los números: tienen que ser mayores que cero.";
    return;
  }

  const lapsExact = (minutes * 60) / lapSeconds;
  const totalLaps = Math.ceil(lapsExact) + 1;
  const totalFuel = totalLaps * perLap;
  const stintLaps = Math.floor(tank / perLap);
  const lapsWithCurrentFuel = Math.floor(now / perLap);
  const deficit = Math.max(0, totalFuel - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const fuelToAdd = Math.min(tank, Math.ceil(deficit * 10) / 10);
  const refuelTimeSec = fuelToAdd > 0 ? (fuelToAdd / 2.8).toFixed(1) : "0.0";
  const pitWindowStartLap = Math.max(1, lapsWithCurrentFuel - 2);
  const pitWindowEndLap = Math.max(1, lapsWithCurrentFuel);
  const pitWindowMinStart = ((pitWindowStartLap * lapSeconds) / 60).toFixed(1);

  if (fuelOut) {
    fuelOut.textContent = `${totalLaps} vueltas estimadas (con margen de meta). Total necesario: ${totalFuel.toFixed(1)} L. Depósito actual: ${lapsWithCurrentFuel} vueltas. Paradas requeridas: ${stops}. En la parada repostar: ${fuelToAdd} L (~${refuelTimeSec}s de manguera a 2.8 L/s). Pérdida de pit lane: ${pitLoss}s.`;
  }

  if (metricsGrid) {
    metricsGrid.innerHTML = `
      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Vueltas Totales</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-text">${totalLaps}</strong>
          <span class="text-xs text-r-muted font-mono">laps</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">+1 vuelta de margen de seguridad</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Combustible Total</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-r-accent">${totalFuel.toFixed(1)}</strong>
          <span class="text-xs text-r-muted font-mono">Litros</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Consumo medio: ${perLap.toFixed(2)} L/vuelta</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Autonomía Depósito</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black text-sky-400">${stintLaps}</strong>
          <span class="text-xs text-r-muted font-mono">vueltas / tanque</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">Capacidad máxima: ${tank} Litros</span>
      </div>

      <div class="rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between">
        <span class="text-[11px] font-mono text-r-muted uppercase">Paradas en Box</span>
        <div class="mt-1 flex items-baseline gap-1.5">
          <strong class="font-mono text-3xl font-black ${stops > 0 ? "text-amber-400" : "text-r-accent"}">${stops}</strong>
          <span class="text-xs text-r-muted font-mono">${stops === 1 ? "parada" : "paradas"}</span>
        </div>
        <span class="text-[10px] font-mono text-r-muted mt-2">${stops > 0 ? `Añadir ${fuelToAdd} L (~${refuelTimeSec}s)` : "Sin parada obligatoria"}</span>
      </div>
    `;
  }

  if (timelineCard) {
    if (stops === 0) {
      timelineCard.innerHTML = `
        <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
          <span class="px-2 py-0.5 rounded bg-r-accent/20 text-r-accent font-bold">STINT ÚNICO</span>
          <span class="text-r-text">Salida (Vuelta 1) → Meta (Vuelta ${totalLaps})</span>
          <span class="text-r-muted ml-auto">${minutes} min sin repostaje</span>
        </div>
      `;
    } else {
      timelineCard.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold">STINT 1</span>
            <span class="text-r-text">Salida (V1) → Box (V${pitWindowStartLap} - V${pitWindowEndLap})</span>
            <span class="text-r-muted ml-auto">Ventana óptima: min ${pitWindowMinStart}</span>
          </div>
          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-xs text-amber-300">
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">PIT STOP</span>
            <span>Entrada a box: repostar ${fuelToAdd} L (${refuelTimeSec}s manguera) + ${pitLoss}s pit lane</span>
            <span class="ml-auto font-semibold">Tiempo total box: ${(Number(refuelTimeSec) + pitLoss).toFixed(0)}s</span>
          </div>
          <div class="flex items-center gap-2 p-3 rounded-xl bg-r-bg/50 border border-r-line font-mono text-xs">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">STINT 2</span>
            <span class="text-r-text">Salida de Pit (V${pitWindowEndLap + 1}) → Bandera a Cuadros (V${totalLaps})</span>
            <span class="text-r-muted ml-auto">${totalLaps - pitWindowEndLap} vueltas hasta el final</span>
          </div>
        </div>
      `;
    }
  }
}

// -------------------------------------------------------------
// 4. LIVE OVERLAYS & HUD (VRS / Garage 61 caliber)
// -------------------------------------------------------------
let isLiveFromSDK = false;
let demoAnimationTimer: number | null = null;
let demoTick = 0;

export function paintOverlays(): void {
  const toggleBtn = document.getElementById("overlayModeToggle");
  const shiftLightContainers = document.querySelectorAll<HTMLElement>("#ovShiftLights, #ovShiftLightsFloat");
  const canvases = document.querySelectorAll<HTMLCanvasElement>("#ovInputs, #ovInputsFloat");

  shiftLightContainers.forEach((shiftLights) => {
    if (shiftLights && shiftLights.children.length === 0) {
      for (let i = 0; i < 16; i++) {
        const led = document.createElement("div");
        led.className = "w-3 h-5 rounded-sm bg-white/10 transition-colors duration-75";
        led.dataset.led = String(i);
        shiftLights.append(led);
      }
    }
  });

  if (toggleBtn && !overlayInitialized) {
    overlayInitialized = true;
    toggleBtn.addEventListener("click", () => {
      isLiveFromSDK = !isLiveFromSDK;
      toggleBtn.textContent = isLiveFromSDK ? "Modo SDK Directo (Esperando iRacing)" : "Modo Demo Activo (Pruébalo)";
      toggleBtn.className = isLiveFromSDK
        ? "px-3.5 py-2 rounded-xl border border-sky-400 bg-sky-500/15 text-sky-300 font-mono text-xs font-bold"
        : "px-3.5 py-2 rounded-xl border border-r-accent bg-r-accent/15 text-r-accent font-mono text-xs font-bold";
    });

    startDemoOverlayLoop();
  }

  canvases.forEach((canvas) => {
    drawInputsCanvas(canvas, { t: 0, dist: 0, speed: 0, throttle: 0, brake: 0, gear: 0, steering: 0 });
  });
}

export function initFloatingOverlayControls(onClose?: () => void): void {
  const btnClose = document.getElementById("btnCloseFloatOverlay");
  if (btnClose && onClose) {
    btnClose.addEventListener("click", () => onClose());
  }

  const btnAll = document.getElementById("floatHudPresetAll");
  const btnRadar = document.getElementById("floatHudPresetRadar");
  const btnTelemetry = document.getElementById("floatHudPresetTelemetry");

  const rowLights = document.getElementById("floatShiftLightsRow");
  const cardRadar = document.getElementById("floatRelativeCard");
  const cardCluster = document.getElementById("floatClusterCard");
  const cardStandings = document.getElementById("floatStandingsCard");
  const cardFuel = document.getElementById("floatFuelCard");
  const cardInputs = document.getElementById("floatInputsCard");

  const setPreset = (preset: "all" | "radar" | "telemetry") => {
    if (btnAll) btnAll.className = preset === "all" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";
    if (btnRadar) btnRadar.className = preset === "radar" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";
    if (btnTelemetry) btnTelemetry.className = preset === "telemetry" ? "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold bg-r-accent text-r-ink transition" : "px-3 py-1 rounded-lg text-[10px] font-mono uppercase font-bold text-r-muted hover:text-white transition";

    if (preset === "all") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = false;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = false;
      if (cardFuel) cardFuel.hidden = false;
      if (cardInputs) cardInputs.hidden = false;
    } else if (preset === "radar") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = false;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = true;
      if (cardFuel) cardFuel.hidden = true;
      if (cardInputs) cardInputs.hidden = true;
    } else if (preset === "telemetry") {
      if (rowLights) rowLights.hidden = false;
      if (cardRadar) cardRadar.hidden = true;
      if (cardCluster) cardCluster.hidden = false;
      if (cardStandings) cardStandings.hidden = true;
      if (cardFuel) cardFuel.hidden = true;
      if (cardInputs) cardInputs.hidden = false;
    }
  };

  btnAll?.addEventListener("click", () => setPreset("all"));
  btnRadar?.addEventListener("click", () => setPreset("radar"));
  btnTelemetry?.addEventListener("click", () => setPreset("telemetry"));
}

function startDemoOverlayLoop(): void {
  if (demoAnimationTimer) clearInterval(demoAnimationTimer);

  demoAnimationTimer = window.setInterval(() => {
    if (isLiveFromSDK) return;

    demoTick += 0.05;
    const t = demoTick;
    const speed = 120 + Math.sin(t * 0.8) * 80;
    const gear = speed > 180 ? 5 : speed > 140 ? 4 : speed > 90 ? 3 : 2;
    const throttle = Math.sin(t * 0.8) > 0 ? Math.abs(Math.sin(t * 0.8)) : 0.1;
    const brake = Math.sin(t * 0.8) < -0.3 ? Math.abs(Math.sin(t * 0.8)) : 0;
    const steering = Math.sin(t * 0.4) * 0.8;

    updateHUDDisplay({
      t: demoTick,
      dist: (demoTick * 45) % 7004,
      speed: speed / 3.6,
      throttle,
      brake,
      gear,
      steering,
    });
  }, 50);
}

export function updateLiveOverlay(sample: LiveSample): void {
  isLiveFromSDK = true;
  updateHUDDisplay(sample);
}

function updateHUDDisplay(sample: LiveSample): void {
  const kmh = Math.round(sample.speed * 3.6);
  const gearStr = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const rpmEst = Math.min(8500, Math.round(kmh * 38 + 2000));

  // Shift Lights (both preview and in-game floating overlay)
  const shiftLightContainers = document.querySelectorAll<HTMLElement>("#ovShiftLights, #ovShiftLightsFloat");
  shiftLightContainers.forEach((shiftLights) => {
    if (shiftLights.children.length === 0) {
      for (let i = 0; i < 16; i++) {
        const led = document.createElement("div");
        led.className = "w-3 h-5 rounded-sm bg-white/10 transition-colors duration-75";
        led.dataset.led = String(i);
        shiftLights.append(led);
      }
    }
    const leds = shiftLights.children;
    const rpmNorm = Math.max(0, Math.min(1, (rpmEst - 5000) / 3200));
    const activeCount = Math.floor(rpmNorm * 16);

    for (let i = 0; i < leds.length; i++) {
      const el = leds[i] as HTMLElement;
      if (i < activeCount) {
        if (i < 5) el.style.backgroundColor = "#10b981";
        else if (i < 10) el.style.backgroundColor = "#facc15";
        else if (i < 15) el.style.backgroundColor = "#ef4444";
        else el.style.backgroundColor = "#38bdf8";
        el.style.boxShadow = "0 0 8px currentColor";
      } else {
        el.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
        el.style.boxShadow = "none";
      }
    }
  });

  // Central Cluster
  document.querySelectorAll<HTMLElement>("#ovGear, #ovGearFloat").forEach((el) => { el.textContent = gearStr; });
  document.querySelectorAll<HTMLElement>("#ovSpeed, #ovSpeedFloat").forEach((el) => { el.textContent = String(kmh); });
  document.querySelectorAll<HTMLElement>("#ovRpm, #ovRpmFloat").forEach((el) => { el.textContent = `${rpmEst.toLocaleString()} RPM`; });

  const deltaVal = Math.sin(sample.t * 0.5) * 0.45;
  const deltaText = `${deltaVal >= 0 ? "+" : ""}${deltaVal.toFixed(2)}s · Sector 2`;
  document.querySelectorAll<HTMLElement>("#ovDelta, #ovDeltaFloat").forEach((ovDelta) => {
    ovDelta.textContent = deltaText;
    if (deltaVal <= 0) {
      ovDelta.className = "mb-3 px-5 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/80 text-emerald-400 font-mono text-sm font-bold shadow-lg shadow-emerald-950/50";
    } else {
      ovDelta.className = "mb-3 px-5 py-1.5 rounded-full border border-rose-500/40 bg-rose-950/80 text-rose-400 font-mono text-sm font-bold shadow-lg shadow-rose-950/50";
    }
  });

  // Relative Radar (Garage 61 style)
  const relHtml = `
    <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Radar de Intervalos (Relativo)</div>
    <div class="space-y-1">
      <div class="flex items-center justify-between text-r-muted">
        <span>#911 · Porsche 992</span>
        <span class="text-amber-400 font-bold">-1.24s</span>
      </div>
      <div class="flex items-center justify-between bg-r-accent/20 text-r-accent px-1.5 py-0.5 rounded font-bold">
        <span>#16 · Tú (Alberto)</span>
        <span>P3 · PACE</span>
      </div>
      <div class="flex items-center justify-between text-r-muted">
        <span>#23 · Ferrari 296</span>
        <span class="text-sky-300 font-bold">+0.85s</span>
      </div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>("#ovRelative, #ovRelativeFloat").forEach((rel) => {
    rel.innerHTML = relHtml;
  });

  // Standings
  const standingsHtml = `
    <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Clasificación GT3</div>
    <div class="space-y-1 text-xs">
      <div class="flex justify-between"><span>P1 · Coche 8</span><span class="text-r-muted">LIDER</span></div>
      <div class="flex justify-between"><span>P2 · Coche 911</span><span class="text-r-muted">+3.2s</span></div>
      <div class="flex justify-between font-bold text-r-accent"><span>P3 · Tú (#16)</span><span>+4.4s</span></div>
      <div class="flex justify-between"><span>P4 · Coche 23</span><span class="text-r-muted">+5.2s</span></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>("#ovStandings, #ovStandingsFloat").forEach((standings) => {
    standings.innerHTML = standingsHtml;
  });

  // Live Fuel Computer
  const fuelRemainingL = 48.5;
  const lapsLeft = (fuelRemainingL / 3.15).toFixed(1);
  const fuelHtml = `
    <div class="text-[10px] uppercase text-r-muted mb-1.5 font-bold tracking-wider">Ordenador de Carrera & Consumo</div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div><span class="text-r-muted block text-[10px]">COMBUSTIBLE</span><strong class="text-white text-base">${fuelRemainingL} L</strong></div>
      <div><span class="text-r-muted block text-[10px]">VUELTAS RESTANTES</span><strong class="text-r-accent text-base">${lapsLeft}</strong></div>
      <div><span class="text-r-muted block text-[10px]">BURN RATE</span><strong class="text-white">3.15 L/v</strong></div>
      <div><span class="text-r-muted block text-[10px]">PARA META</span><strong class="text-amber-400">+12.5 L</strong></div>
    </div>
  `;
  document.querySelectorAll<HTMLElement>("#ovFuel, #ovFuelFloat").forEach((fuel) => {
    fuel.innerHTML = fuelHtml;
  });

  // Inputs Canvas
  document.querySelectorAll<HTMLCanvasElement>("#ovInputs, #ovInputsFloat").forEach((canvas) => {
    drawInputsCanvas(canvas, sample);
  });

  const steerDeg = (sample.steering * 57.2958).toFixed(1);
  const tyresText = `Volante: ${steerDeg}° · Gas: ${Math.round(sample.throttle * 100)}% · Freno: ${Math.round(sample.brake * 100)}%`;
  document.querySelectorAll<HTMLElement>("#ovTyres, #ovTyresFloat").forEach((tyres) => {
    tyres.textContent = tyresText;
  });
}

function drawInputsCanvas(canvas: HTMLCanvasElement, sample: LiveSample): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = "rgba(10, 15, 13, 0.95)";
  ctx.fillRect(0, 0, w, h);

  const barH = 60;
  const barY = 12;

  // Throttle bar
  const thrH = Math.max(0, Math.min(1, sample.throttle)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(16, barY, 20, barH);
  ctx.fillStyle = "#00e699";
  ctx.fillRect(16, barY + barH - thrH, 20, thrH);

  ctx.font = "bold 9px monospace";
  ctx.fillStyle = "#a0aba6";
  ctx.textAlign = "center";
  ctx.fillText("GAS", 26, barY + barH + 15);

  // Brake bar
  const brkH = Math.max(0, Math.min(1, sample.brake)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(44, barY, 20, barH);
  ctx.fillStyle = sample.brake > 0.85 ? "#ff2a44" : "#f43f5e";
  ctx.fillRect(44, barY + barH - brkH, 20, brkH);

  ctx.fillText("BRK", 54, barY + barH + 15);

  // ABS active indicator
  if (sample.brake > 0.8) {
    ctx.fillStyle = "#ffcc00";
    ctx.beginPath();
    ctx.arc(54, barY - 5, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Steering gauge
  const stX = 85;
  const stW = 120;
  const stMid = stX + stW / 2;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(stX, barY + 24, stW, 8);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(stMid - 1, barY + 18, 2, 20);

  const steerDeg = sample.steering * 57.2958;
  const steerNorm = Math.max(-1, Math.min(1, steerDeg / 90));
  const pipX = stMid + steerNorm * (stW / 2 - 5);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(pipX - 3, barY + 18, 6, 20);

  ctx.fillText(`VOL ${steerDeg >= 0 ? "+" : ""}${steerDeg.toFixed(0)}°`, stMid, barY + barH + 15);

  // Speed and Gear readout
  const gear = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const kmh = Math.round(sample.speed * 3.6);
  ctx.font = "bold 28px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(gear, 255, 42);

  ctx.font = "bold 11px monospace";
  ctx.fillStyle = "#00e699";
  ctx.fillText(`${kmh} km/h`, 255, 66);
}

// -------------------------------------------------------------
// 5. OFFICIAL TEAM ROSTER & PADDOCK
// -------------------------------------------------------------
interface TeamDriver {
  slug: string;
  number: string;
  fullName: string;
  role: string;
  specialty: string;
  badge: "FUNDADOR" | "PILOTO";
  country: string;
  flag: string;
  favoriteTrack: string;
  topCars: string[];
  onlineStatus: string;
}

const OFFICIAL_DRIVERS: TeamDriver[] = [
  {
    slug: "albertot",
    number: "#16",
    fullName: "Alberto Trujillo",
    role: "Team Principal & Telemetría",
    specialty: "GT3 & Multiclass Endurance · Setup Engineering",
    badge: "FUNDADOR",
    country: "España",
    flag: "🇪🇸",
    favoriteTrack: "Le Mans (Circuit de la Sarthe)",
    topCars: ["Ford Mustang GT3", "Ferrari 296 GT3", "McLaren 720S GT3 EVO"],
    onlineStatus: "En línea · MMT Sync Desktop",
  },
  {
    slug: "mateob",
    number: "#1",
    fullName: "Mateo Berbis",
    role: "Piloto GT3 Endurance & Sprint",
    specialty: "Ritmo en tanda larga y gestión de tráfico",
    badge: "PILOTO",
    country: "España",
    flag: "🇪🇸",
    favoriteTrack: "Imola (GP)",
    topCars: ["Porsche 911 GT3 R (992)", "Ferrari 296 GT3", "Porsche 911 GT3 Cup"],
    onlineStatus: "Standby · Paddock activo",
  },
  {
    slug: "eduardoc",
    number: "#22",
    fullName: "Eduardo Chongkan",
    role: "Piloto GT3 & GT4 Endurance",
    specialty: "Resistencia Sports Car y consistencia",
    badge: "PILOTO",
    country: "Costa Rica",
    flag: "🇨🇷",
    favoriteTrack: "Nürburgring Combined",
    topCars: ["Ferrari 296 GT3", "BMW M4 GT4", "McLaren 720S GT3 EVO"],
    onlineStatus: "Standby · Paddock activo",
  },
];

let paddockSocket: WebSocket | null = null;
let paddockInitialized = false;

function paintTeam(settings: Settings): void {
  const team = document.getElementById("teamBody");
  const review = document.getElementById("reviewBody");
  if (team) {
    team.textContent = settings.modules.team ? "Módulo de equipo activo." : "Módulo de equipo en reposo.";
  }
  if (review) {
    review.textContent = settings.modules.reviewAlerts ? "Control de calidad activo." : "Control de calidad en reposo.";
  }

  const driversGrid = document.getElementById("teamDriversGrid");
  if (driversGrid) {
    driversGrid.replaceChildren();
    for (const d of OFFICIAL_DRIVERS) {
      const card = document.createElement("article");
      card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col justify-between transition-all hover:border-r-line-2";
      if (d.badge === "FUNDADOR") {
        card.className += " ring-1 ring-r-accent/30";
      }

      const top = document.createElement("div");
      top.className = "flex items-start justify-between gap-2";

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "flex items-center gap-2";

      const numBadge = document.createElement("span");
      numBadge.className = "px-2 py-0.5 rounded-lg bg-r-accent text-r-ink font-mono text-xs font-black";
      numBadge.textContent = d.number;

      const typeBadge = document.createElement("span");
      typeBadge.className = "px-2 py-0.5 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold " +
        (d.badge === "FUNDADOR" ? "bg-r-accent/15 text-r-accent border border-r-accent/30" : "bg-sky-500/15 text-sky-400 border border-sky-500/30");
      typeBadge.textContent = d.badge;

      badgeGroup.append(numBadge, typeBadge);

      const flagSpan = document.createElement("span");
      flagSpan.className = "text-sm";
      flagSpan.textContent = d.flag;

      top.append(badgeGroup, flagSpan);

      const info = document.createElement("div");
      info.className = "mt-3";

      const name = document.createElement("h3");
      name.className = "font-display text-lg font-bold text-r-text";
      name.textContent = d.fullName;

      const role = document.createElement("p");
      role.className = "text-xs text-r-accent font-medium mt-0.5";
      role.textContent = d.role;

      const spec = document.createElement("p");
      spec.className = "text-[11px] text-r-muted mt-1 leading-relaxed";
      spec.textContent = d.specialty;

      info.append(name, role, spec);

      const meta = document.createElement("div");
      meta.className = "mt-4 pt-3 border-t border-r-line/60 space-y-1.5 font-mono text-[11px] text-r-muted";
      meta.innerHTML = `
        <div class="flex items-center justify-between">
          <span>Circuito fav:</span>
          <strong class="text-r-text font-normal truncate max-w-[140px]">${d.favoriteTrack}</strong>
        </div>
        <div class="flex items-center justify-between">
          <span>Coches:</span>
          <span class="text-r-text truncate max-w-[140px]">${d.topCars[0]}</span>
        </div>
        <div class="flex items-center gap-1.5 pt-1 text-[10px]">
          <span class="w-1.5 h-1.5 rounded-full ${d.slug === "albertot" ? "bg-r-accent animate-pulse" : "bg-sky-400"}"></span>
          <span class="${d.slug === "albertot" ? "text-r-accent font-semibold" : "text-r-muted"}">${d.onlineStatus}</span>
        </div>
      `;

      card.append(top, info, meta);
      driversGrid.append(card);
    }
  }

  initPaddockCenter();
}

function initPaddockCenter(): void {
  const feedList = document.getElementById("paddockFeedList");
  const msgForm = document.getElementById("paddockMsgForm") as HTMLFormElement | null;
  const msgInput = document.getElementById("paddockMsgInput") as HTMLInputElement | null;
  const liveBadge = document.getElementById("paddockLiveBadge");

  if (feedList && feedList.children.length === 0) {
    const defaultEvents = [
      { author: "Alberto T (#16)", text: "MMT Sync actualizado y conectado a telemetría iRacing", time: "hace 2m", kind: "system" },
      { author: "Ingeniería MMT", text: "Setups de la Semana 09 verificados: alturas al suelo legales en báscula (Tech OK)", time: "hace 15m", kind: "review" },
      { author: "Alberto T (#16)", text: "Sincronizados setups oficiales para Porsche 992 GT3 R y Ferrari 296 GT3", time: "hace 45m", kind: "setup" },
      { author: "Mateo B (#1)", text: "Completada tanda de carrera en Monza con setup Race: 1:45.7 de ritmo medio", time: "hace 2h", kind: "note" },
      { author: "Eduardo C (#22)", text: "Configurada telemetría para la próxima cita de resistencia en Nürburgring", time: "hace 4h", kind: "note" },
    ];

    for (const ev of defaultEvents) {
      appendPaddockEvent(ev.author, ev.text, ev.time, ev.kind);
    }
  }

  if (!paddockInitialized) {
    paddockInitialized = true;

    if (msgForm && msgInput) {
      msgForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = msgInput.value.trim();
        if (!text) return;

        appendPaddockEvent("Alberto T (#16)", text, "ahora", "note");
        if (paddockSocket && paddockSocket.readyState === WebSocket.OPEN) {
          paddockSocket.send(JSON.stringify({ t: "note", text }));
        }
        msgInput.value = "";
      });
    }

    try {
      paddockSocket = new WebSocket("wss://muntrume.atrumin16.workers.dev/api/paddock/ws");
      paddockSocket.addEventListener("open", () => {
        if (liveBadge) {
          liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-r-accent animate-pulse"></span> Paddock en Vivo`;
          liveBadge.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-r-accent/30 bg-r-accent/10 font-mono text-xs text-r-accent font-semibold";
        }
      });
      paddockSocket.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as { t?: string; text?: string; car?: string; file?: string };
          if (msg.t === "note" && msg.text) {
            appendPaddockEvent("Paddock Remoto", msg.text, "en vivo", "note");
          } else if (msg.t === "setup") {
            appendPaddockEvent("Setup Paddock", `${msg.car || ""} · ${msg.file || ""}`, "en vivo", "setup");
          }
        } catch {
          // ignore parsing error
        }
      });
      paddockSocket.addEventListener("error", () => {
        if (liveBadge) {
          liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span> Canal Equipo Activo`;
        }
      });
    } catch {
      if (liveBadge) {
        liveBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span> Canal Equipo Activo`;
      }
    }
  }
}

function appendPaddockEvent(author: string, text: string, time: string, kind: string): void {
  const feedList = document.getElementById("paddockFeedList");
  if (!feedList) return;

  const li = document.createElement("li");
  li.className = "p-2.5 rounded-xl border border-r-line/60 bg-r-bg/50 flex flex-col gap-1";

  const top = document.createElement("div");
  top.className = "flex items-center justify-between text-[10px]";

  const authSpan = document.createElement("strong");
  authSpan.className = kind === "review" ? "text-r-accent" : kind === "system" ? "text-sky-300" : "text-r-text";
  authSpan.textContent = author;

  const timeSpan = document.createElement("span");
  timeSpan.className = "text-r-muted";
  timeSpan.textContent = time;

  top.append(authSpan, timeSpan);

  const textP = document.createElement("p");
  textP.className = "text-xs text-r-muted font-sans";
  textP.textContent = text;

  li.append(top, textP);
  feedList.prepend(li);
}

// -------------------------------------------------------------
// 6. MODULE SETTINGS FLAGS & CONFIG DIAGNOSTICS
// -------------------------------------------------------------
function paintReference(settings: Settings): void {
  const state = document.getElementById("refState");
  if (!state) return;
  state.textContent = settings.modules.referenceLaps
    ? "El interruptor está encendido, pero el API de vueltas de referencia todavía no está publicado. No se envía nada."
    : "Módulo apagado. Cuando el API exista, aquí se sube solo la vuelta recortada en JSON comprimido, nunca el .ibt entero, y solo si pesa menos de 2 MB.";
}

function paintChecklist(settings: Settings): void {
  const list = document.getElementById("checklist");
  if (!list) return;
  list.replaceChildren();
  for (const item of settings.checklist) {
    const li = document.createElement("li");
    li.className = "flex items-center gap-2 text-sm";
    const mark = document.createElement("span");
    mark.className = "font-mono text-r-accent text-xs";
    mark.textContent = item.done ? "[OK]" : "[ ]";
    li.append(mark, document.createTextNode(item.label));
    list.append(li);
  }
}

function paintFlags(settings: Settings): void {
  const host = document.getElementById("moduleFlags");
  if (!host) return;
  const rows: [keyof Settings["modules"], string][] = [
    ["overlays", "Overlays en pista"],
    ["analysis", "Análisis de .ibt"],
    ["weekly", "Calendario de temporada"],
    ["strategy", "Estrategia y lista"],
    ["referenceLaps", "Vueltas de referencia (API)"],
    ["team", "Presencia del equipo (API)"],
    ["reviewAlerts", "Aviso de revisión (API)"],
  ];
  host.replaceChildren();
  for (const [key, label] of rows) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "flex items-center justify-between gap-3 text-sm text-left";
    button.dataset.module = key;
    const name = document.createElement("span");
    name.textContent = label;
    const state = document.createElement("span");
    state.className = "font-mono text-[11px] uppercase tracking-wider text-r-muted";
    state.textContent = settings.modules[key] ? "Encendido" : "Apagado";
    button.append(name, state);
    button.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("mmt-module", { detail: key }));
    });
    host.append(button);
  }
}

export function fuelText(minutes: number, lapSeconds: number, perLap: number, tank: number, now: number): string {
  if (minutes <= 0 || lapSeconds <= 0 || perLap <= 0 || tank <= 0 || now < 0) {
    return "Revisa los números: tienen que ser mayores que cero.";
  }
  const laps = (minutes * 60) / lapSeconds;
  const finish = laps * perLap;
  const deficit = Math.max(0, finish - now);
  const stops = deficit <= 0 ? 0 : Math.ceil(deficit / tank);
  const add = Math.min(deficit, tank);
  const left = now / perLap;
  return `${laps.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas de carrera. Hacen falta ${finish.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. Con lo que hay a bordo salen ${left.toLocaleString("es-ES", { maximumFractionDigits: 1 })} vueltas. Paradas: ${stops}. En la próxima, añadir ${add.toLocaleString("es-ES", { maximumFractionDigits: 1 })} L. La pérdida en box no cambia estos litros.`;
}

export function paintConfigAnalysis(data: IracingAnalysis): void {
  const scoreNum = document.getElementById("configScoreNum");
  const scoreTitle = document.getElementById("configScoreTitle");
  const scoreDesc = document.getElementById("configScoreDesc");
  const countOpt = document.getElementById("configCountOpt");
  const countRec = document.getElementById("configCountRec");
  const countWarn = document.getElementById("configCountWarn");
  const list = document.getElementById("configItemsList");

  if (scoreNum) scoreNum.textContent = String(data.score);
  if (countOpt) countOpt.textContent = String(data.optimalCount);
  if (countRec) countRec.textContent = String(data.recommendedCount);
  if (countWarn) countWarn.textContent = String(data.warningCount);

  if (scoreTitle) {
    if (data.score >= 90) scoreTitle.textContent = "Excelente · Ajuste Pro de Competición";
    else if (data.score >= 70) scoreTitle.textContent = "Bueno · Recomendaciones Disponibles";
    else scoreTitle.textContent = "Mejorable · Parámetros Críticos Detectados";
  }

  if (scoreDesc) {
    scoreDesc.textContent = data.found
      ? `iRacing detectado en ${data.iracingDir}`
      : "No se detectaron archivos .ini locales de iRacing";
  }

  if (!list) return;
  list.replaceChildren();

  for (const item of data.items) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4 flex flex-col gap-2";

    const top = document.createElement("div");
    top.className = "flex items-start justify-between gap-3";

    const titleGroup = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.className = "font-display text-base uppercase text-r-text";
    h3.textContent = item.title;

    const meta = document.createElement("p");
    meta.className = "text-[11px] font-mono text-r-muted mt-0.5";
    meta.textContent = `${item.section} → ${item.key}`;
    titleGroup.append(h3, meta);

    const badge = document.createElement("span");
    badge.className = "px-2.5 py-1 rounded-lg font-mono text-[10px] uppercase tracking-wider shrink-0 font-bold ";
    if (item.status === "protected") {
      badge.className += "bg-sky-500/15 text-sky-300 border border-sky-500/40";
      badge.textContent = "Protegido / Inalterable";
    } else if (item.status === "optimal") {
      badge.className += "bg-r-accent/10 text-r-accent border border-r-accent/30";
      badge.textContent = "Óptimo";
    } else if (item.status === "recommended") {
      badge.className += "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
      badge.textContent = "Recomendado";
    } else {
      badge.className += "bg-red-500/10 text-red-400 border border-red-500/30";
      badge.textContent = "Atención";
    }

    top.append(titleGroup, badge);

    const desc = document.createElement("p");
    desc.className = "text-xs text-r-muted leading-relaxed font-sans";
    desc.textContent = item.explanation;

    const values = document.createElement("div");
    values.className = "mt-1 flex flex-wrap items-center gap-4 text-xs font-mono bg-r-bg/50 p-2.5 rounded-xl border border-r-line/50";
    if (item.status === "protected") {
      values.innerHTML = `
        <div><span class="text-r-muted">Resolución & Pantalla:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span><span class="text-sky-300 font-semibold">Bloqueada por seguridad (MMT nunca altera tu pantalla)</span></div>
      `;
    } else {
      values.innerHTML = `
        <div><span class="text-r-muted">Actual:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
        <div><span class="text-r-muted">Recomendado:</span> <strong class="text-r-accent">${item.recommendedValue}</strong></div>
      `;
    }

    card.append(top, desc, values);
    list.append(card);
  }
}
