const WS_URL = "wss://muntrume.atrumin16.workers.dev/api/paddock/ws";

interface PaddockMessage {
  t?: string;
  slug?: string;
  online?: boolean;
  text?: string;
  file?: string;
  car?: string;
  track?: string;
  server?: string;
  telemetry?: string;
}

let socket: WebSocket | null = null;
let delay = 1000;
let gaveUp = false;

function text(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setLive(mode: "live" | "retry" | "off", label: string): void {
  const el = document.getElementById("paddockLive");
  if (!el) return;
  el.dataset.state = mode;
  el.textContent = label;
}

function addLine(listId: string, value: string): void {
  const list = document.getElementById(listId);
  if (!list || !value.trim()) return;
  const empty = list.querySelector("[data-empty]");
  if (empty) empty.remove();
  const li = document.createElement("li");
  li.textContent = value.trim();
  list.prepend(li);
}

function applyMessage(raw: string): void {
  let msg: PaddockMessage;
  try {
    msg = JSON.parse(raw) as PaddockMessage;
  } catch {
    return;
  }
  if (!msg || typeof msg.t !== "string") return;
  if (msg.t === "presence" && typeof msg.slug === "string") {
    const node = document.querySelector<HTMLElement>(`[data-presence="${CSS.escape(msg.slug)}"]`);
    if (node) node.dataset.online = msg.online === false ? "0" : "1";
    return;
  }
  if (msg.t === "setup") {
    const parts = [msg.car, msg.track, msg.file, msg.text].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
    addLine("paddockSetups", parts.join(" · "));
    return;
  }
  if (msg.t === "note" && typeof msg.text === "string") {
    addLine("paddockNotes", msg.text);
    return;
  }
  if (msg.t === "status") {
    if (typeof msg.server === "string") text("paddockServer", msg.server);
    if (typeof msg.telemetry === "string") text("paddockTelemetry", msg.telemetry);
  }
}

function schedule(): void {
  window.setTimeout(connect, delay);
  delay = Math.min(15000, delay * 2);
}

function connect(): void {
  if (gaveUp) return;
  setLive("retry", "reconectando");
  try {
    socket = new WebSocket(WS_URL);
  } catch {
    setLive("off", "sin conexión en vivo");
    schedule();
    return;
  }
  socket.addEventListener("open", () => {
    delay = 1000;
    setLive("live", "en vivo");
  });
  socket.addEventListener("message", (ev) => {
    if (typeof ev.data === "string") applyMessage(ev.data);
  });
  socket.addEventListener("error", () => {
    setLive("off", "sin conexión en vivo");
  });
  socket.addEventListener("close", () => {
    setLive("off", "sin conexión en vivo");
    schedule();
  });
}

async function hasSession(): Promise<boolean> {
  try {
    const token = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
    const raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user") || "";
    if (token && token !== "guest_token" && token !== "local_session" && raw) {
      const user = JSON.parse(raw) as { email?: string; role?: string };
      if (user?.email && user.role !== "guest") return true;
    }
  } catch {
    /* sigue el intento remoto */
  }
  try {
    const res = await fetch("https://muntrume.atrumin16.workers.dev/api/session", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function initPaddock(): Promise<void> {
  const gate = document.getElementById("paddockGate");
  const room = document.getElementById("paddockRoom");
  const form = document.getElementById("paddockNoteForm");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("paddockNoteInput");
    if (!(input instanceof HTMLTextAreaElement)) return;
    const note = input.value.trim().slice(0, 280);
    if (!note) return;
    const payload = JSON.stringify({ t: "note", text: note });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
      input.value = "";
      const status = document.getElementById("paddockNoteStatus");
      if (status) status.textContent = "";
      return;
    }
    setLive("off", "sin conexión en vivo");
    const status = document.getElementById("paddockNoteStatus");
    if (status) status.textContent = "Sin conexión en vivo: la nota no se ha enviado.";
  });
  const signedIn = await hasSession();
  if (!signedIn) {
    gate?.removeAttribute("hidden");
    room?.setAttribute("hidden", "");
    setLive("off", "sin conexión en vivo");
    return;
  }
  gate?.setAttribute("hidden", "");
  room?.removeAttribute("hidden");
  connect();
}
