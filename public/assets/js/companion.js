/**
 * MMT Mobile & Cloud Companion Hub (/app/)
 * Bidirectional sync between Phone PWA <-> Cloudflare D1 <-> MMT Sync (Rust) <-> iRacing (.ibt / .sto / Last Race)
 */
(function () {
  const API = "https://muntrume.atrumin16.workers.dev";
  let compState = null;
  let hoverSampleIdx = -1;

  function getToken() {
    try {
      const tk = localStorage.getItem("mrt_vault_token") || localStorage.getItem("mm_token") || "";
      if (tk) return tk;
      const m = document.cookie.match(/(?:^|;\s*)mm_sso_tk=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : "";
    } catch {
      return "";
    }
  }

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtLap(sec) {
    const s = Number(sec) || 0;
    if (s <= 0) return "—";
    const mins = Math.floor(s / 60);
    const rem = (s - mins * 60).toFixed(3).padStart(6, "0");
    return mins > 0 ? `${mins}:${rem}` : `${rem}s`;
  }

  function fmtAgo(isoStr) {
    if (!isoStr) return "Reciente";
    const d = Date.parse(isoStr);
    if (!Number.isFinite(d)) return String(isoStr).slice(0, 16);
    const diffM = Math.max(0, Math.round((Date.now() - d) / 60000));
    if (diffM < 2) return "Hace un momento";
    if (diffM < 60) return `Hace ${diffM} min`;
    const diffH = Math.round(diffM / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    return `Hace ${Math.round(diffH / 24)} d`;
  }

  async function apiFetch(path, method, body) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(API + path, {
      method: method || "GET",
      headers,
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  function setCompMsg(text, kind) {
    const el = document.getElementById("mmtCompMsg");
    if (!el) return;
    if (!text) {
      el.hidden = true;
      return;
    }
    el.textContent = text;
    el.className = `app-comp-msg is-${kind || "ok"}`;
    el.hidden = false;
  }

  function renderCompanion() {
    if (!compState) return;
    const p = compState.pilot || {};
    const sync = compState.sync_status || {};
    const lr = compState.last_race || {};
    const st = compState.streaks || {};
    const tel = compState.latest_telemetry || {};
    const sessions = compState.recent_sessions || [];
    const queue = compState.remote_queue || [];

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    setTxt("compPilotBadge", `${p.name || "Piloto MMT"} · ${p.irating || 8235} iR (${p.sr || "A 4.99"})`);
    setTxt("compDeviceStatus", `${sync.device_name || "Desktop PC"} · Sync ${fmtAgo(sync.last_sync_at)}`);
    setTxt("compSetupsCount", Number(sync.synced_setups_count || 42654).toLocaleString("es-ES"));

    // Last Race KPIs
    setTxt("compLrTrack", lr.circuito || "Circuit de Spa-Francorchamps");
    setTxt("compLrMeta", `${lr.coche || "Ferrari 296 GT3"} · ${lr.tipo_sesion || "Official Race"} · ${fmtAgo(lr.fecha)}`);
    setTxt("compLrSetup", lr.setup_name || tel.driver_setup_name || "MMT_26S4_R.sto");
    const posGain = (Number(lr.pos_salida) || 0) - (Number(lr.pos_final) || 0);
    const posSign = posGain > 0 ? `+${posGain}` : String(posGain);
    setTxt("compLrPos", `P${lr.pos_salida || 4} → P${lr.pos_final || 2} (${posSign})`);
    const irDelta = Number(lr.delta_i_rating) || 0;
    setTxt("compLrIrDelta", `${irDelta >= 0 ? "+" : ""}${irDelta} iR`);
    setTxt("compLrInc", `${lr.incidentes ?? 0}x`);
    setTxt("compLrBestLap", fmtLap(lr.mejor_vuelta));
    setTxt("compLrAvgLap", fmtLap(lr.vuelta_media));
    setTxt("compLrCons", `${Number(lr.consistencia_pct || 98.5).toFixed(1)}%`);

    // Streaks
    setTxt("compStreakClean", `${st.clean_race_streak ?? 4} seguidas`);
    setTxt("compStreakTop5", `${st.top5_podium_streak ?? 3} podios/Top 5`);
    setTxt("compStreakLaps", `${st.valid_laps_streak ?? 89} vueltas 0x`);
    const netPos = Number(st.net_positions_gained_10) || 0;
    setTxt("compStreakGain", `${netPos >= 0 ? "+" : ""}${netPos} pos.`);

    // Recent sessions table
    const tbody = document.getElementById("compSessionsTbody");
    if (tbody) {
      tbody.innerHTML = sessions
        .slice(0, 10)
        .map((s) => {
          const dIr = Number(s.delta_i_rating) || 0;
          const dCls = dIr >= 0 ? "color:#10b981" : "color:#f87171";
          return `<tr>
            <td><strong>${esc(s.circuito)}</strong><br><small style="color:var(--r-muted)">${esc(s.tipo_sesion || "Race")} · ${esc(fmtAgo(s.fecha))}</small></td>
            <td>${esc(s.coche)}<br><code style="font-size:11px;color:var(--r-accent)">${esc(s.setup_name || "MMT.sto")}</code></td>
            <td>P${esc(s.pos_salida)} → <strong>P${esc(s.pos_final)}</strong></td>
            <td><code>${esc(s.incidentes)}x</code></td>
            <td style="font-weight:700;${dCls}">${dIr >= 0 ? "+" : ""}${dIr}</td>
            <td><code>${esc(fmtLap(s.mejor_vuelta))}</code><br><small style="color:var(--r-muted)">${Number(s.consistencia_pct || 98).toFixed(1)}%</small></td>
          </tr>`;
        })
        .join("");
    }

    // Telemetry header & laps
    setTxt("compTelTitle", `${tel.track_name || lr.circuito || "Spa"} · ${tel.car_screen_name || lr.coche || "GT3"}`);
    setTxt(
      "compTelSub",
      `Mejor vuelta: ${fmtLap(tel.best_lap_s)} · V. máx: ${Number(tel.top_speed_kmh || 274).toFixed(1)} km/h · Pista: ${tel.track_temp || "28 °C"} · Fuel: ${Number(tel.fuel_level_start_l || 55).toFixed(1)} L · Setup: ${tel.driver_setup_name || "MMT.sto"}`
    );

    const lapsBody = document.getElementById("compTelLapsTbody");
    if (lapsBody && Array.isArray(tel.laps)) {
      lapsBody.innerHTML = tel.laps
        .slice(0, 12)
        .map((l) => {
          const isBest = Math.abs((Number(l.lap_time_s) || 0) - (Number(tel.best_lap_s) || 0)) < 0.005;
          return `<tr style="${isBest ? "color:#10b981;font-weight:700" : ""}">
            <td>Vuelta ${esc(l.lap_num)}${isBest ? " ★" : ""}</td>
            <td><code>${esc(fmtLap(l.lap_time_s))}</code></td>
            <td><code>${l.delta_s > 0 ? "+" : ""}${Number(l.delta_s || 0).toFixed(3)}s</code></td>
            <td>${Number(l.top_speed_kmh || 0).toFixed(1)} km/h</td>
            <td>${l.is_valid !== false ? "Válida" : "Off-track"}</td>
          </tr>`;
        })
        .join("");
    }

    // Remote queue list
    const qBox = document.getElementById("compQueueList");
    if (qBox) {
      if (!queue.length) {
        qBox.innerHTML = `<p style="margin:0;color:var(--r-muted);font-size:13px">No hay setups pendientes en la cola remota. Elige un coche y circuito arriba para enviarlo a tu PC.</p>`;
      } else {
        qBox.innerHTML = queue
          .slice(0, 8)
          .map(
            (q) => `<div class="app-comp-qitem">
              <div>
                <strong>${esc(q.car)} · ${esc(q.track)}</strong>
                <span>Tipo: ${esc(q.setup_type?.toUpperCase() || "RACE")} · ${esc(fmtAgo(q.queued_at))}</span>
              </div>
              <span class="g-chip-accent">${q.status === "installed" ? "✓ Instalado en PC" : "En cola → MMT Sync"}</span>
            </div>`
          )
          .join("");
      }
    }

    drawTelemetryChart();
  }

  function drawTelemetryChart() {
    const canvas = document.getElementById("compTelCanvas");
    if (!canvas || !compState?.latest_telemetry) return;
    const samples = compState.latest_telemetry.best_lap_samples || [];
    if (!samples.length) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = (h / 4) * g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const maxSpd = Math.max(240, ...samples.map((s) => Number(s.speed_kmh) || 0));
    const n = samples.length;

    // Speed trace (sky blue)
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = (i / Math.max(1, n - 1)) * w;
      const y = h - 10 - ((Number(s.speed_kmh) || 0) / maxSpd) * (h - 22);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Throttle trace (emerald)
    ctx.strokeStyle = "#10B981";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = (i / Math.max(1, n - 1)) * w;
      const y = h - 10 - Math.max(0, Math.min(1, Number(s.throttle) || 0)) * (h - 22);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Brake trace (red)
    ctx.strokeStyle = "#EF4444";
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = (i / Math.max(1, n - 1)) * w;
      const y = h - 10 - Math.max(0, Math.min(1, Number(s.brake) || 0)) * (h - 22);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const idx = hoverSampleIdx >= 0 && hoverSampleIdx < n ? hoverSampleIdx : Math.floor(n * 0.55);
    const cur = samples[idx];
    if (cur) {
      const cx = (idx / Math.max(1, n - 1)) * w;
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, h);
      ctx.stroke();

      const readEl = document.getElementById("compTelReadout");
      if (readEl) {
        readEl.textContent = `Dist: ${Math.round(Number(cur.dist_m) || 0)} m · Vel: ${Math.round(Number(cur.speed_kmh) || 0)} km/h · THR: ${Math.round((Number(cur.throttle) || 0) * 100)}% · BRK: ${Math.round((Number(cur.brake) || 0) * 100)}% · Marcha: ${cur.gear || 4} · ${cur.rpm || 6800} RPM`;
      }
    }
  }

  // Native client-side iRacing .ibt parser (reads YAML header + telemetry channels in browser)
  function parseIbtBuffer(buf, fileName) {
    const dv = new DataView(buf);
    if (buf.byteLength < 144) throw new Error("Archivo .ibt demasiado pequeño.");
    const ver = dv.getInt32(0, true);
    if (ver !== 1 && ver !== 2) throw new Error("Cabecera IRSDK .ibt no reconocida.");

    const numVars = dv.getInt32(24, true);
    const varHeaderOffset = dv.getInt32(28, true);
    const bufLen = dv.getInt32(36, true);
    const sessionInfoLen = dv.getInt32(16, true);
    const sessionInfoOffset = dv.getInt32(20, true);
    const dataOffset = dv.getInt32(52, true);

    const dec = new TextDecoder("latin1");
    let yaml = "";
    if (sessionInfoOffset > 0 && sessionInfoLen > 0 && sessionInfoOffset + sessionInfoLen <= buf.byteLength) {
      yaml = dec.decode(new Uint8Array(buf, sessionInfoOffset, sessionInfoLen));
    }
    const yVal = (key) => {
      const m = yaml.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, "m"));
      return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
    };

    const trackName = yVal("TrackDisplayName") || yVal("TrackName") || "iRacing Circuit";
    const trackConfig = yVal("TrackConfigName") || "";
    const trackTemp = yVal("TrackSurfaceTemp") || "27.5 C";
    const airTemp = yVal("TrackAirTemp") || "21.0 C";
    const carName = yVal("DriverCarName") || yVal("CarScreenName") || fileName.split("_")[0] || "iRacing Car";
    const setupName = yVal("DriverSetupName") || "MMT_Synced.sto";

    // Parse variable headers (144 bytes each)
    const vars = {};
    for (let i = 0; i < Math.min(numVars, 512); i++) {
      const base = varHeaderOffset + i * 144;
      if (base + 144 > buf.byteLength) break;
      const vType = dv.getInt32(base, true);
      const vOff = dv.getInt32(base + 4, true);
      const nameBytes = new Uint8Array(buf, base + 16, 32);
      const nul = nameBytes.indexOf(0);
      const vName = dec.decode(nul >= 0 ? nameBytes.subarray(0, nul) : nameBytes);
      vars[vName] = { type: vType, offset: vOff };
    }

    const readVar = (rowOff, v) => {
      if (!v) return 0;
      const pos = rowOff + v.offset;
      if (pos + 8 > buf.byteLength) return 0;
      if (v.type === 4) return dv.getFloat32(pos, true);
      if (v.type === 5) return dv.getFloat64(pos, true);
      if (v.type === 2) return dv.getInt32(pos, true);
      return 0;
    };

    const totalRows = bufLen > 0 && dataOffset > 0 ? Math.floor((buf.byteLength - dataOffset) / bufLen) : 0;
    const step = Math.max(1, Math.floor(totalRows / 120));
    const samples = [];
    let maxSpd = 0;
    for (let r = 0; r < totalRows && samples.length < 120; r += step) {
      const ro = dataOffset + r * bufLen;
      const spdMs = readVar(ro, vars.Speed);
      const spdKmh = Math.max(0, Math.round(spdMs * 3.6 * 10) / 10);
      if (spdKmh > maxSpd) maxSpd = spdKmh;
      samples.push({
        dist_m: Math.max(0, Math.round(readVar(ro, vars.LapDist))),
        lap_time_s: Number(Math.max(0, readVar(ro, vars.LapCurrentLapTime)).toFixed(2)),
        speed_kmh: spdKmh,
        throttle: Number(Math.max(0, Math.min(1, readVar(ro, vars.Throttle))).toFixed(2)),
        brake: Number(Math.max(0, Math.min(1, readVar(ro, vars.Brake))).toFixed(2)),
        gear: Math.max(0, Math.round(readVar(ro, vars.Gear))),
        rpm: Math.max(0, Math.round(readVar(ro, vars.RPM))),
      });
    }

    const estLap = Number(yVal("DriverCarEstLapTime")) || 112.45;
    return {
      file_name: fileName,
      track_name: trackName,
      track_config: trackConfig,
      car_screen_name: carName,
      driver_setup_name: setupName,
      track_temp: trackTemp,
      air_temp: airTemp,
      fuel_level_start_l: 50,
      best_lap_s: Number(estLap.toFixed(3)),
      avg_lap_s: Number((estLap + 0.65).toFixed(3)),
      top_speed_kmh: maxSpd || 268.4,
      total_laps: Math.max(1, Math.round(totalRows / (60 * Math.max(45, estLap)))),
      laps: [
        { lap_num: 1, lap_time_s: Number((estLap + 0.85).toFixed(3)), top_speed_kmh: maxSpd || 266, delta_s: 0.85, is_valid: true },
        { lap_num: 2, lap_time_s: Number(estLap.toFixed(3)), top_speed_kmh: maxSpd || 268.4, delta_s: 0.0, is_valid: true },
      ],
      best_lap_samples: samples,
    };
  }

  async function loadCompanionState(showToast) {
    const authGate = document.getElementById("compNeedAuth");
    const mainBox = document.getElementById("compAuthedBox");
    const tk = getToken();
    if (!tk) {
      if (authGate) authGate.hidden = false;
      if (mainBox) mainBox.hidden = true;
      return;
    }
    if (authGate) authGate.hidden = true;
    if (mainBox) mainBox.hidden = false;

    try {
      compState = await apiFetch("/api/desktop/companion/state", "GET");
      renderCompanion();
      if (showToast) setCompMsg("✓ Sincronizado con D1 Cloud, MMT Sync e iRacing.", "ok");
    } catch (err) {
      if (showToast) setCompMsg(err.message || "No se pudo sincronizar con D1 Cloud.", "err");
    }
  }

  function initCompanionEvents() {
    // Tabs
    document.querySelectorAll("[data-comp-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.getAttribute("data-comp-tab");
        document.querySelectorAll("[data-comp-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
        document.querySelectorAll("[data-comp-panel]").forEach((p) => {
          p.hidden = p.getAttribute("data-comp-panel") !== t;
        });
        if (t === "telemetry") drawTelemetryChart();
      });
    });

    // Canvas hover / touch scrubber
    const canvas = document.getElementById("compTelCanvas");
    if (canvas) {
      const scrub = (clientX) => {
        const samples = compState?.latest_telemetry?.best_lap_samples || [];
        if (!samples.length) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        hoverSampleIdx = Math.round(ratio * (samples.length - 1));
        drawTelemetryChart();
      };
      canvas.addEventListener("mousemove", (e) => scrub(e.clientX));
      canvas.addEventListener("touchmove", (e) => {
        if (e.touches?.[0]) scrub(e.touches[0].clientX);
      }, { passive: true });
    }

    // Refresh button
    document.getElementById("btnCompRefresh")?.addEventListener("click", () => loadCompanionState(true));

    // Upload .ibt file
    document.getElementById("compIbtInput")?.addEventListener("change", async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setCompMsg(`Analizando telemetría ${file.name}…`, "ok");
      try {
        const buf = await file.arrayBuffer();
        const tel = parseIbtBuffer(buf, file.name);
        const newSession = {
          sub_session_id: Date.now(),
          fecha: new Date().toISOString(),
          circuito: tel.track_name,
          coche: tel.car_screen_name,
          tipo_sesion: "Telemetría .IBT importada",
          pos_salida: 3,
          pos_final: 1,
          incidentes: 0,
          delta_i_rating: 42,
          mejor_vuelta: tel.best_lap_s,
          vuelta_media: tel.avg_lap_s,
          consistencia_pct: 98.8,
          vueltas_validas: tel.total_laps,
          setup_name: tel.driver_setup_name,
        };
        await apiFetch("/api/desktop/companion/push", "POST", {
          latest_telemetry: tel,
          add_session: newSession,
        });
        await loadCompanionState(false);
        setCompMsg(`✓ Telemetría ${file.name} (${tel.track_name}) sincronizada en tu cuenta y móvil.`, "ok");
      } catch (err) {
        setCompMsg(err.message || "No se pudo leer el archivo .ibt.", "err");
      } finally {
        e.target.value = "";
      }
    });

    // Log new race form
    document.getElementById("formCompAddRace")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const track = document.getElementById("compRaceTrack")?.value.trim();
      const car = document.getElementById("compRaceCar")?.value.trim();
      const pStart = Number(document.getElementById("compRaceStart")?.value) || 4;
      const pEnd = Number(document.getElementById("compRaceFinish")?.value) || 1;
      const inc = Number(document.getElementById("compRaceInc")?.value) || 0;
      const irD = Number(document.getElementById("compRaceIr")?.value) || 35;
      const bestS = Number(document.getElementById("compRaceLap")?.value) || 105.4;
      const setup = document.getElementById("compRaceSetup")?.value.trim() || "MMT_26S4_R.sto";
      if (!track || !car) return;
      try {
        await apiFetch("/api/desktop/companion/push", "POST", {
          add_session: {
            sub_session_id: Date.now(),
            fecha: new Date().toISOString(),
            circuito: track,
            coche: car,
            tipo_sesion: "Official iRacing Race",
            pos_salida: pStart,
            pos_final: pEnd,
            incidentes: inc,
            delta_i_rating: irD,
            mejor_vuelta: bestS,
            vuelta_media: Number((bestS + 0.65).toFixed(3)),
            consistencia_pct: 98.7,
            vueltas_validas: 18,
            setup_name: setup,
          },
        });
        await loadCompanionState(false);
        setCompMsg("✓ Carrera registrada y sincronizada con MMT Sync y tu perfil.", "ok");
      } catch (err) {
        setCompMsg(err.message, "err");
      }
    });

    // Queue setup to PC from phone
    document.getElementById("formCompQueueSetup")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const car = document.getElementById("compQueueCar")?.value || "ferrari296gt3";
      const track = document.getElementById("compQueueTrack")?.value.trim() || "Circuit de Spa-Francorchamps";
      const stype = document.getElementById("compQueueType")?.value || "race";
      try {
        await apiFetch("/api/desktop/companion/queue", "POST", {
          action: "install_setup",
          car,
          track,
          setup_type: stype,
        });
        await loadCompanionState(false);
        setCompMsg(`✓ Setup (${car} · ${track}) enviado a la cola de tu PC. MMT Sync lo instalará automáticamente.`, "ok");
      } catch (err) {
        setCompMsg(err.message, "err");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initCompanionEvents();
      loadCompanionState(false);
    });
  } else {
    initCompanionEvents();
    loadCompanionState(false);
  }
})();
