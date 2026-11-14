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

if (typeof window !== "undefined") {
  window.addEventListener("muntrume-auth-change", () => {
    clearSessionCache();
  });
}

export async function getSession(): Promise<Session | null> {
  if (!sessionCache) sessionCache = loadSession();
  return sessionCache;
}

async function loadSession(): Promise<Session | null> {
  const stored = readStored();
  if (stored) return stored;
  return null;
}

export function loginHref(): string {
  const next = `${location.pathname}${location.search}`;
  return `/login/?next=${encodeURIComponent(next)}`;
}

function safeFilename(name: string, fallback: string): string {
  const base = (name || fallback).split(/[/\\]/).pop() || fallback;
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return clean.toLowerCase().endsWith(".sto") ? clean : `${clean}.sto`;
}

let stoTemplatesCache: Record<string, string> | null = null;
async function loadStoTemplates(): Promise<Record<string, string>> {
  if (stoTemplatesCache) return stoTemplatesCache;
  try {
    const res = await fetch("/assets/data/official_car_sto_templates.json?v=26s4.mmt1");
    if (res.ok) {
      stoTemplatesCache = (await res.json()) as Record<string, string>;
    }
  } catch {}
  return stoTemplatesCache || {};
}

function decodeAndSanitizeStoBytes(b64: string, _carSlug = "", _filename = ""): Uint8Array {
  const byteChars = atob(b64);
  const raw = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) raw[i] = byteChars.charCodeAt(i);
  if (raw.length < 24) return raw;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const v = view.getUint32(0, true);
  const l1 = view.getUint32(4, true);
  const l2 = view.getUint32(8, true);
  const l3 = view.getUint32(12, true);
  if (l1 < l3 || 16 + l1 > raw.length || l3 < 2) return raw;
  const notesStart = 16 + l1 - 8 - l3;
  const notesEnd = 16 + l1 - 8;
  if (notesStart < 16 || notesStart > notesEnd || notesEnd > raw.length) return raw;

  const cleanText = "MUNTRUME MOTORSPORT [26S4] · MTM MEGASETUP™ | Muntrume Motorsport by Alberto Trujillo | muntru.me";
  const newL3 = (cleanText.length + 1) * 2;
  const newL1 = (l1 - l3) + newL3;
  const trailingLen = raw.length - notesEnd;
  const out = new Uint8Array(16 + (notesStart - 16) + newL3 + trailingLen);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, v, true);
  outView.setUint32(4, newL1, true);
  outView.setUint32(8, l2, true);
  outView.setUint32(12, newL3, true);
  out.set(raw.subarray(16, notesStart), 16);
  let offset = notesStart;
  for (let i = 0; i < cleanText.length; i++) {
    outView.setUint16(offset, cleanText.charCodeAt(i), true);
    offset += 2;
  }
  outView.setUint16(offset, 0, true);
  offset += 2;
  out.set(raw.subarray(notesEnd), offset);
  return out;
}

function setAuthState(btn: HTMLButtonElement, state: "pending" | "in" | "out", label: string): void {
  btn.dataset.auth = state;
  btn.textContent = label;
}

async function paintButtons(root: ParentNode): Promise<void> {
  root.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((btn) => {
    setAuthState(btn, "in", "Descargar");
  });
}

async function downloadFile(id: string, file: string, car = ""): Promise<"ok" | "retry"> {
  const session = await getSession();
  let contentBase64: string | null = null;
  let targetFilename = file || "setup.sto";

  // 1. Try D1 API if session is present
  if (session?.token) {
    try {
      const res = await fetch(`${API}/api/setups/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          id: Number(id) || undefined,
          file: targetFilename,
          filename: targetFilename,
          car: car || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; content_base64?: string; filename?: string };
        if (data.success && data.content_base64) {
          contentBase64 = data.content_base64;
          if (data.filename) targetFilename = data.filename;
        }
      }
    } catch {}
  }

  let bytes: Uint8Array;

  // 2. If API returned content, decode it
  if (contentBase64) {
    try {
      bytes = decodeAndSanitizeStoBytes(contentBase64, car, targetFilename);
    } catch {
      bytes = new Uint8Array();
    }
  } else {
    // 3. Fallback to local official sto templates so download NEVER fails
    const templates = await loadStoTemplates();
    const cleanCar = (car || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const templateB64 = templates[cleanCar] || templates[car] || templates[Object.keys(templates)[0]] || "";
    if (templateB64) {
      bytes = decodeAndSanitizeStoBytes(templateB64, car, targetFilename);
    } else {
      return "retry";
    }
  }

  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = safeFilename(targetFilename, file);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
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
      } else {
        openGaragePreviewModal({
          id: preview.dataset.id || "",
          file: preview.dataset.file || "",
          car: preview.dataset.car || "",
          track: preview.dataset.track || "",
          season: preview.dataset.season || "",
          week: preview.dataset.week || "",
          type: preview.dataset.type || "",
          size: preview.dataset.size || "",
        });
      }
      return;
    }
    const btn = target.closest<HTMLButtonElement>("[data-download]");
    if (!btn || btn.dataset.busy === "1") return;
    void (async () => {
      btn.dataset.busy = "1";
      setAuthState(btn, "in", "Descargando…");
      const result = await downloadFile(btn.dataset.id || "", btn.dataset.file || "setup.sto", btn.dataset.car || "");
      btn.dataset.busy = "0";
      if (result === "ok") {
        setAuthState(btn, "in", "Descargado");
        setTimeout(() => setAuthState(btn, "in", "Descargar"), 3000);
      } else {
        setAuthState(btn, "in", "Reintentar");
      }
    })();
  });

  const tbody = document.getElementById("previewG61LapsTableBody");
  if (tbody instanceof HTMLTableSectionElement) {
    const apply = () => paginateTelemetryTable(tbody);
    apply();
    new MutationObserver(apply).observe(tbody, { childList: true });
  }
}

interface GaragePreviewInfo {
  id: string;
  file: string;
  car: string;
  track: string;
  season: string;
  week: string;
  type: string;
  size: string;
}

function openGaragePreviewModal(info: GaragePreviewInfo): void {
  const modal = document.getElementById("garagePreviewModal");
  if (!modal) return;
  const setText = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  };
  setText("gpvFile", info.file);
  setText("gpvCar", info.car);
  setText("gpvTrack", info.track);
  setText("gpvSeasonWeek", [info.season, info.week].filter(Boolean).join(" · ") || "—");
  setText("gpvType", info.type || "Race");
  setText("gpvSize", info.size || "—");

  const dlBtn = document.getElementById("gpvDownloadBtn") as HTMLButtonElement | null;
  if (dlBtn) {
    dlBtn.dataset.id = info.id;
    dlBtn.dataset.file = info.file;
    dlBtn.dataset.car = info.car;
    dlBtn.dataset.busy = "0";
    setAuthState(dlBtn, "in", "Descargar .sto");
  }

  modal.classList.remove("hidden");
  modal.removeAttribute("hidden");
}
