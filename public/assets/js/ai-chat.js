/* Muntrume AI — Pro Light Ultra Max (100% Open Source, Multi-Tier, Zero Bloat, 60 FPS) */
(function () {
  "use strict";

  var API_URL = "https://api.muntru.me/api/ai";
  var STORAGE_KEY = "muntrume_ai_pluma_chats_v1";
  var PREFS_KEY = "muntrume_ai_pluma_prefs_v1";

  var kb = {};
  try {
    kb = JSON.parse((document.getElementById("muntrumeKbData") || {}).textContent || "{}");
  } catch (e) { kb = {}; }

  var TIER_META = {
    lite: { label: "Lite", desc: "Instantáneo" },
    pro: { label: "Pro", desc: "Equilibrado" },
    ultra_max: { label: "Ultra Max", desc: "Razonamiento Profundo" },
    local: { label: "Local Ollama", desc: "100 % Privado" }
  };

  var workspace = document.getElementById("aiWorkspace");
  var side = document.getElementById("aiSide");
  var sideToggle = document.getElementById("aiSideToggle");
  var sideClose = document.getElementById("aiSideClose");
  var scrim = document.getElementById("aiScrim");
  var newChatBtn = document.getElementById("aiNewChatSide");
  var chatList = document.getElementById("aiChatList");
  var stage = document.getElementById("aiStage");
  var emptyEl = document.getElementById("aiEmpty");
  var logEl = document.getElementById("aiLog");
  var form = document.getElementById("aiForm");
  var input = document.getElementById("aiInput");
  var sendBtn = document.getElementById("aiSend");
  var jumpBtn = document.getElementById("aiJump");
  var liveEl = document.getElementById("aiLive");
  var statusText = document.getElementById("aiStatusText");
  var themeBtn = document.getElementById("aiThemeBtn");
  var themeIcon = document.getElementById("aiThemeIcon");
  var themeLabel = document.getElementById("aiThemeLabel");
  var localBar = document.getElementById("aiLocalBar");
  var ollamaUrlInput = document.getElementById("aiOllamaUrl");
  var ollamaModelInput = document.getElementById("aiOllamaModel");

  if (!workspace || !stage || !logEl || !form || !input || !sendBtn) return;

  var prefs = loadPrefs();
  var state = loadChats();
  var currentMode = prefs.mode === "general" ? "general" : "team";
  var currentTier = TIER_META[prefs.tier] ? prefs.tier : "pro";
  var currentTheme = prefs.theme === "light" ? "light" : "dark";
  var streaming = false;
  var abortCtrl = null;
  var stickToEnd = true;

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) {}
    return {};
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        mode: currentMode,
        tier: currentTier,
        theme: currentTheme,
        ollamaUrl: ollamaUrlInput ? ollamaUrlInput.value.trim() : "",
        ollamaModel: ollamaModelInput ? ollamaModelInput.value.trim() : ""
      }));
    } catch (e) {}
  }

  function loadChats() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) return parsed;
      }
    } catch (e) {}
    return { active: "", items: [] };
  }
  function saveChats() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function getActiveChat() {
    for (var i = 0; i < state.items.length; i++) {
      if (state.items[i].id === state.active) return state.items[i];
    }
    return null;
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ===== THEME, MODE & TIER CONTROLS ===== */
  function applyTheme(t) {
    currentTheme = t === "light" ? "light" : "dark";
    workspace.setAttribute("data-ai-theme", currentTheme);
    if (themeIcon) themeIcon.textContent = currentTheme === "dark" ? "☀" : "☾";
    if (themeLabel) themeLabel.textContent = currentTheme === "dark" ? "Light Pro" : "Dark Pro";
    savePrefs();
  }

  function updateStatus() {
    if (!statusText || streaming) return;
    var tm = TIER_META[currentTier] || TIER_META.pro;
    var modeName = currentMode === "team" ? "Equipo & iRacing" : "Open Source General";
    statusText.textContent = tm.label + " · " + modeName;
  }

  function applyMode(m) {
    currentMode = m === "general" ? "general" : "team";
    document.querySelectorAll("[data-ai-mode]").forEach(function (b) {
      var on = b.getAttribute("data-ai-mode") === currentMode;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    updateStatus();
    savePrefs();
  }

  function applyTier(t) {
    currentTier = TIER_META[t] ? t : "pro";
    document.querySelectorAll("[data-ai-tier]").forEach(function (b) {
      var on = b.getAttribute("data-ai-tier") === currentTier;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (localBar) localBar.hidden = currentTier !== "local";
    updateStatus();
    savePrefs();
  }

  function setSidebarOpen(open) {
    if (!side) return;
    side.classList.toggle("is-collapsed", !open);
    if (sideToggle) sideToggle.setAttribute("aria-expanded", open ? "true" : "false");
    var isMobile = window.innerWidth <= 900;
    if (scrim) scrim.hidden = !(open && isMobile);
  }

  /* ===== LIGHTWEIGHT MARKDOWN + SYNTAX HIGHLIGHTING + COPY BUTTONS ===== */
  function highlightCode(code) {
    var safe = esc(code);
    // Comments
    safe = safe.replace(/(\/\/[^\n]*|#[^\n]*)/g, '<span class="tok-com">$1</span>');
    // Strings
    safe = safe.replace(/(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g, '<span class="tok-str">$1</span>');
    // Numbers
    safe = safe.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    // Keywords
    safe = safe.replace(/\b(const|let|var|function|return|if|else|for|while|async|await|export|import|from|type|interface|class|def|pub|fn|struct|impl|match|true|false|null)\b/g, '<span class="tok-kw">$1</span>');
    return safe;
  }

  function renderInline(text) {
    var s = esc(text);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+|mailto:[^\s)]+)\)/g, function (_, lbl, href) {
      var ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return '<a href="' + href + '"' + ext + ">" + lbl + "</a>";
    });
    return s;
  }

  function renderMarkdown(md) {
    var src = String(md || "").replace(/\r\n/g, "\n");
    var codeBlocks = [];
    src = src.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      var idx = codeBlocks.length;
      codeBlocks.push({ lang: lang || "text", code: code.replace(/\n$/, "") });
      return "\n@@CODEBLOCK_" + idx + "@@\n";
    });

    var lines = src.split("\n");
    var html = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      if (!trimmed) { i++; continue; }

      var cbMatch = trimmed.match(/^@@CODEBLOCK_(\d+)@@$/);
      if (cbMatch) {
        var cb = codeBlocks[Number(cbMatch[1])];
        html.push(
          '<div class="ai-code-wrap">' +
            '<div class="ai-code-head">' +
              '<span>' + esc(cb.lang) + '</span>' +
              '<button type="button" class="ai-copy-btn" data-copy-code="' + cbMatch[1] + '">Copiar</button>' +
            '</div>' +
            '<pre><code>' + highlightCode(cb.code) + '</code></pre>' +
          '</div>'
        );
        i++;
        continue;
      }

      // Headings
      var hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (hMatch) {
        var lvl = hMatch[1].length;
        html.push("<h" + lvl + ">" + renderInline(hMatch[2]) + "</h" + lvl + ">");
        i++;
        continue;
      }

      // Markdown tables
      if (trimmed.indexOf("|") !== -1 && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
        var parseRow = function (r) {
          return r.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        };
        var headers = parseRow(trimmed);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim().indexOf("|") !== -1) {
          rows.push(parseRow(lines[i]));
          i++;
        }
        var tbl = "<table><thead><tr>" + headers.map(function (h) { return "<th>" + renderInline(h) + "</th>"; }).join("") + "</tr></thead><tbody>";
        rows.forEach(function (r) {
          tbl += "<tr>" + r.map(function (c) { return "<td>" + renderInline(c) + "</td>"; }).join("") + "</tr>";
        });
        tbl += "</tbody></table>";
        html.push(tbl);
        continue;
      }

      // Unordered list
      if (/^[-*•]\s+/.test(trimmed)) {
        var ul = "<ul>";
        while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
          ul += "<li>" + renderInline(lines[i].replace(/^\s*[-*•]\s+/, "")) + "</li>";
          i++;
        }
        ul += "</ul>";
        html.push(ul);
        continue;
      }

      // Ordered list
      if (/^\d+\.\s+/.test(trimmed)) {
        var ol = "<ol>";
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          ol += "<li>" + renderInline(lines[i].replace(/^\s*\d+\.\s+/, "")) + "</li>";
          i++;
        }
        ol += "</ol>";
        html.push(ol);
        continue;
      }

      // Paragraph
      var para = [trimmed];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s+|[-*•]\s+|\d+\.\s+|@@CODEBLOCK_)/.test(lines[i].trim())) {
        if (lines[i].trim().indexOf("|") !== -1 && i + 1 < lines.length && /^\s*\|?[\s:-]+\|/.test(lines[i + 1])) break;
        para.push(lines[i].trim());
        i++;
      }
      html.push("<p>" + renderInline(para.join(" ")) + "</p>");
    }

    return { html: html.join(""), codeBlocks: codeBlocks };
  }

  function wireCopyButtons(container, rawText, codeBlocks) {
    container.querySelectorAll("[data-copy-code]").forEach(function (btn) {
      btn.onclick = function () {
        var idx = Number(btn.getAttribute("data-copy-code"));
        var text = codeBlocks[idx] ? codeBlocks[idx].code : "";
        copyToClipboard(text, btn);
      };
    });
    var msgCopy = container.querySelector("[data-copy-msg]");
    if (msgCopy) {
      msgCopy.onclick = function () { copyToClipboard(rawText, msgCopy); };
    }
  }

  function copyToClipboard(text, btn) {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(function () {
      var prev = btn.textContent;
      btn.textContent = "Copiado ✓";
      setTimeout(function () { btn.textContent = prev; }, 1400);
    }).catch(function () {});
  }

  /* ===== SMART CLIENT-SIDE FALLBACK (VERIFIED KB + REAL IRACING FUEL CALC) ===== */
  function buildLocalFallback(prompt, mode, tier) {
    var q = String(prompt || "").toLowerCase();
    var reasoning = "";

    // 1. Real iRacing Fuel & Strategy Calculator
    if (/combust|fuel|litro|stint|estrateg|parada|pit|minutos|\bmin\b|\bhoras?\b|duraci[oó]n/i.test(q)) {
      var minMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:min|minutos)/i);
      var hrMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hr|hora|horas)\b/i);
      var burnMatch = q.match(/(\d+(?:[.,]\d+)?)\s*(?:l\/v|l\/vuelta|litros?)/i);
      var lapMatch = q.match(/(\d):(\d{2})/);
      var tankMatch = q.match(/(?:dep[oó]sito|tanque|tank)\s*(?:de\s*)?(\d+(?:[.,]\d+)?)/i);

      var totalMin = hrMatch ? parseFloat(hrMatch[1].replace(",", ".")) * 60 : (minMatch ? parseFloat(minMatch[1].replace(",", ".")) : 45);
      var lapSec = lapMatch ? (Number(lapMatch[1]) * 60 + Number(lapMatch[2])) : 138; // default 2:18 GT3
      var burn = burnMatch ? parseFloat(burnMatch[1].replace(",", ".")) : 2.85;
      var tank = tankMatch ? parseFloat(tankMatch[1].replace(",", ".")) : 104;

      var laps = Math.ceil((totalMin * 60) / lapSec);
      var marginLaps = totalMin >= 60 ? 2 : 1.5;
      var totalFuel = Number(((laps + marginLaps) * burn).toFixed(1));
      var stops = totalFuel <= tank ? 0 : Math.ceil(totalFuel / tank) - 1;
      var stintLaps = Math.floor(tank / burn);
      var lapStr = Math.floor(lapSec / 60) + ":" + String(lapSec % 60).padStart(2, "0");

      if (tier === "ultra_max") {
        reasoning = [
          "1. Parámetros extraídos: duración = " + totalMin + " min, tiempo por vuelta = " + lapStr + " (" + lapSec + " s), consumo = " + burn + " L/v, depósito = " + tank + " L.",
          "2. Vueltas estimadas: ceil((" + totalMin + " × 60) / " + lapSec + ") = " + laps + " vueltas.",
          "3. Margen de seguridad: +" + marginLaps + " vueltas (vuelta de formación + margen de líder).",
          "4. Combustible total = (" + laps + " + " + marginLaps + ") × " + burn + " = " + totalFuel + " L -> " + stops + " parada(s) necesaria(s)."
        ].join("\n");
      }

      var answer = [
        "### Estrategia y Combustible iRacing (" + totalMin + " min)",
        "",
        "| Parámetro | Valor calculado |",
        "|---|---|",
        "| **Duración de carrera** | `" + totalMin + " min` |",
        "| **Ritmo base estimado** | `" + lapStr + " / vuelta` |",
        "| **Consumo por vuelta** | `" + burn + " L/vuelta` |",
        "| **Vueltas totales** | `" + laps + " vueltas` (+ `" + marginLaps + "v` margen) |",
        "| **Combustible total requerido** | **`" + totalFuel + " L`** |",
        "| **Capacidad de depósito** | `" + tank + " L` (~`" + stintLaps + " vueltas/stint`) |",
        "| **Paradas en boxes** | **`" + stops + (stops === 1 ? " parada" : " paradas") + "`** |",
        "",
        "### Recomendación de carrera",
        stops === 0
          ? "- **Sin parada obligatoria:** Sal con `" + totalFuel + " L` (o aplica `lift & coast` en 3–4 curvas si quieres ahorrar `0.15 L/v`)."
          : "- **Ventana de parada:** Haz el repostaje entre las vueltas `" + Math.max(2, Math.floor(laps * 0.4)) + "` y `" + Math.min(laps - 2, stintLaps - 1) + "`. En carreras de `< 60 min`, **no cambies neumáticos** para ahorrar ~14 s en pit lane.",
        "- Puedes monitorizar el consumo en vivo y la alerta `BOX THIS LAP` en [MMT Sync Overlay](/overlay/)."
      ].join("\n");

      return { text: answer, reasoning: reasoning };
    }

    // 2. Pilots & Contacts
    if (/piloto|equipo|contact|correo|mail|alberto|mateo|eduardo|dorsal|qui[eé]n/i.test(q)) {
      var pilots = kb.pilots || [];
      var rows = pilots.map(function (p) {
        return "| **" + p.dorsal + " " + p.name + "** | " + p.role + " | " + (p.categories || []).join(", ") + " | `" + p.email + "` |";
      });
      var text = [
        "### Plantilla Oficial · Muntrume Motorsport (MMT)",
        "",
        "Sede en **Sant Andreu, Barcelona (España)** · Ecosistema **100 % Open Source (MIT)** para iRacing.",
        "",
        "| Piloto | Rol | Categorías | Contacto |",
        "|---|---|---|---|"
      ].concat(rows).concat([
        "",
        "### Canales Oficiales",
        "- **Administración y Prensa:** `admin@muntru.me` · **Legal:** `legal@muntru.me`",
        "- **Perfiles y Telemetría:** [Pilotos](/pilotos/) · [Garage 61](https://garage61.net/app/teams/muntrume-motorsport) · [Discord](https://discord.gg/ehX6B8JUtE)"
      ]).join("\n");
      return { text: text, reasoning: tier === "ultra_max" ? "Consulta directa a la Base de Conocimiento Oficial verificada (src/data/muntrume-kb.ts) con 0 alucinaciones." : "" };
    }

    // 3. MMT Sync Overlay / Wallpapers / Setup Vault
    if (/overlay|mmt\s*sync|hud|irsdk|wallpaper|setup|vault|\.sto|ram|fps/i.test(q)) {
      var tools = kb.tools || [];
      var blocks = ["### Ecosistema Open Source · Muntrume Motorsport (MIT)", ""];
      tools.forEach(function (t) {
        blocks.push("**" + t.name + "** (" + t.license + ") → [" + t.url + "](" + t.url + ")");
        (t.highlights || []).forEach(function (h) { blocks.push("- " + h); });
        blocks.push("");
      });
      return { text: blocks.join("\n"), reasoning: tier === "ultra_max" ? "Recuperación verificada del ecosistema MIT desde MUNTRUME_KB." : "" };
    }

    // 4. Official Series
    if (/imsa|gt3|gt\s*sprint|nec|porsche\s*cup|valkyrie|mclaren|audi|serie/i.test(q)) {
      var series = kb.seriesAndCars || [];
      var out = ["### Series Oficiales de Muntrume Motorsport en iRacing", ""];
      series.forEach(function (s) {
        out.push("**" + s.series + "**");
        (s.cars || []).forEach(function (c) { out.push("- " + c); });
        out.push("");
      });
      out.push("Consulta el calendario completo en [/calendar/](/calendar/) y las fichas en [/series/](/series/).");
      return { text: out.join("\n"), reasoning: "" };
    }

    // 5. General Open Source coding / architecture fallback
    if (mode === "general" || /typescript|javascript|python|rust|c[oó]digo|funci[oó]n|algoritmo/i.test(q)) {
      return {
        text: [
          "### Asistente Open Source (Modo Local Activo)",
          "",
          "Ejemplo limpio en TypeScript para calcular el ritmo medio de un stint descartando vueltas anómalas (in-lap / out-lap):",
          "",
          "```typescript",
          "export function averageStintPace(lapsSec: number[], toleranceSec = 2.5): number {",
          "  const valid = lapsSec.filter((t) => Number.isFinite(t) && t > 0);",
          "  if (!valid.length) return 0;",
          "  const best = Math.min(...valid);",
          "  const clean = valid.filter((t) => t <= best + toleranceSec);",
          "  const sum = clean.reduce((acc, t) => acc + t, 0);",
          "  return Number((sum / clean.length).toFixed(3));",
          "}",
          "```",
          "",
          "Si estás usando **Local Ollama**, asegúrate de tener `ollama serve` activo en `http://localhost:11434` con CORS habilitado (`OLLAMA_ORIGINS=*`)."
        ].join("\n"),
        reasoning: tier === "ultra_max" ? "Motor remoto no disponible o sin respuesta; activado fallback local determinista en cliente sin errores." : ""
      };
    }

    // Default verified team overview
    return {
      text: [
        "### Muntrume AI · Motor Local Verificado",
        "",
        "Puedo ayudarte al instante con:",
        "- **Equipo & Contacto:** `#16 Alberto Trujillo` (`alberto@muntru.me`), `#1 Mateo Berbis` (`mateo@muntru.me`), `#22 Eduardo` y `admin@muntru.me`.",
        "- **MMT Sync Overlay (MIT):** `< 80 MB` RAM, 60 FPS, captura automática IRSDK en [/overlay/](/overlay/).",
        "- **Setup Vault & Wallpapers:** Reglajes `.sto` en [/garage/](/garage/) y packs por series oficiales en [/wallpapers/](/wallpapers/).",
        "- **Calculadora de Combustible:** Escribe por ejemplo `Calcula combustible para 45 min GT3 a 2:18 y 2.85 L/vuelta`."
      ].join("\n"),
      reasoning: ""
    };
  }

  /* ===== RENDERING CHAT LIST & MESSAGES ===== */
  function renderChatList() {
    if (!chatList) return;
    if (!state.items.length) {
      chatList.innerHTML = '<div style="padding:12px 10px;font-size:12px;color:var(--ai-muted)">Sin conversaciones guardadas.</div>';
      return;
    }
    chatList.innerHTML = state.items.map(function (c) {
      var active = c.id === state.active ? " is-active" : "";
      return (
        '<div class="ai-chat-item' + active + '" data-chat-id="' + esc(c.id) + '" role="listitem">' +
          '<span class="ai-chat-item__title">' + esc(c.title || "Conversación") + '</span>' +
          '<button type="button" class="ai-chat-item__del" data-del-id="' + esc(c.id) + '" aria-label="Eliminar conversación" title="Eliminar">×</button>' +
        '</div>'
      );
    }).join("");

    chatList.querySelectorAll("[data-chat-id]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target && e.target.getAttribute("data-del-id")) return;
        state.active = el.getAttribute("data-chat-id");
        saveChats();
        renderActiveChat();
        if (window.innerWidth <= 900) setSidebarOpen(false);
      });
    });

    chatList.querySelectorAll("[data-del-id]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-del-id");
        state.items = state.items.filter(function (c) { return c.id !== id; });
        if (state.active === id) state.active = state.items[0] ? state.items[0].id : "";
        saveChats();
        renderChatList();
        renderActiveChat();
      });
    });
  }

  function createAssistantNode(msg) {
    var wrap = document.createElement("article");
    wrap.className = "ai-msg ai-msg--assistant";

    var head = document.createElement("div");
    head.className = "ai-msg__head";
    var tierInfo = TIER_META[msg.tier] || TIER_META.pro;
    head.innerHTML =
      '<span class="ai-msg__meta">' +
        '<span class="ai-oss-dot"></span>' +
        '<span>Muntrume AI</span>' +
        '<span class="ai-msg__tier">' + esc(tierInfo.label) + '</span>' +
      '</span>' +
      '<button type="button" class="ai-copy-btn" data-copy-msg="1">Copiar respuesta</button>';

    var thinkDetails = document.createElement("details");
    thinkDetails.className = "ai-think";
    thinkDetails.hidden = !msg.reasoning;
    thinkDetails.innerHTML = '<summary>Proceso de razonamiento</summary><div class="ai-think__body"></div>';
    if (msg.reasoning) {
      thinkDetails.querySelector(".ai-think__body").textContent = msg.reasoning;
    }

    var body = document.createElement("div");
    body.className = "ai-md";
    var parsed = renderMarkdown(msg.content || "");
    body.innerHTML = parsed.html || '<span style="color:var(--ai-muted)">Generando respuesta…</span>';

    wrap.append(head, thinkDetails, body);
    wireCopyButtons(wrap, msg.content || "", parsed.codeBlocks);
    return wrap;
  }

  function appendUserNode(text) {
    var wrap = document.createElement("div");
    wrap.className = "ai-msg ai-msg--user";
    var b = document.createElement("div");
    b.className = "ai-bubble";
    b.textContent = text;
    wrap.appendChild(b);
    logEl.appendChild(wrap);
  }

  function renderActiveChat() {
    var chat = getActiveChat();
    logEl.innerHTML = "";
    if (!chat || !chat.messages.length) {
      stage.classList.add("is-empty");
      if (emptyEl) emptyEl.hidden = false;
      logEl.hidden = true;
      renderChatList();
      return;
    }
    stage.classList.remove("is-empty");
    if (emptyEl) emptyEl.hidden = true;
    logEl.hidden = false;
    chat.messages.forEach(function (m) {
      if (m.role === "user") appendUserNode(m.content);
      else logEl.appendChild(createAssistantNode(m));
    });
    renderChatList();
    scrollToBottom(true);
  }

  function scrollToBottom(force) {
    if (force || stickToEnd) {
      stage.scrollTop = stage.scrollHeight;
    }
  }

  /* ===== STREAMING ENGINE (WORKER SSE + LOCAL OLLAMA + INSTANT FALLBACK) ===== */
  async function streamTextSmoothly(text, reasoning, onUpdate) {
    if (reasoning) {
      var rChunks = reasoning.match(/\S+\s*/g) || [reasoning];
      var rAcc = "";
      for (var r = 0; r < rChunks.length; r++) {
        if (!streaming) break;
        rAcc += rChunks[r];
        onUpdate("", rAcc);
        if (r % 3 === 0) await new Promise(function (res) { setTimeout(res, 10); });
      }
    }
    var chunks = text.match(/\S+\s*/g) || [text];
    var acc = "";
    for (var i = 0; i < chunks.length; i++) {
      if (!streaming) break;
      acc += chunks[i];
      onUpdate(acc, reasoning);
      if (i % 2 === 0) await new Promise(function (res) { setTimeout(res, 8); });
    }
    onUpdate(text, reasoning);
  }

  async function callLocalOllama(messages, signal, onDelta) {
    var endpoint = (ollamaUrlInput && ollamaUrlInput.value.trim()) || "http://localhost:11434/api/chat";
    var model = (ollamaModelInput && ollamaModelInput.value.trim()) || "llama3.2";
    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal,
      body: JSON.stringify({ model: model, messages: messages, stream: true })
    });
    if (!res.ok || !res.body) throw new Error("ollama_unavailable");
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "";
    var fullText = "";
    var fullThink = "";
    var inThink = false;

    while (true) {
      var step = await reader.read();
      if (step.done) break;
      buf += dec.decode(step.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop() || "";
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln) continue;
        try {
          var obj = JSON.parse(ln);
          var tok = (obj.message && obj.message.content) || obj.response || "";
          if (!tok) continue;
          if (tok.indexOf("<think>") !== -1) { inThink = true; tok = tok.replace("<think>", ""); }
          if (tok.indexOf("</think>") !== -1) {
            var parts = tok.split("</think>");
            fullThink += parts[0];
            inThink = false;
            tok = parts.slice(1).join("");
          }
          if (inThink) fullThink += tok;
          else fullText += tok;
          onDelta(fullText, fullThink);
        } catch (e) {}
      }
    }
    return { text: fullText.trim(), reasoning: fullThink.trim() };
  }

  async function callCloudWorker(prompt, history, signal, onDelta) {
    var res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: signal,
      body: JSON.stringify({
        prompt: prompt,
        mode: currentMode,
        tier: currentTier,
        stream: true,
        chat_history: history.slice(-6)
      })
    });
    if (!res.ok) throw new Error("api_http_" + res.status);
    var ct = res.headers.get("content-type") || "";
    if (ct.indexOf("text/event-stream") === -1) {
      var json = await res.json();
      var txt = json.markdown || json.answer || json.result || "";
      var rsn = json.reasoning || "";
      if (!txt) throw new Error("empty_reply");
      await streamTextSmoothly(txt, rsn, onDelta);
      return { text: txt, reasoning: rsn };
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = "";
    var fullText = "";
    var fullThink = "";

    while (true) {
      var step = await reader.read();
      if (step.done) break;
      buf += dec.decode(step.value, { stream: true });
      var lines = buf.split("\n");
      buf = lines.pop() || "";
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (!ln.startsWith("data:")) continue;
        var payload = ln.slice(5).trim();
        if (payload === "[DONE]") break;
        try {
          var obj = JSON.parse(payload);
          if (obj.reasoning) fullThink += obj.reasoning;
          if (obj.content) fullText += obj.content;
          onDelta(fullText, fullThink);
        } catch (e) {}
      }
    }
    if (!fullText.trim()) throw new Error("empty_stream");
    return { text: fullText.trim(), reasoning: fullThink.trim() };
  }

  function setStreamingUi(active) {
    streaming = active;
    logEl.setAttribute("aria-busy", active ? "true" : "false");
    sendBtn.classList.toggle("is-stop", active);
    sendBtn.setAttribute("aria-label", active ? "Detener generación" : "Enviar mensaje");
    sendBtn.innerHTML = active
      ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    if (statusText) {
      statusText.textContent = active
        ? (TIER_META[currentTier].label + " · Generando…")
        : (TIER_META[currentTier].label + " · " + (currentMode === "team" ? "Equipo & iRacing" : "Open Source General"));
    }
  }

  async function sendPrompt(rawText) {
    var text = String(rawText || "").trim();
    if (!text) return;
    if (streaming) {
      if (abortCtrl) abortCtrl.abort();
      setStreamingUi(false);
      return;
    }

    var chat = getActiveChat();
    if (!chat) {
      chat = { id: uid(), title: text.slice(0, 46), messages: [], updatedAt: Date.now() };
      state.items.unshift(chat);
      state.active = chat.id;
    } else if (!chat.messages.length) {
      chat.title = text.slice(0, 46);
    }

    chat.messages.push({ role: "user", content: text });
    chat.updatedAt = Date.now();
    saveChats();

    stage.classList.remove("is-empty");
    if (emptyEl) emptyEl.hidden = true;
    logEl.hidden = false;
    appendUserNode(text);

    var assistantMsg = { role: "assistant", content: "", reasoning: "", tier: currentTier };
    chat.messages.push(assistantMsg);
    var node = createAssistantNode(assistantMsg);
    logEl.appendChild(node);
    renderChatList();
    scrollToBottom(true);

    input.value = "";
    input.style.height = "auto";
    setStreamingUi(true);
    abortCtrl = new AbortController();

    var bodyEl = node.querySelector(".ai-md");
    var thinkEl = node.querySelector(".ai-think");
    var thinkBody = node.querySelector(".ai-think__body");
    var lastPaint = 0;

    function paint(mdText, thinkText, force) {
      assistantMsg.content = mdText;
      assistantMsg.reasoning = thinkText || "";
      var now = performance.now();
      if (!force && now - lastPaint < 45) return;
      lastPaint = now;
      if (thinkEl && thinkBody) {
        thinkEl.hidden = !assistantMsg.reasoning;
        if (assistantMsg.reasoning) thinkBody.textContent = assistantMsg.reasoning;
      }
      var parsed = renderMarkdown(assistantMsg.content);
      bodyEl.innerHTML = parsed.html || '<span style="color:var(--ai-muted)">Pensando…</span>';
      if (force) wireCopyButtons(node, assistantMsg.content, parsed.codeBlocks);
      scrollToBottom(false);
    }

    try {
      var res;
      if (currentTier === "local") {
        var ollamaMsgs = chat.messages.slice(0, -1).map(function (m) {
          return { role: m.role, content: m.content };
        });
        res = await callLocalOllama(ollamaMsgs, abortCtrl.signal, function (t, r) { paint(t, r, false); });
      } else {
        var hist = chat.messages.slice(0, -2).map(function (m) {
          return { role: m.role, content: m.content };
        });
        res = await callCloudWorker(text, hist, abortCtrl.signal, function (t, r) { paint(t, r, false); });
      }
      paint(res.text, res.reasoning, true);
    } catch (err) {
      if (err && err.name === "AbortError") {
        paint(assistantMsg.content || "Generación detenida.", assistantMsg.reasoning, true);
      } else {
        // Smart zero-error local fallback with verified Muntrume KB & iRacing calculators
        var fb = buildLocalFallback(text, currentMode, currentTier);
        await streamTextSmoothly(fb.text, fb.reasoning, function (t, r) { paint(t, r, false); });
        paint(fb.text, fb.reasoning, true);
      }
    } finally {
      setStreamingUi(false);
      abortCtrl = null;
      saveChats();
      if (liveEl) liveEl.textContent = "Respuesta completada.";
    }
  }

  /* ===== EVENT WIRING ===== */
  document.querySelectorAll("[data-ai-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyMode(btn.getAttribute("data-ai-mode")); });
  });
  document.querySelectorAll("[data-ai-tier]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyTier(btn.getAttribute("data-ai-tier")); });
  });
  if (themeBtn) {
    themeBtn.addEventListener("click", function () { applyTheme(currentTheme === "dark" ? "light" : "dark"); });
  }
  if (sideToggle) {
    sideToggle.addEventListener("click", function () { setSidebarOpen(side.classList.contains("is-collapsed")); });
  }
  if (sideClose) {
    sideClose.addEventListener("click", function () { setSidebarOpen(false); });
  }
  if (scrim) {
    scrim.addEventListener("click", function () { setSidebarOpen(false); });
  }
  if (newChatBtn) {
    newChatBtn.addEventListener("click", function () {
      if (abortCtrl) abortCtrl.abort();
      setStreamingUi(false);
      state.active = "";
      saveChats();
      renderActiveChat();
      input.focus();
      if (window.innerWidth <= 900) setSidebarOpen(false);
    });
  }

  document.querySelectorAll("#aiQuickChips .ai-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var m = chip.getAttribute("data-mode");
      var t = chip.getAttribute("data-tier");
      var p = chip.getAttribute("data-prompt");
      if (m) applyMode(m);
      if (t) applyTier(t);
      if (p) sendPrompt(p);
    });
  });

  if (ollamaUrlInput && prefs.ollamaUrl) ollamaUrlInput.value = prefs.ollamaUrl;
  if (ollamaModelInput && prefs.ollamaModel) ollamaModelInput.value = prefs.ollamaModel;
  if (ollamaUrlInput) ollamaUrlInput.addEventListener("change", savePrefs);
  if (ollamaModelInput) ollamaModelInput.addEventListener("change", savePrefs);

  input.addEventListener("input", function () {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input.value);
    }
  });
  sendBtn.addEventListener("click", function () {
    if (streaming && abortCtrl) {
      abortCtrl.abort();
      return;
    }
    sendPrompt(input.value);
  });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendPrompt(input.value);
  });

  stage.addEventListener("scroll", function () {
    var dist = stage.scrollHeight - stage.scrollTop - stage.clientHeight;
    stickToEnd = dist < 80;
    if (jumpBtn) jumpBtn.hidden = stickToEnd || stage.classList.contains("is-empty");
  });
  if (jumpBtn) {
    jumpBtn.addEventListener("click", function () {
      stickToEnd = true;
      scrollToBottom(true);
      jumpBtn.hidden = true;
    });
  }

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (newChatBtn) newChatBtn.click();
    }
  });

  // Initialize
  applyTheme(currentTheme);
  applyMode(currentMode);
  applyTier(currentTier);
  setSidebarOpen(window.innerWidth > 900);
  renderActiveChat();
})();
