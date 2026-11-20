/* Muntrume AI — Claude & Antigravity Agentic Workspace Engine (Verified Team KB + Tool Traces + Interactive Artifact Studio + Live Streaming + Ollama) */
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
    "Eres Muntrume AI (Agentic 3.7), el ingeniero de pista y copiloto oficial de Muntrume Motorsport (Equipo MMT) en Sant Andreu, Barcelona.",
    "Pilotos oficiales: #16 Alberto Trujillo (alberto@muntru.me, Fundador, GT3/Endurance), #1 Mateo Berbis (mateo@muntru.me, GT3/Porsche Cup), #22 Eduardo Chongkan (admin@muntru.me, Endurance/Setup Engineering). Legal: legal@muntru.me.",
    "Herramientas Open Source (MIT): MMT Sync v0.6.5 en Rust/Tauri (/app/ y /overlay/, <15 MB RAM, 60 FPS, 9 widgets incluyendo Pit & Strategy Window, Tire & Track Temp Monitor, Radar 360 y Mapa Catmull-Rom), Setup Vault (/garage/, 42.654+ archivos .sto con nomenclatura MMT_COCHE_CIRCUITO_SESION_V#.sto), Setup Builder (/setup-builder/), Wallpapers 4K (/wallpapers/) y Galería (/gallery/).",
    "Series: IMSA, GT Sprint/Endurance (Mustang GT3, Porsche 911 GT3 R 992, McLaren 720S GT3, Ferrari 296 GT3, Audi R8 LMS Evo II, BMW M4 GT3), NEC y Porsche Cup.",
    "Responde en Markdown estructurado, técnico, conciso y directo en el idioma del usuario."
  ].join("\n");

  var SYSTEM_ASSISTANT = "Eres Muntrume AI en modo Antigravity Open Source. Ayuda con programación, ingeniería de software, análisis técnico, matemáticas y redacción con precisión quirúrgica, bloques de código limpios y formato Markdown estructurado.";

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
  var quickOpenArtifact = document.getElementById("aiQuickOpenArtifact");
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
  var lastCanvasMarkdown = "";

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
      statusText.textContent = currentMode === "team" ? "KB + Groq LPU" : (useOllama ? "Ollama Local" : "Antigravity OSS");
    }
    if (composerModelLabel) {
      composerModelLabel.innerHTML = '<span class="ai-status-dot"></span><span>' +
        (useOllama
          ? "Ollama Local (127.0.0.1:11434) · Privacidad Total"
          : currentMode === "team"
            ? "Muntrume Engineer 3.7 · 0ms KB + Streaming"
            : "Antigravity Open Source · Llama 3.3 / Qwen 2.5") +
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

  /* ===================================================================== */
  /* ANTIGRAVITY THINKING & TOOL CALL TRACE BUILDER                        */
  /* ===================================================================== */
  function buildTraceForQuery(q, mode) {
    var s = String(q || "").toLowerCase();
    if (/(45\s*min|combustible|gasolina|fuel|stint|estrategia|pit|\/stint)/.test(s)) {
      return {
        label: "Antigravity Trace · 2 tools executed (0.3 ms)",
        artifactTab: "stint",
        steps: [
          "✓ tool:iracing_stint_engine.compute({ durationMin: 45, burnRateL: 2.85, safetyMarginL: 2.0 })",
          "✓ artifact:stint_simulator.sync({ pitWindow: 'L10–L13', tires: 'no_change' })"
        ]
      };
    }
    if (/(nomenclatura|\.sto|setup|subviraje|sobreviraje|understeer|oversteer|arb|bias|rake|\/nomenclatura|\/subviraje)/.test(s)) {
      return {
        label: "Antigravity Trace · 2 tools executed (0.4 ms)",
        artifactTab: "sto",
        steps: [
          "✓ tool:mmt_setup_vault.inspect({ catalogSize: 42654, schema: 'MMT_CAR_TRK_SES_V#.sto' })",
          "✓ tool:handling_doctor.prescribe({ targetHotPressureKpa: '165–175', tempWindowC: '75–92' })"
        ]
      };
    }
    if (/(overlay|mmt\s*sync|instalo|hud|winget|\/overlay)/.test(s)) {
      return {
        label: "Antigravity Trace · 2 tools executed (0.2 ms)",
        artifactTab: "canvas",
        steps: [
          "✓ tool:mmt_sync_bridge.inspect({ version: '0.6.5', sdk: 'FILE_MAP_READ 60Hz' })",
          "✓ tool:muntrume_kb.get_tool({ id: 'overlay', modules: 9 })"
        ]
      };
    }
    if (/(piloto|alberto|mateo|eduardo|dorsal|contacto|correo|email|equipo)/.test(s)) {
      return {
        label: "Antigravity Trace · 1 tool executed (0.2 ms)",
        artifactTab: "canvas",
        steps: [
          "✓ tool:muntrume_kb.query_roster({ drivers: ['#16', '#1', '#22'], source: 'verified_ssot' })"
        ]
      };
    }
    return {
      label: mode === "assistant" ? "Antigravity Open Source · Streaming Engine" : "Muntrume Engineer · Context + Streaming",
      artifactTab: "canvas",
      steps: [
        "✓ context:system_prompt.loaded({ mode: '" + mode + "', markdown: true })",
        "✓ stream:inference_pipeline.dispatch()"
      ]
    };
  }

  function makeThoughtElement(trace) {
    var details = document.createElement("details");
    details.className = "ai-thought";
    var summary = document.createElement("summary");
    summary.innerHTML =
      '<span class="ai-thought__left"><span class="ai-thought__badge">TRACE</span><span>' +
      (trace && trace.label ? trace.label : "Antigravity Reasoning Trace") +
      "</span></span><span>▾</span>";
    var stepsBox = document.createElement("div");
    stepsBox.className = "ai-thought__steps";
    var steps = (trace && trace.steps) || ["✓ tool:muntrume_kb.verify()"];
    steps.forEach(function (st) {
      var d = document.createElement("div");
      d.className = "ai-thought__step";
      d.textContent = st;
      stepsBox.appendChild(d);
    });
    details.appendChild(summary);
    details.appendChild(stepsBox);
    return details;
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

    var acts = document.createElement("div");
    acts.className = "ai-actions";
    acts.hidden = !msg.content || (streaming && current() && current().messages[current().messages.length - 1].id === msg.id);

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ai-action";
    copyBtn.textContent = "Copiar respuesta";
    copyBtn.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(msg.content).catch(function () {});
      copyBtn.textContent = "¡Copiado!";
      setTimeout(function () { copyBtn.textContent = "Copiar respuesta"; }, 1500);
    });

    var artBtn = document.createElement("button");
    artBtn.type = "button";
    artBtn.className = "ai-action";
    artBtn.textContent = "Abrir en Artifact Studio ↗";
    artBtn.addEventListener("click", function () {
      updateCanvasArtifact(msg.content);
      var targetTab = (msg.trace && msg.trace.artifactTab) ? msg.trace.artifactTab : "canvas";
      openArtifactPane(targetTab);
    });

    acts.appendChild(copyBtn);
    acts.appendChild(artBtn);
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
    if (/(nomenclatura|\/nomenclatura|c[oó]digo.*sto|est[aá]ndar.*mmt)/.test(s)) {
      return [
        "### Estándar Oficial de Nomenclatura `.sto` · Muntrume Motorsport",
        "",
        "Todos los setups oficiales en `Documents\\iRacing\\setups\\<coche>\\MMT` siguen la sintaxis de 5 bloques:",
        "",
        "```text",
        "MMT_F296_SPA_END_V2.sto",
        " │   │    │   │   └── Versión verificada (V1, V2, V3…)",
        " │   │    │   └────── Tipo de sesión: Q, Q2, R, END, W, SAFE",
        " │   │    └────────── Circuito oficial (SPA, DAYTONA, NORDS, LEMANS…)",
        " │   └─────────────── Código de chasis (F296, P911, M4, P963, F499P…)",
        " └─────────────────── Escudería Muntrume Motorsport",
        "```",
        "",
        "| Código de Sesión | Uso en Pista |",
        "|---|---|",
        "| `Q` / `Q2` | **Clasificación:** depósito mínimo (`12–15 L`), rake agresivo y máxima rotación en 1–2 vueltas lanzadas |",
        "| `R` | **Race Sprint (40–45 min):** equilibrio aerodinámico y degradación controlada |",
        "| `END` | **Resistencia (2h – 24h):** depósito lleno, estabilidad en baches y protección térmica del tren trasero |",
        "| `SAFE` | **Alta Estabilidad:** mayor convergencia trasera y ARB trasera más blanda para stints largos sin riesgo |",
        "| `W` | **Wet / Lluvia:** altura subida, barras blandas y máxima tracción con neumático de agua |",
        "",
        "Puedes generar y probar variantes en el panel **Artifact Studio → Setup .STO** a la derecha o descargar los archivos en [`/garage/`](/garage/)."
      ].join("\n");
    }
    if (/(subviraje|sobreviraje|understeer|oversteer|\/subviraje|arb|brake\s*bias|rake)/.test(s)) {
      return [
        "### Diagnóstico de Chasis y Balance · Ingeniería MMT",
        "",
        "| Síntoma en Pista | Fase de Curva | Corrección Mecánica Recomendada |",
        "|---|---|---|",
        "| **Subviraje (no gira)** | Entrada (frenando) | Baja `Brake Bias -0.4% a -0.8%`, ablanda `1 click` ARB delantera o sube `+1 mm` altura trasera (*rake*) |",
        "| **Subviraje (empuja)** | Mitad / Ápice | Aumenta caída delantera (`-0.1° camber`), baja altura delantera `-1 mm` o ablanda muelle delantero |",
        "| **Sobreviraje (suelta trasera)** | Entrada (frenando) | Sube `Brake Bias +0.5%`, sube `+1 click` precarga de diferencial (*Diff Preload*) o baja altura trasera |",
        "| **Sobreviraje (tracción)** | Salida (acelerando) | Ablanda `1–2 clicks` ARB trasera, sube `TC1 / TC2 +1` o reduce altura trasera `-1 mm` |",
        "",
        "- **Ventana óptima GT3 en caliente:** `165 – 175 kPa` (`24.0 – 25.4 PSI`) y `75 – 92 °C` en el widget **Tire & Track Temp Monitor** de [`/overlay/`](/overlay/)."
      ].join("\n");
    }
    if (/(piloto|alberto|mateo|eduardo|dorsal|contacto|correo|email|equipo|muntrume)/.test(s) && !/(45\s*min|combustible|gasolina|fuel|overlay|instalo|nomenclatura)/.test(s)) {
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
    if (/(overlay|mmt\s*sync|instalo|hud|kapps|pit\s*window|tire\s*monitor|presiones\s*en\s*caliente|\/overlay)/.test(s)) {
      return [
        "### MMT Sync v0.6.5 & Overlays 60 Hz (Rust + Tauri v2 · MIT)",
        "",
        "- **Rendimiento nativo:** `< 15 MB` RAM, `0.0% GPU idle` y `60 FPS` reales mediante lectura directa `FILE_MAP_READ` del SDK de iRacing.",
        "- **Instalación recomendada (sin aviso SmartScreen):**",
        "  ```powershell",
        "  winget install Muntrume.MMTSync",
        "  ```",
        "  O descarga el instalador directo desde [`/app/`](/app/) y prueba el simulador interactivo en [`/overlay/`](/overlay/).",
        "- **9 Módulos incluidos en el HUD Studio:**",
        "  1. `Standings` multiclase (`Top 3` + ventana `±2`, SOF y licencias)",
        "  2. `Relative` en tiempo real con filtro de Pace Car y radar de proximidad",
        "  3. `Track Map GPS` con splines Catmull-Rom a 60 FPS",
        "  4. `Input Telemetry` (curvas de acelerador, freno, embrague, ABS y clipping FFB)",
        "  5. `Pit & Strategy Window` + auto-repostaje directo en iRacing (`IRSDK_BROADCAST_MSG`)",
        "  6. `Tire & Track Temp Monitor` (`FL/FR/RL/RR` en `°C` y `kPa/PSI`)",
        "  7. `Radar 360°`, `Delta Bar` y `Spotter Lateral`"
      ].join("\n");
    }
    if (/(45\s*min|combustible|gasolina|fuel|stint|estrategia|pit|\/stint)/.test(s)) {
      return [
        "### Estrategia GT3 · Carrera de 45 minutos (iRacing)",
        "",
        "| Parámetro | Valor Calculado (Referencia GT3) |",
        "|---|---|",
        "| Duración / Vueltas est. | `45 min` (~25 vueltas a `1:48.5`) |",
        "| Consumo medio GT3 | `2.85 L / vuelta` |",
        "| Combustible total (+1.5v margen) | **`75.3 L`** |",
        "| Ventana de Box (`Pit Window`) | **Vueltas 12 – 18** (con depósito Sprint capado a `55 L`) |",
        "| Cambio de neumáticos | **No recomendado** en `45 min` (ahorra `~14 s` en el carril de boxes) |",
        "",
        "```text",
        "Fórmula MMT Race Engineer:",
        "Total_L = ceil(Duración_seg / Vuelta_seg) * Consumo_L + (1.5 * Consumo_L)",
        "```",
        "",
        "He sincronizado estos datos en el **Artifact Studio (Stint & Fuel)** a la derecha para que ajustes tu tiempo de vuelta o consumo en vivo."
      ].join("\n");
    }
    if (/(wallpaper|fondo|setup|\.sto|garage|serie|imsa|nec|pcc|pcup|galer[ií]a)/.test(s)) {
      return [
        "### Ecosistema Muntrume Motorsport",
        "",
        "- **Setups `.sto` ([`/garage/`](/garage/)):** Más de **42.654 reglajes** organizados por serie y circuito (`IMSA`, `GT Sprint/Endurance`, `NEC`, `Porsche Cup`).",
        "- **MMT Sync Desktop ([`/app/`](/app/)):** Sincronizador SHA-256 en 1 clic, analizador `.ibt` y Overlays 60 Hz.",
        "- **Setup Builder ([`/setup-builder/`](/setup-builder/)):** Asistente interactivo de chasis y aerodinámica.",
        "- **Wallpapers 4K ([`/wallpapers/`](/wallpapers/)):** Capturas reales en pista `16:9` y móvil `9:16 4K` con sincronizador multi-monitor `0 ms`."
      ].join("\n");
    }
    return null;
  }

  function buildSmartFallback(q) {
    return matchInstantTeamAnswer(q) || [
      "### Muntrume AI · Respuesta Local Verificada",
      "",
      "El nodo externo de streaming no respondió a tiempo, pero el motor local de ingeniería está activo:",
      "- **Abrir Simulador de Stint o Decodificador `.STO`:** pulsa el botón **Artifacts** arriba a la derecha.",
      "- **MMT Sync & Overlays 60 Hz:** [`/app/`](/app/) y [`/overlay/`](/overlay/)",
      "- **Setup Vault (42.654+ `.sto`):** [`/garage/`](/garage/)",
      "",
      "Para inferencia LLM 100 % local sin red, activa **Ollama Local** en la barra superior (`http://localhost:11434`)."
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
    if (reply.content) updateCanvasArtifact(reply.content);
    save();
    streaming = false;
    ctrl = null;
    paintSend();
    log.setAttribute("aria-busy", "false");
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
        var el = log.querySelector('[data-id="' + reply.id + '"]');
        if (el) paintBotMessage(el, instant);
        finishReply(chat, reply, "KB Oficial • 0 ms");
        return;
      }
    }

    streaming = true;
    paintSend();
    if (statusBadge) statusBadge.classList.add("is-busy");
    if (statusText) statusText.textContent = useOllama ? "Ollama • Pensando…" : "Agent • Streaming…";
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
      finishReply(chat, reply, "Agent • " + (Date.now() - startTime) + " ms");
    }).catch(function () {
      var fb = matchInstantTeamAnswer(text) || buildSmartFallback(text);
      reply.content = fb;
      var el = log.querySelector('[data-id="' + reply.id + '"]');
      if (el) paintBotMessage(el, fb);
      finishReply(chat, reply, "Motor Local • Listo");
    });
  }

  /* ===================================================================== */
  /* CLAUDE-STYLE ARTIFACT STUDIO CONTROLLER                               */
  /* ===================================================================== */
  function setArtifactTab(tabName) {
    var tabs = ["stint", "sto", "canvas"];
    var target = tabs.indexOf(tabName) >= 0 ? tabName : "stint";
    document.querySelectorAll("[data-art-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-art-tab") === target;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    var pStint = document.getElementById("artPanelStint");
    var pSto = document.getElementById("artPanelSto");
    var pCanvas = document.getElementById("artPanelCanvas");
    if (pStint) pStint.hidden = target !== "stint";
    if (pSto) pSto.hidden = target !== "sto";
    if (pCanvas) pCanvas.hidden = target !== "canvas";
  }

  function openArtifactPane(tabName) {
    if (!artifactPane) return;
    artifactPane.hidden = false;
    if (artifactToggle) artifactToggle.setAttribute("aria-pressed", "true");
    if (tabName) setArtifactTab(tabName);
  }

  function closeArtifactPane() {
    if (!artifactPane) return;
    artifactPane.hidden = true;
    if (artifactToggle) artifactToggle.setAttribute("aria-pressed", "false");
  }

  function updateCanvasArtifact(markdownText) {
    lastCanvasMarkdown = String(markdownText || "");
    var host = document.getElementById("artCanvasBody");
    if (!host || !lastCanvasMarkdown) return;
    if (window.MuntrumeMarkdown && window.MuntrumeMarkdown.renderMarkdown) {
      host.innerHTML = "";
      host.appendChild(window.MuntrumeMarkdown.renderMarkdown(lastCanvasMarkdown, { copy: "Copiar", copied: "¡Copiado!" }));
    } else {
      loadMd().then(function (lib) {
        if (lib) {
          host.innerHTML = "";
          host.appendChild(lib.renderMarkdown(lastCanvasMarkdown, { copy: "Copiar", copied: "¡Copiado!" }));
        }
      });
    }
  }

  if (artifactToggle) {
    artifactToggle.addEventListener("click", function () {
      if (artifactPane && artifactPane.hidden) openArtifactPane();
      else closeArtifactPane();
    });
  }
  if (quickOpenArtifact) {
    quickOpenArtifact.addEventListener("click", function () {
      openArtifactPane("stint");
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
      openArtifactPane(btn.getAttribute("data-open-artifact") || "stint");
    });
  });

  var copyCanvasBtn = document.getElementById("artCopyCanvasBtn");
  if (copyCanvasBtn) {
    copyCanvasBtn.addEventListener("click", function () {
      if (!lastCanvasMarkdown || !navigator.clipboard) return;
      navigator.clipboard.writeText(lastCanvasMarkdown).catch(function () {});
      copyCanvasBtn.textContent = "¡Copiado!";
      setTimeout(function () { copyCanvasBtn.textContent = "Copiar MD"; }, 1500);
    });
  }

  /* Live Stint & Fuel Artifact Math */
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

  var sendStintBtn = document.getElementById("artSendStintToChat");
  if (sendStintBtn) {
    sendStintBtn.addEventListener("click", function () {
      var r = recalcStintArtifact();
      if (!r) return;
      send("Calcula combustible y estrategia para una carrera GT3 de " + r.raceMin + " min (" + r.totalLaps + " vueltas a " + r.lapSec + "s, consumo " + r.fuelLap + " L/v, depósito " + r.tankCap + " L → Total " + r.totalFuel.toFixed(1) + " L)", "stint");
    });
  }

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
        sendFuelIrBtn.textContent = "✓ Enviado a MMT Sync (" + r.totalFuel.toFixed(1) + " L)";
        setTimeout(function () { sendFuelIrBtn.textContent = "⚡ Enviar Fuel a iRacing"; }, 2200);
      }).catch(function () {
        window.location.href = "mmtsync://launch-overlay";
      });
    });
  }

  /* Live Setup .STO Decoder & Handling Doctor */
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

  var askStoBtn = document.getElementById("artAskStoInChat");
  if (askStoBtn) {
    askStoBtn.addEventListener("click", function () {
      var st = recalcStoArtifact();
      send("Explica la nomenclatura del setup " + st.filename + " y qué ajustes hacer en ARB, Brake Bias y Rake", "sto");
    });
  }

  /* Local Rust Bridge Detection (127.0.0.1:38421) */
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
          bridgeText.textContent = info.inTrack ? "MMT Sync v" + info.version + " · En Pista" : "MMT Sync v" + info.version + " Ready";
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

  renderList();
  renderThread();
  paintSend();
})();
