/**
 * Muntrume AI Studio (v4.0 — ai.muntru.me, Full Multi-Format Renderer, Calm Animated Pacing)
 * 100 % Open Source (MIT), Zero Emojis, Header-Theme Synced.
 */
(function (rootScope) {
  "use strict";

  const API_ORIGIN = (typeof location !== "undefined" && location.hostname === "ai.muntru.me")
    ? ""
    : "https://muntrume.atrumin16.workers.dev";
  const API_URL = `${API_ORIGIN}/api/ai`;
  const STORAGE_KEY = "muntrume_ai_studio_v3";
  const HANDOFF_KEY = "muntrume_ai_handoff";

  const MODELS = {
    open: { id: "open", label: "Muntrume 1.0 Open", isPublic: true },
    lite: { id: "lite", label: "Muntrume 1.0 Lite", isPublic: false },
    pro: { id: "pro", label: "Muntrume 1.0 Pro", isPublic: false },
    ultra_max: { id: "ultra_max", label: "Muntrume 1.0 Ultra Max", isPublic: false }
  };

  const PACE_PRESETS = {
    calm: { id: "calm", label: "Lectura", baseCps: 38, thinkCps: 54, codeMult: 3.2, punctPauseMs: 78, paraPauseMs: 125 },
    normal: { id: "normal", label: "Normal", baseCps: 72, thinkCps: 98, codeMult: 3.6, punctPauseMs: 38, paraPauseMs: 65 },
    fast: { id: "fast", label: "Rápido", baseCps: 160, thinkCps: 210, codeMult: 4.0, punctPauseMs: 12, paraPauseMs: 22 }
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
  const SVG_CHECK = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

  const CALLOUT_META = {
    NOTE: { cls: "note", label: "Nota", svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
    TIP: { cls: "tip", label: "Consejo", svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>' },
    IMPORTANT: { cls: "important", label: "Importante", svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
    WARNING: { cls: "warning", label: "Aviso", svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    CAUTION: { cls: "caution", label: "Precaución", svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' }
  };

  const $ = (id) => (typeof document !== "undefined" ? document.getElementById(id) : null);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ============================================================================
  // SECURITY & MULTI-FORMAT RENDERING ENGINE (TESTABLE IN NODE + BROWSER)
  // ============================================================================
  function sanitizeUrl(raw) {
    const s = String(raw || "").trim().replace(/[\u0000-\u001F\u007F]/g, "");
    if (!s) return "";
    if (/^https?:\/\/[^\s<>"']+$/i.test(s)) return s;
    if (/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(s)) return s;
    if (/^\/[a-zA-Z0-9/_.,?=&%#-]*$/.test(s) && !s.startsWith("//")) return s;
    return "";
  }

  function safeFilename(raw, fallback = "muntrume_ai") {
    const clean = String(raw || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 44);
    return clean || fallback;
  }

  function parseCsvRows(csvText) {
    const lines = String(csvText || "").replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
    return lines.map((line) => {
      const cells = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if ((ch === "," || ch === ";") && !inQ) {
          cells.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      cells.push(cur.trim());
      return cells;
    });
  }

  function buildCsvFromTable(headers, rows) {
    const q = (v) => {
      const s = String(v ?? "").replace(/\r?\n/g, " ").trim();
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const all = [headers, ...rows];
    return all.map((r) => r.map(q).join(",")).join("\n");
  }

  function highlightCode(rawCode, rawLang) {
    const lang = String(rawLang || "text").toLowerCase();
    const src = String(rawCode || "");
    const safe = esc(src);
    if (!safe || lang === "text" || lang === "txt" || lang === "plain") return safe;

    if (lang === "json") {
      return safe.replace(
        /(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
        (m, str, colon, kw, num) => {
          if (str && colon) return `<span class="tok-key">${str}</span>${colon}`;
          if (str) return `<span class="tok-str">${str}</span>`;
          if (kw) return `<span class="tok-kw">${kw}</span>`;
          if (num) return `<span class="tok-num">${num}</span>`;
          return m;
        }
      );
    }

    if (lang === "html" || lang === "htm" || lang === "xml" || lang === "svg") {
      return safe.replace(
        /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[a-zA-Z0-9:-]+)|(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g,
        (m, com, tag, str) => {
          if (com) return `<span class="tok-com">${com}</span>`;
          if (tag) return `<span class="tok-tag">${tag}</span>`;
          if (str) return `<span class="tok-str">${str}</span>`;
          return m;
        }
      );
    }

    if (lang === "css" || lang === "scss") {
      return safe.replace(
        /(\/\*[\s\S]*?\*\/)|(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)|(--[a-zA-Z0-9-]+|[a-zA-Z-]+(?=\s*:))|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|dvh|ms|s|deg)?\b|#[0-9a-fA-F]{3,8}\b)/g,
        (m, com, str, prop, num) => {
          if (com) return `<span class="tok-com">${com}</span>`;
          if (str) return `<span class="tok-str">${str}</span>`;
          if (prop) return `<span class="tok-key">${prop}</span>`;
          if (num) return `<span class="tok-num">${num}</span>`;
          return m;
        }
      );
    }

    const kwList = lang === "python" || lang === "py"
      ? "def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|with|async|await|yield|lambda|None|True|False|and|or|not|in|is|pass|break|continue"
      : lang === "sql"
      ? "SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|ON|GROUP|BY|ORDER|LIMIT|AS|AND|OR|NOT|NULL|PRIMARY|KEY|INDEX|DISTINCT|COUNT|SUM|AVG"
      : lang === "bash" || lang === "sh" || lang === "shell" || lang === "powershell" || lang === "ps1"
      ? "if|then|else|fi|for|in|do|done|while|case|esac|function|export|local|return|echo|exit|cd|ls|git|npm|npx|node|curl|docker|wrangler"
      : "const|let|var|function|return|if|else|for|while|switch|case|break|continue|default|class|extends|new|try|catch|finally|throw|async|await|import|export|from|typeof|instanceof|true|false|null|undefined|interface|type|public|private|readonly";

    const flags = lang === "sql" ? "gi" : "g";
    const re = new RegExp(
      `(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|#[^\\n]*)|(&quot;(?:\\\\.|[^&]|&(?!quot;))*?&quot;|&#39;(?:\\\\.|[^&]|&(?!#39;))*?&#39;|\`[^\`]*?\`)|\\b(${kwList})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\\s*\\()`,
      flags
    );
    return safe.replace(re, (m, com, str, kw, num, fn) => {
      if (com) return `<span class="tok-com">${com}</span>`;
      if (str) return `<span class="tok-str">${str}</span>`;
      if (kw) return `<span class="tok-kw">${kw}</span>`;
      if (num) return `<span class="tok-num">${num}</span>`;
      if (fn) return `<span class="tok-fn">${fn}</span>`;
      return m;
    });
  }

  function inlineFmt(raw, opts = {}) {
    const tokens = [];
    const stash = (html) => {
      const idx = tokens.length;
      tokens.push(html);
      return `@@TOK_${idx}@@`;
    };

    let s = String(raw || "");
    if (opts.streaming) {
      // Stabilize unclosed inline code or bold markers at the streaming tail
      const ticks = (s.match(/`/g) || []).length;
      if (ticks % 2 === 1) s += "`";
      const bolds = (s.match(/\*\*/g) || []).length;
      if (bolds % 2 === 1) s += "**";
    }

    // 1. Inline code first (immune to inner markdown)
    s = s.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code>${esc(code)}</code>`));

    // 2. Inline math $...$ and \(...\) (converted cleanly to readable math, never raw LaTeX)
    s = s.replace(/\\\(([\s\S]{1,160}?)\\\)/g, (_, expr) => {
      return stash(`<span class="ai-math-inline">${esc(formatLatexToHuman(expr))}</span>`);
    });
    s = s.replace(/(^|[\s(])\$([^\s$][^$\n]{0,120}?[^\s$]|[^\s$\d])\$(?=[\s.,;:!?)]|$)/g, (full, pre, expr) => {
      if (/^\d+([.,]\d+)?$/.test(expr.trim())) return full;
      return `${pre}${stash(`<span class="ai-math-inline">${esc(formatLatexToHuman(expr))}</span>`)}`;
    });

    // 3. Images ![alt](url)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) => {
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return esc(alt);
      return stash(`<img class="ai-md-img" src="${esc(safeUrl)}" alt="${esc(alt || "Imagen")}" loading="lazy" />`);
    });

    // 4. Links [label](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return esc(label);
      const isExt = /^https?:\/\//i.test(safeUrl);
      const rel = isExt ? ' target="_blank" rel="noopener noreferrer"' : "";
      return stash(`<a href="${esc(safeUrl)}"${rel}>${esc(label)}</a>`);
    });

    // Escape remaining raw HTML
    s = esc(s);

    // Allow safe line breaks (<br> / <br/>) that LLMs emit inside table cells and lists
    s = s.replace(/&lt;br\s*\/?&gt;/gi, "<br />");

    // 5. Bare URLs
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"')]+)/g, (_, pre, url) => {
      const clean = url.replace(/[.,;:!?]+$/, "");
      const trail = url.slice(clean.length);
      const safeUrl = sanitizeUrl(clean);
      if (!safeUrl) return pre + url;
      return `${pre}${stash(`<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>`)}${trail}`;
    });

    // 6. Emphasis & strikethrough (tolerant with tokens/punctuation, safe against snake_case and 2 * 3)
    s = s
      .replace(/\*\*\*([^\n]+?)\*\*\*/g, (_, inner) => (inner.trim() ? `<strong><em>${inner.trim()}</em></strong>` : _))
      .replace(/\*\*([^\n]+?)\*\*/g, (_, inner) => (inner.trim() ? `<strong>${inner.trim()}</strong>` : _))
      .replace(/(^|[^\w_])__([^\s_](?:[^_\n]*?[^\s_])?)__(?=$|[^\w_])/g, "$1<strong>$2</strong>")
      .replace(/~~([^\s~](?:[^~\n]*?[^\s~])?)~~/g, "<del>$1</del>")
      .replace(/(^|[^\w*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w_])_([^\s_](?:[^_\n]*?[^\s_])?)_(?=$|[^\w_])/g, "$1<em>$2</em>");

    return s.replace(/@@TOK_(\d+)@@/g, (_, i) => tokens[Number(i)] || "");
  }

  function splitTableRow(line) {
    let trimmed = String(line || "").trim();
    if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
    if (trimmed.endsWith("|") && !trimmed.endsWith("\\|")) trimmed = trimmed.slice(0, -1);
    const cells = [];
    let cur = "";
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
        cur += "|";
        i++;
      } else if (trimmed[i] === "|") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += trimmed[i];
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  function isTableSeparator(line) {
    const t = String(line || "").trim().replace(/[—–]/g, "-");
    if (!t.includes("|")) return false;
    const cells = splitTableRow(t);
    return cells.length >= 1 && cells.every((c) => /^:?\s*-{1,}\s*:?$/.test(c));
  }

  function renderTableCard(headers, aligns, rows) {
    const csv = buildCsvFromTable(headers, rows);
    const encCsv = encodeURIComponent(csv);
    const ths = headers.map((h, ci) => {
      const al = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : "";
      return `<th${al}>${inlineFmt(h)}</th>`;
    }).join("");
    const trs = rows.map((r) => {
      const tds = headers.map((_, ci) => {
        const al = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : "";
        return `<td${al}>${inlineFmt(r[ci] ?? "")}</td>`;
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");
    return `
      <div class="ai-table-card">
        <div class="ai-table-card__bar">
          <span>Tabla · ${rows.length} ${rows.length === 1 ? "fila" : "filas"} × ${headers.length} cols</span>
          <div class="ai-code-card__btns">
            <button type="button" class="ai-mini-btn" data-copy-csv="${encCsv}">Copiar CSV</button>
            <button type="button" class="ai-mini-btn" data-download-csv="${encCsv}">Descargar .csv</button>
          </div>
        </div>
        <div class="ai-table-wrap">
          <table class="ai-md-table">
            <thead><tr>${ths}</tr></thead>
            <tbody>${trs}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function extractArtifactsFromMarkdown(md) {
    const found = [];
    const re = /```([a-zA-Z0-9_+-]*)[^\n]*\n([\s\S]*?)```/g;
    let m, idx = 0;
    while ((m = re.exec(String(md || ""))) !== null) {
      const lang = (m[1] || "text").toLowerCase();
      const code = (m[2] || "").trim();
      if (!code) continue;
      idx++;
      if (lang === "html" || lang === "htm") {
        const tm = code.match(/<title>([^<]{1,60})<\/title>/i) || code.match(/<h1[^>]*>([^<]{1,60})<\/h1>/i);
        found.push({ id: `art_${Date.now()}_${idx}`, type: "html", lang, title: tm ? tm[1].trim() : "Aplicación HTML interactiva", code });
      } else if (lang === "svg") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "svg", lang, title: "Diagrama vectorial SVG", code });
      } else if (lang === "mermaid") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "mermaid", lang, title: "Diagrama de flujo Mermaid", code });
      } else if (lang === "slides") {
        const hm = code.match(/^#\s+(.+)$/m);
        found.push({ id: `art_${Date.now()}_${idx}`, type: "slides", lang, title: hm ? hm[1].trim().slice(0, 56) : "Presentación 16:9", code });
      } else if (lang === "csv") {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "csv", lang, title: "Hoja de datos CSV", code });
      } else if (code.length >= 100) {
        found.push({ id: `art_${Date.now()}_${idx}`, type: "code", lang, title: `Código (${lang.toUpperCase()})`, code });
      }
    }
    return found;
  }

  function formatLatexToHuman(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    // Unwrap \boxed{...}, \text{...}, \mathrm{...}, \mathbf{...}, \operatorname{...}
    for (let pass = 0; pass < 4; pass++) {
      s = s
        .replace(/\\(?:boxed|text|mathrm|mathbf|mathit|textbf|operatorname)\{([^{}]*)\}/g, "$1")
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => {
          const left = /[+\-×÷=]/.test(a.trim()) ? `(${a.trim()})` : a.trim();
          const right = /[+\-×÷=]/.test(b.trim()) ? `(${b.trim()})` : b.trim();
          return `${left} / ${right}`;
        })
        .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)");
    }
    s = s
      .replace(/\{,\}/g, ",")
      .replace(/\\left\s*/g, "")
      .replace(/\\right\s*/g, "")
      .replace(/\\times\b/g, "×")
      .replace(/\\cdot\b/g, "·")
      .replace(/\\div\b/g, "÷")
      .replace(/\\approx\b/g, "≈")
      .replace(/\\leq?\b/g, "≤")
      .replace(/\\geq?\b/g, "≥")
      .replace(/\\neq?\b/g, "≠")
      .replace(/\\pm\b/g, "±")
      .replace(/\\(?:rightarrow|to)\b/g, "→")
      .replace(/\\(?:quad|qquad|enspace|thinspace)\b/g, " ")
      .replace(/\\[,;:! ]/g, " ")
      .replace(/\\%/g, "%")
      .replace(/\\([a-zA-Z]+)/g, "")
      .replace(/[{}]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return s;
  }

  function renderMarkdownHtml(md, opts = {}) {
    let text = String(md || "").replace(/\r\n/g, "\n");
    const blocks = [];

    // 4-backtick outer fenced code blocks first (protects nested ``` blocks)
    text = text.replace(/````([a-zA-Z0-9_+-]*)[^\n]*\n([\s\S]*?)````/g, (_, lang, code) => {
      const i = blocks.length;
      blocks.push({ kind: "code", lang: (lang || "markdown").toLowerCase(), code: code.replace(/\n$/, ""), closed: true });
      return `\n\n@@BLOCK_${i}@@\n\n`;
    });

    // Closed 3-backtick fenced code blocks (supports optional info attributes & leading indent)
    text = text.replace(/```([a-zA-Z0-9_+-]*)[^\n]*\n([\s\S]*?)```/g, (_, lang, code) => {
      const i = blocks.length;
      blocks.push({ kind: "code", lang: (lang || "text").toLowerCase(), code: code.replace(/\n$/, ""), closed: true });
      return `\n\n@@BLOCK_${i}@@\n\n`;
    });

    // Unclosed fenced code block (during live streaming)
    const openFenceIdx = text.indexOf("```");
    if (openFenceIdx !== -1) {
      const before = text.slice(0, openFenceIdx);
      const after = text.slice(openFenceIdx + 3);
      const nl = after.indexOf("\n");
      const lang = (nl === -1 ? after : after.slice(0, nl)).trim().replace(/[^a-zA-Z0-9_+-]/g, "").toLowerCase() || "text";
      const code = nl === -1 ? "" : after.slice(nl + 1);
      const i = blocks.length;
      blocks.push({ kind: "code", lang, code, closed: false });
      text = `${before}\n@@BLOCK_${i}@@\n`;
    }

    // Closed display math blocks \[...\] and $$...$$
    text = text.replace(/\\\[\s*\n?([\s\S]+?)\n?\s*\\\]/g, (_, expr) => {
      const i = blocks.length;
      blocks.push({ kind: "math", expr: formatLatexToHuman(expr) });
      return `\n@@BLOCK_${i}@@\n`;
    });
    text = text.replace(/\$\$\s*\n?([\s\S]+?)\n?\s*\$\$/g, (_, expr) => {
      const i = blocks.length;
      blocks.push({ kind: "math", expr: formatLatexToHuman(expr) });
      return `\n@@BLOCK_${i}@@\n`;
    });

    // Unclosed display math block mid-stream
    const openMathIdx = text.indexOf("$$");
    if (openMathIdx !== -1) {
      const before = text.slice(0, openMathIdx);
      const expr = formatLatexToHuman(text.slice(openMathIdx + 2));
      const i = blocks.length;
      blocks.push({ kind: "math", expr: expr || "…" });
      text = `${before}\n@@BLOCK_${i}@@\n`;
    }

    // Strip orphaned/truncated single table header line at the very end of a completed reply
    if (!opts.streaming) {
      text = text.replace(/\n+(?:#{1,4}\s+[^\n]+\n+)?\|[^\n]+\s*$/, (match) => {
        const pipeLines = match.trim().split("\n").filter((l) => l.trim().startsWith("|"));
        return pipeLines.length === 1 ? "" : match;
      });
    }

    const lines = text.split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const ln = lines[i];
      const trim = ln.trim();

      if (!trim) { i++; continue; }

      // Stashed code / math block
      if (/^@@BLOCK_(\d+)@@$/.test(trim)) {
        out.push(trim);
        i++;
        continue;
      }

      // Horizontal rule
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trim)) {
        out.push("<hr />");
        i++;
        continue;
      }

      // Headings H1 - H6 (strip optional trailing #, tolerate missing space)
      const hMatch = trim.match(/^(#{1,6})\s*([^\s#][\s\S]*)$/);
      if (hMatch) {
        const lvl = hMatch[1].length;
        const hText = hMatch[2].replace(/\s+#+$/, "");
        out.push(`<h${lvl}>${inlineFmt(hText, opts)}</h${lvl}>`);
        i++;
        continue;
      }

      // GFM Table
      if (trim.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        const headers = splitTableRow(trim);
        const sepCells = splitTableRow(lines[i + 1]);
        const aligns = headers.map((_, ci) => {
          const sc = (sepCells[ci] || "").replace(/\s+/g, "");
          if (sc.startsWith(":") && sc.endsWith(":")) return "center";
          if (sc.endsWith(":")) return "right";
          return "left";
        });
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes("|") && !/^@@BLOCK_\d+@@$/.test(lines[i].trim())) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        out.push(renderTableCard(headers, aligns, rows));
        continue;
      }

      // Blockquotes & GitHub Callouts (> [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION])
      if (/^>\s?/.test(trim)) {
        const qLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
          qLines.push(lines[i].trim().replace(/^>\s?/, ""));
          i++;
        }
        const renderQBody = (arr) => {
          const inner = [];
          let j = 0;
          while (j < arr.length) {
            const ql = arr[j].trim();
            if (!ql) { j++; continue; }
            if (/^[-*+]\s+/.test(ql)) {
              const lis = [];
              while (j < arr.length && /^[-*+]\s+/.test(arr[j].trim())) {
                lis.push(`<li>${inlineFmt(arr[j].trim().replace(/^[-*+]\s+/, ""))}</li>`);
                j++;
              }
              inner.push(`<ul>${lis.join("")}</ul>`);
            } else {
              inner.push(`<p>${inlineFmt(ql)}</p>`);
              j++;
            }
          }
          return inner.join("");
        };
        const firstM = qLines[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
        if (firstM) {
          const meta = CALLOUT_META[firstM[1].toUpperCase()] || CALLOUT_META.NOTE;
          const bodyLines = [];
          if (firstM[2]) bodyLines.push(firstM[2]);
          bodyLines.push(...qLines.slice(1));
          out.push(`<div class="ai-callout ai-callout--${meta.cls}"><div class="ai-callout__head">${meta.svg}<span>${meta.label}</span></div><div class="ai-callout__body">${renderQBody(bodyLines)}</div></div>`);
        } else {
          out.push(`<blockquote>${renderQBody(qLines)}</blockquote>`);
        }
        continue;
      }

      // Task Checklists (- [x] / - [ ])
      if (/^[-*+]\s+\[([ xX])\]\s+/.test(trim)) {
        const items = [];
        while (i < lines.length && /^[-*+]\s+\[([ xX])\]\s+/.test(lines[i].trim())) {
          const m = lines[i].trim().match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
          const done = m && m[1].toLowerCase() === "x";
          items.push(`<li class="ai-task-item ${done ? "is-done" : ""}"><span class="ai-task-box" aria-hidden="true">${done ? SVG_CHECK : ""}</span><span>${inlineFmt(m ? m[2] : "")}</span></li>`);
          i++;
        }
        out.push(`<ul class="ai-task-list">${items.join("")}</ul>`);
        continue;
      }

      // Unordered list (supports 1-level nesting cleanly)
      if (/^[-*+]\s+/.test(trim)) {
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]) && !/^[-*+]\s+\[[ xX]\]\s+/.test(lines[i].trim())) {
          const rawLine = lines[i];
          const indent = rawLine.match(/^(\s*)/)[1].length;
          const itemText = inlineFmt(rawLine.trim().replace(/^[-*+]\s+/, ""));
          if (indent >= 2 && items.length > 0) {
            items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, `<ul><li>${itemText}</li></ul></li>`);
          } else {
            items.push(`<li>${itemText}</li>`);
          }
          i++;
        }
        out.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      // Ordered list (supports nested sub-bullets without resetting numbering)
      if (/^\d+[.)]\s+/.test(trim)) {
        const items = [];
        while (i < lines.length && (/^\s*\d+[.)]\s+/.test(lines[i]) || (/^\s{2,}[-*+]\s+/.test(lines[i]) && items.length > 0))) {
          const rawLine = lines[i];
          if (/^\s{2,}[-*+]\s+/.test(rawLine) && items.length > 0) {
            const subText = inlineFmt(rawLine.trim().replace(/^[-*+]\s+/, ""), opts);
            items[items.length - 1] = items[items.length - 1].replace(/<\/li>$/, `<ul><li>${subText}</li></ul></li>`);
          } else {
            const itemText = inlineFmt(rawLine.trim().replace(/^\d+[.)]\s+/, ""), opts);
            items.push(`<li>${itemText}</li>`);
          }
          i++;
        }
        out.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      // Paragraph (combine adjacent plain lines)
      const pLines = [ln];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(?:#{1,6}\s*|>\s?|[-*+]\s+|\d+[.)]\s+|@@BLOCK_\d+@@$|(?:-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim()) &&
        !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        pLines.push(lines[i]);
        i++;
      }
      out.push(`<p>${pLines.map((pl) => inlineFmt(pl, opts)).join("<br />")}</p>`);
    }

    let html = out.join("\n");
    html = html.replace(/@@BLOCK_(\d+)@@/g, (_, idx) => {
      const b = blocks[Number(idx)];
      if (!b) return "";
      if (b.kind === "math") {
        return `<div class="ai-math-block">${esc(b.expr)}</div>`;
      }
      if (b.lang === "csv" && b.closed) {
        const parsed = parseCsvRows(b.code);
        if (parsed.length >= 2 && parsed[0].length >= 2) {
          return renderTableCard(parsed[0], parsed[0].map(() => "left"), parsed.slice(1));
        }
      }
      const isPreviewable = b.lang === "html" || b.lang === "htm" || b.lang === "svg" || b.lang === "slides" || b.lang === "mermaid";
      const encoded = encodeURIComponent(b.code);
      const lineCount = b.code ? b.code.split("\n").length : 0;
      const highlighted = highlightCode(b.code, b.lang);
      const statusSuffix = b.closed ? `${lineCount} ${lineCount === 1 ? "línea" : "líneas"}` : "escribiendo…";
      return `
        <div class="ai-code-card">
          <div class="ai-code-card__bar">
            <span class="ai-code-card__lang">
              <span>${esc(b.lang.toUpperCase())}</span>
              <span class="ai-code-card__meta">${statusSuffix}</span>
            </span>
            <div class="ai-code-card__btns">
              ${isPreviewable && b.closed ? `<button type="button" class="ai-mini-btn ai-mini-btn--accent" data-preview-code="${encoded}" data-preview-lang="${esc(b.lang)}">Abrir vista previa</button>` : ""}
              ${b.closed ? `<button type="button" class="ai-mini-btn" data-download-code="${encoded}" data-code-lang="${esc(b.lang)}">Descargar</button>` : ""}
              <button type="button" class="ai-mini-btn" data-copy-code="${encoded}">Copiar</button>
            </div>
          </div>
          <pre><code>${highlighted}${!b.closed && opts.showCaret ? '<span class="ai-caret" aria-hidden="true"></span>' : ""}</code></pre>
        </div>
      `;
    });

    if (opts.showCaret && !html.includes('class="ai-caret"')) {
      const caret = '<span class="ai-caret" aria-hidden="true"></span>';
      if (/<\/(p|li|h[1-4]|blockquote)>\s*$/i.test(html)) {
        html = html.replace(/(<\/(?:p|li|h[1-4]|blockquote)>)\s*$/i, `${caret}$1`);
      } else {
        html += caret;
      }
    }
    return html;
  }

  // ============================================================================
  // SMOOTH PROGRESSIVE STREAM REVEALER (CALM, READABLE ANIMATION)
  // ============================================================================
  function createSmoothRevealer({ pace = "calm", onUpdate, onComplete } = {}) {
    const cfg = PACE_PRESETS[pace] || PACE_PRESETS.calm;
    let targetContent = "";
    let shownContent = "";
    let targetReasoning = "";
    let shownReasoning = "";
    let networkDone = false;
    let stopped = false;
    let finished = false;
    let pauseUntil = 0;
    let lastTs = 0;
    let lastRenderTs = 0;
    let carry = 0;
    let rafId = null;
    let doneResolvers = [];

    const nowFn = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const sched = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(() => fn(nowFn()), 16));
    const cancelSched = (id) => {
      if (id == null) return;
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      else clearTimeout(id);
    };

    function insideOpenCodeFence(text) {
      const matches = text.match(/```/g);
      return Boolean(matches && matches.length % 2 === 1);
    }

    function resolveAll() {
      if (finished) return;
      finished = true;
      cancelSched(rafId);
      rafId = null;
      const list = doneResolvers.slice();
      doneResolvers = [];
      if (typeof onComplete === "function") onComplete({ content: shownContent, reasoning: shownReasoning });
      list.forEach((r) => r({ content: shownContent, reasoning: shownReasoning }));
    }

    function step(ts) {
      rafId = null;
      if (stopped || finished) return;
      const dt = lastTs ? Math.min(80, Math.max(8, ts - lastTs)) : 16;
      lastTs = ts;

      if (ts < pauseUntil) {
        rafId = sched(step);
        return;
      }

      let changed = false;

      // 1. Drain reasoning smoothly first if content hasn't started yet
      if (shownReasoning.length < targetReasoning.length && !targetContent.length) {
        const backlog = targetReasoning.length - shownReasoning.length;
        const boost = backlog > 900 ? 1.8 : 1;
        carry += (cfg.thinkCps * boost * dt) / 1000;
        const take = Math.floor(carry);
        if (take > 0) {
          carry -= take;
          shownReasoning = targetReasoning.slice(0, shownReasoning.length + take);
          changed = true;
        }
      } else if (shownReasoning.length < targetReasoning.length) {
        // Content arrived; settle remaining reasoning immediately so user sees the answer cleanly
        shownReasoning = targetReasoning;
        changed = true;
      }

      // 2. Drain main content at calm reading cadence
      if (shownContent.length < targetContent.length) {
        const backlog = targetContent.length - shownContent.length;
        const inCode = insideOpenCodeFence(shownContent);
        let cps = cfg.baseCps;
        if (inCode) cps *= cfg.codeMult;
        else if (backlog > 2200) cps *= 1.85;
        else if (backlog > 1200) cps *= 1.35;

        carry += (cps * dt) / 1000;
        let take = Math.floor(carry);
        if (take > 0) {
          carry -= take;
          let nextEnd = Math.min(targetContent.length, shownContent.length + take);
          // Avoid splitting UTF-16 surrogate pairs
          if (nextEnd < targetContent.length) {
            const code = targetContent.charCodeAt(nextEnd - 1);
            if (code >= 0xD800 && code <= 0xDBFF) nextEnd++;
          }
          const added = targetContent.slice(shownContent.length, nextEnd);
          shownContent = targetContent.slice(0, nextEnd);
          changed = true;

          // Subtle natural breathing pause on paragraph breaks or sentence endings (prose only)
          if (!inCode && backlog < 1600) {
            if (/\n\n$/.test(added)) pauseUntil = ts + cfg.paraPauseMs;
            else if (/[.!?]\s$/.test(added) || /[.!?]$/.test(added)) pauseUntil = ts + cfg.punctPauseMs;
          }
        }
      }

      const idle = shownContent.length >= targetContent.length && shownReasoning.length >= targetReasoning.length;

      if (changed && (ts - lastRenderTs >= 42 || idle)) {
        lastRenderTs = ts;
        if (typeof onUpdate === "function") {
          onUpdate({
            content: shownContent,
            reasoning: shownReasoning,
            isTyping: !idle || !networkDone,
            backlog: (targetContent.length - shownContent.length) + (targetReasoning.length - shownReasoning.length)
          });
        }
      }

      if (idle && networkDone) {
        if (typeof onUpdate === "function") {
          onUpdate({ content: shownContent, reasoning: shownReasoning, isTyping: false, backlog: 0 });
        }
        resolveAll();
        return;
      }

      rafId = sched(step);
    }

    function ensureRunning() {
      if (!rafId && !stopped && !finished) {
        lastTs = nowFn();
        rafId = sched(step);
      }
    }

    return {
      pushContent(delta) {
        if (stopped || !delta) return;
        targetContent += String(delta);
        ensureRunning();
      },
      pushReasoning(delta) {
        if (stopped || !delta) return;
        targetReasoning += String(delta);
        ensureRunning();
      },
      markNetworkDone() {
        networkDone = true;
        if (shownContent.length >= targetContent.length && shownReasoning.length >= targetReasoning.length) {
          resolveAll();
        } else {
          ensureRunning();
        }
      },
      flush() {
        if (stopped || finished) return;
        shownReasoning = targetReasoning;
        shownContent = targetContent;
        if (typeof onUpdate === "function") {
          onUpdate({ content: shownContent, reasoning: shownReasoning, isTyping: !networkDone, backlog: 0 });
        }
        if (networkDone) resolveAll();
      },
      stop() {
        stopped = true;
        networkDone = true;
        resolveAll();
      },
      waitUntilIdle() {
        if (finished) return Promise.resolve({ content: shownContent, reasoning: shownReasoning });
        return new Promise((resolve) => doneResolvers.push(resolve));
      },
      getState() {
        return { shownContent, targetContent, shownReasoning, targetReasoning, networkDone, finished };
      }
    };
  }

  // ============================================================================
  // EXPORTS & SLIDES / DOC BUILDERS
  // ============================================================================
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

    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#0c0e12;color:#f3f5f8;font-family:system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column}
      .progress{height:3px;background:#1f242d;width:100%}.progress-fill{height:100%;background:#10b981;transition:width .25s ease}
      .deck{flex:1;display:grid;place-items:center;padding:28px;overflow:auto}
      .slide{display:none;width:min(980px,100%);min-height:480px;background:#15181e;border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:42px 50px;position:relative;box-shadow:0 22px 60px rgba(0,0,0,.45)}
      .slide.active{display:flex;flex-direction:column;justify-content:center;animation:slideIn .22s ease}
      @keyframes slideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .slide-num{position:absolute;top:18px;right:24px;font:600 12px ui-monospace,monospace;color:#10b981}
      h1,h2,h3{margin:0 0 14px;color:#fff}h1{font-size:32px;letter-spacing:-.02em}h2{font-size:24px;color:#10b981}
      p,li{font-size:17px;line-height:1.62;color:#d1d6df}ul,ol{padding-left:22px}
      .ai-table-card{border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;margin:12px 0}.ai-table-card__bar{display:none}
      table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left;font-size:14.5px}th{background:#0f1217;color:#10b981}
      .ai-code-card{border:1px solid rgba(255,255,255,.1);border-radius:10px;background:#0a0c0f;overflow:hidden}.ai-code-card__bar{padding:6px 12px;background:#11141a;font:600 11px monospace;color:#9ca3af}.ai-code-card__btns{display:none}pre{margin:0;padding:12px;overflow:auto;font-size:13px}
      .ai-callout{padding:10px 14px;border-left:3px solid #10b981;background:#101318;border-radius:8px;margin:10px 0}.ai-callout__head{font:700 11px monospace;color:#10b981;text-transform:uppercase;margin-bottom:4px}
      .bar{display:flex;justify-content:space-between;align-items:center;padding:11px 22px;background:#090b0e;border-top:1px solid rgba(255,255,255,.08)}
      button{background:#10b981;color:#04130d;border:0;border-radius:999px;padding:7px 16px;font-weight:700;font-size:12.5px;cursor:pointer}
      button.ghost{background:#1e232c;color:#e5e7eb}
      @media print{body{height:auto;background:#fff;color:#111}.bar,.progress{display:none}.deck{display:block;padding:0}.slide{display:block !important;page-break-after:always;background:#fff;color:#111;border:1px solid #ddd;box-shadow:none;margin:0 0 18px}h1,h2,h3,p,li{color:#111}}
    </style></head><body>
      <div class="progress"><div class="progress-fill" id="pf" style="width:${Math.round(100 / finalSlides.length)}%"></div></div>
      <div class="deck">${slideDivs}</div>
      <div class="bar"><span style="font:600 12px ui-monospace,monospace;color:#8b94a3">Muntrume AI · Presentación 16:9</span><div style="display:flex;gap:8px"><button class="ghost" onclick="go(-1)">Anterior</button><button onclick="go(1)">Siguiente</button></div></div>
      <script>let i=0,ss=[...document.querySelectorAll('.slide')],pf=document.getElementById('pf');function go(d){ss[i].classList.remove('active');i=(i+d+ss.length)%ss.length;ss[i].classList.add('active');if(pf)pf.style.width=Math.round(((i+1)/ss.length)*100)+'%';}document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')go(1);if(e.key==='ArrowLeft')go(-1);if(e.key==='Home'){ss[i].classList.remove('active');i=0;ss[0].classList.add('active');}if(e.key==='End'){ss[i].classList.remove('active');i=ss.length-1;ss[i].classList.add('active');}});</script>
    </body></html>`;
  }

  function buildDocHtml(title, md) {
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      @page{margin:18mm 16mm}
      body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;max-width:820px;margin:32px auto;padding:0 24px;color:#0f172a;line-height:1.66;font-size:14.5px}
      .hdr{font:700 11px ui-monospace,monospace;color:#059669;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
      h1{color:#0f172a;margin:0 0 18px;padding-bottom:10px;border-bottom:2px solid #10b981;font-size:24px}
      h2{color:#0f172a;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #e2e8f0;font-size:18px}
      h3{color:#1e293b;margin:16px 0 6px;font-size:15.5px}
      p{margin:8px 0;color:#334155}
      ul,ol{padding-left:22px;margin:8px 0}li{margin:3px 0}
      .ai-table-card{border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin:14px 0}.ai-table-card__bar{display:none}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #e2e8f0;padding:8px 11px;text-align:left;font-size:13px}th{background:#f8fafc;color:#0f172a;font-weight:700}
      .ai-code-card{border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin:14px 0;background:#f8fafc}.ai-code-card__bar{padding:6px 10px;background:#e2e8f0;font:700 11px monospace;color:#334155}.ai-code-card__btns{display:none}
      pre{margin:0;padding:12px;overflow:auto;font-size:12px;color:#0f172a}code{font-family:Consolas,ui-monospace,monospace;background:#f1f5f9;padding:1px 4px;border-radius:4px}pre code{background:transparent;padding:0}
      blockquote,.ai-callout{margin:12px 0;padding:10px 14px;border-left:3px solid #10b981;background:#f8fafc;border-radius:0 8px 8px 0}
      .ai-callout__head{font:700 11px monospace;text-transform:uppercase;color:#059669;margin-bottom:4px;display:flex;align-items:center;gap:6px}
      .ai-task-list{list-style:none;padding-left:4px}.ai-task-item{display:flex;gap:8px;align-items:center}.ai-task-box{width:14px;height:14px;border:1px solid #64748b;border-radius:3px;display:inline-grid;place-items:center}.ai-task-item.is-done .ai-task-box{background:#059669;color:#fff;border-color:#059669}
      .ai-math-block{text-align:center;font-family:Georgia,serif;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:12px 0}
      hr{border:0;border-top:1px solid #cbd5e1;margin:18px 0}
    </style></head><body>
      <div class="hdr">Muntrume Motorsport · Documento generado por Muntrume AI (ai.muntru.me)</div>
      <h1>${esc(title)}</h1>
      ${renderMarkdownHtml(md)}
    </body></html>`;
  }

  // ============================================================================
  // IRACING ENGINEERING CALCULATOR CORE (PURE & TESTABLE)
  // ============================================================================
  const BALANCE_GUIDES = {
    entry_understeer: {
      title: "Subviraje en entrada (turn-in / frenada)",
      steps: [
        "Retrasa el Brake Bias 0.4% – 0.8% hacia atrás para ayudar a rotar en frenada.",
        "Ablanda la barra estabilizadora delantera (Front ARB) 1–2 posiciones o endurece la trasera.",
        "Baja la altura delantera (Front Ride Height) 1 mm o aumenta el rake trasero.",
        "Aumenta ligeramente el camber delantero (-0.1° a -0.2°) si la goma interior va fría."
      ]
    },
    mid_understeer: {
      title: "Subviraje en mitad de curva (vértice)",
      steps: [
        "Reduce rigidez de Front ARB o sube Rear ARB 1 clic.",
        "Reduce la precarga del diferencial (Diff Preload) 10–20 Nm para liberar la rotación en coast.",
        "Comprueba presiones calientes delanteras (objetivo GT3 iRacing: ~168–174 kPa)."
      ]
    },
    exit_oversteer: {
      title: "Sobreviraje en salida (aceleración)",
      steps: [
        "Ablanda la barra trasera (Rear ARB) 1–2 clics o muelles traseros.",
        "Sube el control de tracción (TC1/TC2) 1 punto o suaviza el mapa de acelerador.",
        "Aumenta la precarga del diferencial (Diff Preload) +15 Nm o reduce el ángulo de rampa en drive.",
        "Añade +1° de ala trasera (Rear Wing) si ocurre en curvas medias/rápidas."
      ]
    },
    entry_oversteer: {
      title: "Sobreviraje en frenada / entrada",
      steps: [
        "Adelanta el Brake Bias +0.5% a +1.0% hacia el eje delantero.",
        "Aumenta la compresión a baja velocidad delantera (Front LS Comp) +2 clics y extensión trasera (Rear LS Reb) +2 clics para frenar el cabeceo.",
        "Aumenta el Diff Preload +15 Nm para dar estabilidad al soltar gas."
      ]
    },
    brake_lock: {
      title: "Bloqueo temprano de frenos",
      steps: [
        "Ajusta el Brake Bias alejándolo del eje que bloquea primero (0.5% por paso).",
        "Reduce la presión máxima de frenada (Brake Pressure) o activa/sube 1 punto el ABS.",
        "Suaviza los muelles delanteros o baja la compresión rápida (HS Comp) si bloquea sobre baches."
      ]
    },
    rear_wear: {
      title: "Sobrecalentamiento y degradación trasera",
      steps: [
        "Reduce el deslizamiento en tracción: sube TC 1 clic y ablanda Rear ARB.",
        "Ajusta presiones en frío traseras (-2 kPa si superan 176 kPa en caliente).",
        "Reduce ligeramente el camber trasero (+0.2°) si el borde interior supera en >12°C al exterior."
      ]
    }
  };

  function parseLapSeconds(str) {
    const clean = String(str || "").trim().replace(",", ".");
    const parts = clean.split(":");
    if (parts.length === 2) {
      const m = Number(parts[0]);
      const s = Number(parts[1]);
      if (Number.isFinite(m) && Number.isFinite(s) && m >= 0 && s >= 0) return m * 60 + s;
    }
    if (parts.length === 3) {
      const h = Number(parts[0]), m = Number(parts[1]), s = Number(parts[2]);
      if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(s)) return h * 3600 + m * 60 + s;
    }
    const n = Number(clean);
    return Number.isFinite(n) && n > 0 ? n : 135;
  }

  function computeFuelMetrics({ mins = 45, lapStr = "2:17.5", fuelLap = 2.95, tank = 100, formLap = true, margin = 1 } = {}) {
    const safeMins = Math.max(1, Number(mins) || 45);
    const lapSec = Math.max(15, parseLapSeconds(lapStr));
    const safeFuel = Math.max(0.1, Number(fuelLap) || 2.95);
    const safeTank = Math.max(5, Number(tank) || 100);
    const safeForm = formLap ? 1 : 0;
    const safeMargin = Math.max(0, Number(margin) || 0);

    const raceLaps = Math.ceil((safeMins * 60) / lapSec);
    const totalLaps = raceLaps + safeForm + safeMargin;
    const totalFuel = Number((totalLaps * safeFuel).toFixed(1));
    const maxLapsStint = Math.max(1, Math.floor(safeTank / safeFuel));
    const stops = Math.max(0, Math.ceil(totalFuel / safeTank) - 1);
    const stints = stops + 1;
    const fuelPerStint = Number((totalFuel / stints).toFixed(1));
    return { mins: safeMins, lapStr: String(lapStr), lapSec, fuelLap: safeFuel, tank: safeTank, formLap: safeForm, margin: safeMargin, raceLaps, totalLaps, totalFuel, maxLapsStint, stops, stints, fuelPerStint };
  }

  // Expose pure engine for automated verification (zero side effects)
  rootScope.__MUNTRUME_AI_ENGINE__ = {
    sanitizeUrl,
    safeFilename,
    parseCsvRows,
    buildCsvFromTable,
    highlightCode,
    inlineFmt,
    renderMarkdownHtml,
    extractArtifactsFromMarkdown,
    buildSlidesHtml,
    buildDocHtml,
    parseLapSeconds,
    computeFuelMetrics,
    createSmoothRevealer,
    PACE_PRESETS,
    BALANCE_GUIDES
  };

  if (typeof document === "undefined") return;

  // ============================================================================
  // BROWSER STATE & UI CONTROLLER
  // ============================================================================
  let state = loadState();
  let streaming = false;
  let activeCtrl = null;
  let activeRevealer = null;
  let currentArtifact = null;
  let pendingAttachment = null;
  let userScrolledUp = false;

  function loadState() {
    const fallback = {
      tier: "pro",
      effort: "medium",
      pace: "calm",
      webSearch: true,
      memoryOn: true,
      skill: "",
      projectId: "general",
      projects: DEFAULT_PROJECTS.slice(),
      customInstructions: "",
      memory: "Equipo: Muntrume Motorsport (Barcelona). Pilotos: #16 Alberto Trujillo, #1 Mateo Berbis, #22 Eduardo Chongkan.",
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
        tier: MODELS[parsed.tier] ? parsed.tier : "pro",
        pace: PACE_PRESETS[parsed.pace] ? parsed.pace : "calm",
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
    if (!MODELS[state.tier]) state.tier = "pro";
    const m = MODELS[state.tier] || MODELS.pro;
    const mLbl = $("aiModelBtnLabel");
    if (mLbl) mLbl.textContent = m.label;
    document.querySelectorAll("[data-select-tier]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.selectTier === state.tier);
    });
    document.querySelectorAll("[data-select-skill]").forEach((b) => {
      b.classList.toggle("is-active", Boolean(state.skill) && b.dataset.selectSkill === state.skill);
    });

    const effortLabels = { low: "Rápido", medium: "Medio", high: "Profundo" };
    const effBtn = $("aiEffortBtn");
    if (effBtn) effBtn.textContent = effortLabels[state.effort] || "Medio";

    const paceCfg = PACE_PRESETS[state.pace] || PACE_PRESETS.calm;
    const paceLbl = $("aiPaceLabel");
    if (paceLbl) paceLbl.textContent = `Ritmo: ${paceCfg.label}`;

    $("aiActWebToggle")?.classList.toggle("is-on", state.webSearch);
    $("aiActMemToggle")?.classList.toggle("is-on", state.memoryOn);
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

  function scrollFeedToBottom(force = false) {
    const feedEl = $("aiFeed");
    if (!feedEl) return;
    if (force) userScrolledUp = false;
    if (!userScrolledUp) {
      feedEl.scrollTop = feedEl.scrollHeight;
      const btn = $("aiScrollDownBtn");
      if (btn) btn.hidden = true;
    }
  }

  function renderMessages() {
    const chat = getActiveChat();
    const emptyEl = $("aiEmptyState");
    const feedEl = $("aiFeed");
    const stageEl = $("aiStage");
    const topLabel = $("aiTopLabel");
    if (!feedEl || !emptyEl || !stageEl) return;

    const hasMsgs = Boolean(chat && chat.messages.length > 0);
    emptyEl.hidden = hasMsgs;
    feedEl.hidden = !hasMsgs;
    stageEl.classList.toggle("is-chatting", hasMsgs);
    if (topLabel) topLabel.textContent = hasMsgs && chat?.title ? chat.title : "ai.muntru.me";

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
        ? `<details class="ai-think"><summary>Proceso de razonamiento · ${esc(msg.modelBrand || "Muntrume 1.0 Ultra Max")}</summary><pre>${esc(msg.reasoning)}</pre></details>`
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
            <div class="ai-think-slot">${thinkHtml}</div>
            <div class="ai-md">${renderMarkdownHtml(msg.content)}</div>
            <div class="ai-msg-actions">
              <button type="button" class="ai-act-btn" data-copy-md="${encodedMd}">Copiar</button>
              <button type="button" class="ai-act-btn" data-regen-msg="${idx}">Regenerar</button>
              <button type="button" class="ai-act-btn" data-open-doc-artifact="${idx}">Artefacto</button>
              <button type="button" class="ai-act-btn" data-export-doc="${idx}">DOC</button>
              <button type="button" class="ai-act-btn" data-export-pdf="${idx}">PDF</button>
              <button type="button" class="ai-act-btn" data-export-slides="${idx}">Slides</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    scrollFeedToBottom(true);
  }

  // ============================================================================
  // USEFUL INTERACTIVE ARTIFACT TEMPLATES + PROFILE CLOUD PUBLISHING (ai.muntru.me/a/<slug>)
  // ============================================================================
  const ARTIFACT_TEMPLATES = [
    {
      title: "Planificador de Stints & Combustible GT3",
      type: "html",
      lang: "html",
      desc: "App interactiva lista para compartir por URL con cálculo en vivo de vueltas, combustible, paradas y ahorro.",
      code: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Planificador de Stints GT3</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0f1114;color:#f3f5f8;font-family:system-ui,-apple-system,sans-serif}.wrap{max-width:720px;margin:0 auto;display:grid;gap:16px}.card{background:#171a1f;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}label{display:block;font-size:11.5px;color:#8b94a3;margin-bottom:4px;font-weight:600}input{width:100%;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#0c0e12;color:#f3f5f8;font:600 14px ui-monospace,monospace}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{background:#0c0e12;border:1px solid rgba(16,185,129,.28);border-radius:12px;padding:12px}.kpi span{display:block;font:600 10.5px ui-monospace,monospace;color:#8b94a3;text-transform:uppercase}.kpi strong{display:block;margin-top:4px;font:700 20px ui-monospace,monospace;color:#10b981}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{color:#10b981;font:700 11px ui-monospace,monospace;text-transform:uppercase}@media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 6px;font-size:20px">Planificador de Stints · iRacing</h1><p style="margin:0 0 14px;font-size:13px;color:#8b94a3">Ajusta los parámetros y comparte esta herramienta mediante su enlace en ai.muntru.me.</p><div class="grid"><div><label>Duración (min)</label><input id="m" type="number" value="180" min="10"></div><div><label>Vuelta (seg)</label><input id="l" type="number" value="137.5" step="0.1" min="20"></div><div><label>Consumo (L/v)</label><input id="f" type="number" value="2.95" step="0.05" min="0.2"></div><div><label>Depósito (L)</label><input id="t" type="number" value="100" min="10"></div></div></div><div class="kpis" id="k"></div><div class="card"><table><thead><tr><th>Stint</th><th>Vueltas</th><th>Combustible</th><th>Ventana aprox.</th></tr></thead><tbody id="tb"></tbody></table></div></div><script>const $=id=>document.getElementById(id);function calc(){const mins=+$('m').value||60,lap=Math.max(20,+$('l').value||130),fl=Math.max(.2,+$('f').value||2.9),tk=Math.max(10,+$('t').value||100);const laps=Math.ceil((mins*60)/lap)+2,tot=+(laps*fl).toFixed(1),stops=Math.max(0,Math.ceil(tot/tk)-1),st=stops+1,perSt=+(tot/st).toFixed(1),lapsSt=Math.ceil(laps/st);$('k').innerHTML='<div class="kpi"><span>Vueltas</span><strong>'+laps+'</strong></div><div class="kpi"><span>Total Fuel</span><strong>'+tot+' L</strong></div><div class="kpi"><span>Paradas</span><strong>'+stops+'</strong></div><div class="kpi"><span>Por Stint</span><strong>'+perSt+' L</strong></div>';let rows='';for(let i=1;i<=st;i++){const minAt=Math.round((i*lapsSt*lap)/60);rows+='<tr><td>Stint '+i+'</td><td>'+lapsSt+' v</td><td>'+perSt+' L</td><td>Min '+Math.min(mins,minAt)+'</td></tr>';}$('tb').innerHTML=rows;}['m','l','f','t'].forEach(id=>$(id).addEventListener('input',calc));calc();</script></body></html>`
    },
    {
      title: "Ficha Interactiva de Setup y Presiones GT3",
      type: "html",
      lang: "html",
      desc: "Hoja editable de presiones en frío/caliente, ARB, camber y notas por circuito lista para compartir con el equipo.",
      code: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ficha de Setup GT3</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0f1114;color:#f3f5f8;font-family:system-ui,-apple-system,sans-serif}.wrap{max-width:740px;margin:0 auto;display:grid;gap:14px}.card{background:#171a1f;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px}.g4{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.tire{background:#0c0e12;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px}.tire b{color:#10b981;font:700 12px ui-monospace,monospace}.row{display:flex;gap:8px;margin-top:8px}input,textarea{width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:#12151b;color:#f3f5f8;font:600 13px ui-monospace,monospace}.ok{color:#10b981;font-size:12px;margin-top:6px}.warn{color:#f59e0b;font-size:12px;margin-top:6px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 4px;font-size:20px">Control de Presiones y Balance · GT3</h1><p style="margin:0;font-size:13px;color:#8b94a3">Objetivo caliente iRacing GT3: 168–174 kPa. Introduce lecturas tras 5 vueltas.</p></div><div class="card g4" id="tires"></div><div class="card"><b style="font-size:12px;color:#8b94a3">NOTAS DE PISTA</b><textarea rows="3" placeholder="Ej. Subviraje en Pouhon -> bajar Front ARB 1 clic, Brake Bias 53.6%..."></textarea></div></div><script>const pos=['FL · Delantera Izq','FR · Delantera Der','RL · Trasera Izq','RR · Trasera Der'];const box=document.getElementById('tires');box.innerHTML=pos.map((p,i)=>'<div class="tire"><b>'+p+'</b><div class="row"><input type="number" step="0.5" value="152" data-c="'+i+'" placeholder="Frío kPa"><input type="number" step="0.5" value="171" data-h="'+i+'" placeholder="Caliente kPa"></div><div id="st'+i+'" class="ok">En ventana óptima (168–174 kPa)</div></div>').join('');function upd(){for(let i=0;i<4;i++){const h=+box.querySelector('[data-h="'+i+'"]').value||0;const el=document.getElementById('st'+i);if(h<168){el.className='warn';el.textContent='Subir frío +'+(170-h).toFixed(1)+' kPa';}else if(h>174){el.className='warn';el.textContent='Bajar frío -'+(h-172).toFixed(1)+' kPa';}else{el.className='ok';el.textContent='Ventana óptima ('+h+' kPa)';}}}box.addEventListener('input',upd);upd();</script></body></html>`
    },
    {
      title: "Rotación de Pilotos 6h / 12h / 24h",
      type: "html",
      lang: "html",
      desc: "Generador interactivo de turnos de resistencia con hora CET, duración por stint y copia directa para Discord.",
      code: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rotación de Pilotos Resistencia</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0f1114;color:#f3f5f8;font-family:system-ui,-apple-system,sans-serif}.wrap{max-width:760px;margin:0 auto;display:grid;gap:14px}.card{background:#171a1f;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}label{display:block;font-size:11.5px;color:#8b94a3;margin-bottom:4px;font-weight:600}input,select{width:100%;padding:8px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#0c0e12;color:#f3f5f8;font:600 13px ui-monospace,monospace}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{color:#10b981;font:700 11px ui-monospace,monospace;text-transform:uppercase}.btn{border:0;border-radius:999px;background:#10b981;color:#04130d;padding:8px 16px;font-weight:700;cursor:pointer;font-size:12.5px}</style></head><body><div class="wrap"><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><h1 style="margin:0;font-size:19px">Rotación de Pilotos · Endurance</h1><button class="btn" id="cp">Copiar para Discord</button></div><div class="grid"><div><label>Pilotos (separados por coma)</label><input id="dr" value="Alberto, Mateo, Eduardo"></div><div><label>Duración carrera (h)</label><select id="hrs"><option value="6" selected>6 horas</option><option value="12">12 horas</option><option value="24">24 horas</option></select></div><div><label>Minutos por stint</label><input id="st" type="number" value="60" min="30" max="120"></div><div><label>Hora inicio (HH:MM)</label><input id="t0" value="15:00"></div></div></div><div class="card"><table><thead><tr><th>Stint</th><th>Hora CET</th><th>Piloto</th><th>Spotter</th></tr></thead><tbody id="tb"></tbody></table></div></div><script>const $=id=>document.getElementById(id);let txt='';function render(){const names=$('dr').value.split(',').map(s=>s.trim()).filter(Boolean);if(!names.length)return;const totalM=+$('hrs').value*60,stM=Math.max(25,+$('st').value||60);const [sh,sm]=($('t0').value||'15:00').split(':').map(Number);const baseM=(sh||15)*60+(sm||0);const n=Math.ceil(totalM/stM);let rows='',lines=['**Horario de Stints ('+$('hrs').value+'h)**'];for(let i=0;i<n;i++){const m=baseM+i*stM;const hh=String(Math.floor(m/60)%24).padStart(2,'0'),mm=String(m%60).padStart(2,'0');const p=names[i%names.length],sp=names[(i+1)%names.length];rows+='<tr><td>#'+(i+1)+'</td><td>'+hh+':'+mm+'</td><td><strong>'+p+'</strong></td><td>'+sp+'</td></tr>';lines.push('- Stint '+(i+1)+' ('+hh+':'+mm+'): **'+p+'** (Spotter: '+sp+')');}$('tb').innerHTML=rows;txt=lines.join('\\n');}['dr','hrs','st','t0'].forEach(id=>$(id).addEventListener('input',render));$('cp').addEventListener('click',()=>{navigator.clipboard.writeText(txt);$('cp').textContent='Copiado';setTimeout(()=>$('cp').textContent='Copiar para Discord',1400);});render();</script></body></html>`
    },
    {
      title: "Analizador de Ritmo y Degradación",
      type: "html",
      lang: "html",
      desc: "Pega tiempos de un stint y visualiza la curva de caída de goma en SVG, media del stint y brecha frente a Top Split.",
      code: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analizador de Ritmo</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#0f1114;color:#f3f5f8;font-family:system-ui,-apple-system,sans-serif}.wrap{max-width:740px;margin:0 auto;display:grid;gap:14px}.card{background:#171a1f;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:18px}textarea,input{width:100%;padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:#0c0e12;color:#f3f5f8;font:600 13px ui-monospace,monospace}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{background:#0c0e12;border:1px solid rgba(16,185,129,.25);border-radius:11px;padding:11px}.kpi span{display:block;font:600 10px ui-monospace,monospace;color:#8b94a3;text-transform:uppercase}.kpi strong{display:block;margin-top:4px;font:700 18px ui-monospace,monospace;color:#10b981}svg{width:100%;height:190px;background:#0c0e12;border-radius:12px;border:1px solid rgba(255,255,255,.08)}@media(max-width:600px){.kpis{grid-template-columns:repeat(2,1fr)}}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;font-size:19px">Analizador de Ritmo y Caída de Neumático</h1><div style="display:grid;grid-template-columns:2fr 1fr;gap:10px"><div><label style="font-size:11.5px;color:#8b94a3;display:block;margin-bottom:4px">Vueltas del stint (m:ss.xxx, una por línea)</label><textarea id="laps" rows="5">2:16.82\n2:16.95\n2:17.10\n2:17.24\n2:17.48\n2:17.75\n2:17.92\n2:18.21</textarea></div><div><label style="font-size:11.5px;color:#8b94a3;display:block;margin-bottom:4px">Referencia Top Split</label><input id="ref" value="2:16.20"></div></div></div><div class="kpis" id="k"></div><div class="card"><svg id="chart" viewBox="0 0 640 190"></svg></div></div><script>const $=id=>document.getElementById(id);const toS=s=>{const p=String(s||'').trim().split(':');return p.length===2?(+p[0]*60+ +p[1]):+p[0];};const fmt=s=>{const m=Math.floor(s/60),r=(s-m*60).toFixed(2).padStart(5,'0');return m+':'+r;};function run(){const arr=$('laps').value.split(/\\n+/).map(toS).filter(x=>isFinite(x)&&x>20);if(arr.length<2)return;const best=Math.min(...arr),avg=arr.reduce((a,b)=>a+b,0)/arr.length,drop=arr[arr.length-1]-arr[0],ref=toS($('ref').value)||best,gap=avg-ref;$('k').innerHTML='<div class="kpi"><span>Mejor</span><strong>'+fmt(best)+'</strong></div><div class="kpi"><span>Promedio</span><strong>'+fmt(avg)+'</strong></div><div class="kpi"><span>Degradación</span><strong>+'+drop.toFixed(2)+'s</strong></div><div class="kpi"><span>vs Top Split</span><strong>'+(gap>=0?'+':'')+gap.toFixed(2)+'s</strong></div>';const mn=Math.min(...arr,ref)-0.2,mx=Math.max(...arr)+0.2;const pts=arr.map((v,i)=>{const x=40+(i/(arr.length-1))*570,y=165-((v-mn)/(mx-mn))*135;return [x,y];});const poly=pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');const ry=165-((ref-mn)/(mx-mn))*135;$('chart').innerHTML='<line x1="40" y1="'+ry+'" x2="610" y2="'+ry+'" stroke="#3b82f6" stroke-dasharray="5 5" stroke-width="1.5"/><polyline fill="none" stroke="#10b981" stroke-width="3" points="'+poly+'"/>'+pts.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="4" fill="#10b981"/>').join('');}['laps','ref'].forEach(id=>$(id).addEventListener('input',run));run();</script></body></html>`
    },
    {
      title: "Diagrama SVG de Balance Aerodinámico y Mecánico",
      type: "svg",
      lang: "svg",
      desc: "Guía visual vectorial de ingeniería GT3 para corregir subviraje y sobreviraje en entrada, vértice y salida.",
      code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 420" width="820" height="420" style="font-family:system-ui,-apple-system,sans-serif;background:#0f1114;border-radius:14px"><rect x="14" y="14" width="792" height="392" rx="14" fill="#171a1f" stroke="#2c323d"/><text x="38" y="54" fill="#f3f5f8" font-size="20" font-weight="700">Matriz Rápida de Balance · iRacing GT3</text><text x="38" y="76" fill="#8b94a3" font-size="12.5">Ajustes recomendados por fase de curva · Muntrume Motorsport Engineering</text><g transform="translate(38,100)"><rect width="236" height="278" rx="12" fill="#0f1114" stroke="#10b981" stroke-opacity="0.45"/><text x="16" y="30" fill="#10b981" font-size="13" font-weight="700">1. ENTRADA (FRENADA)</text><text x="16" y="60" fill="#f3f5f8" font-size="12.5" font-weight="700">Subviraje (no gira):</text><text x="16" y="82" fill="#cfd5df" font-size="12">- Brake Bias -0.5% atrás</text><text x="16" y="102" fill="#cfd5df" font-size="12">- Bajar Front ARB 1 clic</text><text x="16" y="122" fill="#cfd5df" font-size="12">- Front Ride Height -1 mm</text><line x1="16" y1="146" x2="220" y2="146" stroke="#262b34"/><text x="16" y="174" fill="#f59e0b" font-size="12.5" font-weight="700">Sobreviraje (se cruza):</text><text x="16" y="196" fill="#cfd5df" font-size="12">- Brake Bias +0.6% delante</text><text x="16" y="216" fill="#cfd5df" font-size="12">- Diff Preload +15 Nm</text><text x="16" y="236" fill="#cfd5df" font-size="12">- Front LS Comp +2 clics</text></g><g transform="translate(292,100)"><rect width="236" height="278" rx="12" fill="#0f1114" stroke="#3b82f6" stroke-opacity="0.45"/><text x="16" y="30" fill="#3b82f6" font-size="13" font-weight="700">2. VÉRTICE (MID-CORNER)</text><text x="16" y="60" fill="#f3f5f8" font-size="12.5" font-weight="700">Subviraje constante:</text><text x="16" y="82" fill="#cfd5df" font-size="12">- Front ARB -1 / Rear ARB +1</text><text x="16" y="102" fill="#cfd5df" font-size="12">- Diff Preload -10 Nm</text><text x="16" y="122" fill="#cfd5df" font-size="12">- Revisar 168-174 kPa</text><line x1="16" y1="146" x2="220" y2="146" stroke="#262b34"/><text x="16" y="174" fill="#f59e0b" font-size="12.5" font-weight="700">Inestable en rápida:</text><text x="16" y="196" fill="#cfd5df" font-size="12">- Rear Wing +1 grado</text><text x="16" y="216" fill="#cfd5df" font-size="12">- Rear Ride Height -1 mm</text><text x="16" y="236" fill="#cfd5df" font-size="12">- Subir Front ARB +1 clic</text></g><g transform="translate(546,100)"><rect width="236" height="278" rx="12" fill="#0f1114" stroke="#a855f7" stroke-opacity="0.45"/><text x="16" y="30" fill="#a855f7" font-size="13" font-weight="700">3. SALIDA (TRACCIÓN)</text><text x="16" y="60" fill="#f3f5f8" font-size="12.5" font-weight="700">Sobreviraje al dar gas:</text><text x="16" y="82" fill="#cfd5df" font-size="12">- Rear ARB -1 a -2 clics</text><text x="16" y="102" fill="#cfd5df" font-size="12">- Subir TC1 / TC2 +1</text><text x="16" y="122" fill="#cfd5df" font-size="12">- Rear LS Comp -2 clics</text><line x1="16" y1="146" x2="220" y2="146" stroke="#262b34"/><text x="16" y="174" fill="#10b981" font-size="12.5" font-weight="700">Falta de rotación salida:</text><text x="16" y="196" fill="#cfd5df" font-size="12">- Rear ARB +1 clic</text><text x="16" y="216" fill="#cfd5df" font-size="12">- Bajar TC1 -1 punto</text><text x="16" y="236" fill="#cfd5df" font-size="12">- Diff Preload -10 Nm</text></g></svg>`
    },
    {
      title: "Flujo de Decisión Pit-Wall (Mermaid)",
      type: "mermaid",
      lang: "mermaid",
      desc: "Diagrama de flujo interactivo para decisiones de boxes, doble stint y cambio a neumáticos de lluvia.",
      code: `flowchart TD\n  A[Vuelta de Stint >= 28] --> B{¿Llueve en pista?}\n  B -- Sí --> C[Box inmediato: Wet + Mapa motor suave]\n  B -- No --> D{¿Presión trasera > 176 kPa?}\n  D -- Sí --> E[Box: 4 gomas nuevas + Full Fuel]\n  D -- No --> F[Doble Stint: Solo Fuel + ajustar BB +0.4%]`
    },
    {
      title: "Planilla de Estrategia Endurance (CSV)",
      type: "csv",
      lang: "csv",
      desc: "Hoja de cálculo limpia lista para ver en tabla, descargar en .csv e importar a Excel o Google Sheets.",
      code: `Stint,Piloto,Vueltas,Combustible_L,Neumaticos,Ventana_Min,Notas\n1,Alberto Trujillo,33,97.4,Nuevos,0-75,Salida conservadora sin incidentes\n2,Mateo Berbis,33,97.4,Doble stint,75-150,Vigilar presiones traseras >175 kPa\n3,Eduardo Chongkan,33,97.4,Nuevos,150-225,Ritmo constante y ahorro 0.05 L/v\n4,Alberto Trujillo,33,97.4,Doble stint,225-300,Evaluar mapa motor si cae temperatura\n5,Mateo Berbis,28,84.0,Nuevos,300-360,Splash & Dash final a fondo`
    },
    {
      title: "Briefing Ejecutivo de Resistencia 6h",
      type: "slides",
      lang: "slides",
      desc: "Presentación 16:9 navegable con teclado y barra de progreso lista para compartir con pilotos.",
      code: `# Muntrume Motorsport · Briefing 6h GT3\n\n- **Circuito**: Spa-Francorchamps\n- **Objetivo**: Ritmo constante y 0 incidentes en primeros 30 minutos\n- **Telemetría**: MMT Sync 60 Hz + Garage 61\n\n---\n\n# Plan de Combustible y Stints\n\n| Stint | Piloto | Combustible | Neumáticos |\n| :--- | :--- | :---: | ---: |\n| Stint 1 | Alberto Trujillo | 98 L | Nuevos |\n| Stint 2 | Mateo Berbis | 98 L | Doble stint |\n| Stint 3 | Eduardo Chongkan | 98 L | Nuevos |\n\n---\n\n# Reglas de Box y Tráfico\n\n- Mantener margen mínimo de **1.5 vueltas** de combustible\n- No forzar adelantamientos en Eau Rouge / Raidillon\n- Reportar degradación trasera al pasar de 175 kPa`
    },
    {
      title: "Checklist Técnico Pre-Carrera",
      type: "doc",
      lang: "md",
      desc: "Informe técnico en Markdown con tablas, callouts y checklist exportable a DOC, PDF o enlace web.",
      code: `> [!IMPORTANT]\n> Verificar paquete .sto activo en MMT Sync antes de entrar al servidor de clasificación.\n\n## Verificación previa a parrilla\n\n- [x] Cargar setup de carrera (\`MMT_GT3_RACE_SAFE.sto\`)\n- [x] Confirmar combustible inicial + vuelta de formación\n- [ ] Comprobar Brake Bias inicial y mapa TC1/TC2\n- [ ] Verificar presiones tras 5 vueltas en ventana 168–174 kPa\n\n## Parámetros de referencia\n\n| Parámetro | Qualy | Carrera |\n| :--- | :---: | :---: |\n| Combustible | 18 L | 98 L |\n| Brake Bias | 53.2% | 53.8% |\n| TC1 / TC2 | 3 / 4 | 4 / 5 |`
    }
  ];

  let cloudArtifacts = [];
  let cloudProfile = null;
  let activeArtifactsTab = "cloud";
  let pendingPostLoginAction = null;
  let editorDebounce = null;

  function getVaultToken() {
    try {
      const t = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
      if (!t || t === "guest_token" || t === "local_session") return "";
      return t;
    } catch { return ""; }
  }

  function getVaultUser() {
    try {
      const raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function syncTeamGate() {
    const authed = Boolean(getVaultToken());
    const gate = $("aiTeamGate");
    if (gate) gate.hidden = true; // Abierto por defecto con Muntrume 1.0 Open; solo se abre si un invitado pulsa un modelo de equipo
    if (!authed && state.tier !== "open") {
      state.tier = "open";
      state.webSearch = false;
      saveState();
      syncComposerControls();
    }
    document.querySelectorAll("[data-team-only='1'] .ai-lock-tag").forEach((el) => {
      el.hidden = authed;
    });
    const gateClose = $("aiGateCloseBtn");
    if (gateClose && !gateClose.dataset.bound) {
      gateClose.dataset.bound = "1";
      gateClose.addEventListener("click", () => { if (gate) gate.hidden = true; });
    }
    return authed;
  }

  function renderArtifactFrame(artifact) {
    const frame = $("aiArtFrame");
    if (!frame || !artifact) return;
    let srcDoc = "";
    if (artifact.type === "html") {
      srcDoc = /<html|<body|<!doctype/i.test(artifact.code)
        ? artifact.code
        : `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#111317;color:#f3f5f8}</style></head><body>${artifact.code}</body></html>`;
    } else if (artifact.type === "svg") {
      srcDoc = `<!doctype html><html><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#111317;padding:24px">${artifact.code}</body></html>`;
    } else if (artifact.type === "mermaid") {
      srcDoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1114;color:#f3f5f8;font-family:system-ui,sans-serif;padding:24px}.mermaid{max-width:100%}</style><script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script></head><body><pre class="mermaid">${esc(artifact.code)}</pre><script>mermaid.initialize({startOnLoad:true,theme:'dark',securityLevel:'strict'});</script></body></html>`;
    } else if (artifact.type === "slides") {
      srcDoc = buildSlidesHtml(artifact.title || "Presentación Muntrume", artifact.code);
    } else if (artifact.type === "csv") {
      srcDoc = buildDocHtml(artifact.title || "Tabla CSV", "```csv\n" + artifact.code + "\n```");
    } else {
      srcDoc = buildDocHtml(artifact.title || "Documento Muntrume AI", artifact.code);
    }
    frame.srcdoc = srcDoc;
  }

  function syncPublishedBar() {
    const bar = $("aiArtPublishedBar");
    const link = $("aiArtPubLink");
    const visBtn = $("aiArtPubVis");
    const pubBtn = $("aiArtPublishBtn");
    if (!bar || !link || !pubBtn) return;
    if (currentArtifact?.publishedUrl) {
      bar.hidden = false;
      link.href = currentArtifact.publishedUrl;
      link.textContent = currentArtifact.publishedUrl.replace(/^https?:\/\//, "");
      if (visBtn) visBtn.textContent = currentArtifact.isPublic === false ? "Privado" : "Público";
      pubBtn.textContent = "Actualizar URL";
    } else {
      bar.hidden = true;
      pubBtn.textContent = "Publicar en ai.muntru.me";
    }
  }

  function openArtifactPane(artifact) {
    currentArtifact = {
      ...artifact,
      title: artifact.title || "Artefacto",
      type: artifact.type || "doc",
      lang: artifact.lang || artifact.type || "md",
      code: artifact.code || "",
      isPublic: artifact.isPublic !== false
    };
    const pane = $("aiArtifactPane");
    const ws = $("aiWorkspace");
    if (!pane || !ws) return;

    const titleIn = $("aiArtTitleInput");
    if (titleIn) titleIn.value = currentArtifact.title;
    $("aiArtBadge").textContent = currentArtifact.type.toUpperCase();
    const ed = $("aiArtEditor");
    if (ed) ed.value = currentArtifact.code;

    renderArtifactFrame(currentArtifact);
    syncPublishedBar();
    switchArtifactTab("preview");
    pane.hidden = false;
    ws.classList.add("has-artifact");

    if (!state.artifacts.some((a) => a.code === currentArtifact.code)) {
      state.artifacts.unshift({ ...currentArtifact, createdAt: Date.now() });
      saveState();
    }
  }

  async function publishCurrentArtifact() {
    if (!currentArtifact) return;
    const token = getVaultToken();
    if (!token) {
      pendingPostLoginAction = () => publishCurrentArtifact();
      openModal("aiLoginModal");
      $("aiLoginEmail")?.focus();
      return;
    }
    const pubBtn = $("aiArtPublishBtn");
    if (pubBtn) { pubBtn.disabled = true; pubBtn.textContent = "Publicando…"; }
    try {
      const res = await fetch(`${API_ORIGIN}/api/ai/artifacts/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: currentArtifact.cloudId || undefined,
          slug: currentArtifact.slug || undefined,
          title: ($("aiArtTitleInput")?.value || currentArtifact.title || "Artefacto").trim(),
          type: currentArtifact.type || "doc",
          lang: currentArtifact.lang || currentArtifact.type || "md",
          code: $("aiArtEditor")?.value ?? currentArtifact.code,
          is_public: currentArtifact.isPublic !== false
        })
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) {
        pendingPostLoginAction = () => publishCurrentArtifact();
        openModal("aiLoginModal");
        return;
      }
      if (!res.ok || !j.success) throw new Error(j.error || "Error al publicar");
      currentArtifact.cloudId = j.artifact.id;
      currentArtifact.slug = j.artifact.slug;
      currentArtifact.publishedUrl = j.artifact.url;
      currentArtifact.isPublic = j.artifact.is_public;
      currentArtifact.title = j.artifact.title;
      syncPublishedBar();
      const localMatch = state.artifacts.find((a) => a.code === currentArtifact.code || (a.slug && a.slug === currentArtifact.slug));
      if (localMatch) Object.assign(localMatch, { cloudId: currentArtifact.cloudId, slug: currentArtifact.slug, publishedUrl: currentArtifact.publishedUrl, title: currentArtifact.title });
      saveState();
      try { await navigator.clipboard.writeText(j.artifact.url); } catch {}
      showToast(j.updated ? "URL actualizada y copiada al portapapeles" : `Publicado en ${j.artifact.url.replace(/^https?:\/\//, "")}`);
    } catch (err) {
      showToast(err?.message || "No se pudo publicar el artefacto");
    } finally {
      if (pubBtn) pubBtn.disabled = false;
      syncPublishedBar();
    }
  }

  async function loadCloudArtifacts() {
    const token = getVaultToken();
    if (!token) { cloudArtifacts = []; cloudProfile = null; return false; }
    try {
      const res = await fetch(`${API_ORIGIN}/api/ai/artifacts/mine`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return false;
      const j = await res.json().catch(() => ({}));
      if (j.success) {
        cloudArtifacts = Array.isArray(j.artifacts) ? j.artifacts : [];
        cloudProfile = j.profile || null;
        return true;
      }
    } catch {}
    return false;
  }

  async function togglePublishedVisibility() {
    if (!currentArtifact?.cloudId) return;
    const token = getVaultToken();
    if (!token) return;
    const next = currentArtifact.isPublic === false;
    try {
      const res = await fetch(`${API_ORIGIN}/api/ai/artifacts/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: currentArtifact.cloudId, is_public: next })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        currentArtifact.isPublic = j.is_public;
        syncPublishedBar();
        showToast(j.is_public ? "Artefacto visible públicamente" : "Artefacto cambiado a privado");
      }
    } catch {}
  }

  async function checkCloneHash() {
    try {
      if (!location.hash || !location.hash.startsWith("#clone=")) return;
      const slug = location.hash.slice(7).replace(/[^a-z0-9_-]/gi, "");
      history.replaceState(null, "", location.pathname + location.search);
      if (!slug) return;
      const headers = {};
      const token = getVaultToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_ORIGIN}/api/ai/artifacts/get/${encodeURIComponent(slug)}`, { headers });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success && j.artifact) {
        openArtifactPane({
          title: j.artifact.title,
          type: j.artifact.type,
          lang: j.artifact.lang,
          code: j.artifact.code,
          isPublic: true
        });
        showToast(`Artefacto "${j.artifact.title}" cargado en Studio`);
      }
    } catch {}
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
    const frameWrap = $("aiArtFrameWrap") || $("aiArtFrame");
    const codeWrap = $("aiArtCodeWrap");
    if (frameWrap) frameWrap.hidden = isCode;
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

  function showToast(msg) {
    let el = document.getElementById("aiToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "aiToast";
      el.className = "ai-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-show"), 2400);
  }

  function exportDoc(title, md) {
    downloadBlob(`${safeFilename(title, "muntrume_doc")}.doc`, "\ufeff" + buildDocHtml(title, md), "application/msword");
    showToast("Documento Word (.doc) descargado");
  }

  function exportPdf(title, md) {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    doc.open();
    doc.write(buildDocHtml(title, md));
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {}
      setTimeout(() => iframe.remove(), 2200);
    }, 260);
  }

  function exportSlides(title, md) {
    downloadBlob(`${safeFilename(title, "muntrume_slides")}.html`, buildSlidesHtml(title, md), "text/html;charset=utf-8");
    showToast("Presentación interactiva (.html) descargada");
  }

  // ============================================================================
  // SEND MESSAGE WITH CALM ANIMATED STREAMING
  // ============================================================================
  async function sendMessage(overrideText) {
    const token = getVaultToken();
    if (!token) {
      syncTeamGate();
      openModal("aiLoginModal");
      $("aiLoginEmail")?.focus();
      return;
    }
    const input = $("aiInput");
    const rawText = typeof overrideText === "string" ? overrideText : (input?.value || "");
    let text = rawText.trim();
    if ((!text && !pendingAttachment) || streaming) return;

    // Quick slash-command shortcuts: /setup, /strategy, /code, /slides, /doc, /mermaid
    const slashM = text.match(/^\/(setup|strategy|code|slides|doc|mermaid)\b\s*([\s\S]*)$/i);
    if (slashM) {
      const cmd = slashM[1].toLowerCase();
      const rest = (slashM[2] || "").trim();
      if (cmd === "mermaid") {
        state.skill = "code";
        text = rest ? `Genera un diagrama en bloque \`\`\`mermaid sobre: ${rest}` : "Genera un diagrama de flujo en bloque ```mermaid de estrategia de carrera endurance.";
      } else {
        state.skill = cmd;
        text = rest || `Ayúdame con ${SKILLS[cmd]?.label || cmd}.`;
      }
      saveState();
      syncComposerControls();
    }

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
    userScrolledUp = false;
    const sendBtn = $("aiSendBtn");
    if (sendBtn) { sendBtn.dataset.state = "stop"; sendBtn.title = "Detener respuesta"; sendBtn.innerHTML = SVG_STOP; }
    const streamBar = $("aiStreamBar");
    const streamBarTxt = $("aiStreamBarText");
    if (streamBar) streamBar.hidden = false;
    if (streamBarTxt) streamBarTxt.textContent = `${mBrand} analizando tu consulta…`;
    activeCtrl = new AbortController();

    const feedEl = $("aiFeed");
    const botNode = feedEl?.querySelector(`.ai-msg--bot[data-msg-idx="${chat.messages.length - 1}"]`);
    botNode?.classList.add("ai-msg--streaming");
    const actionsNode = botNode?.querySelector(".ai-msg-actions");
    if (actionsNode) actionsNode.hidden = true;
    const thinkSlot = botNode?.querySelector(".ai-think-slot");
    const mdNode = botNode?.querySelector(".ai-md");
    if (mdNode) mdNode.innerHTML = `<div class="ai-thinking-dots"><span></span><span></span><span></span> <em>${esc(mBrand)} preparando respuesta…</em></div>`;

    const paceLabel = (PACE_PRESETS[state.pace] || PACE_PRESETS.calm).label.toLowerCase();
    activeRevealer = createSmoothRevealer({
      pace: state.pace,
      onUpdate({ content, reasoning, isTyping }) {
        botMsg.content = content;
        botMsg.reasoning = reasoning;
        if (reasoning && thinkSlot) {
          const isOpen = !content;
          thinkSlot.innerHTML = `<details class="ai-think"${isOpen ? " open" : ""}><summary>${isOpen ? '<span class="ai-think__pulse"></span>' : ""}Razonando paso a paso · ${esc(botMsg.modelBrand || mBrand)}</summary><pre>${esc(reasoning)}</pre></details>`;
        }
        if (content && mdNode) {
          mdNode.innerHTML = renderMarkdownHtml(content, { showCaret: isTyping, streaming: isTyping });
          if (streamBarTxt) streamBarTxt.textContent = `Escribiendo a ritmo ${paceLabel}…`;
        } else if (reasoning && streamBarTxt) {
          streamBarTxt.textContent = `Razonando paso a paso (${botMsg.modelBrand || mBrand})…`;
        }
        scrollFeedToBottom(false);
      }
    });

    try {
      const proj = state.projects.find((p) => p.id === state.projectId);
      const history = chat.messages.slice(0, -2).slice(-8).map((m) => ({ role: m.role, content: m.content }));

      const payload = {
        prompt: text || "Analiza esta imagen con detalle.",
        tier: MODELS[state.tier] ? state.tier : "pro",
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        signal: activeCtrl.signal,
        body: JSON.stringify(payload)
      });
      if (res.status === 401) {
        try { localStorage.removeItem("mrt_vault_token"); sessionStorage.removeItem("mrt_vault_token"); } catch {}
        syncTeamGate();
        openModal("aiLoginModal");
        throw new Error("Sesión de equipo requerida o caducada. Inicia sesión para usar los modelos.");
      }
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
              if (j.meta) {
                if (j.meta.model_brand) botMsg.modelBrand = j.meta.model_brand;
                if (j.meta.used_web) botMsg.usedWeb = true;
                if (j.meta.used_github) botMsg.usedGithub = true;
                if (j.meta.used_vision) botMsg.usedVision = true;
              }
              const tDelta = j.reasoning || j.thinking || "";
              const cDelta = j.content || j.token || j.delta || j.choices?.[0]?.delta?.content || "";
              if (tDelta) activeRevealer.pushReasoning(tDelta);
              if (cDelta) activeRevealer.pushContent(cDelta);
            } catch {}
          }
        }
        activeRevealer.markNetworkDone();
        await activeRevealer.waitUntilIdle();
      } else {
        const j = await res.json().catch(() => ({}));
        if (j.reasoning) activeRevealer.pushReasoning(j.reasoning);
        activeRevealer.pushContent(j.markdown || j.answer || j.result || "Sin respuesta del motor.");
        botMsg.usedWeb = Boolean(j.used_web);
        botMsg.usedGithub = Boolean(j.used_github);
        botMsg.usedVision = Boolean(j.used_vision);
        activeRevealer.markNetworkDone();
        await activeRevealer.waitUntilIdle();
      }
      if (att?.kind === "image") botMsg.usedVision = true;
      if (att?.kind === "github") botMsg.usedGithub = true;
      if (state.webSearch) botMsg.usedWeb = true;
    } catch (err) {
      activeRevealer?.stop();
      if (err?.name !== "AbortError") {
        botMsg.content = botMsg.content || "No se pudo conectar con el motor en este momento. Comprueba tu conexión o prueba con **Muntrume 1.0 Lite**.";
      }
    } finally {
      streaming = false;
      activeCtrl = null;
      activeRevealer = null;
      if (streamBar) streamBar.hidden = true;
      if (sendBtn) { sendBtn.dataset.state = "send"; sendBtn.title = "Enviar mensaje"; sendBtn.innerHTML = SVG_SEND; }
      saveState();
      renderMessages();

      const arts = extractArtifactsFromMarkdown(botMsg.content);
      const rich = arts.find((a) => a.type === "html" || a.type === "svg" || a.type === "slides");
      if (rich) openArtifactPane(rich);
    }
  }

  // ============================================================================
  // ATTACHMENTS, CALCULATORS & MODALS
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
    ["aiProjectsModal", "aiArtifactsModal", "aiPersonalizeModal", "aiGithubModal", "aiCalcModal", "aiLoginModal"].forEach((id) => {
      const m = $(id);
      if (m) m.hidden = true;
    });
    const pm = $("aiPlusMenu"); if (pm) pm.hidden = true;
    const mm = $("aiModelMenu"); if (mm) mm.hidden = true;
  }

  function computeFuelCalc() {
    const res = computeFuelMetrics({
      mins: $("calcRaceMins")?.value,
      lapStr: $("calcLapTime")?.value || "2:17.5",
      fuelLap: $("calcFuelLap")?.value,
      tank: $("calcTankSize")?.value,
      formLap: Boolean($("calcFormLap")?.checked),
      margin: $("calcMarginLaps")?.value
    });
    const box = $("calcFuelResult");
    if (box) {
      box.innerHTML = `
        <div class="ai-calc-kpis">
          <div class="ai-calc-kpi"><span>Vueltas carrera</span><strong>${res.raceLaps} laps</strong></div>
          <div class="ai-calc-kpi"><span>Combustible total</span><strong>${res.totalFuel} L</strong></div>
          <div class="ai-calc-kpi"><span>Paradas en box</span><strong>${res.stops} pit${res.stops === 1 ? "" : "s"}</strong></div>
          <div class="ai-calc-kpi"><span>Stint equilibrado</span><strong>${res.fuelPerStint} L</strong></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--ai-muted)">
          Autonomía máxima por depósito: <strong>${res.maxLapsStint} vueltas</strong> · Incluye ${res.formLap ? "1 vuelta de formación + " : ""}${res.margin} vuelta(s) de margen.
        </div>
      `;
    }
    return res;
  }

  function renderBalanceCalc() {
    const key = $("calcSymptom")?.value || "entry_understeer";
    const guide = BALANCE_GUIDES[key] || BALANCE_GUIDES.entry_understeer;
    const box = $("calcBalanceResult");
    if (box) {
      box.innerHTML = `
        <strong style="display:block;margin-bottom:6px;color:var(--ai-accent)">${esc(guide.title)}</strong>
        <ul style="margin:0;padding-left:18px">${guide.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      `;
    }
    return { car: $("calcCarCat")?.value || "GT3", guide };
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

  async function renderArtifactsGallery(tab = activeArtifactsTab) {
    activeArtifactsTab = tab;
    $("artTabCloud")?.classList.toggle("is-active", tab === "cloud");
    $("artTabTemplates")?.classList.toggle("is-active", tab === "templates");
    $("artTabLocal")?.classList.toggle("is-active", tab === "local");
    const box = $("aiArtifactsGallery");
    const profBar = $("aiArtifactsProfileBar");
    if (!box) return;

    if (tab === "templates") {
      if (profBar) profBar.hidden = true;
      box.innerHTML = ARTIFACT_TEMPLATES.map((tpl, i) => `
        <div class="ai-proj-card">
          <div style="flex:1;min-width:0">
            <strong>${esc(tpl.title)}</strong>
            <p>${esc(tpl.type.toUpperCase())} · ${esc(tpl.desc)}</p>
          </div>
          <button type="button" class="ai-mini-btn ai-mini-btn--accent" data-open-tpl="${i}">Usar</button>
        </div>
      `).join("");
      return;
    }

    if (tab === "local") {
      if (profBar) profBar.hidden = true;
      if (!state.artifacts.length) {
        box.innerHTML = `<p style="color:var(--ai-muted);font-size:13px">Aún no has generado artefactos locales. Prueba una plantilla útil o pide una calculadora HTML, diagrama SVG, tabla CSV o presentación.</p>`;
        return;
      }
      box.innerHTML = state.artifacts.map((a, i) => `
        <div class="ai-proj-card">
          <div style="flex:1;min-width:0">
            <strong>${esc(a.title)}</strong>
            <p>${esc((a.type || "doc").toUpperCase())}${a.publishedUrl ? ` · ${esc(a.publishedUrl.replace(/^https?:\/\//, ""))}` : ""}</p>
          </div>
          <button type="button" class="ai-mini-btn ai-mini-btn--accent" data-reopen-art="${i}">Abrir</button>
        </div>
      `).join("");
      return;
    }

    // Cloud tab (saved per authenticated Muntrume profile in Cloudflare D1)
    const token = getVaultToken();
    if (!token) {
      if (profBar) profBar.hidden = true;
      box.innerHTML = `
        <div class="ai-proj-card" style="flex-direction:column;align-items:flex-start;gap:10px">
          <div>
            <strong>Guarda y publica tus artefactos por perfil</strong>
            <p>Inicia sesión con tu cuenta de piloto para guardar tus apps, informes y presentaciones en la nube con URL propia <code>ai.muntru.me/a/…</code>.</p>
          </div>
          <button type="button" class="ai-btn-accent" id="artLoginPromptBtn">Conectar perfil Muntrume</button>
        </div>
      `;
      $("artLoginPromptBtn")?.addEventListener("click", () => {
        closeAllModals();
        pendingPostLoginAction = () => { openModal("aiArtifactsModal"); renderArtifactsGallery("cloud"); };
        openModal("aiLoginModal");
        $("aiLoginEmail")?.focus();
      });
      return;
    }

    box.innerHTML = `<p style="color:var(--ai-muted);font-size:13px">Cargando artefactos de tu perfil…</p>`;
    await loadCloudArtifacts();
    if (profBar && cloudProfile) {
      profBar.hidden = false;
      profBar.innerHTML = `<span>Perfil conectado: <strong style="color:var(--ai-text)">${esc(cloudProfile.name)}</strong> (${cloudArtifacts.length} guardados)</span><a href="${esc(cloudProfile.profile_url)}" target="_blank" rel="noopener noreferrer">${esc(cloudProfile.profile_url.replace(/^https?:\/\//, ""))}</a>`;
    }
    if (!cloudArtifacts.length) {
      box.innerHTML = `<p style="color:var(--ai-muted);font-size:13px">Todavía no has publicado ningún artefacto en tu perfil. Abre una plantilla o genera uno en el chat y pulsa <strong>Publicar en ai.muntru.me</strong>.</p>`;
      return;
    }
    box.innerHTML = cloudArtifacts.map((a, i) => `
      <div class="ai-proj-card">
        <div style="flex:1;min-width:0">
          <strong>${esc(a.title)}</strong>
          <p>${esc(a.type.toUpperCase())} · ${a.is_public ? "Público" : "Privado"} · ${a.views} vistas · <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--ai-accent);text-decoration:none">${esc(a.url.replace(/^https?:\/\//, ""))}</a></p>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <button type="button" class="ai-mini-btn ai-mini-btn--accent" data-open-cloud-art="${i}">Editar</button>
          <button type="button" class="ai-mini-btn" data-copy-cloud-url="${esc(a.url)}">URL</button>
          <button type="button" class="ai-mini-btn" style="color:#ef4444" data-del-cloud-art="${esc(a.id)}">Borrar</button>
        </div>
      </div>
    `).join("");
  }

  function consumeWidgetHandoff() {
    let data = null;
    try {
      if (location.hash && location.hash.startsWith("#handoff=")) {
        const b64 = location.hash.slice(9).replace(/-/g, "+").replace(/_/g, "/");
        const json = decodeURIComponent(escape(atob(b64)));
        data = JSON.parse(json);
        history.replaceState(null, "", location.pathname + location.search);
      }
    } catch {}
    if (!data) {
      try {
        const raw = localStorage.getItem(HANDOFF_KEY);
        if (raw) {
          localStorage.removeItem(HANDOFF_KEY);
          data = JSON.parse(raw);
        }
      } catch {}
    }
    if (data && Array.isArray(data.messages) && data.messages.length > 0) {
      const chat = createNewChat(data.messages[0]?.content?.slice(0, 44) || "Desde Copiloto");
      chat.messages = data.messages;
      if (data.tier && MODELS[data.tier]) state.tier = data.tier;
      saveState();
    }
  }

  function init() {
    consumeWidgetHandoff();
    setGreeting();
    syncComposerControls();
    renderChatList();
    renderMessages();
    checkCloneHash();

    const feedEl = $("aiFeed");
    feedEl?.addEventListener("scroll", () => {
      const dist = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight;
      userScrolledUp = dist > 120;
      const btn = $("aiScrollDownBtn");
      if (btn) btn.hidden = !userScrolledUp || !streaming;
    }, { passive: true });
    $("aiScrollDownBtn")?.addEventListener("click", () => scrollFeedToBottom(true));

    $("aiPaceBtn")?.addEventListener("click", () => {
      const order = ["calm", "normal", "fast"];
      state.pace = order[(order.indexOf(state.pace) + 1) % order.length];
      saveState();
      syncComposerControls();
      showToast(`Ritmo de lectura: ${PACE_PRESETS[state.pace].label}`);
    });
    $("aiSkipAnimBtn")?.addEventListener("click", () => {
      if (activeRevealer) activeRevealer.flush();
    });

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
    $("aiArtifactsBtn")?.addEventListener("click", () => { openModal("aiArtifactsModal"); renderArtifactsGallery(getVaultToken() ? "cloud" : "templates"); });
    $("artTabCloud")?.addEventListener("click", () => renderArtifactsGallery("cloud"));
    $("artTabTemplates")?.addEventListener("click", () => renderArtifactsGallery("templates"));
    $("artTabLocal")?.addEventListener("click", () => renderArtifactsGallery("local"));
    $("aiLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = ($("aiLoginEmail")?.value || "").trim();
      const password = $("aiLoginPass")?.value || "";
      const errEl = $("aiLoginErr");
      const subBtn = $("aiLoginSubmit");
      if (errEl) errEl.hidden = true;
      if (subBtn) { subBtn.disabled = true; subBtn.textContent = "Conectando…"; }
      try {
        const res = await fetch(`${API_ORIGIN}/api/setups/auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.token) throw new Error(j.error || "Credenciales incorrectas.");
        localStorage.setItem("mrt_vault_token", j.token);
        if (j.user) localStorage.setItem("mrt_vault_user", JSON.stringify(j.user));
        if ($("aiLoginPass")) $("aiLoginPass").value = "";
        closeAllModals();
        syncTeamGate();
        window.dispatchEvent(new Event("muntrume-auth-change"));
        showToast(`Perfil conectado: ${j.user?.name || email}`);
        const act = pendingPostLoginAction;
        pendingPostLoginAction = null;
        if (typeof act === "function") act();
      } catch (err) {
        if (errEl) { errEl.textContent = err?.message || "No se pudo iniciar sesión."; errEl.hidden = false; }
      } finally {
        if (subBtn) { subBtn.disabled = false; subBtn.textContent = "Entrar y guardar"; }
      }
    });
    $("aiCodeModeBtn")?.addEventListener("click", () => {
      state.skill = "code"; state.projectId = "dev"; state.activeChatId = null;
      saveState(); syncComposerControls(); renderMessages(); $("aiInput")?.focus();
    });
    $("aiPersonalizeBtn")?.addEventListener("click", () => {
      if ($("aiPaceSelect")) $("aiPaceSelect").value = state.pace || "calm";
      if ($("aiCustomInstrInput")) $("aiCustomInstrInput").value = state.customInstructions || "";
      if ($("aiMemoryInput")) $("aiMemoryInput").value = state.memory || "";
      openModal("aiPersonalizeModal");
    });
    $("aiCalcBtn")?.addEventListener("click", () => {
      computeFuelCalc();
      renderBalanceCalc();
      openModal("aiCalcModal");
    });
    $("calcTabFuel")?.addEventListener("click", () => {
      $("calcTabFuel")?.classList.add("is-active");
      $("calcTabBalance")?.classList.remove("is-active");
      if ($("calcPanelFuel")) $("calcPanelFuel").hidden = false;
      if ($("calcPanelBalance")) $("calcPanelBalance").hidden = true;
    });
    $("calcTabBalance")?.addEventListener("click", () => {
      $("calcTabBalance")?.classList.add("is-active");
      $("calcTabFuel")?.classList.remove("is-active");
      if ($("calcPanelFuel")) $("calcPanelFuel").hidden = true;
      if ($("calcPanelBalance")) $("calcPanelBalance").hidden = false;
      renderBalanceCalc();
    });
    ["calcRaceMins", "calcLapTime", "calcFuelLap", "calcTankSize", "calcFormLap", "calcMarginLaps"].forEach((id) => {
      $(id)?.addEventListener("input", computeFuelCalc);
      $(id)?.addEventListener("change", computeFuelCalc);
    });
    ["calcCarCat", "calcSymptom"].forEach((id) => {
      $(id)?.addEventListener("change", renderBalanceCalc);
    });
    $("calcSendFuelToAi")?.addEventListener("click", () => {
      const c = computeFuelCalc();
      closeAllModals();
      state.skill = "strategy";
      syncComposerControls();
      sendMessage(`Prepara un plan de carrera completo en tabla (ventanas de box, cambio de neumáticos y ahorro de combustible) para una carrera de ${c.mins} min en iRacing con vuelta de ${c.lapStr}, consumo de ${c.fuelLap} L/vuelta, depósito de ${c.tank} L (${c.raceLaps} vueltas estimadas, ${c.totalFuel} L totales, ${c.stops} parada(s)).`);
    });
    $("calcSendBalanceToAi")?.addEventListener("click", () => {
      const b = renderBalanceCalc();
      closeAllModals();
      state.skill = "setup";
      syncComposerControls();
      sendMessage(`Conduzco un ${b.car} en iRacing y sufro de "${b.guide.title}". Dame una tabla ordenada de ajustes por prioridad (con valores aproximados en clics/porcentaje y qué vigilar en telemetría Garage 61).`);
    });
    $("aiClearHistoryBtn")?.addEventListener("click", () => {
      if (!window.confirm("¿Borrar todas las conversaciones guardadas en este navegador?")) return;
      state.chats = [];
      state.activeChatId = null;
      saveState();
      renderChatList();
      renderMessages();
      closeAllModals();
      showToast("Historial local borrado");
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

    $("aiArtNewBlankBtn")?.addEventListener("click", () => {
      closeAllModals();
      openArtifactPane({
        title: "Mi nuevo artefacto HTML",
        type: "html",
        lang: "html",
        code: `<!doctype html>\n<html lang="es">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>Mi Artefacto Muntrume</title>\n  <style>body{margin:0;padding:32px;background:#0f1114;color:#f3f5f8;font-family:system-ui,sans-serif}.card{max-width:640px;margin:0 auto;padding:24px;border-radius:16px;background:#171a1f;border:1px solid rgba(16,185,129,.35)}h1{margin:0 0 8px;color:#10b981}</style>\n</head>\n<body>\n  <div class="card">\n    <h1>Nuevo artefacto en ai.muntru.me</h1>\n    <p>Edita este código o pulsa «Mejorar con IA» y publícalo con tu propia URL.</p>\n  </div>\n</body>\n</html>`
      });
      switchArtifactTab("code");
    });
    $("aiArtAskAiBtn")?.addEventListener("click", () => {
      if (!currentArtifact) return;
      pendingAttachment = {
        kind: "text",
        name: `${safeFilename(currentArtifact.title, "artefacto")}.${currentArtifact.lang || "html"}`,
        text: String(currentArtifact.code || "").slice(0, 7500)
      };
      state.skill = currentArtifact.type === "slides" ? "slides" : "code";
      syncComposerControls();
      const inp = $("aiInput");
      if (inp) {
        inp.value = `Mejora este artefacto "${currentArtifact.title}" y devuélvelo completo listo para vista previa: `;
        inp.focus();
      }
      showToast("Artefacto adjuntado al chat para iterar con IA");
    });

    const input = $("aiInput");
    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(220, input.scrollHeight) + "px";
    });
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $("aiComposerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (streaming) {
        activeCtrl?.abort();
        activeRevealer?.stop();
        return;
      }
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
      const pVal = $("aiPaceSelect")?.value;
      if (PACE_PRESETS[pVal]) state.pace = pVal;
      state.customInstructions = $("aiCustomInstrInput")?.value.trim() || "";
      state.memory = $("aiMemoryInput")?.value.trim() || "";
      saveState();
      syncComposerControls();
      closeAllModals();
      showToast("Preferencias guardadas");
    });

    $("aiArtClose")?.addEventListener("click", () => {
      $("aiArtifactPane")?.classList.remove("is-fullscreen");
      closeArtifactPane();
    });
    $("aiArtReload")?.addEventListener("click", () => {
      if (!currentArtifact) return;
      renderArtifactFrame(currentArtifact);
      showToast("Vista previa reiniciada");
    });
    $("aiArtNewTab")?.addEventListener("click", () => {
      const frame = $("aiArtFrame");
      if (!frame?.srcdoc) return;
      const blobUrl = URL.createObjectURL(new Blob([frame.srcdoc], { type: "text/html;charset=utf-8" }));
      window.open(blobUrl, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    });
    $("aiExportChatBtn")?.addEventListener("click", () => {
      const chat = getActiveChat();
      if (!chat || !chat.messages.length) { showToast("No hay mensajes para exportar"); return; }
      const lines = [`# ${chat.title || "Conversación Muntrume AI"}`, `> Exportado desde ai.muntru.me · ${new Date().toISOString()}`, ""];
      chat.messages.forEach((m) => {
        lines.push(m.role === "user" ? "## Usuario" : `## ${m.modelBrand || "Muntrume AI"}`);
        lines.push("", m.content || "", "");
      });
      downloadBlob(`${safeFilename(chat.title, "muntrume_chat")}.md`, lines.join("\n"), "text/markdown;charset=utf-8");
      showToast("Conversación exportada (.md)");
    });
    $("aiArtFullscreen")?.addEventListener("click", () => {
      const pane = $("aiArtifactPane");
      if (!pane) return;
      const fs = pane.classList.toggle("is-fullscreen");
      const btn = $("aiArtFullscreen");
      if (btn) btn.textContent = fs ? "Salir" : "Ampliar";
    });
    document.querySelectorAll("[data-art-vp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const vp = btn.dataset.artVp || "desktop";
        document.querySelectorAll("[data-art-vp]").forEach((b) => b.classList.toggle("is-on", b === btn));
        const frame = $("aiArtFrame");
        if (frame) {
          frame.classList.remove("vp-tablet", "vp-mobile");
          if (vp === "tablet") frame.classList.add("vp-tablet");
          if (vp === "mobile") frame.classList.add("vp-mobile");
        }
      });
    });
    $("aiArtTabPreview")?.addEventListener("click", () => {
      if (currentArtifact && $("aiArtEditor")) {
        currentArtifact.code = $("aiArtEditor").value;
        renderArtifactFrame(currentArtifact);
      }
      switchArtifactTab("preview");
    });
    $("aiArtTabCode")?.addEventListener("click", () => switchArtifactTab("code"));
    $("aiArtTitleInput")?.addEventListener("input", (e) => {
      if (currentArtifact) currentArtifact.title = e.target.value.trim() || "Artefacto";
    });
    $("aiArtEditor")?.addEventListener("input", (e) => {
      if (!currentArtifact) return;
      currentArtifact.code = e.target.value;
      clearTimeout(editorDebounce);
      editorDebounce = setTimeout(() => renderArtifactFrame(currentArtifact), 350);
    });
    $("aiArtPublishBtn")?.addEventListener("click", publishCurrentArtifact);
    $("aiArtPubCopy")?.addEventListener("click", () => {
      if (currentArtifact?.publishedUrl) { navigator.clipboard.writeText(currentArtifact.publishedUrl); showToast("URL copiada al portapapeles"); }
    });
    $("aiArtPubVis")?.addEventListener("click", togglePublishedVisibility);
    $("aiArtCopy")?.addEventListener("click", () => {
      if (currentArtifact?.code) { navigator.clipboard.writeText(currentArtifact.code); showToast("Código copiado"); }
    });
    $("aiArtExportDoc")?.addEventListener("click", () => { if (currentArtifact) exportDoc(currentArtifact.title, currentArtifact.code); });
    $("aiArtExportPdf")?.addEventListener("click", () => { if (currentArtifact) exportPdf(currentArtifact.title, currentArtifact.code); });
    $("aiArtExportSlides")?.addEventListener("click", () => { if (currentArtifact) exportSlides(currentArtifact.title, currentArtifact.code); });
    $("aiArtExportMd")?.addEventListener("click", () => {
      if (!currentArtifact) return;
      downloadBlob(`${safeFilename(currentArtifact.title, "muntrume_ai")}.md`, currentArtifact.code, "text/markdown;charset=utf-8");
      showToast("Archivo Markdown (.md) descargado");
    });
    $("aiArtDownload")?.addEventListener("click", () => {
      if (!currentArtifact) return;
      const ext = currentArtifact.type === "html" || currentArtifact.type === "slides" ? "html" : currentArtifact.type === "svg" ? "svg" : currentArtifact.type === "csv" ? "csv" : currentArtifact.type === "mermaid" ? "mmd" : "md";
      const content = currentArtifact.type === "slides" ? buildSlidesHtml(currentArtifact.title, currentArtifact.code) : currentArtifact.code;
      downloadBlob(`${safeFilename(currentArtifact.title, "muntrume_artifact")}.${ext}`, content, "text/plain;charset=utf-8");
    });

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const tierBtn = t.closest("[data-select-tier]");
      if (tierBtn) {
        const picked = tierBtn.dataset.selectTier || "open";
        if (picked !== "open" && !getVaultToken()) {
          closeAllModals();
          const gate = $("aiTeamGate");
          if (gate) gate.hidden = false;
          return;
        }
        state.tier = picked;
        saveState();
        syncComposerControls();
        closeAllModals();
        return;
      }

      const skillBtn = t.closest("[data-select-skill]");
      if (skillBtn) {
        const picked = skillBtn.dataset.selectSkill || "";
        state.skill = state.skill === picked ? "" : picked;
        saveState(); syncComposerControls(); closeAllModals(); return;
      }

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

      const openTpl = t.closest("[data-open-tpl]");
      if (openTpl) {
        const tpl = ARTIFACT_TEMPLATES[Number(openTpl.dataset.openTpl)];
        if (tpl) { closeAllModals(); openArtifactPane({ ...tpl }); }
        return;
      }

      const openCloud = t.closest("[data-open-cloud-art]");
      if (openCloud) {
        const a = cloudArtifacts[Number(openCloud.dataset.openCloudArt)];
        if (a) {
          closeAllModals();
          openArtifactPane({ cloudId: a.id, slug: a.slug, publishedUrl: a.url, isPublic: a.is_public, title: a.title, type: a.type, lang: a.lang, code: a.code });
        }
        return;
      }

      const copyCloudUrl = t.closest("[data-copy-cloud-url]");
      if (copyCloudUrl) {
        navigator.clipboard.writeText(copyCloudUrl.dataset.copyCloudUrl || "");
        showToast("URL pública copiada");
        return;
      }

      const delCloud = t.closest("[data-del-cloud-art]");
      if (delCloud) {
        const id = delCloud.dataset.delCloudArt;
        if (!window.confirm("¿Eliminar este artefacto publicado de tu perfil?")) return;
        fetch(`${API_ORIGIN}/api/ai/artifacts/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getVaultToken()}` },
          body: JSON.stringify({ id })
        }).then((r) => r.json()).then((j) => {
          if (j.success) { showToast("Artefacto eliminado"); renderArtifactsGallery("cloud"); }
          else showToast(j.error || "Error al eliminar");
        }).catch(() => showToast("Error de red"));
        return;
      }

      const copyCode = t.closest("[data-copy-code]");
      if (copyCode) {
        navigator.clipboard.writeText(decodeURIComponent(copyCode.dataset.copyCode || ""));
        copyCode.textContent = "Copiado";
        setTimeout(() => { copyCode.textContent = "Copiar"; }, 1400);
        return;
      }

      const dlCode = t.closest("[data-download-code]");
      if (dlCode) {
        const lang = dlCode.dataset.codeLang || "txt";
        const extMap = { javascript: "js", typescript: "ts", python: "py", markdown: "md", html: "html", htm: "html", svg: "svg", css: "css", json: "json", sql: "sql", bash: "sh", csv: "csv" };
        const ext = extMap[lang] || lang.slice(0, 6) || "txt";
        downloadBlob(`muntrume_snippet.${ext}`, decodeURIComponent(dlCode.dataset.downloadCode || ""), "text/plain;charset=utf-8");
        showToast(`Archivo .${ext} descargado`);
        return;
      }

      const copyCsv = t.closest("[data-copy-csv]");
      if (copyCsv) {
        navigator.clipboard.writeText(decodeURIComponent(copyCsv.dataset.copyCsv || ""));
        showToast("Tabla copiada en formato CSV");
        return;
      }

      const dlCsv = t.closest("[data-download-csv]");
      if (dlCsv) {
        downloadBlob("muntrume_tabla.csv", "\ufeff" + decodeURIComponent(dlCsv.dataset.downloadCsv || ""), "text/csv;charset=utf-8");
        showToast("Tabla descargada (.csv)");
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
        showToast("Respuesta copiada al portapapeles");
        return;
      }

      const chat = getActiveChat();
      const regenBtn = t.closest("[data-regen-msg]");
      if (regenBtn && chat && !streaming) {
        const idx = Number(regenBtn.dataset.regenMsg);
        const prevUser = chat.messages.slice(0, idx).reverse().find((m) => m.role === "user");
        if (prevUser) {
          chat.messages = chat.messages.slice(0, idx - 1);
          saveState();
          sendMessage(prevUser.content);
        }
        return;
      }
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

    $("aiPasskeyLoginBtn")?.addEventListener("click", async () => {
      const errEl = $("aiLoginErr");
      const pkBtn = $("aiPasskeyLoginBtn");
      if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
      if (!window.PublicKeyCredential || !navigator.credentials?.get) {
        if (errEl) { errEl.textContent = "Este navegador no soporta Passkeys (WebAuthn)."; errEl.hidden = false; }
        return;
      }
      const b64uDec = (s) => {
        const b = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
        const p = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
        const bin = atob(b + p);
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return u;
      };
      const b64uEnc = (buf) => {
        const u = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
        return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      };
      if (pkBtn) { pkBtn.disabled = true; pkBtn.textContent = "Verificando Passkey…"; }
      try {
        const email = ($("aiLoginEmail")?.value || "").trim();
        const optRes = await fetch(`${API_ORIGIN}/api/auth/passkey/login/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const optJ = await optRes.json().catch(() => ({}));
        if (!optRes.ok || !optJ.options) throw new Error(optJ.error || "No se pudo iniciar Passkey.");
        const pubKeyOpts = {
          challenge: b64uDec(optJ.options.challenge),
          rpId: optJ.options.rpId || "muntru.me",
          timeout: optJ.options.timeout || 60000,
          userVerification: "preferred",
          allowCredentials: (optJ.options.allowCredentials || []).map((c) => ({ type: "public-key", id: b64uDec(c.id) }))
        };
        const assertion = await navigator.credentials.get({ publicKey: pubKeyOpts });
        if (!assertion) throw new Error("Passkey cancelada.");
        const verRes = await fetch(`${API_ORIGIN}/api/auth/passkey/login/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential_id: assertion.id,
            authenticator_data: b64uEnc(assertion.response.authenticatorData),
            client_data_json: b64uEnc(assertion.response.clientDataJSON),
            signature: b64uEnc(assertion.response.signature)
          })
        });
        const verJ = await verRes.json().catch(() => ({}));
        if (!verRes.ok || !verJ.token) throw new Error(verJ.error || "Passkey no válida.");
        localStorage.setItem("mrt_vault_token", verJ.token);
        if (verJ.user) localStorage.setItem("mrt_vault_user", JSON.stringify(verJ.user));
        closeAllModals();
        syncTeamGate();
        window.dispatchEvent(new Event("muntrume-auth-change"));
        showToast(`Passkey verificada: ${verJ.user?.name || verJ.user?.email || "Piloto"}`);
      } catch (err) {
        if (errEl) { errEl.textContent = err?.message || "No se pudo iniciar sesión con Passkey."; errEl.hidden = false; }
      } finally {
        if (pkBtn) { pkBtn.disabled = false; pkBtn.textContent = "Entrar con Passkey"; }
      }
    });
    // Cross-subdomain session handoff from muntru.me/login/ via URL hash (never sent to servers)
    try {
      if (location.hash && location.hash.includes("mm_auth=")) {
        const hp = new URLSearchParams(location.hash.slice(1));
        const tk = hp.get("mm_auth");
        const ub = hp.get("mm_user");
        if (tk) {
          localStorage.setItem("mrt_vault_token", tk);
          localStorage.setItem("mm_token", tk);
          if (ub) {
            try { localStorage.setItem("mrt_vault_user", decodeURIComponent(escape(atob(ub)))); } catch {}
          }
          history.replaceState(null, "", location.pathname + location.search);
          window.dispatchEvent(new Event("muntrume-auth-change"));
        }
      }
    } catch {}

    $("aiGateLoginBtn")?.addEventListener("click", () => {
      if (location.hostname === "ai.muntru.me") {
        location.href = "https://muntru.me/login/?next=" + encodeURIComponent(location.origin + location.pathname);
        return;
      }
      if ($("aiTeamGate")) $("aiTeamGate").hidden = true;
      openModal("aiLoginModal");
      $("aiLoginEmail")?.focus();
    });
    window.addEventListener("muntrume-auth-change", syncTeamGate);
    window.addEventListener("storage", syncTeamGate);
    syncTeamGate();

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
})(typeof globalThis !== "undefined" ? globalThis : window);
