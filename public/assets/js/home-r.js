/* t273 · Home y plantilla: la instantánea de licencias ya está en el HTML.
   /api/drivers la sustituye solo cuando trae cifras. Coche favorito y carreras siguen en «Sin datos» si no vienen. */
(function () {
  var API = 'https://api.muntru.me';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function uiLang() { return document.documentElement.lang || "es"; }
  function loc() { return window.muntruLocale ? window.muntruLocale(uiLang()) : "es-ES"; }
  function approx(el, kind, value) {
    if (!el || !window.muntruFormato || value == null || value === "") return;
    el.setAttribute("data-n", String(value));
    el.setAttribute("data-approx", kind);
    el.textContent = window.muntruFormato(value, kind, loc());
    el.classList.remove("r-nodata");
  }
  function reformatApprox() {
    if (!window.muntruFormato) return;
    document.querySelectorAll("[data-approx][data-n]").forEach(function (el) {
      var raw = el.getAttribute("data-n");
      if (raw === "") return;
      el.textContent = window.muntruFormato(raw, el.getAttribute("data-approx"), loc());
    });
  }
  document.addEventListener("muntru:i18n", reformatApprox);
  reformatApprox();
  function parseLic(s) {
    var m = String(s || "").match(/^(Class\s+[A-D]|Rookie)\s+([0-9]+(?:\.[0-9]+)?)/i);
    if (!m) return null;
    var label = /^rookie/i.test(m[1]) ? "Rookie" : m[1].replace(/\s+/g, " ").replace(/^class/i, "Class");
    return { classLabel: label, sr: Number(m[2]).toFixed(2) };
  }
  function showList(card, block, items) {
    var root = card.querySelector('[data-block="' + block + '"]');
    var ul = root && root.querySelector("ul");
    var names = (items || []).map(function (item) { return String(item || "").trim(); }).filter(Boolean);
    if (!ul || !names.length) return;
    ul.replaceChildren.apply(ul, names.map(function (name) {
      var li = document.createElement("li");
      li.textContent = name;
      return li;
    }));
    root.hidden = false;
  }
  function showText(card, block, value) {
    var root = card.querySelector('[data-block="' + block + '"]');
    var slot = root && root.querySelector("[data-f]");
    var text = String(value || "").trim();
    if (!root || !slot || !text) return;
    slot.textContent = text;
    root.hidden = false;
  }
  function showMeta(card, block, value) {
    var root = card.querySelector('[data-block="' + block + '"]');
    var slot = card.querySelector('[data-f="' + block + '_value"]');
    var text = String(value || "").trim();
    if (!root || !slot || !text) return;
    slot.textContent = text;
    root.hidden = false;
  }
  function paintLic(root, lic) {
    if (!root || !lic || !lic.category) return;
    var card = root.getAttribute("data-lic") === lic.category ? root : root.querySelector('[data-lic="' + lic.category + '"]');
    if (!card) return;
    if (lic.class_label || lic.classLabel) {
      var c = card.querySelector('[data-lic-f="class"]');
      if (c) c.textContent = lic.class_label || lic.classLabel;
    }
    if (lic.sr != null && lic.sr !== "") approx(card.querySelector('[data-lic-f="sr"]'), "sr", lic.sr);
    if (lic.irating > 0) approx(card.querySelector('[data-lic-f="irating"]'), "k", lic.irating);
    if (lic.tt_rating > 0 || lic.ttRating > 0) approx(card.querySelector('[data-lic-f="tt"]'), "k", lic.tt_rating || lic.ttRating);
  }
  var SIM_META = {
    iracing: { name: "iRacing", short: "iR", logo: "/assets/img/sims/iracing.png" },
    lmu: { name: "Le Mans Ultimate", short: "LMU", logo: "/assets/img/sims/lmu.png" },
    ac_evo: { name: "Assetto Corsa EVO", short: "AC EVO", logo: "/assets/img/sims/ac_evo.png" },
    acc: { name: "ACC", short: "ACC", logo: "/assets/img/sims/acc.png" },
    rf2: { name: "rFactor 2", short: "rF2", logo: "/assets/img/sims/rf2.png" },
    ams2: { name: "AMS2", short: "AMS2", logo: "/assets/img/sims/ams2.png" },
    f1: { name: "F1", short: "F1", logo: "/assets/img/sims/f1.png" },
    staff: { name: "Staff", short: "STAFF", logo: "/assets/img/logo-64.webp" },
  };

  function buildDynamicDriverCard(d) {
    var isStaff = d.kind === "staff" && !d.irating && !d.cust_id;
    var sims = Array.isArray(d.sims) && d.sims.length ? d.sims : [isStaff ? "staff" : "iracing"];
    var simPills = sims.map(function (id) {
      var m = SIM_META[id];
      if (!m) return "";
      return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px 3px 5px;border-radius:999px;border:1px solid var(--r-line,rgba(255,255,255,.14));background:var(--r-bg,#090b0f);color:var(--r-text,#f1f5f9);font:600 10.5px/1 ui-monospace,monospace;">' +
        '<span style="display:inline-flex;align-items:center;justify-content:center;height:16px;padding:1px 4px;border-radius:5px;background:#0b0f17;"><img src="' + m.logo + '" alt="' + esc(m.name) + '" style="height:11px;max-width:36px;object-fit:contain;display:block;" loading="lazy" /></span>' +
        '<span>' + esc(m.short) + '</span></span>';
    }).join("");

    var dorsal = d.dorsal || (isStaff ? "STAFF" : "MMT");
    var lic = (Array.isArray(d.licenses) && d.licenses[0]) || null;
    var ovr = (d.f1_stats && d.f1_stats.overall) ? d.f1_stats.overall : (d.irating ? Math.min(98, Math.max(40, Math.round(54 + 43 * (Math.log(Math.max(1500, d.irating) / 1500) / Math.log(12000 / 1500))))) : null);
    var statsHtml = isStaff || (!d.irating && !lic)
      ? '<dl class="d-stats"><div><dt>Rol</dt><dd style="font-size:0.82rem;">' + esc(isStaff ? "STAFF" : "MULTI-SIM") + '</dd></div><div><dt>Plataformas</dt><dd>' + sims.length + '</dd></div><div><dt>Desde</dt><dd>' + esc(d.member_since || "2026") + '</dd></div></dl>'
      : '<dl class="d-stats"><div><dt>SR</dt><dd>' + esc(lic && lic.sr != null ? Number(lic.sr).toFixed(2) : "—") + '</dd></div><div><dt>iRating</dt><dd>' + esc(d.irating ? (d.irating >= 1000 ? (d.irating / 1000).toFixed(1) + "k" : d.irating) : "—") + '</dd></div><div><dt>Horas</dt><dd>' + esc(d.total_track_hours ? Math.round(d.total_track_hours) + " h" : "—") + '</dd></div></dl>';

    var art = document.createElement("article");
    art.className = "d-card d-reveal";
    art.setAttribute("data-driver", d.slug);
    art.setAttribute("data-dynamic", "1");
    art.innerHTML =
      '<div class="d-stage" style="display:flex;align-items:center;justify-content:center;min-height:176px;position:relative;">' +
        '<span class="d-stage-dorsal">' + esc(dorsal) + '</span>' +
        '<img src="/assets/img/logo-64.webp" alt="' + esc(d.fullName || d.name) + '" width="88" height="88" style="border-radius:18px;opacity:0.92;filter:drop-shadow(0 10px 24px rgba(0,230,153,.22));" />' +
      '</div>' +
      '<div class="d-card__body">' +
        '<div class="d-card__top">' +
          '<p class="d-kicker"><span class="d-flag">' + esc(d.flag || "🏁") + '</span> <span>' + esc(d.country || "International") + '</span> · <span>' + esc(d.role || (isStaff ? "Staff & Ingeniería" : "Piloto Oficial")) + '</span></p>' +
          '<h2 class="d-name"><span class="d-num-pill d-num-pill--sm">' + esc(dorsal) + '</span> <span>' + esc(d.fullName || d.name) + '</span></h2>' +
          '<div class="d-badges-row">' +
            (lic && lic.class_label ? '<p class="sc-badge"><span>' + esc(lic.class_label) + '</span></p>' : '') +
            (isStaff ? '<span style="padding:3px 9px;border-radius:999px;font:700 10.5px ui-monospace,monospace;color:#059669;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.35);">STAFF</span>' : '') +
            (ovr ? '<span class="d-ovr-pill">OVR <strong>' + esc(ovr) + '</strong></span>' : '') +
            (d.specialty ? '<span class="d-specialty-pill">' + esc(d.specialty) + '</span>' : '') +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;">' + simPills + '</div>' +
          statsHtml +
        '</div>' +
        '<div class="d-card__bottom">' +
          (d.bio ? '<p style="font-size:12.5px;line-height:1.5;color:var(--r-muted);margin:0 0 8px;">' + esc(d.bio) + '</p>' : '') +
          (d.favorite_track ? '<p class="d-fav"><span class="d-fav__k">Circuito favorito</span> <span class="d-fav__n">' + esc(d.favorite_track) + '</span></p>' : '') +
          '<div class="d-actions-row"><a class="d-card__link" href="/contact/?to=admin"><span>Contactar</span><span aria-hidden="true">→</span></a></div>' +
        '</div>' +
      '</div>';
    return art;
  }

  function cachedJson(url, cacheKey, ttlMs) {
    try {
      var raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && (Date.now() - parsed.ts) < ttlMs) return Promise.resolve(parsed.data);
      }
    } catch (e) {}
    return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (data) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {}
      }
      return data;
    });
  }

  cachedJson(API + '/api/drivers', 'mmt_cache_drivers_v2', 300000).then(function (list) {
    var latest = null;
    var irSum = 0, irCount = 0;
    var grid = document.querySelector(".d-grid");
    var totalRendered = document.querySelectorAll(".d-grid [data-driver]").length;
    (Array.isArray(list) ? list : []).forEach(function (d) {
      var card = document.querySelector('[data-driver="' + d.slug + '"]');
      if (!card) {
        if (grid && d && d.slug && d.is_dynamic) {
          grid.appendChild(buildDynamicDriverCard(d));
          totalRendered += 1;
        }
        return;
      }
      var licenses = Array.isArray(d.licenses) ? d.licenses.slice() : [];
      if (!licenses.length && (d.irating > 0 || d.license)) {
        var parsed = parseLic(d.license);
        licenses.push({ category: "sports_car", class_label: parsed && parsed.classLabel, sr: parsed && parsed.sr, irating: d.irating > 0 ? d.irating : undefined });
      }
      licenses.forEach(function (lic) { paintLic(card, lic); });
      if (d.fullName || d.name) {
        card.querySelectorAll('[data-f="name"]').forEach(function (el) { el.textContent = d.fullName || d.name; });
      }
      if (d.dorsal) {
        card.querySelectorAll('[data-f="dorsal"]').forEach(function (el) { el.textContent = d.dorsal; });
      }
      if (d.country) {
        card.querySelectorAll('[data-f="country"]').forEach(function (el) { el.textContent = d.country; });
      }
      if (d.irating > 0) {
        approx(card.querySelector('[data-f="irating"]'), "k", d.irating);
        irSum += Number(d.irating);
        irCount += 1;
      }
      var ovrEl = card.querySelector('[data-f="ovr"]');
      if (ovrEl && ((d.f1_stats && d.f1_stats.overall) || d.irating > 0)) {
        var computedOvr = (d.f1_stats && d.f1_stats.overall) ? d.f1_stats.overall : (function (ir) {
          var base = ir >= 1500 ? 54 + 43 * (Math.log(ir / 1500) / Math.log(12000 / 1500)) : Math.max(20, 54 * (ir / 1500));
          return Math.min(98, Math.max(1, Math.round(base + 1)));
        })(Number(d.irating));
        ovrEl.textContent = String(computedOvr);
      }
      if (d.role && !/\bgtp\b/i.test(d.role)) {
        var roleEl = card.querySelector('[data-f="role"]');
        if (roleEl) roleEl.textContent = d.role;
      }
      if (d.specialty) {
        var specEl = card.querySelector('[data-f="specialty"]');
        var cleanSpec = String(d.specialty).replace(/\bGTP\b/gi, "Multiclass").replace(/Multiclass\s+Endurance\s+Endurance/gi, "Multiclass Endurance");
        if (specEl) specEl.textContent = cleanSpec;
      }
      if (d.fav_car && d.fav_car.name && !/\b(gtp|hypercar|lmdh|lmp|499p|valkyrie)\b/i.test(d.fav_car.name)) showList(card, "cars", [d.fav_car.name]);
      if (d.top_category && d.top_category.name && !/\b(gtp|oval|formula|dirt)\b/i.test(d.top_category.name)) showList(card, "series", [d.top_category.name]);
      if (d.bio) showText(card, "bio", String(d.bio).replace(/\bGTP\b/gi, "Multiclass"));
      showMeta(card, "member_since", d.member_since || d.memberSince);
      showMeta(card, "club", d.club || d.club_name);
      if (d.updated_at && (!latest || d.updated_at > latest)) latest = d.updated_at;
    });
    if (irCount > 0) {
      approx(document.getElementById('teamAvgIr'), 'k', Math.round(irSum / irCount));
    }
    if (latest) {
      var stamp = document.querySelector("#licenceUpdated time");
      if (stamp) {
        var when = new Date(latest);
        if (!isNaN(when.getTime())) {
          stamp.dateTime = latest;
          stamp.textContent = when.toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" });
        }
      }
    }
  }).catch(function () {});
  cachedJson(API + '/api/events', 'mmt_cache_events_v2', 300000).then(function (d) {
    var now = Date.now();
    var ev = (d && Array.isArray(d.events) ? d.events : []).filter(function (e) { return new Date(e.starts_at).getTime() >= now - 36e5 * 6; })
      .sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); }).slice(0, 5);
    var ul = document.getElementById('calList');
    if (!ev.length || !ul) return;
    ul.innerHTML = ev.map(function (e) {
      var dt = new Date(e.starts_at);
      return '<li><div class="r-row"><span class="r-meta">' + esc(dt.toLocaleDateString(uiLang(), { day: '2-digit', month: 'short', year: 'numeric' })) + '<br>' + esc(dt.toLocaleTimeString(uiLang(), { hour: '2-digit', minute: '2-digit' })) + '</span><span><span class="r-h3">' + esc(e.title) + '</span><br><span class="r-meta">' + esc(e.track || 'iRacing') + '</span></span><span class="r-meta">' + esc(e.car_class || '') + '</span></div></li>';
    }).join('');
    ul.hidden = false;
    var empty = document.getElementById('calEmpty');
    if (empty) empty.hidden = true;
    var stat = document.getElementById('nextEventStat');
    if (stat && ev[0] && ev[0].title) {
      var title = stat.querySelector('[data-next-title]');
      var when = stat.querySelector('[data-next-when]');
      if (title) title.textContent = ev[0].title;
      if (when && ev[0].starts_at) {
        var dt = new Date(ev[0].starts_at);
        when.dateTime = ev[0].starts_at;
        when.textContent = dt.toLocaleDateString(uiLang(), { day: '2-digit', month: 'short' });
      }
      stat.hidden = false;
    }
  }).catch(function () {});
})();
