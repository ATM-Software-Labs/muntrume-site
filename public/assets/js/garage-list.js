(function () {
  "use strict";
  var PAGE = 24;
  var metaEl = document.getElementById("garageMeta");
  var meta = {};
  try { meta = metaEl ? JSON.parse(metaEl.textContent || "{}") : {}; } catch (e) { meta = {}; }
  var labels = meta.labels || {};
  var brandByCar = meta.brandByCar || {};
  var brandPaths = meta.brandPaths || {};
  var carsByTrack = meta.carsByTrack || {};
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
  var multiCars = [];

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
  function tr(key, fallback) {
    var value = window.muntruI18n && window.muntruI18n.t && window.muntruI18n.t(key);
    return value == null ? fallback : value;
  }
  function fill(key, fallback, vars) {
    var text = tr(key, fallback);
    if (!vars) return text;
    Object.keys(vars).forEach(function (name) {
      text = text.split("{" + name + "}").join(String(vars[name]));
    });
    return text;
  }
  function kindLabelOf(kind) {
    return tr("garage.kind." + kind, { race: "Carrera", qualy: "Clasificación", wet: "Lluvia", endurance: "Resistencia" }[kind] || kind);
  }
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
    list.querySelectorAll("[data-download]").forEach(function (btn) {
      if (btn.dataset.busy === "1") return;
      btn.dataset.auth = "in";
      btn.textContent = tr("garage.dl.in", "Descargar");
    });
  }
  function normText(s) {
    var v = String(s || "").toLowerCase();
    return v.normalize ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : v;
  }
  function filtered() {
    var q = normText((search && search.value || "").trim());
    var kind = type && type.value || "";
    return rows.filter(function (row) {
      if (kind && row.kind !== kind) return false;
      if (!q) return true;
      return normText(row.carLabel + " " + row.track + " " + row.file + " " + kindLabelOf(row.kind)).indexOf(q) !== -1;
    });
  }
  function carCellHtml(carId, carLabel) {
    var key = String(carId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    var b = brandByCar[key];
    var p = b && brandPaths[b.logo];
    if (!p) return esc(carLabel);
    return "<span class=\"g2-carcell\">" +
      "<svg class=\"g2-brand\" viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" aria-hidden=\"true\" style=\"color:" + esc(b.color || "currentColor") + "\">" +
      "<path fill=\"currentColor\" d=\"" + esc(p) + "\"></path></svg>" +
      "<span>" + esc(carLabel) + "</span></span>";
  }
  function setupTags(file, kind) {
    var stem = String(file || "").replace(/\.sto$/i, "");
    var tags = [];
    if (/(?:^|_)SAFE?(?:_|$)/i.test(stem)) tags.push("Safe");
    if (/(?:^|_)END(?:U|URANCE)?(?:_|$)/i.test(stem) && kind !== "endurance") tags.push("Endurance");
    var df = stem.match(/(?:^|_)(LDF|MDF|HDF)(?:_|$)/i);
    if (df) tags.push(df[1].toUpperCase());
    var ver = stem.match(/(?:^|_)(V\d+)(?:_|$)/i);
    if (ver) tags.push(ver[1].toUpperCase());
    return tags;
  }
  function trackLayoutTags(file, track) {
    var stem = String(file || "").replace(/\.sto$/i, "");
    var trk = String(track || "").toLowerCase();
    var tags = [];
    var rules = [
      [/(?:^|_)VLN(?:_|$)/i, "VLN"],
      [/(?:^|_)24H(?:_|$)/i, "24h"],
      [/(?:^|_)NORD(?:SCHLEIFE)?(?:_|$)/i, "Nordschleife"],
      [/(?:^|_)GP(?:_|$)/i, "GP"],
      [/(?:^|_)ROVAL(?:_|$)/i, "Roval"],
      [/(?:^|_)OVAL(?:_|$)/i, "Oval"],
      [/(?:^|_)BOOT(?:_|$)/i, "Boot"],
      [/(?:^|_)SHORT(?:_|$)/i, "Short"],
      [/(?:^|_)NAT(?:IONAL)?(?:_|$)/i, "National"],
      [/(?:^|_)INT(?:ERNATIONAL)?(?:_|$)/i, "International"],
      [/(?:^|_)NOCHICANE(?:_|$)/i, "No Chicane"]
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(stem) && trk.indexOf(rules[i][1].toLowerCase()) === -1) tags.push(rules[i][1]);
    }
    return tags;
  }
  function render() {
    var view = filtered().slice().sort(function (a, b) {
      var sa = (a.season || "") + " " + (a.week || "");
      var sb = (b.season || "") + " " + (b.week || "");
      return sb.localeCompare(sa);
    });
    var slice = view.slice(0, shown);
    if (!view.length) {
      list.innerHTML = "";
      setStatus(tr("garage.status.empty", "Ningún setup coincide con el filtro."), "empty");
      if (more) more.hidden = true;
      return;
    }
    list.innerHTML = slice.map(function (row) {
      var lTags = trackLayoutTags(row.file, row.track);
      var verParts = [row.season, row.week].concat(lTags).filter(Boolean);
      var verHtml = verParts.length ? "<span class=\"g2-meta\">" + esc(verParts.join(" · ")) + "</span>" : "";
      var sTags = setupTags(row.file, row.kind);
      var varHtml = sTags.map(function (t) { return "<span class=\"g2-var\">" + esc(t) + "</span>"; }).join("");
      return "<tr>" +
        "<td>" + carCellHtml(row.car, row.carLabel) + "</td>" +
        "<td><span class=\"g2-track\">" + esc(row.track) + "</span>" + verHtml + "</td>" +
        "<td>" + esc(kindLabelOf(row.kind)) + varHtml + "</td>" +
        "<td>" + esc(row.size) + "</td>" +
        "<td><div class=\"g2-actions\">" +
        "<button type=\"button\" class=\"g2-eye\" data-preview" +
        " data-id=\"" + esc(row.id) + "\"" +
        " data-file=\"" + esc(row.file) + "\"" +
        " data-car=\"" + esc(row.carLabel) + "\"" +
        " data-track=\"" + esc(row.track) + "\"" +
        " data-season=\"" + esc(row.season) + "\"" +
        " data-week=\"" + esc(row.week) + "\"" +
        " data-type=\"" + esc(kindLabelOf(row.kind)) + "\"" +
        " data-size=\"" + esc(row.size) + "\"" +
        " aria-label=\"Vista previa de " + esc(row.file) + "\" title=\"Vista previa del setup\">" +
        "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">" +
        "<path d=\"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z\"></path><circle cx=\"12\" cy=\"12\" r=\"3\"></circle>" +
        "</svg></button>" +
        "<button type=\"button\" class=\"g2-dl\" data-download data-id=\"" + esc(row.id) + "\" data-car=\"" + esc(row.car) + "\" data-file=\"" + esc(row.file) + "\" data-auth=\"in\">" + esc(tr("garage.dl.in", "Descargar")) + "</button>" +
        "</div></td>" +
        "</tr>";
    }).join("");
    paint();
    setStatus(fill(car && car.value ? "garage.status.count" : "garage.status.countIndex", car && car.value ? "{n} de {m}." : "{n} de {m} en el índice.", { n: slice.length, m: view.length }), "ready");
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
        season: String(r[2] || ""),
        week: String(r[3] || ""),
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
  function carsForQuery(q) {
    var nq = normText(String(q || "").trim());
    if (!nq || nq.length < 2) return [];
    var seen = {};
    var out = [];
    Object.keys(carsByTrack).forEach(function (trk) {
      var nt = normText(trk);
      if (nt.indexOf(nq) !== -1 || nq.indexOf(nt) !== -1) {
        (carsByTrack[trk] || []).forEach(function (c) {
          if (!seen[c]) { seen[c] = true; out.push(c); }
        });
      }
    });
    return out;
  }
  function apply() {
    var id = ++request;
    var selected = car && car.value || "";
    var targetCars = [];
    if (!selected && multiCars.length) {
      targetCars = multiCars;
    } else if (!selected && search && search.value.trim()) {
      targetCars = carsForQuery(search.value);
    }
    if (!selected && targetCars.length) {
      setStatus(tr("garage.status.loading", "Cargando catálogo…"), "loading");
      if (more) more.hidden = true;
      Promise.all(targetCars.map(function (c) {
        return load("/assets/data/catalog_by_car/" + slug(c) + ".json", "car:" + slug(c)).catch(function () { return []; });
      })).then(function (groups) {
        if (id !== request) return;
        rows = [].concat.apply([], groups);
        ready = true;
        if (shown < PAGE) shown = PAGE;
        render();
      }).catch(function () {
        if (id !== request) return;
        setStatus(tr("garage.status.error", "No se ha podido cargar el catálogo. Reintenta."), "error");
        if (more) more.hidden = true;
      });
      return;
    }
    var url = selected
      ? "/assets/data/catalog_by_car/" + slug(selected) + ".json"
      : "/assets/data/catalog_index.json";
    var key = selected ? "car:" + slug(selected) : "index";
    setStatus(tr("garage.status.loading", "Cargando catálogo…"), "loading");
    if (more) more.hidden = true;
    load(url, key).then(function (next) {
      if (id !== request) return;
      rows = next;
      ready = true;
      if (shown < PAGE) shown = PAGE;
      render();
    }).catch(function () {
      if (id !== request) return;
      setStatus(tr("garage.status.error", "No se ha podido cargar el catálogo. Reintenta."), "error");
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
    var selected = car && car.value || "";
    if (!ready || (!selected && !multiCars.length && carsForQuery(search.value).length)) queue();
    else { shown = PAGE; render(); }
  });
  if (type) type.addEventListener("change", function () {
    if (!ready) queue();
    else { shown = PAGE; render(); }
  });
  if (car) car.addEventListener("change", function () {
    multiCars = [];
    queue();
  });
  if (more) more.addEventListener("click", function () {
    if (!ready) { shown = PAGE * 2; apply(); return; }
    shown += PAGE;
    render();
  });
  window.addEventListener("muntrume-auth-change", paint);
  document.addEventListener("muntru:i18n", function () { paint(); if (ready) render(); });
  paint();

  // Auto-select car/cars and track/query from URL parameters
  try {
    var params = new URLSearchParams(window.location.search);
    var paramTrack = params.get("track") || params.get("q");
    if (paramTrack && search) {
      search.value = paramTrack.trim();
    }
    var paramCar = params.get("car");
    var paramCars = params.get("cars");
    if (paramCar && car) {
      var needle = paramCar.trim().toLowerCase();
      var matched = "";
      for (var i = 0; i < car.options.length; i++) {
        var opt = car.options[i];
        if (!opt.value) continue;
        if (opt.value.toLowerCase() === needle || (opt.textContent || "").trim().toLowerCase() === needle) {
          matched = opt.value;
          break;
        }
      }
      if (!matched) {
        for (var j = 0; j < car.options.length; j++) {
          var opt2 = car.options[j];
          if (!opt2.value) continue;
          if ((opt2.textContent || "").toLowerCase().indexOf(needle) !== -1) {
            matched = opt2.value;
            break;
          }
        }
      }
      if (matched) {
        car.value = matched;
        queue();
      } else if (paramTrack) {
        queue();
      }
    } else if (paramCars) {
      multiCars = paramCars.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      if (multiCars.length) queue();
    } else if (paramTrack) {
      queue();
    }
  } catch (e) {}
})();
