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
  function isSportsCarVehicle(carName) {
    var clean = String(carName || "").trim();
    if (!clean) return false;
    if (/\b(gtp|hypercar|lmdh|lmp[123]?|hpd|arx-0[1-6]|963|499p|valkyrie|v-series\.r|m\s*hybrid\s*v8|sc63|a424)\b/i.test(clean)) return false;
    if (/\b(formula|super\s*formula|sf23|f[1234]|ir-04|ir18|dallara\s*f3|dallara\s*ir|indy|lotus\s*49|lotus\s*79|skip\s*barber|ray\s*ff1600|vee|usf\s*2000|pro\s*2000)\b/i.test(clean)) return false;
    if (/\b(nascar|stock\s*car|arca|sprint\s*car|midget|late\s*model|modified|legends|street\s*stock|silver\s*crown|dirt|rallycross|irx|beetle|pro\s*[24]\s*truck)\b/i.test(clean)) return false;
    return true;
  }
  function sanitizeSpecialty(s) {
    var clean = String(s || "").trim();
    if (!clean) return "";
    return clean.replace(/\bGTP\b/gi, "Multiclass").replace(/Multiclass\s+Endurance\s+Endurance/gi, "Multiclass Endurance");
  }
  document.querySelectorAll("[data-toggle-bars]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var listId = btn.getAttribute("data-toggle-bars");
      var listEl = listId ? document.getElementById(listId) : null;
      if (!listEl) return;
      var expanded = btn.getAttribute("aria-expanded") === "true";
      var nextState = !expanded;
      var totalCount = btn.getAttribute("data-total-count") || "";
      var unit = btn.getAttribute("data-label-unit") || "items";
      listEl.querySelectorAll('[data-extra-bar="true"]').forEach(function (li) {
        li.hidden = !nextState;
      });
      listEl.classList.toggle("is-expanded", nextState);
      btn.setAttribute("aria-expanded", nextState ? "true" : "false");
      btn.textContent = nextState
        ? "Show Top 5 ▴"
        : "View full list (" + totalCount + " " + unit + ") ▾";
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
    if (d.fullName || d.name) {
      root.querySelectorAll('[data-f="name"]').forEach(function (el) { el.textContent = d.fullName || d.name; });
    }
    if (d.dorsal) {
      root.querySelectorAll('[data-f="dorsal"]').forEach(function (el) { el.textContent = d.dorsal; });
    }
    if (d.country) {
      root.querySelectorAll('[data-f="country"]').forEach(function (el) { el.textContent = d.country; });
    }
    if (d.role && !/\bgtp\b/i.test(d.role)) set("role", d.role);
    if (d.specialty) set("specialty", sanitizeSpecialty(d.specialty));

    var licLabels = {
      sports_car: "Sports Car",
      formula_car: "Formula Car",
      oval: "Oval",
      dirt_road: "Dirt Road",
      dirt_oval: "Dirt Oval"
    };
    var licBox = document.getElementById("driverAllLicenses");
    if (licBox && licenses.length > 0) {
      var extraLics = licenses.filter(function (l) { return l && (l.irating || l.sr != null || l.class_label); });
      if (extraLics.length > 1) {
        licBox.innerHTML = extraLics.map(function (l) {
          var catName = licLabels[l.category] || l.category;
          var cls = l.class_label || l.classLabel || "";
          var srTxt = l.sr != null ? Number(l.sr).toFixed(2) : "";
          var irTxt = l.irating ? Number(l.irating).toLocaleString(loc()) + " iR" : "";
          return '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--r-line);background:var(--r-bg-2);font:600 11px/1.2 var(--r-mono);color:var(--r-text)">' +
            '<span style="color:var(--r-accent)">' + esc(catName) + '</span>' +
            (cls ? '<span>' + esc(cls) + (srTxt ? ' ' + esc(srTxt) : '') + '</span>' : '') +
            (irTxt ? '<span style="color:var(--r-muted)">· ' + esc(irTxt) + '</span>' : '') +
            '</span>';
        }).join("");
        licBox.hidden = false;
      }
    }

    var primaryLic = licenses.find(function (l) { return l && l.category === "sports_car"; }) || licenses[0] || null;
    var srVal = primaryLic && primaryLic.sr != null ? Number(primaryLic.sr) : null;
    var classShort = primaryLic && (primaryLic.class_label || primaryLic.classLabel)
      ? String(primaryLic.class_label || primaryLic.classLabel).replace(/^Class\s+/i, "")
      : "A";
    var hoursVal = d.total_track_hours > 0 ? Number(d.total_track_hours) : null;

    if (hoursVal > 0) {
      approx(root.querySelector('[data-f="total_track_hours"]'), "h", hoursVal);
    }
    if (d.favorite_track) set("favorite_track", d.favorite_track);

    if (Array.isArray(d.top_tracks) && d.top_tracks.length > 0) {
      var tracksSum = d.top_tracks.reduce(function (a, t) { return a + (Number(t.hours) || 0); }, 0);
      var tracksMax = Math.max.apply(null, d.top_tracks.map(function (t) { return Number(t.hours) || 0; }).concat([1]));
      set("top_track_name", d.top_tracks[0].name);
      approx(root.querySelector('[data-f="top_track_hours"]'), "h", d.top_tracks[0].hours);
      var tList = document.getElementById("tracksList-" + slug);
      if (tList) {
        tList.innerHTML = d.top_tracks.map(function (item, idx) {
          var hrs = Number(item.hours) || 0;
          var sh = tracksSum > 0 ? Math.round((hrs / tracksSum) * 100) : 0;
          var bw = Math.max(4, Math.round((hrs / tracksMax) * 100));
          return '<li data-track="' + esc(item.name) + '"' + (idx >= 5 ? ' data-extra-bar="true" hidden' : '') + '>' +
            '<span class="d-bars__name">' + esc(item.name) + '</span>' +
            '<span class="d-bars__val"><span>' + esc(hrs.toFixed(1)) + ' h</span> <span>en pista</span>' + (item.laps ? ' · ' + esc(item.laps) + ' laps' : '') + '</span>' +
            '<span class="d-bars__share">' + sh + '% <span>del total</span></span>' +
            '<span class="d-bar" aria-hidden="true"><span style="width:' + bw + '%"></span></span>' +
            '</li>';
        }).join("");
      }
    }

    if (Array.isArray(d.top_cars) && d.top_cars.length > 0) {
      var carsSum = d.top_cars.reduce(function (a, c) { return a + (Number(c.hours) || 0); }, 0);
      var carsMax = Math.max.apply(null, d.top_cars.map(function (c) { return Number(c.hours) || 0; }).concat([1]));
      showList("cars", d.top_cars.slice(0, 5).map(function (c) { return c.name; }));
      var cList = document.getElementById("carsList-" + slug);
      if (cList) {
        cList.innerHTML = d.top_cars.map(function (item, idx) {
          var hrs = Number(item.hours) || 0;
          var sh = carsSum > 0 ? Math.round((hrs / carsSum) * 100) : 0;
          var bw = Math.max(4, Math.round((hrs / carsMax) * 100));
          return '<li data-car="' + esc(item.name) + '"' + (idx >= 5 ? ' data-extra-bar="true" hidden' : '') + '>' +
            '<span class="d-bars__name">' + esc(item.name) + '</span>' +
            '<span class="d-bars__val"><span>' + esc(hrs.toFixed(1)) + ' h</span> <span>en pista</span>' + (item.laps ? ' · ' + esc(item.laps) + ' laps' : '') + '</span>' +
            '<span class="d-bars__share">' + sh + '% <span>del total</span></span>' +
            '<span class="d-bar" aria-hidden="true"><span style="width:' + bw + '%"></span></span>' +
            '</li>';
        }).join("");
      }
    }

    if (d.irating > 0 || d.f1_stats) {
      if (d.irating > 0) approx(root.querySelector('[data-f="irating"]'), "k", d.irating);
      var ovrVal = (d.f1_stats && d.f1_stats.overall)
        ? d.f1_stats.overall
        : (typeof window.muntruComputeAsymptoticRating === "function" && d.irating > 0
          ? window.muntruComputeAsymptoticRating(d.irating, srVal || 3.0, hoursVal || 100)
          : null);
      if (ovrVal) set("ovr", String(ovrVal));
      try {
        document.dispatchEvent(new CustomEvent("muntrume:driver-live-stats", {
          detail: {
            slug: slug,
            irating: d.irating,
            sr: srVal,
            hours: hoursVal,
            classShort: classShort,
            dorsal: d.dorsal,
            f1_stats: d.f1_stats || null
          }
        }));
      } catch (e) {}
    }
    if (d.fav_car && d.fav_car.name && isSportsCarVehicle(d.fav_car.name)) showList("cars", [d.fav_car.name]);
    if (d.top_category && d.top_category.name && !/\b(gtp|oval|formula|dirt)\b/i.test(d.top_category.name)) showList("series", [d.top_category.name]);
    if (d.bio) showText("bio", sanitizeSpecialty(d.bio));
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
      return isRoadTrack(r && r.track, r && r.category) && (!r || !r.car || isSportsCarVehicle(r.car));
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
