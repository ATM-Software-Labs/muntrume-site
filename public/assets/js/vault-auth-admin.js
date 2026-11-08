/* Muntrume Vault — acceso sin contraseña (código por email / enlace) y consola Race Control.
   Se carga después de setups.js y sustituye algunas funciones globales de ese archivo. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (t) => escapeHtml(t);

  // ───────────── Enlace mágico (#magic=…): se lee y se borra de la URL de inmediato ─────────────
  let pendingMagic = null;
  if (location.hash.startsWith("#magic=")) {
    pendingMagic = decodeURIComponent(location.hash.slice(7));
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* noop */ }
  }

  async function apiPost(path, payload) {
    const res = await fetch(`${API_BASE}/api/setups/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  function startSession(data, remember) {
    currentToken = data.token;
    currentUser = data.user;
    saveSession(currentToken, currentUser, remember);
    if (data.must_change_password) { openChangePasswordModal(); return; }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get("redirect");
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
        window.location.href = redirect;
        return;
      }
    } catch (e) {}

    showVaultView();
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); }
    loadCatalog();
  }

  // ───────────── Login con código ─────────────
  const origSwitchTab = window.switchTab;
  window.switchTab = function (mode) {
    $("codeLoginForm")?.classList.add("hidden");
    origSwitchTab(mode);
  };

  window.showCodeLogin = function () {
    $("loginForm")?.classList.add("hidden");
    const f = $("codeLoginForm");
    f?.classList.remove("hidden");
    const le = $("loginEmail")?.value.trim();
    if (le && !$("codeEmail").value) $("codeEmail").value = le;
    resetCodeForm();
    $("codeEmail")?.focus();
  };
  window.hideCodeLogin = function () {
    $("codeLoginForm")?.classList.add("hidden");
    $("loginForm")?.classList.remove("hidden");
  };

  let cooldownTimer = null;
  function resetCodeForm() {
    $("codeStep2")?.classList.add("hidden");
    $("codeInfo")?.classList.add("hidden");
    $("codeError")?.classList.add("hidden");
    $("codeEmail").readOnly = false;
    $("codeInput").value = "";
    $("codeSubmitBtn").textContent = "Enviarme el código";
  }
  function codeMsg(kind, text) {
    const info = $("codeInfo"), err = $("codeError");
    info.classList.add("hidden"); err.classList.add("hidden");
    const el = kind === "error" ? err : info;
    el.textContent = text; el.classList.remove("hidden");
  }
  function startCooldown(btn, seconds, label) {
    clearInterval(cooldownTimer);
    let left = seconds;
    btn.disabled = true;
    btn.textContent = `${label} (${left}s)`;
    cooldownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(cooldownTimer); btn.disabled = false; btn.textContent = label; }
      else btn.textContent = `${label} (${left}s)`;
    }, 1000);
  }

  window.requestLoginCode = async function (resend) {
    const email = $("codeEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { codeMsg("error", "Introduce un correo válido."); return; }
    const btn = $("codeSubmitBtn");
    btn.disabled = true;
    try {
      const { res, data } = await apiPost("code/request", { email });
      if (!res.ok || !data.success) { codeMsg("error", data.error || "No se pudo enviar el código."); return; }
      $("codeStep2").classList.remove("hidden");
      $("codeEmail").readOnly = true;
      btn.textContent = "Entrar al Vault →";
      codeMsg("info", data.message);
      startCooldown($("codeResendBtn"), data.cooldown_s || 60, "Reenviar");
      $("codeInput").focus();
    } catch (e) {
      codeMsg("error", "Error conectando con el servidor. Inténtalo de nuevo.");
    } finally { btn.disabled = false; }
  };

  window.handleCodeLoginSubmit = async function (e) {
    e.preventDefault();
    if ($("codeStep2").classList.contains("hidden")) return requestLoginCode(false);
    const email = $("codeEmail").value.trim();
    const code = $("codeInput").value.replace(/\D/g, "");
    if (code.length !== 6) { codeMsg("error", "El código tiene 6 dígitos."); return; }
    const btn = $("codeSubmitBtn");
    btn.disabled = true; btn.textContent = "Verificando…";
    try {
      const { res, data } = await apiPost("code/verify", { email, code });
      if (res.ok && data.success) {
        resetCodeForm(); hideCodeLogin();
        startSession(data, !!$("rememberMe")?.checked);
      } else {
        codeMsg("error", data.error || "Código incorrecto.");
        if (data.code === "code_locked") { $("codeInput").value = ""; }
      }
    } catch (err) {
      codeMsg("error", "Error conectando con el servidor. Inténtalo de nuevo.");
    } finally { btn.disabled = false; if (!$("codeStep2").classList.contains("hidden")) btn.textContent = "Entrar al Vault →"; }
  };

  // Autocompletar: al pegar/escribir 6 dígitos se envía solo
  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.id === "codeInput") {
      ev.target.value = ev.target.value.replace(/\D/g, "").slice(0, 6);
      if (ev.target.value.length === 6) $("codeLoginForm").requestSubmit();
    }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    if (!pendingMagic) return;
    const magic = pendingMagic; pendingMagic = null;
    try {
      const { res, data } = await apiPost("code/verify", { magic });
      if (res.ok && data.success) { startSession(data, false); return; }
      handleLogout();
      showAuthGate();
      const err = $("loginError");
      if (err) { err.textContent = data.error || "El enlace no es válido o ha caducado."; err.classList.remove("hidden"); }
    } catch (e) { /* noop */ }
  });

  // ───────────── Re-autenticación para Race Control ─────────────
  let reauthResolve = null;
  function openReauth() {
    return new Promise((resolve) => {
      reauthResolve = resolve;
      $("reauthEmail").textContent = currentUser?.email || "";
      $("reauthCode").classList.add("hidden"); $("reauthCode").value = "";
      $("reauthResend").classList.add("hidden");
      $("reauthInfo").classList.add("hidden"); $("reauthError").classList.add("hidden");
      $("reauthBtn").textContent = "Enviarme el código"; $("reauthBtn").disabled = false;
      $("reauthModal").classList.remove("hidden");
    });
  }
  window.closeReauth = function (ok) {
    $("reauthModal").classList.add("hidden");
    const r = reauthResolve; reauthResolve = null;
    if (r) r(ok === true);
  };
  function reauthMsg(kind, text) {
    $("reauthInfo").classList.add("hidden"); $("reauthError").classList.add("hidden");
    const el = kind === "error" ? $("reauthError") : $("reauthInfo");
    el.textContent = text; el.classList.remove("hidden");
  }
  window.requestReauthCode = async function () {
    const btn = $("reauthBtn"); btn.disabled = true;
    try {
      const { res, data } = await apiPost("code/request", { email: currentUser?.email });
      if (!res.ok || !data.success) { reauthMsg("error", data.error || "No se pudo enviar el código."); return; }
      $("reauthCode").classList.remove("hidden"); $("reauthCode").focus();
      $("reauthResend").classList.remove("hidden");
      startCooldown($("reauthResend"), data.cooldown_s || 60, "Reenviar código");
      btn.textContent = "Verificar";
      reauthMsg("info", "Código enviado. Caduca en 10 minutos.");
    } catch (e) { reauthMsg("error", "Error de conexión."); } finally { btn.disabled = false; }
  };
  window.handleReauthSubmit = async function (e) {
    e.preventDefault();
    if ($("reauthCode").classList.contains("hidden")) return requestReauthCode();
    const code = $("reauthCode").value.replace(/\D/g, "");
    if (code.length !== 6) { reauthMsg("error", "El código tiene 6 dígitos."); return; }
    const btn = $("reauthBtn"); btn.disabled = true; btn.textContent = "Verificando…";
    try {
      const { res, data } = await apiPost("code/verify", { email: currentUser?.email, code });
      if (res.ok && data.success) {
        currentToken = data.token; currentUser = data.user;
        saveSession(currentToken, currentUser);
        closeReauth(true);
      } else reauthMsg("error", data.error || "Código incorrecto.");
    } catch (err) { reauthMsg("error", "Error de conexión."); }
    finally { btn.disabled = false; btn.textContent = "Verificar"; }
  };

  // adminApi con reintento tras verificar por código
  window.adminApi = async function (path, payload, _retried) {
    const res = await fetch(`${API_BASE}/api/setups/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentToken}` },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.code === "reauth_required" && !_retried) {
      const ok = await openReauth();
      if (ok) return window.adminApi(path, payload, true);
      closeAdminModal();
      return { res, data };
    }
    if (res.status === 401) { closeAdminModal(); handleAuthFailure(res, data); }
    return { res, data };
  };

  // ───────────── Consola Race Control ─────────────
  const TABS = { members: "Mem", requests: "Req", add: "Add", audit: "Aud", stats: "Sta", events: "Evt" };
  let currentAdminTab = "members";
  window.openAdminModal = async function () {
    hideAdminNotice();
    $("adminModal").classList.remove("hidden");
    document.documentElement.style.overflow = "hidden";
    switchAdminTab(currentAdminTab);
    await loadAdminData();
  };
  window.closeAdminModal = function () {
    $("adminModal")?.classList.add("hidden");
    closeAdminUser();
    document.documentElement.style.overflow = "";
  };
  window.switchAdminTab = function (tab) {
    currentAdminTab = tab;
    Object.entries(TABS).forEach(([t, short]) => {
      const sec = $(`adminTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const btn = $(`tab${short}Btn`);
      sec?.classList.toggle("hidden", t !== tab);
      btn?.classList.toggle("active", t === tab);
      btn?.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    if (tab === "audit") loadAdminAudit();
    if (tab === "stats") loadAdminStats();
    if (tab === "events") loadAdminEvents();
  };

  const origRender = window.renderAdminData;
  window.renderAdminData = function () {
    origRender();
    renderAdminMembers();
    if (drawerEmail) renderAdminUser();
  };

  function memberState(m) {
    if (m.status !== "active") return "inactive";
    return m.has_password ? "active" : "pending";
  }
  const STATE_BADGE = {
    active: '<span class="adm-badge adm-b-active">Activo</span>',
    pending: '<span class="adm-badge adm-b-pending">Sin contraseña</span>',
    inactive: '<span class="adm-badge adm-b-inactive">Suspendido</span>',
  };
  const roleBadge = (r) => r === "admin" ? '<span class="adm-badge adm-b-admin">Admin</span>' : '<span class="adm-badge adm-b-driver">Piloto</span>';
  const COLORS = ["#34d399", "#60a5fa", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#2dd4bf"];
  function avatar(m, lg) {
    const cls = `adm-avatar${lg ? " adm-avatar-lg" : ""}`;
    if (m.photo && /^data:image\/(webp|jpeg|png);base64,/.test(m.photo)) return `<img class="${cls}" src="${esc(m.photo)}" alt="" width="${lg ? 72 : 36}" height="${lg ? 72 : 36}">`;
    const name = m.name || String(m.email).split("@")[0];
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
    let h = 0; for (const c of String(m.email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `<span class="${cls}" style="background:${COLORS[h % COLORS.length]}" aria-hidden="true">${esc(initials)}</span>`;
  }
  function when(v) { return v ? formatAdminDate(v) : '<span class="adm-muted">Nunca</span>'; }

  window.renderAdminMembers = function () {
    const box = $("adminMembersList"); if (!box) return;
    const q = ($("admUserSearch")?.value || "").trim().toLowerCase();
    const fs = $("admStatusFilter")?.value || "all";
    const fr = $("admRoleFilter")?.value || "all";
    const list = (adminData.members || []).filter((m) => {
      if (fs !== "all" && memberState(m) !== fs) return false;
      if (fr !== "all" && (m.role === "admin" ? "admin" : "driver") !== fr) return false;
      if (q && ![m.name, m.email, m.team, m.car_class].some((x) => String(x || "").toLowerCase().includes(q))) return false;
      return true;
    });
    if (!list.length) { box.innerHTML = `<div class="adm-empty">${(adminData.members || []).length ? "Ningún usuario coincide con el filtro." : "Todavía no hay usuarios."}</div>`; return; }
    const me = (currentUser?.email || "").toLowerCase();
    box.innerHTML = `<table class="adm-table"><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Equipo · Clase</th><th>Último acceso</th></tr></thead><tbody>${
      list.map((m) => `<tr data-email="${esc(m.email)}" tabindex="0">
        <td><div class="adm-user">${avatar(m)}<div style="min-width:0"><div class="adm-name">${esc(m.name || String(m.email).split("@")[0])}${String(m.email).toLowerCase() === me ? ' <span class="adm-muted">(tú)</span>' : ""}</div><div class="adm-email">${esc(m.email)}</div></div></div></td>
        <td class="adm-col-meta">${roleBadge(m.role)} <span class="adm-only-sm"></span>${window.innerWidth < 768 ? STATE_BADGE[memberState(m)] : ""}</td>
        <td class="adm-col-hide">${STATE_BADGE[memberState(m)]}</td>
        <td class="adm-col-hide">${esc([m.team, m.car_class].filter(Boolean).join(" · ")) || '<span class="adm-muted">—</span>'}</td>
        <td class="adm-col-hide">${when(m.last_login_at)}</td></tr>`).join("")
    }</tbody></table>`;
  };
  document.addEventListener("click", (ev) => {
    const tr = ev.target.closest && ev.target.closest("#adminMembersList tr[data-email]");
    if (tr) openAdminUser(tr.dataset.email);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target?.matches?.("#adminMembersList tr[data-email]")) openAdminUser(ev.target.dataset.email);
    if (ev.key === "Escape") {
      if (!$("reauthModal")?.classList.contains("hidden")) closeReauth();
      else if (drawerEmail) closeAdminUser();
    }
  });

  // ── Panel lateral de usuario ──
  let drawerEmail = null;
  let drawerDetail = null;
  window.openAdminUser = async function (email) {
    drawerEmail = email; drawerDetail = null;
    $("admUserBackdrop").classList.remove("hidden");
    $("admUserDrawer").classList.remove("hidden");
    renderAdminUser();
    const { res, data } = await adminApi("admin/user/detail", { email });
    if (drawerEmail !== email) return;
    drawerDetail = res.ok && data.success ? data : { error: data.error || "No se pudo cargar el historial." };
    renderAdminUser();
  };
  window.closeAdminUser = function () {
    drawerEmail = null;
    $("admUserBackdrop")?.classList.add("hidden");
    $("admUserDrawer")?.classList.add("hidden");
  };
  const ACTION_LABEL = {
    "event.save": "Evento guardado",
    "event.delete": "Evento borrado",
    "request.approve": "Solicitud aprobada", "request.reject": "Solicitud rechazada", "user.add": "Alta directa",
    "user.send_link": "Enlace de acceso enviado", "user.suspend": "Suspendido", "user.reactivate": "Reactivado",
    "user.update": "Datos editados", "user.role_change": "Rol cambiado", "user.delete": "Usuario borrado",
    "user.revoke_sessions": "Sesiones cerradas", "user.photo_set": "Foto actualizada", "user.photo_remove": "Foto eliminada",
    "user.public_on": "Perfil público activado", "user.public_off": "Perfil público oculto",
  };
  const DL_LABEL = { setup: "Setup", batch: "Paquete", car_files: "Archivos de coche" };

  function renderAdminUser() {
    const m = (adminData.members || []).find((x) => x.email === drawerEmail);
    const body = $("admUserBody");
    if (!m) { body.innerHTML = `<div class="adm-drawer-head"><strong>Usuario</strong><button class="adm-icon-btn" onclick="closeAdminUser()" aria-label="Cerrar">✕</button></div><div class="adm-empty">Este usuario ya no existe.</div>`; return; }
    const isMe = String(m.email).toLowerCase() === (currentUser?.email || "").toLowerCase();
    const st = memberState(m);
    const d = drawerDetail;
    const dl = !d ? '<div class="adm-muted">Cargando…</div>' : d.error ? `<div class="adm-muted">${esc(d.error)}</div>`
      : d.downloads.length ? `<div class="adm-list">${d.downloads.map((x) => `<div><div style="color:#fff">${esc(DL_LABEL[x.kind] || x.kind)} · ${Number(x.files)} archivo${x.files == 1 ? "" : "s"}</div><div class="adm-muted">${formatAdminDate(x.at)} · ${esc(x.ref || "")}</div></div>`).join("")}</div>` : '<div class="adm-muted">Sin descargas registradas.</div>';
    const au = !d || d.error ? "" : d.audit.length ? `<div class="adm-list">${d.audit.map((x) => `<div><div style="color:#fff">${esc(ACTION_LABEL[x.action] || x.action)}</div><div class="adm-muted">${formatAdminDate(x.at)} · por ${esc(x.admin_email)}</div></div>`).join("")}</div>` : '<div class="adm-muted">Sin cambios registrados.</div>';
    body.innerHTML = `
      <div class="adm-drawer-head"><strong style="color:#fff">Detalles del usuario</strong><button type="button" class="adm-icon-btn" onclick="closeAdminUser()" aria-label="Cerrar">✕</button></div>
      <div class="adm-drawer-body">
        <div class="adm-user" style="gap:14px">${avatar(m, true)}<div style="min-width:0">
          <div id="admUserTitle" class="adm-name" style="font-size:17px">${esc(m.name || m.email)}</div>
          <div class="adm-email">${esc(m.email)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${roleBadge(m.role)}${STATE_BADGE[st]}</div></div></div>
        <div class="adm-grid2 adm-muted"><div>Alta: ${when(m.created_at)}</div><div>Último acceso: ${when(m.last_login_at)}</div></div>
        <div class="adm-actions">
          <label class="adm-btn adm-btn-ghost adm-btn-sm" style="cursor:pointer">📷 Foto<input type="file" accept="image/*" hidden onchange="uploadAdminPhoto(this)"></label>
          ${m.photo ? '<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" onclick="removeAdminPhoto()">Quitar foto</button>' : ""}
          <span id="admPhotoMsg" class="adm-muted"></span>
        </div>
        <form onsubmit="saveAdminUser(event)" style="display:flex;flex-direction:column;gap:10px">
          <div class="adm-field"><label for="admEdName">Nombre</label><input id="admEdName" maxlength="80" value="${esc(m.name || "")}"></div>
          <div class="adm-grid2">
            <div class="adm-field"><label for="admEdTeam">Equipo</label><input id="admEdTeam" maxlength="80" value="${esc(m.team || "")}" placeholder="—"></div>
            <div class="adm-field"><label for="admEdClass">Clase de coche</label><input id="admEdClass" maxlength="80" value="${esc(m.car_class || "")}" placeholder="p. ej. GT3"></div>
          </div>
          <div class="adm-field"><label for="admEdRole">Rol</label><select id="admEdRole" ${isMe ? "disabled" : ""}><option value="driver" ${m.role !== "admin" ? "selected" : ""}>Piloto</option><option value="admin" ${m.role === "admin" ? "selected" : ""}>Admin</option></select></div>
          <div><button type="submit" class="adm-btn adm-btn-primary adm-btn-sm">Guardar cambios</button> <span id="admSaveMsg" class="adm-muted"></span></div>
        </form>
        <form onsubmit="saveAdminPublic(event)" class="adm-pub" style="display:flex;flex-direction:column;gap:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px">
          <h3 class="adm-h3" style="margin:0">Perfil público <span class="adm-muted" style="font-weight:400">· /pilotos</span></h3>
          <label style="display:flex;gap:8px;align-items:center;color:#e2e8f0;font-size:14px"><input type="checkbox" id="admPubOn" ${m.public_visible ? "checked" : ""} ${st === "inactive" ? "disabled" : ""}> Mostrar en la web (solo con permiso del piloto)</label>
          <div class="adm-grid2">
            <div class="adm-field"><label for="admPubName">Nombre o alias público</label><input id="admPubName" maxlength="60" value="${esc(m.public_name || "")}" placeholder="${esc(m.name || "")}"></div>
            <div class="adm-field"><label for="admPubSlug">URL (muntru.me/p/…)</label><input id="admPubSlug" maxlength="40" pattern="[a-z0-9-]*" value="${esc(m.public_slug || "")}" placeholder="auto"></div>
          </div>
          <div class="adm-field"><label for="admPubBio">Bio corta (máx. 280)</label><textarea id="admPubBio" maxlength="280" rows="2">${esc(m.public_bio || "")}</textarea></div>
          <div class="adm-field"><label for="admPubLinks">Enlaces (uno por línea: Texto | https://…)</label><textarea id="admPubLinks" rows="3" placeholder="Twitch | https://twitch.tv/…">${esc(pubLinksText(m.public_links))}</textarea></div>
          <p class="adm-muted" style="margin:0;font-size:12px">Se publica: alias, foto, equipo, clase, bio, enlaces y mes de alta. Nunca el email ni las descargas.</p>
          <div><button type="submit" class="adm-btn adm-btn-primary adm-btn-sm">Guardar perfil público</button> <span id="admPubMsg" class="adm-muted"></span>
          ${m.public_visible && m.public_slug ? `<a class="adm-btn adm-btn-ghost adm-btn-sm" href="/p/${esc(m.public_slug)}/" target="_blank" rel="noopener">Ver ↗</a>` : ""}</div>
        </form>
        <div><h3 class="adm-h3">Acceso</h3><div class="adm-actions">
          ${st !== "inactive" ? `<button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" onclick="confirmResendInvite(${esc(JSON.stringify(m.email))})">✉️ Enviar enlace de acceso</button>` : ""}
          <button type="button" class="adm-btn adm-btn-ghost adm-btn-sm" onclick="confirmRevokeSessions()">⎋ Cerrar sesiones</button>
          ${isMe ? "" : `<button type="button" class="adm-btn ${st === "inactive" ? "adm-btn-primary" : "adm-btn-warn"} adm-btn-sm" onclick="confirmSetMemberStatus(${esc(JSON.stringify(m.email))}, '${st === "inactive" ? "active" : "inactive"}')">${st === "inactive" ? "Reactivar" : "Suspender"}</button>`}
        </div></div>
        <div><h3 class="adm-h3">Descargas recientes</h3>${dl}</div>
        <div><h3 class="adm-h3">Historial de cambios</h3>${au}</div>
        ${isMe ? "" : `<div class="adm-danger-zone"><h3 class="adm-h3" style="color:#fca5a5">Zona peligrosa</h3><p class="adm-muted" style="margin:0 0 10px">Borra la cuenta y su acceso. No se puede deshacer.</p><button type="button" class="adm-btn adm-btn-danger adm-btn-sm" onclick="confirmDeleteUser()">Borrar usuario</button></div>`}
      </div>`;
  }

  window.saveAdminUser = async function (e) {
    e.preventDefault();
    const msg = $("admSaveMsg"); msg.textContent = "Guardando…";
    const { res, data } = await adminApi("admin/user/update", {
      email: drawerEmail, name: $("admEdName").value.trim(), team: $("admEdTeam").value.trim(),
      car_class: $("admEdClass").value.trim(), role: $("admEdRole").value,
    });
    if (!res.ok || !data.success) { msg.textContent = data.error || "No se pudo guardar."; return; }
    await loadAdminData();
    showAdminNotice("Cambios guardados.", "ok");
  };

  function pubLinksText(raw) {
    let a = []; try { a = JSON.parse(raw || "[]"); } catch { a = []; }
    return Array.isArray(a) ? a.map((l) => `${l.label} | ${l.url}`).join("\n") : "";
  }
  window.saveAdminPublic = async function (e) {
    e.preventDefault();
    const msg = $("admPubMsg"); msg.textContent = "Guardando…";
    const links = $("admPubLinks").value.split("\n").map((l) => l.split("|")).filter((p) => p.length >= 2)
      .map((p) => ({ label: p[0].trim(), url: p.slice(1).join("|").trim() })).filter((l) => l.label && /^https:\/\//.test(l.url));
    const { res, data } = await adminApi("admin/user/public", {
      email: drawerEmail, visible: $("admPubOn").checked, public_name: $("admPubName").value.trim(),
      slug: $("admPubSlug").value.trim(), bio: $("admPubBio").value.trim(), links,
    });
    if (!res.ok || !data.success) { msg.textContent = data.error || "No se pudo guardar."; return; }
    await loadAdminData();
    showAdminNotice(data.visible ? `Perfil público activo: muntru.me/p/${data.slug}/` : "Perfil público oculto.", "ok");
  };

  async function toWebp(file) {
    const img = await new Promise((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = URL.createObjectURL(file);
    });
    for (const size of [256, 200, 160, 128]) {
      const c = document.createElement("canvas"); c.width = c.height = size;
      const s = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext("2d").drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      for (const q of [0.85, 0.7, 0.55]) {
        let url = c.toDataURL("image/webp", q);
        if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/jpeg", q);
        if (url.length <= 88000) return url;
      }
    }
    throw new Error("too_big");
  }
  window.uploadAdminPhoto = async function (input) {
    const f = input.files && input.files[0]; if (!f) return;
    const msg = $("admPhotoMsg"); msg.textContent = "Procesando…";
    try {
      const photo = await toWebp(f);
      const { res, data } = await adminApi("admin/user/photo", { email: drawerEmail, photo });
      if (!res.ok || !data.success) { msg.textContent = data.error || "No se pudo subir."; return; }
      await loadAdminData();
    } catch (e) { msg.textContent = "No se pudo procesar la imagen."; }
  };
  window.removeAdminPhoto = async function () {
    const { res, data } = await adminApi("admin/user/photo", { email: drawerEmail, photo: null });
    if (!res.ok || !data.success) { showAdminNotice(data.error || "No se pudo quitar la foto.", "error"); return; }
    await loadAdminData();
  };
  window.confirmRevokeSessions = function () {
    const email = drawerEmail;
    openAdminConfirm({
      title: "Cerrar todas las sesiones",
      bodyHtml: `<p>Todas las sesiones abiertas de <strong class="text-white">${esc(email)}</strong> dejarán de funcionar de inmediato. Podrá volver a entrar con su contraseña o con un código.</p>`,
      confirmText: "Cerrar sesiones", danger: true,
      onConfirm: async () => {
        const { res, data } = await adminApi("admin/user/revoke", { email });
        if (!res.ok || !data.success) return data.error || "No se pudo cerrar las sesiones.";
        if (data.self) { closeAdminModal(); handleLogout(); return null; }
        showAdminNotice("Sesiones cerradas.", "ok");
        if (drawerEmail) openAdminUser(drawerEmail);
        return null;
      },
    });
  };
  window.confirmDeleteUser = function () {
    const email = drawerEmail;
    openAdminConfirm({
      title: "Borrar usuario",
      bodyHtml: `<p>Se borrará <strong class="text-white">${esc(email)}</strong> y perderá el acceso al Vault. Esta acción no se puede deshacer.</p>
        <label for="admDelConfirm" class="block text-[11px] font-semibold uppercase text-neutral-400 mb-1 mt-2">Escribe el correo para confirmar</label>
        <input id="admDelConfirm" autocomplete="off" class="w-full bg-[#0e1217] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" placeholder="${esc(email)}">`,
      confirmText: "Borrar definitivamente", danger: true,
      onConfirm: async () => {
        const confirm = $("admDelConfirm")?.value.trim() || "";
        if (confirm.toLowerCase() !== String(email).toLowerCase()) return "El correo no coincide.";
        const { res, data } = await adminApi("admin/user/delete", { email, confirm });
        if (!res.ok || !data.success) return data.error || "No se pudo borrar.";
        closeAdminUser();
        await loadAdminData();
        showAdminNotice("Usuario borrado.", "ok");
        return null;
      },
    });
  };

  // ── Auditoría ──
  let auditRows = [];
  window.loadAdminAudit = async function () {
    const box = $("adminAuditList"); if (!auditRows.length) box.innerHTML = '<div class="adm-empty">Cargando…</div>';
    const { res, data } = await adminApi("admin/audit");
    if (!res.ok || !data.success) { box.innerHTML = `<div class="adm-empty">${esc(data.error || "No se pudo cargar la auditoría.")}</div>`; return; }
    auditRows = data.audit || [];
    renderAdminAudit();
  };
  window.renderAdminAudit = function () {
    const box = $("adminAuditList"); if (!box) return;
    const q = ($("admAuditSearch")?.value || "").trim().toLowerCase();
    const rows = auditRows.filter((r) => !q || [r.action, ACTION_LABEL[r.action], r.admin_email, r.target, r.detail].some((x) => String(x || "").toLowerCase().includes(q)));
    if (!rows.length) { box.innerHTML = `<div class="adm-empty">${auditRows.length ? "Nada coincide con el filtro." : "Todavía no hay acciones registradas."}</div>`; return; }
    box.innerHTML = `<table class="adm-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Admin</th><th>Detalle</th></tr></thead><tbody>${
      rows.map((r) => `<tr style="cursor:default"><td class="adm-muted">${formatAdminDate(r.at)}</td><td style="color:#fff;font-weight:600">${esc(ACTION_LABEL[r.action] || r.action)}</td><td class="adm-email">${esc(r.target || "—")}</td><td class="adm-email adm-col-hide">${esc(r.admin_email)}</td><td class="adm-muted adm-col-hide" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.detail || "")}">${esc(r.detail || "")}</td></tr>`).join("")
    }</tbody></table>`;
  };

  // ── Eventos del equipo ──
  let adminEvents = [];
  const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : "");
  function renderAdminEvents() {
    const box = $("adminEventsList"); if (!box) return;
    if (!adminEvents.length) { box.innerHTML = '<div class="adm-empty">No hay eventos. La portada muestra «calendario por anunciar» y los correos no incluyen sección de eventos.</div>'; return; }
    box.innerHTML = `<div class="adm-list">${adminEvents.map((e) => `<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <div><div style="color:#fff;font-weight:700">${esc(e.title)}</div><div class="adm-muted">${esc(new Date(e.starts_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }))}${e.track ? " · " + esc(e.track) : ""}${e.car_class ? " · " + esc(e.car_class) : ""}</div></div>
      <div style="display:flex;gap:6px"><a class="adm-btn adm-btn-ghost" href="${esc(e.ics)}" target="_blank" rel="noopener">.ics</a><button type="button" class="adm-btn adm-btn-ghost" onclick="editAdminEvent(${Number(e.id)})">Editar</button><button type="button" class="adm-btn adm-btn-ghost" onclick="deleteAdminEvent(${Number(e.id)})">Borrar</button></div></div>`).join("")}</div>`;
  }
  async function eventsCall(payload) {
    const { res, data } = await adminApi("admin/events", payload);
    const msg = $("evtMsg");
    if (!res.ok || !data.success) { if (msg) msg.textContent = data.error || "No se pudo completar la acción."; return false; }
    adminEvents = data.events || []; renderAdminEvents(); return true;
  }
  window.loadAdminEvents = () => eventsCall({ op: "list" });
  window.resetAdminEvent = () => { $("admEventForm")?.reset(); $("evtId").value = ""; };
  window.editAdminEvent = (id) => {
    const e = adminEvents.find((x) => x.id === id); if (!e) return;
    $("evtId").value = e.id; $("evtTitle").value = e.title; $("evtStart").value = toLocalInput(e.starts_at); $("evtEnd").value = toLocalInput(e.ends_at);
    $("evtTrack").value = e.track || ""; $("evtClass").value = e.car_class || ""; $("evtUrl").value = e.url || ""; $("evtNotes").value = e.notes || "";
    $("evtTitle").focus();
  };
  window.saveAdminEvent = async (ev) => {
    ev.preventDefault();
    const ok = await eventsCall({ op: "save", id: Number($("evtId").value) || undefined, title: $("evtTitle").value, starts_at: fromLocalInput($("evtStart").value),
      ends_at: fromLocalInput($("evtEnd").value) || undefined, track: $("evtTrack").value, car_class: $("evtClass").value, url: $("evtUrl").value, notes: $("evtNotes").value });
    if (ok) { $("evtMsg").textContent = "Evento guardado."; resetAdminEvent(); }
  };
  window.deleteAdminEvent = async (id) => {
    const e = adminEvents.find((x) => x.id === id);
    if (!e || !confirm(`¿Borrar «${e.title}»?`)) return;
    if (await eventsCall({ op: "delete", id })) $("evtMsg").textContent = "Evento borrado.";
  };

  // ── Estadísticas ──
  const nf = (n) => Number(n || 0).toLocaleString("es-ES");
  window.loadAdminStats = async function () {
    const box = $("adminStatsBody"); box.innerHTML = '<div class="adm-empty">Cargando…</div>';
    const { res, data: d } = await adminApi("admin/stats");
    if (!res.ok || !d.success) { box.innerHTML = `<div class="adm-empty">${esc(d.error || "No se pudieron cargar las estadísticas.")}</div>`; return; }
    const card = (k, v, s) => `<div class="adm-card"><div class="k">${k}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
    const bars = (rows, label) => {
      const max = Math.max(1, ...rows.map((r) => r.n));
      return `<div class="adm-bars">${rows.map((r) => `<div class="adm-bar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label(r))}</span><span class="t"><span style="width:${Math.round((r.n / max) * 100)}%"></span></span><span class="adm-muted">${nf(r.n)}</span></div>`).join("")}</div>`;
    };
    const carLabel = (c) => (typeof CAR_LABELS === "object" && CAR_LABELS[c]) || c;
    box.innerHTML = `
      <div class="adm-cards">
        ${card("Usuarios", nf(d.users.total), `${nf(d.users.active)} activos · ${nf(d.users.admins)} admin`)}
        ${card("Activos 30 días", nf(d.users.active30), "con inicio de sesión")}
        ${card("Setups", nf(d.setups.n), `${nf(d.setups.cars)} coches · ${nf(d.setups.circuits)} circuitos`)}
        ${card("Descargas 7 días", nf(d.downloads_7d.files), `${nf(d.downloads_7d.events)} descargas · ${nf(d.downloads_7d.users)} pilotos`)}
      </div>
      <div class="adm-cards" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
        <div class="adm-card"><h3 class="adm-h3">Setups por temporada</h3>${bars(d.by_season.slice(0, 10), (r) => String(r.season).toUpperCase())}</div>
        <div class="adm-card"><h3 class="adm-h3">Coches con más setups</h3>${bars(d.top_cars, (r) => carLabel(r.car))}</div>
      </div>`;
  };
})();
