/**
 * Administración de muntru.me.
 * Cuentas y auditoría salen de Cloudflare D1 (/api/setups/admin/*).
 * El enlace de contraseña lo envía el Worker; esta página solo lo muestra si el correo falla.
 */

const RC_API_BASE = "https://muntrume.atrumin16.workers.dev";

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
    return localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
  } catch {
    return "";
  }
}

function sessionUser() {
  try {
    const raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sessionEmail() {
  const user = sessionUser();
  return String(user?.email || "").trim().toLowerCase();
}

function isSelf(email) {
  const value = String(email || "").trim().toLowerCase();
  return Boolean(value) && value === sessionEmail();
}

function verifyAdminSession() {
  const token = getAdminToken();
  const user = sessionUser();
  const email = sessionEmail();
  const isAdmin = Boolean(user && (email === "atrumin16@gmail.com" || user.role === "admin"));
  if (!token || token === "guest_token" || !isAdmin) {
    secureAdminLogout("unauthorized");
    return false;
  }
  const label = document.getElementById("rcSessionEmail");
  if (label) label.textContent = email;
  return true;
}

function secureAdminLogout(reason) {
  try {
    ["mrt_vault_token", "mrt_vault_user", "muntrume_user_email", "muntrume_auth_state", "muntrume_is_admin", "muntrume_rc_audit_logs", "muntrume_rc_custom_members"].forEach((key) => {
      localStorage.removeItem(key);
    });
    sessionStorage.clear();
  } catch {}

  const shell = document.getElementById("rcShell");
  if (shell) shell.innerHTML = "";
  const dest = reason === "unauthorized"
    ? "/garage?auth=admin&redirect=" + encodeURIComponent(window.location.pathname)
    : reason === "invalid_token"
    ? "/garage?auth=expired&redirect=" + encodeURIComponent(window.location.pathname)
    : "/garage?logged_out=1";
  window.location.replace(dest);
}

async function rcAdminFetch(path, body = {}) {
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  const token = getAdminToken();
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

let rcState = {
  activeTab: "overview",
  directoryFilter: "all",
  members: [],
  pendingRequests: [],
  auditLogs: [],
  lastCredentials: null
};

function roleLabel(role) {
  return role === "admin" ? "Admin" : "Piloto";
}

function formatWhen(value) {
  if (!value) return "—";
  const raw = String(value).trim();
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
    ? raw.replace(" ", "T") + "Z"
    : raw;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
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

function switchAdminTab(tabId) {
  const validTabs = ["overview", "directory", "setups", "security"];
  const chosen = validTabs.includes(tabId) ? tabId : "overview";
  rcState.activeTab = chosen;
  validTabs.forEach((tab) => {
    document.getElementById(`tab-${tab}`)?.classList.toggle("hidden", tab !== chosen);
    document.getElementById(`nav-${tab}`)?.classList.toggle("is-active", tab === chosen);
  });
  try {
    const url = new URL(window.location.href);
    if (chosen === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", chosen);
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

async function refreshRaceControlData() {
  const badge = document.getElementById("rcBackendBadgeText");
  const d1Side = document.getElementById("rcSidebarD1Status");
  if (badge) badge.textContent = "Comprobando…";
  if (!verifyAdminSession()) return;

  let d1Online = false;
  try {
    const data = await rcAdminFetch("/api/setups/admin/panel", {});
    d1Online = true;
    rcState.members = (Array.isArray(data.members) ? data.members : [])
      .filter((row) => row && row.email)
      .map((row) => ({
        name: row.name || String(row.email).split("@")[0],
        email: row.email,
        role: row.role || "driver",
        status: row.status || "active",
        has_password: Boolean(row.has_password),
        last_login_at: row.last_login_at || null
      }));
    const requests = Array.isArray(data.requests) ? data.requests : (data.pending_requests || []);
    rcState.pendingRequests = requests.filter((row) => row && row.status === "pending");
  } catch (err) {
    rcState.members = [];
    rcState.pendingRequests = [];
    showRcNotice("No se pudo leer D1", err?.message || "Error al cargar las cuentas.", "err");
  }

  try {
    const audit = await rcAdminFetch("/api/setups/admin/audit", {});
    rcState.auditLogs = Array.isArray(audit.audit) ? audit.audit : [];
  } catch {
    rcState.auditLogs = [];
  }

  const active = rcState.members.filter((member) => member.status === "active").length;
  const pending = rcState.pendingRequests.length;
  const noPassword = rcState.members.filter((member) => member.status === "active" && !member.has_password).length;
  if (badge) badge.textContent = d1Online ? "D1: conectada" : "D1: sin conexión";
  if (d1Side) d1Side.textContent = d1Online ? `${active} activas · ${pending} pend.` : "sin conexión";

  const drivers = document.getElementById("kpiDriversCount");
  const pendingCount = document.getElementById("kpiPendingCount");
  const pendingStatus = document.getElementById("kpiPendingStatusBadge");
  const pendingSub = document.getElementById("kpiPendingSub");
  const noPasswordEl = document.getElementById("kpiNoPassword");
  const sidebarBadge = document.getElementById("sidebarPendingBadge");
  if (drivers) drivers.textContent = String(rcState.members.length);
  if (pendingCount) pendingCount.textContent = String(pending);
  if (noPasswordEl) noPasswordEl.textContent = String(noPassword);
  if (pendingStatus) {
    pendingStatus.textContent = pending > 0 ? `${pending} nuevas` : "Al día";
    pendingStatus.className = `rc-badge ${pending > 0 ? "rc-badge--warn" : "rc-badge--ok"}`;
  }
  const driversBadge = document.getElementById("kpiDriversBadge");
  if (driversBadge) {
    driversBadge.textContent = d1Online ? "D1" : "sin conexión";
    driversBadge.className = `rc-badge ${d1Online ? "rc-badge--ok" : "rc-badge--err"}`;
  }
  if (pendingSub) pendingSub.textContent = pending > 0 ? `${pending} solicitud(es) por revisar` : "Sin solicitudes pendientes";
  if (sidebarBadge) sidebarBadge.textContent = String(pending);

  renderOverview();
  renderDirectoryTable();
  renderPendingRequests();
  renderAuditTable();
}

function statusBadge(member) {
  if (member.status !== "active") return `<span class="rc-badge rc-badge--err">Bloqueada</span>`;
  if (member.has_password) return `<span class="rc-badge rc-badge--ok">Con contraseña</span>`;
  return `<span class="rc-badge rc-badge--warn">Sin contraseña</span>`;
}

function renderOverview() {
  const tbody = document.getElementById("overviewRosterBody");
  if (tbody) {
    if (!rcState.members.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="r-empty">No hay cuentas, o D1 no ha respondido.</td></tr>`;
    } else {
      tbody.innerHTML = rcState.members.map((member) => `
        <tr>
          <td>
            <div class="rc-strong">${rcEscape(member.name)}</div>
            <div class="rc-mono-sub"><code>${rcEscape(member.email)}</code></div>
          </td>
          <td><span class="rc-badge ${member.role === "admin" ? "rc-badge--ok" : ""}">${rcEscape(roleLabel(member.role))}</span></td>
          <td class="rc-mono-sub">${rcEscape(formatWhen(member.last_login_at))}</td>
          <td>${statusBadge(member)}</td>
          <td class="text-right">
            ${member.status === "active" ? `<button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="generateDriverAccessFromBtn(this, 'link')">Enviar enlace</button>` : ""}
          </td>
        </tr>
      `).join("");
    }
  }

  const list = document.getElementById("overviewActivityList");
  if (!list) return;
  if (!rcState.auditLogs.length) {
    list.innerHTML = `<li><span class="rc-muted">Sin acciones registradas.</span></li>`;
    return;
  }
  list.innerHTML = rcState.auditLogs.slice(0, 5).map((row) => `
    <li>
      <div>
        <strong class="rc-strong">${rcEscape(row.action || "acción")}</strong>
        <div class="rc-mono-sub">${rcEscape(row.target || row.admin_email || "")} · ${rcEscape(formatWhen(row.at))}</div>
      </div>
    </li>
  `).join("");
}

function filterDirectory(mode) {
  rcState.directoryFilter = mode;
  ["all", "active", "admin", "inactive", "pending"].forEach((name) => {
    document.getElementById(`dirFilter-${name}`)?.classList.toggle("is-on", name === mode);
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
  if (!list.length) {
    container.innerHTML = `<p class="rc-muted">No hay solicitudes pendientes.</p>`;
    return;
  }
  container.innerHTML = list.map((req) => {
    const meta = [
      req.iracing_id ? `iRacing ID: ${req.iracing_id}` : null,
      req.car_category || null,
      req.created_at ? formatWhen(req.created_at) : null
    ].filter(Boolean).join(" · ");
    return `
      <div class="rc-sim-output" style="flex-wrap:wrap;gap:12px">
        <div style="flex:1;min-width:240px">
          <div class="rc-strong">${rcEscape(req.name || "Solicitante")} · <code>${rcEscape(req.email)}</code></div>
          ${meta ? `<div class="rc-mono-sub">${rcEscape(meta)}</div>` : ""}
          ${req.message ? `<p class="rc-muted" style="margin-top:4px">${rcEscape(req.message)}</p>` : ""}
        </div>
        <div class="rc-btn-row" style="flex-wrap:wrap">
          <button type="button" class="r-btn r-btn--primary r-btn--sm" data-request-id="${rcEscape(req.id)}" data-email="${rcEscape(req.email)}" data-name="${rcEscape(req.name || "")}" onclick="approvePendingRequestBtn(this, 'link')">Aprobar y enviar enlace</button>
          <button type="button" class="r-btn r-btn--sm" data-request-id="${rcEscape(req.id)}" data-email="${rcEscape(req.email)}" data-name="${rcEscape(req.name || "")}" onclick="approvePendingRequestBtn(this, 'temp_password')">Clave temporal</button>
          <button type="button" class="r-btn r-btn--sm" style="border-color:rgba(239,68,68,.4);color:#f87171" data-request-id="${rcEscape(req.id)}" data-email="${rcEscape(req.email)}" onclick="rejectPendingRequestBtn(this)">Rechazar</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderDirectoryTable() {
  const tbody = document.getElementById("directoryTableBody");
  if (!tbody) return;
  const query = (document.getElementById("directorySearchInput")?.value || "").trim().toLowerCase();
  const filtered = rcState.members.filter((member) => {
    if (rcState.directoryFilter === "admin" && member.role !== "admin") return false;
    if (rcState.directoryFilter === "active" && member.status !== "active") return false;
    if (rcState.directoryFilter === "inactive" && member.status !== "inactive") return false;
    if (!query) return true;
    return `${member.name} ${member.email} ${roleLabel(member.role)}`.toLowerCase().includes(query);
  });
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="r-empty">Ninguna cuenta coincide con el filtro.</td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((member) => {
    const self = isSelf(member.email);
    const blocked = member.status !== "active";
    return `
      <tr>
        <td><div class="rc-strong">${rcEscape(member.name)}</div></td>
        <td><code>${rcEscape(member.email)}</code></td>
        <td><span class="rc-badge ${member.role === "admin" ? "rc-badge--ok" : ""}">${rcEscape(roleLabel(member.role))}</span></td>
        <td class="rc-mono-sub">${rcEscape(formatWhen(member.last_login_at))}</td>
        <td>${statusBadge(member)}</td>
        <td class="text-right">
          <div class="rc-btn-row" style="justify-content:flex-end;flex-wrap:wrap">
            ${blocked ? "" : `<button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="generateDriverAccessFromBtn(this, 'link')">Enviar enlace</button>`}
            ${blocked ? "" : `<button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(member.email)}" data-name="${rcEscape(member.name)}" onclick="generateDriverAccessFromBtn(this, 'temp_password')">Clave temporal</button>`}
            ${self ? "" : `<button type="button" class="r-btn r-btn--sm" data-email="${rcEscape(member.email)}" data-status="${blocked ? "active" : "inactive"}" onclick="toggleMemberStatusBtn(this)">${blocked ? "Reactivar" : "Bloquear"}</button>`}
            ${self ? "" : `<button type="button" class="r-btn r-btn--sm" style="border-color:rgba(239,68,68,.35);color:#f87171" data-email="${rcEscape(member.email)}" onclick="deleteMemberBtn(this)">Eliminar</button>`}
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function presentCredentialResult(data, { name, email, isTempPass, roleNote = "" }) {
  const secret = data.temp_password || data.set_password_link || "";
  const extra = roleNote ? ` ${roleNote}` : "";
  if (data.email_sent) {
    showRcNotice(
      roleNote ? "Correo enviado, rol sin cambiar" : "Correo enviado",
      (isTempPass
        ? `La contraseña temporal se ha enviado a ${email}.`
        : `El enlace para crear la contraseña se ha enviado a ${email}.`) + extra,
      roleNote ? "warn" : "success"
    );
    return;
  }
  if (secret) openCredentialsResultModal({ name, email, secret, isTempPass, error: data.email_error });
  showRcNotice(
    "El correo no se ha enviado",
    data.email_error || data.message || "La cuenta está actualizada. El enlace solo se muestra si el envío falla.",
    "warn"
  );
}

function openCredentialsResultModal({ name, email, secret, isTempPass, error }) {
  const modal = document.getElementById("credentialsResultModal");
  const label = document.getElementById("credSecretLabel");
  const code = document.getElementById("credSecretCode");
  const sub = document.getElementById("credModalSub");
  const err = document.getElementById("credEmailError");
  if (!modal || !code) return;
  if (label) label.textContent = isTempPass ? "CONTRASEÑA TEMPORAL" : "ENLACE DE CONTRASEÑA";
  code.textContent = secret;
  if (sub) sub.textContent = `No se ha podido enviar el correo a ${email}. ${name ? name + " · " : ""}Cópialo solo para entregarlo por otro medio.`;
  if (err) err.textContent = error ? String(error) : "";
  rcState.lastCredentials = { secret };
  modal.classList.remove("hidden");
}

function closeCredentialsResultModal() {
  document.getElementById("credentialsResultModal")?.classList.add("hidden");
}

function copyCredentialSecretOnly() {
  const secret = rcState.lastCredentials?.secret;
  if (!secret) return;
  navigator.clipboard.writeText(secret).then(() => {
    showRcNotice("Copiado", "Enlace o clave copiados.", "success");
  });
}

function openAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.remove("hidden");
  document.getElementById("newDriverName")?.focus();
}

function closeAddDriverModal() {
  document.getElementById("addDriverModal")?.classList.add("hidden");
}

async function issuePilotCredentials({ request_id = null, name, email, role = "driver", method = "link", send_email = true }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || cleanEmail.split("@")[0]).trim();
  if (!cleanEmail) return;
  const isTempPass = method === "temp_password";
  try {
    const payload = request_id
      ? { request_id: Number(request_id), method, send_email, force: true }
      : { email: cleanEmail, name: cleanName, role, method, send_email, force: true };
    const data = await rcAdminFetch("/api/setups/admin/approve", payload);
    let roleNote = "";
    if (!request_id && role === "admin") {
      try {
        await rcAdminFetch("/api/setups/admin/user/update", {
          email: data.pilot?.email || cleanEmail,
          name: data.pilot?.name || cleanName,
          role: "admin"
        });
      } catch (err) {
        roleNote = err?.message || "No se pudo marcar la cuenta como admin.";
      }
    }
    await refreshRaceControlData();
    presentCredentialResult(data, { name: data.pilot?.name || cleanName, email: data.pilot?.email || cleanEmail, isTempPass, roleNote });
  } catch (err) {
    showRcNotice("No se pudo crear el acceso", err?.message || "Error al conectar con D1.", "err");
  }
}

async function submitAddDriverForm(event) {
  event.preventDefault();
  const name = document.getElementById("newDriverName")?.value || "";
  const email = document.getElementById("newDriverEmail")?.value || "";
  const role = document.getElementById("newDriverRole")?.value === "admin" ? "admin" : "driver";
  const method = document.getElementById("newDriverMethod")?.value === "temp_password" ? "temp_password" : "link";
  const send_email = Boolean(document.getElementById("newDriverSendEmail")?.checked);
  closeAddDriverModal();
  await issuePilotCredentials({ name, email, role, method, send_email });
}

async function generateDriverAccessFromBtn(btn, method = "link") {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  const name = btn?.dataset?.name || email.split("@")[0];
  if (!email) return;
  if (method === "temp_password") {
    await issuePilotCredentials({ name, email, method: "temp_password", send_email: true });
    return;
  }
  try {
    const data = await rcAdminFetch("/api/setups/admin/resend-invite", { email });
    await refreshRaceControlData();
    presentCredentialResult(data, { name, email, isTempPass: false });
  } catch (err) {
    showRcNotice("No se pudo enviar el enlace", err?.message || "Error al generar el enlace.", "err");
  }
}

function approvePendingRequestBtn(btn, method = "link") {
  issuePilotCredentials({
    request_id: btn?.dataset?.requestId || null,
    name: btn?.dataset?.name || "",
    email: btn?.dataset?.email || "",
    role: "driver",
    method,
    send_email: true
  });
}

async function rejectPendingRequestBtn(btn) {
  const request_id = btn?.dataset?.requestId;
  const email = btn?.dataset?.email || "";
  if (!request_id) return;
  const reason = window.prompt(`Motivo opcional para rechazar a ${email}:`, "");
  if (reason === null) return;
  try {
    const data = await rcAdminFetch("/api/setups/admin/reject", { request_id: Number(request_id), notify: true, reason });
    await refreshRaceControlData();
    showRcNotice(
      "Solicitud rechazada",
      data.email_sent ? `Se ha avisado a ${email}.` : `La solicitud de ${email} queda rechazada.${data.email_error ? " El aviso no se envió: " + data.email_error : ""}`,
      "info"
    );
  } catch (err) {
    showRcNotice("No se pudo rechazar", err?.message || "Error al rechazar la solicitud.", "err");
  }
}

async function toggleMemberStatusBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  const nextStatus = btn?.dataset?.status === "active" ? "active" : "inactive";
  if (!email || isSelf(email)) return;
  const actionLabel = nextStatus === "inactive" ? "bloquear" : "reactivar";
  if (!window.confirm(`¿Seguro que quieres ${actionLabel} la cuenta de ${email}?`)) return;
  try {
    await rcAdminFetch("/api/setups/admin/set-status", { email, status: nextStatus });
    await refreshRaceControlData();
    showRcNotice(nextStatus === "inactive" ? "Cuenta bloqueada" : "Cuenta reactivada", email, "info");
  } catch (err) {
    showRcNotice("No se pudo cambiar el estado", err?.message || "Error en D1.", "err");
  }
}

async function deleteMemberBtn(btn) {
  const email = (btn?.dataset?.email || "").trim().toLowerCase();
  if (!email || isSelf(email)) return;
  if (!window.confirm(`¿Eliminar la cuenta de ${email}? Esta acción no se puede deshacer.`)) return;
  try {
    await rcAdminFetch("/api/setups/admin/user/delete", { email, confirm: email });
    await refreshRaceControlData();
    showRcNotice("Cuenta eliminada", email, "info");
  } catch (err) {
    showRcNotice("No se pudo eliminar la cuenta", err?.message || "Error en D1.", "err");
  }
}

function renderAuditTable() {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;
  if (!rcState.auditLogs.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="r-empty">Sin acciones registradas.</td></tr>`;
    return;
  }
  tbody.innerHTML = rcState.auditLogs.map((row) => {
    const detail = [row.target, row.detail].filter(Boolean).join(" · ");
    return `
      <tr>
        <td style="font-family:var(--r-mono);font-size:12px;white-space:nowrap">${rcEscape(formatWhen(row.at))}</td>
        <td><code>${rcEscape(row.action || "")}</code></td>
        <td>${rcEscape(row.admin_email || "")}</td>
        <td>${rcEscape(detail)}</td>
      </tr>
    `;
  }).join("");
}

function exportAuditLogsCsv() {
  const rows = [
    ["at", "admin_email", "action", "target", "detail"],
    ...rcState.auditLogs.map((row) => [row.at, row.admin_email, row.action, row.target, row.detail])
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `muntrume-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!verifyAdminSession()) return;
  refreshRaceControlData();
  const params = new URLSearchParams(window.location.search);
  if (params.get("tab")) switchAdminTab(params.get("tab"));

  const globalSearch = document.getElementById("adminGlobalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("input", () => {
      const query = globalSearch.value.trim();
      const dirInput = document.getElementById("directorySearchInput");
      if (!dirInput) return;
      dirInput.value = query;
      if (rcState.activeTab !== "directory" && query.length >= 2) switchAdminTab("directory");
      renderDirectoryTable();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) return;
    event.preventDefault();
    globalSearch?.focus();
  });
});

window.addEventListener("pageshow", (event) => {
  if (!verifyAdminSession()) return;
  if (event.persisted) refreshRaceControlData();
});

Object.assign(window, {
  verifyAdminSession,
  secureAdminLogout,
  switchAdminTab,
  refreshRaceControlData,
  filterDirectory,
  renderDirectoryTable,
  openAddDriverModal,
  closeAddDriverModal,
  submitAddDriverForm,
  generateDriverAccessFromBtn,
  approvePendingRequestBtn,
  rejectPendingRequestBtn,
  toggleMemberStatusBtn,
  deleteMemberBtn,
  closeCredentialsResultModal,
  copyCredentialSecretOnly,
  exportAuditLogsCsv,
  showRcNotice,
  hideRcNotice
});
