/**
 * Muntrume Motorsport — Google Admin Console Engine (v5.0 All-in-One)
 * Unified D1 accounts + official pilot profiles + 5 iRacing licenses +
 * Garage 61 Vision AI screenshot importer + live MTI/F1 stats recalculator.
 */

const RC_API_BASE = "https://api.muntru.me";

const LICENSE_META = [
  { key: "sports_car", short: "SC", label: "Sports Car" },
  { key: "formula_car", short: "FC", label: "Formula Car" },
  { key: "oval", short: "OV", label: "Oval" },
  { key: "dirt_road", short: "DR", label: "Dirt Road" },
  { key: "dirt_oval", short: "DO", label: "Dirt Oval" }
];

const ROLE_LABELS = {
  admin: "Team Principal / Admin",
  driver: "Official Driver",
  team_driver: "Team Endurance Driver",
  academy: "Academy Driver",
  engineer: "Race Engineer",
  staff: "Staff / Prensa"
};

const OFFICIAL_MAILBOXES = [
  { address: "alberto@muntru.me", owner: "Alberto Trujillo (#16)", role: "Team Principal & Admin", status: "Activo · TLS 1.3" },
  { address: "mateo@muntru.me", owner: "Mateo Berbis (#1)", role: "Official Driver", status: "Activo · TLS 1.3" },
  { address: "eduardo@muntru.me", owner: "Eduardo Chongkan (#22)", role: "Official Driver", status: "Activo · TLS 1.3" },
  { address: "admin@muntru.me", owner: "Administración & Prensa", role: "Equipo Muntrume", status: "Activo · TLS 1.3" },
  { address: "racecontrol@muntru.me", owner: "Muntrume Race Control", role: "Transaccional (Resend)", status: "SPF + DKIM + DMARC OK" }
];

const EMAIL_TEMPLATES = {
  welcome: {
    badge: "ACCESO APROBADO",
    previewKey: "approved",
    subject: "Acceso aprobado · Crea tu contraseña del Setup Vault",
    title: "¡Bienvenido al equipo!",
    tldr: "Tu cuenta oficial de piloto está aprobada. Crea tu contraseña con el enlace personal de 72 h.",
    ctaLabel: "Crear mi contraseña →",
    ctaUrl: "https://muntru.me/garage?setpw=TOKEN_UNICO_72H",
    rows: [
      ["Usuario", "{CORREO_PILOTO}"],
      ["Catálogo", "42,654 setups .sto (BoP 26S4 · 100% Pass Tech)"],
      ["App Desktop", "MMT Sync (winget install Muntrume.MMTSync)"]
    ],
    body: "Hola {NOMBRE_PILOTO},\n\nControl de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.\n\n• Usuario: {CORREO_PILOTO}\n• Enlace personal (72 h): https://muntru.me/garage?setpw={TOKEN_UNICO}\n\nNos vemos en pista,\nMuntrume Motorsport (muntru.me)"
  },
  reset: {
    badge: "SEGURIDAD · RESET",
    previewKey: "reset",
    subject: "Restablece tu contraseña · Muntrume Setup Vault",
    title: "Restablecer credenciales de acceso",
    tldr: "Enlace personal de un solo uso para definir una nueva contraseña en el Setup Vault.",
    ctaLabel: "Crear nueva contraseña →",
    ctaUrl: "https://muntru.me/garage?setpw=TOKEN_RESET_UNICO",
    rows: [
      ["Cuenta", "{CORREO_PILOTO}"],
      ["Validez", "72 horas (un solo uso)"],
      ["Seguridad", "PBKDF2-SHA256"]
    ],
    body: "Hola {NOMBRE_PILOTO},\n\nEnlace personal para restablecer tu contraseña (72 h):\nhttps://muntru.me/garage?setpw={TOKEN_UNICO}\n\nMuntrume Motorsport (muntru.me)"
  },
  code: {
    badge: "CÓDIGO 6 DÍGITOS",
    previewKey: "code",
    subject: "482910 es tu código de acceso · Muntrume Setup Vault",
    title: "Tu código de acceso",
    tldr: "Introduce el código de 6 dígitos en muntru.me/garage.",
    ctaLabel: "Entrar al Setup Vault →",
    ctaUrl: "https://muntru.me/garage#magic=TOKEN_MAGIC_10M",
    codeBox: "482910",
    rows: [
      ["Caducidad", "10 minutos (un solo uso)"],
      ["Protección", "No compartas este código por chat"]
    ],
    body: "Hola {NOMBRE_PILOTO},\n\nTu código de acceso es: 482910\n\nMuntrume Motorsport · muntru.me"
  },
  temp_password: {
    badge: "CLAVE TEMPORAL",
    previewKey: "temp_password",
    subject: "Acceso aprobado · Tu contraseña temporal del Setup Vault",
    title: "Credenciales temporales de acceso",
    tldr: "Inicia sesión con tu contraseña temporal y elige una clave personal al entrar.",
    ctaLabel: "Entrar al Setup Vault →",
    ctaUrl: "https://muntru.me/garage",
    rows: [
      ["Usuario", "{CORREO_PILOTO}"],
      ["Contraseña temporal", "MTM-2026-X9K4-VAULT"],
      ["Política", "Cambio obligatorio en el primer inicio"]
    ],
    body: "Hola {NOMBRE_PILOTO},\n\n• Usuario: {CORREO_PILOTO}\n• Contraseña temporal: {CLAVE_TEMPORAL}\n• Acceso: https://muntru.me/garage\n\nMuntrume Motorsport · muntru.me"
  },
  nec: {
    badge: "BRIEFING OFICIAL",
    previewKey: "digest",
    subject: "🏁 Briefing Oficial: NEC VLN · Muntrume Motorsport",
    title: "Briefing: Nürburgring Endurance Championship",
    tldr: "Paquetes semanales NEC disponibles en el Setup Vault.",
    ctaLabel: "Abrir Setup Vault →",
    ctaUrl: "https://muntru.me/garage?nec=W01",
    rows: [
      ["Circuito", "Nürburgring Combined Gesamtstrecke VLN"],
      ["Nomenclatura", "MMT_[MODELO]_VLN_[SESIÓN].sto"],
      ["BoP", "Altura estática ≥ 70.5 mm (PASS TECH)"]
    ],
    body: "Equipo,\n\nYa tenéis disponibles en https://muntru.me/garage los setups NEC VLN.\n\nMuntrume Race Control · racecontrol@muntru.me"
  }
};

let rcState = {
  activeTab: "overview",
  directoryFilter: "all",
  auditFilter: "all",
  members: [],
  profiles: [],
  pendingRequests: [],
  auditLogs: [],
  liveTelemetryBySlug: {},
  lastCredentials: null,
  currentTemplateKey: "welcome"
};

let umState = {
  slug: "",
  email: "",
  topCars: [],
  topTracks: [],
  g61ImageDataUrl: "",
  subTab: "identity"
};

let rcActiveMenuBtn = null;

function rcEscape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRoleLabel(role) {
  const key = String(role || "driver").toLowerCase();
  return ROLE_LABELS[key] || role || "Official Driver";
}

function computeF1Stats(irating, sr = 3.0, trackHours = 100, peakIr = null) {
  const safeIr = Math.max(100, Number(irating) || 1500);
  const safeSr = Math.min(4.99, Math.max(1.0, Number(sr) || 3.0));
  const safeHours = Math.max(0, Number(trackHours) || 0);
  const calc = (ir) => {
    const base = ir >= 1500
      ? 54 + 43 * (Math.log(ir / 1500) / Math.log(12000 / 1500))
      : Math.max(20, 54 * (ir / 1500));
    const srAdj = safeSr >= 3.0 ? Math.min(2.0, (safeSr - 3.0) * 1.0) : safeSr < 2.0 ? -2.0 : 0;
    const expAdj = Math.min(1.8, Math.log1p(safeHours) * 0.3);
    return Math.min(98, Math.max(1, Math.round(base + srAdj + expAdj)));
  };
  const overall = calc(safeIr);
  const peakBase = calc(Math.max(safeIr, Number(peakIr) || safeIr));
  const srNorm = (safeSr - 1.0) / 3.99;
  const expBoost = Math.min(20, Math.log1p(safeHours) * 3.1);
  return {
    overall,
    pace: Math.min(98, Math.max(1, Math.round(peakBase + 3))),
    awareness: Math.min(98, Math.max(1, Math.round(overall * 0.74 + srNorm * 24))),
    racecraft: Math.min(98, Math.max(1, Math.round(overall * 0.88 + srNorm * 11))),
    experience: Math.min(98, Math.max(1, Math.round(overall * 0.78 + expBoost)))
  };
}

function parseLicenseStr(str) {
  const m = String(str || "").match(/^(?:Class\s+)?(Pro|[A-D]|Rookie)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return { class_label: "", sr: null };
  const cls = /^pro$/i.test(m[1]) ? "Pro" : /^rookie$/i.test(m[1]) ? "Rookie" : `Class ${m[1].toUpperCase()}`;
  return { class_label: cls, sr: Number(m[2]) };
}

function getAdminToken() {
  try {
    return localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
  } catch {
    return "";
  }
}

async function rcAdminFetch(path, body = {}) {
  const token = getAdminToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${RC_API_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    secureAdminLogout("invalid_token");
    throw new Error(data.error || "Sesión caducada. Vuelve a iniciar sesión.");
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

function verifyAdminSession() {
  const token = getAdminToken();
  if (!token || token === "guest_token") {
    secureAdminLogout("unauthorized");
    return false;
  }
  let user = null;
  try {
    const rawUser = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
    user = rawUser ? JSON.parse(rawUser) : null;
  } catch {}
  const email = (user && user.email ? String(user.email) : (localStorage.getItem("muntrume_user_email") || "")).trim().toLowerCase();
  const isAdmin = Boolean(user && (email === "atrumin16@gmail.com" || user.role === "admin"));
  if (!isAdmin) {
    secureAdminLogout("unauthorized");
    return false;
  }
  const emailEl = document.getElementById("rcSessionEmail");
  if (emailEl && email) emailEl.textContent = email;
  return true;
}

function secureAdminLogout(reason) {
  try {
    ["mrt_vault_token", "mrt_vault_user", "muntrume_user_email", "muntrume_auth_state", "muntrume_is_admin", "muntrume_rc_audit_logs"].forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {}
  const shell = document.getElementById("rcShell") || document.querySelector(".rc-shell");
  if (shell) shell.innerHTML = "";
  const dest = reason === "unauthorized"
    ? "/garage?auth=admin&redirect=" + encodeURIComponent(window.location.pathname)
    : reason === "invalid_token"
    ? "/garage?auth=expired&redirect=" + encodeURIComponent(window.location.pathname)
    : "/garage?logged_out=1";
  try { window.location.replace(dest); } catch { window.location.href = dest; }
}

function showRcNotice(title, msg, tone = "info") {
  const banner = document.getElementById("rcFeedbackBanner");
  const titleEl = document.getElementById("rcFeedbackTitle");
  const msgEl = document.getElementById("rcFeedbackMsg");
  if (!banner || !titleEl || !msgEl) return;
  const toneMap = { err: "error", warn: "warning" };
  banner.className = `m-notice m-notice--${toneMap[tone] || tone}`;
  titleEl.textContent = title;
  msgEl.textContent = msg;
  banner.classList.remove("hidden");
}

function hideRcNotice() {
  document.getElementById("rcFeedbackBanner")?.classList.add("hidden");
}

function appendAuditEvent(category, actor, detail, status = "OK") {
  rcState.auditLogs.unshift({ timestamp: new Date().toISOString(), category, actor, detail, status });
  try { localStorage.setItem("muntrume_rc_audit_logs", JSON.stringify(rcState.auditLogs.slice(0, 60))); } catch {}
  renderAuditLogsTable();
}

function initDefaultAuditLogs() {
  try {
    const saved = JSON.parse(localStorage.getItem("muntrume_rc_audit_logs") || "[]");
    if (Array.isArray(saved) && saved.length > 0) {
      rcState.auditLogs = saved;
      return;
    }
  } catch {}
  const now = Date.now();
  rcState.auditLogs = [
    { timestamp: new Date(now - 5 * 60000).toISOString(), category: "auth", actor: "atrumin16@gmail.com", detail: "Sesión de Team Principal verificada (PBKDF2-SHA256)", status: "OK" },
    { timestamp: new Date(now - 30 * 60000).toISOString(), category: "admin", actor: "racecontrol@muntru.me", detail: "Consola Muntrume Admin sincronizada con Cloudflare D1", status: "ACTIVO" }
  ];
}

function switchAdminTab(tabId) {
  const mapLegacy = { directory: "overview", setups: "overview", iracing: "overview", gallery: "overview" };
  const normalized = mapLegacy[tabId] || tabId;
  const validTabs = ["overview", "access", "security", "season"];
  const chosen = validTabs.includes(normalized) ? normalized : "overview";
  rcState.activeTab = chosen;
  validTabs.forEach((t) => {
    document.getElementById(`tab-${t}`)?.classList.toggle("hidden", t !== chosen);
    document.getElementById(`nav-${t}`)?.classList.toggle("is-active", t === chosen);
  });
  try {
    const url = new URL(window.location.href);
    if (chosen === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", chosen);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

// ============================================================================
// LIVE SYNC WITH CLOUDFLARE D1 & /API/DRIVERS
// ============================================================================
async function refreshRaceControlData() {
  const badge = document.getElementById("rcBackendBadgeText");
  const d1Side = document.getElementById("rcSidebarD1Status");
  if (badge) badge.textContent = "Sincronizando…";
  if (!verifyAdminSession()) return;

  let d1Online = false;
  try {
    const data = await rcAdminFetch("/api/setups/admin/panel", {});
    d1Online = true;
    const byEmail = new Map();
    if (Array.isArray(data.members)) {
      data.members.forEach((dbM) => {
        if (!dbM || !dbM.email) return;
        const key = String(dbM.email).toLowerCase();
        const roleKey = String(dbM.role || "driver").toLowerCase();
        byEmail.set(key, {
          name: dbM.name || key.split("@")[0],
          email: dbM.email,
          role: roleKey,
          roleLabel: getRoleLabel(roleKey),
          team: dbM.team || "",
          car_class: dbM.car_class || "",
          public_visible: Boolean(dbM.public_visible),
          public_name: dbM.public_name || "",
          public_slug: dbM.public_slug || "",
          public_bio: dbM.public_bio || "",
          status: dbM.status || "active",
          has_password: Boolean(dbM.has_password),
          has_setup_access: dbM.has_setup_access != null ? Boolean(dbM.has_setup_access) : ["admin", "team_driver", "driver", "pilot", "academy", "engineer"].includes(roleKey),
          last_login_at: dbM.last_login_at || null,
          created_at: dbM.created_at || new Date().toISOString()
        });
      });
    }
    rcState.members = Array.from(byEmail.values());
    rcState.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    rcState.pendingRequests = Array.isArray(data.requests)
      ? data.requests.filter((r) => r && r.status === "pending")
      : Array.isArray(data.pending_requests)
      ? data.pending_requests
      : [];
  } catch (err) {
    showRcNotice("Error al sincronizar con Cloudflare D1", err?.message || "No se pudo cargar el panel.", "err");
  }

  try {
    const res = await fetch(`${RC_API_BASE}/api/drivers`, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const payload = await res.json();
      const drivers = Array.isArray(payload) ? payload : payload.drivers || [];
      drivers.forEach((d) => { if (d && d.slug) rcState.liveTelemetryBySlug[d.slug] = d; });
    }
  } catch {}

  if (badge) badge.textContent = d1Online ? "D1 Online" : "D1 Error";
  if (d1Side) d1Side.textContent = `${rcState.members.filter((m) => m.status === "active").length} activos · ${rcState.pendingRequests.length} pend.`;

  renderOverviewSection();
  renderPendingRequests();
  renderDirectoryTable();
  renderMailboxesTable();
  renderAuditLogsTable();
}

function renderOverviewSection() {
  const pendingCount = rcState.pendingRequests.length;
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setTxt("kpiDriversCount", String(rcState.members.length));
  setTxt("kpiPendingCount", String(pendingCount));
  setTxt("kpiPendingSub", pendingCount > 0 ? `${rcState.members.length} cuentas · ${pendingCount} pendiente(s)` : `${rcState.members.length} cuentas activas en D1`);
  setTxt("sidebarPendingBadge", pendingCount > 0 ? `${rcState.members.length}+${pendingCount}` : String(rcState.members.length));

  const kpiPendingStatus = document.getElementById("kpiPendingStatusBadge");
  if (kpiPendingStatus) {
    kpiPendingStatus.textContent = pendingCount > 0 ? `${pendingCount} nuevas` : "Al día";
    kpiPendingStatus.className = `rc-badge ${pendingCount > 0 ? "rc-badge--warn" : "rc-badge--ok"}`;
  }

  // Live Team Average iRating & OVR across official active drivers
  const driverProfiles = (rcState.profiles || []).filter((p) => (p.kind || "driver") === "driver");
  const irValues = [];
  const ovrValues = [];
  driverProfiles.forEach((p) => {
    const tInfo = rcState.liveTelemetryBySlug[p.slug] || {};
    const ir = Number(p.irating ?? tInfo.irating) || 0;
    const ovr = p.f1_stats?.overall || (ir > 0 ? computeF1Stats(ir, parseLicenseStr(p.license || tInfo.license).sr || 3.0, p.total_track_hours || 100).overall : 0);
    if (ir > 0) irValues.push(ir);
    if (ovr > 0) ovrValues.push(ovr);
  });

  if (irValues.length > 0) {
    const avgIr = Math.round(irValues.reduce((a, b) => a + b, 0) / irValues.length);
    setTxt("kpiTeamAvgIr", `${avgIr.toLocaleString("en-US")} iR`);
    setTxt("kpiTeamAvgSub", `Media de ${irValues.length} piloto(s) con iRating`);
  } else {
    setTxt("kpiTeamAvgIr", "—");
    setTxt("kpiTeamAvgSub", "Edita el iRating para calcular media");
  }
  if (ovrValues.length > 0) {
    const avgOvr = Math.round(ovrValues.reduce((a, b) => a + b, 0) / ovrValues.length);
    setTxt("kpiTeamAvgOvrBadge", `OVR ${avgOvr}`);
  } else {
    setTxt("kpiTeamAvgOvrBadge", "OVR —");
  }

  // Render Official Roster Table
  const tbody = document.getElementById("overviewRosterBody");
  if (tbody) {
    tbody.innerHTML = (rcState.profiles || []).map((p) => {
      const tInfo = rcState.liveTelemetryBySlug[p.slug] || {};
      const displayName = p.fullName || p.name || p.slug;
      const dorsalText = p.dorsal || displayName.slice(0, 2).toUpperCase();
      const isDriver = (p.kind || "driver") === "driver";
      const roleDisplay = p.role || (isDriver ? "Piloto Oficial" : "Staff Interno");

      const lics = Array.isArray(p.licenses) && p.licenses.length > 0 ? p.licenses : [];
      const licBadges = lics.length > 0
        ? lics.map((l) => {
            const meta = LICENSE_META.find((m) => m.key === l.category) || { short: l.category.slice(0, 2).toUpperCase() };
            const clsShort = String(l.class_label || "").replace(/^Class\s+/i, "");
            return `<span class="rc-badge ${l.category === "sports_car" ? "rc-badge--ok" : ""}" title="${rcEscape(meta.label || l.category)}">${rcEscape(meta.short)} ${rcEscape(clsShort)}${l.sr != null ? ` ${Number(l.sr).toFixed(2)}` : ""}</span>`;
          }).join("")
        : (p.license || tInfo.license ? `<span class="rc-badge rc-badge--ok">SC ${rcEscape(p.license || tInfo.license)}</span>` : `<span class="rc-mono-sub">Sin licencias</span>`);

      const irVal = p.irating ?? tInfo.irating ?? null;
      const ovrVal = p.f1_stats?.overall || (irVal ? computeF1Stats(irVal, parseLicenseStr(p.license || tInfo.license).sr || 3.0, p.total_track_hours || 100).overall : null);
      const irText = irVal ? `${Number(irVal).toLocaleString("en-US")} iR` : "—";
      const carsCount = Array.isArray(p.top_cars) ? p.top_cars.length : 0;
      const tracksCount = Array.isArray(p.top_tracks) ? p.top_tracks.length : 0;
      const g61Label = (carsCount || tracksCount)
        ? `${carsCount} coches · ${tracksCount} circ.${p.total_track_hours ? ` · ${p.total_track_hours}h` : ""}`
        : "Subir foto G61";

      return `
        <tr>
          <td>
            <div class="rc-user-cell">
              <span class="rc-avatar">${rcEscape(dorsalText)}</span>
              <div>
                <div class="rc-strong">${rcEscape(displayName)}</div>
                <div class="rc-mono-sub">${rcEscape(p.email || `/drivers/${p.slug}/`)}</div>
              </div>
            </div>
          </td>
          <td><span class="rc-badge ${isDriver ? "rc-badge--ok" : ""}">${rcEscape(roleDisplay)}</span></td>
          <td><div class="rc-lic-pills">${licBadges}</div></td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;white-space:nowrap">
              <strong style="font-family:var(--r-mono);font-size:12.5px">${rcEscape(irText)}</strong>
              ${ovrVal ? `<span class="rc-badge rc-badge--ok">OVR ${ovrVal}</span>` : ""}
            </div>
          </td>
          <td><span class="rc-mono-sub">${rcEscape(g61Label)}</span></td>
          <td class="text-right">
            <div class="rc-row-actions">
              <button type="button" class="r-btn r-btn--primary r-btn--sm" data-slug="${rcEscape(p.slug)}" onclick="openUnifiedPilotModal({ slug: this.dataset.slug })">Editar todo</button>
              <a href="/drivers/${rcEscape(p.slug)}/" class="r-btn r-btn--sm" title="Abrir ficha pública">Ficha ↗</a>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  const dl = document.getElementById("quickResetDriversDatalist");
  if (dl && rcState.members.length > 0) {
    dl.innerHTML = rcState.members.map((m) => `<option value="${rcEscape(m.email)}">${rcEscape(m.name)} (${rcEscape(getRoleLabel(m.role))})</option>`).join("");
  }
}

function renderPendingRequests() {
  const card = document.getElementById("pendingRequestsCard");
  const badge = document.getElementById("pendingRequestsCountBadge");
  const container = document.getElementById("pendingRequestsList");
  if (!card || !container) return;
  const list = rcState.pendingRequests || [];
  if (badge) badge.textContent = `${list.length} pendiente(s)`;
  if (list.length === 0) {
    card.classList.add("hidden");
    return;
  }
  card.classList.remove("hidden");
  container.innerHTML = list.map((req) => {
    const meta = [req.iracing_id ? `iRacing ID: ${req.iracing_id}` : null, req.car_category ? `Categoría: ${req.car_category}` : null].filter(Boolean).join(" · ");
    return `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-radius:12px;background:var(--r-bg-2);border:1px solid var(--r-line)">
        <div style="flex:1;min-width:220px">
          <div class="rc-strong">${rcEscape(req.name || "Solicitante")} · <code>${rcEscape(req.email)}</code></div>
          ${meta ? `<div class="rc-mono-sub">${rcEscape(meta)}</div>` : ""}
          <p class="rc-muted" style="margin-top:3px;font-size:12.5px">${rcEscape(req.message || "Solicitud de acceso al Setup Vault")}</p>
        </div>
        <div class="rc-btn-row">
          <button type="button" class="r-btn r-btn--primary r-btn--sm" data-request-id="${rcEscape(req.id)}" data-email="${rcEscape(req.email)}" data-name="${rcEscape(req.name || "")}" onclick="approvePendingRequestBtn(this, 'link')">✓ Aprobar</button>
          <button type="button" class="r-btn r-btn--sm" style="border-color:rgba(239,68,68,.4);color:#ef4444" data-request-id="${rcEscape(req.id)}" data-email="${rcEscape(req.email)}" onclick="rejectPendingRequestBtn(this)">✕ Rechazar</button>
        </div>
      </div>
    `;
  }).join("");
}

function filterDirectory(mode) {
  rcState.directoryFilter = mode;
  ["all", "active", "admin", "inactive"].forEach((m) => {
    document.getElementById(`dirFilter-${m}`)?.classList.toggle("is-on", m === mode);
  });
  renderDirectoryTable();
}

function renderDirectoryTable() {
  const tbody = document.getElementById("directoryTableBody");
  if (!tbody) return;
  const q = (document.getElementById("directorySearchInput")?.value || "").trim().toLowerCase();
  const filtered = rcState.members.filter((m) => {
    if (rcState.directoryFilter === "admin" && m.role !== "admin") return false;
    if (rcState.directoryFilter === "active" && m.status !== "active") return false;
    if (rcState.directoryFilter === "inactive" && m.status !== "inactive") return false;
    if (!q) return true;
    return `${m.name} ${m.email} ${getRoleLabel(m.role)} ${m.team || ""} ${m.car_class || ""}`.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--r-muted);padding:24px">Ninguna cuenta coincide con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((m) => {
    const linkedProf = (rcState.profiles || []).find((pr) => pr.email && String(pr.email).toLowerCase() === String(m.email).toLowerCase());
    const numBadge = linkedProf?.dorsal || (m.name || "MMT").slice(0, 2).toUpperCase();
    const isBlocked = m.status === "inactive";
    const statusBadge = isBlocked
      ? `<span class="rc-badge rc-badge--err">Bloqueada</span>`
      : m.has_password
      ? `<span class="rc-badge rc-badge--ok">Activa</span>`
      : `<span class="rc-badge rc-badge--warn">Pendiente clave</span>`;
    const metaSub = linkedProf?.irating
      ? `${Number(linkedProf.irating).toLocaleString("en-US")} iR${linkedProf.license ? ` · ${linkedProf.license}` : ""}`
      : (m.car_class || m.team || "Setup Vault");

    return `
      <tr>
        <td>
          <div class="rc-user-cell">
            <span class="rc-avatar">${rcEscape(numBadge)}</span>
            <div>
              <div class="rc-strong">${rcEscape(m.name)}</div>
              <div class="rc-mono-sub">${linkedProf ? `Ficha: /drivers/${rcEscape(linkedProf.slug)}/` : (m.team ? rcEscape(m.team) : "Cuenta D1")}</div>
            </div>
          </div>
        </td>
        <td><code>${rcEscape(m.email)}</code></td>
        <td><span class="rc-badge ${m.role === "admin" ? "rc-badge--ok" : ""}">${rcEscape(getRoleLabel(m.role))}</span></td>
        <td><div class="rc-mono-sub">${rcEscape(metaSub)}</div></td>
        <td>${statusBadge}</td>
        <td class="text-right">
          <div class="rc-row-actions">
            <button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(m.email)}" data-slug="${rcEscape(linkedProf?.slug || "")}" onclick="openUnifiedPilotModal({ email: this.dataset.email, slug: this.dataset.slug })">Editar</button>
            <button type="button" class="rc-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Acciones para ${rcEscape(m.name)}" data-email="${rcEscape(m.email)}" onclick="openRowActionMenu(this, event)">⋮</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ============================================================================
// UNIFIED ALL-IN-ONE PILOT EDITOR MODAL (IDENTITY + 5 LICENSES + G61 + STATS)
// ============================================================================
function switchUnifiedModalTab(tab) {
  umState.subTab = tab;
  ["identity", "licenses", "g61", "stats"].forEach((t) => {
    document.getElementById(`umPanel-${t}`)?.classList.toggle("hidden", t !== tab);
    document.getElementById(`umTabBtn-${t}`)?.classList.toggle("is-on", t === tab);
  });
}

function openUnifiedPilotModal({ slug = "", email = "", isNew = false } = {}) {
  const cleanSlug = isNew ? "" : String(slug || "").trim().toLowerCase();
  const cleanEmail = isNew ? "" : String(email || "").trim().toLowerCase();

  const prof = cleanSlug
    ? (rcState.profiles || []).find((p) => p.slug === cleanSlug)
    : (cleanEmail ? (rcState.profiles || []).find((p) => p.email && String(p.email).toLowerCase() === cleanEmail) : null);

  const lookupEmail = cleanEmail || (prof?.email ? String(prof.email).toLowerCase() : "");
  const member = lookupEmail
    ? (rcState.members || []).find((m) => String(m.email).toLowerCase() === lookupEmail)
    : null;

  const tInfo = prof ? (rcState.liveTelemetryBySlug[prof.slug] || {}) : {};

  umState = {
    isNew: Boolean(isNew),
    isDynamic: Boolean(prof?.is_dynamic),
    slug: prof?.slug || "",
    email: member?.email || prof?.email || cleanEmail || "",
    topCars: Array.isArray(prof?.top_cars) ? prof.top_cars.map((x) => ({ ...x })) : [],
    topTracks: Array.isArray(prof?.top_tracks) ? prof.top_tracks.map((x) => ({ ...x })) : [],
    g61ImageDataUrl: "",
    subTab: "identity"
  };

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = Boolean(v); };

  const titleEl = document.getElementById("unifiedPilotTitle");
  const subEl = document.getElementById("unifiedPilotSub");
  const displayName = prof?.fullName || member?.name || umState.email || "Nuevo Miembro";
  if (titleEl) titleEl.textContent = isNew ? "Añadir Piloto / Staff a /drivers" : `Editar · ${displayName}`;
  if (subEl) {
    subEl.textContent = isNew
      ? "Crea un perfil público en /drivers para cualquier piloto (iRacing, LMU, AC EVO, ACC, rF2, AMS2, F1) o miembro del Staff."
      : prof
        ? `Ficha oficial /drivers/${prof.slug}/ + cuenta D1. Edita identidad, simuladores, licencias opcionales y stats.`
        : `Cuenta de usuario en Cloudflare D1 (${umState.email}).`;
  }

  // Always show all tabs when creating a new profile or editing an existing profile
  const hasProfile = Boolean(isNew || prof);
  ["licenses", "g61", "stats"].forEach((t) => {
    const b = document.getElementById(`umTabBtn-${t}`);
    if (b) b.style.display = hasProfile ? "" : "none";
  });

  // Delete button only for dynamic profiles created via Race Control
  const delBtn = document.getElementById("umDeleteProfileBtn");
  if (delBtn) delBtn.classList.toggle("hidden", !prof?.is_dynamic);

  // Slug input editable only when creating new profile
  const slugEl = document.getElementById("umSlug");
  if (slugEl) {
    slugEl.value = umState.slug;
    slugEl.readOnly = !isNew;
    slugEl.required = hasProfile;
  }

  // Auto-generate slug from full name when creating new
  const fullNameEl = document.getElementById("umFullName");
  if (fullNameEl && !fullNameEl.dataset.slugBound) {
    fullNameEl.dataset.slugBound = "1";
    fullNameEl.addEventListener("input", () => {
      if (!umState.isNew) return;
      const se = document.getElementById("umSlug");
      if (se && !se.dataset.manual) {
        se.value = fullNameEl.value
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 28);
      }
    });
  }
  if (slugEl) {
    delete slugEl.dataset.manual;
    if (!slugEl.dataset.manualBound) {
      slugEl.dataset.manualBound = "1";
      slugEl.addEventListener("input", () => { if (umState.isNew) slugEl.dataset.manual = "1"; });
    }
  }

  // Identity & Role fields
  setVal("umOrigEmail", umState.email);
  setVal("umFullName", prof?.fullName || member?.name || "");
  setVal("umDorsal", prof?.dorsal || "");
  setVal("umKind", prof?.kind || "driver");
  setVal("umAccountRole", member?.role || (prof?.kind === "staff" ? "staff" : "driver"));
  setVal("umRoleTitle", prof?.role || "");
  setVal("umEmail", member?.email || prof?.email || "");
  setVal("umCustId", prof?.cust_id || tInfo.cust_id || "");
  setVal("umSpecialty", prof?.specialty || "");
  setVal("umClub", prof?.club || "");
  setVal("umCountry", prof?.country || "Spain");
  setVal("umMemberSince", prof?.member_since || "2026");
  setVal("umHelmetStyle", prof?.helmet_style || "mmt_green");
  setVal("umTeam", member?.team || "Muntrume Motorsport");
  setVal("umCarClass", member?.car_class || "");
  setVal("umBio", prof?.bio || member?.public_bio || "");
  setChk("umShowPublic", prof ? prof.show_public !== false : true);
  setChk("umSetupAccess", member ? member.has_setup_access : true);

  // Multi-sim checkboxes
  const activeSims = new Set(Array.isArray(prof?.sims) && prof.sims.length ? prof.sims : (isNew ? ["lmu"] : ["iracing"]));
  document.querySelectorAll('#umSimsGrid input[name="umSim"]').forEach((cb) => {
    cb.checked = activeSims.has(cb.value);
  });

  // 5 iRacing Licenses
  const licMap = {};
  (Array.isArray(prof?.licenses) ? prof.licenses : []).forEach((l) => { if (l && l.category) licMap[l.category] = l; });
  if (!licMap.sports_car && (prof?.irating || prof?.license || tInfo.irating || tInfo.license)) {
    const parsed = parseLicenseStr(prof?.license || tInfo.license);
    licMap.sports_car = {
      category: "sports_car",
      class_label: parsed.class_label || "Class A",
      sr: parsed.sr,
      irating: prof?.irating ?? tInfo.irating ?? null
    };
  }
  LICENSE_META.forEach(({ key }) => {
    const row = licMap[key] || {};
    setVal(`umLicClass-${key}`, row.class_label || "");
    setVal(`umLicSr-${key}`, row.sr != null ? Number(row.sr).toFixed(2) : "");
    setVal(`umLicIr-${key}`, row.irating != null ? String(row.irating) : "");
  });

  // Garage 61 lists & preview reset
  setVal("umFavoriteTrack", prof?.favorite_track || "");
  setVal("umTotalHours", prof?.total_track_hours != null ? String(prof.total_track_hours) : "");
  const prevWrap = document.getElementById("umG61PreviewWrap");
  if (prevWrap) prevWrap.classList.add("hidden");
  const fileIn = document.getElementById("umG61FileInput");
  if (fileIn) fileIn.value = "";
  const analyzeBtn = document.getElementById("umG61AnalyzeBtn");
  if (analyzeBtn) analyzeBtn.disabled = true;

  renderG61Lists();

  // MTI / F1 Stats
  const isAuto = prof?.f1_stats ? prof.f1_stats.auto !== false : true;
  setChk("umStatsAuto", isAuto);
  if (!isAuto && prof?.f1_stats) {
    setVal("umStatOverall", prof.f1_stats.overall);
    setVal("umStatPace", prof.f1_stats.pace);
    setVal("umStatAwareness", prof.f1_stats.awareness);
    setVal("umStatRacecraft", prof.f1_stats.racecraft);
    setVal("umStatExperience", prof.f1_stats.experience);
    syncOvrBigFromInput();
  } else {
    recalcUnifiedPilotStats(true);
  }
  toggleUnifiedStatsAuto();

  switchUnifiedModalTab("identity");
  document.getElementById("unifiedPilotModal")?.classList.remove("hidden");
  document.getElementById("umFullName")?.focus();
}

function closeUnifiedPilotModal() {
  document.getElementById("unifiedPilotModal")?.classList.add("hidden");
}

function readLicensesFromModal() {
  const out = [];
  LICENSE_META.forEach(({ key }) => {
    const cls = document.getElementById(`umLicClass-${key}`)?.value || "";
    const srRaw = document.getElementById(`umLicSr-${key}`)?.value?.trim() || "";
    const irRaw = document.getElementById(`umLicIr-${key}`)?.value?.trim() || "";
    if (!cls && !srRaw && !irRaw) return;
    out.push({
      category: key,
      class_label: cls || "Class D",
      sr: srRaw !== "" ? Number(srRaw) : null,
      irating: irRaw !== "" ? Math.round(Number(irRaw)) : null
    });
  });
  return out;
}

function recalcUnifiedPilotStats(forceAuto = false) {
  const autoChecked = forceAuto || Boolean(document.getElementById("umStatsAuto")?.checked);
  const scIr = Number(document.getElementById("umLicIr-sports_car")?.value) || 0;
  const scSr = Number(document.getElementById("umLicSr-sports_car")?.value) || 3.0;
  const hours = Number(document.getElementById("umTotalHours")?.value) || 100;

  if (autoChecked) {
    const stats = computeF1Stats(scIr || 1500, scSr, hours);
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v); };
    setVal("umStatOverall", stats.overall);
    setVal("umStatPace", stats.pace);
    setVal("umStatAwareness", stats.awareness);
    setVal("umStatRacecraft", stats.racecraft);
    setVal("umStatExperience", stats.experience);
  }
  syncOvrBigFromInput();
}

function syncOvrBigFromInput() {
  const ovr = document.getElementById("umStatOverall")?.value || "—";
  const scIr = Number(document.getElementById("umLicIr-sports_car")?.value) || 0;
  const hours = Number(document.getElementById("umTotalHours")?.value) || 0;
  const big = document.getElementById("umOvrBig");
  if (big) big.textContent = String(ovr);
  const sum = document.getElementById("umLiveSummary");
  if (sum) {
    sum.textContent = `iRating SC: ${scIr ? scIr.toLocaleString("en-US") : "—"} · Horas: ${hours ? `${hours} h` : "—"} · OVR: ${ovr}`;
  }
}

function toggleUnifiedStatsAuto() {
  const isAuto = Boolean(document.getElementById("umStatsAuto")?.checked);
  ["umStatOverall", "umStatPace", "umStatAwareness", "umStatRacecraft", "umStatExperience"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = isAuto;
  });
  if (isAuto) recalcUnifiedPilotStats(true);
}

// ============================================================================
// NEW SEASON AUTO-SETUPS GENERATOR (MMT SYNC + GARAGE) + IRACING PDF PARSER
// ============================================================================
const SEASON_CAR_PRESETS = {
  gt3: "porsche992rgt3, ferrari296gt3, bmwm4gt3, mercedesamgevogt3, audir8lmsevo2gt3, mclaren720sgt3, lamborghinievogt3, fordmustanggt3, chevyvettez06rgt3, acuransxevo22gt3, amvantageevogt3",
  imsa: "porsche963gtp, ferrari499p, bmwlmdh, cadillacvseriesrgtp, acuraarx06gtp, amvalkyriegtp, dallarap217, porsche992rgt3, ferrari296gt3, bmwm4gt3, mercedesamgevogt3, mclaren720sgt3, lamborghinievogt3, fordmustanggt3, chevyvettez06rgt3, acuransxevo22gt3, amvantageevogt3",
  gtp: "porsche963gtp, ferrari499p, bmwlmdh, cadillacvseriesrgtp, acuraarx06gtp, amvalkyriegtp",
  pcup: "porsche9922cup, porsche992cup",
  lmp2: "dallarap217",
  gt4: "porsche718gt4, bmwm4evogt4, bmwm4gt4, mercedesamggt4, amvantagegt4, mclaren570sgt4, fordmustanggt4"
};

const IRACING_PDF_CAR_MAP = [
  [/porsche\s*911\s*gt3\s*r\s*\(992\)/i, "porsche992rgt3"],
  [/ferrari\s*296\s*gt3/i, "ferrari296gt3"],
  [/bmw\s*m4\s*gt3/i, "bmwm4gt3"],
  [/mercedes[-\s]*amg\s*gt3/i, "mercedesamgevogt3"],
  [/audi\s*r8\s*lms.*gt3/i, "audir8lmsevo2gt3"],
  [/mclaren\s*720s\s*gt3/i, "mclaren720sgt3"],
  [/lamborghini\s*hurac[aá]n\s*gt3/i, "lamborghinievogt3"],
  [/ford\s*mustang\s*gt3/i, "fordmustanggt3"],
  [/corvette\s*z06\s*gt3/i, "chevyvettez06rgt3"],
  [/acura\s*nsx\s*gt3/i, "acuransxevo22gt3"],
  [/aston\s*martin\s*vantage\s*gt3/i, "amvantageevogt3"],
  [/porsche\s*963/i, "porsche963gtp"],
  [/ferrari\s*499p/i, "ferrari499p"],
  [/bmw\s*m\s*hybrid\s*v8/i, "bmwlmdh"],
  [/cadillac\s*v-?series\.?r/i, "cadillacvseriesrgtp"],
  [/acura\s*arx-?06/i, "acuraarx06gtp"],
  [/aston\s*martin\s*valkyrie/i, "amvalkyriegtp"],
  [/dallara\s*p217/i, "dallarap217"],
  [/porsche\s*911.*cup.*992\.2/i, "porsche9922cup"],
  [/porsche\s*911\s*(?:gt3\s*)?cup/i, "porsche992cup"],
  [/porsche\s*718\s*cayman\s*gt4/i, "porsche718gt4"],
  [/bmw\s*m4\s*g82\s*gt4/i, "bmwm4evogt4"],
  [/bmw\s*m4.*gt4/i, "bmwm4gt4"],
  [/mercedes[-\s]*amg\s*gt4/i, "mercedesamggt4"],
  [/aston\s*martin\s*vantage\s*gt4/i, "amvantagegt4"],
  [/mclaren\s*570s\s*gt4/i, "mclaren570sgt4"],
  [/ford\s*mustang\s*gt4/i, "fordmustanggt4"],
  [/ligier\s*js\s*p320/i, "ligierjsp320"],
  [/bmw\s*m2\s*cs/i, "bmwm2g87"],
  [/toyota\s*gr86/i, "toyotagr86"],
  [/global\s*mazda\s*mx-?5/i, "mx5 cup"],
  [/renault\s*clio/i, "renaultcliocup"],
  [/audi\s*rs\s*3\s*lms/i, "audirs3lmsgen2"],
  [/honda\s*civic\s*type\s*r/i, "hondacivictyper"],
  [/hyundai\s*elantra\s*n/i, "hyundaielantracn7"],
  [/hyundai\s*veloster\s*n/i, "hyundaivelostern"],
  [/fia\s*f4|ir-?04/i, "formulair04"],
  [/dallara\s*f3/i, "dallaraf3"],
  [/dallara\s*ir18/i, "dallarair18"],
  [/ray\s*ff1600/i, "raygr22"],
  [/formula\s*vee/i, "formulavee"],
  [/super\s*formula\s*sf23/i, "superformulasf23 honda"],
  [/bmw\s*m8\s*gte/i, "bmwm8gte"],
  [/ferrari\s*488\s*gte/i, "ferrari488gte"],
  [/corvette\s*c8\.?r\s*gte/i, "c8rvettegte"],
  [/ford\s*gt\s*gte|ford\s*gt\s*2017/i, "fordgt2017"],
  [/radical\s*sr/i, "radical sr8"],
  [/scca\s*spec\s*racer/i, "specracer"]
];

let _rcPdfParsedSeries = [];
let _rcPdfSeasonCode = "";
let _rcPdfSeasonStatus = "official";
let _rcPdfJsPromise = null;

function loadPdfJsLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_rcPdfJsPromise) return _rcPdfJsPromise;
  _rcPdfJsPromise = new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    sc.async = true;
    sc.onload = () => {
      if (window.pdfjsLib) resolve(window.pdfjsLib);
      else reject(new Error("pdf.js cargado pero pdfjsLib no disponible."));
    };
    sc.onerror = () => {
      _rcPdfJsPromise = null;
      reject(new Error("No se pudo cargar el lector PDF (cdnjs)."));
    };
    document.head.appendChild(sc);
  });
  return _rcPdfJsPromise;
}

function mapIRacingCarsToSlugs(carsText) {
  const txt = String(carsText || "");
  const slugs = [];
  const seen = new Set();
  for (const [re, slug] of IRACING_PDF_CAR_MAP) {
    if (re.test(txt) && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return slugs;
}

function detectPresetFromSlugs(slugs) {
  if (!slugs.length) return null;
  const set = new Set(slugs);
  const hasGtp = slugs.some((s) => /gtp|499p|hybridv8/.test(s));
  const hasGt3 = slugs.some((s) => /gt3$/.test(s));
  const hasLmp2 = set.has("dallarap217");
  if (hasGtp && hasGt3) return "imsa";
  if (hasGtp && !hasGt3) return "gtp";
  if (hasGt3 && !hasGtp) return "gt3";
  if (set.size === 1 && set.has("porsche992cup")) return "pcup";
  if (set.size === 1 && hasLmp2) return "lmp2";
  if (slugs.every((s) => /gt4$/.test(s))) return "gt4";
  return "custom";
}

function cleanIRacingTrackLine(raw) {
  let s = String(raw || "")
    .replace(/\(\s*20\d{2}-\d{2}-\d{2}[\s\S]*$/i, "")
    .replace(/\b(?:Rain possible|All dry events?|Dynamic sky|Constant weather|Default weather|Rolling start|Standing start|Grid by class|Local enforced cautions|Qual scrutiny|Fixed setup|Open setup)\b[\s\S]*$/i, "")
    .replace(/\b\d+\s*°\s*F\s*\/[\s\S]*$/i, "")
    .replace(/\b\d+\s*(?:mins?|minutes?|laps?)\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/[,;:.]+$/, "").trim();
  return s;
}

function isIRacingTrackMetaLine(line) {
  return /^(?:\(20\d{2}-\d{2}-\d{2}|Rain possible|All dry|Dynamic|Constant|Default weather|Rolling start|Standing start|Grid by class|Local enforced|Qual scrutiny|Fixed|Open|Night|Afternoon|Morning|Late Afternoon|Sunset|Sunrise|Forecast|Penalty|Min entries|Races |IMSA rule|Week\s+\d|Class\s+[A-D]\b|Rookie\b|\d+\s*°F|\d+\s*(?:mins?|laps?)\b|[A-Z0-9]{2,8}:\s*fuel:)/i.test(line);
}

function parseIRacingSchedulePdfLines(allLines, filename) {
  let seasonCode = "";
  let isProvisional = /prelim|provisional|prov/i.test(String(filename || ""));

  for (let i = 0; i < Math.min(allLines.length, 400); i++) {
    const l = allLines[i];
    if (!isProvisional && i < 40 && /preliminary|provisional/i.test(l)) isProvisional = true;
    if (!seasonCode) {
      const sm = l.match(/\b(20\d{2})\s+Season\s+([1-4])\b/i);
      if (sm) seasonCode = `${sm[1].slice(-2)}S${sm[2]}`;
    }
  }

  const seriesMap = new Map();
  let current = null;
  let collectingCars = false;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i].trim();
    if (!line) continue;
    // Skip TOC dotted leaders and lone page numbers
    if (/\.\s*\.\s*\./.test(line) || /^\d{1,3}$/.test(line)) continue;

    // Detect series header: "<Series Name> - 2026 Season 4"
    const hm = line.match(/^(.{4,110}?)\s+-\s+(20\d{2})\s+Season(?:\s+([1-4]))?(?:\s*-\s*(.+))?$/i);
    if (hm && !/^Week\s+\d/i.test(line)) {
      const fullTitle = line;
      if (!seasonCode && hm[2] && hm[3]) seasonCode = `${hm[2].slice(-2)}S${hm[3]}`;
      if (!seriesMap.has(fullTitle)) {
        seriesMap.set(fullTitle, {
          name: fullTitle,
          shortName: hm[1].trim(),
          carLines: [],
          weeks: [],
          weekSet: new Set()
        });
      }
      current = seriesMap.get(fullTitle);
      collectingCars = true;
      continue;
    }

    if (!current) continue;

    if (collectingCars) {
      if (/^(?:Rookie|Class\s+[A-D])\b.*-->/i.test(line) || /^Week\s+\d/i.test(line)) {
        collectingCars = false;
      } else if (current.carLines.length < 12) {
        current.carLines.push(line);
        continue;
      }
    }

    const wm = line.match(/^Week\s+(\d{1,2})\s*\((\d{4}-\d{2}-\d{2})\)\s*(.*)$/i);
    if (wm) {
      collectingCars = false;
      const weekNum = Number(wm[1]);
      const date = wm[2];
      let trackRaw = (wm[3] || "").trim();

      // Handle track names wrapped across 2 lines (when next line is not metadata/timestamp)
      if (!/\(\s*20\d{2}-\d{2}-\d{2}/.test(wm[3] || "") && i + 1 < allLines.length) {
        const nextLine = allLines[i + 1].trim();
        if (nextLine && !isIRacingTrackMetaLine(nextLine) && !/\.\s*\.\s*\./.test(nextLine) && !/^\d{1,3}$/.test(nextLine)) {
          trackRaw = trackRaw ? `${trackRaw} ${nextLine}` : nextLine;
        }
      }

      const circuit = cleanIRacingTrackLine(trackRaw);
      if (circuit && !current.weekSet.has(weekNum)) {
        current.weekSet.add(weekNum);
        current.weeks.push({ weekNum, date, circuit });
      }
    }
  }

  const priorityRe = /\b(GT Sprint|IMSA|GT Endurance|GT4|Porsche Cup|LMP2|LMP3|Global Endurance|Endurance|GT3|Production Car|Ferrari GT3)\b/i;
  const list = Array.from(seriesMap.values())
    .filter((s) => s.weeks.length > 0)
    .map((s) => {
      s.weeks.sort((a, b) => a.weekNum - b.weekNum);
      const carsText = s.carLines.join(" ").replace(/\s+/g, " ").trim();
      const slugs = mapIRacingCarsToSlugs(carsText);
      return {
        name: s.name,
        shortName: s.shortName,
        carsText,
        slugs,
        preset: detectPresetFromSlugs(slugs),
        priority: priorityRe.test(s.name) ? 0 : 1,
        weeks: s.weeks
      };
    })
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  return {
    seasonCode,
    status: isProvisional ? "provisional" : "official",
    series: list
  };
}

async function extractPdfLines(pdfDoc, onProgress) {
  const allLines = [];
  const total = pdfDoc.numPages;
  for (let p = 1; p <= total; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    const rows = [];
    for (const item of content.items || []) {
      const str = String(item.str || "").trim();
      if (!str) continue;
      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? item.transform[5] : 0;
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
      const line = row.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) allLines.push(line);
    }
    if (p % 10 === 0 || p === total) {
      if (onProgress) onProgress(p, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return allLines;
}

function renderSeasonPdfSeriesSelect(filterQuery) {
  const sel = document.getElementById("rcSeasonPdfSeries");
  const dl = document.getElementById("rcSeasonPdfDatalist");
  if (!sel) return;
  const q = String(filterQuery || "").trim().toLowerCase();

  if (dl && !dl.dataset.filled) {
    dl.innerHTML = _rcPdfParsedSeries.map((s) => `<option value="${rcEscape(s.shortName)}"></option>`).join("");
    dl.dataset.filled = "1";
  }

  const filtered = q
    ? _rcPdfParsedSeries.filter((s) => s.name.toLowerCase().includes(q) || s.carsText.toLowerCase().includes(q))
    : _rcPdfParsedSeries;

  if (!filtered.length) {
    sel.innerHTML = `<option value="">Sin coincidencias para "${rcEscape(q)}"</option>`;
    return;
  }

  const vaultMatched = _rcPdfParsedSeries.filter((s) => s.slugs.length > 0);
  const allHeaderOpts = !q
    ? `<option value="ALL_VAULT">★ TODAS las series con coches en el Vault (${vaultMatched.length} series autocompletadas)</option>`
    : (filtered.length > 1 ? `<option value="ALL_FILTERED">★ Autocompletar las ${filtered.length} series filtradas</option>` : "");

  sel.innerHTML = allHeaderOpts + filtered.map((s) => {
    const idx = _rcPdfParsedSeries.indexOf(s);
    const star = s.priority === 0 ? "★ " : (s.slugs.length ? "• " : "");
    return `<option value="${idx}">${rcEscape(star + s.shortName)} (${s.weeks.length} sem.${s.slugs.length ? ` · ${s.slugs.length} coches` : ""})</option>`;
  }).join("");

  // If query matches a single series (e.g. chosen from datalist autocomplete), select it directly
  if (filtered.length === 1) {
    sel.value = String(_rcPdfParsedSeries.indexOf(filtered[0]));
  }
}

function filterSeasonPdfSeries() {
  const q = document.getElementById("rcSeasonPdfSearch")?.value || "";
  renderSeasonPdfSeriesSelect(q);
  applySelectedPdfSeries();
}

function applySelectedPdfSeries() {
  const sel = document.getElementById("rcSeasonPdfSeries");
  const val = sel?.value || "";
  const metaEl = document.getElementById("rcSeasonPdfSeriesMeta");
  const codeEl = document.getElementById("rcSeasonCode");
  const statusEl = document.getElementById("rcSeasonStatus");
  const presetEl = document.getElementById("rcSeasonPreset");
  const carsEl = document.getElementById("rcSeasonCars");
  const schedEl = document.getElementById("rcSeasonSchedule");

  if (codeEl && _rcPdfSeasonCode) codeEl.value = _rcPdfSeasonCode;
  if (statusEl) statusEl.value = _rcPdfSeasonStatus;

  if (val === "ALL_VAULT" || val === "ALL_FILTERED") {
    const q = (document.getElementById("rcSeasonPdfSearch")?.value || "").trim().toLowerCase();
    const targetList = val === "ALL_FILTERED" && q
      ? _rcPdfParsedSeries.filter((s) => s.name.toLowerCase().includes(q) || s.carsText.toLowerCase().includes(q))
      : _rcPdfParsedSeries.filter((s) => s.slugs.length > 0);

    const allSlugs = [];
    const seenSlugs = new Set();
    const blocks = [];
    let totalWeeks = 0;

    for (const s of targetList) {
      const rowCars = s.slugs.length ? s.slugs : (carsEl?.value || "").split(",").map((c) => c.trim()).filter(Boolean);
      for (const sl of rowCars) {
        if (sl && !seenSlugs.has(sl)) { seenSlugs.add(sl); allSlugs.push(sl); }
      }
      const carsCsv = rowCars.join(", ");
      const lines = [`# === ${s.shortName} (${rowCars.length} coches) ===`];
      for (const w of s.weeks) {
        lines.push(`W${String(w.weekNum).padStart(2, "0")} | ${w.circuit} | ${carsCsv}`);
        totalWeeks++;
      }
      blocks.push(lines.join("\n"));
    }

    if (presetEl) presetEl.value = "custom";
    if (carsEl && allSlugs.length) carsEl.value = allSlugs.join(", ");
    if (schedEl) schedEl.value = blocks.join("\n\n");
    if (metaEl) {
      metaEl.textContent = `✓ ${targetList.length} series autocompletadas · ${totalWeeks} semanas totales · ${allSlugs.length} coches únicos del Vault`;
    }
    return;
  }

  const idx = Number(val);
  const series = Number.isInteger(idx) && idx >= 0 ? _rcPdfParsedSeries[idx] : null;
  if (!series) {
    if (metaEl) metaEl.textContent = "";
    return;
  }

  if (series.slugs.length) {
    if (presetEl && series.preset) presetEl.value = series.preset;
    if (carsEl) carsEl.value = series.slugs.join(", ");
  }

  const rowCarsCsv = (series.slugs.length ? series.slugs : (carsEl?.value || "").split(",").map((c) => c.trim()).filter(Boolean)).join(", ");
  if (schedEl) {
    schedEl.value = [
      `# === ${series.shortName} ===`,
      ...series.weeks.map((w) => `W${String(w.weekNum).padStart(2, "0")} | ${w.circuit}${rowCarsCsv ? ` | ${rowCarsCsv}` : ""}`)
    ].join("\n");
  }

  if (metaEl) {
    const carsInfo = series.slugs.length
      ? `${series.slugs.length} coches mapeados al Vault`
      : "Coches no mapeados (elige flota manualmente)";
    metaEl.textContent = `${series.name} · ${series.weeks.length} semanas · ${carsInfo}`;
  }
}

async function handleSeasonPdfFile(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    showRcNotice("Formato no válido", "Sube un archivo PDF oficial o provisional de iRacing (.pdf).", "warn");
    return;
  }

  const statusEl = document.getElementById("rcSeasonPdfStatus");
  const btnEl = document.getElementById("rcSeasonPdfBtn");
  const pickerEl = document.getElementById("rcSeasonPdfPicker");
  const inputEl = document.getElementById("rcSeasonPdfInput");

  if (btnEl) btnEl.disabled = true;
  if (statusEl) statusEl.textContent = `Cargando motor PDF para leer ${file.name}…`;

  try {
    const pdfjsLib = await loadPdfJsLib();
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buf, disableWorker: true });
    const pdfDoc = await loadingTask.promise;

    if (statusEl) statusEl.textContent = `Leyendo ${file.name} (0 / ${pdfDoc.numPages} páginas)…`;
    const lines = await extractPdfLines(pdfDoc, (cur, tot) => {
      if (statusEl) statusEl.textContent = `Analizando ${file.name} (${cur} / ${tot} páginas)…`;
    });

    const parsed = parseIRacingSchedulePdfLines(lines, file.name);
    if (!parsed.series.length) {
      throw new Error("No se detectaron bloques 'Week N (YYYY-MM-DD)' en el PDF.");
    }

    _rcPdfParsedSeries = parsed.series;
    _rcPdfSeasonCode = parsed.seasonCode;
    _rcPdfSeasonStatus = parsed.status;

    const searchEl = document.getElementById("rcSeasonPdfSearch");
    const dlEl = document.getElementById("rcSeasonPdfDatalist");
    if (searchEl) searchEl.value = "";
    if (dlEl) delete dlEl.dataset.filled;
    renderSeasonPdfSeriesSelect("");
    if (pickerEl) pickerEl.classList.remove("hidden");

    // Default to ALL_VAULT so every Vault-matched series is autocompleted at once
    const sel = document.getElementById("rcSeasonPdfSeries");
    if (sel) sel.value = "ALL_VAULT";
    applySelectedPdfSeries();

    const seasonLabel = parsed.seasonCode ? ` · Temporada ${parsed.seasonCode} (${parsed.status})` : "";
    if (statusEl) {
      statusEl.textContent = `✓ ${file.name} procesado (${pdfDoc.numPages} págs)${seasonLabel} · ${parsed.series.length} series detectadas.`;
    }
    showRcNotice(
      "PDF de iRacing importado",
      `${parsed.series.length} series extraídas${seasonLabel}. Elige la serie en el desplegable y pulsa Dry-Run o Publicar.`,
      "success"
    );
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error al leer PDF: ${err?.message || "archivo no compatible"}`;
    showRcNotice("Error leyendo PDF", err?.message || "No se pudo analizar el PDF de iRacing.", "warn");
  } finally {
    if (btnEl) btnEl.disabled = false;
    if (inputEl) inputEl.value = "";
  }
}

function initSeasonPdfDropzone() {
  const box = document.getElementById("rcSeasonPdfBox");
  if (!box || box.dataset.bound) return;
  box.dataset.bound = "1";
  ["dragenter", "dragover"].forEach((ev) => {
    box.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      box.classList.add("is-dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    box.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
      box.classList.remove("is-dragover");
    });
  });
  box.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) handleSeasonPdfFile(file);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSeasonPdfDropzone);
} else {
  initSeasonPdfDropzone();
}

function applySeasonCarPreset() {
  const sel = document.getElementById("rcSeasonPreset")?.value || "gt3";
  const inp = document.getElementById("rcSeasonCars");
  if (inp && SEASON_CAR_PRESETS[sel]) inp.value = SEASON_CAR_PRESETS[sel];
}

function parseSeasonScheduleText(raw, defaultCars) {
  const s = String(raw || "").trim();
  if (!s) return [];
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      const arr = Array.isArray(parsed) ? parsed : (parsed.entries || parsed.weeks || []);
      return arr.map((it, idx) => ({
        week: it.week || `W${String(idx + 1).padStart(2, "0")}`,
        circuit: String(it.circuit || it.track || "").trim(),
        cars: Array.isArray(it.cars) && it.cars.length ? it.cars : defaultCars
      })).filter((e) => e.circuit);
    } catch {}
  }
  const lines = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
  const mergedMap = new Map();
  let autoIdx = 0;
  lines.forEach((line) => {
    autoIdx++;
    let week = "";
    let circuit = "";
    let cars = defaultCars;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 2) {
      const wm = parts[0].match(/(\d{1,2})/);
      week = wm ? `W${String(Number(wm[1])).padStart(2, "0")}` : parts[0];
      circuit = parts[1];
      cars = parts[2] ? parts[2].split(",").map((c) => c.trim().toLowerCase()).filter(Boolean) : defaultCars;
    } else {
      const m = line.match(/^(?:week|semana|w)\s*(\d{1,2})\s*[:\-–—.]?\s*(.+)$/i);
      if (m) {
        week = `W${String(Number(m[1])).padStart(2, "0")}`;
        circuit = m[2].trim();
      } else {
        week = `W${String(autoIdx).padStart(2, "0")}`;
        circuit = line;
      }
    }
    if (!circuit) return;
    const key = `${week.toUpperCase()}::${circuit.toLowerCase()}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, { week, circuit, cars: [...cars], carSet: new Set(cars) });
    } else {
      const entry = mergedMap.get(key);
      for (const c of cars) {
        if (c && !entry.carSet.has(c)) {
          entry.carSet.add(c);
          entry.cars.push(c);
        }
      }
    }
  });
  return Array.from(mergedMap.values()).map(({ week, circuit, cars }) => ({ week, circuit, cars }));
}

async function runSeasonAutoGenerate(dryRun) {
  const season = (document.getElementById("rcSeasonCode")?.value || "").trim().toUpperCase();
  const status = document.getElementById("rcSeasonStatus")?.value || "provisional";
  const carsRaw = document.getElementById("rcSeasonCars")?.value || "";
  const defaultCars = carsRaw.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  const scheduleRaw = document.getElementById("rcSeasonSchedule")?.value || "";
  const entries = parseSeasonScheduleText(scheduleRaw, defaultCars);
  const prog = document.getElementById("rcSeasonProgress");
  const outEl = document.getElementById("rcSeasonOutput");
  const dryBtn = document.getElementById("rcSeasonDryRunBtn");
  const pubBtn = document.getElementById("rcSeasonPublishBtn");

  if (!season || season.length < 3) {
    showRcNotice("Temporada requerida", "Introduce un código válido como 27S1.", "warn");
    return;
  }
  if (!entries.length || !defaultCars.length) {
    showRcNotice("Calendario vacío", "Pega al menos una semana/circuito y selecciona coches.", "warn");
    return;
  }

  if (dryBtn) dryBtn.disabled = true;
  if (pubBtn) pubBtn.disabled = true;
  if (outEl) { outEl.hidden = false; outEl.innerHTML = ""; }

  let totalMatched = 0, totalMissing = 0, totalInserted = 0, totalSkipped = 0;
  const allSamples = [];
  const allMissing = [];

  try {
    // Process 2 weeks per batch to stay well within Cloudflare Worker CPU limits
    for (let i = 0; i < entries.length; i += 2) {
      const batch = entries.slice(i, i + 2);
      if (prog) prog.textContent = `${dryRun ? "Simulando" : "Generando"} semanas ${i + 1}–${Math.min(entries.length, i + 2)} de ${entries.length}…`;
      const data = await rcAdminFetch("/api/setups/admin/season/generate", {
        season,
        status,
        entries: batch,
        dry_run: Boolean(dryRun)
      });
      totalMatched += Number(data.matched_count || 0);
      totalMissing += Number(data.missing_count || 0);
      totalInserted += Number(data.inserted || 0);
      totalSkipped += Number(data.skipped_existing || 0);
      if (Array.isArray(data.sample)) allSamples.push(...data.sample);
      if (Array.isArray(data.missing)) allMissing.push(...data.missing);
    }

    if (prog) {
      prog.textContent = dryRun
        ? `Simulación lista: ${totalMatched} setups emparejados · ${totalMissing} combinaciones sin base.`
        : `✓ Publicado ${season} (${status}): ${totalInserted} nuevos en D1 · ${totalSkipped} ya existentes · MMT Sync actualizado.`;
    }
    if (outEl) {
      const rowsHtml = allSamples.slice(0, 60).map((s) =>
        `<tr><td><code>${rcEscape(s.week)}</code></td><td>${rcEscape(s.circuit)}</td><td><code>${rcEscape(s.car)}</code></td><td>${rcEscape(s.setup_type)}</td><td><code>${rcEscape(s.filename)}</code></td></tr>`
      ).join("");
      const missHtml = allMissing.length
        ? `<p class="rc-muted" style="margin:12px 0 0;font-size:12.5px">Sin base previa (${allMissing.length}): ${allMissing.slice(0, 12).map((m) => `${rcEscape(m.week)} ${rcEscape(m.circuit)} (${rcEscape(m.car)})`).join(", ")}</p>`
        : "";
      outEl.innerHTML = `
        <div class="r-scroll">
          <table class="r-table">
            <thead><tr><th>Semana</th><th>Circuito</th><th>Coche</th><th>Tipo</th><th>Archivo MMT generado</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="5">No se encontraron bases .sto para los circuitos indicados.</td></tr>'}</tbody>
          </table>
        </div>
        ${missHtml}
      `;
    }
    showRcNotice(
      dryRun ? "Simulación completada" : `Season ${season} generada`,
      dryRun ? `${totalMatched} setups listos para publicar.` : `${totalInserted} setups publicados en D1 para MMT Sync y /garage/.`,
      "success"
    );
  } catch (err) {
    if (prog) prog.textContent = err?.message || "Error al generar la temporada.";
    showRcNotice("Error en generador de Season", err?.message || "Revisa el formato del calendario.", "warn");
  } finally {
    if (dryBtn) dryBtn.disabled = false;
    if (pubBtn) pubBtn.disabled = false;
  }
}

window.applySeasonCarPreset = applySeasonCarPreset;
window.runSeasonAutoGenerate = runSeasonAutoGenerate;
window.handleSeasonPdfFile = handleSeasonPdfFile;
window.filterSeasonPdfSeries = filterSeasonPdfSeries;
window.applySelectedPdfSeries = applySelectedPdfSeries;

// ============================================================================
// GARAGE 61 SCREENSHOT UPLOAD, PASTE, VISION AI PARSING & LIST EDITOR
// ============================================================================
function compressImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Archivo de imagen no válido."));
      img.onload = () => {
        const maxDim = 1800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL("image/jpeg", 0.90);
        if (out.length > 820000) out = canvas.toDataURL("image/jpeg", 0.80);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadG61ImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const dataUrl = await compressImageToDataUrl(file);
    umState.g61ImageDataUrl = dataUrl;
    const prevWrap = document.getElementById("umG61PreviewWrap");
    const prevImg = document.getElementById("umG61PreviewImg");
    const msg = document.getElementById("umG61StatusMsg");
    const btn = document.getElementById("umG61AnalyzeBtn");
    if (prevImg) prevImg.src = dataUrl;
    if (prevWrap) prevWrap.classList.remove("hidden");
    if (msg) msg.textContent = `Captura cargada (${Math.round(dataUrl.length / 1024)} KB). Pulsa «Analizar y recalcular».`;
    if (btn) btn.disabled = false;
  } catch (err) {
    showRcNotice("Imagen no válida", err?.message || "Prueba con PNG, JPG o WebP.", "warn");
  }
}

function handleG61FileSelected(ev) {
  const file = ev?.target?.files?.[0];
  if (file) loadG61ImageFile(file);
}

async function analyzeG61Screenshot() {
  if (!umState.g61ImageDataUrl) return;
  const btn = document.getElementById("umG61AnalyzeBtn");
  const msg = document.getElementById("umG61StatusMsg");
  const kind = document.getElementById("umG61Kind")?.value || "auto";
  if (btn) { btn.disabled = true; btn.textContent = "Leyendo con IA…"; }
  if (msg) msg.textContent = "Analizando gráfico o tabla de Garage 61 / iRacing con Visión IA…";

  try {
    const data = await rcAdminFetch("/api/setups/admin/driver/parse-g61-image", {
      image: umState.g61ImageDataUrl,
      kind
    });

    let foundSummary = [];
    if (Array.isArray(data.top_cars) && data.top_cars.length > 0) {
      umState.topCars = data.top_cars;
      foundSummary.push(`${data.top_cars.length} coches`);
    }
    if (Array.isArray(data.top_tracks) && data.top_tracks.length > 0) {
      umState.topTracks = data.top_tracks;
      foundSummary.push(`${data.top_tracks.length} circuitos`);
      const favEl = document.getElementById("umFavoriteTrack");
      if (favEl && data.top_tracks[0]?.name) favEl.value = data.top_tracks[0].name;
    }
    const inferredHours = Number(data.total_track_hours) || 0;
    const existingTrackSum = Number((umState.topTracks || []).reduce((a, t) => a + (Number(t.hours) || 0), 0).toFixed(1));
    const hoursEl = document.getElementById("umTotalHours");
    const bestHours = existingTrackSum > 0 ? existingTrackSum : inferredHours;
    if (hoursEl && bestHours > 0) {
      const currentVal = Number(hoursEl.value) || 0;
      if (existingTrackSum > 0 || bestHours >= currentVal || currentVal <= 0) {
        hoursEl.value = String(bestHours);
      }
    }
    if (Array.isArray(data.licenses) && data.licenses.length > 0) {
      data.licenses.forEach((l) => {
        const clsEl = document.getElementById(`umLicClass-${l.category}`);
        const srEl = document.getElementById(`umLicSr-${l.category}`);
        const irEl = document.getElementById(`umLicIr-${l.category}`);
        if (clsEl && l.class_label) clsEl.value = l.class_label;
        if (srEl && l.sr != null) srEl.value = Number(l.sr).toFixed(2);
        if (irEl && l.irating != null) irEl.value = String(l.irating);
      });
      foundSummary.push(`${data.licenses.length} licencias`);
    }

    renderG61Lists();
    recalcUnifiedPilotStats();

    if (foundSummary.length > 0) {
      const unitInfo = data.unit_detected && data.unit_detected !== "unknown"
        ? ` · unidad: ${data.unit_detected}${data.x_axis_max ? ` (eje máx ${data.x_axis_max})` : ""}`
        : "";
      if (msg) msg.textContent = `✓ Extraído: ${foundSummary.join(" · ")}${unitInfo} (${data.engine || "Vision AI"}). Revisa las horas/vueltas abajo antes de guardar.`;
      showRcNotice("Captura analizada", `Se extrajeron ${foundSummary.join(", ")}${unitInfo}. Verifica las cifras y pulsa Guardar.`, "success");
    } else {
      if (msg) msg.textContent = "No se detectaron filas numéricas en la foto. Puedes añadirlas manualmente abajo.";
    }
  } catch (err) {
    if (msg) msg.textContent = err?.message || "Error al analizar la imagen.";
    showRcNotice("No se pudo leer la foto", err?.message || "Prueba con un recorte más nítido.", "warn");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Analizar y recalcular"; }
  }
}

function renderG61Lists() {
  const renderOne = (containerId, arr, kind) => {
    const box = document.getElementById(containerId);
    if (!box) return;
    if (!arr.length) {
      box.innerHTML = `<p class="rc-mono-sub" style="margin:6px 0">Sin filas aún. Sube una foto de Garage 61 o pulsa «+ Añadir».</p>`;
      return;
    }
    box.innerHTML = arr.map((item, idx) => `
      <div class="rc-g61-item">
        <input type="text" value="${rcEscape(item.name || "")}" placeholder="Nombre" onchange="updateG61ListRow('${kind}', ${idx}, 'name', this.value)" />
        <input type="number" min="0" value="${rcEscape(item.laps ?? 0)}" placeholder="Laps" title="Vueltas" onchange="updateG61ListRow('${kind}', ${idx}, 'laps', this.value)" />
        <input type="number" min="0" step="0.1" value="${rcEscape(item.hours ?? 0)}" placeholder="Horas" title="Horas" onchange="updateG61ListRow('${kind}', ${idx}, 'hours', this.value)" />
        <button type="button" class="rc-g61-del" onclick="removeG61ListRow('${kind}', ${idx})" title="Eliminar fila">×</button>
      </div>
    `).join("");
  };
  renderOne("umTopCarsList", umState.topCars, "cars");
  renderOne("umTopTracksList", umState.topTracks, "tracks");
}

function addG61ListRow(kind) {
  const arr = kind === "cars" ? umState.topCars : umState.topTracks;
  arr.push({ name: "", laps: 0, hours: 0 });
  renderG61Lists();
}

function updateG61ListRow(kind, idx, field, val) {
  const arr = kind === "cars" ? umState.topCars : umState.topTracks;
  if (!arr[idx]) return;
  if (field === "name") arr[idx].name = String(val || "").trim();
  else arr[idx][field] = Number(val) || 0;
  if (kind === "tracks") {
    const sum = Number(arr.reduce((a, t) => a + (Number(t.hours) || 0), 0).toFixed(1));
    const hoursEl = document.getElementById("umTotalHours");
    if (hoursEl && sum > 0) hoursEl.value = String(sum);
    recalcUnifiedPilotStats();
  }
}

function removeG61ListRow(kind, idx) {
  const arr = kind === "cars" ? umState.topCars : umState.topTracks;
  arr.splice(idx, 1);
  renderG61Lists();
  if (kind === "tracks") {
    const sum = Number(arr.reduce((a, t) => a + (Number(t.hours) || 0), 0).toFixed(1));
    const hoursEl = document.getElementById("umTotalHours");
    if (hoursEl) hoursEl.value = sum > 0 ? String(sum) : "";
    recalcUnifiedPilotStats();
  }
}

async function submitUnifiedPilotForm(e) {
  e.preventDefault();
  const btn = document.getElementById("umSubmitBtn");
  const slug = document.getElementById("umSlug")?.value.trim() || "";
  const origEmail = document.getElementById("umOrigEmail")?.value.trim().toLowerCase() || "";
  const fullName = document.getElementById("umFullName")?.value.trim() || "";
  const dorsal = document.getElementById("umDorsal")?.value.trim() || "";
  const kind = document.getElementById("umKind")?.value || "driver";
  const accountRole = document.getElementById("umAccountRole")?.value || "driver";
  const roleTitle = document.getElementById("umRoleTitle")?.value.trim() || "";
  const email = document.getElementById("umEmail")?.value.trim().toLowerCase() || "";
  const cust_id = document.getElementById("umCustId")?.value.trim() || "";
  const specialty = document.getElementById("umSpecialty")?.value.trim() || "";
  const club = document.getElementById("umClub")?.value.trim() || "";
  const country = document.getElementById("umCountry")?.value.trim() || "";
  const team = document.getElementById("umTeam")?.value.trim() || "";
  const car_class = document.getElementById("umCarClass")?.value.trim() || "";
  const bio = document.getElementById("umBio")?.value.trim() || "";
  const has_setup_access = Boolean(document.getElementById("umSetupAccess")?.checked);

  if (!fullName) return;
  if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }

  try {
    // 1. Update D1 Account if an account exists for origEmail or email
    const targetEmail = origEmail || email;
    const matchedMember = targetEmail
      ? rcState.members.find((m) => String(m.email).toLowerCase() === targetEmail)
      : null;

    if (matchedMember) {
      await rcAdminFetch("/api/setups/admin/user/update", {
        email: matchedMember.email,
        name: fullName,
        role: accountRole,
        team,
        car_class,
        has_setup_access
      });
    }

    // 2. Update Official Pilot Profile (5 Licenses + Garage 61 + MTI Stats)
    if (slug) {
      const licenses = readLicensesFromModal();
      const top_cars = umState.topCars.filter((c) => c.name && (c.laps > 0 || c.hours > 0));
      const top_tracks = umState.topTracks.filter((t) => t.name && (t.laps > 0 || t.hours > 0));
      const totalHoursRaw = Number(document.getElementById("umTotalHours")?.value);
      const favorite_track = document.getElementById("umFavoriteTrack")?.value.trim() || "";
      const isAutoStats = Boolean(document.getElementById("umStatsAuto")?.checked);
      const f1_stats = isAutoStats
        ? { auto: true }
        : {
            auto: false,
            overall: Number(document.getElementById("umStatOverall")?.value) || 60,
            pace: Number(document.getElementById("umStatPace")?.value) || 60,
            awareness: Number(document.getElementById("umStatAwareness")?.value) || 60,
            racecraft: Number(document.getElementById("umStatRacecraft")?.value) || 60,
            experience: Number(document.getElementById("umStatExperience")?.value) || 60
          };

      const scLic = licenses.find((l) => l.category === "sports_car") || licenses[0] || null;
      const sims = Array.from(document.querySelectorAll('#umSimsGrid input[name="umSim"]:checked')).map((cb) => cb.value);
      const member_since = document.getElementById("umMemberSince")?.value.trim() || "2026";
      const helmet_style = document.getElementById("umHelmetStyle")?.value || "mmt_green";
      const show_public = Boolean(document.getElementById("umShowPublic")?.checked);

      await rcAdminFetch("/api/setups/admin/driver/profile", {
        slug,
        fullName,
        name: fullName,
        dorsal: dorsal || null,
        kind,
        sims: sims.length ? sims : [kind === "staff" ? "staff" : "iracing"],
        member_since,
        helmet_style,
        show_public,
        role: roleTitle || null,
        specialty: specialty || null,
        club: club || null,
        country: country || null,
        bio: bio || null,
        cust_id: cust_id || null,
        email: email || null,
        licenses,
        irating: scLic?.irating ?? undefined,
        license: scLic ? `${scLic.class_label}${scLic.sr != null ? ` ${Number(scLic.sr).toFixed(2)}` : ""}` : undefined,
        top_cars,
        top_tracks,
        total_track_hours: Number.isFinite(totalHoursRaw) && totalHoursRaw > 0 ? totalHoursRaw : undefined,
        favorite_track: favorite_track || undefined,
        f1_stats,
        sync_account_name: true
      });
    }

    closeUnifiedPilotModal();
    appendAuditEvent("admin", "atrumin16@gmail.com", `${umState.isNew ? "Creado" : "Actualizado"} en /drivers: ${fullName} (${slug || targetEmail})`, "GUARDADO");
    await refreshRaceControlData();
    showRcNotice("Cambios guardados en vivo", `${fullName} publicado en Cloudflare D1, /drivers y /api/drivers.`, "success");
  } catch (err) {
    showRcNotice("Error al guardar", err?.message || "No se pudo actualizar en D1.", "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Guardar todo en D1"; }
  }
}

async function deleteUnifiedPilotProfile() {
  const slug = document.getElementById("umSlug")?.value.trim() || "";
  const fullName = document.getElementById("umFullName")?.value.trim() || slug;
  if (!slug || !umState.isDynamic) return;
  if (!window.confirm(`¿Eliminar el perfil "${fullName}" (${slug}) de /drivers y Cloudflare D1?`)) return;
  try {
    await rcAdminFetch("/api/setups/admin/driver/profile", { slug, delete_profile: true });
    closeUnifiedPilotModal();
    appendAuditEvent("admin", "atrumin16@gmail.com", `Eliminado perfil dinámico: ${fullName} (${slug})`, "ELIMINADO");
    await refreshRaceControlData();
    showRcNotice("Perfil eliminado", `${fullName} ha sido retirado de /drivers.`, "info");
  } catch (err) {
    showRcNotice("Error al eliminar", err?.message || "No se pudo eliminar el perfil.", "err");
  }
}

// ============================================================================
// ROW POPOVER MENU & ACCOUNT ACTIONS
// ============================================================================
function closeRowActionMenu() {
  const pop = document.getElementById("rcRowActionPopover");
  if (pop) pop.classList.add("hidden");
  if (rcActiveMenuBtn) {
    rcActiveMenuBtn.setAttribute("aria-expanded", "false");
    rcActiveMenuBtn = null;
  }
}

function openRowActionMenu(btn, ev) {
  if (ev) ev.stopPropagation();
  const pop = document.getElementById("rcRowActionPopover");
  if (!pop || !btn) return;
  if (rcActiveMenuBtn === btn && !pop.classList.contains("hidden")) {
    closeRowActionMenu();
    return;
  }
  closeRowActionMenu();

  const email = (btn.dataset.email || "").trim().toLowerCase();
  const member = rcState.members.find((m) => String(m.email).toLowerCase() === email);
  if (!member) return;

  const isPrincipal = email === "atrumin16@gmail.com";
  const isBlocked = member.status === "inactive";
  const hasSetupAccess = Boolean(member.has_setup_access);
  const linkedProf = (rcState.profiles || []).find((pr) => pr.email && String(pr.email).toLowerCase() === email);

  const items = [
    `<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" data-slug="${rcEscape(linkedProf?.slug || "")}" onclick="closeRowActionMenu(); openUnifiedPilotModal({ email: this.dataset.email, slug: this.dataset.slug })">✏️ Editar todo (rol, licencias, G61)</button>`
  ];
  if (!isBlocked) {
    items.push(`<div class="rc-action-popover__sep"></div>`);
    items.push(`<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="closeRowActionMenu(); generateDriverAccessFromBtn(this, 'link')">🔑 Enviar enlace reset (72h)</button>`);
    items.push(`<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="closeRowActionMenu(); generateDriverAccessFromBtn(this, 'copy_link')">📋 Copiar enlace (72h)</button>`);
    items.push(`<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="closeRowActionMenu(); generateDriverAccessFromBtn(this, 'temp_password')">⚡ Emitir clave temporal</button>`);
    items.push(`<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" onclick="closeRowActionMenu(); revokePilotSessionsBtn(this)">⎋ Cerrar sesiones activas</button>`);
  }
  if (!isPrincipal) {
    items.push(`<div class="rc-action-popover__sep"></div>`);
    items.push(`<button type="button" class="rc-action-popover__item ${hasSetupAccess ? "rc-action-popover__item--ok" : ""}" data-email="${rcEscape(member.email)}" data-access="${hasSetupAccess ? "1" : "0"}" onclick="closeRowActionMenu(); toggleSetupAccessBtn(this)">${hasSetupAccess ? "✓ Setups Vault: Activo" : "○ Setups Vault: Bloqueado"}</button>`);
    items.push(`<button type="button" class="rc-action-popover__item" data-email="${rcEscape(member.email)}" data-status="${isBlocked ? "active" : "inactive"}" onclick="closeRowActionMenu(); toggleMemberStatusBtn(this)">${isBlocked ? "✓ Reactivar cuenta" : "⊘ Bloquear cuenta"}</button>`);
    items.push(`<button type="button" class="rc-action-popover__item rc-action-popover__item--danger" data-email="${rcEscape(member.email)}" onclick="closeRowActionMenu(); deleteMemberBtn(this)">🗑 Eliminar cuenta</button>`);
  }

  pop.innerHTML = items.join("");
  pop.classList.remove("hidden");
  btn.setAttribute("aria-expanded", "true");
  rcActiveMenuBtn = btn;

  const rect = btn.getBoundingClientRect();
  const popW = pop.offsetWidth || 225;
  const popH = pop.offsetHeight || 200;
  const left = Math.max(12, rect.right - popW);
  const top = rect.bottom + 6 + popH > window.innerHeight - 12 ? Math.max(12, rect.top - popH - 6) : rect.bottom + 6;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function openAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.remove("hidden");
  document.getElementById("newDriverName")?.focus();
}

function closeAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.add("hidden");
}

async function issuePilotCredentials({ request_id = null, name, email, role = "driver", method = "link", send_email = true, force = true }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || cleanEmail.split("@")[0]).trim();
  if (!cleanEmail) return;
  try {
    const payload = request_id
      ? { request_id: Number(request_id), method, send_email, force }
      : { email: cleanEmail, name: cleanName, role, method, send_email, force };
    const data = await rcAdminFetch("/api/setups/admin/approve", payload);
    const secret = data.temp_password || data.set_password_link || "";
    const isTempPass = Boolean(data.temp_password);
    appendAuditEvent("admin", "atrumin16@gmail.com", `Credenciales emitidas: ${cleanName} (${cleanEmail})`, data.email_sent ? "ENVIADO" : "LISTO");
    await refreshRaceControlData();
    if (data.email_sent) {
      const via = data.email_provider ? ` vía ${data.email_provider}` : "";
      showRcNotice("Correo de bienvenida enviado", `Enviado a ${cleanEmail}${via} con enlace de primer acceso y métodos Passkey/2FA.`, "success");
    } else if (secret) {
      openCredentialsResultModal({ name: data.pilot?.name || cleanName, email: data.pilot?.email || cleanEmail, secret, isTempPass });
      showRcNotice("Acceso creado", data.email_error ? `Correo pendiente (${data.email_error}). Usa el modal de respaldo.` : "Credenciales listas.", "warn");
    }
  } catch (err) {
    showRcNotice("No se pudo aprobar/generar acceso", err?.message || "Error en D1.", "err");
  }
}

async function submitAddDriverForm(e) {
  e.preventDefault();
  const name = document.getElementById("newDriverName")?.value || "";
  const email = document.getElementById("newDriverEmail")?.value || "";
  const role = document.getElementById("newDriverRole")?.value || "driver";
  const method = document.getElementById("newDriverMethod")?.value || "link";
  const send_email = Boolean(document.getElementById("newDriverSendEmail")?.checked);
  closeAddDriverModal();
  await issuePilotCredentials({ name, email, role, method, send_email, force: true });
}

async function generateDriverAccessFromBtn(btn, method = "link") {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  const name = btn?.dataset?.name || email.split("@")[0];
  if (!email) return;
  if (method === "temp_password") {
    await issuePilotCredentials({ name, email, method: "temp_password", send_email: true, force: true });
    return;
  }
  const alwaysOpenModal = method === "copy_link";
  try {
    const data = await rcAdminFetch("/api/setups/admin/resend-invite", { email, kind: "auto" });
    const secret = data.set_password_link || "";
    const kindLbl = data.kind === "invite" ? "Bienvenida / Primer acceso 72h" : "Reset 72h";
    appendAuditEvent("admin", "atrumin16@gmail.com", `${kindLbl} emitido para ${email}`, data.kind === "invite" ? "INVITE" : "RESET");
    await refreshRaceControlData();
    if (secret && (alwaysOpenModal || !data.email_sent)) {
      openCredentialsResultModal({ name, email, secret, isTempPass: false });
      try { await navigator.clipboard.writeText(secret); } catch {}
    }
    showRcNotice(
      alwaysOpenModal ? "Enlace 72h copiado" : (data.email_sent ? `Correo (${kindLbl}) enviado` : "Correo pendiente"),
      alwaysOpenModal ? `Enlace copiado al portapapeles para ${email}.` : (data.email_sent ? `Enviado a ${email}.` : `${data.email_error || "Copia el enlace desde el modal."}`),
      data.email_sent || alwaysOpenModal ? "success" : "warn"
    );
  } catch (err) {
    showRcNotice("No se pudo enviar el reset", err?.message || "Error al generar enlace.", "err");
  }
}

async function revokePilotSessionsBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  if (!email) return;
  try {
    await rcAdminFetch("/api/setups/admin/user/revoke", { email });
    appendAuditEvent("admin", "atrumin16@gmail.com", `Sesiones cerradas: ${email}`, "REVOKED");
    showRcNotice("Sesiones cerradas", `Tokens invalidados para ${email}.`, "success");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudieron cerrar las sesiones.", "err");
  }
}

async function runQuickCredentialAction(action) {
  const input = document.getElementById("quickResetEmailInput");
  const email = (input?.value || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showRcNotice("Introduce un correo", "Selecciona o escribe el correo del piloto.", "warn");
    input?.focus();
    return;
  }
  const found = rcState.members.find((m) => String(m.email).toLowerCase() === email);
  const fakeBtn = { dataset: { email, name: found?.name || email.split("@")[0] } };
  if (action === "send_reset") await generateDriverAccessFromBtn(fakeBtn, "link");
  else if (action === "copy_link") await generateDriverAccessFromBtn(fakeBtn, "copy_link");
  else if (action === "temp_password") await generateDriverAccessFromBtn(fakeBtn, "temp_password");
  else if (action === "revoke_sessions") await revokePilotSessionsBtn(fakeBtn);
}

function approvePendingRequestBtn(btn, method = "link") {
  issuePilotCredentials({ request_id: btn?.dataset?.requestId || null, name: btn?.dataset?.name || "", email: btn?.dataset?.email || "", role: "driver", method, send_email: true, force: true });
}

async function rejectPendingRequestBtn(btn) {
  const request_id = btn?.dataset?.requestId;
  const email = btn?.dataset?.email || "";
  if (!request_id) return;
  const reason = window.prompt(`Motivo opcional para rechazar a ${email}:`, "");
  if (reason === null) return;
  try {
    await rcAdminFetch("/api/setups/admin/reject", { request_id: Number(request_id), notify: true, reason });
    appendAuditEvent("admin", "atrumin16@gmail.com", `Solicitud rechazada: ${email}`, "RECHAZADA");
    await refreshRaceControlData();
    showRcNotice("Solicitud rechazada", `Solicitud de ${email} rechazada.`, "info");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudo rechazar.", "err");
  }
}

async function toggleSetupAccessBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  const nextAccess = btn?.dataset?.access !== "1";
  if (!email) return;
  try {
    await rcAdminFetch("/api/admin/setups-access", { email, has_setup_access: nextAccess });
    appendAuditEvent("admin", "atrumin16@gmail.com", `Setups .sto ${nextAccess ? "activados" : "bloqueados"}: ${email}`, nextAccess ? "ON" : "OFF");
    await refreshRaceControlData();
    showRcNotice("Permiso actualizado", `Acceso a setups ${nextAccess ? "activo" : "bloqueado"} para ${email}.`, "success");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudo cambiar el acceso.", "err");
  }
}

async function toggleMemberStatusBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  const nextStatus = btn?.dataset?.status === "active" ? "active" : "inactive";
  if (!email || email === "atrumin16@gmail.com") return;
  if (!window.confirm(`¿Seguro que quieres ${nextStatus === "inactive" ? "bloquear" : "reactivar"} a ${email}?`)) return;
  try {
    await rcAdminFetch("/api/setups/admin/set-status", { email, status: nextStatus });
    appendAuditEvent("admin", "atrumin16@gmail.com", `Cuenta ${nextStatus === "inactive" ? "bloqueada" : "reactivada"}: ${email}`, nextStatus.toUpperCase());
    await refreshRaceControlData();
    showRcNotice("Estado actualizado", `${email} ahora está ${nextStatus === "inactive" ? "bloqueada" : "activa"}.`, "info");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudo cambiar el estado.", "err");
  }
}

async function deleteMemberBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  if (!email || email === "atrumin16@gmail.com") return;
  if (!window.confirm(`¿Eliminar definitivamente la cuenta de ${email} de Cloudflare D1?`)) return;
  try {
    await rcAdminFetch("/api/setups/admin/user/delete", { email, confirm: email });
    appendAuditEvent("admin", "atrumin16@gmail.com", `Cuenta eliminada: ${email}`, "ELIMINADA");
    await refreshRaceControlData();
    showRcNotice("Cuenta eliminada", `${email} eliminada de D1.`, "info");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudo eliminar la cuenta.", "err");
  }
}

// ============================================================================
// CREDENTIALS MODAL, MAILBOXES, EMAIL STUDIO, AUDIT & STEWARD BOT
// ============================================================================
function openCredentialsResultModal({ name, email, secret, isTempPass }) {
  const modal = document.getElementById("credentialsResultModal");
  const label = document.getElementById("credSecretLabel");
  const code = document.getElementById("credSecretCode");
  const textarea = document.getElementById("credWelcomeTemplate");
  if (!modal || !code || !textarea) return;
  if (label) label.textContent = isTempPass ? "CONTRASEÑA TEMPORAL (1 USO)" : "ENLACE PERSONAL DE ACCESO (72H)";
  code.textContent = secret;
  const msg = isTempPass
    ? `Hola ${name},\n\n• Usuario: ${email}\n• Contraseña temporal: ${secret}\n• Acceso: https://muntru.me/garage`
    : `Hola ${name},\n\n• Usuario: ${email}\n• Enlace personal (72 h): ${secret}\n\nMuntrume Motorsport · muntru.me`;
  textarea.value = msg;
  rcState.lastCredentials = { name, email, secret, msg };
  modal.classList.remove("hidden");
}

function closeCredentialsResultModal() { document.getElementById("credentialsResultModal")?.classList.add("hidden"); }
function copyCredentialSecretOnly() {
  if (!rcState.lastCredentials?.secret) return;
  navigator.clipboard.writeText(rcState.lastCredentials.secret).then(() => showRcNotice("Copiado", "Enlace/clave copiado.", "success"));
}
function copyWelcomeMessageTemplate() {
  if (!rcState.lastCredentials?.msg) return;
  navigator.clipboard.writeText(rcState.lastCredentials.msg).then(() => showRcNotice("Copiado", "Mensaje copiado al portapapeles.", "success"));
}

function renderMailboxesTable() {
  const tbody = document.getElementById("mailboxesTableBody");
  if (!tbody) return;
  tbody.innerHTML = OFFICIAL_MAILBOXES.map((mb) => `
    <tr>
      <td><code>${rcEscape(mb.address)}</code></td>
      <td><span class="rc-strong">${rcEscape(mb.owner)}</span></td>
      <td><span class="rc-badge">${rcEscape(mb.role)}</span></td>
      <td><span class="rc-badge rc-badge--ok">${rcEscape(mb.status)}</span></td>
      <td class="text-right">
        <div class="rc-row-actions">
          <button type="button" class="r-btn r-btn--sm" data-addr="${rcEscape(mb.address)}" onclick="navigator.clipboard.writeText(this.dataset.addr); showRcNotice('Buzón copiado', this.dataset.addr, 'info')">Copiar</button>
          <a href="mailto:${rcEscape(mb.address)}" class="r-btn r-btn--sm">Escribir ↗</a>
        </div>
      </td>
    </tr>
  `).join("");
}

function openEmailPreviewModal(key = "welcome") {
  rcState.currentTemplateKey = EMAIL_TEMPLATES[key] ? key : "welcome";
  const tpl = EMAIL_TEMPLATES[rcState.currentTemplateKey];
  ["welcome", "reset", "code", "temp_password", "nec"].forEach((k) => {
    document.getElementById(`tplBtn-${k}`)?.classList.toggle("is-on", k === rcState.currentTemplateKey);
  });
  const subj = document.getElementById("tplSubjectText");
  const badgeEl = document.getElementById("tplBadgeText");
  const body = document.getElementById("tplBodyText");
  const visualBox = document.getElementById("tplVisualHtmlBox");
  if (subj) subj.textContent = tpl.subject;
  if (badgeEl) badgeEl.textContent = tpl.badge || "RACE CONTROL";
  if (body) body.textContent = tpl.body;
  if (visualBox) {
    const rowsHtml = (tpl.rows || []).map(([k, v]) => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:12.5px">
        <span style="font-family:var(--r-mono);font-size:11px;text-transform:uppercase;color:#94a3b8;font-weight:700">${rcEscape(k)}</span>
        <span style="font-weight:700;color:#f8fafc;text-align:right">${rcEscape(v)}</span>
      </div>`).join("");
    const codeHtml = tpl.codeBox ? `<div style="margin:12px 0;text-align:center"><span style="display:inline-block;padding:10px 22px;border-radius:12px;border:1.5px solid #00e699;background:#061a14;color:#00e699;font-family:var(--r-mono);font-size:24px;font-weight:800;letter-spacing:8px">${rcEscape(tpl.codeBox)}</span></div>` : "";
    visualBox.innerHTML = `
      <div style="max-width:520px;margin:0 auto;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#0f141c">
        <div style="padding:14px 18px;background:#080b10;display:flex;align-items:center;justify-content:space-between">
          <strong style="color:#fff;font-size:13px">MUNTRUME MOTORSPORT · muntru.me</strong>
          <span style="padding:3px 9px;border-radius:999px;background:#062319;border:1px solid #059669;color:#00e699;font-family:var(--r-mono);font-size:10px">${rcEscape(tpl.badge)}</span>
        </div>
        <div style="padding:18px;display:grid;gap:10px">
          <h4 style="margin:0;font-size:17px;color:#fff">${rcEscape(tpl.title)}</h4>
          <p style="margin:0;font-size:12.5px;color:#a7f3d0">${rcEscape(tpl.tldr)}</p>
          ${codeHtml}
          <div style="padding:8px 12px;border-radius:10px;background:#090d13">${rowsHtml}</div>
        </div>
      </div>`;
  }
  document.getElementById("emailTemplateModal")?.classList.remove("hidden");
}

function closeEmailPreviewModal() { document.getElementById("emailTemplateModal")?.classList.add("hidden"); }

async function sendTestEmailFromAdmin() {
  const btn = document.getElementById("btnSendPreviewEmail");
  const tpl = EMAIL_TEMPLATES[rcState.currentTemplateKey] || EMAIL_TEMPLATES.welcome;
  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
  try {
    const data = await rcAdminFetch("/api/setups/admin/email-preview", { only: [tpl.previewKey || "reset"] });
    const resItem = (data.results || [])[0];
    if (resItem?.ok) showRcNotice("Correo de prueba enviado", `Enviado a ${data.to}.`, "success");
    else showRcNotice("Aviso", resItem?.error || "Revisa la configuración de Resend.", "warn");
  } catch (err) {
    showRcNotice("Error", err?.message || "No se pudo enviar la prueba.", "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "🚀 Enviarme prueba real"; }
  }
}

function copyCurrentEmailTemplate() {
  const tpl = EMAIL_TEMPLATES[rcState.currentTemplateKey] || EMAIL_TEMPLATES.welcome;
  navigator.clipboard.writeText(`Asunto: ${tpl.subject}\n\n${tpl.body}`).then(() => showRcNotice("Copiado", "Plantilla copiada.", "success"));
}

function filterAuditLogs(cat) {
  rcState.auditFilter = cat;
  ["all", "auth", "download", "admin"].forEach((c) => {
    document.getElementById(`auditFilter-${c}`)?.classList.toggle("is-on", c === cat);
  });
  renderAuditLogsTable();
}

function renderAuditLogsTable() {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;
  const list = rcState.auditLogs.filter((item) => rcState.auditFilter === "all" ? true : item.category === rcState.auditFilter);
  tbody.innerHTML = list.map((item) => {
    const fmtDate = new Date(item.timestamp).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    return `
      <tr>
        <td style="font-family:var(--r-mono);font-size:12px;white-space:nowrap">${rcEscape(fmtDate)}</td>
        <td><span class="rc-badge">${rcEscape(item.category.toUpperCase())}</span></td>
        <td><code>${rcEscape(item.actor)}</code></td>
        <td>${rcEscape(item.detail)}</td>
        <td><span class="rc-badge rc-badge--ok">${rcEscape(item.status)}</span></td>
      </tr>
    `;
  }).join("");
}

function exportAuditLogsCsv() {
  const rows = [["timestamp", "category", "actor", "detail", "status"], ...rcState.auditLogs.map((l) => [l.timestamp, l.category, l.actor, l.detail, l.status])];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `muntrume_admin_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showRcNotice("Auditoría exportada", "CSV descargado.", "success");
}

async function runStewardBotSweep() {
  const btn = document.getElementById("btnStewardBotSweep");
  const prev = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "🛡 Analizando…"; }
  try {
    const data = await rcAdminFetch("/api/admin/moderation/sweep", {});
    showRcNotice("MMT Steward Bot completado", `Revisados: ${data.scanned ?? 0} · Limpiados: ${data.cleaned ?? 0} · Retirados: ${data.rejected ?? 0}.`, "success");
  } catch (err) {
    showRcNotice("MMT Steward Bot", err?.message || "No se pudo contactar con el bot.", "err");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = prev || "🛡 Pasar Steward Bot"; }
  }
}

// ============================================================================
// INIT, SHORTCUTS, DRAG/DROP & CLIPBOARD PASTE FOR GARAGE 61 SCREENSHOTS
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  if (!verifyAdminSession()) return;
  initDefaultAuditLogs();
  refreshRaceControlData();

  const initialTab = new URLSearchParams(window.location.search).get("tab");
  if (initialTab) switchAdminTab(initialTab);

  const globalSearch = document.getElementById("adminGlobalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("input", () => {
      const q = globalSearch.value.trim();
      const dirInput = document.getElementById("directorySearchInput");
      if (dirInput) {
        dirInput.value = q;
        if (rcState.activeTab !== "overview" && q.length >= 2) switchAdminTab("overview");
        renderDirectoryTable();
      }
    });
  }

  // Drag & drop on Garage 61 dropzone
  const dz = document.getElementById("umG61Dropzone");
  if (dz) {
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.style.borderColor = "var(--r-accent)"; });
    dz.addEventListener("dragleave", () => { dz.style.borderColor = ""; });
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.style.borderColor = "";
      const file = e.dataTransfer?.files?.[0];
      if (file) loadG61ImageFile(file);
    });
  }

  // Paste screenshot with Ctrl+V while modal is open
  document.addEventListener("paste", (e) => {
    const modal = document.getElementById("unifiedPilotModal");
    if (!modal || modal.classList.contains("hidden")) return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          switchUnifiedModalTab("g61");
          loadG61ImageFile(file);
        }
        break;
      }
    }
  });

  document.addEventListener("click", (e) => {
    const pop = document.getElementById("rcRowActionPopover");
    if (!pop || pop.classList.contains("hidden")) return;
    if (!pop.contains(e.target) && e.target !== rcActiveMenuBtn) closeRowActionMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeRowActionMenu();
      closeUnifiedPilotModal();
      closeAddDriverModal();
      closeCredentialsResultModal();
      closeEmailPreviewModal();
    }
    if (e.key === "/" && document.activeElement !== globalSearch && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

  window.addEventListener("scroll", closeRowActionMenu, true);
});

window.addEventListener("pageshow", (event) => {
  if (!verifyAdminSession()) return;
  if (event.persisted) refreshRaceControlData();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") verifyAdminSession();
});

if (typeof window !== "undefined") {
  Object.assign(window, {
    verifyAdminSession,
    secureAdminLogout,
    switchAdminTab,
    refreshRaceControlData,
    filterDirectory,
    renderDirectoryTable,
    openUnifiedPilotModal,
    closeUnifiedPilotModal,
    switchUnifiedModalTab,
    submitUnifiedPilotForm,
    recalcUnifiedPilotStats,
    syncOvrBigFromInput,
    toggleUnifiedStatsAuto,
    handleG61FileSelected,
    analyzeG61Screenshot,
    addG61ListRow,
    updateG61ListRow,
    removeG61ListRow,
    openRowActionMenu,
    closeRowActionMenu,
    openAddDriverModal,
    closeAddDriverModal,
    submitAddDriverForm,
    generateDriverAccessFromBtn,
    approvePendingRequestBtn,
    rejectPendingRequestBtn,
    toggleSetupAccessBtn,
    toggleMemberStatusBtn,
    deleteMemberBtn,
    revokePilotSessionsBtn,
    runQuickCredentialAction,
    openCredentialsResultModal,
    closeCredentialsResultModal,
    copyCredentialSecretOnly,
    copyWelcomeMessageTemplate,
    openEmailPreviewModal,
    closeEmailPreviewModal,
    sendTestEmailFromAdmin,
    copyCurrentEmailTemplate,
    filterAuditLogs,
    exportAuditLogsCsv,
    runStewardBotSweep,
    showRcNotice,
    hideRcNotice
  });
}
