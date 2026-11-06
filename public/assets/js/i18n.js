/* Muntrume i18n: traducción en el navegador con diccionarios propios (assets/i18n/*.json).
   Idioma: ?lang= → localStorage → navigator.languages → es. Sin servicios de terceros. */
(function () {
  "use strict";
  var LANGS = { es: "Español", en: "English", ca: "Català", fr: "Français" };
  var KEY = "mm_lang", V = "t281";
  var root = document.documentElement;
  function pick() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (q && LANGS[q]) { localStorage.setItem(KEY, q); return { lang: q, explicit: true }; }
      var s = localStorage.getItem("muntrume_lang") || localStorage.getItem(KEY);
      if (s) { s = s.toLowerCase(); if (LANGS[s]) return { lang: s, explicit: false }; }
    } catch (e) {}
    var nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "es"]);
    for (var i = 0; i < nav.length; i++) {
      var p = String(nav[i] || "").toLowerCase().split("-")[0];
      if (LANGS[p]) return { lang: p, explicit: false };
      if (p === "gl" || p === "eu") return { lang: "es", explicit: false };
      if (p === "oc") return { lang: "ca", explicit: false };
    }
    return { lang: "es", explicit: false };
  }
  var sel = pick(), lang = sel.lang, dict = null;
  root.lang = lang;
  // Evita el parpadeo de texto sin traducir (máx. 1,2 s) en todos los idiomas.
  if (true) {
    root.classList.add("i18n-wait");
    var st = document.createElement("style"); st.id = "i18n-wait-css";
    st.textContent = "html.i18n-wait body{opacity:0}";
    document.head.appendChild(st);
    setTimeout(function () { root.classList.remove("i18n-wait"); }, 1200);
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, svg: 1 };
  var ATTRS = ["placeholder", "aria-label", "title", "alt"];
  var done = new WeakMap();
  function tr(s) {
    if (!dict) return null;
    var k = s.replace(/\s+/g, " ").trim();
    return k && Object.prototype.hasOwnProperty.call(dict, k) ? dict[k] : null;
  }
  function textNode(n) {
    var v = n.nodeValue; if (!v || !/[A-Za-zÀ-ÿ]/.test(v) || done.get(n) === v) return;
    var t = tr(v); if (t == null) return;
    var m = v.match(/^(\s*)[\s\S]*?(\s*)$/);
    var out = m[1] + t + m[2]; done.set(n, out); n.nodeValue = out;
  }
  function el(e) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = e.getAttribute && e.getAttribute(ATTRS[i]);
      if (a) { var t = tr(a); if (t != null) e.setAttribute(ATTRS[i], t); }
    }
  }
  function skip(n) {
    for (var p = n; p && p !== document; p = p.parentNode) {
      if (p.nodeType === 1 && (SKIP[p.nodeName] || p.hasAttribute("data-no-i18n") || p.getAttribute("translate") === "no" || p.isContentEditable)) return true;
    }
    return false;
  }
  function walk(node) {
    if (!dict || !node) return;
    if (node.nodeType === 3) { if (!skip(node.parentNode)) textNode(node); return; }
    if (node.nodeType !== 1 || skip(node)) return;
    el(node);
    var w = document.createTreeWalker(node, 5 /* ELEMENT|TEXT */, {
      acceptNode: function (n) { return n.nodeType === 1 && (SKIP[n.nodeName] || n.hasAttribute("data-no-i18n") || n.getAttribute("translate") === "no") ? 2 : 1; }
    });
    var n; while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else el(n); }
  }
  function head() {
    var t = tr(document.title); if (t) document.title = t;
    var ms = document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"],meta[property="og:image:alt"]');
    for (var i = 0; i < ms.length; i++) { var c = tr(ms[i].getAttribute("content") || ""); if (c) ms[i].setAttribute("content", c); }
    var loc = { es: "es_ES", en: "en_US", ca: "ca_ES", fr: "fr_FR" }[lang];
    var og = document.querySelector('meta[property="og:locale"]'); if (og) og.setAttribute("content", loc);
    if (sel.explicit) { var cn = document.querySelector('link[rel="canonical"]'); if (cn && !/[?&]lang=/.test(cn.href)) cn.href = cn.href + (cn.href.indexOf("?") < 0 ? "?" : "&") + "lang=" + lang; }
  }
  function picker() {
    // Selector unico vive en Navbar / Header
  }
  function apply() {
    head(); walk(document.body); picker();
    root.classList.remove("i18n-wait");
    try { document.dispatchEvent(new CustomEvent("muntru:i18n", { detail: { lang: lang } })); } catch (e) {}
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === "characterData") { if (!skip(m.target.parentNode)) textNode(m.target); }
        else if (m.type === "attributes") el(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  window.muntruI18n = {
    lang: lang, langs: LANGS,
    t: function (s) { var t = tr(String(s)); return t == null ? s : t; },
    set: function (l) {
      if (!LANGS[l]) return;
      try { localStorage.setItem(KEY, l); } catch (e) {}
      var u = new URL(location.href); u.searchParams.delete("lang");
      location.href = u.pathname + (u.search || "") + u.hash;
    }
  };
  var ready = new Promise(function (r) { if (document.readyState !== "loading") r(); else document.addEventListener("DOMContentLoaded", r, { once: true }); });
  fetch("/assets/i18n/" + lang + ".json?v=" + V).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (d) { dict = d || {}; return ready; }).then(apply);
})();
