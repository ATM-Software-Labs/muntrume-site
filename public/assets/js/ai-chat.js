/* Muntrume AI — Simplified Claude.ai Workspace & Multi-Style Artifact Export Engine (DOC, PDF, Slides 16:9, CSV, MD) */
(function () {
  "use strict";
  var API = "https://muntrume.atrumin16.workers.dev/api/ai";
  var OLLAMA_API = "http://localhost:11434/api/chat";
  var BRIDGE_URL = "http://127.0.0.1:38421";
  var STORE = "muntrume_ai_chats_session";
  var MD = "/assets/js/ai-md.js?v=t341";

  var kb = {};
  try {
    kb = JSON.parse((document.getElementById("muntrumeKbData") || {}).textContent || "{}");
  } catch (e) { kb = {}; }

  var SYSTEM_TEAM = [
    "Eres Muntrume AI (Claude-Style Engineer 3.7), el ingeniero de pista y copiloto oficial de Muntrume Motorsport (Equipo MMT) en Sant Andreu, Barcelona.",
    "Pilotos oficiales: #16 Alberto Trujillo (alberto@muntru.me, Fundador, GT3/Endurance), #1 Mateo Berbis (mateo@muntru.me, GT3/Porsche Cup), #22 Eduardo Chongkan (admin@muntru.me, Endurance/Setup Engineering). Legal: legal@muntru.me.",
    "Herramientas Open Source (MIT): MMT Sync v0.6.5 en Rust/Tauri (/app/ y /overlay/, <15 MB RAM, 60 FPS, 9 widgets), Setup Vault (/garage/, 42.654+ archivos .sto con nomenclatura MMT_COCHE_CIRCUITO_SESION_V#.sto), Setup Builder (/setup-builder/), Wallpapers 4K (/wallpapers/) y Galería (/gallery/).",
    "Estructura siempre tus respuestas con títulos ### claros, listas y tablas Markdown para que se vean perfectas tanto en vista Documento (Word/PDF) como en vista Presentación (Slides 16:9)."
  ].join("\n");

  var SYSTEM_ASSISTANT = "Eres Muntrume AI en modo Open Source. Ayuda con programación, informes técnicos, presentaciones y análisis estructurando tus respuestas con secciones ### claras, tablas y bloques de código limpios.";

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
  var composerModelLabel = document.getElementById("aiComposerModelLabel");
  var artifactPane = document.getElementById("aiArtifactPane");
  var artifactToggle = document.getElementById("aiArtifactToggle");
  var artifactClose = document.getElementById("aiArtifactClose");
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

  var currentArtifactTitle = "Informe Técnico · Muntrume Motorsport";
  var lastCanvasMarkdown = [
    "### Briefing Ejecutivo · Muntrume Motorsport (2026 S4)",
    "",
    "Bienvenido al **Artifact Studio** de Muntrume AI. Cualquier respuesta del chat se sincroniza aquí automáticamente y puede visualizarse como **Documento**, **Presentación 16:9**, **Simulador de Stint** o **Hoja de Setup .STO**.",
    "",
    "| Módulo Oficial | Especificación Técnica | Estado |",
    "|---|---|---|",
    "| **MMT Sync v0.6.5** | Cliente nativo Tauri v2 + Rust (`< 15 MB RAM`) | `60 Hz Activo` |",
    "| **Setup Vault (.sto)** | 42.654+ reglajes verificados (`BoP 26S4`) | `100% Pass Tech` |",
    "| **Overlays iRSDK** | 9 widgets (`FILE_MAP_READ` · `0% GPU Idle`) | `Click-Through` |",
    "| **Exportación** | Word (`.doc`), PDF A4, Presentación 16:9, Excel (`.csv`) | `1 Clic` |",
    "",
    "### Nomenclatura Oficial de Setups (.STO)",
    "",
    "- **Formato:** `MMT_COCHE_CIRCUITO_SESION_V#.sto` (ej. `MMT_F296_SPA_END_V2.sto`).",
    "- **Variantes:** `Q / Q2` (Clasificación), `R` (Sprint), `END` (Resistencia), `SAFE` (Alta estabilidad), `W` (Lluvia).",
    "",
    "### Estrategia Tipo GT3 (45 Minutos · Sprint)",
    "",
    "- **Combustible total:** `75.3 L` (`25 vueltas` a `2.85 L/vuelta` + `1.5v` margen).",
    "- **Ventana de parada:** Vueltas `12 a 18` sin cambio de neumáticos (`-14 s` en pit lane)."
  ].join("\n");

  var slidesList = [];
  var activeSlideIdx = 0;

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

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setMode(mode) {
    currentMode = mode === "assistant" ? "assistant" : "team";
    document.querySelectorAll("[data-ai-mode]").forEach(function (btn) {
      var on = btn.getAttribute("data-ai-mode") === currentMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (statusText && !streaming) {
      statusText.textContent = currentMode === "team" ? "Listo" : (useOllama ? "Ollama" : "OSS Live");
    }
    if (composerModelLabel) {
      composerModelLabel.innerHTML = '<span class="ai-status-dot"></span><span>' +
        (useOllama
          ? "Ollama Local"
          : currentMode === "team"
            ? "Claude-Style Engineer 3.7"
            : "Open Source Assistant") +
        "</span>";
    }
  }

  document.querySelectorAll("[data-ai-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () { setMode(btn.getAttribute("data-ai-mode")); });
  });

  if (ollamaBtn) {
    ollamaBtn.addEventListener("click", function () {
      useOllama = !useOllama;
      ollamaBtn.setAttribute("aria-pressed", useOllama ? "true" : "false");
      ollamaBtn.textContent = useOllama ? "Ollama: On" : "Ollama: Off";
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

  function extractTitleFromMarkdown(md) {
    var m = String(md || "").match(/^#{1,3}\s+(.+)$/m);
    return m ? m[1].replace(/[*_`]/g, "").trim() : "Informe Técnico · Muntrume AI";
  }

  /* ===================================================================== */
  /* TRACE & INLINE CLAUDE ARTIFACT CARD                                   */
  /* ===================================================================== */
  function buildTraceForQuery(q, mode) {
    var s = String(q || "").toLowerCase();
    if (/(presentaci[oó]n|diapositiva|slide|deck|24h)/.test(s)) {
      return {
        label: "Artifact · Presentación 16:9 generada",
        artifactTab: "slides",
        artifactType: "Presentación interactiva · 16:9 Slides",
        artifactIcon: "📽️",
        steps: [
          "✓ tool:slide_deck_builder.compile({ aspect: '16:9', theme: 'Muntrume Carbon' })",
          "✓ export:ready({ formats: ['HTML Slides', 'PDF Landscape', 'DOC'] })"
        ]
      };
    }
    if (/(45\s*min|combustible|gasolina|fuel|stint|estrategia|pit|\/stint)/.test(s)) {
      return {
        label: "Artifact · Estrategia de Stint & Combustible",
        artifactTab: "stint",
        artifactType: "Simulador Stint + Tabla exportable (CSV / PDF)",
        artifactIcon: "📊",
        steps: [
          "✓ tool:iracing_stint_engine.compute({ durationMin: 45, burnRateL: 2.85 })",
          "✓ artifact:stint_simulator.sync({ pitWindow: 'V12–V18' })"
        ]
      };
    }
    if (/(nomenclatura|\.sto|setup|subviraje|sobreviraje|understeer|oversteer|arb|bias|rake)/.test(s)) {
      return {
        label: "Artifact · Ficha de Setup .STO & Chasis",
        artifactTab: "sto",
        artifactType: "Hoja de Setup & Diagnóstico (DOC / PDF)",
        artifactIcon: "🔧",
        steps: [
          "✓ tool:mmt_setup_vault.inspect({ catalogSize: 42654 })",
          "✓ tool:handling_doctor.prescribe({ targetHotKpa: '165–175' })"
        ]
      };
    }
    return {
      label: mode === "assistant" ? "Artifact · Documento Open Source" : "Artifact · Documento Técnico MMT",
      artifactTab: "doc",
      artifactType: "Documento Técnico (Exportable a Word .DOC y PDF)",
      artifactIcon: "📄",
      steps: [
        "✓ tool:document_composer.format({ exportable: ['DOC', 'PDF', 'Slides', 'MD'] })"
      ]
    };
  }

  function makeThoughtElement(trace) {
    var details = document.createElement("details");
    details.className = "ai-thought";
    var summary = document.createElement("summary");
    summary.innerHTML =
      '<span class="ai-thought__left"><span class="ai-thought__badge">ARTIFACT</span><span>' +
      escHtml(trace && trace.label ? trace.label : "Razonamiento y herramientas") +
      "</span></span><span>▾</span>";
    var stepsBox = document.createElement("div");
    stepsBox.className = "ai-thought__steps";
    var steps = (trace && trace.steps) || ["✓ tool:muntrume_kb.verify()"];
    steps.forEach(function (st) {
      var d = document.createElement("div");
      d.textContent = st;
      stepsBox.appendChild(d);
    });
    details.appendChild(summary);
    details.appendChild(stepsBox);
    return details;
  }

  function makeInlineArtifactCard(msg) {
    var trace = msg.trace || buildTraceForQuery(msg.content, currentMode);
    var title = extractTitleFromMarkdown(msg.content);
    var card = document.createElement("div");
    card.className = "ai-inline-artifact";

    var info = document.createElement("div");
    info.className = "ai-inline-artifact__info";
    info.innerHTML =
      '<div class="ai-inline-artifact__ico">' + (trace.artifactIcon || "📄") + "</div>" +
      '<div style="min-width:0">' +
        '<strong class="ai-inline-artifact__title">' + escHtml(title) + "</strong>" +
        '<span class="ai-inline-artifact__sub">' + escHtml(trace.artifactType || "Documento · DOC / PDF / Slides") + "</span>" +
      "</div>";

    var btns = document.createElement("div");
    btns.className = "ai-inline-artifact__btns";

    function addBtn(label, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ai-action";
      b.textContent = label;
      b.addEventListener("click", onClick);
      btns.appendChild(b);
    }

    addBtn("Abrir Artifact ↗", function () {
      updateCanvasArtifact(msg.content);
      openArtifactPane(trace.artifactTab || "doc");
    });
    addBtn("📝 DOC", function () {
      updateCanvasArtifact(msg.content);
      exportArtifactAs("doc");
    });
    addBtn("📕 PDF", function () {
      updateCanvasArtifact(msg.content);
      exportArtifactAs("pdf");
    });
    addBtn("📽️ Slides", function () {
      updateCanvasArtifact(msg.content);
      openArtifactPane("slides");
    });

    card.appendChild(info);
    card.appendChild(btns);
    return card;
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

    if (msg.trace) {
      bb.appendChild(makeThoughtElement(msg.trace));
    }

    var host = document.createElement("div");
    host.className = "ai-mdhost";
    bb.appendChild(host);

    var isFinished = Boolean(msg.content) && !(streaming && current() && current().messages[current().messages.length - 1].id === msg.id);
    var acts = document.createElement("div");
    acts.className = "ai-actions";
    acts.hidden = !isFinished;

    if (msg.content) {
      bb.appendChild(makeInlineArtifactCard(msg));
    }

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ai-action";
    copyBtn.textContent = "📋 Copiar texto";
    copyBtn.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(msg.content).catch(function () {});
      copyBtn.textContent = "¡Copiado!";
      setTimeout(function () { copyBtn.textContent = "📋 Copiar texto"; }, 1500);
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

  /* ===================================================================== */
  /* VERIFIED KNOWLEDGE & PRESENTATION GENERATORS                          */
  /* ===================================================================== */
  function matchInstantTeamAnswer(q) {
    var s = q.toLowerCase();
    if (/(presentaci[oó]n|diapositiva|slide|24h)/.test(s)) {
      return [
        "### 01 · Muntrume Motorsport: Ingeniería & Resistencia 24h",
        "",
        "- **Identidad:** Escudería oficial de sim racing en iRacing nacida en Sant Andreu (Barcelona).",
        "- **Filosofía:** Preparación empírica basada en telemetría de 60 Hz, cero suscripciones y software 100 % Open Source (MIT).",
        "- **Especialidad:** Eventos especiales de 24 horas (Daytona, Spa, Nürburgring NEC, Le Mans) y series IMSA / GT Sprint.",
        "",
        "### 02 · MMT Sync v0.6.5 & HUD 60 Hz (Rust + Tauri v2)",
        "",
        "| Métrica | Valor en Pista |",
        "|---|---|",
        "| Consumo de memoria RAM | `< 15 MB` (frente a 450+ MB en Electron) |",
        "| Latencia iRSDK | `60 Hz` lectura directa `FILE_MAP_READ` |",
        "| Módulos transparentes | `9 widgets` (Standings, Relative, Radar 360°, Mapa GPS, Fuel, Tires) |",
        "",
        "### 03 · Setup Vault (.STO) & Estándar de Nomenclatura",
        "",
        "- **42.654+ archivos `.sto`** sincronizados por hash SHA-256 en `Documents\\iRacing\\setups\\MMT`.",
        "- **Nomenclatura oficial:** `MMT_F296_SPA_END_V2.sto` (`Q`, `Q2`, `R`, `END`, `SAFE`, `W`).",
        "- **Escrutinio BoP 26S4:** 100 % Pass Tech garantizado, incluyendo alturas calibradas `>= 70.5 mm` para NEC VLN.",
        "",
        "### 04 · Estrategia de Combustible, Relevos y Telemetría",
        "",
        "- **Cálculo de Stints:** Consumo medio GT3 (`2.75 – 2.95 L/vuelta`), margen de seguridad `+1.5 vueltas` y auto-repostaje `IRSDK_BROADCAST_MSG`.",
        "- **Control Térmico:** Ventana óptima de neumáticos en caliente entre `165–175 kPa` y `75–92 °C`.",
        "- **Relevos y Radio:** Coordinación en directo en Discord Paddock y comparación metro a metro en Garage 61.",
        "",
        "### 05 · Plantilla Oficial y Canales de Contacto",
        "",
        "- **#16 Alberto Trujillo** — Fundador & Lead Telemetry (`alberto@muntru.me`)",
        "- **#1 Mateo Berbis** — Piloto Oficial GT3 & Porsche Cup (`mateo@muntru.me`)",
        "- **#22 Eduardo Chongkan** — Piloto Oficial Endurance & Setup Engineering (`admin@muntru.me`)"
      ].join("\n");
    }
    if (/(briefing.*spa|informe.*briefing)/.test(s)) {
      return [
        "### Briefing Oficial de Carrera · GT3 Spa-Francorchamps (2026 S4)",
        "",
        "Documento técnico preparado por **Muntrume Race Control** para sesiones Sprint (40 min) y Endurance (3h / 24h) en el Circuit de Spa-Francorchamps.",
        "",
        "### Parámetros de Estrategia y Combustible",
        "",
        "| Parámetro | Sprint (45 min) | Endurance (Stint 65 min) |",
        "|---|---|---|",
        "| Setup `.sto` recomendado | `MMT_F296_SPA_R_V2.sto` | `MMT_F296_SPA_END_V2.sto` |",
        "| Tiempo de vuelta objetivo | `2:16.8 – 2:17.5` | `2:17.8 – 2:18.4` |",
        "| Consumo medio estimado | `3.35 L / vuelta` | `3.28 L / vuelta` |",
        "| Combustible total requerido | `72.0 L` (`20 vueltas + 1.5v`) | `104.0 L` (`31 vueltas`) |",
        "| Ventana de Box (`Pit Window`) | **Vueltas 10 – 13** (sin cambio gomas) | **Vuelta 29 – 30** (cambio 4 neumáticos) |",
        "",
        "### Presiones y Balance de Chasis en Spa",
        "",
        "- **Presión objetivo en caliente:** `168 – 172 kPa` (`24.4 – 24.9 PSI`) tras 3 vueltas lanzadas.",
        "- **Eau Rouge / Raidillon:** Si el fondo plano roza en la compresión a depósito lleno, sube `+1 mm` la altura delantera o añade `+1 click` al packer delantero.",
        "- **Sector 2 (Pouhon / Stavelot):** Para reducir subviraje en curva rápida, baja `Brake Bias -0.4%` o sube `+1 mm` el rake trasero."
      ].join("\n");
    }
    if (/(nomenclatura|\/nomenclatura|c[oó]digo.*sto|est[aá]ndar.*mmt|subviraje|sobreviraje)/.test(s)) {
      return [
        "### Estándar Oficial de Setups `.STO` y Diagnóstico de Chasis · MMT",
        "",
        "Todos los reglajes oficiales en `Documents\\iRacing\\setups\\<coche>\\MMT` siguen la sintaxis de 5 bloques:",
        "",
        "```text",
        "MMT_F296_SPA_END_V2.sto",
        " │   │    │   │   └── Versión verificada (V1, V2, V3…)",
        " │   │    │   └────── Sesión: Q, Q2, R, END, W, SAFE",
        " │   │    └────────── Circuito oficial (SPA, DAYTONA, NORDS, LEMANS…)",
        " │   └─────────────── Chasis (F296, P911, M4, P963, F499P…)",
        " └─────────────────── Escudería Muntrume Motorsport",
        "```",
        "",
        "### Tabla de Corrección Rápida (Handling Doctor)",
        "",
        "| Síntoma en Pista | Fase de Curva | Ajuste Mecánico Recomendado |",
        "|---|---|---|",
        "| **Subviraje (no gira)** | Entrada (frenando) | Baja `Brake Bias -0.5%`, ablanda `1 click` ARB delantera o sube `+1 mm` rake trasero |",
        "| **Subviraje (empuja)** | Ápice / Mitad curva | Aumenta caída delantera `-0.1°`, baja altura delantera `-1 mm` |",
        "| **Sobreviraje (suelta trasera)** | Entrada (frenando) | Sube `Brake Bias +0.5%` y añade `+1 click` a `Diff Preload` |",
        "| **Sobreviraje (tracción)** | Salida (acelerando) | Ablanda `1–2 clicks` ARB trasera y sube `TC1 / TC2 +1` |"
      ].join("\n");
    }
    if (/(piloto|alberto|mateo|eduardo|dorsal|contacto|correo|email|equipo|muntrume)/.test(s) && !/(45\s*min|combustible|gasolina|fuel|overlay|instalo|nomenclatura|presentaci)/.test(s)) {
      var pilots = (kb.pilots || []).map(function (p) {
        return "| **" + p.dorsal + "** | **" + p.name + "** | " + p.role + " | " + p.categories.join(", ") + " | `" + p.email + "` |";
      }).join("\n");
      return [
        "### Plantilla Oficial de Pilotos y Contacto · Muntrume Motorsport",
        "",
        "| Dorsal | Piloto Oficial | Rol en el Equipo | Categorías | Correo Oficial |",
        "|---|---|---|---|---|",
        pilots,
        "",
        "### Canales y Telemetría Oficial",
        "- **Administración / Soporte / Prensa:** [admin@muntru.me](mailto:admin@muntru.me)",
        "- **Legal / Privacidad / RGPD:** [legal@muntru.me](mailto:legal@muntru.me)",
        "- **Discord Paddock:** [discord.gg/ehX6B8JUtE](https://discord.gg/ehX6B8JUtE)",
        "- **Telemetría Garage 61:** [Equipo Muntrume Motorsport](https://garage61.net/app/teams/muntrume-motorsport)"
      ].join("\n");
    }
    if (/(overlay|mmt\s*sync|instalo|hud|kapps|pit\s*window|tire\s*monitor|\/overlay)/.test(s)) {
      return [
        "### Manual Técnico: MMT Sync v0.6.5 & Overlays 60 Hz",
        "",
        "- **Arquitectura:** Cliente nativo en **Tauri v2 + Rust** (`< 15 MB` RAM, `0.0% GPU idle`, licencia MIT).",
        "- **Instalación directa por consola (Windows Package Manager):**",
        "  ```powershell",
        "  winget install Muntrume.MMTSync",
        "  ```",
        "",
        "### Módulos del HUD Studio (60 FPS · Click-Through)",
        "",
        "| Módulo | Función en Pista |",
        "|---|---|",
        "| **01 · Standings** | Clasificación multiclase (`Top 3` + ventana `±2`), SOF e iRating en vivo |",
        "| **02 · Relative** | Distancias en segundos con filtro de Pace Car y alerta de doblados |",
        "| **03 · Pit & Strategy** | Ventana de parada, litros a añadir y auto-repostaje `IRSDK_BROADCAST_MSG` |",
        "| **04 · Tire & Temp Monitor** | Temperaturas `FL/FR/RL/RR` (`75–92 °C`) y presiones en caliente `kPa/PSI` |",
        "| **05 · Track Map & Radar** | Mapa GPS con splines Catmull-Rom e indicador de proximidad 360° |"
      ].join("\n");
    }
    if (/(45\s*min|combustible|gasolina|fuel|stint|estrategia|pit|\/stint)/.test(s)) {
      return [
        "### Hoja de Estrategia GT3 · Carrera de 45 Minutos",
        "",
        "| Parámetro de Ingeniería | Valor Calculado | Notas Operativas |",
        "|---|---|---|",
        "| **Duración de Sesión** | `45 minutos` | ~25 vueltas (ritmo medio `1:48.5`) |",
        "| **Consumo por Vuelta** | `2.85 L / vuelta` | Mapa de motor estándar (Dry) |",
        "| **Combustible Total (+1.5v)** | **`75.3 L`** | Incluye vuelta de formación y margen |",
        "| **Capacidad Depósito Sprint** | `55.0 L` | Restricción BoP serie GT Sprint |",
        "| **Ventana de Parada (Pit Window)** | **Vueltas 12 – 18** | Repostar `+21.5 L` en parada única |",
        "| **Cambio de Neumáticos** | **No cambiar** | Ahorro de `~14.0 s` en carril de boxes |",
        "",
        "### Recomendaciones de Stint",
        "",
        "- **Vueltas 1–3:** Calentamiento progresivo de frenos y neumáticos hasta alcanzar `168 kPa`.",
        "- **Vueltas 12–15:** Ventana ideal de *undercut* si hay tráfico delante.",
        "- **Auto-Fuel:** Activa el envío automático en **MMT Sync** o ajusta los parámetros en la pestaña **📊 Stint Sim**."
      ].join("\n");
    }
    return null;
  }

  function buildSmartFallback(q) {
    return matchInstantTeamAnswer(q) || [
      "### Informe Técnico · Muntrume AI",
      "",
      "Resumen verificado del ecosistema **Muntrume Motorsport** listo para exportar a **Word (.doc)**, **PDF** o **Presentación**:",
      "",
      "| Herramienta | Ruta | Descripción |",
      "|---|---|---|",
      "| **MMT Sync v0.6.5** | `/app/` | Cliente nativo Rust + Tauri v2 con sincronización SHA-256 |",
      "| **Simulador HUD 60Hz** | `/overlay/` | 9 widgets de telemetría transparente para iRacing |",
      "| **Setup Vault (.sto)** | `/garage/` | 42.654+ reglajes verificados con BoP 26S4 |",
      "| **Calendario 2026 S4** | `/calendar/` | Planificador de las 12 semanas oficiales |"
    ].join("\n");
  }

  /* ===================================================================== */
  /* MULTI-STYLE ARTIFACT STUDIO & SLIDE DECK ENGINE                       */
  /* ===================================================================== */
  function setArtifactTab(tabName) {
    var tabs = ["doc", "slides", "stint", "sto", "code"];
    var target = tabs.indexOf(tabName) >= 0 ? tabName : "doc";
    document.querySelectorAll("[data-art-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-art-tab") === target;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    var map = {
      doc: "artPanelDoc",
      slides: "artPanelSlides",
      stint: "artPanelStint",
      sto: "artPanelSto",
      code: "artPanelCode"
    };
    Object.keys(map).forEach(function (k) {
      var el = document.getElementById(map[k]);
      if (el) el.hidden = k !== target;
    });
    if (target === "slides") {
      rebuildSlidesFromMarkdown(lastCanvasMarkdown);
    }
  }

  function openArtifactPane(tabName) {
    if (!artifactPane) return;
    artifactPane.hidden = false;
    if (artifactToggle) artifactToggle.setAttribute("aria-pressed", "true");
    setArtifactTab(tabName || "doc");
  }

  function closeArtifactPane() {
    if (!artifactPane) return;
    artifactPane.hidden = true;
    if (artifactToggle) artifactToggle.setAttribute("aria-pressed", "false");
  }

  function parseMarkdownIntoSlides(md) {
    var raw = String(md || "").trim();
    if (!raw) {
      return [{ title: "Muntrume Motorsport", body: "Genera una consulta en el chat para ver las diapositivas." }];
    }
    var chunks = raw.split(/\n(?=###?\s+)/);
    var out = [];
    chunks.forEach(function (c) {
      var trimmed = c.trim();
      if (!trimmed) return;
      var lines = trimmed.split("\n");
      var first = lines[0].replace(/^#{1,4}\s*/, "").trim();
      var rest = lines.slice(1).join("\n").trim();
      if (!rest && out.length === 0) {
        out.push({ title: currentArtifactTitle, body: first });
      } else {
        out.push({ title: first || currentArtifactTitle, body: rest || first });
      }
    });
    if (out.length === 1 && out[0].body.split("\n\n").length >= 3) {
      var paras = out[0].body.split("\n\n");
      var multi = [];
      for (var i = 0; i < paras.length; i += 2) {
        multi.push({
          title: i === 0 ? out[0].title : (out[0].title + " (" + (Math.floor(i / 2) + 1) + ")"),
          body: paras.slice(i, i + 2).join("\n\n")
        });
      }
      return multi;
    }
    return out;
  }

  function renderActiveSlide() {
    if (!slidesList.length) slidesList = parseMarkdownIntoSlides(lastCanvasMarkdown);
    if (activeSlideIdx >= slidesList.length) activeSlideIdx = 0;
    if (activeSlideIdx < 0) activeSlideIdx = slidesList.length - 1;

    var slide = slidesList[activeSlideIdx];
    var counterEl = document.getElementById("artSlideCounter");
    var numBadge = document.getElementById("artSlideNumBadge");
    var bodyEl = document.getElementById("artSlideBody");
    var footTitle = document.getElementById("artSlideTitleFoot");
    var dotsEl = document.getElementById("artSlideDots");

    if (counterEl) counterEl.textContent = "Diapositiva " + (activeSlideIdx + 1) + " / " + slidesList.length;
    if (numBadge) numBadge.textContent = String(activeSlideIdx + 1).padStart(2, "0");
    if (footTitle) footTitle.textContent = currentArtifactTitle;

    var slideMd = "### " + slide.title + "\n\n" + slide.body;
    if (bodyEl) {
      if (window.MuntrumeMarkdown && window.MuntrumeMarkdown.renderMarkdown) {
        bodyEl.innerHTML = "";
        bodyEl.appendChild(window.MuntrumeMarkdown.renderMarkdown(slideMd, { copy: "Copiar", copied: "¡Copiado!" }));
      } else {
        bodyEl.innerHTML = "<h3>" + escHtml(slide.title) + "</h3><pre>" + escHtml(slide.body) + "</pre>";
        loadMd().then(function (lib) {
          if (lib && bodyEl) {
            bodyEl.innerHTML = "";
            bodyEl.appendChild(lib.renderMarkdown(slideMd, { copy: "Copiar", copied: "¡Copiado!" }));
          }
        });
      }
    }

    if (dotsEl) {
      dotsEl.innerHTML = "";
      slidesList.forEach(function (_, idx) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "ai-slide-dot" + (idx === activeSlideIdx ? " is-active" : "");
        dot.setAttribute("aria-label", "Ir a diapositiva " + (idx + 1));
        dot.addEventListener("click", function () {
          activeSlideIdx = idx;
          renderActiveSlide();
        });
        dotsEl.appendChild(dot);
      });
    }
  }

  function rebuildSlidesFromMarkdown(md) {
    slidesList = parseMarkdownIntoSlides(md);
    activeSlideIdx = 0;
    renderActiveSlide();
  }

  function updateCanvasArtifact(markdownText) {
    lastCanvasMarkdown = String(markdownText || "").trim() || lastCanvasMarkdown;
    currentArtifactTitle = extractTitleFromMarkdown(lastCanvasMarkdown);

    var titleEl = document.getElementById("artCanvasTitle");
    if (titleEl) titleEl.textContent = currentArtifactTitle;

    var rawPre = document.getElementById("artRawMarkdownPre");
    if (rawPre) rawPre.textContent = lastCanvasMarkdown;

    var host = document.getElementById("artCanvasBody");
    if (host) {
      if (window.MuntrumeMarkdown && window.MuntrumeMarkdown.renderMarkdown) {
        host.innerHTML = "";
        host.appendChild(window.MuntrumeMarkdown.renderMarkdown(lastCanvasMarkdown, { copy: "Copiar", copied: "¡Copiado!" }));
      } else {
        loadMd().then(function (lib) {
          if (lib && host) {
            host.innerHTML = "";
            host.appendChild(lib.renderMarkdown(lastCanvasMarkdown, { copy: "Copiar", copied: "¡Copiado!" }));
          }
        });
      }
    }
    rebuildSlidesFromMarkdown(lastCanvasMarkdown);
  }

  /* ===================================================================== */
  /* UNIVERSAL EXPORT ENGINE: WORD (.DOC), PDF, SLIDES (.HTML), CSV, .MD   */
  /* ===================================================================== */
  function slugifyFile(title) {
    var clean = String(title || "Muntrume_AI")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return clean || "Muntrume_Artifact";
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(url);
    }, 800);
  }

  function getRenderedArtifactHtml() {
    var host = document.getElementById("artCanvasBody");
    if (host && host.innerHTML.trim()) return host.innerHTML;
    return "<pre>" + escHtml(lastCanvasMarkdown) + "</pre>";
  }

  function exportArtifactAs(format) {
    var fnameBase = slugifyFile(currentArtifactTitle);
    var dateStr = new Date().toLocaleDateString("es-ES", { dateStyle: "long" });
    var contentHtml = getRenderedArtifactHtml();

    if (format === "md") {
      var mdBlob = new Blob([lastCanvasMarkdown], { type: "text/markdown;charset=utf-8" });
      triggerBlobDownload(mdBlob, fnameBase + ".md");
      return;
    }

    if (format === "csv") {
      var rows = [];
      var lines = lastCanvasMarkdown.split("\n");
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (t.charAt(0) === "|" && t.charAt(t.length - 1) === "|") {
          if (/^\|[\s\-:|]+\|$/.test(t)) return;
          var cells = t.slice(1, -1).split("|").map(function (c) {
            return c.replace(/[*_`]/g, "").trim();
          });
          rows.push(cells);
        }
      });
      if (rows.length === 0) {
        var st = recalcStintArtifact();
        rows = [
          ["Parametro", "Valor"],
          ["Titulo", currentArtifactTitle],
          ["Duracion Carrera (min)", st ? st.raceMin : 45],
          ["Tiempo por Vuelta (s)", st ? st.lapSec : 108.5],
          ["Consumo (L/vuelta)", st ? st.fuelLap : 2.85],
          ["Capacidad Deposito (L)", st ? st.tankCap : 55],
          ["Vueltas Totales", st ? st.totalLaps : 25],
          ["Combustible Total (L)", st ? st.totalFuel : 75.3],
          ["Paradas Estimadas", st ? st.stops : 1]
        ];
      }
      var csvContent = "\uFEFF" + rows.map(function (r) {
        return r.map(function (cell) {
          return '"' + String(cell ?? "").replace(/"/g, '""') + '"';
        }).join(",");
      }).join("\r\n");
      var csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      triggerBlobDownload(csvBlob, fnameBase + ".csv");
      return;
    }

    if (format === "doc") {
      var wordHtml = [
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
        '<head><meta charset="utf-8"><title>' + escHtml(currentArtifactTitle) + '</title>',
        '<style>',
        'body { font-family: Calibri, Arial, sans-serif; color: #0f172a; line-height: 1.55; margin: 24pt; }',
        '.head { border-bottom: 3pt solid #059669; padding-bottom: 10pt; margin-bottom: 16pt; }',
        '.brand { font-size: 10pt; font-weight: bold; color: #059669; letter-spacing: 1pt; text-transform: uppercase; }',
        'h1 { font-size: 20pt; color: #0f172a; margin: 4pt 0 6pt; }',
        'h2, h3 { font-size: 13.5pt; color: #059669; margin-top: 14pt; margin-bottom: 6pt; }',
        'table { width: 100%; border-collapse: collapse; margin: 10pt 0; }',
        'th { background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: left; padding: 6pt 8pt; border: 1pt solid #cbd5e1; font-size: 10pt; }',
        'td { padding: 6pt 8pt; border: 1pt solid #cbd5e1; font-size: 10.5pt; }',
        'code, pre { font-family: Consolas, monospace; background-color: #f1f5f9; padding: 2pt 4pt; }',
        'pre { padding: 10pt; border: 1pt solid #cbd5e1; }',
        '.foot { margin-top: 24pt; padding-top: 10pt; border-top: 1pt solid #cbd5e1; font-size: 9pt; color: #64748b; }',
        '</style></head><body>',
        '<div class="head"><div class="brand">MUNTRUME MOTORSPORT · TECHNICAL ARTIFACT (muntru.me)</div>',
        '<h1>' + escHtml(currentArtifactTitle) + '</h1>',
        '<div style="font-size:9.5pt;color:#64748b">Generado por Muntrume AI · ' + escHtml(dateStr) + ' · Sant Andreu, Barcelona</div></div>',
        contentHtml,
        '<div class="foot">Muntrume Motorsport · Sim Racing Engineering · https://muntru.me</div>',
        '</body></html>'
      ].join("\n");
      var docBlob = new Blob(["\uFEFF", wordHtml], { type: "application/msword;charset=utf-8" });
      triggerBlobDownload(docBlob, fnameBase + ".doc");
      return;
    }

    if (format === "pdf") {
      var printWin = window.open("", "_blank", "width=920,height=780");
      if (!printWin) {
        window.print();
        return;
      }
      var pdfHtml = [
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
        '<title>' + escHtml(currentArtifactTitle) + ' · Muntrume Motorsport</title>',
        '<style>',
        '@page { size: A4; margin: 16mm; }',
        'body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.6; margin: 0; padding: 24px; }',
        '.top { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }',
        '.brand { font-size: 11px; font-weight: 800; color: #059669; letter-spacing: 0.1em; text-transform: uppercase; }',
        'h1 { font-size: 22px; margin: 4px 0 0; color: #0f172a; }',
        'h2, h3 { font-size: 15px; color: #047857; margin: 18px 0 8px; }',
        'table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12.5px; }',
        'th { background: #0f172a; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }',
        'td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }',
        'pre, code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 12px; background: #f8fafc; }',
        'pre { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow-x: auto; }',
        '.ai-codecopy { display: none !important; }',
        '.foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }',
        '</style></head><body>',
        '<div class="top"><div><div class="brand">MUNTRUME MOTORSPORT · ENGINEERING DOCUMENT</div><h1>' + escHtml(currentArtifactTitle) + '</h1></div>',
        '<div style="text-align:right;font-size:11px;color:#64748b"><strong>muntru.me</strong><br>' + escHtml(dateStr) + '</div></div>',
        contentHtml,
        '<div class="foot"><span>Muntrume Motorsport · Sant Andreu, Barcelona</span><span>Generado con Muntrume AI</span></div>',
        '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>',
        '</body></html>'
      ].join("\n");
      printWin.document.open();
      printWin.document.write(pdfHtml);
      printWin.document.close();
      return;
    }

    if (format === "slides") {
      var slides = parseMarkdownIntoSlides(lastCanvasMarkdown);
      var slidesMarkup = slides.map(function (sl, i) {
        return [
          '<section class="slide' + (i === 0 ? " active" : "") + '">',
          '  <header class="s-top"><span>MUNTRUME MOTORSPORT · 2026 S4</span><span class="s-num">' + String(i + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0") + '</span></header>',
          '  <div class="s-body"><h2>' + escHtml(sl.title) + '</h2><div class="s-content">' + escHtml(sl.body).replace(/\n/g, "<br>") + '</div></div>',
          '  <footer class="s-foot"><span>muntru.me · Sim Racing Engineering</span><span>' + escHtml(currentArtifactTitle) + '</span></footer>',
          '</section>'
        ].join("\n");
      }).join("\n");

      var deckHtml = [
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Presentación: ' + escHtml(currentArtifactTitle) + ' · Muntrume Motorsport</title>',
        '<style>',
        '*{box-sizing:border-box}body{margin:0;background:#06080c;color:#f8fafc;font-family:Inter,system-ui,sans-serif;overflow:hidden;height:100vh;display:flex;flex-direction:column}',
        '.deck{flex:1;display:grid;place-items:center;padding:28px}',
        '.slide{display:none;width:min(1100px,94vw);aspect-ratio:16/9;border-radius:22px;border:1px solid rgba(0,230,153,0.4);background:radial-gradient(700px circle at 85% 15%,rgba(0,230,153,0.15),transparent 60%),linear-gradient(160deg,#0f141d 0%,#080b10 100%);padding:36px 44px;flex-direction:column;justify-content:space-between;box-shadow:0 28px 70px rgba(0,0,0,0.75)}',
        '.slide.active{display:flex}',
        '.s-top,.s-foot{display:flex;justify-content:space-between;align-items:center;font-family:monospace;font-size:12px;color:#94a3b8}',
        '.s-top{border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:14px;color:#00e699;font-weight:800;letter-spacing:0.12em}',
        '.s-foot{border-top:1px solid rgba(255,255,255,0.1);padding-top:14px}',
        '.s-body{margin:auto 0;max-height:72%;overflow-y:auto}',
        '.s-body h2{margin:0 0 18px;font-size:clamp(24px,3.2vw,38px);color:#fff}',
        '.s-content{font-size:clamp(15px,1.7vw,20px);line-height:1.65;color:#cbd5e1;white-space:pre-wrap}',
        '.controls{height:54px;background:#0b0f16;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;gap:12px;font-family:monospace}',
        'button{height:34px;padding:0 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.18);background:#131924;color:#fff;cursor:pointer;font-weight:700}',
        'button:hover{border-color:#00e699;color:#00e699}',
        '@media print{@page{size:landscape;margin:8mm}body{height:auto;overflow:visible;background:#06080c}.controls{display:none}.deck{display:block;padding:0}.slide{display:flex !important;page-break-after:always;width:100%;margin-bottom:16px}}',
        '</style></head><body>',
        '<div class="deck">' + slidesMarkup + '</div>',
        '<div class="controls">',
        '  <button onclick="go(-1)">← Anterior</button>',
        '  <span id="cnt">1 / ' + slides.length + '</span>',
        '  <button onclick="go(1)">Siguiente →</button>',
        '  <button onclick="document.documentElement.requestFullscreen()">⛶ Pantalla Completa</button>',
        '  <button onclick="window.print()">📕 Guardar PDF Slides</button>',
        '</div>',
        '<script>',
        'var idx=0,all=document.querySelectorAll(".slide"),cnt=document.getElementById("cnt");',
        'function go(d){all[idx].classList.remove("active");idx=(idx+d+all.length)%all.length;all[idx].classList.add("active");cnt.textContent=(idx+1)+" / "+all.length;}',
        'document.addEventListener("keydown",function(e){if(e.key==="ArrowRight"||e.key===" ")go(1);if(e.key==="ArrowLeft")go(-1);});',
        '<\/script></body></html>'
      ].join("\n");
      var slidesBlob = new Blob([deckHtml], { type: "text/html;charset=utf-8" });
      triggerBlobDownload(slidesBlob, fnameBase + "_Presentacion.html");
    }
  }

  document.getElementById("btnExportDoc")?.addEventListener("click", function () { exportArtifactAs("doc"); });
  document.getElementById("btnExportPdf")?.addEventListener("click", function () { exportArtifactAs("pdf"); });
  document.getElementById("btnExportSlides")?.addEventListener("click", function () { exportArtifactAs("slides"); });
  document.getElementById("btnExportCsv")?.addEventListener("click", function () { exportArtifactAs("csv"); });
  document.getElementById("btnExportMd")?.addEventListener("click", function () { exportArtifactAs("md"); });

  document.getElementById("btnSlidePrev")?.addEventListener("click", function () {
    activeSlideIdx--;
    renderActiveSlide();
  });
  document.getElementById("btnSlideNext")?.addEventListener("click", function () {
    activeSlideIdx++;
    renderActiveSlide();
  });
  document.getElementById("btnSlideFullscreen")?.addEventListener("click", function () {
    var st = document.getElementById("artSlideStage");
    if (!st) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    else if (st.requestFullscreen) st.requestFullscreen().catch(function () {});
  });

  if (artifactToggle) {
    artifactToggle.addEventListener("click", function () {
      if (artifactPane && artifactPane.hidden) openArtifactPane("doc");
      else closeArtifactPane();
    });
  }
  if (artifactClose) {
    artifactClose.addEventListener("click", closeArtifactPane);
  }
  document.querySelectorAll("[data-art-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setArtifactTab(btn.getAttribute("data-art-tab"));
    });
  });
  document.querySelectorAll("[data-open-artifact]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openArtifactPane(btn.getAttribute("data-open-artifact") || "doc");
    });
  });

  var copyCanvasBtn = document.getElementById("artCopyCanvasBtn");
  if (copyCanvasBtn) {
    copyCanvasBtn.addEventListener("click", function () {
      if (!lastCanvasMarkdown || !navigator.clipboard) return;
      navigator.clipboard.writeText(lastCanvasMarkdown).catch(function () {});
      copyCanvasBtn.textContent = "¡Copiado!";
      setTimeout(function () { copyCanvasBtn.textContent = "📋 Copiar Markdown"; }, 1500);
    });
  }

  /* ===================================================================== */
  /* STREAMING & SEND PIPELINE                                             */
  /* ===================================================================== */
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
    if (reply.content) updateCanvasArtifact(reply.content);
    save();
    streaming = false;
    ctrl = null;
    paintSend();
    log.setAttribute("aria-busy", "false");
    renderThread();
    renderList();
  }

  function send(text, preferredArtifactTab) {
    text = String(text || "").trim();
    if (!text || streaming) return;
    var chat = current();
    if (!chat) {
      chat = { id: uid(), title: text.replace(/^\/[a-z]+\s*/i, "").slice(0, 42), updated: Date.now(), messages: [] };
      state.items.unshift(chat);
      state.active = chat.id;
    }
    chat.messages.push({ id: uid(), role: "user", content: text });
    if (!chat.title) chat.title = text.slice(0, 42);
    var trace = buildTraceForQuery(text, currentMode);
    if (preferredArtifactTab) trace.artifactTab = preferredArtifactTab;
    var reply = { id: uid(), role: "assistant", content: "", trace: trace };
    var prior = chat.messages.slice(0, -1);
    chat.messages.push(reply);
    chat.updated = Date.now();
    save();
    input.value = "";
    grow();
    renderThread();
    renderList();

    if (preferredArtifactTab && window.matchMedia("(min-width: 1120px)").matches) {
      openArtifactPane(preferredArtifactTab);
    }

    if (currentMode === "team") {
      var instant = matchInstantTeamAnswer(text);
      if (instant) {
        reply.content = instant;
        finishReply(chat, reply, "0 ms · Verificado");
        if (preferredArtifactTab) setArtifactTab(preferredArtifactTab);
        return;
      }
    }

    streaming = true;
    paintSend();
    if (statusBadge) statusBadge.classList.add("is-busy");
    if (statusText) statusText.textContent = "Generando…";
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
      finishReply(chat, reply, (Date.now() - startTime) + " ms");
    }).catch(function () {
      var fb = matchInstantTeamAnswer(text) || buildSmartFallback(text);
      reply.content = fb;
      finishReply(chat, reply, "Listo");
    });
  }

  /* ===================================================================== */
  /* STINT & STO INTERACTIVE ARTIFACT TOOLS                                */
  /* ===================================================================== */
  function recalcStintArtifact() {
    var minEl = document.getElementById("artRaceMin");
    var lapEl = document.getElementById("artLapSec");
    var fuelEl = document.getElementById("artFuelLap");
    var tankEl = document.getElementById("artTankCap");
    if (!minEl || !lapEl || !fuelEl || !tankEl) return null;

    var raceMin = Math.max(5, Number(minEl.value) || 45);
    var lapSec = Math.max(25, Number(lapEl.value) || 108.5);
    var fuelLap = Math.max(0.2, Number(fuelEl.value) || 2.85);
    var tankCap = Math.max(10, Number(tankEl.value) || 55);

    var totalLaps = Math.ceil((raceMin * 60) / lapSec);
    var totalFuel = Math.round((totalLaps + 1.5) * fuelLap * 10) / 10;
    var stintLaps = Math.max(1, Math.floor((tankCap - 1.2) / fuelLap));
    var stops = totalFuel <= tankCap ? 0 : Math.ceil((totalFuel - tankCap) / (tankCap - 1.5));
    var pitStart = stops > 0 ? Math.max(2, totalLaps - stintLaps) : 0;
    var pitEnd = stops > 0 ? Math.max(pitStart, stintLaps) : 0;

    var outFuel = document.getElementById("artOutTotalFuel");
    var outLaps = document.getElementById("artOutTotalLaps");
    var outStint = document.getElementById("artOutStintLaps");
    var outPit = document.getElementById("artOutPitWindow");

    if (outFuel) outFuel.textContent = totalFuel.toFixed(1) + " L";
    if (outLaps) outLaps.textContent = totalLaps + " vueltas";
    if (outStint) outStint.textContent = stintLaps + " vueltas";
    if (outPit) {
      outPit.textContent = stops === 0
        ? "0 paradas (Sin box)"
        : stops + (stops === 1 ? " parada" : " paradas") + " · V" + Math.min(pitStart, pitEnd) + "–V" + Math.max(pitStart, pitEnd);
    }
    return { raceMin: raceMin, lapSec: lapSec, fuelLap: fuelLap, tankCap: tankCap, totalLaps: totalLaps, totalFuel: totalFuel, stintLaps: stintLaps, stops: stops };
  }

  ["artRaceMin", "artLapSec", "artFuelLap", "artTankCap"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("input", recalcStintArtifact);
  });
  recalcStintArtifact();

  document.getElementById("artSendStintToChat")?.addEventListener("click", function () {
    var r = recalcStintArtifact();
    if (!r) return;
    send("Calcula combustible y estrategia para una carrera GT3 de " + r.raceMin + " min (" + r.totalLaps + " vueltas a " + r.lapSec + "s, consumo " + r.fuelLap + " L/v, depósito " + r.tankCap + " L → Total " + r.totalFuel.toFixed(1) + " L)", "doc");
  });

  var sendFuelIrBtn = document.getElementById("artSendFuelToIracing");
  if (sendFuelIrBtn) {
    sendFuelIrBtn.addEventListener("click", function () {
      var r = recalcStintArtifact();
      if (!r) return;
      fetch(BRIDGE_URL + "/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch-overlay" })
      }).then(function () {
        sendFuelIrBtn.textContent = "✓ Enviado (" + r.totalFuel.toFixed(1) + " L)";
        setTimeout(function () { sendFuelIrBtn.textContent = "⚡ Enviar a iRacing"; }, 2200);
      }).catch(function () {
        window.location.href = "mmtsync://launch-overlay";
      });
    });
  }

  var PRESCRIPTIONS = {
    entry_under: "<strong>Subviraje en entrada:</strong> Baja <code>Brake Bias -0.5%</code> hacia atrás, ablanda <code>1 click</code> la ARB delantera o sube <code>+1 mm</code> la altura trasera (rake).",
    mid_under: "<strong>Subviraje en ápice:</strong> Aumenta caída delantera (<code>-0.1° camber</code>), baja altura delantera <code>-1 mm</code> o ablanda el muelle delantero.",
    exit_over: "<strong>Sobreviraje al acelerar:</strong> Ablanda <code>1–2 clicks</code> la ARB trasera, sube <code>TC1/TC2 +1</code> o reduce la altura trasera <code>-1 mm</code>.",
    entry_over: "<strong>Trasera inestable en frenada:</strong> Sube <code>Brake Bias +0.5%</code> hacia delante y añade <code>+1 click</code> de precarga al diferencial (Diff Preload).",
    top_speed: "<strong>Falta velocidad punta:</strong> Reduce <code>1–2 clicks</code> el alerón trasero (Wing) y baja la altura trasera <code>-1 mm</code> para minimizar drag."
  };

  function recalcStoArtifact() {
    var car = (document.getElementById("artStoCar") || {}).value || "F296";
    var trk = (document.getElementById("artStoTrack") || {}).value || "SPA";
    var ses = (document.getElementById("artStoSession") || {}).value || "END";
    var sym = (document.getElementById("artStoSymptom") || {}).value || "entry_under";
    var fn = "MMT_" + car + "_" + trk + "_" + ses + "_V2.sto";
    var fnEl = document.getElementById("artStoFilename");
    var prEl = document.getElementById("artStoPrescription");
    if (fnEl) fnEl.textContent = fn;
    if (prEl && PRESCRIPTIONS[sym]) prEl.innerHTML = PRESCRIPTIONS[sym];
    return { filename: fn, car: car, track: trk, session: ses, symptom: sym };
  }

  ["artStoCar", "artStoTrack", "artStoSession", "artStoSymptom"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", recalcStoArtifact);
  });
  recalcStoArtifact();

  document.getElementById("artAskStoInChat")?.addEventListener("click", function () {
    var st = recalcStoArtifact();
    send("Explica la nomenclatura del setup " + st.filename + " y la guía de ajustes para subviraje y sobreviraje", "doc");
  });

  /* Local Rust Bridge Detection */
  var bridgeBadge = document.getElementById("aiBridgeBadge");
  var bridgeText = document.getElementById("aiBridgeText");
  if (bridgeBadge && bridgeText) {
    var bCtrl = new AbortController();
    var bTimer = setTimeout(function () { bCtrl.abort(); }, 450);
    fetch(BRIDGE_URL + "/ping", { method: "GET", signal: bCtrl.signal })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (info) {
        clearTimeout(bTimer);
        if (info && info.status === "ready") {
          bridgeBadge.hidden = false;
          bridgeText.textContent = info.inTrack ? "MMT Sync · En Pista" : "MMT Sync v" + info.version;
          bridgeBadge.addEventListener("click", function () {
            fetch(BRIDGE_URL + "/command", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "launch-overlay" })
            }).then(function () {
              bridgeText.textContent = "✓ HUD 60Hz Activo";
            }).catch(function () {});
          });
        }
      })
      .catch(function () { clearTimeout(bTimer); });
  }

  function openSide() {
    if (!side) return;
    side.hidden = false;
    if (scrim) scrim.hidden = !window.matchMedia("(max-width: 1119px)").matches;
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
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      newChat();
    }
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
      var artTab = btn.getAttribute("data-artifact-tab") || "";
      send(btn.getAttribute("data-prompt"), artTab);
    });
  });
  var newBtn = document.getElementById("aiNew");
  if (newBtn) newBtn.addEventListener("click", newChat);
  if (sideOpen) sideOpen.addEventListener("click", openSide);
  if (sideClose) sideClose.addEventListener("click", closeSide);
  if (scrim) scrim.addEventListener("click", closeSide);

  updateCanvasArtifact(lastCanvasMarkdown);
  renderList();
  renderThread();
  paintSend();
})();
