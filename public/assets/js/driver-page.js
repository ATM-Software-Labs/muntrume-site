/* t273 · Ficha: instantánea de licencias en el HTML. /api/drivers la sustituye si trae datos. */
(function () {
  var root = document.getElementById('driverRoot'); if (!root) return;
  var slug = root.getAttribute('data-driver');
  var lang = document.documentElement.lang || 'es';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var set = function (f, val) { var el = document.querySelector('[data-f="' + f + '"]'); if (el && val != null && val !== '') { el.textContent = val; el.classList.remove('r-nodata'); } };
  function parseLic(s) {
    var m = String(s || "").match(/^(Class\s+[A-D]|Rookie)\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (!m) return null;
    return { classLabel: /^rookie/i.test(m[1]) ? "Rookie" : m[1].replace(/\s+/g, " ").replace(/^class/i, "Class"), sr: Number(m[2]).toFixed(2) };
  }
  function paintLic(lic) {
    if (!lic || !lic.category) return;
    var card = root.querySelector('[data-lic="' + lic.category + '"]');
    if (!card) return;
    if (lic.class_label || lic.classLabel) card.querySelector('[data-lic-f="class"]').textContent = lic.class_label || lic.classLabel;
    if (lic.sr != null && lic.sr !== "") card.querySelector('[data-lic-f="sr"]').textContent = Number(lic.sr).toFixed(2);
    var ir = card.querySelector('[data-lic-f="irating"]');
    if (ir && lic.irating === null) { ir.textContent = "Sin iRating"; ir.classList.add("r-nodata"); }
    else if (ir && lic.irating > 0) { ir.textContent = Number(lic.irating).toLocaleString(lang); ir.classList.remove("r-nodata"); }
    var tt = card.querySelector('[data-lic-f="tt"]');
    if (tt && (lic.tt_rating > 0 || lic.ttRating > 0)) tt.textContent = Number(lic.tt_rating || lic.ttRating).toLocaleString(lang);
  }
  fetch('https://muntrume.atrumin16.workers.dev/api/drivers?slug=' + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d) return;
    var licenses = Array.isArray(d.licenses) ? d.licenses.slice() : [];
    if (!licenses.length && (d.irating > 0 || d.license)) {
      var parsed = parseLic(d.license);
      licenses.push({ category: "sports_car", class_label: parsed && parsed.classLabel, sr: parsed && parsed.sr, irating: d.irating > 0 ? d.irating : undefined });
    }
    licenses.forEach(paintLic);
    if (d.irating > 0) set('irating', Number(d.irating).toLocaleString(lang));
    set('license', d.license);
    if (d.fav_car && d.fav_car.name) { set('fav_car', d.fav_car.name); set('fav_car_n', d.fav_car.count + ' de ' + d.fav_car.sample + ' carreras'); }
    if (d.top_category && d.top_category.name) { set('top_category', d.top_category.name); set('top_category_n', d.top_category.count + ' de ' + d.top_category.sample + ' carreras'); }
    if (d.updated_at) document.getElementById('dSource').textContent = 'Fuente: ' + (d.source || 'iRacing') + ' · actualizado ' + new Date(d.updated_at).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
    var races = Array.isArray(d.recent_races) ? d.recent_races.slice(0, 5) : [];
    if (!races.length) return;
    var dash = '<span class="r-nodata">—</span>';
    document.getElementById('racesBody').innerHTML = races.map(function (r) {
      var ch = r.irating_change;
      var chs = (ch == null) ? dash : '<span class="' + (ch >= 0 ? 'r-up' : 'r-down') + '">' + (ch > 0 ? '+' : '') + ch + '</span>';
      return '<tr><td class="r-meta">' + (r.date ? esc(new Date(r.date).toLocaleDateString(lang, { day: '2-digit', month: 'short', year: 'numeric' })) : dash) + '</td><td>' + (esc(r.series) || dash) + '</td><td>' + (esc(r.track) || dash) + '</td><td>' + (esc(r.car) || dash) + '</td><td class="num">' + (r.start != null ? 'P' + r.start : '—') + ' → ' + (r.finish != null ? '<strong>P' + r.finish + '</strong>' : '—') + '</td><td class="num">' + (r.incidents != null ? r.incidents + 'x' : '—') + '</td><td class="num">' + chs + '</td></tr>';
    }).join('');
    document.getElementById('racesWrap').hidden = false; document.getElementById('racesEmpty').hidden = true;
  }).catch(function () {});
})();
