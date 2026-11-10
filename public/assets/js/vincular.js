(function () {
  var API = "https://muntrume.atrumin16.workers.dev";
  var params = new URLSearchParams(location.search);
  var code = params.get("code") || "";
  var codeEl = document.getElementById("vincularCode");
  var lead = document.getElementById("vincularLead");
  var status = document.getElementById("vincularStatus");
  var login = document.getElementById("vincularLogin");
  var approve = document.getElementById("vincularApprove");
  var who = document.getElementById("vincularWho");
  var next = location.pathname + location.search;
  if (login) login.href = "/login/?next=" + encodeURIComponent(next);
  if (!/^[A-Za-z0-9-]{4,64}$/.test(code)) {
    if (codeEl) codeEl.textContent = "Sin código";
    if (lead) lead.textContent = "Abre esta página desde MMT Sync. El enlace trae el código del dispositivo.";
    if (login) login.hidden = true;
    return;
  }
  if (codeEl) codeEl.textContent = code;
  function token() {
    try {
      var value = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token") || "";
      if (!value || value === "guest_token" || value === "local_session") return "";
      return value;
    } catch (e) { return ""; }
  }
  function userName() {
    try {
      var raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user") || "";
      if (!raw) return "";
      var user = JSON.parse(raw);
      return user.name || user.email || "";
    } catch (e) { return ""; }
  }
  function showLogged(name) {
    if (login) login.hidden = true;
    if (approve) approve.hidden = false;
    if (who && name) {
      who.hidden = false;
      who.textContent = "Sesión: " + name;
    }
  }
  var stored = token();
  if (stored) showLogged(userName());
  else {
    fetch(API + "/api/session", { credentials: "include" }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (data && (data.user || data.authenticated || data.token)) showLogged((data.user && (data.user.name || data.user.email)) || "");
    }).catch(function () {});
  }
  if (approve) approve.addEventListener("click", function () {
    approve.disabled = true;
    var headers = { "Content-Type": "application/json" };
    var bearer = token();
    if (bearer) headers.Authorization = "Bearer " + bearer;
    fetch(API + "/api/desktop/auth/approve", {
      method: "POST",
      credentials: "include",
      headers: headers,
      body: JSON.stringify({ user_code: code })
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) {
        if (status) status.textContent = "La sesión no vale. Entra otra vez.";
        if (login) login.hidden = false;
        return;
      }
      if (!res.ok) {
        if (status) status.textContent = "No se pudo autorizar el dispositivo.";
        return;
      }
      if (lead) lead.textContent = "Dispositivo autorizado. Ya puedes volver a MMT Sync.";
      if (status) status.textContent = "";
      approve.hidden = true;
    }).catch(function () {
      if (status) status.textContent = "Sin conexión con el API.";
    }).finally(function () { approve.disabled = false; });
  });
})();
