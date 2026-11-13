(function () {
  "use strict";
  var API = "https://muntrume.atrumin16.workers.dev";
  var ADMIN = "atrumin16@gmail.com";
  var token = null;
  var setPwToken = null;

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function show(el, on) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (on) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }
  function text(el, value) { if (el) el.textContent = value; }
  function normalize(user, email) {
    var base = user && typeof user === "object" ? Object.assign({}, user) : {};
    var addr = String(base.email || email || "").trim().toLowerCase();
    base.email = addr;
    if (addr === ADMIN) {
      base.role = "admin";
      base.name = base.name || "Alberto Trujillo";
    }
    return base;
  }
  function saveSession(nextToken, user) {
    var normalized = user ? normalize(user) : null;
    try {
      if (nextToken) {
        localStorage.setItem("mrt_vault_token", nextToken);
        sessionStorage.setItem("mrt_vault_token", nextToken);
      }
      if (normalized) {
        var raw = JSON.stringify(normalized);
        localStorage.setItem("mrt_vault_user", raw);
        sessionStorage.setItem("mrt_vault_user", raw);
        if (normalized.email && normalized.role !== "guest") {
          localStorage.setItem("muntrume_user_email", normalized.email);
          localStorage.setItem("muntrume_auth_state", "authenticated");
          localStorage.setItem("muntrume_is_admin", normalized.email === ADMIN ? "true" : "false");
        }
      }
    } catch (e) {}
    token = nextToken;
    window.dispatchEvent(new Event("muntrume-auth-change"));
  }
  function lock(on) {
    document.body.classList.toggle("modal-lock", Boolean(on) && Boolean(document.querySelector(".g-modal:not(.hidden)")));
  }
  function openModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
    lock(true);
    var field = modal.querySelector("input, button");
    if (field) field.focus();
  }
  function closeModal(id) {
    var modal = $(id);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("hidden", "");
    if (!document.querySelector(".g-modal:not(.hidden)")) lock(false);
  }
  function switchTab(mode) {
    var join = mode === "join";
    show($("loginForm"), !join);
    show($("joinForm"), join);
    var loginBtn = $("tabLoginBtn");
    var joinBtn = $("tabJoinBtn");
    if (loginBtn) loginBtn.classList.toggle("is-on", !join);
    if (joinBtn) joinBtn.classList.toggle("is-on", join);
  }
  function openAuth(tab) {
    switchTab(tab === "join" ? "join" : "login");
    openModal("authModal");
  }
  window.openAuthModal = openAuth;
  window.closeAuthModal = function () { closeModal("authModal"); };

  var loginForm = $("loginForm");
  if (loginForm) loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = ($("loginEmail") && $("loginEmail").value || "").trim();
    var password = $("loginKey") ? $("loginKey").value : "";
    var error = $("loginError");
    var btn = $("loginSubmitBtn");
    var label = $("loginBtnText");
    show(error, false);
    if (btn) btn.disabled = true;
    text(label, "Verificando…");
    fetch(API + "/api/setups/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success) {
        saveSession(out.data.token, normalize(out.data.user || { email: email }, email));
        if ($("loginKey")) $("loginKey").value = "";
        if (out.data.must_change_password) { openModal("changePasswordModal"); return; }
        var redirect = "";
        try { redirect = new URLSearchParams(location.search).get("redirect") || ""; } catch (err) {}
        if (redirect.charAt(0) === "/" && redirect.charAt(1) !== "/") location.href = redirect;
        else location.reload();
        return;
      }
      text(error, out.data.error || "No se pudo verificar la credencial.");
      show(error, true);
    }).catch(function () {
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    }).then(function () {
      if (btn) btn.disabled = false;
      text(label, "Entrar");
    });
  });

  document.querySelectorAll("[data-auth-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-auth-tab")); });
  });
  document.querySelectorAll("[data-close-modal]").forEach(function (btn) {
    btn.addEventListener("click", function () { closeModal(btn.getAttribute("data-close-modal")); });
  });
  document.querySelectorAll("[data-toggle-pass]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = $(btn.getAttribute("data-toggle-pass"));
      if (!input) return;
      var showPass = input.type === "password";
      input.type = showPass ? "text" : "password";
      btn.textContent = showPass ? "Ocultar" : "Mostrar";
      btn.setAttribute("aria-pressed", showPass ? "true" : "false");
    });
  });

  var forgotOpen = $("forgotOpenBtn");
  if (forgotOpen) forgotOpen.addEventListener("click", function () {
    var email = $("loginEmail") && $("loginEmail").value.trim();
    if (email && $("forgotEmail") && !$("forgotEmail").value) $("forgotEmail").value = email;
    show($("forgotFeedback"), false);
    show($("forgotError"), false);
    openModal("forgotPasswordModal");
  });
  var forgotBtn = $("forgotSubmitBtn");
  if (forgotBtn) forgotBtn.addEventListener("click", function () {
    var email = ($("forgotEmail") && $("forgotEmail").value || "").trim();
    var feedback = $("forgotFeedback");
    var error = $("forgotError");
    show(feedback, false);
    show(error, false);
    forgotBtn.disabled = true;
    fetch(API + "/api/setups/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success) {
        text(feedback, out.data.message || "Si el correo pertenece a un piloto autorizado, recibirás un enlace.");
        show(feedback, true);
      } else {
        text(error, out.data.error || "No se pudo procesar la solicitud.");
        show(error, true);
      }
    }).catch(function () {
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    }).then(function () { forgotBtn.disabled = false; });
  });

  var joinForm = $("joinForm");
  if (joinForm) joinForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var feedback = $("joinFeedback");
    var error = $("joinError");
    var btn = $("joinSubmitBtn");
    show(feedback, false);
    show(error, false);
    if (btn) btn.disabled = true;
    fetch(API + "/api/setups/request-join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ($("reqName") && $("reqName").value || "").trim(),
        email: ($("reqEmail") && $("reqEmail").value || "").trim(),
        message: ($("reqMessage") && $("reqMessage").value || "").trim(),
        website: ($("reqWebsite") && $("reqWebsite").value) || ""
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success) {
        if (feedback) feedback.innerHTML = esc(out.data.message || "Hemos recibido tu solicitud.");
        show(feedback, true);
        joinForm.reset();
      } else {
        text(error, out.data.error || "Error al enviar la solicitud.");
        show(error, true);
      }
    }).catch(function () {
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    }).then(function () { if (btn) btn.disabled = false; });
  });

  function openSetPassword(next) {
    setPwToken = next;
    var intro = $("setPwIntro");
    var form = $("setPasswordForm");
    var error = $("setPwError");
    show(form, false);
    show(error, false);
    text(intro, "Comprobando enlace…");
    openModal("setPasswordModal");
    fetch(API + "/api/setups/password/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: next, check_only: true })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success) {
        var who = out.data.name ? out.data.name + " (" + out.data.email + ")" : out.data.email;
        text(intro, (out.data.purpose === "reset" ? "Elige una nueva contraseña para " : "Crea tu contraseña para ") + (who || "tu cuenta") + ".");
        show(form, true);
      } else {
        text(intro, "");
        text(error, out.data.error || "El enlace no es válido.");
        show(error, true);
      }
    }).catch(function () {
      text(intro, "");
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    });
  }
  var setForm = $("setPasswordForm");
  if (setForm) setForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("setPwNew") ? $("setPwNew").value : "";
    var confirm = $("setPwConfirm") ? $("setPwConfirm").value : "";
    var error = $("setPwError");
    var btn = $("setPwBtn");
    show(error, false);
    if (pw.length < 10) { text(error, "La contraseña debe tener al menos 10 caracteres."); show(error, true); return; }
    if (pw !== confirm) { text(error, "Las contraseñas no coinciden."); show(error, true); return; }
    if (btn) btn.disabled = true;
    fetch(API + "/api/setups/password/set", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: setPwToken, new_password: pw })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success && out.data.token) {
        saveSession(out.data.token, out.data.user);
        location.href = "/garage/";
      } else {
        text(error, out.data.error || "No se pudo guardar la contraseña.");
        show(error, true);
      }
    }).catch(function () {
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    }).then(function () { if (btn) btn.disabled = false; });
  });

  var changeForm = $("changePasswordForm");
  if (changeForm) changeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = $("newPassInput") ? $("newPassInput").value : "";
    var confirm = $("confirmPassInput") ? $("confirmPassInput").value : "";
    var error = $("changePassError");
    var btn = $("changePassBtn");
    show(error, false);
    if (pw.length < 10) { text(error, "La contraseña debe tener al menos 10 caracteres."); show(error, true); return; }
    if (pw !== confirm) { text(error, "Las contraseñas no coinciden."); show(error, true); return; }
    if (btn) btn.disabled = true;
    fetch(API + "/api/setups/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (token || "") },
      body: JSON.stringify({ new_password: pw })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
    }).then(function (out) {
      if (out.res.ok && out.data.success) {
        if (out.data.token) saveSession(out.data.token, out.data.user);
        location.reload();
      } else {
        text(error, out.data.error || "Error al actualizar la contraseña.");
        show(error, true);
      }
    }).catch(function () {
      text(error, "Error de conexión con el servidor.");
      show(error, true);
    }).then(function () { if (btn) btn.disabled = false; });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    ["changePasswordModal", "setPasswordModal", "forgotPasswordModal", "authModal"].forEach(closeModal);
  });

  var params = new URLSearchParams(location.search);
  var setpw = params.get("setpw");
  // Enlaces antiguos de correo (/setups#admin → /garage#admin) y redirecciones desde /admin.
  if (location.hash === "#admin" && !params.get("redirect")) {
    params.set("redirect", "/admin?tab=directory");
    params.set("auth", "admin");
    try { history.replaceState({}, "", location.pathname + "?" + params.toString()); } catch (e) {}
  }
  var wantsAdmin = params.get("auth") === "admin" || params.get("auth") === "expired";
  var redirectTo = params.get("redirect") || "";
  var hasSession = false;
  try {
    var t0 = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token");
    var u0 = JSON.parse(localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user") || "null");
    hasSession = Boolean(t0 && t0 !== "guest_token" && u0 && u0.email && u0.role !== "guest");
    if (hasSession && params.get("auth") === "admin" && u0.role !== "admin" && String(u0.email).toLowerCase() !== ADMIN) hasSession = false;
  } catch (e) {}
  if (setpw) {
    params.delete("setpw");
    var qs = params.toString();
    try { history.replaceState({}, "", location.pathname + (qs ? "?" + qs : "") + location.hash); } catch (e) {}
    openSetPassword(setpw);
  } else if (wantsAdmin && hasSession && params.get("auth") === "admin" && redirectTo.charAt(0) === "/" && redirectTo.charAt(1) !== "/") {
    location.replace(redirectTo);
  } else if (wantsAdmin) {
    openAuth("login");
  } else if (params.get("mode") === "login" || location.hash === "#login") {
    openAuth("login");
  } else if (params.get("mode") === "join" || location.hash === "#join") {
    openAuth("join");
  }
})();
