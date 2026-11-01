/* Perfiles públicos de piloto (solo los que un admin ha marcado como visibles). Datos de /api/pilots. */
(function () {
  "use strict";
  var API = "https://muntrume.atrumin16.workers.dev/api/pilots";
  var grid = document.getElementById("pilotGrid");
  var list = document.getElementById("pilotList");
  var detail = document.getElementById("pilotDetail");
  function t(s) { return (window.muntruI18n && window.muntruI18n.t) ? window.muntruI18n.t(s) : s; }
  function lang() { return document.documentElement.lang || "es"; }
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) { return esc(String(n || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase()); }
  function photo(p, lg) {
    return p.photo ? '<img class="pl-ph" src="' + esc(p.photo) + '" alt="" width="' + (lg ? 120 : 56) + '" height="' + (lg ? 120 : 56) + '"' + (lg ? "" : ' loading="lazy"') + ' decoding="async">'
      : '<span class="pl-ph" aria-hidden="true">' + initials(p.name) + "</span>";
  }
  function since(ym) {
    if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return "";
    try { return new Date(ym + "-15T12:00:00Z").toLocaleDateString(lang(), { month: "long", year: "numeric" }); } catch (e) { return ym; }
  }
  function meta(p) { return [p.team, p.car_class].filter(Boolean).map(esc).join(" · "); }
  function setMeta(title, desc) {
    document.title = title;
    var d = document.querySelector('meta[name="description"]'); if (d && desc) d.setAttribute("content", desc);
  }
  function renderList(pilots) {
    if (!pilots.length) { grid.innerHTML = '<p class="pl-empty">' + esc(t("No public profiles yet. Pilots appear here once they give permission.")) + "</p>"; return; }
    grid.innerHTML = pilots.map(function (p) {
      return '<a class="pl-card" href="/pilotos?p=' + encodeURIComponent(p.slug) + '">' + photo(p) +
        '<span style="min-width:0"><span class="pl-name">' + esc(p.name) + '</span><span class="pl-meta" style="display:block">' + (meta(p) || "&nbsp;") + "</span></span></a>";
    }).join("");
  }
  function renderDetail(p) {
    list.hidden = true; detail.hidden = false;
    var links = (p.links || []).map(function (l) {
      return '<a class="pl-link" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer nofollow"><span>' + esc(l.label) + '</span><span aria-hidden="true" style="color:#34d399">↗</span></a>';
    }).join("");
    var tags = [p.team, p.car_class].filter(Boolean).map(function (x) { return '<span class="pl-tag">' + esc(x) + "</span>"; }).join("");
    var s = since(p.since);
    detail.innerHTML = '<a class="pl-back" href="/pilotos"><span aria-hidden="true">←</span> <span>' + esc(t("All pilots")) + "</span></a>" +
      '<div class="pl-hero">' + photo(p, true) + "<h1>" + esc(p.name) + "</h1>" +
      (tags ? '<div class="pl-tags">' + tags + "</div>" : "") +
      (p.bio ? '<p class="pl-bio">' + esc(p.bio) + "</p>" : "") +
      (s ? '<p class="pl-since"><span>' + esc(t("Team member since")) + "</span> <span>" + esc(s) + "</span></p>" : "") + "</div>" +
      (links ? '<div class="pl-links">' + links + "</div>" : "");
    setMeta(p.name + " · Muntrume Motorsport", [p.name, p.team, p.car_class].filter(Boolean).join(" · ") + " — Muntrume Motorsport");
    var c = document.querySelector('link[rel="canonical"]'); if (c) c.href = "https://muntru.me/pilotos?p=" + encodeURIComponent(p.slug);
  }
  function notFound() {
    list.hidden = true; detail.hidden = false;
    detail.innerHTML = '<a class="pl-back" href="/pilotos"><span aria-hidden="true">←</span> <span>' + esc(t("All pilots")) + '</span></a><p class="pl-empty">' + esc(t("This profile does not exist or is not public.")) + "</p>";
    var r = document.querySelector('meta[name="robots"]') || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "robots" }));
    r.setAttribute("content", "noindex");
  }
  var slug = new URLSearchParams(location.search).get("p");
  if (slug) {
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) { notFound(); return; }
    fetch(API + "/" + slug).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { d && d.success ? renderDetail(d.pilot) : notFound(); })
      .catch(function () { notFound(); });
  } else {
    fetch(API).then(function (r) { return r.json(); })
      .then(function (d) { renderList((d && d.pilots) || []); })
      .catch(function () { grid.innerHTML = '<p class="pl-empty">' + esc(t("Could not load the profiles. Try again later.")) + "</p>"; });
  }
})();
