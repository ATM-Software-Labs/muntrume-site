/**
 * Muntrume AI — Mini-Preview Copilot Widget (v3.1 — Clean Monochrome, Zero Emojis, Theme-Synced)
 */
const API = "https://muntrume.atrumin16.workers.dev/api/ai";
const HANDOFF_KEY = "muntrume_ai_handoff";

const TIERS = [
  { id: "lite", label: "1.0 Lite" },
  { id: "pro", label: "1.0 Pro" },
  { id: "ultra_max", label: "1.0 Ultra Max" }
];

const CSS = `
#mmChat{--bg:#111315;--hd:#0b0d0f;--sf:#1a1d21;--bd:rgba(255,255,255,.1);--tx:#f3f4f6;--mu:#9ca3af;--ac:#10b981;--acTx:#04130d;position:fixed;z-index:60;right:max(1rem,env(safe-area-inset-right));bottom:max(1rem,env(safe-area-inset-bottom));width:min(430px,calc(100vw - 2rem));height:min(620px,calc(100dvh - 2rem));display:flex;flex-direction:column;background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.5);overflow:hidden;font:13.5px/1.5 system-ui,-apple-system,sans-serif;transition:width .2s ease,height .2s ease}
#mmChat.is-wide{width:min(680px,calc(100vw - 2rem));height:min(760px,calc(100dvh - 2rem))}
html.light #mmChat,html[data-theme="light"] #mmChat{--bg:#f8f9fa;--hd:#f1f3f5;--sf:#ffffff;--bd:rgba(15,23,42,.12);--tx:#111827;--mu:#5b6470;--ac:#059669;--acTx:#fff}
#mmChat[hidden]{display:none}
#mmChat header{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--hd);border-bottom:1px solid var(--bd)}
#mmChat .mm-mark{width:26px;height:26px;border-radius:8px;background:rgba(16,185,129,.14);color:var(--ac);display:grid;place-items:center;flex-shrink:0}
#mmChat .mm-ttl{min-width:0}
#mmChat .mm-ttl b{display:block;font-size:13px;line-height:1.2;color:var(--tx)}
#mmChat .mm-tier{border:0;background:transparent;color:var(--ac);font:600 11px/1.2 system-ui,sans-serif;padding:0;cursor:pointer}
#mmChat .mm-ic{margin-left:auto;display:flex;align-items:center;gap:3px}
#mmChat .mm-ib{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--mu);display:grid;place-items:center;cursor:pointer}
#mmChat .mm-ib:hover{background:var(--sf);color:var(--tx)}
#mmChat .mm-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}
#mmChat .mm-m{max-width:90%;padding:10px 13px;border-radius:14px;word-break:break-word}
#mmChat .mm-u{align-self:flex-end;background:var(--sf);border:1px solid var(--bd);border-top-right-radius:4px;color:var(--tx)}
#mmChat .mm-a{align-self:flex-start;background:transparent;padding:4px 2px;max-width:100%;color:var(--tx)}
#mmChat .mm-a p{margin:4px 0}
#mmChat .mm-a pre{margin:8px 0;padding:10px;border-radius:10px;background:#101113;color:#e5e7eb;overflow-x:auto;font:400 12px/1.45 ui-monospace,monospace}
#mmChat .mm-a code{font-family:ui-monospace,monospace;font-size:12px;background:var(--sf);color:var(--ac);padding:1px 5px;border-radius:4px}
#mmChat .mm-a pre code{background:transparent;color:inherit;padding:0}
#mmChat .mm-a img,#mmChat .mm-u img{max-width:200px;max-height:120px;border-radius:8px;margin-bottom:6px;display:block;border:1px solid var(--bd)}
#mmChat .mm-acts{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
#mmChat .mm-acts button{border:1px solid var(--bd);background:var(--sf);color:var(--mu);border-radius:7px;padding:3px 8px;font-size:11px;font-weight:600;cursor:pointer}
#mmChat .mm-acts button:hover{border-color:var(--ac);color:var(--tx)}
#mmChat .mm-chips{display:flex;gap:6px;padding:6px 12px;overflow-x:auto;border-top:1px solid var(--bd);background:var(--hd)}
#mmChat .mm-chips button{white-space:nowrap;font-size:11.5px;padding:5px 10px;border-radius:999px;border:1px solid var(--bd);background:var(--sf);color:var(--mu);cursor:pointer}
#mmChat .mm-chips button:hover{border-color:var(--ac);color:var(--tx)}
#mmChat .mm-attbar{display:flex;align-items:center;gap:6px;padding:6px 12px 0;font-size:11.5px;color:var(--ac)}
#mmChat .mm-attbar[hidden]{display:none}
#mmChat .mm-attbar button{border:0;background:transparent;color:var(--mu);cursor:pointer;font-weight:700}
#mmChat form{display:flex;flex-direction:column;gap:6px;padding:8px 10px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--bd);background:var(--hd)}
#mmChat .mm-inrow{display:flex;align-items:center;gap:6px;background:var(--sf);border:1px solid var(--bd);border-radius:12px;padding:4px 6px}
#mmChat .mm-inrow:focus-within{border-color:var(--ac)}
#mmChat input[type="text"]{flex:1;min-width:0;border:0;background:transparent;color:var(--tx);font-size:14px;padding:6px;outline:none}
#mmChat .mm-tool{border:0;background:transparent;color:var(--mu);width:28px;height:28px;border-radius:7px;display:grid;place-items:center;cursor:pointer}
#mmChat .mm-tool:hover{background:rgba(127,127,127,.14);color:var(--tx)}
#mmChat .mm-tool.is-on{color:var(--ac)}
#mmChat .mm-send{border:0;border-radius:9px;width:30px;height:30px;background:var(--ac);color:var(--acTx);cursor:pointer;display:grid;place-items:center}
#mmChat .mm-send:disabled{opacity:.45;cursor:not-allowed}
#mmChat .mm-dots{display:inline-flex;align-items:center;gap:5px;color:var(--mu);font-size:12px}
#mmChat .mm-dots i{width:5px;height:5px;border-radius:50%;background:var(--ac);animation:mmd .9s infinite ease-in-out}
#mmChat .mm-dots i:nth-child(2){animation-delay:.15s}#mmChat .mm-dots i:nth-child(3){animation-delay:.3s}
@keyframes mmd{0%,80%,100%{opacity:.25}40%{opacity:1}}
@media (max-width:640px){#mmChat,#mmChat.is-wide{inset:0;width:100%;height:100dvh;border-radius:0;border:0}}
`;

let root, log, input, sendBtn, chips, attBar, attLbl, fileInput, tierSelect, webBtn, launcher;
let messages = [];
let tier = "pro";
let webOn = true;
let streaming = false;
let pendingAtt = null;
let ctrl = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function mdToHtml(md) {
  let t = esc(md || "");
  t = t.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--ac)">$1</a>');
  return t.split(/\n{2,}/).map((p) => p.startsWith("<pre>") ? p : `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

function quickExport(kind, md) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Muntrume AI</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 20px;color:#111;line-height:1.6}pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto}</style></head><body><h1>Muntrume AI · Nota Técnica</h1>${mdToHtml(md)}</body></html>`;
  if (kind === "pdf") {
    const w = window.open("", "_blank", "width=850,height=680");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch {} }, 300); }
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" }));
    a.download = "muntrume_ai_nota.doc";
    a.click();
  }
}

function compressImg(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const img = new Image();
      img.onerror = rej;
      img.onload = () => {
        const k = Math.min(1, 1200 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

async function attachFile(file) {
  if (!file) return;
  if (file.type.startsWith("image/")) {
    pendingAtt = { kind: "image", name: file.name || "captura.jpg", dataUrl: await compressImg(file) };
  } else {
    pendingAtt = { kind: "text", name: file.name, text: (await file.text().catch(() => "")).slice(0, 6000) };
  }
  attLbl.textContent = `${pendingAtt.kind === "image" ? "Imagen" : "Archivo"}: ${pendingAtt.name}`;
  attBar.hidden = false;
  input.focus();
}

function renderLog() {
  log.innerHTML = "";
  if (!messages.length) {
    const hello = document.createElement("div");
    hello.className = "mm-m mm-a";
    hello.innerHTML = "<p><strong>Muntrume AI</strong> · Pregunta sobre setups iRacing, estrategia de combustible, código o pega una captura con <code>Ctrl+V</code>.</p>";
    log.appendChild(hello);
    return;
  }
  messages.forEach((m, idx) => {
    const d = document.createElement("div");
    d.className = "mm-m " + (m.role === "user" ? "mm-u" : "mm-a");
    if (m.role === "user") {
      d.innerHTML = (m.image ? `<img src="${esc(m.image)}" alt="Adjunto">` : "") + esc(m.content).replace(/\n/g, "<br>");
    } else {
      d.innerHTML = m.pending
        ? `<div class="mm-dots"><i></i><i></i><i></i> <span>Muntrume ${esc(tier.replace("_", " "))} procesando…</span></div>`
        : `${mdToHtml(m.content)}<div class="mm-acts"><button type="button" data-c="${idx}">Copiar</button><button type="button" data-d="${idx}">DOC</button><button type="button" data-p="${idx}">PDF</button><button type="button" data-f="${idx}">Abrir Studio</button></div>`;
    }
    log.appendChild(d);
  });
  log.scrollTop = log.scrollHeight;
}

function openInFullStudio() {
  try {
    if (messages.length) {
      localStorage.setItem(HANDOFF_KEY, JSON.stringify({ tier, messages: messages.filter((m) => !m.pending) }));
    }
  } catch {}
  window.location.href = "/ai/";
}

async function send(raw) {
  const txt = String(raw || "").trim();
  if ((!txt && !pendingAtt) || streaming) return;
  const att = pendingAtt;
  pendingAtt = null;
  attBar.hidden = true;
  input.value = "";
  chips.hidden = true;

  messages.push({ role: "user", content: txt || "Analiza esta imagen.", image: att?.kind === "image" ? att.dataUrl : undefined });
  const bot = { role: "assistant", content: "", pending: true, modelBrand: `Muntrume ${TIERS.find((x) => x.id === tier)?.label || "1.0 Pro"}` };
  messages.push(bot);
  renderLog();

  streaming = true; sendBtn.disabled = true;
  ctrl = new AbortController();
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        prompt: txt || "Analiza esta captura de pantalla.",
        tier,
        mode: "team",
        web_search: webOn,
        chat_history: messages.slice(0, -2).slice(-6).map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        image: att?.kind === "image" ? att.dataUrl : undefined,
        attachment_name: att?.kind === "text" ? att.name : undefined,
        attachment_text: att?.kind === "text" ? att.text : undefined
      })
    });
    if (!res.ok) throw new Error("err");
    const cType = (res.headers.get("content-type") || "").toLowerCase();
    if (cType.includes("event-stream") && res.body) {
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      bot.pending = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const ln of lines) {
          const l = ln.trim(); if (!l.startsWith("data:")) continue;
          const d = l.slice(5).trim(); if (d === "[DONE]") break;
          try {
            const j = JSON.parse(d);
            const delta = j.token || j.delta || j.choices?.[0]?.delta?.content || "";
            if (delta) { bot.content += delta; renderLog(); }
          } catch {}
        }
      }
    } else {
      const j = await res.json().catch(() => ({}));
      bot.pending = false;
      bot.content = j.markdown || j.answer || j.result || "Sin respuesta.";
    }
  } catch {
    bot.pending = false;
    bot.content = bot.content || "No pude conectar ahora mismo. Prueba a abrir Muntrume AI Studio (/ai/) o reintenta.";
  } finally {
    streaming = false; sendBtn.disabled = false;
    renderLog();
    input.focus();
  }
}

function build() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  root = document.createElement("section");
  root.id = "mmChat"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Muntrume AI Copilot"); root.hidden = true;

  root.innerHTML = `
    <header>
      <div class="mm-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
      <div class="mm-ttl">
        <b>Muntrume AI</b>
        <select id="mmTierSel" class="mm-tier" aria-label="Modelo Muntrume">
          ${TIERS.map((t) => `<option value="${t.id}" ${t.id === tier ? "selected" : ""}>Muntrume ${t.label}</option>`).join("")}
        </select>
      </div>
      <div class="mm-ic">
        <button type="button" id="mmWideBtn" class="mm-ib" title="Ampliar vista previa"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>
        <button type="button" id="mmFullBtn" class="mm-ib" title="Abrir en Muntrume AI Studio (/ai/)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>
        <button type="button" id="mmResetBtn" class="mm-ib" title="Nueva conversación"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
        <button type="button" id="mmCloseBtn" class="mm-ib" title="Cerrar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </header>
    <div id="mmLog" class="mm-log" role="log" aria-live="polite"></div>
    <div id="mmChips" class="mm-chips">
      <button type="button" data-chip="Dame ajustes rápidos para reducir subviraje en GT3.">Setup GT3</button>
      <button type="button" data-chip="Calcula combustible para 45 min GT3 (2.9 L/vuelta, 2:17).">Estrategia</button>
      <button type="button" data-chip="¿Quiénes son los pilotos y qué incluye MMT Sync?">Equipo MMT</button>
    </div>
    <div id="mmAttBar" class="mm-attbar" hidden><span id="mmAttLbl"></span><button type="button" id="mmAttClear">×</button></div>
    <form id="mmForm" autocomplete="off">
      <input type="file" id="mmFile" hidden accept="image/png,image/jpeg,image/webp,.txt,.md,.csv,.json,.js,.ts,.py,.sto" />
      <div class="mm-inrow">
        <button type="button" id="mmPlusBtn" class="mm-tool" title="Adjuntar archivo o imagen (o Ctrl+V)"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <button type="button" id="mmWebBtn" class="mm-tool is-on" title="Búsqueda web en vivo"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></button>
        <input type="text" id="mmInput" placeholder="Pregunta o pega una captura (Ctrl+V)…" maxlength="2000" />
        <button type="submit" id="mmSend" class="mm-send" aria-label="Enviar"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></button>
      </div>
    </form>
  `;
  document.body.appendChild(root);

  log = root.querySelector("#mmLog");
  input = root.querySelector("#mmInput");
  sendBtn = root.querySelector("#mmSend");
  chips = root.querySelector("#mmChips");
  attBar = root.querySelector("#mmAttBar");
  attLbl = root.querySelector("#mmAttLbl");
  fileInput = root.querySelector("#mmFile");
  tierSelect = root.querySelector("#mmTierSel");
  webBtn = root.querySelector("#mmWebBtn");

  tierSelect.addEventListener("change", () => { tier = tierSelect.value; });
  root.querySelector("#mmWideBtn").addEventListener("click", () => { root.classList.toggle("is-wide"); });
  root.querySelector("#mmFullBtn").addEventListener("click", openInFullStudio);
  root.querySelector("#mmResetBtn").addEventListener("click", () => { if (ctrl) ctrl.abort(); messages = []; chips.hidden = false; renderLog(); input.focus(); });
  root.querySelector("#mmCloseBtn").addEventListener("click", close);
  root.querySelector("#mmPlusBtn").addEventListener("click", () => fileInput.click());
  root.querySelector("#mmAttClear").addEventListener("click", () => { pendingAtt = null; attBar.hidden = true; });
  fileInput.addEventListener("change", (e) => { if (e.target.files?.[0]) attachFile(e.target.files[0]); e.target.value = ""; });
  webBtn.addEventListener("click", () => { webOn = !webOn; webBtn.classList.toggle("is-on", webOn); });
  root.querySelector("#mmForm").addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });

  chips.addEventListener("click", (e) => {
    const b = e.target.closest("[data-chip]");
    if (b) send(b.dataset.chip);
  });

  log.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.c != null) { navigator.clipboard.writeText(messages[Number(btn.dataset.c)]?.content || ""); btn.textContent = "Copiado"; setTimeout(() => { btn.textContent = "Copiar"; }, 1200); }
    else if (btn.dataset.d != null) quickExport("doc", messages[Number(btn.dataset.d)]?.content || "");
    else if (btn.dataset.p != null) quickExport("pdf", messages[Number(btn.dataset.p)]?.content || "");
    else if (btn.dataset.f != null) openInFullStudio();
  });

  root.addEventListener("paste", (e) => {
    for (const item of e.clipboardData?.items || []) {
      if (item.type?.startsWith("image/")) { attachFile(item.getAsFile()); break; }
    }
  });

  renderLog();
}

function onKey(e) { if (e.key === "Escape" && root && !root.hidden) { e.preventDefault(); close(); } }

export function open(btn) {
  launcher = btn;
  if (!root) build();
  root.hidden = false;
  btn.setAttribute("aria-expanded", "true");
  btn.parentElement.hidden = true;
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => input.focus());
}

function close() {
  document.removeEventListener("keydown", onKey);
  root.hidden = true;
  if (launcher) {
    launcher.parentElement.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }
}
