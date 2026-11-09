const API = "https://muntrume.atrumin16.workers.dev";
const PAGE_SIZE = 6;

interface VaultUser {
  email?: string;
  role?: string;
  name?: string;
}

interface Session {
  token: string;
  user: VaultUser | null;
}

interface PreviewHost {
  openSetupPreview?: (
    setupId: number,
    filename: string,
    car: string,
    circuit: string,
    season: string,
    week: string,
    setupType: string,
    folderKey: string
  ) => void;
}

let sessionCache: Promise<Session | null> | null = null;

function readStored(): Session | null {
  try {
    const token = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
    const raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user") || "";
    if (!token || token === "guest_token" || token === "local_session" || !raw) return null;
    const user = JSON.parse(raw) as VaultUser;
    if (!user || !user.email || user.role === "guest") return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function clearSessionCache(): void {
  sessionCache = null;
}

export async function getSession(): Promise<Session | null> {
  if (!sessionCache) sessionCache = loadSession();
  return sessionCache;
}

async function loadSession(): Promise<Session | null> {
  const stored = readStored();
  if (stored) return stored;
  try {
    const res = await fetch(`${API}/api/session`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; user?: VaultUser; authenticated?: boolean };
    if (data && (data.user || data.authenticated)) {
      return { token: data.token || "", user: data.user || null };
    }
  } catch {
    /* el endpoint de sesión aún no existe: no hay sesión */
  }
  return null;
}

function loginHref(): string {
  const next = `${location.pathname}${location.search}`;
  return `/login/?next=${encodeURIComponent(next)}`;
}

function safeFilename(name: string, fallback: string): string {
  const base = (name || fallback).split(/[/\\]/).pop() || fallback;
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return clean.toLowerCase().endsWith(".sto") ? clean : `${clean}.sto`;
}

function setAuthState(btn: HTMLButtonElement, state: "pending" | "in" | "out", label: string): void {
  btn.dataset.auth = state;
  btn.textContent = label;
}

async function paintButtons(root: ParentNode): Promise<void> {
  const session = await getSession();
  root.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((btn) => {
    if (session) setAuthState(btn, "in", "Descargar");
    else setAuthState(btn, "out", "Inicia sesión");
  });
}

async function downloadFile(id: string, file: string): Promise<"ok" | "expired" | "retry"> {
  const session = await getSession();
  if (!session?.token) return "expired";
  let res: Response;
  try {
    res = await fetch(`${API}/api/setups/download`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ id: Number(id) }),
    });
  } catch {
    return "retry";
  }
  if (res.status === 401 || res.status === 403) {
    clearSessionCache();
    return "expired";
  }
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; content_base64?: string; filename?: string };
  if (!res.ok || !data.content_base64) return "retry";
  let bytes: Uint8Array;
  try {
    const bin = atob(data.content_base64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return "retry";
  }
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = safeFilename(data.filename || "", file);
  document.body.appendChild(link);
  link.click();
  link.remove();
  return "ok";
}

function revealNext(root: ParentNode): void {
  const hidden = root.querySelectorAll<HTMLElement>("[data-page-item][hidden]");
  for (let i = 0; i < PAGE_SIZE && i < hidden.length; i++) {
    const card = hidden[i];
    card.hidden = false;
    const group = card.closest<HTMLDetailsElement>("[data-page-group]");
    if (group) {
      group.hidden = false;
      group.open = true;
    }
  }
  const more = document.getElementById("garageV2More");
  if (more && root.querySelectorAll("[data-page-item][hidden]").length === 0) more.hidden = true;
}

function paginateTelemetryTable(tbody: HTMLTableSectionElement): void {
  const rows = Array.from(tbody.querySelectorAll("tr")).filter((tr) => !tr.querySelector("[colspan]") && !tr.hasAttribute("data-page-more"));
  if (rows.length <= PAGE_SIZE) return;
  rows.forEach((tr, index) => {
    tr.hidden = index >= PAGE_SIZE;
  });
  if (tbody.querySelector("[data-page-more]")) return;
  const more = document.createElement("tr");
  more.setAttribute("data-page-more", "");
  const cell = document.createElement("td");
  cell.colSpan = 6;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "focus-ring";
  btn.textContent = "Cargar más";
  btn.style.minHeight = "44px";
  btn.style.margin = "8px 0";
  btn.addEventListener("click", () => {
    const pending = Array.from(tbody.querySelectorAll("tr")).filter((tr) => tr.hidden && !tr.hasAttribute("data-page-more"));
    pending.slice(0, PAGE_SIZE).forEach((tr) => {
      tr.hidden = false;
    });
    if (!Array.from(tbody.querySelectorAll("tr")).some((tr) => tr.hidden && !tr.hasAttribute("data-page-more"))) more.remove();
  });
  cell.appendChild(btn);
  more.appendChild(cell);
  tbody.appendChild(more);
}

export function initGlow(root: ParentNode = document): void {
  const fine = window.matchMedia("(pointer: fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduce) return;
  root.querySelectorAll<HTMLElement>(".glow-card").forEach((el) => {
    el.addEventListener(
      "pointermove",
      (ev) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${ev.clientX - rect.left}px`);
        el.style.setProperty("--my", `${ev.clientY - rect.top}px`);
      },
      { passive: true }
    );
  });
}

export function initSessionGate(root: ParentNode = document): void {
  void paintButtons(root);
  initGlow(root);

  const more = document.getElementById("garageV2More");
  more?.addEventListener("click", () => {
    const list = document.getElementById("garageV2List");
    if (list) revealNext(list);
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const preview = target.closest<HTMLElement>("[data-preview]");
    if (preview) {
      const host = window as PreviewHost;
      if (typeof host.openSetupPreview === "function") {
        host.openSetupPreview(
          Number(preview.dataset.id),
          preview.dataset.file || "",
          preview.dataset.car || "",
          preview.dataset.track || "",
          preview.dataset.season || "",
          preview.dataset.week || "",
          preview.dataset.type || "",
          ""
        );
      }
      return;
    }
    const btn = target.closest<HTMLButtonElement>("[data-download]");
    if (!btn || btn.dataset.busy === "1") return;
    void (async () => {
      const session = await getSession();
      if (!session) {
        location.href = loginHref();
        return;
      }
      btn.dataset.busy = "1";
      setAuthState(btn, "in", "Preparando");
      const result = await downloadFile(btn.dataset.id || "", btn.dataset.file || "setup.sto");
      btn.dataset.busy = "0";
      if (result === "ok") setAuthState(btn, "in", "Descargado");
      else if (result === "expired") setAuthState(btn, "out", "Sesión caducada");
      else setAuthState(btn, "in", "Reintentar");
    })();
  });

  const tbody = document.getElementById("previewG61LapsTableBody");
  if (tbody instanceof HTMLTableSectionElement) {
    const apply = () => paginateTelemetryTable(tbody);
    apply();
    new MutationObserver(apply).observe(tbody, { childList: true });
  }
}
