/**
 * Muntrume AI Studio (v3.1 — Clean Open Source, Zero Emojis, Header-Theme Synced)
 * Racing-branded Open Source engines (Muntrume 1.0 Lite / Pro / Ultra Max / Local),
 * Projects, Skills, Memory, Web Search, GitHub Context, Vision & File Upload,
 * Split-Screen Artifacts Studio, and 1-Click Export (DOC, PDF, Slides HTML, Code).
 */
(function () {
  "use strict";

  const API_URL = "https://muntrume.atrumin16.workers.dev/api/ai";
  const STORAGE_KEY = "muntrume_ai_studio_v3";
  const HANDOFF_KEY = "muntrume_ai_handoff";

  const MODELS = {
    lite: { id: "lite", label: "Muntrume 1.0 Lite" },
    pro: { id: "pro", label: "Muntrume 1.0 Pro" },
    ultra_max: { id: "ultra_max", label: "Muntrume 1.0 Ultra Max" },
    local: { id: "local", label: "Muntrume Local" }
  };

  const SKILLS = {
    "": { label: "Sin skill activa", short: "" },
    setup: { label: "Ingeniero de Setups iRacing", short: "Skill: Setups iRacing" },
    strategy: { label: "Estrategia y combustible", short: "Skill: Estrategia" },
    code: { label: "Código y artefacto HTML", short: "Skill: Código Live" },
    slides: { label: "Presentación Slides", short: "Skill: Slides" },
    doc: { label: "Documento Word / PDF", short: "Skill: Documento" }
  };

  const DEFAULT_PROJECTS = [
    { id: "general", name: "Espacio General", prompt: "" },
    { id: "iracing", name: "Ingeniería iRacing y Setups", prompt: "Enfócate en ingeniería de simracing iRacing (GT3, GTP, Porsche Cup, NEC VLN), balance aerodinámico, presiones, estrategia de stints y telemetría Garage 61." },
    { id: "dev", name: "Código y Web Apps", prompt: "Responde como arquitecto senior de software. Cuando se pida una app, componente, gráfico o herramienta visual, genera un bloque ```html completo y autocontenido para verlo en vivo en Artefactos." }
  ];

  const SVG_BOLT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
  const SVG_SEND = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
  const SVG_STOP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let state = loadState();
  let streaming = false;
  let activeCtrl = null;
  let currentArtifact = null;
  let pendingAttachment = null;

  function loadState() {
    const fallback = {
      tier: "pro",
      effort: "medium",
      webSearch: true,
      memoryOn: true,
      skill: "",
      projectId: "general",
      projects: DEFAULT_PROJECTS.slice(),
      customInstructions: "",
      memory: "Equipo: Muntrume Motorsport (Barcelona). Pilotos: #16 Alberto Trujillo, #1 Mateo Berbis, #22 Eduardo Chongkan.",
      ollamaUrl: "http://localhost:11434/api/chat",
      ollamaModel: "llama3.1:8b",
      chats: [],
      activeChatId: null,
      artifacts: []
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        ...fallback,
        ...parsed,
        projects: Array.isArray(parsed.projects) && parsed.projects.length ? parsed.projects : fallback.projects,
        chats: Array.isArray(parsed.chats) ? parsed.chats : [],
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : []
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state,
        chats: state.chats.slice(0, 40),
        artifacts: state.artifacts.slice(0, 40)
      }));
    } catch {}
  }

  function getActiveChat() {
    return state.chats.find((c) => c.id === state.activeChatId) || null;
  }

  function createNewChat(initialTitle = "Nueva conversación") {
    const id = "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const chat = { id, title: initialTitle, projectId: state.projectId, updatedAt: Date.now(), messages: [] };
    state.chats.unshift(chat);
    state.activeChatId = id;
    saveState();
    return chat;
  }

  function setGreeting() {
    const el = $("aiGreeting");
    if (!el) return;
    const h = new Date().getHours();
    if (h >= 6 && h < 13) el.textContent = "Buenos días en pista";
    else if (h >= 13 && h < 20) el.textContent = "¿Qué construimos hoy?";
    else el.textContent = "Sesión nocturna de ingeniería";
  }

  function syncComposerControls() {
    const m = MODELS[state.tier] || MODELS.pro;
    const mLbl = $("aiModelBtnLabel");
    if (mLbl) mLbl.textContent = m.label;
    document.querySelectorAll("[data-select-tier]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.selectTier === state.tier);
    });
    const localBar = $("aiLocalBar");
    if (localBar) localBar.hidden = state.tier !== "local";

    const effortLabels = { low: "Rápido", medium: "Medio", high: "Profundo" };
    const effBtn = $("aiEffortBtn");
    if (effBtn) effBtn.textContent = effortLabels[state.effort] || "Medio";

    $("aiMenuWebCheck")?.classList.toggle("is-on", state.webSearch);
    $("aiMenuMemCheck")?.classList.toggle("is-on", state.memoryOn);
    renderContextPills();
  }

  function renderContextPills() {
    const bar = $("aiContextPills");
    if (!bar) return;
    const pills = [];
    const proj = state.projects.find((p) => p.id === state.projectId);
    if (proj && proj.id !== "general") {
      pills.push(`<span class="ai-ctx-pill">Proyecto: ${esc(proj.name)} <button type="button" data-clear-proj aria-label="Quitar proyecto">×</button></span>`);
    }
    if (state.skill && SKILLS[state.skill]) {
      pills.push(`<span class="ai-ctx-pill">${esc(SKILLS[state.skill].short)} <button type="button" data-clear-skill aria-label="Quitar skill">×</button></span>`);
    }
    if (state.webSearch) {
      pills.push(`<span class="ai-ctx-pill ai-ctx-pill--accent">Web en vivo</span>`);
    }
    if (pendingAttachment) {
      const prefix = pendingAttachment.kind === "image" ? "Imagen" : pendingAttachment.kind === "github" ? "GitHub" : "Archivo";
      pills.push(`<span class="ai-ctx-pill">${prefix}: ${esc(pendingAttachment.name)} <button type="button" data-clear-att aria-label="Quitar adjunto">×</button></span>`);
    }
    bar.innerHTML = pills.join("");
    bar.hidden = pills.length === 0;
  }

  function renderChatList() {
    const list = $("aiChatList");
    if (!list) return;
    const q = ($("aiSearchInput")?.value || "").trim().toLowerCase();
    const items = state.chats.filter((c) => {
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || c.messages.some((m) => String(m.content || "").toLowerCase().includes(q));
    });
    if (!items.length) {
      list.innerHTML = `<div class="ai-chat-empty">${q ? "Sin resultados." : "Tus conversaciones aparecerán aquí."}</div>`;
      return;
    }
    list.innerHTML = items.map((c) => `
      <div class="ai-chat-item ${c.id === state.activeChatId ? "is-active" : ""}" data-chat-id="${esc(c.id)}">
        <button type="button" class="ai-chat-item__btn" data-open-chat="${esc(c.id)}">${esc(c.title || "Sin título")}</button>
        <button type="button" class="ai-chat-item__del" data-del-chat="${esc(c.id)}" title="Eliminar chat" aria-label="Eliminar">×</button>
      </div>
    `).join("");
  }

  // ============================================================================
  // MARKDOWN + ARTIFACTS + EXPORTS (DOC, PDF, SLIDES, FILE)
  // ============================================================================
  function extractArtifactsFromMarkdown(md) {
    const found = [];
    const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let m, idx = 0;
    while ((m = re.exec(md || "")) !== null) {
      const lang = (m[1] || "text").toLowerCase();
      const code = (m[2] || "").trim();
      if (!code) continue;
      idx++;
      if (lang === "html" || lang === "htm") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "html", lang, title: "Vista previa HTML", code });
      } else if (lang === "svg") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "svg", lang, title: "Diagrama SVG", code });
      } else if (lang === "slides") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "slides", lang, title: "Presentación", code });
      } else if (code.length >= 120) {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "code", lang, title: `Código (${lang.toUpperCase()})`, code });
      }
    }
    return found;
  }

  function inlineFmt(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function renderMarkdownHtml(md) {
    let text = String(md || "");
    const blocks = [];
    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const i = blocks.length;
      blocks.push({ lang: (lang || "text").toLowerCase(), code: code.trim() });
      return `@@CODEBLOCK_${i}@@`;
    });

    const lines = text.split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (ln.trim().startsWith("|") && ln.trim().endsWith("|") && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
        const hdr = ln.trim().slice(1, -1).split("|").map((c) => `<th>${inlineFmt(c.trim())}</th>`).join("");
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|") && lines[i].trim().endsWith("|")) {
          const cols = lines[i].trim().slice(1, -1).split("|").map((c) => `<td>${inlineFmt(c.trim())}</td>`).join("");
          rows.push(`<tr>${cols}</tr>`);
          i++;
        }
        out.push(`<div class="ai-table-wrap"><table class="ai-md-table"><thead><tr>${hdr}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`);
        continue;
      }
      if (/^###\s+/.test(ln)) out.push(`<h3>${inlineFmt(ln.replace(/^###\s+/, ""))}</h3>`);
      else if (/^##\s+/.test(ln)) out.push(`<h2>${inlineFmt(ln.replace(/^##\s+/, ""))}</h2>`);
      else if (/^#\s+/.test(ln)) out.push(`<h1>${inlineFmt(ln.replace(/^#\s+/, ""))}</h1>`);
      else if (/^[-*]\s+/.test(ln.trim())) {
        const items = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
          items.push(`<li>${inlineFmt(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ul>${items.join("")}</ul>`);
        continue;
      } else if (/^\d+\.\s+/.test(ln.trim())) {
        const items = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
          items.push(`<li>${inlineFmt(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`);
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
        continue;
      } else if (/^@@CODEBLOCK_(\d+)@@$/.test(ln.trim())) {
        out.push(ln.trim());
      } else if (ln.trim()) {
        out.push(`<p>${inlineFmt(ln)}</p>`);
      }
      i++;
    }

    let html = out.join("\n");
    html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_, idx) => {
      const b = blocks[Number(idx)];
      if (!b) return "";
      const isPreviewable = b.lang === "html" || b.lang === "svg" || b.lang === "slides";
      const encoded = encodeURIComponent(b.code);
      return `
        <div class="ai-code-card">
          <div class="ai-code-card__bar">
            <span>${esc(b.lang.toUpperCase())}</span>
            <div class="ai-code-card__btns">
              ${isPreviewable ? `<button type="button" class="ai-mini-btn ai-mini-btn--accent" data-preview-code="${encoded}" data-preview-lang="${esc(b.lang)}">Abrir vista previa</button>` : ""}
              <button type="button" class="ai-mini-btn" data-copy-code="${encoded}">Copiar</button>
            </div>
          </div>
          <pre><code>${esc(b.code)}</code></pre>
        </div>
      `;
    });
    return html;
  }

  function renderMessages() {
    const chat = getActiveChat();
    const emptyEl = $("aiEmptyState");
    const feedEl = $("aiFeed");
    const stageEl = $("aiStage");
    if (!feedEl || !emptyEl || !stageEl) return;

    const hasMsgs = Boolean(chat && chat.messages.length > 0);
    emptyEl.hidden = hasMsgs;
    feedEl.hidden = !hasMsgs;
    stageEl.classList.toggle("is-chatting", hasMsgs);

    if (!hasMsgs) {
      feedEl.innerHTML = "";
      return;
    }

    feedEl.innerHTML = chat.messages.map((msg, idx) => {
      if (msg.role === "user") {
        const attHtml = msg.image
          ? `<img src="${esc(msg.image)}" alt="Adjunto" class="ai-msg-img" />`
          : msg.attachmentName
          ? `<div class="ai-msg-att">Adjunto: ${esc(msg.attachmentName)}</div>`
          : "";
        return `
          <div class="ai-msg ai-msg--user">
            <div class="ai-bubble ai-bubble--user">
              ${attHtml}
              <div>${esc(msg.content).replace(/\n/g, "<br>")}</div>
            </div>
          </div>
        `;
      }
      const thinkHtml = msg.reasoning
        ? `<details class="ai-think"><summary>Proceso de razonamiento (${esc(msg.modelBrand || "Muntrume 1.0 Ultra Max")})</summary><pre>${esc(msg.reasoning)}</pre></details>`
        : "";
      const encodedMd = encodeURIComponent(msg.content || "");
      return `
        <div class="ai-msg ai-msg--bot" data-msg-idx="${idx}">
          <div class="ai-bot-avatar" aria-hidden="true">${SVG_BOLT}</div>
          <div class="ai-bot-body">
            <div class="ai-bot-meta">
              <strong>${esc(msg.modelBrand || "Muntrume 1.0 Pro")}</strong>
              ${msg.usedWeb ? `<span class="ai-meta-tag">Web</span>` : ""}
              ${msg.usedGithub ? `<span class="ai-meta-tag">GitHub</span>` : ""}
              ${msg.usedVision ? `<span class="ai-meta-tag">Visión</span>` : ""}
            </div>
            ${thinkHtml}
            <div class="ai-md">${renderMarkdownHtml(msg.content)}</div>
            <div class="ai-msg-actions">
              <button type="button" class="ai-act-btn" data-copy-md="${encodedMd}">Copiar</button>
              <button type="button" class="ai-act-btn" data-open-doc-artifact="${idx}">Artefacto</button>
              <button type="button" class="ai-act-btn" data-export-doc="${idx}">DOC</button>
              <button type="button" class="ai-act-btn" data-export-pdf="${idx}">PDF</button>
              <button type="button" class="ai-act-btn" data-export-slides="${idx}">Slides</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    feedEl.scrollTop = feedEl.scrollHeight;
  }

  function buildSlidesHtml(title, content) {
    const rawSlides = String(content || "").split(/\n---+\n/).map((s) => s.trim()).filter(Boolean);
    const slides = rawSlides.length > 1
      ? rawSlides
      : String(content || "").split(/\n(?=#{1,2}\s)/).map((s) => s.trim()).filter(Boolean);
    const finalSlides = slides.length ? slides : [content || title];
    const slideDivs = finalSlides.map((s, i) => `
      <section class="slide ${i === 0 ? "active" : ""}">
        <div class="slide-num">${i + 1} / ${finalSlides.length}</div>
        <div class="slide-body">${renderMarkdownHtml(s)}</div>
      </section>
    `).join("");

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      *{box-sizing:border-box}body{margin:0;background:#111315;color:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column}
      .deck{flex:1;display:grid;place-items:center;padding:36px}
      .slide{display:none;width:min(960px,100%);min-height:460px;background:#1a1d21;border:1px solid #2d323a;border-radius:18px;padding:44px 52px;position:relative}
      .slide.active{display:flex;flex-direction:column;justify-content:center}
      .slide-num{position:absolute;top:18px;right:24px;font:600 12px monospace;color:#10b981}
      h1,h2{margin:0 0 18px;color:#fff}h1{font-size:34px}h2{font-size:26px;color:#10b981}
      p,li{font-size:18px;line-height:1.6;color:#d1d5db}ul,ol{padding-left:22px}
      table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:10px 14px;border:1px solid #30343c;text-align:left;font-size:15px}th{background:#121417;color:#10b981}
      .bar{display:flex;justify-content:space-between;align-items:center;padding:12px 24px;background:#0b0d0f;border-top:1px solid #262930}
      button{background:#10b981;color:#04130d;border:0;border-radius:999px;padding:8px 18px;font-weight:700;cursor:pointer}
    </style></head><body>
      <div class="deck">${slideDivs}</div>
      <div class="bar"><span style="font:600 12px monospace;color:#9ca3af">Muntrume AI · Presentación</span><div><button onclick="go(-1)">Anterior</button> <button onclick="go(1)">Siguiente</button></div></div>
      <script>let i=0,ss=[...document.querySelectorAll('.slide')];function go(d){ss[i].classList.remove('active');i=(i+d+ss.length)%ss.length;ss[i].classList.add('active')}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1)});</script>
    </body></html>`;
  }

  function buildDocHtml(title, md) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:Segoe UI,system-ui,sans-serif;max-width:800px;margin:36px auto;padding:0 24px;color:#111827;line-height:1.6}
      h1,h2,h3{color:#0f172a;margin-top:24px}h1{border-bottom:2px solid #10b981;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #d1d5db;padding:8px 12px;text-align:left}th{background:#f3f4f6}
      pre{background:#f3f4f6;padding:14px;border-radius:8px;overflow:auto;font-size:12.5px}code{font-family:Consolas,monospace}
      .hdr{font:600 11px monospace;color:#059669;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
    </style></head><body>
      <div class="hdr">Muntrume Motorsport · Documento generado por Muntrume AI</div>
      <h1>${esc(title)}</h1>
      ${renderMarkdownHtml(md)}
    </body></html>`;
  }

  function openArtifactPane(artifact) {
    currentArtifact = artifact;
    const pane = $("aiArtifactPane");
    const ws = $("aiWorkspace");
    if (!pane || !ws) return;

    $("aiArtTitle").textContent = artifact.title || "Artefacto";
    $("aiArtBadge").textContent = (artifact.type || "doc").toUpperCase();
    $("aiArtCode").textContent = artifact.code || "";

    const frame = $("aiArtFrame");
    let srcDoc = "";
    if (artifact.type === "html") {
      srcDoc = /<html|<body|<!doctype/i.test(artifact.code)
        ? artifact.code
        : `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#141517;color:#f3f4f6}</style></head><body>${artifact.code}</body></html>`;
    } else if (artifact.type === "svg") {
      srcDoc = `<!doctype html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#141517;padding:24px">${artifact.code}</body></html>`;
    } else if (artifact.type === "slides") {
      srcDoc = buildSlidesHtml(artifact.title || "Presentación Muntrume", artifact.code);
    } else {
      srcDoc = buildDocHtml(artifact.title || "Documento Muntrume AI", artifact.code);
    }
    if (frame) frame.srcdoc = srcDoc;

    switchArtifactTab("preview");
    pane.hidden = false;
    ws.classList.add("has-artifact");

    if (!state.artifacts.some((a) => a.code === artifact.code)) {
      state.artifacts.unshift({ ...artifact, createdAt: Date.now() });
      saveState();
    }
  }

  function closeArtifactPane() {
    const pane = $("aiArtifactPane");
    const ws = $("aiWorkspace");
    if (pane) pane.hidden = true;
    if (ws) ws.classList.remove("has-artifact");
  }

  function switchArtifactTab(tab) {
    const isCode = tab === "code";
    $("aiArtTabPreview")?.classList.toggle("is-active", !isCode);
    $("aiArtTabCode")?.classList.toggle("is-active", isCode);
    const frame = $("aiArtFrame");
    const codeWrap = $("aiArtCodeWrap");
    if (frame) frame.hidden = isCode;
    if (codeWrap) codeWrap.hidden = !isCode;
  }

  function downloadBlob(filename, content, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  function exportDoc(title, md) {
    downloadBlob(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "muntrume_doc"}.doc`, "\ufeff" + buildDocHtml(title, md), "application/msword");
  }

  function exportPdf(title, md) {
    const w = window.open("", "_blank", "width=900,height=720");
    if (!w) return;
    w.document.write(buildDocHtml(title, md));
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 350);
  }

  function exportSlides(title, md) {
    downloadBlob(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) || "muntrume_slides"}.html`, buildSlidesHtml(title, md), "text/html;charset=utf-8");
  }

  // ============================================================================
  // SEND MESSAGE
  // ============================================================================
  async function sendMessage(overrideText) {
    const input = $("aiInput");
    const rawText = typeof overrideText === "string" ? overrideText : (input?.value || "");
    const text = rawText.trim();
    if ((!text && !pendingAttachment) || streaming) return;

    let chat = getActiveChat();
    if (!chat) chat = createNewChat((text || pendingAttachment?.name || "Nueva conversación").slice(0, 46));
    if (chat.messages.length === 0 && text) chat.title = text.slice(0, 48);

    const att = pendingAttachment;
    pendingAttachment = null;
    if (input) { input.value = ""; input.style.height = "auto"; }
    renderContextPills();

    chat.messages.push({
      role: "user",
      content: text || (att?.kind === "image" ? "Analiza esta imagen." : `Analiza ${att?.name}`),
      image: att?.kind === "image" ? att.dataUrl : undefined,
      attachmentName: att && att.kind !== "image" ? att.name : undefined
    });

    const mBrand = (MODELS[state.tier] || MODELS.pro).label;
    const botMsg = { role: "assistant", content: "", reasoning: "", modelBrand: mBrand, usedWeb: false, usedGithub: false, usedVision: false };
    chat.messages.push(botMsg);
    chat.updatedAt = Date.now();
    saveState();
    renderChatList();
    renderMessages();

    streaming = true;
    const sendBtn = $("aiSendBtn");
    if (sendBtn) { sendBtn.dataset.state = "stop"; sendBtn.title = "Detener respuesta"; sendBtn.innerHTML = SVG_STOP; }
    activeCtrl = new AbortController();

    const feedEl = $("aiFeed");
    const botNode = feedEl?.querySelector(`.ai-msg--bot[data-msg-idx="${chat.messages.length - 1}"]`);
    const mdNode = botNode?.querySelector(".ai-md");
    if (mdNode) mdNode.innerHTML = `<div class="ai-thinking-dots"><span></span><span></span><span></span> <em>${esc(mBrand)} procesando…</em></div>`;

    try {
      const proj = state.projects.find((p) => p.id === state.projectId);
      const history = chat.messages.slice(0, -2).slice(-8).map((m) => ({ role: m.role, content: m.content }));

      if (state.tier === "local") {
        const res = await fetch(state.ollamaUrl || "http://localhost:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: activeCtrl.signal,
          body: JSON.stringify({
            model: state.ollamaModel || "llama3.1:8b",
            stream: false,
            messages: [
              { role: "system", content: "Eres Muntrume Local AI, asistente privado de Muntrume Motorsport." },
              ...history,
              { role: "user", content: text }
            ]
          })
        });
        const j = await res.json().catch(() => ({}));
        botMsg.content = j?.message?.content || j?.response || "No se recibió respuesta desde Ollama local.";
      } else {
        const payload = {
          prompt: text || "Analiza esta imagen con detalle.",
          tier: state.tier,
          effort: state.effort,
          mode: state.projectId === "dev" ? "general" : "team",
          skill: state.skill,
          web_search: state.webSearch,
          project_prompt: proj?.prompt || "",
          custom_instructions: state.customInstructions || "",
          memory: state.memoryOn ? state.memory : "",
          chat_history: history,
          stream: true,
          image: att?.kind === "image" ? att.dataUrl : undefined,
          github_url: att?.kind === "github" ? att.url : undefined,
          attachment_name: att?.kind === "text" ? att.name : undefined,
          attachment_text: att?.kind === "text" ? att.text : undefined
        };

        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: activeCtrl.signal,
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const cType = (res.headers.get("content-type") || "").toLowerCase();
        if (cType.includes("event-stream") && res.body) {
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const ln of lines) {
              const l = ln.trim();
              if (!l.startsWith("data:")) continue;
              const d = l.slice(5).trim();
              if (d === "[DONE]") break;
              try {
                const j = JSON.parse(d);
                const tDelta = j.reasoning || j.thinking || "";
                const cDelta = j.token || j.delta || j.choices?.[0]?.delta?.content || "";
                if (tDelta) botMsg.reasoning += tDelta;
                if (cDelta) botMsg.content += cDelta;
                if (mdNode && botMsg.content) {
                  mdNode.innerHTML = renderMarkdownHtml(botMsg.content);
                  feedEl.scrollTop = feedEl.scrollHeight;
                }
              } catch {}
            }
          }
        } else {
          const j = await res.json().catch(() => ({}));
          botMsg.content = j.markdown || j.answer || j.result || "Sin respuesta del motor.";
          botMsg.reasoning = j.reasoning || "";
          botMsg.usedWeb = Boolean(j.used_web);
          botMsg.usedGithub = Boolean(j.used_github);
          botMsg.usedVision = Boolean(j.used_vision);
        }
        if (att?.kind === "image") botMsg.usedVision = true;
        if (att?.kind === "github") botMsg.usedGithub = true;
        if (state.webSearch) botMsg.usedWeb = true;
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        botMsg.content = botMsg.content || "No se pudo conectar con el motor en este momento. Comprueba tu conexión o prueba con **Muntrume 1.0 Lite**.";
      }
    } finally {
      streaming = false;
      activeCtrl = null;
      if (sendBtn) { sendBtn.dataset.state = "send"; sendBtn.title = "Enviar mensaje"; sendBtn.innerHTML = SVG_SEND; }
      saveState();
      renderMessages();

      const arts = extractArtifactsFromMarkdown(botMsg.content);
      const rich = arts.find((a) => a.type === "html" || a.type === "svg" || a.type === "slides");
      if (rich) openArtifactPane(rich);
    }
  }

  // ============================================================================
  // ATTACHMENTS & MODALS
  // ============================================================================
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("read_err"));
      r.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("img_err"));
        img.onload = () => {
          const max = 1400;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const k = Math.min(max / w, max / h);
            w = Math.round(w * k); h = Math.round(h * k);
          }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.84));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  async function handleFileAttachment(file) {
    if (!file) return;
    if (file.type.startsWith("image/")) {
      const dataUrl = await compressImage(file);
      pendingAttachment = { kind: "image", name: file.name || "captura.jpg", dataUrl };
    } else {
      const txt = await file.text().catch(() => "");
      pendingAttachment = { kind: "text", name: file.name, text: txt.slice(0, 8000) };
    }
    renderContextPills();
    $("aiInput")?.focus();
  }

  function openModal(id) {
    const m = $(id);
    if (m) m.hidden = false;
  }

  function closeAllModals() {
    ["aiProjectsModal", "aiArtifactsModal", "aiPersonalizeModal", "aiGithubModal"].forEach((id) => {
      const m = $(id);
      if (m) m.hidden = true;
    });
    const pm = $("aiPlusMenu"); if (pm) pm.hidden = true;
    const mm = $("aiModelMenu"); if (mm) mm.hidden = true;
  }

  function renderProjectsModal() {
    const box = $("aiProjectsList");
    if (!box) return;
    box.innerHTML = state.projects.map((p) => `
      <div class="ai-proj-card ${p.id === state.projectId ? "is-active" : ""}">
        <div style="flex:1;min-width:0">
          <strong>${esc(p.name)}</strong>
          <p>${esc(p.prompt || "Sin instrucciones fijas de proyecto.")}</p>
        </div>
        <button type="button" class="ai-mini-btn ai-mini-btn--accent" data-pick-proj="${esc(p.id)}">${p.id === state.projectId ? "Activo" : "Usar"}</button>
      </div>
    `).join("");
  }

  function renderArtifactsGallery() {
    const box = $("aiArtifactsGallery");
    if (!box) return;
    if (!state.artifacts.length) {
      box.innerHTML = `<p style="color:var(--ai-muted);font-size:13px">Aún no has generado artefactos. Pide una calculadora HTML, un diagrama SVG, una presentación o un documento.</p>`;
      return;
    }
    box.innerHTML = state.artifacts.map((a, i) => `
      <div class="ai-proj-card">
        <div style="flex:1;min-width:0">
          <strong>${esc(a.title)}</strong>
          <p>${esc((a.type || "doc").toUpperCase())} · ${esc((a.code || "").slice(0, 90))}…</p>
        </div>
        <button type="button" class="ai-mini-btn ai-mini-btn--accent" data-reopen-art="${i}">Abrir</button>
      </div>
    `).join("");
  }

  function consumeWidgetHandoff() {
    try {
      const raw = localStorage.getItem(HANDOFF_KEY);
      if (!raw) return;
      localStorage.removeItem(HANDOFF_KEY);
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.messages) && data.messages.length > 0) {
        const chat = createNewChat(data.messages[0]?.content?.slice(0, 44) || "Desde Copiloto");
        chat.messages = data.messages;
        if (data.tier && MODELS[data.tier]) state.tier = data.tier;
        saveState();
      }
    } catch {}
  }

  function init() {
    consumeWidgetHandoff();
    setGreeting();
    syncComposerControls();
    renderChatList();
    renderMessages();

    $("aiSideToggle")?.addEventListener("click", () => { $("aiWorkspace")?.classList.toggle("is-side-collapsed"); });
    $("aiSideClose")?.addEventListener("click", () => { $("aiWorkspace")?.classList.add("is-side-collapsed"); });
    $("aiNewChatBtn")?.addEventListener("click", () => {
      state.activeChatId = null; saveState(); renderChatList(); renderMessages(); closeArtifactPane(); $("aiInput")?.focus();
    });
    $("aiSearchBtn")?.addEventListener("click", () => {
      const box = $("aiSearchWrap");
      if (box) { box.hidden = !box.hidden; if (!box.hidden) $("aiSearchInput")?.focus(); }
    });
    $("aiSearchInput")?.addEventListener("input", renderChatList);
    $("aiProjectsBtn")?.addEventListener("click", () => { renderProjectsModal(); openModal("aiProjectsModal"); });
    $("aiArtifactsBtn")?.addEventListener("click", () => { renderArtifactsGallery(); openModal("aiArtifactsModal"); });
    $("aiCodeModeBtn")?.addEventListener("click", () => {
      state.skill = "code"; state.projectId = "dev"; state.activeChatId = null;
      saveState(); syncComposerControls(); renderMessages(); $("aiInput")?.focus();
    });
    $("aiPersonalizeBtn")?.addEventListener("click", () => {
      if ($("aiCustomInstrInput")) $("aiCustomInstrInput").value = state.customInstructions || "";
      if ($("aiMemoryInput")) $("aiMemoryInput").value = state.memory || "";
      openModal("aiPersonalizeModal");
    });

    $("aiPlusBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = $("aiPlusMenu"); if (menu) menu.hidden = !menu.hidden;
      const mm = $("aiModelMenu"); if (mm) mm.hidden = true;
    });
    $("aiModelBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = $("aiModelMenu"); if (menu) menu.hidden = !menu.hidden;
      const pm = $("aiPlusMenu"); if (pm) pm.hidden = true;
    });
    $("aiEffortBtn")?.addEventListener("click", () => {
      const order = ["low", "medium", "high"];
      state.effort = order[(order.indexOf(state.effort) + 1) % order.length];
      saveState(); syncComposerControls();
    });

    $("aiActUpload")?.addEventListener("click", () => { closeAllModals(); $("aiFileInput")?.click(); });
    $("aiActProject")?.addEventListener("click", () => { closeAllModals(); renderProjectsModal(); openModal("aiProjectsModal"); });
    $("aiActGithub")?.addEventListener("click", () => {
      closeAllModals();
      openModal("aiGithubModal");
      $("aiGithubUrlInput")?.focus();
    });
    $("aiGithubForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const clean = ($("aiGithubUrlInput")?.value || "").trim();
      if (!/^https?:\/\/github\.com\//i.test(clean)) return;
      pendingAttachment = { kind: "github", name: clean.replace(/^https?:\/\/github\.com\//i, "").slice(0, 42), url: clean };
      if ($("aiGithubUrlInput")) $("aiGithubUrlInput").value = "";
      closeAllModals();
      renderContextPills();
      $("aiInput")?.focus();
    });
    $("aiActWebToggle")?.addEventListener("click", () => { state.webSearch = !state.webSearch; saveState(); syncComposerControls(); });
    $("aiActMemToggle")?.addEventListener("click", () => { state.memoryOn = !state.memoryOn; saveState(); syncComposerControls(); });

    $("aiFileInput")?.addEventListener("change", (e) => {
      const f = e.target?.files?.[0];
      if (f) handleFileAttachment(f);
      e.target.value = "";
    });

    if ($("aiOllamaUrl")) {
      $("aiOllamaUrl").value = state.ollamaUrl;
      $("aiOllamaUrl").addEventListener("change", (e) => { state.ollamaUrl = e.target.value.trim(); saveState(); });
    }
    if ($("aiOllamaModel")) {
      $("aiOllamaModel").value = state.ollamaModel;
      $("aiOllamaModel").addEventListener("change", (e) => { state.ollamaModel = e.target.value.trim(); saveState(); });
    }

    const input = $("aiInput");
    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(200, input.scrollHeight) + "px";
    });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $("aiComposerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (streaming && activeCtrl) { activeCtrl.abort(); return; }
      sendMessage();
    });

    $("aiNewProjectForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("aiNewProjName")?.value.trim();
      const prompt = $("aiNewProjPrompt")?.value.trim() || "";
      if (!name) return;
      const id = "p_" + Date.now();
      state.projects.push({ id, name, prompt });
      state.projectId = id;
      saveState();
      if ($("aiNewProjName")) $("aiNewProjName").value = "";
      if ($("aiNewProjPrompt")) $("aiNewProjPrompt").value = "";
      renderProjectsModal();
      syncComposerControls();
    });

    $("aiPersonalizeForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.customInstructions = $("aiCustomInstrInput")?.value.trim() || "";
      state.memory = $("aiMemoryInput")?.value.trim() || "";
      saveState();
      closeAllModals();
    });

    $("aiArtClose")?.addEventListener("click", closeArtifactPane);
    $("aiArtTabPreview")?.addEventListener("click", () => switchArtifactTab("preview"));
    $("aiArtTabCode")?.addEventListener("click", () => switchArtifactTab("code"));
    $("aiArtCopy")?.addEventListener("click", () => { if (currentArtifact?.code) navigator.clipboard.writeText(currentArtifact.code); });
    $("aiArtExportDoc")?.addEventListener("click", () => { if (currentArtifact) exportDoc(currentArtifact.title, currentArtifact.code); });
    $("aiArtExportPdf")?.addEventListener("click", () => { if (currentArtifact) exportPdf(currentArtifact.title, currentArtifact.code); });
    $("aiArtExportSlides")?.addEventListener("click", () => { if (currentArtifact) exportSlides(currentArtifact.title, currentArtifact.code); });
    $("aiArtDownload")?.addEventListener("click", () => {
      if (!currentArtifact) return;
      const ext = currentArtifact.type === "html" || currentArtifact.type === "slides" ? "html" : currentArtifact.type === "svg" ? "svg" : "md";
      const content = currentArtifact.type === "slides" ? buildSlidesHtml(currentArtifact.title, currentArtifact.code) : currentArtifact.code;
      downloadBlob(`muntrume_artifact.${ext}`, content, "text/plain;charset=utf-8");
    });

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const tierBtn = t.closest("[data-select-tier]");
      if (tierBtn) { state.tier = tierBtn.dataset.selectTier; saveState(); syncComposerControls(); closeAllModals(); return; }

      const skillBtn = t.closest("[data-select-skill]");
      if (skillBtn) { state.skill = skillBtn.dataset.selectSkill || ""; saveState(); syncComposerControls(); closeAllModals(); return; }

      const starter = t.closest("[data-starter-prompt]");
      if (starter) {
        const sk = starter.dataset.starterSkill || "";
        if (sk) { state.skill = sk; syncComposerControls(); }
        sendMessage(starter.dataset.starterPrompt);
        return;
      }

      const openChat = t.closest("[data-open-chat]");
      if (openChat) { state.activeChatId = openChat.dataset.openChat; saveState(); renderChatList(); renderMessages(); return; }

      const delChat = t.closest("[data-del-chat]");
      if (delChat) {
        const cid = delChat.dataset.delChat;
        state.chats = state.chats.filter((c) => c.id !== cid);
        if (state.activeChatId === cid) state.activeChatId = state.chats[0]?.id || null;
        saveState(); renderChatList(); renderMessages(); return;
      }

      if (t.closest("[data-clear-proj]")) { state.projectId = "general"; saveState(); syncComposerControls(); return; }
      if (t.closest("[data-clear-skill]")) { state.skill = ""; saveState(); syncComposerControls(); return; }
      if (t.closest("[data-clear-att]")) { pendingAttachment = null; renderContextPills(); return; }

      const pickProj = t.closest("[data-pick-proj]");
      if (pickProj) { state.projectId = pickProj.dataset.pickProj; saveState(); syncComposerControls(); closeAllModals(); return; }

      const reopenArt = t.closest("[data-reopen-art]");
      if (reopenArt) {
        const a = state.artifacts[Number(reopenArt.dataset.reopenArt)];
        if (a) { closeAllModals(); openArtifactPane(a); }
        return;
      }

      const copyCode = t.closest("[data-copy-code]");
      if (copyCode) {
        navigator.clipboard.writeText(decodeURIComponent(copyCode.dataset.copyCode || ""));
        copyCode.textContent = "Copiado";
        setTimeout(() => { copyCode.textContent = "Copiar"; }, 1400);
        return;
      }

      const prevCode = t.closest("[data-preview-code]");
      if (prevCode) {
        const lang = prevCode.dataset.previewLang || "html";
        const code = decodeURIComponent(prevCode.dataset.previewCode || "");
        openArtifactPane({ type: lang === "svg" ? "svg" : lang === "slides" ? "slides" : "html", lang, title: `Vista previa (${lang.toUpperCase()})`, code });
        return;
      }

      const copyMd = t.closest("[data-copy-md]");
      if (copyMd) {
        navigator.clipboard.writeText(decodeURIComponent(copyMd.dataset.copyMd || ""));
        copyMd.textContent = "Copiado";
        setTimeout(() => { copyMd.textContent = "Copiar"; }, 1400);
        return;
      }

      const chat = getActiveChat();
      const docArt = t.closest("[data-open-doc-artifact]");
      if (docArt && chat) {
        const m = chat.messages[Number(docArt.dataset.openDocArtifact)];
        if (m) {
          const arts = extractArtifactsFromMarkdown(m.content);
          openArtifactPane(arts[0] || { type: "doc", lang: "md", title: chat.title || "Documento", code: m.content });
        }
        return;
      }
      const expDoc = t.closest("[data-export-doc]");
      if (expDoc && chat) { const m = chat.messages[Number(expDoc.dataset.exportDoc)]; if (m) exportDoc(chat.title || "Muntrume_AI", m.content); return; }
      const expPdf = t.closest("[data-export-pdf]");
      if (expPdf && chat) { const m = chat.messages[Number(expPdf.dataset.exportPdf)]; if (m) exportPdf(chat.title || "Muntrume_AI", m.content); return; }
      const expSlides = t.closest("[data-export-slides]");
      if (expSlides && chat) { const m = chat.messages[Number(expSlides.dataset.exportSlides)]; if (m) exportSlides(chat.title || "Muntrume_Slides", m.content); return; }

      if (t.closest("[data-close-ai-modal]")) { closeAllModals(); return; }
      if (!t.closest("#aiPlusMenu") && !t.closest("#aiPlusBtn")) { const pm = $("aiPlusMenu"); if (pm) pm.hidden = true; }
      if (!t.closest("#aiModelMenu") && !t.closest("#aiModelBtn")) { const mm = $("aiModelMenu"); if (mm) mm.hidden = true; }
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        state.activeChatId = null; saveState(); renderChatList(); renderMessages(); $("aiInput")?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        $("aiFileInput")?.click();
      } else if (e.key === "Escape") {
        closeAllModals();
      }
    });

    document.addEventListener("paste", (e) => {
      for (const item of e.clipboardData?.items || []) {
        if (item.type && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) handleFileAttachment(f);
          break;
        }
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
