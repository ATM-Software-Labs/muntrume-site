/* t273 · Home y plantilla: la instantánea de licencias ya está en el HTML.
   /api/drivers la sustituye solo cuando trae cifras. Coche favorito y carreras siguen en «Sin datos» si no vienen. */
(function () {
  var API = 'https://muntrume.atrumin16.workers.dev';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lang = (document.documentElement.lang || 'es');
  function parseLic(s) {
    var m = String(s || "").match(/^(Class\s+[A-D]|Rookie)\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (!m) return null;
    var label = /^rookie/i.test(m[1]) ? "Rookie" : m[1].replace(/\s+/g, " ").replace(/^class/i, "Class");
    return { classLabel: label, sr: Number(m[2]).toFixed(2) };
  }
  function paintLic(root, lic) {
    if (!root || !lic || !lic.category) return;
    var card = root.querySelector('[data-lic="' + lic.category + '"]');
    if (!card) return;
    if (lic.class_label || lic.classLabel) {
      var c = card.querySelector('[data-lic-f="class"]');
      if (c) c.textContent = lic.class_label || lic.classLabel;
    }
    if (lic.sr != null && lic.sr !== "") {
      var sr = card.querySelector('[data-lic-f="sr"]');
      if (sr) sr.textContent = Number(lic.sr).toFixed(2);
    }
    if (lic.irating === null) {
      var empty = card.querySelector('[data-lic-f="irating"]');
      if (empty) { empty.textContent = "Sin iRating"; empty.classList.add("r-nodata"); }
    } else if (lic.irating > 0) {
      var ir = card.querySelector('[data-lic-f="irating"]');
      if (ir) { ir.textContent = Number(lic.irating).toLocaleString(lang); ir.classList.remove("r-nodata"); }
    }
    if (lic.tt_rating > 0 || lic.ttRating > 0) {
      var tt = card.querySelector('[data-lic-f="tt"]');
      if (tt) tt.textContent = Number(lic.tt_rating || lic.ttRating).toLocaleString(lang);
    }
  }
  fetch(API + '/api/drivers').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    var latest = null, source = null;
    (Array.isArray(list) ? list : []).forEach(function (d) {
      var card = document.querySelector('[data-driver="' + d.slug + '"]');
      if (!card) return;
      var licenses = Array.isArray(d.licenses) ? d.licenses.slice() : [];
      if (!licenses.length && (d.irating > 0 || d.license)) {
        var parsed = parseLic(d.license);
        licenses.push({ category: "sports_car", class_label: parsed && parsed.classLabel, sr: parsed && parsed.sr, irating: d.irating > 0 ? d.irating : undefined });
      }
      licenses.forEach(function (lic) { paintLic(card, lic); });
      if (d.irating > 0) { var a = card.querySelector('[data-f="irating"]'); if (a) { a.textContent = Number(d.irating).toLocaleString(lang); a.classList.remove('r-nodata'); } }
      if (d.license) { var b = card.querySelector('[data-f="license"]'); if (b) { b.textContent = d.license; b.classList.remove('r-nodata'); } }
      var fc = card.querySelector('[data-f="fav_car"]'); if (fc && d.fav_car && d.fav_car.name) { fc.textContent = d.fav_car.name; fc.classList.remove('r-nodata'); }
      var tc = card.querySelector('[data-f="top_category"]'); if (tc && d.top_category && d.top_category.name) { tc.textContent = d.top_category.name; tc.classList.remove('r-nodata'); }
      if (d.updated_at && (!latest || d.updated_at > latest)) { latest = d.updated_at; source = d.source; }
    });
    if (latest) {
      var s = document.getElementById('driversSource');
      if (s) s.textContent = 'Fuente: ' + (source || 'iRacing') + ' · actualizado ' + new Date(latest).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
    }
  }).catch(function () {});
  fetch(API + '/api/events').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    var now = Date.now();
    var ev = (d && Array.isArray(d.events) ? d.events : []).filter(function (e) { return new Date(e.starts_at).getTime() >= now - 36e5 * 6; })
      .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }).slice(0, 5);
    var ul = document.getElementById('calList');
    if (!ev.length || !ul) return;
    ul.innerHTML = ev.map(function (e) {
      var dt = new Date(e.starts_at);
      return '<li><div class="r-row"><span class="r-meta">' + esc(dt.toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })) + '<br>' + esc(dt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })) + '</span><span><span class="r-h3">' + esc(e.title) + '</span><br><span class="r-meta">' + esc(e.track || 'iRacing') + '</span></span><span class="r-meta">' + esc(e.car_class || '') + '</span></div></li>';
    }).join('');
    ul.hidden = false; document.getElementById('calEmpty').hidden = true;
  }).catch(function () {});
})();
