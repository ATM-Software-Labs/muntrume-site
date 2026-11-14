/* t266 · Vincular el ID de iRacing (cust_id) de cada piloto. Admin: todos (con código de verificación). Piloto: solo su ficha. */
(function () {
  var API = "https://muntrume.atrumin16.workers.dev/api/setups/";
  var box = document.getElementById("driverIdsPanel");
  if (!box) return;
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var store = function () { return localStorage.getItem("mrt_vault_token") ? localStorage : sessionStorage; };
  var token = function () { return store().getItem("mrt_vault_token"); };
  var user = function () { try { return JSON.parse(store().getItem("mrt_vault_user") || "null"); } catch (e) { return null; } };
  function post(path, body) {
    return fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); });
  }
  function msg(t, err) { var m = document.getElementById("driverIdsMsg"); if (m) { m.textContent = t; m.style.color = err ? "#f87171" : "#34d399"; } }
  function call(body) {
    return post("driver/iracing", body);
  }
  function render(list, isAdmin) {
    if (!list.length) { box.innerHTML = '<p class="text-xs text-neutral-400">No hay ninguna ficha de piloto vinculada a tu cuenta. Pide a Race Control que vincule tu email.</p>'; return; }
    box.innerHTML = list.map(function (d) {
      return '<form class="grid grid-cols-1 sm:grid-cols-[1fr_8rem' + (isAdmin ? "_12rem" : "") + '_auto] gap-2 items-end py-2 border-b border-white/5" data-slug="' + esc(d.slug) + '">' +
        '<div class="text-xs"><div class="text-white font-bold">' + esc(d.name) + '</div><div class="text-neutral-500 font-mono">/d/' + esc(d.slug) + (d.updated_at ? " · " + esc(new Date(d.updated_at).toLocaleString("es-ES")) : "") + '</div></div>' +
        '<label class="text-[11px] text-neutral-400">ID iRacing<input name="cust_id" inputmode="numeric" pattern="\\d{1,10}" value="' + esc(d.cust_id || "") + '" class="w-full bg-[#0b0e13] border border-white/10 rounded-lg px-2 py-1.5 text-white font-mono"></label>' +
        (isAdmin ? '<label class="text-[11px] text-neutral-400">Email del piloto (para que lo edite él)<input name="email" type="email" value="' + esc(d.email || "") + '" class="w-full bg-[#0b0e13] border border-white/10 rounded-lg px-2 py-1.5 text-white"></label>' : "") +
        '<button class="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold">Guardar</button></form>';
    }).join("");
    box.querySelectorAll("form").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var body = { op: "save", slug: f.getAttribute("data-slug"), cust_id: f.cust_id.value.trim() };
        if (f.email) body.email = f.email.value.trim();
        call(body).then(function (o) { msg(o.data.success ? "Guardado. Los datos de iRacing se actualizarán en la próxima sincronización." : (o.data.error || "Error"), !o.data.success); });
      });
    });
  }
  window.loadDriverIds = function () {
    if (!token()) { box.innerHTML = '<p class="text-xs text-neutral-400">Inicia sesión en <a class="text-emerald-400 underline" href="/garage">el Garage</a> y vuelve aquí.</p>'; return; }
    var u = user();
    call({ op: "list" }).then(function (o) {
      if (!o.data.success) { msg(o.data.error || "Error", true); return; }
      render(o.data.drivers || [], !!(u && u.role === "admin"));
    });
  };
  var btn = document.getElementById("driverIdsLoad");
  if (btn) btn.addEventListener("click", window.loadDriverIds);
})();
