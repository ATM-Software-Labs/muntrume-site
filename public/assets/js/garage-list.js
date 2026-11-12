(function () {
  "use strict";
  var PAGE = 24;
  var metaEl = document.getElementById("garageMeta");
  var meta = {};
  try { meta = metaEl ? JSON.parse(metaEl.textContent || "{}") : {}; } catch (e) { meta = {}; }
  var labels = meta.labels || {};
  var list = document.getElementById("garageList");
  var status = document.getElementById("garageStatus");
  var more = document.getElementById("garageMore");
  var search = document.getElementById("garageSearch");
  var car = document.getElementById("garageCar");
  var type = document.getElementById("garageType");
  if (!list || !status) return;

  var cache = {};
  var rows = [];
  var shown = list.children.length || 0;
  var ready = false;
  var request = 0;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function kindOf(setupType, file) {
    var t = String(setupType || "").toLowerCase();
    if (t === "qualy") return "qualy";
    if (t === "wet") return "wet";
    if (/end/i.test(file || "")) return "endurance";
    return "race";
  }
  var kindLabel = { race: "Carrera", qualy: "Clasificación", wet: "Lluvia", endurance: "Resistencia" };
  function sizeLabel(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return "—";
    return (n / 1024).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " KB";
  }
  function slug(id) {
    return String(id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  }
  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state || "ready";
  }
  function signedIn() {
    try {
      var token = localStorage.getItem("mrt_vault_token") || sessionStorage.getItem("mrt_vault_token");
      if (!token || token === "guest_token" || token === "local_session") return false;
      var raw = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
      if (!raw) return false;
      var user = JSON.parse(raw);
      return Boolean(user && user.email && user.role !== "guest");
    } catch (e) { return false; }
  }
  function paint() {
    var ok = signedIn();
    list.querySelectorAll("[data-download]").forEach(function (btn) {
      if (btn.dataset.busy === "1") return;
      btn.dataset.auth = ok ? "in" : "out";
      btn.textContent = ok ? "Descargar" : "Inicia sesión";
    });
  }
  function filtered() {
    var q = (search && search.value || "").trim().toLowerCase();
    var kind = type && type.value || "";
    return rows.filter(function (row) {
      if (kind && row.kind !== kind) return false;
      if (!q) return true;
      return (row.carLabel + " " + row.track + " " + row.file + " " + kindLabel[row.kind]).toLowerCase().indexOf(q) !== -1;
    });
  }
  function render() {
    var view = filtered();
    var slice = view.slice(0, shown);
    if (!view.length) {
      list.innerHTML = "";
      setStatus("Ningún setup coincide con el filtro.", "empty");
      if (more) more.hidden = true;
      return;
    }
    list.innerHTML = slice.map(function (row) {
      return "<tr>" +
        "<td>" + esc(row.carLabel) + "</td>" +
        "<td>" + esc(row.track) + "</td>" +
        "<td>" + esc(kindLabel[row.kind] || row.kind) + "</td>" +
        "<td>" + esc(row.size) + "</td>" +
        "<td><button type=\"button\" class=\"g2-dl\" data-download data-id=\"" + esc(row.id) + "\" data-file=\"" + esc(row.file) + "\" data-auth=\"pending\">Inicia sesión</button></td>" +
        "</tr>";
    }).join("");
    paint();
    setStatus(slice.length + " de " + view.length + (car && car.value ? "" : " en el índice") + ".", "ready");
    if (more) more.hidden = slice.length >= view.length;
  }
  function unpack(raw) {
    return (raw || []).map(function (r) {
      var file = String(r[5] || "");
      var kind = kindOf(r[6], file);
      var id = String(r[1] || "");
      return {
        id: r[0],
        car: id,
        carLabel: labels[id] || id,
        track: String(r[4] || ""),
        file: file,
        kind: kind,
        size: sizeLabel(r[7])
      };
    }).filter(function (row) { return row.file && row.car && row.track; });
  }
  function load(url, key) {
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error("http");
      return res.json();
    }).then(function (data) {
      var packed = Array.isArray(data) ? data : (data.initial_rows || []);
      cache[key] = unpack(packed);
      return cache[key];
    });
  }
  function apply() {
    var id = ++request;
    var selected = car && car.value || "";
    var url = selected
      ? "/assets/data/catalog_by_car/" + slug(selected) + ".json"
      : "/assets/data/catalog_index.json";
    var key = selected ? "car:" + slug(selected) : "index";
    setStatus("Cargando catálogo…", "loading");
    if (more) more.hidden = true;
    load(url, key).then(function (next) {
      if (id !== request) return;
      rows = next;
      ready = true;
      if (shown < PAGE) shown = PAGE;
      render();
    }).catch(function () {
      if (id !== request) return;
      setStatus("No se ha podido cargar el catálogo. Reintenta.", "error");
      if (more) more.hidden = true;
    });
  }
  function queue() {
    shown = PAGE;
    apply();
  }
  var form = document.getElementById("garageFilters");
  if (form) form.addEventListener("submit", function (e) { e.preventDefault(); });
  if (search) search.addEventListener("input", function () {
    if (!ready) queue();
    else { shown = PAGE; render(); }
  });
  if (type) type.addEventListener("change", function () {
    if (!ready) queue();
    else { shown = PAGE; render(); }
  });
  if (car) car.addEventListener("change", queue);
  if (more) more.addEventListener("click", function () {
    if (!ready) { shown = PAGE * 2; apply(); return; }
    shown += PAGE;
    render();
  });
  window.addEventListener("muntrume-auth-change", paint);
  paint();
})();
