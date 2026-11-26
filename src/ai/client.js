import { answerLocally, systemPrompt } from "./local-engine.ts";

const STORE = "muntrume-ai-chats";
const THEME_KEY = "muntrume-ai-theme";
const SIDE_KEY = "muntrume-ai-side";
const OLLAMA = "http://localhost:11434";
const MD = "/assets/js/ai-md.js?v=pro2";

const $ = (id) => document.getElementById(id);
const app = document.querySelector(".ai-app");
const log = $("aiLog");
const empty = $("aiEmpty");
const form = $("aiForm");
const input = $("aiInput");
const sendBtn = $("aiSend");
const listEl = $("aiChatList");
const statusEl = $("aiStatus");
const live = $("aiLive");
const hint = $("aiOllamaHint");
const localBox = $("aiLocalBox");
const ollamaSelect = $("aiOllamaModel");
const modeSelect = $("aiMode");
const tierSelect = $("aiTier");

if (app && log && form && input && sendBtn) {
  const state = loadStore();
  let streaming = false;
  let controller = null;
  let mdPromise = null;
  let renderJob = 0;

  applyTheme(readTheme());
  setSide(readSide());
  syncSelectors();
  renderList();
  renderThread();
  if (tierSelect.value === "local") loadOllamaTags();

  modeSelect.addEventListener("change", () => {
    const chat = current();
    if (chat) chat.mode = modeSelect.value;
    save();
  });
  tierSelect.addEventListener("change", () => {
    const chat = current();
    if (chat) chat.tier = tierSelect.value;
    save();
    localBox.hidden = tierSelect.value !== "local";
    if (tierSelect.value === "local") loadOllamaTags();
    setStatus(labelFor(tierSelect.value, null));
  });
  $("aiTheme").addEventListener("click", () => {
    const next = app.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  });
  $("aiSideOpen").addEventListener("click", () => setSide(true));
  $("aiSideClose").addEventListener("click", () => setSide(false));
  $("aiScrim").addEventListener("click", () => setSide(false));
  $("aiNew").addEventListener("click", () => newChat());
  document.querySelectorAll("[data-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.getAttribute("data-mode");
      if (mode) {
        modeSelect.value = mode;
        modeSelect.dispatchEvent(new Event("change"));
      }
      input.value = button.getAttribute("data-chip") || "";
      resizeInput();
      input.focus();
      ask(input.value);
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });
  input.addEventListener("input", resizeInput);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask(input.value);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setSide(false);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      newChat();
    }
  });
  log.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const codeBtn = target.closest(".ai-codecopy");
    if (codeBtn) {
      const pre = codeBtn.parentElement?.querySelector("pre");
      copyText(pre ? pre.innerText : "", codeBtn, "Copiar");
      return;
    }
    const answerBtn = target.closest(".ai-copy");
    if (answerBtn) {
      const article = answerBtn.closest("[data-id]");
      const chat = current();
      const message = chat?.messages.find((item) => item.id === article?.getAttribute("data-id"));
      copyText(answerOf(message?.content || ""), answerBtn, "Copiar");
    }
  });
  listEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const row = target.closest("[data-chat]");
    if (!row) return;
    const id = row.getAttribute("data-chat");
    if (target.closest("[data-rename]")) return renameChat(id, row);
    if (target.closest("[data-delete]")) return deleteChat(id, row);
    openChat(id);
  });
  sendBtn.addEventListener("click", (event) => {
    if (!streaming) return;
    event.preventDefault();
    controller?.abort();
  });

  function loadStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE) || "");
      if (parsed && Array.isArray(parsed.items)) return parsed;
    } catch { /* ignore */ }
    return { active: "", items: [] };
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ }
  }
  function current() {
    return state.items.find((item) => item.id === state.active) || null;
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch { /* ignore */ }
    return document.documentElement.getAttribute("data-ai-theme") === "light" ? "light" : "dark";
  }
  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    app.setAttribute("data-theme", next);
    document.documentElement.setAttribute("data-ai-theme", next);
    const button = $("aiTheme");
    const light = next === "light";
    button.setAttribute("aria-pressed", light ? "true" : "false");
    button.textContent = light ? "Light Pro" : "Dark Pro";
  }
  function wideScreen() {
    return window.matchMedia("(min-width: 960px)").matches;
  }
  function readSide() {
    if (!wideScreen()) return false;
    try {
      const stored = localStorage.getItem(SIDE_KEY);
      if (stored === "open" || stored === "closed") return stored === "open";
    } catch { /* ignore */ }
    return true;
  }
  function setSide(open) {
    app.classList.toggle("is-side-open", open);
    $("aiSideOpen").setAttribute("aria-expanded", open ? "true" : "false");
    $("aiScrim").hidden = !open || wideScreen();
    if (wideScreen()) {
      try { localStorage.setItem(SIDE_KEY, open ? "open" : "closed"); } catch { /* ignore */ }
    }
  }
  window.addEventListener("resize", () => {
    const open = app.classList.contains("is-side-open");
    $("aiScrim").hidden = !open || wideScreen();
  });
  function syncSelectors() {
    const chat = current();
    modeSelect.value = chat?.mode || "team";
    tierSelect.value = chat?.tier || "lite";
    localBox.hidden = tierSelect.value !== "local";
    setStatus(labelFor(tierSelect.value, null));
  }
  function labelFor(tier, meta) {
    const names = { lite: "Lite", pro: "Pro", ultra: "Ultra Max", local: "Local" };
    if (meta?.provider === "ollama") return `Local · ${meta.model || "Ollama"}`;
    if (meta?.provider === "workers-ai") return `${names[tier] || "Lite"} · Workers AI`;
    if (meta?.provider === "groq") return `${names[tier] || "Lite"} · Groq`;
    if (meta?.provider === "openrouter") return `${names[tier] || "Lite"} · OpenRouter`;
    if (meta?.provider === "local") return `${names[tier] || "Lite"} · KB local`;
    if (meta?.provider === "fallback") return "Respuesta local";
    if (tier === "local") return "Local · Ollama";
    return `${names[tier] || "Lite"} · listo`;
  }
  function setStatus(text) {
    statusEl.textContent = text;
  }
  function resizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }
  function newChat() {
    controller?.abort();
    state.active = "";
    save();
    syncSelectors();
    renderList();
    renderThread();
    input.focus();
  }
  function ensureChat() {
    let chat = current();
    if (chat) return chat;
    chat = { id: uid(), title: "Nueva conversación", mode: modeSelect.value, tier: tierSelect.value, messages: [] };
    state.items.unshift(chat);
    state.items = state.items.slice(0, 30);
    state.active = chat.id;
    save();
    return chat;
  }
  function openChat(id) {
    state.active = id;
    const chat = current();
    if (chat) {
      modeSelect.value = chat.mode || "team";
      tierSelect.value = chat.tier || "lite";
      localBox.hidden = tierSelect.value !== "local";
    }
    save();
    renderList();
    renderThread();
    if (window.matchMedia("(max-width: 959px)").matches) setSide(false);
  }
  function renameChat(id, row) {
    const chat = state.items.find((item) => item.id === id);
    if (!chat) return;
    const field = document.createElement("input");
    field.className = "ai-rename";
    field.value = chat.title;
    field.setAttribute("aria-label", "Nuevo nombre");
    field.maxLength = 80;
    row.replaceChildren(field);
    field.focus();
    field.select();
    const commit = (saveName) => {
      if (saveName) {
        const title = field.value.trim();
        if (title) chat.title = title;
        save();
      }
      renderList();
    };
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commit(true);
      if (event.key === "Escape") commit(false);
    });
    field.addEventListener("blur", () => commit(true));
  }
  function deleteChat(id, row) {
    const armed = row.getAttribute("data-armed") === "1";
    if (!armed) {
      row.setAttribute("data-armed", "1");
      const button = row.querySelector("[data-delete]");
      if (button) button.textContent = "¿Borrar?";
      return;
    }
    state.items = state.items.filter((item) => item.id !== id);
    if (state.active === id) state.active = "";
    save();
    renderList();
    renderThread();
  }
  function renderList() {
    listEl.replaceChildren();
    state.items.forEach((chat) => {
      const row = document.createElement("div");
      row.className = "ai-row";
      row.setAttribute("data-chat", chat.id);
      const open = document.createElement("button");
      open.type = "button";
      open.className = "ai-row__open";
      open.textContent = chat.title;
      if (chat.id === state.active) open.setAttribute("aria-current", "true");
      const rename = document.createElement("button");
      rename.type = "button";
      rename.dataset.rename = "1";
      rename.className = "ai-row__icon";
      rename.textContent = "Renombrar";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.delete = "1";
      remove.className = "ai-row__icon";
      remove.textContent = "Borrar";
      row.append(open, rename, remove);
      listEl.append(row);
    });
  }
  function renderThread() {
    const chat = current();
    log.replaceChildren();
    const has = Boolean(chat && chat.messages.length);
    empty.hidden = has;
    log.hidden = !has;
    if (!chat) return;
    chat.messages.forEach((message) => log.append(messageNode(message)));
    stick();
  }
  function messageNode(message) {
    const article = document.createElement("article");
    article.className = `ai-msg ai-msg--${message.role === "user" ? "user" : "bot"}`;
    article.dataset.id = message.id;
    if (message.role === "user") {
      const body = document.createElement("p");
      body.textContent = message.content;
      article.append(body);
      return article;
    }
    const bar = document.createElement("div");
    bar.className = "ai-msg__bar";
    const who = document.createElement("span");
    who.textContent = message.source || "Muntrume AI";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ai-copy";
    copy.textContent = "Copiar";
    bar.append(who, copy);
    const think = document.createElement("details");
    think.className = "ai-think";
    think.hidden = true;
    const summary = document.createElement("summary");
    summary.textContent = "Proceso de razonamiento";
    const thinkBody = document.createElement("div");
    thinkBody.className = "ai-think-body";
    think.append(summary, thinkBody);
    const host = document.createElement("div");
    host.className = "ai-mdhost";
    article.append(bar, think, host);
    paint(article, message.content, false);
    return article;
  }
  function answerOf(raw) {
    return splitThink(raw).answer;
  }
  function splitThink(raw) {
    const start = raw.indexOf("<think>");
    if (start === -1) return { reasoning: "", answer: raw };
    const from = start + 7;
    const end = raw.indexOf("</think>", from);
    if (end === -1) return { reasoning: raw.slice(from).trim(), answer: raw.slice(0, start).trim() };
    return {
      reasoning: raw.slice(from, end).trim(),
      answer: `${raw.slice(0, start)}${raw.slice(end + 8)}`.trim(),
    };
  }
  function paint(article, raw, streamingNow) {
    const parts = splitThink(raw);
    const think = article.querySelector(".ai-think");
    const body = article.querySelector(".ai-think-body");
    const host = article.querySelector(".ai-mdhost");
    if (parts.reasoning) {
      if (think.hidden) think.open = true;
      think.hidden = false;
      body.textContent = parts.reasoning;
    } else {
      think.hidden = true;
    }
    const text = parts.answer || (streamingNow ? "" : "");
    if (!text) {
      host.innerHTML = streamingNow ? '<span class="ai-caret" aria-hidden="true"></span>' : "";
      return;
    }
    const draw = (lib) => {
      host.replaceChildren(lib.renderMarkdown(text, { copy: "Copiar", copied: "Copiado", table: "Tabla" }));
      if (streamingNow) {
        const caret = document.createElement("span");
        caret.className = "ai-caret";
        caret.setAttribute("aria-hidden", "true");
        host.append(caret);
      }
    };
    if (window.MuntrumeMarkdown?.renderMarkdown) draw(window.MuntrumeMarkdown);
    else {
      host.textContent = text;
      loadMd().then((lib) => { if (lib && article.isConnected) draw(lib); });
    }
  }
  function loadMd() {
    if (window.MuntrumeMarkdown?.renderMarkdown) return Promise.resolve(window.MuntrumeMarkdown);
    if (mdPromise) return mdPromise;
    mdPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = MD;
      script.onload = () => resolve(window.MuntrumeMarkdown || null);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
    return mdPromise;
  }
  function stick() {
    const stage = $("aiStage");
    stage.scrollTop = stage.scrollHeight;
  }
  function schedulePaint(article, raw) {
    const job = ++renderJob;
    requestAnimationFrame(() => {
      if (job !== renderJob) return;
      paint(article, raw, true);
      stick();
    });
  }
  function finishPaint(article, raw) {
    renderJob += 1;
    if (article) paint(article, raw, false);
    stick();
  }
  async function copyText(text, button, restore) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copiado";
    } catch {
      button.textContent = "No disponible";
    }
    setTimeout(() => { button.textContent = restore; }, 1200);
  }
  function setBusy(busy) {
    streaming = busy;
    input.disabled = busy;
    sendBtn.setAttribute("aria-label", busy ? "Detener" : "Enviar");
    sendBtn.classList.toggle("is-stop", busy);
    log.setAttribute("aria-busy", busy ? "true" : "false");
  }
  function ask(raw) {
    const text = raw.trim();
    if (!text || streaming) return;
    const notice = $("aiNotice");
    if (text.length > 4000) {
      if (notice) {
        notice.hidden = false;
        notice.textContent = "El mensaje supera los 4000 caracteres. Acórtalo antes de enviarlo.";
      }
      return;
    }
    if (notice) {
      notice.hidden = true;
      notice.textContent = "";
    }
    const chat = ensureChat();
    chat.mode = modeSelect.value;
    chat.tier = tierSelect.value;
    if (chat.messages.length === 0) chat.title = text.slice(0, 48);
    chat.messages.push({ id: uid(), role: "user", content: text });
    const reply = { id: uid(), role: "assistant", content: "", source: "Muntrume AI" };
    chat.messages.push(reply);
    chat.messages = chat.messages.slice(-40);
    input.value = "";
    resizeInput();
    save();
    renderList();
    renderThread();
    const article = log.querySelector(`[data-id="${reply.id}"]`);
    run(chat, reply, article);
  }
  async function run(chat, reply, article) {
    setBusy(true);
    controller = new AbortController();
    const turns = chat.messages
      .filter((item) => item !== reply && item.content && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({ role: item.role, content: item.content }));
    try {
      if (chat.tier === "local") await streamOllama(chat, turns, reply, article, controller.signal);
      else await streamApi(chat, turns, reply, article, controller.signal);
    } catch {
      if (!controller?.signal.aborted) {
        reply.content = answerLocally(turns, chat.mode, chat.tier);
        reply.source = "Respuesta local";
        setStatus("Respuesta local");
        if (article) {
          const label = article.querySelector(".ai-msg__bar span");
          if (label) label.textContent = reply.source;
          finishPaint(article, reply.content);
        }
      } else if (article) {
        finishPaint(article, reply.content);
      }
    }
    setBusy(false);
    save();
    if (live) live.textContent = "Respuesta lista";
    stick();
  }
  async function streamApi(chat, turns, reply, article, signal) {
    let response;
    try {
      response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: chat.mode, tier: chat.tier === "local" ? "lite" : chat.tier, messages: turns }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) return;
      throw error;
    }
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.includes("text/event-stream") || !response.body) throw new Error("fallback");
    await readSse(response, (event) => {
      if (event.token) {
        reply.content += event.token;
        reply.source = "Muntrume AI";
        schedulePaint(article, reply.content);
      }
      if (event.meta) {
        reply.source = event.meta.provider === "local" ? "KB local" : sourceName(event.meta.provider);
        const label = article.querySelector(".ai-msg__bar span");
        if (label) label.textContent = reply.source;
        setStatus(labelFor(chat.tier, event.meta));
      }
    }, signal);
    if (!reply.content) {
      if (signal.aborted) return;
      throw new Error("empty");
    }
    finishPaint(article, reply.content);
  }
  async function streamOllama(chat, turns, reply, article, signal) {
    const model = ollamaSelect.value;
    if (!model) {
      showOllamaHint();
      throw new Error("no-model");
    }
    let response;
    try {
      response = await fetch(`${OLLAMA}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: "system", content: systemPrompt(chat.mode, "local") }, ...turns],
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) return;
      showOllamaHint();
      throw error;
    }
    if (!response.ok || !response.body) {
      showOllamaHint();
      throw new Error("ollama");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let thinking = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let json;
        try { json = JSON.parse(line); } catch { continue; }
        if (json.message?.thinking) {
          if (!thinking) {
            reply.content += "<think>\n";
            thinking = true;
          }
          reply.content += json.message.thinking;
        }
        if (json.message?.content) {
          if (thinking) {
            reply.content += "\n</think>\n\n";
            thinking = false;
          }
          reply.content += json.message.content;
        }
        reply.source = "Ollama";
        schedulePaint(article, reply.content);
      }
    }
    if (thinking) reply.content += "\n</think>\n";
    if (!reply.content) throw new Error("empty");
    const label = article.querySelector(".ai-msg__bar span");
    if (label) label.textContent = "Ollama";
    setStatus(labelFor("local", { provider: "ollama", model }));
    finishPaint(article, reply.content);
  }
  function showOllamaHint() {
    hint.hidden = false;
    hint.textContent = `El navegador no pudo leer Ollama en ${OLLAMA}. Si es un bloqueo CORS, arranca Ollama con OLLAMA_ORIGINS=${location.origin} y reinicia ollama serve. Respondo con el motor local y no sale ningún dato del navegador.`;
  }
  async function loadOllamaTags() {
    ollamaSelect.replaceChildren(new Option("Buscando modelos…", ""));
    try {
      const response = await fetch(`${OLLAMA}/api/tags`);
      if (!response.ok) throw new Error("tags");
      const data = await response.json();
      const models = Array.isArray(data.models) ? data.models : [];
      ollamaSelect.replaceChildren();
      if (!models.length) {
        ollamaSelect.add(new Option("Ollama no tiene modelos", ""));
        showOllamaHint();
        return;
      }
      models.forEach((model) => {
        const name = model.name || model.model;
        if (name) ollamaSelect.add(new Option(name, name));
      });
      hint.hidden = true;
    } catch {
      ollamaSelect.replaceChildren(new Option("Sin conexión con Ollama", ""));
      showOllamaHint();
    }
  }
  async function readSse(response, onEvent, signal) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      if (signal.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split = buffer.indexOf("\n\n");
      while (split !== -1) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const line = block.split("\n").find((item) => item.startsWith("data:"));
        if (line) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try { onEvent(JSON.parse(data)); } catch { /* ignore */ }
        }
        split = buffer.indexOf("\n\n");
      }
    }
  }
  function sourceName(provider) {
    if (provider === "workers-ai") return "Workers AI";
    if (provider === "groq") return "Groq";
    if (provider === "openrouter") return "OpenRouter";
    return "Muntrume AI";
  }
}
