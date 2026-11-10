import type { IracingAnalysis, LibraryItem, LiveSample, Settings, Snapshot } from "./types";

export function paintExtras(data: Snapshot): void {
  paintWeek(data);
  paintAnalysis();
  paintReference(data.settings);
  paintChecklist(data.settings);
  paintOverlays();
  paintTeam(data.settings);
  paintFlags(data.settings);
  const fuelOut = document.getElementById("fuelOut");
  const raceMin = document.getElementById("raceMin") as HTMLInputElement | null;
  if (fuelOut && raceMin && fuelOut.textContent === "") {
    const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
    fuelOut.textContent = fuelText(num("raceMin"), num("lapSec"), num("fuelLap"), num("tank"), num("fuelNow"));
  }
}

function paintWeek(data: Snapshot): void {
  const note = document.getElementById("weekNote");
  const list = document.getElementById("weekList");
  if (!note || !list) return;
  const hasWeek = data.library.some((item) => item.id.includes("week"));
  note.textContent = hasWeek
    ? "Agrupado con el campo week del manifiesto."
    : "El manifiesto no trae la semana actual. Se agrupa por circuito, sin inventar el calendario de iRacing.";
  list.replaceChildren();
  const groups = new Map<string, LibraryItem[]>();
  for (const item of data.library) {
    const key = item.track;
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }
  for (const [track, rows] of groups) {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-r-line bg-r-surface p-4";
    const title = document.createElement("h2");
    title.className = "mmt-display text-2xl";
    title.textContent = track;
    card.append(title);
    for (const row of rows) {
      const line = document.createElement("p");
      line.className = "mt-2 text-sm";
      const fav = data.settings.favourites.includes(row.id) ? " · favorito" : "";
      line.textContent = `${row.car} · ${row.filename}${fav}`;
      card.append(line);
    }
    list.append(card);
  }
  if (data.library.length >= 2) {
    const diff = document.createElement("article");
    diff.className = "rounded-2xl border border-r-line bg-r-surface p-4";
    const title = document.createElement("h2");
    title.className = "mmt-display text-2xl";
    title.textContent = "Diferencia de metadatos";
    const a = data.library[0];
    const b = data.library[1];
    const body = document.createElement("p");
    body.className = "mt-2 text-sm text-r-muted";
    body.textContent = `${a.filename} y ${b.filename}: circuito ${a.track === b.track ? "igual" : `${a.track} / ${b.track}`}, tipo ${a.kind === b.kind ? "igual" : `${a.kind} / ${b.kind}`}, tamaño ${a.size} B / ${b.size} B. No se comparan los bytes del .sto.`;
    diff.append(title, body);
    list.append(diff);
  }
}

function paintAnalysis(): void {
  const lapA = document.getElementById("lapA") as HTMLSelectElement | null;
  const lapB = document.getElementById("lapB") as HTMLSelectElement | null;
  if (!lapA || !lapB || lapA.options.length > 0) {
    drawAnalysis();
    return;
  }
  for (const [value, label] of [["1", "Vuelta sintética 1"], ["2", "Vuelta sintética 2"]] as const) {
    for (const select of [lapA, lapB]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
  }
  lapB.value = "2";
  lapA.addEventListener("change", drawAnalysis);
  lapB.addEventListener("change", drawAnalysis);
  drawAnalysis();
}

function circle(step: number, total: number, scale: number): { x: number; y: number; speed: number; brake: number; throttle: number } {
  const u = step / (total - 1);
  const angle = u * Math.PI * 2;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle) * scale,
    speed: 50 * scale * (0.85 + 0.15 * Math.sin(angle)),
    brake: u > 0.75 ? 0.8 : 0,
    throttle: u < 0.7 ? 1 : 0.35,
  };
}

function drawAnalysis(): void {
  const map = document.getElementById("mapCanvas") as HTMLCanvasElement | null;
  const trace = document.getElementById("traceCanvas") as HTMLCanvasElement | null;
  if (!map || !trace) return;
  const mapCtx = map.getContext("2d");
  const traceCtx = trace.getContext("2d");
  if (!mapCtx || !traceCtx) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--r-accent").trim() || "#00e699";
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--r-muted").trim() || "#a3b0ac";
  mapCtx.clearRect(0, 0, map.width, map.height);
  traceCtx.clearRect(0, 0, trace.width, trace.height);
  const drawLoop = (scale: number, color: string) => {
    mapCtx.beginPath();
    for (let i = 0; i < 80; i++) {
      const p = circle(i, 80, scale);
      const x = map.width / 2 + p.x * 90;
      const y = map.height / 2 + p.y * 90;
      if (i === 0) mapCtx.moveTo(x, y);
      else mapCtx.lineTo(x, y);
    }
    mapCtx.strokeStyle = color;
    mapCtx.lineWidth = 2;
    mapCtx.stroke();
  };
  drawLoop(1, accent);
  drawLoop(0.96, muted);
  traceCtx.beginPath();
  for (let i = 0; i < 80; i++) {
    const p = circle(i, 80, 1);
    const x = (i / 79) * trace.width;
    const y = trace.height - (p.speed / 70) * (trace.height - 20) - 8;
    if (i === 0) traceCtx.moveTo(x, y);
    else traceCtx.lineTo(x, y);
  }
  traceCtx.strokeStyle = accent;
  traceCtx.lineWidth = 2;
  traceCtx.stroke();
}

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
    mark.className = "font-mono text-r-accent";
    mark.textContent = item.done ? "✓" : "○";
    li.append(mark, document.createTextNode(item.label));
    list.append(li);
  }
}

function paintOverlays(): void {
  const rel = document.getElementById("ovRelative");
  const standings = document.getElementById("ovStandings");
  const delta = document.getElementById("ovDelta");
  const fuel = document.getElementById("ovFuel");
  const tyres = document.getElementById("ovTyres");
  const canvas = document.getElementById("ovInputs") as HTMLCanvasElement | null;
  if (rel && !rel.dataset.live) rel.textContent = "Relativo\nEsperando sesión de iRacing\n— tú\n\nTelemetría en memoria SDK";
  if (standings && !standings.dataset.live) standings.textContent = "Clasificación\nP3  coche 4\nP4  tú\nP5  coche 8";
  if (delta && !delta.dataset.live) delta.textContent = "0 km/h · Neutral";
  if (fuel && !fuel.dataset.live) fuel.textContent = "Telemetría iRacing\nSDK en modo solo lectura\nConecta al simulador para ver datos";
  if (tyres && !tyres.dataset.live) tyres.textContent = "Acelerador: 0%\nFreno: 0%";
  if (!canvas || canvas.dataset.live) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  drawInputsCanvas(canvas, { t: 0, dist: 0, speed: 0, throttle: 0, brake: 0, gear: 0, steering: 0 });
}

export function updateLiveOverlay(sample: LiveSample): void {
  const rel = document.getElementById("ovRelative");
  const delta = document.getElementById("ovDelta");
  const fuel = document.getElementById("ovFuel");
  const tyres = document.getElementById("ovTyres");
  const canvas = document.getElementById("ovInputs") as HTMLCanvasElement | null;
  const kmh = Math.round(sample.speed * 3.6);
  const gear = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);

  if (delta) {
    delta.dataset.live = "1";
    delta.textContent = `${kmh} km/h  ·  Marcha ${gear}`;
  }
  if (rel) {
    rel.dataset.live = "1";
    rel.textContent = `iRacing en directo\nVelocidad: ${kmh} km/h\nMarcha: ${gear}\nDistancia: ${Math.round(sample.dist)} m\nVolante: ${(sample.steering * 57.2958).toFixed(1)}°`;
  }
  if (fuel) {
    fuel.dataset.live = "1";
    const mins = Math.floor(sample.t / 60);
    const secs = Math.floor(sample.t % 60);
    fuel.textContent = `Telemetría SDK activa\nTiempo: ${mins}m ${secs.toString().padStart(2, "0")}s\nConexión: Memoria compartida`;
  }
  if (tyres) {
    tyres.dataset.live = "1";
    tyres.textContent = `Acelerador: ${Math.round(sample.throttle * 100)}%\nFreno: ${Math.round(sample.brake * 100)}%`;
  }
  if (canvas) {
    canvas.dataset.live = "1";
    drawInputsCanvas(canvas, sample);
  }
}

function drawInputsCanvas(canvas: HTMLCanvasElement, sample: LiveSample): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "rgba(10, 15, 13, 0.9)";
  ctx.fillRect(0, 0, w, h);

  // Throttle bar
  const barH = 55;
  const barY = 12;
  const thrH = Math.max(0, Math.min(1, sample.throttle)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(16, barY, 18, barH);
  ctx.fillStyle = "#00e699";
  ctx.fillRect(16, barY + barH - thrH, 18, thrH);

  ctx.font = "9px monospace";
  ctx.fillStyle = "#a0aba6";
  ctx.textAlign = "center";
  ctx.fillText("GAS", 25, barY + barH + 14);

  // Brake bar
  const brkH = Math.max(0, Math.min(1, sample.brake)) * barH;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(44, barY, 18, barH);
  ctx.fillStyle = "#ff4757";
  ctx.fillRect(44, barY + barH - brkH, 18, brkH);

  ctx.fillText("BRK", 53, barY + barH + 14);

  // Steering gauge
  const stX = 80;
  const stW = 100;
  const stMid = stX + stW / 2;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(stX, barY + 18, stW, 8);
  // Center mark
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(stMid - 1, barY + 14, 2, 16);
  // Steering pip
  const steerDeg = sample.steering * 57.2958;
  const steerNorm = Math.max(-1, Math.min(1, steerDeg / 90));
  const pipX = stMid + steerNorm * (stW / 2 - 4);
  ctx.fillStyle = "#00d2ff";
  ctx.fillRect(pipX - 3, barY + 14, 6, 16);

  ctx.fillText(`VOL ${steerDeg >= 0 ? "+" : ""}${steerDeg.toFixed(0)}°`, stMid, barY + barH + 14);

  // Gear & Speed display
  const gear = sample.gear === -1 ? "R" : sample.gear === 0 ? "N" : String(sample.gear);
  const kmh = Math.round(sample.speed * 3.6);
  ctx.font = "bold 26px monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(gear, 235, 40);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#00e699";
  ctx.fillText(`${kmh} km/h`, 235, 62);
}

function paintTeam(settings: Settings): void {
  const team = document.getElementById("teamBody");
  const review = document.getElementById("reviewBody");
  if (team) {
    team.textContent = settings.modules.team
      ? "El interruptor está encendido, pero el token de escritorio no tiene un contrato público con la sala del paddock. No se muestra una lista de pilotos inventada."
      : "Presencia de pilotos: pendiente. La web ya tiene el paddock; MMT Sync no lo consulta hasta que el API lo documente para este token.";
  }
  if (review) {
    review.textContent = settings.modules.reviewAlerts
      ? "Avisos de revisión encendidos, sin endpoint todavía. No hay aprobaciones que mostrar."
      : "El aviso de «setup aprobado» está apagado hasta que exista el endpoint.";
  }
}

function paintFlags(settings: Settings): void {
  const host = document.getElementById("moduleFlags");
  if (!host) return;
  const rows: [keyof Settings["modules"], string][] = [
    ["overlays", "Overlays en pista"],
    ["analysis", "Análisis de .ibt"],
    ["weekly", "Vista de la semana"],
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
    if (item.status === "optimal") {
      badge.className += "bg-r-accent/10 text-r-accent border border-r-accent/30";
      badge.textContent = "✓ Óptimo";
    } else if (item.status === "recommended") {
      badge.className += "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30";
      badge.textContent = "⚡ Recomendado";
    } else {
      badge.className += "bg-red-500/10 text-red-400 border border-red-500/30";
      badge.textContent = "⚠ Atención";
    }

    top.append(titleGroup, badge);

    const desc = document.createElement("p");
    desc.className = "text-xs text-r-muted leading-relaxed font-sans";
    desc.textContent = item.explanation;

    const values = document.createElement("div");
    values.className = "mt-1 flex flex-wrap gap-4 text-xs font-mono bg-r-bg/50 p-2.5 rounded-xl border border-r-line/50";
    values.innerHTML = `
      <div><span class="text-r-muted">Actual:</span> <strong class="text-r-text">${item.currentValue}</strong></div>
      <div><span class="text-r-muted">Recomendado:</span> <strong class="text-r-accent">${item.recommendedValue}</strong></div>
    `;

    card.append(top, desc, values);
    list.append(card);
  }
}
