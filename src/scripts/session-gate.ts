const API = "https://muntrume.atrumin16.workers.dev";
const PAGE_SIZE = 6;

interface VaultUser {
  email?: string;
  role?: string;
  name?: string;
  has_setup_access?: boolean | number;
}

function hasSetupAccess(session: { user?: VaultUser | null } | null): boolean {
  if (!session?.user) return false;
  const email = String(session.user.email || "").trim().toLowerCase();
  if (email === "atrumin16@gmail.com" || email === "alberto@muntru.me") return true;
  const role = String(session.user.role || "").toLowerCase();
  if (
    role === "admin" ||
    role === "team_driver" ||
    role === "driver" ||
    role === "pilot" ||
    role === "academy" ||
    role === "engineer"
  ) {
    return true;
  }
  return session.user.has_setup_access === true || Number(session.user.has_setup_access) === 1;
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

function ensureLockedBadge(btn: HTMLButtonElement): HTMLAnchorElement {
  const existing = btn.parentElement?.querySelector<HTMLAnchorElement>("[data-locked-badge]");
  if (existing) return existing;
  const badge = document.createElement("a");
  badge.href = "/paddock/";
  badge.className = "g2-dl g2-dl-locked";
  badge.dataset.lockedBadge = "1";
  badge.textContent = "Acceso Privado · Solo Pilotos MMT";
  badge.style.textDecoration = "none";
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  btn.insertAdjacentElement("afterend", badge);
  return badge;
}

async function paintButtons(root: ParentNode): Promise<void> {
  const session = await getSession();
  const allowed = hasSetupAccess(session);
  root.querySelectorAll<HTMLButtonElement>("[data-download]").forEach((btn) => {
    if (allowed) {
      btn.hidden = false;
      const badge = btn.parentElement?.querySelector<HTMLAnchorElement>("[data-locked-badge]");
      if (badge) badge.hidden = true;
      setAuthState(btn, "in", btn.id === "gpvDownloadBtn" ? "Descargar .sto" : "Descargar");
    } else {
      btn.hidden = true;
      const badge = ensureLockedBadge(btn);
      badge.hidden = false;
    }
  });
}

async function downloadFile(id: string, file: string, car = ""): Promise<"ok" | "retry" | "forbidden" | "expired"> {
  const session = await getSession();
  if (!session?.token) {
    return "expired";
  }
  if (!hasSetupAccess(session)) {
    return "forbidden";
  }

  let contentBase64: string | null = null;
  let targetFilename = file || "setup.sto";

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
    if (res.status === 401) {
      return "expired";
    }
    if (res.status === 403) {
      const errData = (await res.json().catch(() => ({}))) as { code?: string };
      if (errData.code === "session_expired") return "expired";
      return "forbidden";
    }
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; content_base64?: string; filename?: string };
      if (data.success && data.content_base64) {
        contentBase64 = data.content_base64;
        if (data.filename) targetFilename = data.filename;
      }
    }
  } catch {}

  if (!contentBase64) {
    return "retry";
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeAndSanitizeStoBytes(contentBase64, car, targetFilename);
  } catch {
    return "retry";
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
          carId: preview.dataset.carId || "",
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
      } else if (result === "expired") {
        setAuthState(btn, "in", "Iniciar sesión");
        const opener = (window as unknown as { openAuthModal?: (tab?: string) => void }).openAuthModal;
        if (typeof opener === "function") {
          opener("login");
          const errEl = document.getElementById("loginError");
          if (errEl) {
            errEl.textContent = "Tu sesión ha caducado o se actualizó tu cuenta. Inicia sesión de nuevo para descargar.";
            errEl.classList.remove("hidden");
            errEl.removeAttribute("hidden");
          }
        }
      } else if (result === "forbidden") {
        btn.hidden = true;
        const badge = ensureLockedBadge(btn);
        badge.hidden = false;
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
  carId?: string;
  track: string;
  season: string;
  week: string;
  type: string;
  size: string;
}

interface StoSection {
  title: string;
  bucket: "tires" | "chassis" | "dampers" | "aero";
  rows: Array<{ k: string; v: string }>;
}

interface ParsedSto {
  notes: string;
  sections: StoSection[];
}

function escHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function classifyStoSection(title: string): "tires" | "chassis" | "dampers" | "aero" {
  const t = title.toLowerCase();
  if (/tire|tyre|left front|right front|left rear|right rear|\blf\b|\brf\b|\blr\b|\brr\b/.test(t)) return "tires";
  if (/damper|shock|rebound|comp|bump/.test(t)) return "dampers";
  if (/aero|wing|brake|diff|gear|drive|fuel|engine|hybrid|electronic|in-car|in car|tc\b|abs\b/.test(t)) return "aero";
  return "chassis";
}

function extractStoNotes(raw: Uint8Array): string {
  if (raw.length < 24) return "";
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const l1 = view.getUint32(4, true);
  const l3 = view.getUint32(12, true);
  if (l1 < l3 || 16 + l1 > raw.length || l3 < 2) return "";
  const notesStart = 16 + l1 - 8 - l3;
  const notesEnd = 16 + l1 - 8;
  if (notesStart < 16 || notesStart >= notesEnd || notesEnd > raw.length) return "";
  try {
    return new TextDecoder("utf-16le").decode(raw.subarray(notesStart, notesEnd)).replace(/\0+$/g, "").trim();
  } catch {
    return "";
  }
}

async function inflateZlibSlice(slice: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === "undefined") return "";
  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    void writer.write(slice as unknown as BufferSource).catch(() => {});
    void writer.close().catch(() => {});
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total > 512_000) break;
      }
    }
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    return new TextDecoder("utf-8", { fatal: false }).decode(merged);
  } catch {
    return "";
  }
}

function parseIrGarageHtml(html: string): StoSection[] {
  const sections: StoSection[] = [];
  if (!html || html.length < 20) return sections;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const bodyText = doc.body?.innerHTML || html;
    const h2Split = bodyText.split(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    if (h2Split.length >= 3) {
      for (let i = 1; i < h2Split.length; i += 2) {
        const title = h2Split[i].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        const chunk = h2Split[i + 1] || "";
        const plain = chunk
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/(p|div|tr|li)>/gi, "\n")
          .replace(/<\/td>\s*<td[^>]*>/gi, ": ")
          .replace(/<[^>]+>/g, " ");
        const rows: Array<{ k: string; v: string }> = [];
        for (const rawLine of plain.split("\n")) {
          const line = rawLine.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
          if (!line || line.length < 3) continue;
          const colon = line.indexOf(":");
          if (colon > 0 && colon < line.length - 1) {
            const k = line.slice(0, colon).trim();
            const v = line.slice(colon + 1).trim();
            if (k && v) rows.push({ k, v });
          }
        }
        if (title && rows.length) {
          sections.push({ title, bucket: classifyStoSection(title), rows });
        }
      }
    }
  } catch {}
  return sections;
}

async function parseStoBase64(b64: string): Promise<ParsedSto> {
  const bin = atob(b64);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

  const notes = extractStoNotes(raw);
  let sections: StoSection[] = [];

  // Scan for embedded zlib stream containing the iRacing Garage HTML sheet
  for (let i = 16; i < raw.length - 8; i++) {
    if (raw[i] === 0x78 && (raw[i + 1] === 0x9c || raw[i + 1] === 0xda || raw[i + 1] === 0x01 || raw[i + 1] === 0x5e)) {
      if (((raw[i] << 8) | raw[i + 1]) % 31 !== 0) continue;
      const inflated = await inflateZlibSlice(raw.subarray(i));
      if (inflated && (inflated.includes("<h2") || inflated.includes("<H2") || inflated.includes("TIRES") || inflated.includes("CHASSIS"))) {
        sections = parseIrGarageHtml(inflated);
        if (sections.length > 0) break;
      }
    }
  }
  return { notes, sections };
}

let activeParsedSto: ParsedSto | null = null;
let activePreviewTab = "all";

function renderGaragePreviewBody(): void {
  const body = document.getElementById("gpvIrBody");
  if (!body || !activeParsedSto) return;
  const q = ((document.getElementById("gpvIrSearch") as HTMLInputElement | null)?.value || "").trim().toLowerCase();
  const { notes, sections } = activeParsedSto;

  if (activePreviewTab === "notes") {
    body.innerHTML = notes
      ? `<div class="gpv-ir-notes"><div class="gpv-ir-notes__head"><span>Notas del ingeniero (.sto)</span></div><pre>${escHtml(notes)}</pre></div>`
      : `<div class="gpv-ir-empty">Este archivo .sto no contiene notas de texto incrustadas.</div>`;
    return;
  }

  const parts: string[] = [];
  if (notes && activePreviewTab === "all" && !q) {
    parts.push(`<div class="gpv-ir-notes"><div class="gpv-ir-notes__head"><span>Notas del setup (.sto)</span></div><pre>${escHtml(notes)}</pre></div>`);
  }

  const filteredSections = sections
    .filter((sec) => activePreviewTab === "all" || sec.bucket === activePreviewTab)
    .map((sec) => {
      if (!q) return sec;
      const matchTitle = sec.title.toLowerCase().includes(q);
      const rows = matchTitle ? sec.rows : sec.rows.filter((r) => r.k.toLowerCase().includes(q) || r.v.toLowerCase().includes(q));
      return { ...sec, rows };
    })
    .filter((sec) => sec.rows.length > 0);

  if (filteredSections.length > 0) {
    parts.push(
      `<div class="gpv-ir-grid">${filteredSections
        .map(
          (sec) =>
            `<section class="gpv-ir-card"><div class="gpv-ir-card__hdr">${escHtml(sec.title)}</div>${sec.rows
              .map((r) => `<div class="gpv-ir-kv"><span>${escHtml(r.k)}</span><strong>${escHtml(r.v)}</strong></div>`)
              .join("")}</section>`
        )
        .join("")}</div>`
    );
  } else if (parts.length === 0) {
    parts.push(
      `<div class="gpv-ir-empty">${q ? "Sin parámetros que coincidan con el filtro." : "No se encontró hoja de garage en esta pestaña. Prueba «Todo el Setup» o «Notas»."}</div>`
    );
  }

  body.innerHTML = parts.join("");
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

  activeParsedSto = null;
  activePreviewTab = "all";
  const searchEl = document.getElementById("gpvIrSearch") as HTMLInputElement | null;
  if (searchEl) searchEl.value = "";
  document.querySelectorAll<HTMLButtonElement>("[data-gpv-tab]").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.gpvTab === "all");
  });

  const tabsWrap = document.getElementById("gpvIrTabs");
  if (tabsWrap && !tabsWrap.dataset.wired) {
    tabsWrap.dataset.wired = "1";
    tabsWrap.addEventListener("click", (ev) => {
      const b = (ev.target as Element)?.closest<HTMLButtonElement>("[data-gpv-tab]");
      if (!b) return;
      activePreviewTab = b.dataset.gpvTab || "all";
      tabsWrap.querySelectorAll<HTMLButtonElement>("[data-gpv-tab]").forEach((x) => x.classList.toggle("is-active", x === b));
      renderGaragePreviewBody();
    });
  }
  if (searchEl && !searchEl.dataset.wired) {
    searchEl.dataset.wired = "1";
    searchEl.addEventListener("input", () => renderGaragePreviewBody());
  }

  const bodyEl = document.getElementById("gpvIrBody");
  if (bodyEl) bodyEl.innerHTML = `<div class="gpv-ir-loading">Leyendo parámetros y notas reales del archivo .sto…</div>`;

  const dlBtn = document.getElementById("gpvDownloadBtn") as HTMLButtonElement | null;
  if (dlBtn) {
    dlBtn.dataset.id = info.id;
    dlBtn.dataset.file = info.file;
    dlBtn.dataset.car = info.carId || info.car;
    dlBtn.dataset.busy = "0";
  }

  void getSession().then(async (session) => {
    const allowed = hasSetupAccess(session);
    if (dlBtn) {
      if (allowed) {
        dlBtn.hidden = false;
        const badge = dlBtn.parentElement?.querySelector<HTMLAnchorElement>("[data-locked-badge]");
        if (badge) badge.hidden = true;
        setAuthState(dlBtn, "in", "Descargar .sto");
      } else {
        dlBtn.hidden = true;
        const badge = ensureLockedBadge(dlBtn);
        badge.hidden = false;
      }
    }
    if (!allowed || !session?.token) {
      if (bodyEl) {
        bodyEl.innerHTML = `<div class="gpv-ir-empty">Inicia sesión con tu cuenta autorizada de piloto Muntrume Motorsport para inspeccionar todos los parámetros del Garage iRacing y las notas de este .sto.</div>`;
      }
      return;
    }
    try {
      const res = await fetch(`${API}/api/setups/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          id: Number(info.id) || undefined,
          file: info.file,
          filename: info.file,
          car: info.carId || info.car || undefined,
          preview: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; content_base64?: string; error?: string };
      if (!res.ok || !data.success || !data.content_base64) {
        if (bodyEl) bodyEl.innerHTML = `<div class="gpv-ir-empty">${escHtml(data.error || "No se pudo leer el contenido binario .sto desde el vault.")}</div>`;
        return;
      }
      activeParsedSto = await parseStoBase64(data.content_base64);
      renderGaragePreviewBody();
    } catch {
      if (bodyEl) bodyEl.innerHTML = `<div class="gpv-ir-empty">Error de red al inspeccionar el archivo .sto.</div>`;
    }
  });

  modal.classList.remove("hidden");
  modal.removeAttribute("hidden");
}
