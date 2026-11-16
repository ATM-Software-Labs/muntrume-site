(function () {
  var API = "https://muntrume.atrumin16.workers.dev";
  var params = new URLSearchParams(location.search);
  var code = params.get("code") || "";
  var codeEl = document.getElementById("vincularCode");
  var lead = document.getElementById("vincularLead");
  var status = document.getElementById("vincularStatus");
  var login = document.getElementById("vincularLogin");
  var approve = document.getElementById("vincularApprove");
  var generateBtn = document.getElementById("vincularGenerate");
  var manualBox = document.getElementById("vincularManualBox");
  var manualInput = document.getElementById("vincularManualInput");
  var manualApply = document.getElementById("vincularManualApply");
  var who = document.getElementById("vincularWho");
  var isLogged = false;

  function updateLoginLink() {
    if (!login) return;
    var next = location.pathname + (code ? "?code=" + encodeURIComponent(code) : "");
    login.href = "/login/?next=" + encodeURIComponent(next);
  }

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
    isLogged = true;
    if (login) login.hidden = true;
    if (approve) approve.hidden = !/^[A-Za-z0-9-]{4,64}$/.test(code);
    if (who && name) {
      who.hidden = false;
      who.textContent = "Sesión: " + name;
    }
  }

  function setCode(nextCode) {
    code = (nextCode || "").trim();
    if (codeEl) codeEl.textContent = code || "—";
    if (approve) approve.hidden = !(isLogged && /^[A-Za-z0-9-]{4,64}$/.test(code));
    updateLoginLink();
  }

  function generateCode() {
    if (generateBtn) generateBtn.disabled = true;
    if (status) status.textContent = "Generando código de vinculación…";
    fetch(API + "/api/desktop/auth/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).then(function (res) {
      if (!res.ok) throw new Error("No se pudo generar el código.");
      return res.json();
    }).then(function (data) {
      var userCode = (data && data.user_code) ? String(data.user_code) : "";
      if (!userCode) throw new Error("Respuesta sin código.");
      setCode(userCode);
      if (lead) lead.textContent = "Código generado. Autorízalo con tu sesión o introdúcelo en MMT Sync.";
      if (status) status.textContent = "Código listo.";
    }).catch(function () {
      if (status) status.textContent = "No se pudo conectar para generar el código.";
    }).finally(function () {
      if (generateBtn) generateBtn.disabled = false;
    });
  }

  if (/^[A-Za-z0-9-]{4,64}$/.test(code)) {
    setCode(code);
  } else {
    if (generateBtn) generateBtn.hidden = false;
    if (manualBox) manualBox.hidden = false;
    generateCode();
  }

  var stored = token();
  if (stored) {
    showLogged(userName());
  } else {
    fetch(API + "/api/session", { credentials: "include" }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      if (data && (data.user || data.authenticated || data.token)) {
        showLogged((data.user && (data.user.name || data.user.email)) || "");
      }
    }).catch(function () {});
  }

  if (generateBtn) generateBtn.addEventListener("click", generateCode);

  if (manualApply && manualInput) {
    manualApply.addEventListener("click", function () {
      var val = manualInput.value.trim();
      if (!/^[A-Za-z0-9-]{4,64}$/.test(val)) {
        if (status) status.textContent = "Introduce un código válido (4-64 caracteres).";
        return;
      }
      setCode(val);
      if (status) status.textContent = "Código aplicado: " + val;
    });
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
