/* Muntrume AI — Hybrid Open Source Engine (Verified Team KB + Live Streaming + Ollama + Smart Client Fallback) */
(function () {
  "use strict";
  var API = "https://muntrume.atrumin16.workers.dev/api/ai";
  var OLLAMA_API = "http://localhost:11434/api/chat";
  var STORE = "muntrume_ai_chats_session";
  var MD = "/assets/js/ai-md.js?v=t341";

  var kb = {};
  try {
    kb = JSON.parse((document.getElementById("muntrumeKbData") || {}).textContent || "{}");
  } catch (e) { kb = {}; }

  var SYSTEM_TEAM = [
    "Eres Muntrume AI, el ingeniero de pista y copiloto oficial de Muntrume Motorsport (Equipo MMT) en Sant Andreu, Barcelona.",
    "Pilotos oficiales: #16 Alberto Trujillo (alberto@muntru.me, Fundador, GT3/Endurance), #1 Mateo Berbis (mateo@muntru.me, GT3/Porsche Cup), #22 Eduardo Chongkan (admin@muntru.me, Endurance/Setup Engineering). Legal: legal@muntru.me.",
    "Herramientas Open Source (MIT): MMT Sync Overlay (/overlay/, <80 MB RAM, 60 FPS, Pit & Strategy Window, Tire & Track Temp Monitor, Presets Sprint GT3 / Endurance / Minimalist Qualy), Setup Vault (/garage/, .sto), Wallpapers (/wallpapers/) y Galería (/gallery/).",
    "Series: IMSA, GT Sprint/Endurance (Mustang GT3, Porsche 911 GT3 R 992, McLaren 720S GT3, Ferrari 296 GT3, Audi R8 LMS Evo II), NEC y Porsche Cup.",
    "Responde en Markdown claro y directo en el idioma del usuario."
  ].join("\n");

  var SYSTEM_ASSISTANT = "Eres Muntrume AI en modo Asistente Open Source general. Ayuda con programación, análisis técnico, redacción y dudas generales con claridad, precisión y formato Markdown limpio.";

  var stage = document.getElementById("aiStage");
  var emptyEl = document.getElementById("aiEmpty");
  var log = document.getElementById("aiLog");
  var form = document.getElementById("aiForm");
  var input = document.getElementById("aiInput");
  var sendBtn = document.getElementById("aiSend");
  var jumpBtn = document.getElementById("aiJump");
  var listEl = document.getElementById("aiChatList");
  var side = document.getElementById("aiSide");
  var sideOpen = document.getElementById("aiSideOpen");
  var sideClose = document.getElementById("aiSideClose");
  var scrim = document.getElementById("aiScrim");
  var statusBadge = document.getElementById("aiEngineStatus");
  var statusText = document.getElementById("aiStatusText");
  var ollamaBtn = document.getElementById("aiOllamaToggle");
  if (!stage || !log || !form || !input || !sendBtn) return;

  var currentMode = "team";
  var useOllama = false;
  var state = loadStore();
  var streaming = false;
  var ctrl = null;
  var mdLib = null;
  var mdLoading = null;
  var renderTimer = null;
  var pendingReply = null;
  var stickToEnd = true;

  function loadStore() {
    try {
      var raw = sessionStorage.getItem(STORE);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) return parsed;
      }
    } catch (e) {}
    return { active: "", items: [] };
  }
  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function current() {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === state.active) return state.items[i];
    return null;
  }

  function setMode(mode) {
    currentMode = mode === "assistant" ? "assistant" : "team";
    document.querySelectorAll("[data-ai-mode]").forEach(function (btn) {
      var on = btn.getAttribute("data-ai-mode") === currentMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (statusText && !streaming) {
      statusText.textContent = currentMode === "team" ? "KB + Open Source" : (useOllama ? "Ollama Local" : "Open Source Live");
    }
  }

  document.querySelectorAll("[data-ai-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-ai-mode")); });
  });

  if (ollamaBtn) {
    ollamaBtn.addEventListener("click", function () {
      useOllama = !useOllama;
      ollamaBtn.setAttribute("aria-pressed", useOllama ? "true" : "false");
      ollamaBtn.textContent = useOllama ? "Ollama Local: On" : "Ollama Local: Off";
      setMode(currentMode);
    });
  }

  function loadMd() {
    if (window.MuntrumeMarkdown && window.MuntrumeMarkdown.renderMarkdown) return Promise.resolve(window.MuntrumeMarkdown);
    if (mdLib) return Promise.resolve(mdLib);
    if (mdLoading) return mdLoading;
    mdLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = MD;
      s.onload = function () { mdLib = window.MuntrumeMarkdown || null; resolve(mdLib); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
    return mdLoading;
  }

  function renderPlainFallback(text) {
    var pre = document.createElement("div");
    pre.className = "ai-plain";
    pre.textContent = text;
    return pre;
  }

  function paintBotMessage(el, text) {
    var body = el.querySelector(".ai-mdhost");
    if (!body) return;
    if (!text) {
      body.innerHTML = '<div class="ai-dots"><i></i><i></i><i></i></div>';
      return;
    }
    if (window.MuntrumeMarkdown && window.MuntrumeMarkdown.renderMarkdown) {
      body.innerHTML = "";
      body.appendChild(window.MuntrumeMarkdown.renderMarkdown(text, { copy: "Copiar", copied: "¡Copiado!" }));
    } else {
      body.innerHTML = "";
      body.appendChild(renderPlainFallback(text));
      loadMd().then(function (lib) {
        if (lib && el.isConnected) {
          body.innerHTML = "";
          body.appendChild(lib.renderMarkdown(text, { copy: "Copiar", copied: "¡Copiado!" }));
        }
      });
    }
  }

  function scheduleRender(msg) {
    pendingReply = msg;
    if (renderTimer) return;
    renderTimer = requestAnimationFrame(function () {
      renderTimer = null;
      if (!pendingReply) return;
      var el = log.querySelector('[data-id="' + pendingReply.id + '"]');
      if (el) paintBotMessage(el, pendingReply.content);
    });
  }

  function makeTurn(msg) {
    var wrap = document.createElement("div");
    wrap.className = "ai-turn " + (msg.role === "user" ? "ai-turn--user" : "ai-turn--bot");
    wrap.setAttribute("data-id", msg.id);
    if (msg.role === "user") {
      var ub = document.createElement("div");
      ub.className = "ai-turn__body";
      var b = document.createElement("div");
      b.className = "ai-bubble";
      b.textContent = msg.content;
      ub.appendChild(b);
      wrap.appendChild(ub);
      return wrap;
    }
    var av = document.createElement("img");
    av.className = "ai-avatar";
    av.src = "/assets/img/icon-192.png";
    av.alt = "Muntrume AI";
    var bb = document.createElement("div");
    bb.className = "ai-turn__body";
    var host = document.createElement("div");
    host.className = "ai-mdhost";
    bb.appendChild(host);
    var acts = document.createElement("div");
    acts.className = "ai-actions";
    acts.hidden = !msg.content || (streaming && current() && current().messages[current().messages.length - 1].id === msg.id);
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ai-action";
    copyBtn.textContent = "Copiar";
    copyBtn.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(msg.content).catch(function () {});
      copyBtn.textContent = "¡Copiado!";
      setTimeout(function () { copyBtn.textContent = "Copiar"; }, 1500);
    });
    acts.appendChild(copyBtn);
    bb.appendChild(acts);
    wrap.appendChild(av);
    wrap.appendChild(bb);
    paintBotMessage(wrap, msg.content);
    return wrap;
  }

  function follow() {
    if (stickToEnd) stage.scrollTop = stage.scrollHeight;
  }

  function renderThread() {
    var chat = current();
    log.innerHTML = "";
    if (!chat || !chat.messages.length) {
      log.hidden = true;
      emptyEl.hidden = false;
      stage.classList.add("is-empty");
      return;
    }
    emptyEl.hidden = true;
    log.hidden = false;
    stage.classList.remove("is-empty");
    chat.messages.forEach(function (m) { log.appendChild(makeTurn(m)); });
    follow();
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!state.items.length) {
      var p = document.createElement("p");
      p.className = "ai-list__empty";
      p.textContent = "Sin conversaciones en esta sesión.";
      listEl.appendChild(p);
      return;
    }
    state.items.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "ai-chat";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-chat__open";
      btn.textContent = c.title || "Nueva conversación";
      if (c.id === state.active) btn.setAttribute("aria-current", "true");
      btn.addEventListener("click", function () {
        if (streaming) return;
        state.active = c.id;
        save();
        renderList();
        renderThread();
        closeSide();
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "ai-icon";
      del.textContent = "×";
      del.title = "Eliminar";
      del.addEventListener("click", function () {
        state.items = state.items.filter(function (x) { return x.id !== c.id; });
        if (state.active === c.id) state.active = state.items[0] ? state.items[0].id : "";
        save();
        renderList();
        renderThread();
      });
      row.appendChild(btn);
      row.appendChild(del);
      listEl.appendChild(row);
    });
  }

  function matchInstantTeamAnswer(q) {
    var s = q.toLowerCase();
    if (/(piloto|alberto|mateo|eduardo|dorsal|contacto|correo|email|equipo|muntrume)/.test(s) && !/(45\s*min|combustible|gasolina|fuel|overlay|instalo)/.test(s)) {
      var pilots = (kb.pilots || []).map(function (p) {
        return "- **" + p.dorsal + " " + p.name + "** — *" + p.role + "* (" + p.categories.join(", ") + ") · [" + p.email + "](mailto:" + p.email + ") · [Ver ficha](" + p.profileUrl + ")";
      }).join("\n");
      return [
        "### Pilotos Oficiales y Contacto · Muntrume Motorsport",
        "",
        pilots,
        "",
        "### Canales Oficiales",
        "- **Administración / Soporte / Prensa:** [admin@muntru.me](mailto:admin@muntru.me)",
        "- **Legal / Privacidad / DMCA:** [legal@muntru.me](mailto:legal@muntru.me)",
        "- **Discord Paddock:** [discord.gg/ehX6B8JUtE](https://discord.gg/ehX6B8JUtE)",
        "- **Telemetría Garage 61:** [Equipo Muntrume Motorsport](https://garage61.net/app/teams/muntrume-motorsport)"
      ].join("\n");
    }
    if (/(overlay|mmt\s*sync|instalo|hud|kapps|pit\s*window|tire\s*monitor|presiones\s*en\s*caliente)/.test(s)) {
      return [
        "### MMT Sync & Overlays (100 % Open Source · Licencia MIT)",
        "",
        "- **Rendimiento:** `< 80 MB` RAM y `60 FPS` acelerados por GPU, sin suscripciones ni pagos.",
        "- **Instalación rápida:**",
        "  1. Descarga el último instalador desde [GitHub Releases](https://github.com/ATM-Software-Labs/muntrume-site/releases/latest) o entra en [`/overlay/`](/overlay/).",
        "  2. Abre iRacing en **Modo Ventana sin bordes** (*Borderless*).",
        "  3. Pulsa **Poner Overlay Flotante** y elige un preset de 1 clic (**Sprint GT3**, **Endurance / Multiclase** o **Minimalist Qualy**).",
        "- **Módulos de carrera incluidos:**",
        "  - `Standings` compacto (`Top 3` por clase + ventana `±2`) y `Relative`",
        "  - `Pit & Strategy Window`: vuelta óptima de box (`Pit Window`), tiempo estimado y `Rejoin Pos`",
        "  - `Tire & Track Temp Monitor`: temperaturas `FL/FR/RL/RR` (`75–92°C` óptimo), presiones `kPa/PSI`, viento y lluvia",
        "  - Botón **Fijar / Bloquear HUD (`Lock HUD`)** para evitar movimientos accidentales en pista."
      ].join("\n");
    }
    if (/(45\s*min|combustible|gasolina|fuel|stint|estrategia|pit)/.test(s)) {
      return [
        "### Estrategia GT3 · Carrera de 45 minutos (iRacing)",
        "",
        "| Parámetro | Valor recomendado (referencia GT3) |",
        "|---|---|",
        "| Duración / Vueltas est. | `45 min` (~22–24 vueltas en circuito medio ~1:55) |",
        "| Consumo medio GT3 | `2.75 – 2.95 L/vuelta` |",
        "| Combustible total necesario | `~66 – 71 L` (+ `2.0 L` margen vuelta formación/cierre) |",
        "| Ventana de Box (`Pit Window`) | **Vueltas 10 – 13** (si el depósito está capado a ~50–60% en serie Sprint) |",
        "| Cambio de neumáticos | **No necesario** en `45 min` salvo lluvia o degradación extrema (`> 98°C`) |",
        "",
        "```text",
        "Fórmula rápida MMT:",
        "Litros totales = (45 min / Tiempo_vuelta_min) * Consumo_L_vuelta + 2.0 L",
        "```",
        "",
        "Puedes verlo calculado tick a tick dentro de [`/overlay/`](/overlay/) con el widget **Pit & Strategy Window**, o descargar reglajes de carrera en [`/garage/`](/garage/)."
      ].join("\n");
    }
    if (/(wallpaper|fondo|setup|\.sto|garage|serie|imsa|nec|pcc|pcup|galer[ií]a)/.test(s)) {
      return [
        "### Ecosistema Muntrume Motorsport",
        "",
        "- **Setups `.sto` ([`/garage/`](/garage/)):** Más de 42.654 reglajes organizados por serie y circuito (`IMSA`, `GT Sprint/Endurance`, `NEC`, `Porsche Cup`).",
        "- **Wallpapers HD ([`/wallpapers/`](/wallpapers/)):** Capturas reales en pista `16:9` y móvil `9:16 4K`, URL única por foto y script `Sincronizar_Monitores_20s.bat` sin admin.",
        "- **Overlay HUD ([`/overlay/`](/overlay/)):** Suite MIT a 60 FPS.",
        "- **Galería Paddock ([`/gallery/`](/gallery/)):** Capturas oficiales de competición."
      ].join("\n");
    }
    return null;
  }

  function buildSmartFallback(q) {
    var s = q.toLowerCase();
    if (/(subviraje|sobreviraje|understeer|oversteer|frenada|brake|presion|presión|camber|arb)/.test(s)) {
      return [
        "### Guía rápida de Setup iRacing (Ingeniería MMT)",
        "",
        "- **Subviraje en entrada:** baja `Brake Bias` (`-0.5%`), ablanda ARB delantera o sube `1 click` de altura trasera (*rake*).",
        "- **Sobreviraje en salida:** suaviza el mapa de acelerador / TC, ablanda ARB trasera o sube `diff preload`.",
        "- **Presiones en caliente GT3:** busca **165–175 kPa** (`24.0–25.4 PSI`) y ventana térmica **75–92°C** en el **Tire & Track Temp Monitor**.",
        "",
        "Explora nuestros `.sto` verificados en [`/garage/`](/garage/) o monitoriza presiones en [`/overlay/`](/overlay/)."
      ].join("\n");
    }
    return [
      "### Muntrume AI · Respuesta Local (Modo Resiliente)",
      "",
      "Ahora mismo el proveedor externo de streaming no está disponible o no tiene clave activa, pero aquí tienes acceso directo a nuestras herramientas y datos verificados:",
      "- **MMT Sync Overlay (MIT):** [`/overlay/`](/overlay/)",
      "- **Setup Vault (.sto):** [`/garage/`](/garage/)",
      "- **Wallpapers 4K & Multi-Monitor:** [`/wallpapers/`](/wallpapers/)",
      "- **Galería Oficial:** [`/gallery/`](/gallery/)",
      "",
      "Si quieres usar modelos **Llama 3 / Qwen** localmente con privacidad total, activa **Ollama Local** arriba (`http://localhost:11434`)."
    ].join("\n");
  }

  function takeSse(line) {
    var trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return "";
    var data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return null;
    var parsed = JSON.parse(data);
    if (parsed && typeof parsed.content === "string") return parsed.content;
    if (parsed && typeof parsed.delta === "string") return parsed.delta;
    return "";
  }

  async function readStreamAnswer(res, reply) {
    var cType = (res.headers.get("content-type") || "").toLowerCase();
    if (cType.indexOf("json") >= 0 && cType.indexOf("event-stream") < 0) {
      var json = await res.json().catch(function () { return {}; });
      var txt = (json.message && json.message.content) || json.content || json.reply || json.answer || json.text || "";
      if (txt) { reply.content = txt; scheduleRender(reply); follow(); }
      return txt;
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "";
    var acc = "";
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop() || "";
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln) continue;
        if (ln.charAt(0) === "{") {
          try {
            var obj = JSON.parse(ln);
            var tok = (obj.message && obj.message.content) || obj.response || "";
            if (tok) { acc += tok; reply.content = acc; scheduleRender(reply); follow(); }
          } catch (e) {}
          continue;
        }
        var bit = takeSse(ln);
        if (bit === null) return acc;
        if (bit) { acc += bit; reply.content = acc; scheduleRender(reply); follow(); }
      }
    }
    return acc;
  }

  function finishReply(chat, reply, label) {
    if (statusBadge) statusBadge.classList.remove("is-busy");
    if (statusText) statusText.textContent = label;
    var actions = log.querySelector('[data-id="' + reply.id + '"] .ai-actions');
    if (actions) actions.hidden = false;
    save();
    streaming = false;
    ctrl = null;
    paintSend();
    log.setAttribute("aria-busy", "false");
    renderList();
  }

  function send(text) {
    text = String(text || "").trim();
    if (!text || streaming) return;
    var chat = current();
    if (!chat) {
      chat = { id: uid(), title: text.slice(0, 42), updated: Date.now(), messages: [] };
      state.items.unshift(chat);
      state.active = chat.id;
    }
    chat.messages.push({ id: uid(), role: "user", content: text });
    if (!chat.title) chat.title = text.slice(0, 42);
    var reply = { id: uid(), role: "assistant", content: "" };
    var prior = chat.messages.slice(0, -1);
    chat.messages.push(reply);
    chat.updated = Date.now();
    save();
    input.value = "";
    grow();
    renderThread();
    renderList();

    if (currentMode === "team") {
      var instant = matchInstantTeamAnswer(text);
      if (instant) {
        reply.content = instant;
        var el = log.querySelector('[data-id="' + reply.id + '"]');
        if (el) paintBotMessage(el, instant);
        finishReply(chat, reply, "KB Oficial • 0 ms");
        return;
      }
    }

    streaming = true;
    paintSend();
    if (statusBadge) statusBadge.classList.add("is-busy");
    if (statusText) statusText.textContent = useOllama ? "Ollama Local • Generando…" : "Open Source AI • Streaming…";
    log.setAttribute("aria-busy", "true");
    ctrl = new AbortController();
    var startTime = Date.now();
    var sysPrompt = currentMode === "team" ? SYSTEM_TEAM : SYSTEM_ASSISTANT;
    var history = prior.slice(-6).map(function (m) { return { role: m.role, content: m.content.slice(0, 1500) }; });

    var req = useOllama
      ? fetch(OLLAMA_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({ model: "llama3.2", stream: true, messages: [{ role: "system", content: sysPrompt }].concat(history, [{ role: "user", content: text }]) })
        })
      : fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          signal: ctrl.signal,
          body: JSON.stringify({ prompt: text, custom_prompt: sysPrompt, chat_history: history, stream: true, mode: currentMode })
        });

    req.then(function (res) {
      if (!res.ok || !res.body) throw new Error("fallback");
      return readStreamAnswer(res, reply);
    }).then(function (acc) {
      if (!acc) throw new Error("fallback");
      finishReply(chat, reply, "Open Source • " + (Date.now() - startTime) + " ms");
    }).catch(function () {
      var fb = matchInstantTeamAnswer(text) || buildSmartFallback(text);
      reply.content = fb;
      var el = log.querySelector('[data-id="' + reply.id + '"]');
      if (el) paintBotMessage(el, fb);
      finishReply(chat, reply, "Motor Local • Listo");
    });
  }

  function openSide() {
    if (!side) return;
    side.hidden = false;
    if (scrim) scrim.hidden = !window.matchMedia("(max-width: 959px)").matches;
    if (sideOpen) sideOpen.setAttribute("aria-expanded", "true");
  }
  function closeSide() {
    if (!side) return;
    side.hidden = true;
    if (scrim) scrim.hidden = true;
    if (sideOpen) sideOpen.setAttribute("aria-expanded", "false");
  }
  function newChat() {
    if (streaming && ctrl) ctrl.abort();
    state.active = "";
    save();
    renderThread();
    renderList();
    input.focus();
  }
  function paintSend() {
    if (streaming) {
      sendBtn.setAttribute("data-mode", "stop");
      sendBtn.textContent = "Detener";
      sendBtn.disabled = false;
    } else {
      sendBtn.removeAttribute("data-mode");
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
      sendBtn.disabled = !String(input.value || "").trim();
    }
  }
  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
    paintSend();
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
  sendBtn.addEventListener("click", function () {
    if (streaming && ctrl) { ctrl.abort(); return; }
    send(input.value);
  });
  input.addEventListener("input", grow);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!streaming) send(input.value); }
  });
  stage.addEventListener("scroll", function () {
    var gap = stage.scrollHeight - stage.scrollTop - stage.clientHeight;
    stickToEnd = gap < 48;
    if (jumpBtn) jumpBtn.hidden = stickToEnd || emptyEl.hidden === false;
  });
  if (jumpBtn) jumpBtn.addEventListener("click", function () { stickToEnd = true; stage.scrollTop = stage.scrollHeight; });
  document.querySelectorAll("[data-prompt]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sw = btn.getAttribute("data-switch-mode");
      if (sw) setMode(sw);
      send(btn.getAttribute("data-prompt"));
    });
  });
  var newBtn = document.getElementById("aiNew");
  if (newBtn) newBtn.addEventListener("click", newChat);
  if (sideOpen) sideOpen.addEventListener("click", openSide);
  if (sideClose) sideClose.addEventListener("click", closeSide);
  if (scrim) scrim.addEventListener("click", closeSide);

  renderList();
  renderThread();
  paintSend();
})();
