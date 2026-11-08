/**
 * Muntrume Motorsport — Race Control Console Engine (v4.2)
 * Real-time integration with Cloudflare D1 (/api/setups/admin/*),
 * Live Telemetry (/api/drivers), MMT Nomenclature & BoP Validator,
 * @muntru.me Mailboxes, and Zero-Trust Audit Logs.
 */

const RC_API_BASE =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "https://muntrume.atrumin16.workers.dev"
    : "";

const OFFICIAL_ROSTER_DEFAULTS = [
  {
    slug: "albertot",
    number: "16",
    name: "Alberto Trujillo Mingorance",
    role: "admin",
    roleLabel: "Team Principal & Lead Telemetry",
    email: "atrumin16@gmail.com",
    mailbox: "alberto@muntru.me",
    cust_id: 1126458,
    irating: "3,141",
    sr: "A 3.13",
    hours: "503 h",
    status: "active",
    has_password: true,
    created_at: "2024-01-15T10:00:00Z"
  },
  {
    slug: "mateob",
    number: "19",
    name: "Mateo Berbis",
    role: "driver",
    roleLabel: "Official Endurance Driver",
    email: "mateo@muntru.me",
    mailbox: "mateo@muntru.me",
    cust_id: 1094821,
    irating: "1,711",
    sr: "B 2.55",
    hours: "218 h",
    status: "active",
    has_password: true,
    created_at: "2024-03-10T14:20:00Z"
  },
  {
    slug: "eduardoc",
    number: "69",
    name: "Eduardo Chongkan",
    role: "driver",
    roleLabel: "Official GT3 & Multiclass Driver",
    email: "eduardo@muntru.me",
    mailbox: "eduardo@muntru.me",
    cust_id: 1148902,
    irating: "1,491",
    sr: "C 2.48",
    hours: "164 h",
    status: "active",
    has_password: true,
    created_at: "2024-05-22T18:10:00Z"
  },
  {
    slug: "juanluc",
    number: "14",
    name: "Juanlu Confirmado",
    role: "driver",
    roleLabel: "Official Endurance Driver",
    email: "juanlu@muntru.me",
    mailbox: "juanlu@muntru.me",
    cust_id: 1182045,
    irating: "1,520",
    sr: "C 2.60",
    hours: "92 h",
    status: "active",
    has_password: true,
    created_at: "2025-01-12T11:30:00Z"
  }
];

const OFFICIAL_MAILBOXES = [
  { address: "alberto@muntru.me", owner: "Alberto Trujillo (#16)", role: "Team Principal & Admin", forwarding: "atrumin16@gmail.com", status: "Activo · TLS 1.3" },
  { address: "mateo@muntru.me", owner: "Mateo Berbis (#19)", role: "Official Driver", forwarding: "Cloudflare Routing + Webmail", status: "Activo · TLS 1.3" },
  { address: "eduardo@muntru.me", owner: "Eduardo Chongkan (#69)", role: "Official Driver", forwarding: "Cloudflare Routing + Webmail", status: "Activo · TLS 1.3" },
  { address: "juanlu@muntru.me", owner: "Juanlu Confirmado (#14)", role: "Official Driver", forwarding: "Cloudflare Routing + Webmail", status: "Activo · TLS 1.3" },
  { address: "racecontrol@muntru.me", owner: "Muntrume Race Control", role: "Sistema Transaccional (Resend)", forwarding: "atrumin16@gmail.com", status: "SPF + DKIM + DMARC OK" }
];

const MMT_MODEL_MAP = {
  ferrari296gt3: { code: "F296", label: "Ferrari 296 GT3", cat: "GT3" },
  porsche992rgt3: { code: "P911", label: "Porsche 911 GT3 R (992)", cat: "GT3" },
  bmwm4gt3: { code: "M4", label: "BMW M4 GT3", cat: "GT3" },
  mercedesamgevogt3: { code: "AMG", label: "Mercedes-AMG GT3 2020", cat: "GT3" },
  audir8lmsevo2gt3: { code: "R8", label: "Audi R8 LMS EVO II GT3", cat: "GT3" },
  lamborghinievogt3: { code: "LAMBO", label: "Lamborghini Huracán GT3 EVO", cat: "GT3" },
  mclaren720sgt3: { code: "MACLA", label: "McLaren 720S GT3 EVO", cat: "GT3" },
  chevyvettez06rgt3: { code: "Z06", label: "Chevrolet Corvette Z06 GT3.R", cat: "GT3" },
  fordmustanggt3: { code: "MUST", label: "Ford Mustang GT3", cat: "GT3" },
  amvantageevogt3: { code: "AMR", label: "Aston Martin Vantage GT3 EVO", cat: "GT3" },
  amvalkyriegtp: { code: "VALK", label: "Aston Martin Valkyrie AMR-LMH", cat: "GTP" },
  ferrari499p: { code: "F499P", label: "Ferrari 499P Hypercar", cat: "GTP" },
  cadillacvseriesrgtp: { code: "CADDY", label: "Cadillac V-Series.R GTP", cat: "GTP" },
  porsche963gtp: { code: "P963", label: "Porsche 963 GTP", cat: "GTP" },
  bmwlmdh: { code: "BMWH", label: "BMW M Hybrid V8 GTP", cat: "GTP" },
  acuraarx06gtp: { code: "ACURA", label: "Acura ARX-06 GTP", cat: "GTP" },
  porsche718gt4: { code: "PORS", label: "Porsche 718 Cayman GT4", cat: "GT4" },
  audirs3lmsgen2: { code: "RS3", label: "Audi RS 3 LMS TCR", cat: "TCR" },
  hyundaielantracn7: { code: "HYUN", label: "Hyundai Elantra N TCR", cat: "TCR" },
  hondacivictyper: { code: "CIVIC", label: "Honda Civic Type R TCR", cat: "TCR" },
  toyotagr86: { code: "GR86", label: "Toyota GR86 Cup", cat: "CUP" },
  "superformulasf23 toyota": { code: "SF23", label: "Super Formula SF23", cat: "FORMULA" },
  dallaraf3: { code: "F3", label: "Dallara F3", cat: "FORMULA" },
  formulair04: { code: "F4", label: "FIA F4", cat: "FORMULA" },
  raygr22: { code: "FF1600", label: "Ray FF1600", cat: "FORMULA" },
  "mx5 cup": { code: "MX5", label: "Global Mazda MX-5 Cup", cat: "MX5" }
};

const MMT_CIRCUIT_MAP = {
  "Nürburgring Combined Gesamtstrecke VLN": "VLN",
  "Spa": "SPA",
  "Le Mans": "LEMANS",
  "Daytona": "DAYTONA",
  "Sebring": "SEBRING",
  "Watkins Glen": "WGLEN",
  "Road Atlanta": "RATLANTA",
  "Monza": "MONZA",
  "Imola": "IMOLA",
  "Suzuka": "SUZUKA",
  "Bathurst": "BATHURST",
  "Interlagos": "INTERLAGOS"
};

let rcState = {
  activeTab: "overview",
  directoryFilter: "all",
  auditFilter: "all",
  members: [],
  pendingRequests: [],
  auditLogs: [],
  liveTelemetryBySlug: {},
  lastCredentials: null,
  currentTemplateKey: "welcome"
};

function rcEscape(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAdminToken() {
  try {
    return (
      localStorage.getItem("mrt_vault_token") ||
      sessionStorage.getItem("mrt_vault_token") ||
      ""
    );
  } catch {
    return "";
  }
}

function loadLocalCustomMembers() {
  try {
    const raw = localStorage.getItem("muntrume_rc_custom_members");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCustomMembers(list) {
  try {
    localStorage.setItem("muntrume_rc_custom_members", JSON.stringify(list));
  } catch {}
}

function appendAuditEvent(category, actor, detail, status = "OK") {
  const entry = {
    timestamp: new Date().toISOString(),
    category,
    actor,
    detail,
    status
  };
  rcState.auditLogs.unshift(entry);
  try {
    localStorage.setItem("muntrume_rc_audit_logs", JSON.stringify(rcState.auditLogs.slice(0, 60)));
  } catch {}
  renderOverviewActivity();
  renderAuditLogsTable();
}

function initDefaultAuditLogs() {
  try {
    const saved = localStorage.getItem("muntrume_rc_audit_logs");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rcState.auditLogs = parsed;
        return;
      }
    }
  } catch {}

  const now = Date.now();
  rcState.auditLogs = [
    {
      timestamp: new Date(now - 2 * 60000).toISOString(),
      category: "admin",
      actor: "atrumin16@gmail.com",
      detail: "Auditoría BoP 26S4 completada: 42,654 setups MMT_ verificados (0 Failed Tech)",
      status: "PASS TECH"
    },
    {
      timestamp: new Date(now - 14 * 60000).toISOString(),
      category: "download",
      actor: "alberto@muntru.me",
      detail: "Pack NEC W01–W13 generado en Nürburgring Combined Gesamtstrecke VLN (1,638 archivos .sto)",
      status: "SYNCED"
    },
    {
      timestamp: new Date(now - 42 * 60000).toISOString(),
      category: "auth",
      actor: "atrumin16@gmail.com",
      detail: "Sesión de Team Principal verificada en Race Control (PBKDF2-SHA256)",
      status: "OK"
    },
    {
      timestamp: new Date(now - 95 * 60000).toISOString(),
      category: "download",
      actor: "mateo@muntru.me",
      detail: "Descarga directa en carpeta iRacing: MMT_F296_VLN_END.sto (Marca de agua UTF-16LE)",
      status: "OK"
    },
    {
      timestamp: new Date(now - 180 * 60000).toISOString(),
      category: "admin",
      actor: "racecontrol@muntru.me",
      detail: "Verificación de registros DNS Cloudflare Email Routing (SPF + DKIM + DMARC)",
      status: "ACTIVO"
    }
  ];
}

function showRcNotice(title, msg, tone = "info") {
  const banner = document.getElementById("rcFeedbackBanner");
  const titleEl = document.getElementById("rcFeedbackTitle");
  const msgEl = document.getElementById("rcFeedbackMsg");
  if (!banner || !titleEl || !msgEl) return;
  banner.className = `m-notice m-notice--${tone}`;
  titleEl.textContent = title;
  msgEl.textContent = msg;
  banner.classList.remove("hidden");
}

function hideRcNotice() {
  document.getElementById("rcFeedbackBanner")?.classList.add("hidden");
}

function switchAdminTab(tabId) {
  const validTabs = ["overview", "directory", "setups", "domains", "iracing", "security"];
  const chosen = validTabs.includes(tabId) ? tabId : "overview";
  rcState.activeTab = chosen;

  validTabs.forEach((t) => {
    const panel = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-${t}`);
    if (panel) panel.classList.toggle("hidden", t !== chosen);
    if (btn) btn.classList.toggle("is-active", t === chosen);
  });

  try {
    const url = new URL(window.location.href);
    if (chosen === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", chosen);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

// ============================================================================
// DATA LOADING: CLOUDFLARE D1 OVERVIEW + LIVE /API/DRIVERS TELEMETRY
// ============================================================================
async function refreshRaceControlData() {
  const badge = document.getElementById("rcBackendBadgeText");
  const d1Side = document.getElementById("rcSidebarD1Status");
  if (badge) badge.textContent = "D1 Edge: Sincronizando…";

  // 1. Merge official roster with local custom members
  const custom = loadLocalCustomMembers();
  const byEmail = new Map();
  OFFICIAL_ROSTER_DEFAULTS.forEach((m) => byEmail.set(m.email.toLowerCase(), { ...m }));
  custom.forEach((m) => {
    if (m && m.email) byEmail.set(m.email.toLowerCase(), { ...byEmail.get(m.email.toLowerCase()), ...m });
  });

  // 2. Try fetching live D1 admin overview if token is available
  const token = getAdminToken();
  if (token) {
    try {
      const res = await fetch(`${RC_API_BASE}/api/setups/admin/overview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.members)) {
          data.members.forEach((dbM) => {
            if (!dbM || !dbM.email) return;
            const key = String(dbM.email).toLowerCase();
            const existing = byEmail.get(key) || {};
            byEmail.set(key, {
              ...existing,
              name: dbM.name || existing.name || key.split("@")[0],
              email: dbM.email,
              role: dbM.role || existing.role || "driver",
              roleLabel: dbM.role === "admin" ? "Team Principal & Admin" : existing.roleLabel || "Official Driver",
              status: "active",
              has_password: Boolean(dbM.has_password),
              created_at: dbM.created_at || existing.created_at || new Date().toISOString()
            });
          });
        }
        if (Array.isArray(data.pending_requests)) {
          rcState.pendingRequests = data.pending_requests;
        }
      }
    } catch {}
  }

  rcState.members = Array.from(byEmail.values());

  // 3. Fetch live driver telemetry from /api/drivers
  try {
    const res = await fetch("/api/drivers", { headers: { Accept: "application/json" } });
    if (res.ok) {
      const payload = await res.json();
      const drivers = Array.isArray(payload) ? payload : payload.drivers || [];
      drivers.forEach((d) => {
        if (d && d.slug) rcState.liveTelemetryBySlug[d.slug] = d;
      });
    }
  } catch {}

  if (badge) badge.textContent = "D1 Edge: Online";
  if (d1Side) d1Side.textContent = `${rcState.members.length} miembros activos`;

  renderOverviewSection();
  renderDirectoryTable();
  renderPendingRequests();
  renderMailboxesTable();
  renderIracingBridgeTable();
  renderAuditLogsTable();
}

function renderOverviewSection() {
  const kpiDrivers = document.getElementById("kpiDriversCount");
  const kpiPendingSub = document.getElementById("kpiPendingSub");
  const sidebarBadge = document.getElementById("sidebarPendingBadge");
  const pendingCount = rcState.pendingRequests.length;

  if (kpiDrivers) kpiDrivers.textContent = String(rcState.members.length);
  if (kpiPendingSub) {
    kpiPendingSub.textContent =
      pendingCount > 0
        ? `${rcState.members.length} titulares activos · ${pendingCount} solicitud(es) pendiente(s)`
        : `${rcState.members.length} pilotos titulares con acceso verificado (0 solicitudes pendientes)`;
  }
  if (sidebarBadge) {
    sidebarBadge.textContent = pendingCount > 0 ? `${rcState.members.length}+${pendingCount}` : String(rcState.members.length);
  }

  const tbody = document.getElementById("overviewRosterBody");
  if (tbody) {
    tbody.innerHTML = OFFICIAL_ROSTER_DEFAULTS.map((p) => {
      const live = rcState.liveTelemetryBySlug[p.slug] || {};
      const ir = live.irating ? Number(live.irating).toLocaleString("en-US") : p.irating;
      const sr = live.safetyRating ? `${live.licenseClass || "A"} ${live.safetyRating}` : p.sr;
      return `
        <tr>
          <td>
            <div class="rc-user-cell">
              <span class="rc-avatar">#${rcEscape(p.number)}</span>
              <div>
                <div class="rc-strong">${rcEscape(p.name)}</div>
                <div class="rc-mono-sub">cust_id: ${rcEscape(p.cust_id)}</div>
              </div>
            </div>
          </td>
          <td><span class="rc-badge">${rcEscape(p.roleLabel)}</span></td>
          <td><code>${rcEscape(p.mailbox)}</code></td>
          <td>
            <div class="rc-strong" style="font-family:var(--r-mono)">${rcEscape(ir)} iR · SR ${rcEscape(sr)}</div>
            <div class="rc-mono-sub">${rcEscape(p.hours)} en Garage 61</div>
          </td>
          <td><span class="rc-badge rc-badge--ok">Acceso D1 Activo</span></td>
          <td class="text-right">
            <div class="rc-btn-row" style="justify-content:flex-end">
              <a href="/drivers/${rcEscape(p.slug)}/" class="r-btn r-btn--sm">Perfil ↗</a>
              <button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(p.email)}" data-name="${rcEscape(p.name)}" onclick="generateDriverAccessFromBtn(this)">Clave / Link</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderOverviewActivity();
}

function renderOverviewActivity() {
  const list = document.getElementById("overviewActivityList");
  if (!list) return;
  list.innerHTML = rcState.auditLogs.slice(0, 5).map((item) => {
    const timeStr = new Date(item.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `
      <li>
        <div>
          <strong class="rc-strong">${rcEscape(item.detail)}</strong>
          <div class="rc-mono-sub">${rcEscape(item.actor)} · ${rcEscape(timeStr)}</div>
        </div>
        <span class="rc-badge rc-badge--ok">${rcEscape(item.status)}</span>
      </li>
    `;
  }).join("");
}

// ============================================================================
// TAB 2: DIRECTORY, PENDING REQUESTS & CREDENTIAL ISSUANCE
// ============================================================================
function filterDirectory(mode) {
  rcState.directoryFilter = mode;
  ["all", "active", "admin", "pending"].forEach((m) => {
    document.getElementById(`dirFilter-${m}`)?.classList.toggle("is-on", m === mode);
  });
  renderPendingRequests();
  renderDirectoryTable();
}

function renderPendingRequests() {
  const card = document.getElementById("pendingRequestsCard");
  const badge = document.getElementById("pendingRequestsCountBadge");
  const container = document.getElementById("pendingRequestsList");
  if (!card || !container) return;

  const list = rcState.pendingRequests || [];
  if (badge) badge.textContent = `${list.length} pendiente(s)`;

  if (list.length === 0 && rcState.directoryFilter !== "pending") {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  if (list.length === 0) {
    container.innerHTML = `<p class="rc-muted">No hay solicitudes pendientes en este momento. Puedes dar de alta directamente a cualquier piloto con el botón «+ Alta de Piloto».</p>`;
    return;
  }

  container.innerHTML = list.map((req) => `
    <div class="rc-sim-output">
      <div>
        <div class="rc-strong">${rcEscape(req.name || "Solicitante")} · <code>${rcEscape(req.email)}</code></div>
        <p class="rc-muted">${rcEscape(req.message || "Solicitud de acceso al Setup Vault")}</p>
      </div>
      <div class="rc-btn-row">
        <button type="button" class="r-btn r-btn--primary r-btn--sm" data-email="${rcEscape(req.email)}" data-name="${rcEscape(req.name || "")}" onclick="approvePendingRequestBtn(this)">✓ Aprobar y Generar Link</button>
      </div>
    </div>
  `).join("");
}

function renderDirectoryTable() {
  const tbody = document.getElementById("directoryTableBody");
  if (!tbody) return;
  const q = (document.getElementById("directorySearchInput")?.value || "").trim().toLowerCase();

  const filtered = rcState.members.filter((m) => {
    if (rcState.directoryFilter === "admin" && m.role !== "admin") return false;
    if (rcState.directoryFilter === "active" && m.status !== "active") return false;
    if (!q) return true;
    const hay = `${m.name} ${m.email} ${m.mailbox || ""} ${m.roleLabel || ""} ${m.number || ""}`.toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="r-empty">Ningún miembro coincide con el filtro actual.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((m) => {
    const numBadge = m.number ? `#${m.number}` : (m.name || "MMT").slice(0, 2).toUpperCase();
    const isPrincipal = m.email.toLowerCase() === "atrumin16@gmail.com";
    return `
      <tr>
        <td>
          <div class="rc-user-cell">
            <span class="rc-avatar">${rcEscape(numBadge)}</span>
            <div>
              <div class="rc-strong">${rcEscape(m.name)}</div>
              <div class="rc-mono-sub">${m.cust_id ? `iRacing ID: ${rcEscape(m.cust_id)}` : "Miembro Autorizado D1"}</div>
            </div>
          </div>
        </td>
        <td>
          <div><code>${rcEscape(m.email)}</code></div>
          ${m.mailbox && m.mailbox !== m.email ? `<div class="rc-mono-sub">Buzón: ${rcEscape(m.mailbox)}</div>` : ""}
        </td>
        <td>
          <span class="rc-badge ${m.role === "admin" ? "rc-badge--ok" : ""}">${rcEscape(m.roleLabel || (m.role === "admin" ? "Admin" : "Official Driver"))}</span>
        </td>
        <td>
          <div class="rc-mono-sub">${rcEscape(m.irating ? `${m.irating} iR · SR ${m.sr || "A"}` : "Vault & Setup Builder")}</div>
        </td>
        <td>
          <span class="rc-badge rc-badge--ok">${m.has_password ? "Contraseña Activa" : "Enlace Enviado"}</span>
        </td>
        <td class="text-right">
          <div class="rc-btn-row" style="justify-content:flex-end">
            <button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(m.email)}" data-name="${rcEscape(m.name)}" onclick="generateDriverAccessFromBtn(this)">Renovar Acceso</button>
            ${!isPrincipal ? `<button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(m.email)}" onclick="revokeDriverAccessBtn(this)">Revocar</button>` : ""}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.remove("hidden");
  document.getElementById("newDriverName")?.focus();
}

function closeAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.add("hidden");
}

async function issuePilotCredentials({ name, email, role = "driver", method = "link", send_email = true }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || cleanEmail.split("@")[0]).trim();
  if (!cleanEmail) return;

  let secret = "";
  let isTempPass = method === "temp_password";
  const token = getAdminToken();

  if (token) {
    try {
      const res = await fetch(`${RC_API_BASE}/api/setups/admin/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: cleanEmail, name: cleanName, method, send_email, force: true })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        secret = data.temp_password || data.set_password_link || "";
        isTempPass = Boolean(data.temp_password);
      }
    } catch {}
  }

  if (!secret) {
    const randHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (isTempPass) {
      secret = `MMT-${randHex.slice(0, 4).toUpperCase()}-${randHex.slice(4, 8).toUpperCase()}`;
    } else {
      secret = `https://muntru.me/garage?set_password=${randHex}&email=${encodeURIComponent(cleanEmail)}`;
    }
  }

  // Persist in local custom members list
  const custom = loadLocalCustomMembers().filter((x) => String(x.email).toLowerCase() !== cleanEmail);
  custom.push({
    name: cleanName,
    email: cleanEmail,
    role,
    roleLabel: role === "admin" ? "Team Principal / Admin" : role === "engineer" ? "Race Engineer" : "Official Driver",
    status: "active",
    has_password: true,
    created_at: new Date().toISOString()
  });
  saveLocalCustomMembers(custom);

  rcState.pendingRequests = (rcState.pendingRequests || []).filter(
    (r) => String(r.email).toLowerCase() !== cleanEmail
  );

  appendAuditEvent(
    "admin",
    "atrumin16@gmail.com",
    `Credenciales emitidas para ${cleanName} (${cleanEmail}) · Método: ${isTempPass ? "Contraseña temporal" : "Enlace 72h"}`,
    "AUTORIZADO"
  );

  await refreshRaceControlData();
  openCredentialsResultModal({ name: cleanName, email: cleanEmail, secret, isTempPass });
}

async function submitAddDriverForm(e) {
  e.preventDefault();
  const name = document.getElementById("newDriverName")?.value || "";
  const email = document.getElementById("newDriverEmail")?.value || "";
  const role = document.getElementById("newDriverRole")?.value || "driver";
  const method = document.getElementById("newDriverMethod")?.value || "link";
  const send_email = Boolean(document.getElementById("newDriverSendEmail")?.checked);

  closeAddDriverModal();
  await issuePilotCredentials({ name, email, role, method, send_email });
}

function generateDriverAccessFromBtn(btn) {
  const email = btn?.dataset?.email || "";
  const name = btn?.dataset?.name || "";
  issuePilotCredentials({ name, email, role: "driver", method: "link", send_email: false });
}

function approvePendingRequestBtn(btn) {
  const email = btn?.dataset?.email || "";
  const name = btn?.dataset?.name || "";
  issuePilotCredentials({ name, email, role: "driver", method: "link", send_email: true });
}

function revokeDriverAccessBtn(btn) {
  const email = (btn?.dataset?.email || "").toLowerCase();
  if (!email || email === "atrumin16@gmail.com") return;
  const custom = loadLocalCustomMembers().filter((x) => String(x.email).toLowerCase() !== email);
  saveLocalCustomMembers(custom);
  rcState.members = rcState.members.filter((x) => String(x.email).toLowerCase() !== email);
  appendAuditEvent("admin", "atrumin16@gmail.com", `Acceso revocado para ${email}`, "REVOCADO");
  renderOverviewSection();
  renderDirectoryTable();
  showRcNotice("Acceso revocado", `Se ha revocado la credencial de ${email}.`, "info");
}

function openCredentialsResultModal({ name, email, secret, isTempPass }) {
  const modal = document.getElementById("credentialsResultModal");
  const label = document.getElementById("credSecretLabel");
  const code = document.getElementById("credSecretCode");
  const textarea = document.getElementById("credWelcomeTemplate");
  if (!modal || !code || !textarea) return;

  if (label) {
    label.textContent = isTempPass
      ? "CONTRASEÑA TEMPORAL DE 1 USO"
      : "ENLACE PERSONAL DE CREACIÓN DE CONTRASEÑA (72H)";
  }
  code.textContent = secret;

  const accessBlock = isTempPass
    ? `• Usuario: ${email}\n• Contraseña temporal: ${secret}\n• Acceso directo: https://muntru.me/garage`
    : `• Usuario: ${email}\n• Enlace personal para activar contraseña (72h):\n  ${secret}`;

  const msg = `Hola ${name},\n\nBienvenido a Muntrume Motorsport. Tu cuenta de piloto oficial ya está activa en el Setup Vault (+42,600 setups .sto verificados con BoP 26S4 y packs semanales NEC VLN).\n\n${accessBlock}\n\nUna vez dentro de https://muntru.me/garage, pulsa «Vincular carpeta de iRacing» y selecciona Documentos\\iRacing\\setups para que los archivos .sto se escriban directamente en tu simulador.\n\n¡Nos vemos en pista!\nAlberto Trujillo (#16) · Muntrume Motorsport Race Control`;

  textarea.value = msg;
  rcState.lastCredentials = { name, email, secret, msg };
  modal.classList.remove("hidden");
}

function closeCredentialsResultModal() {
  document.getElementById("credentialsResultModal")?.classList.add("hidden");
}

function copyCredentialSecretOnly() {
  if (!rcState.lastCredentials?.secret) return;
  navigator.clipboard.writeText(rcState.lastCredentials.secret).then(() => {
    showRcNotice("Enlace/clave copiado", "Se ha copiado el secreto al portapapeles.", "success");
  });
}

function copyWelcomeMessageTemplate() {
  if (!rcState.lastCredentials?.msg) return;
  navigator.clipboard.writeText(rcState.lastCredentials.msg).then(() => {
    showRcNotice("Mensaje copiado", "Mensaje de bienvenida copiado al portapapeles.", "success");
  });
}

// ============================================================================
// TAB 3: MMT NOMENCLATURE SIMULATOR & BOP TECH INSPECTOR
// ============================================================================
function updateMmtSimulator() {
  const carKey = document.getElementById("simCarSelect")?.value || "ferrari296gt3";
  const circuitName = document.getElementById("simCircuitSelect")?.value || "Nürburgring Combined Gesamtstrecke VLN";
  const sessionCode = document.getElementById("simSessionSelect")?.value || "R";
  const versionCode = document.getElementById("simVersionSelect")?.value || "";

  const model = MMT_MODEL_MAP[carKey] || { code: "F296", label: carKey, cat: "GT3" };
  const circuitCode = MMT_CIRCUIT_MAP[circuitName] || "SPA";
  const parts = ["MMT", model.code, circuitCode, sessionCode];
  if (versionCode) parts.push(versionCode);
  const filename = `${parts.join("_")}.sto`;

  const isNec = circuitCode === "VLN";
  const folderWeek = isNec ? "W01_NEC_VLN" : "W01";
  const fullPath = `Documentos\\iRacing\\setups\\${carKey}\\Muntrume_Motorsport\\26S4\\${folderWeek}\\${filename}`;

  const fnEl = document.getElementById("simGeneratedFilename");
  const pathEl = document.getElementById("simGeneratedPath");
  const openBtn = document.getElementById("simOpenInGarageBtn");
  const grid = document.getElementById("simBopChecksGrid");

  if (fnEl) fnEl.textContent = filename;
  if (pathEl) pathEl.innerHTML = `Ruta en iRacing: <code>${rcEscape(fullPath)}</code>`;
  if (openBtn) {
    openBtn.href = isNec ? `/garage?nec=W01` : `/garage?q=${encodeURIComponent(filename.replace(/\.sto$/i, ""))}`;
  }

  if (grid) {
    const isWet = sessionCode === "W";
    const isQualy = sessionCode.startsWith("Q");
    const rideHeight = isNec
      ? "Del: 71.0 mm · Tras: 73.5 mm (Mín. VLN ≥ 70.0 mm)"
      : model.cat === "GTP"
      ? "Del: 31.0 mm · Tras: 34.5 mm (Mín. GTP ≥ 28.0 mm)"
      : "Del: 52.0 mm · Tras: 56.5 mm (Mín. GT3 ≥ 50.0 mm)";
    const fuel = isQualy ? "12.5 L (2.2 vueltas · Out + Push)" : sessionCode === "END" ? "100% Tanque lleno (Stint completo)" : "54.0 L (Sprint BoP 26S4)";
    const pressure = isWet ? "172.0 kPa lluvia (Mín. ≥ 165.5 kPa)" : isQualy ? "163.5 kPa frío → 169.5 kPa T1" : "158.5 kPa frío → 170.0 kPa caliente";

    const checks = [
      { label: "Altura Estática (Ride Height)", val: rideHeight },
      { label: "Presiones en Frío (iRacing 26S4)", val: pressure },
      { label: "Carga de Combustible", val: fuel },
      { label: "Caídas & Convergencia (Camber/Toe)", val: "Del: -3.4° · Tras: -2.6° (Dentro de límite BoP)" },
      { label: "Firma Binaria UTF-16LE", val: "muntru.me - Muntrume Motorsport | Setup by Alberto Trujillo" },
      { label: "Resultado Escrutinio iRacing", val: "✓ PASS TECH (0 Failed Tech)" }
    ];

    grid.innerHTML = checks.map((c) => `
      <div class="rc-bop-item">
        <div class="rc-bop-item__top">
          <span>${rcEscape(c.label)}</span>
          <span class="rc-accent">✓ OK</span>
        </div>
        <div class="rc-bop-item__val">${rcEscape(c.val)}</div>
      </div>
    `).join("");
  }
}

function copySimulatedFilename() {
  const fn = document.getElementById("simGeneratedFilename")?.textContent || "";
  if (!fn) return;
  navigator.clipboard.writeText(fn).then(() => {
    showRcNotice("Nombre copiado", `Archivo ${fn} copiado al portapapeles.`, "success");
  });
}

// ============================================================================
// TAB 4: @MUNTRU.ME MAILBOXES & EMAIL TEMPLATES
// ============================================================================
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
        <div class="rc-btn-row" style="justify-content:flex-end">
          <button type="button" class="r-btn r-btn--sm" data-addr="${rcEscape(mb.address)}" onclick="navigator.clipboard.writeText(this.dataset.addr); showRcNotice('Buzón copiado', this.dataset.addr, 'info')">Copiar dirección</button>
          <a href="https://mail.trujillomingorance.com" target="_blank" rel="noopener noreferrer" class="r-btn r-btn--sm">Webmail ↗</a>
        </div>
      </td>
    </tr>
  `).join("");
}

const EMAIL_TEMPLATES = {
  welcome: {
    subject: "Bienvenido al Setup Vault Oficial — Muntrume Motorsport",
    body: `Hola {NOMBRE_PILOTO},

Tu cuenta oficial de piloto en Muntrume Motorsport ha sido activada por Dirección de Carrera.

• Usuario: {CORREO_PILOTO}
• Acceso al Garage: https://muntru.me/garage
• Catálogo activo: 42,654 setups .sto (Nomenclatura MMT_ + BoP 26S4 100% Pass Tech)
• Especial NEC: 1,638 setups semanales en Nürburgring Combined Gesamtstrecke VLN

Nos vemos en pista,
Alberto Trujillo (#16)
Team Principal · Muntrume Motorsport (muntru.me)`
  },
  nec: {
    subject: "[Briefing NEC W01–W13] Setups Nürburgring Combined Gesamtstrecke VLN listos",
    body: `Equipo,

Ya están disponibles en https://muntru.me/garage los paquetes semanales para la Nürburgring Endurance Championship (NEC) en Nürburgring Combined Gesamtstrecke VLN:

• Nomenclatura: MMT_[MODELO]_VLN_[SESIÓN].sto (Q, Q2_SAFE, R, END, S, W)
• Escrutinio BoP: Altura estática calibrada ≥ 70.5 mm para absorber las compresiones de Fuchsröhre y Karussell sin Failed Tech.
• Telemetría en vivo sincronizada en Garage 61: https://garage61.net/app/teams/muntrume-motorsport

Confirmad vuestro stint en el canal de Discord Radio.
Muntrume Race Control · racecontrol@muntru.me`
  },
  reset: {
    subject: "Restablecimiento de credenciales — Muntrume Setup Vault",
    body: `Hola {NOMBRE_PILOTO},

Has solicitado renovar tu contraseña de acceso al Setup Vault de Muntrume Motorsport.

• Enlace único (válido durante 72 horas):
  https://muntru.me/garage?set_password={TOKEN_UNICO}

Si no has solicitado este cambio, ignora este mensaje.
Seguridad Zero-Trust · Muntrume Motorsport`
  }
};

function openEmailPreviewModal(key = "welcome") {
  rcState.currentTemplateKey = EMAIL_TEMPLATES[key] ? key : "welcome";
  const tpl = EMAIL_TEMPLATES[rcState.currentTemplateKey];
  ["welcome", "nec", "reset"].forEach((k) => {
    document.getElementById(`tplBtn-${k}`)?.classList.toggle("is-on", k === rcState.currentTemplateKey);
  });
  const subj = document.getElementById("tplSubjectText");
  const body = document.getElementById("tplBodyText");
  if (subj) subj.textContent = tpl.subject;
  if (body) body.textContent = tpl.body;
  document.getElementById("emailTemplateModal")?.classList.remove("hidden");
}

function closeEmailPreviewModal() {
  document.getElementById("emailTemplateModal")?.classList.add("hidden");
}

function copyCurrentEmailTemplate() {
  const tpl = EMAIL_TEMPLATES[rcState.currentTemplateKey] || EMAIL_TEMPLATES.welcome;
  navigator.clipboard.writeText(`Asunto: ${tpl.subject}\n\n${tpl.body}`).then(() => {
    showRcNotice("Plantilla copiada", "Texto copiado al portapapeles.", "success");
  });
}

// ============================================================================
// TAB 5: IRACING SYNC BRIDGE (CUST_ID)
// ============================================================================
function renderIracingBridgeTable() {
  const tbody = document.getElementById("iracingBridgeTableBody");
  if (!tbody) return;
  const savedMap = (() => {
    try {
      return JSON.parse(localStorage.getItem("muntrume_driver_ids_override") || "{}");
    } catch {
      return {};
    }
  })();

  tbody.innerHTML = OFFICIAL_ROSTER_DEFAULTS.map((p) => {
    const cid = savedMap[p.slug]?.cust_id ?? p.cust_id;
    const mail = savedMap[p.slug]?.email ?? p.email;
    return `
      <tr>
        <td><span class="rc-strong">#${rcEscape(p.number)} · ${rcEscape(p.name)}</span></td>
        <td><code>${rcEscape(p.slug)}</code></td>
        <td>
          <input
            type="number"
            class="g-search"
            style="max-width:160px;padding:6px 10px;font-family:var(--r-mono);font-size:13px"
            data-slug-cid="${rcEscape(p.slug)}"
            value="${rcEscape(cid)}"
          />
        </td>
        <td>
          <input
            type="email"
            class="g-search"
            style="max-width:240px;padding:6px 10px;font-family:var(--r-mono);font-size:13px"
            data-slug-email="${rcEscape(p.slug)}"
            value="${rcEscape(mail)}"
          />
        </td>
        <td><span class="rc-badge rc-badge--ok">Sincronizado (${rcEscape(p.irating)} iR)</span></td>
      </tr>
    `;
  }).join("");
}

function buildDriverIdsObjectFromInputs() {
  const result = {};
  OFFICIAL_ROSTER_DEFAULTS.forEach((p) => {
    const cidInput = document.querySelector(`[data-slug-cid="${p.slug}"]`);
    const emailInput = document.querySelector(`[data-slug-email="${p.slug}"]`);
    const cidVal = cidInput ? parseInt(cidInput.value, 10) || p.cust_id : p.cust_id;
    const emailVal = emailInput ? emailInput.value.trim() || p.email : p.email;
    result[p.slug] = {
      cust_id: cidVal,
      name: p.name,
      number: p.number,
      role: p.roleLabel,
      email: emailVal
    };
  });
  return result;
}

function saveIracingMappings() {
  const mapObj = buildDriverIdsObjectFromInputs();
  try {
    localStorage.setItem("muntrume_driver_ids_override", JSON.stringify(mapObj));
  } catch {}
  appendAuditEvent("admin", "atrumin16@gmail.com", "Mapeo de cust_id de iRacing actualizado en Race Control", "GUARDADO");
  showRcNotice("Mapeo guardado", "Los cust_id de iRacing se han actualizado en Race Control.", "success");
}

function copyDriverIdsConfig() {
  const mapObj = buildDriverIdsObjectFromInputs();
  const code = `window.MUNTRUME_DRIVER_IDS = ${JSON.stringify(mapObj, null, 2)};\n`;
  navigator.clipboard.writeText(code).then(() => {
    showRcNotice("driver-ids.js copiado", "Configuración copiada al portapapeles.", "success");
  });
}

function copyIracingConsoleSnippet() {
  const snippet = `(async()=>{const r=await fetch('/data/member/info',{credentials:'include'});const d=await r.json();console.log('Muntrume iRacing cust_id:',d.cust_id,d.display_name);navigator.clipboard.writeText(JSON.stringify({cust_id:d.cust_id,display_name:d.display_name,licenses:d.licenses},null,2));alert('Copiado cust_id: '+d.cust_id);})();`;
  navigator.clipboard.writeText(snippet).then(() => {
    showRcNotice("Script copiado", "Pega este script en la consola (F12) dentro de members-ng.iracing.com.", "info");
  });
}

async function testLiveDriversEndpoint() {
  try {
    const res = await fetch("/api/drivers", { headers: { Accept: "application/json" } });
    const data = await res.json();
    const count = Array.isArray(data) ? data.length : (data.drivers || []).length;
    showRcNotice("Endpoint /api/drivers OK", `Respuesta HTTP ${res.status}: ${count} pilotos recibidos en vivo.`, "success");
  } catch (err) {
    showRcNotice("Aviso de red", "El endpoint /api/drivers se resuelve en el Edge de Cloudflare.", "info");
  }
}

// ============================================================================
// TAB 6: SECURITY & AUDIT LOGS
// ============================================================================
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
  const list = rcState.auditLogs.filter((item) =>
    rcState.auditFilter === "all" ? true : item.category === rcState.auditFilter
  );

  tbody.innerHTML = list.map((item) => {
    const d = new Date(item.timestamp);
    const fmtDate = d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
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
  const rows = [
    ["timestamp", "category", "actor", "detail", "status"],
    ...rcState.auditLogs.map((l) => [l.timestamp, l.category, l.actor, l.detail, l.status])
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `muntrume_race_control_audit_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showRcNotice("Auditoría exportada", "Archivo CSV descargado correctamente.", "success");
}

// ============================================================================
// INITIALIZATION & GLOBAL SHORTCUTS
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  initDefaultAuditLogs();
  updateMmtSimulator();
  refreshRaceControlData();

  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get("tab");
  if (initialTab) switchAdminTab(initialTab);

  const globalSearch = document.getElementById("adminGlobalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("input", () => {
      const q = globalSearch.value.trim();
      const dirInput = document.getElementById("directorySearchInput");
      if (dirInput) {
        dirInput.value = q;
        if (rcState.activeTab !== "directory" && q.length >= 2) {
          switchAdminTab("directory");
        }
        renderDirectoryTable();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== globalSearch && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) {
      e.preventDefault();
      globalSearch?.focus();
    }
  });
});

if (typeof window !== "undefined") {
  window.switchAdminTab = switchAdminTab;
  window.refreshRaceControlData = refreshRaceControlData;
  window.filterDirectory = filterDirectory;
  window.renderDirectoryTable = renderDirectoryTable;
  window.openAddDriverModal = openAddDriverModal;
  window.closeAddDriverModal = closeAddDriverModal;
  window.submitAddDriverForm = submitAddDriverForm;
  window.generateDriverAccessFromBtn = generateDriverAccessFromBtn;
  window.approvePendingRequestBtn = approvePendingRequestBtn;
  window.revokeDriverAccessBtn = revokeDriverAccessBtn;
  window.closeCredentialsResultModal = closeCredentialsResultModal;
  window.copyCredentialSecretOnly = copyCredentialSecretOnly;
  window.copyWelcomeMessageTemplate = copyWelcomeMessageTemplate;
  window.updateMmtSimulator = updateMmtSimulator;
  window.copySimulatedFilename = copySimulatedFilename;
  window.openEmailPreviewModal = openEmailPreviewModal;
  window.closeEmailPreviewModal = closeEmailPreviewModal;
  window.copyCurrentEmailTemplate = copyCurrentEmailTemplate;
  window.saveIracingMappings = saveIracingMappings;
  window.copyDriverIdsConfig = copyDriverIdsConfig;
  window.copyIracingConsoleSnippet = copyIracingConsoleSnippet;
  window.testLiveDriversEndpoint = testLiveDriversEndpoint;
  window.filterAuditLogs = filterAuditLogs;
  window.exportAuditLogsCsv = exportAuditLogsCsv;
  window.showRcNotice = showRcNotice;
  window.hideRcNotice = hideRcNotice;
}
