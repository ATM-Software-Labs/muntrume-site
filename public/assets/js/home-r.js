/* t264/t265 · Home: estadísticas reales (/api/drivers) y calendario real (/api/events). Sin datos → «Sin datos». */
(function () {
  var API = 'https://muntrume.atrumin16.workers.dev';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var lang = (document.documentElement.lang || 'es');
  fetch(API + '/api/drivers').then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
    var latest = null, source = null;
    (Array.isArray(list) ? list : []).forEach(function (d) {
      var card = document.querySelector('[data-driver="' + d.slug + '"]');
      if (!card) return;
      if (d.irating > 0) { var a = card.querySelector('[data-f="irating"]'); a.textContent = Number(d.irating).toLocaleString(lang); a.classList.remove('r-nodata'); }
      if (d.license) { var b = card.querySelector('[data-f="license"]'); b.textContent = d.license; b.classList.remove('r-nodata'); }
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
