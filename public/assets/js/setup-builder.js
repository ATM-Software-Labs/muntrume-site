/* Montador de setups. Contrato visto en el cliente: POST JSON con Bearer,
   igual que /api/setups/download. El Worker público aún responde
   "Ruta no encontrada" en /api/setups/ai/build; el cuerpo usa los nombres
   del encargo (mode, car, track, sessions) y también circuit / setup_types,
   que es el vocabulario del catálogo. */
(function () {
  "use strict";
  var API = "https://muntrume.atrumin16.workers.dev";
  var SESSIONS = [
    { id: "qualy", type: "Qualy" },
    { id: "race", type: "Race" },
    { id: "wet", type: "Wet" },
    { id: "endurance", type: "Endurance" }
  ];
  var last = null;

  function $(id) { return document.getElementById(id); }
  function lang() { return (window.muntruI18n && window.muntruI18n.lang) || document.documentElement.lang || "es"; }
  function session() {
    var token = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token");
    var raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
    if (!token || !raw) return null;
    try {
      var user = JSON.parse(raw);
      if (!user || user.role === "guest") return null;
      return { token: token, user: user };
    } catch (e) { return null; }
  }
  function notice(severity, title, message) {
    if (window.muntruNotice) window.muntruNotice.show({ severity: severity, title: title, message: message || "", source: "builder" });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function safeUrl(url) {
    var u = String(url || "");
    if (u.charAt(0) === "/" && u.charAt(1) !== "/") return u;
    if (/^https?:\/\//i.test(u)) return u;
    return "";
  }
  function markdown(src) {
    var text = esc(src || "").replace(/\r\n/g, "\n");
    var blocks = text.split(/\n{2,}/);
    return blocks.map(function (block) {
      var lines = block.split("\n");
      if (/^```/.test(lines[0])) {
        var code = lines.slice(1).join("\n").replace(/```$/, "");
        return "<pre><code>" + code + "</code></pre>";
      }
      if (lines.every(function (l) { return /^[-*] /.test(l); })) {
        return "<ul>" + lines.map(function (l) { return "<li>" + inline(l.replace(/^[-*] /, "")) + "</li>"; }).join("") + "</ul>";
      }
      if (/^### /.test(lines[0])) return "<h3>" + inline(lines[0].slice(4)) + "</h3>";
      if (/^## /.test(lines[0])) return "<h2>" + inline(lines[0].slice(3)) + "</h2>";
      return "<p>" + lines.map(inline).join("<br>") + "</p>";
    }).join("");
  }
  function inline(s) {
    return s
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
        var ok = safeUrl(href);
        return ok ? '<a href="' + esc(ok) + '">' + label + "</a>" : label;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  function reduced() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function selectedSessions() {
    return Array.prototype.map.call(document.querySelectorAll("#builderSessions [aria-pressed='true']"), function (b) {
      return b.getAttribute("data-session");
    }).filter(Boolean);
  }
  function payload() {
    var car = ($("builderCar") && $("builderCar").value) || "";
    var track = ($("builderTrack") && $("builderTrack").value) || "";
    var carText = ($("builderCarText") && $("builderCarText").value.trim()) || "";
    var trackText = ($("builderTrackText") && $("builderTrackText").value.trim()) || "";
    var sessions = selectedSessions();
    var types = SESSIONS.filter(function (s) { return sessions.indexOf(s.id) >= 0; }).map(function (s) { return s.type; });
    return {
      mode: "setup_builder",
      car: car,
      track: track || trackText,
      circuit: track || trackText,
      car_query: carText,
      track_query: trackText,
      sessions: sessions,
      setup_types: types,
      language: lang(),
      stream: true
    };
  }
  function fillSelect(sel, values, labels) {
    if (!sel || sel.options.length > 1) return;
    var current = sel.value;
    values.forEach(function (v) {
      var opt = document.createElement("option");
      opt.value = v;
      opt.textContent = (labels && labels[v]) || v;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }
  function syncGate() {
    var on = !!session();
    var gate = $("builderGate");
    var form = $("builderForm");
    if (gate) gate.hidden = on;
    if (form) form.hidden = !on;
  }
  function renderSources(sources) {
    var box = $("builderSources");
    if (!box) return;
    box.innerHTML = "";
    (sources || []).forEach(function (s) {
      var a = document.createElement("a");
      a.className = "g-chip";
      a.href = "/garage/#setup-" + encodeURIComponent(s.id == null ? "" : s.id);
      a.textContent = [s.car, s.track || s.circuit, s.session].filter(Boolean).join(" · ");
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        if (window.switchGarageTab) window.switchGarageTab("setups");
        var search = $("searchInput");
        if (search && (s.track || s.circuit)) {
          search.value = s.track || s.circuit;
          if (window.onSearchInput) window.onSearchInput();
        }
        if (s.id != null && window.openSetupPreviewById) window.openSetupPreviewById(Number(s.id), "");
      });
      box.appendChild(a);
    });
  }
  function showAnswer(text, sources) {
    var out = $("builderAnswer");
    if (!out) return;
    var html = markdown(text);
    var reduce = reduced();
    out.innerHTML = "";
    out.hidden = false;
    if (reduce) { out.innerHTML = html; }
    else {
      var parts = html.split(/(?<=[.!?])\s+/);
      var i = 0;
      (function step() {
        out.innerHTML = parts.slice(0, i + 1).join(" ");
        i += 1;
        if (i < parts.length) setTimeout(step, 280);
      })();
    }
    renderSources(sources);
    var dl = $("builderDownload");
    if (dl) dl.hidden = !(sources && sources.length);
  }
  function readAnswer(data) {
    var text = data.markdown || data.answer || data.result || "";
    var sources = Array.isArray(data.sources) ? data.sources : [];
    last = { text: text, sources: sources, body: payload() };
    if (!sources.length) {
      notice("warning", "No hay un setup que coincida", "No se adjunta ningún archivo.");
      var dl = $("builderDownload");
      if (dl) dl.hidden = true;
    }
    showAnswer(String(text), sources);
  }
  async function readStream(res) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    var acc = "";
    var out = $("builderAnswer");
    if (out) { out.hidden = false; out.textContent = ""; }
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop();
      lines.forEach(function (line) {
        var t = line.trim();
        if (t.indexOf("data:") !== 0) return;
        var raw = t.slice(5).trim();
        if (!raw || raw === "[DONE]") return;
        try {
          var json = JSON.parse(raw);
          acc += json.content || "";
        } catch (e) { acc += raw; }
      });
      if (out) out.innerHTML = markdown(acc);
    }
    last = { text: acc, sources: [], body: payload() };
  }
  async function build(ev) {
    ev.preventDefault();
    var auth = session();
    if (!auth) { notice("warning", "Hace falta la cuenta de piloto", "Entra para pedir un montaje."); if (window.openAuthModal) window.openAuthModal("login"); return; }
    var body = payload();
    if (!body.car && !body.car_query) { notice("warning", "Falta el coche", "Elige uno del catálogo o escríbelo."); return; }
    if (!body.track && !body.track_query) { notice("warning", "Falta el circuito", "Elige uno del catálogo o escríbelo."); return; }
    if (!body.sessions.length) { notice("warning", "Elige al menos una sesión", "Qualy, carrera, mojado o endurance."); return; }
    var btn = $("builderSubmit");
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }
    try {
      var res = await fetch(API + "/api/setups/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth.token, "Accept": "text/event-stream, application/json" },
        body: JSON.stringify(body)
      });
      var type = res.headers.get("content-type") || "";
      if (type.indexOf("text/event-stream") >= 0 && res.ok && res.body) {
        await readStream(res);
        return;
      }
      var data = await res.json().catch(function () { return {}; });
      if (res.status === 401) { notice("error", "La sesión ha caducado", "Vuelve a entrar."); if (window.openAuthModal) window.openAuthModal("login"); return; }
      if (!res.ok || data.success === false) {
        notice("error", "No se pudo montar el setup", data.error || "El servicio todavía no responde.");
        return;
      }
      readAnswer(data);
    } catch (e) {
      notice("error", "Sin conexión", "No se pudo contactar con el montador.");
    } finally {
      if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); }
    }
  }
  function filename(res, sources) {
    var cd = res.headers.get("content-disposition") || "";
    var m = cd.match(/filename=\"?([^\";]+)\"?/i);
    if (m) return m[1];
    var one = sources && sources.length === 1;
    var car = (last && last.body && (last.body.car || last.body.car_query)) || "setup";
    var track = (last && last.body && (last.body.track || last.body.track_query)) || "circuito";
    var safe = function (s) { return String(s).replace(/[^\w.-]+/g, "_"); };
    return one ? safe(car) + "_" + safe(track) + ".sto" : "Muntrume_" + safe(car) + "_" + safe(track) + ".zip";
  }
  async function download() {
    var auth = session();
    if (!auth || !last || !last.sources || !last.sources.length) return;
    var ids = last.sources.map(function (s) { return s.id; }).filter(function (id) { return id != null; });
    var btn = $("builderDownload");
    if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); }
    try {
      var res = await fetch(API + "/api/setups/ai/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth.token },
        body: JSON.stringify({ ids: ids, sources: last.sources, car: last.body.car, track: last.body.track, circuit: last.body.circuit, sessions: last.body.sessions })
      });
      var type = res.headers.get("content-type") || "";
      if (type.indexOf("application/json") >= 0) {
        var data = await res.json().catch(function () { return {}; });
        notice("error", "No se pudo descargar", data.error || "El servidor no adjuntó el archivo.");
        return;
      }
      if (!res.ok) { notice("error", "No se pudo descargar", "Respuesta " + res.status + "."); return; }
      var blob = await res.blob();
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename(res, last.sources);
      document.body.appendChild(a);
      a.click();
      a.remove();
      notice("success", "Descarga lista", a.download);
    } catch (e) {
      notice("error", "Sin conexión", "No se pudo descargar el archivo.");
    } finally {
      if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); }
    }
  }
  function loadLists() {
    fetch("/assets/data/catalog_index.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (idx) {
      if (!idx) return;
      fillSelect($("builderCar"), idx.cars || []);
      fillSelect($("builderTrack"), idx.circuits || []);
    }).catch(function () {});
  }
  function init() {
    var form = $("builderForm");
    if (!form) return;
    form.addEventListener("submit", build);
    var dl = $("builderDownload");
    if (dl) dl.addEventListener("click", download);
    document.querySelectorAll("#builderSessions button").forEach(function (b) {
      b.addEventListener("click", function () {
        var on = b.getAttribute("aria-pressed") === "true";
        b.setAttribute("aria-pressed", on ? "false" : "true");
      });
    });
    loadLists();
    syncGate();
    document.addEventListener("muntrume-auth-change", syncGate);
  }
  window.muntruBuilderSync = syncGate;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
