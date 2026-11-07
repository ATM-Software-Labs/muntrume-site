/* t273 · Ficha: instantánea de licencias en el HTML. /api/drivers la sustituye si trae datos. */
(function () {
  var root = document.getElementById('driverRoot'); if (!root) return;
  var slug = root.getAttribute('data-driver');
  var lang = document.documentElement.lang || 'es';
  function loc() { return window.muntruLocale ? window.muntruLocale(document.documentElement.lang || lang) : "es-ES"; }
  function approx(el, kind, value) {
    if (!el || !window.muntruFormato || value == null || value === "") return;
    el.setAttribute("data-n", String(value));
    el.setAttribute("data-approx", kind);
    el.textContent = window.muntruFormato(value, kind, loc());
    el.classList.remove("r-nodata");
  }
  function reformatApprox() {
    if (!window.muntruFormato) return;
    root.querySelectorAll("[data-approx][data-n]").forEach(function (el) {
      var raw = el.getAttribute("data-n");
      if (raw === "") return;
      el.textContent = window.muntruFormato(raw, el.getAttribute("data-approx"), loc());
    });
  }
  document.addEventListener("muntru:i18n", reformatApprox);
  reformatApprox();
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var set = function (f, val) { var el = document.querySelector('[data-f="' + f + '"]'); if (el && val != null && val !== '') { el.textContent = val; el.classList.remove('r-nodata'); } };
  function isRoadTrack(name, category) {
    var clean = String(name || "").trim();
    if (!clean) return true;
    if (category && /oval|dirt/i.test(category) && !/road/i.test(category)) return false;
    if (/\b(oval|roval|superspeedway|tri-oval|short\s*track|dirt\s*oval)\b/i.test(clean)) return false;
    if (/\bspeedway\b/i.test(clean) && !/\broad(\s*course)?\b/i.test(clean)) return false;
    return true;
  }
  document.querySelectorAll("[data-toggle-bars]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var listId = btn.getAttribute("data-toggle-bars");
      var listEl = listId ? document.getElementById(listId) : null;
      if (!listEl) return;
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var nextState = !expanded;
      var totalCount = btn.getAttribute("data-total-count") || "";
      var unit = btn.getAttribute("data-label-unit") || "elementos";
      listEl.querySelectorAll('[data-extra-bar="true"]').forEach(function (li) {
        li.hidden = !nextState;
      });
      listEl.classList.toggle("is-expanded", nextState);
      btn.setAttribute("aria-expanded", nextState ? "true" : "false");
      btn.textContent = nextState
        ? "Mostrar resumen (Top 5) ▴"
        : "Ver lista completa (" + totalCount + " " + unit + ") ▾";
    });
  });
  function parseLic(s) {
    var m = String(s || "").match(/^(Class\s+[A-D]|Rookie)\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (!m) return null;
    return { classLabel: /^rookie/i.test(m[1]) ? "Rookie" : m[1].replace(/\s+/g, " ").replace(/^class/i, "Class"), sr: Number(m[2]).toFixed(2) };
  }
  function showList(block, items) {
    var box = root.querySelector('[data-block="' + block + '"]');
    var ul = box && box.querySelector("ul");
    var names = (items || []).map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    if (!ul || !names.length) return;
    ul.replaceChildren.apply(ul, names.map(function (name) {
      var li = document.createElement("li");
      li.textContent = name;
      return li;
    }));
    box.hidden = false;
  }
  function showText(block, value) {
    var box = root.querySelector('[data-block="' + block + '"]');
    var slot = box && box.querySelector("[data-f]");
    var text = String(value || "").trim();
    if (!box || !slot || !text) return;
    slot.textContent = text;
    box.hidden = false;
  }
  function showMeta(block, value) {
    var box = root.querySelector('[data-block="' + block + '"]');
    var slot = root.querySelector('[data-f="' + block + '_value"]');
    var text = String(value || "").trim();
    if (!box || !slot || !text) return;
    slot.textContent = text;
    box.hidden = false;
  }
  function paintLic(lic) {
    if (!lic || !lic.category) return;
    var card = root.getAttribute("data-lic") === lic.category ? root : root.querySelector('[data-lic="' + lic.category + '"]');
    if (!card) return;
    if (lic.class_label || lic.classLabel) {
      var cls = card.querySelector('[data-lic-f="class"]');
      if (cls) cls.textContent = lic.class_label || lic.classLabel;
    }
    if (lic.sr != null && lic.sr !== "") approx(card.querySelector('[data-lic-f="sr"]'), "sr", lic.sr);
    var ir = card.querySelector('[data-lic-f="irating"]');
    if (ir && lic.irating > 0) approx(ir, "k", lic.irating);
    if (lic.tt_rating > 0 || lic.ttRating > 0) approx(card.querySelector('[data-lic-f="tt"]'), "k", lic.tt_rating || lic.ttRating);
  }
  fetch('https://muntrume.atrumin16.workers.dev/api/drivers?slug=' + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    var licenses = Array.isArray(d.licenses) ? d.licenses.slice() : [];
    if (!licenses.length && (d.irating > 0 || d.license)) {
      var parsed = parseLic(d.license);
      licenses.push({ category: "sports_car", class_label: parsed && parsed.classLabel, sr: parsed && parsed.sr, irating: d.irating > 0 ? d.irating : undefined });
    }
    licenses.forEach(paintLic);
    if (d.role) set("role", d.role);
    if (d.specialty) set("specialty", d.specialty);
    if (d.irating > 0) approx(root.querySelector('[data-f="irating"]'), "k", d.irating);
    if (d.fav_car && d.fav_car.name) showList("cars", [d.fav_car.name]);
    if (d.top_category && d.top_category.name) showList("series", [d.top_category.name]);
    if (d.bio) showText("bio", d.bio);
    showMeta("member_since", d.member_since || d.memberSince);
    showMeta("club", d.club || d.club_name);
    if (d.updated_at) {
      var stamp = document.querySelector("#licenceUpdated time");
      var when = new Date(d.updated_at);
      if (stamp && !isNaN(when.getTime())) {
        stamp.dateTime = d.updated_at;
        stamp.textContent = when.toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
      }
    }
    var races = (Array.isArray(d.recent_races) ? d.recent_races : []).filter(function (r) {
      return isRoadTrack(r && r.track, r && r.category);
    }).slice(0, 5);
    if (!races.length) return;
    var racesSection = document.getElementById("racesSection");
    if (racesSection) racesSection.hidden = false;
    var dash = '<span class="r-nodata">—</span>';
    document.getElementById('racesBody').innerHTML = races.map(function (r) {
      var ch = r.irating_change;
      var chs = (ch == null) ? dash : '<span class="' + (ch >= 0 ? 'r-up' : 'r-down') + '">' + (ch > 0 ? '+' : '') + ch + '</span>';
      return '<tr><td class="r-meta">' + (r.date ? esc(new Date(r.date).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })) : dash) + '</td><td>' + (esc(r.series) || dash) + '</td><td>' + (esc(r.track) || dash) + '</td><td>' + (esc(r.car) || dash) + '</td><td class="num">' + (r.start != null ? 'P' + r.start : '—') + ' → ' + (r.finish != null ? '<strong>P' + r.finish + '</strong>' : '—') + '</td><td class="num">' + (r.incidents != null ? r.incidents + 'x' : '—') + '</td><td class="num">' + chs + '</td></tr>';
    }).join('');
    var wrap = document.getElementById('racesWrap');
    if (wrap) wrap.hidden = false;
  }).catch(function () {});
  fetch('https://muntrume.atrumin16.workers.dev/api/events').then(function (r) { return r.ok ? r.json() : null; }).then(function (payload) {
    var now = Date.now();
    var ev = (payload && Array.isArray(payload.events) ? payload.events : []).filter(function (e) { return e && e.starts_at && new Date(e.starts_at).getTime() >= now - 36e5 * 6; })
      .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }).slice(0, 5);
    var list = document.getElementById('driverEvents');
    var empty = document.getElementById('driverEventsEmpty');
    var section = document.getElementById('eventos');
    var tab = document.getElementById('eventosTab');
    if (!ev.length || !list || !section) return;
    list.innerHTML = ev.map(function (e) {
      var dt = new Date(e.starts_at);
      return '<li><div class="r-row"><span class="r-meta">' + esc(dt.toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })) + '</span><span><strong class="r-h3">' + esc(e.title || '') + '</strong>' + (e.track ? '<br><span class="r-meta">' + esc(e.track) + '</span>' : '') + '</span><span class="r-meta">' + esc(e.car_class || '') + '</span></div></li>';
    }).join('');
    list.hidden = false;
    if (empty) empty.hidden = true;
    section.hidden = false;
    if (tab) tab.hidden = false;
  }).catch(function () {});
})();
