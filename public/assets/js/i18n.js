/* Spanish is the HTML source. en/ca/fr are key dictionaries.
   Choice persists in muntrume_lang and mm_lang. ?lang= overrides. */
(function () {
  "use strict";
  var LANGS = ["es", "en", "ca", "fr"];
  var V = "t350";
  var dict = null;
  var lang = "es";
  var TRANSLATE_API = "https://muntrume.atrumin16.workers.dev/api/i18n/translate";

  function allowed(code) {
    code = String(code || "").toLowerCase();
    return LANGS.indexOf(code) >= 0 ? code : "";
  }
  function readStored() {
    try {
      return allowed(localStorage.getItem("muntrume_lang")) || allowed(localStorage.getItem("mm_lang"));
    } catch (e) { return ""; }
  }
  function persist(code) {
    try {
      localStorage.setItem("muntrume_lang", code);
      localStorage.setItem("mm_lang", code);
    } catch (e) {}
  }
  function pick() {
    var q = "";
    try { q = allowed(new URLSearchParams(location.search).get("lang")); } catch (e) {}
    if (q) { persist(q); return q; }
    return readStored() || "es";
  }
  function lookup(key) {
    if (!key || !dict || !Object.prototype.hasOwnProperty.call(dict, key)) return null;
    var value = dict[key];
    return typeof value === "string" ? value : null;
  }
  function applyNums() {
    var loc = { es: "es-ES", en: "en-GB", ca: "ca-ES", fr: "fr-FR" }[lang] || "es-ES";
    var nodes = document.querySelectorAll("[data-i18n-num]");
    for (var i = 0; i < nodes.length; i++) {
      var n = Number(nodes[i].getAttribute("data-i18n-num"));
      if (!isFinite(n)) continue;
      try { nodes[i].textContent = n.toLocaleString(loc); }
      catch (e) { nodes[i].textContent = String(n); }
    }
  }
  function applyAttrs() {
    var map = [
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-aria", "aria-label"],
      ["data-i18n-title", "title"],
      ["data-i18n-alt", "alt"],
      ["data-i18n-content", "content"]
    ];
    for (var m = 0; m < map.length; m++) {
      var nodes = document.querySelectorAll("[" + map[m][0] + "]");
      for (var i = 0; i < nodes.length; i++) {
        var value = lookup(nodes[i].getAttribute(map[m][0]));
        if (value != null) nodes[i].setAttribute(map[m][1], value);
      }
    }
  }
  function applyText() {
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var value = lookup(nodes[i].getAttribute("data-i18n"));
      if (value != null) nodes[i].textContent = value;
    }
  }
  function applyLocale() {
    document.documentElement.lang = lang;
    var loc = { es: "es_ES", en: "en_US", ca: "ca_ES", fr: "fr_FR" }[lang];
    var og = document.querySelector('meta[property="og:locale"]');
    if (og && loc) og.setAttribute("content", loc);
  }
  var LANG_FLAGS = {
    es: '<svg viewBox="0 0 18 12" width="18" height="12" aria-hidden="true"><rect width="18" height="12" rx="2" fill="#AA151B"/><rect y="3" width="18" height="6" fill="#F1BF00"/></svg>',
    ca: '<svg viewBox="0 0 18 12" width="18" height="12" aria-hidden="true"><rect width="18" height="12" rx="2" fill="#FCDD09"/><rect y="1.33" width="18" height="1.33" fill="#DA121A"/><rect y="4" width="18" height="1.33" fill="#DA121A"/><rect y="6.66" width="18" height="1.33" fill="#DA121A"/><rect y="9.33" width="18" height="1.33" fill="#DA121A"/></svg>',
    en: '<svg viewBox="0 0 18 12" width="18" height="12" aria-hidden="true"><rect width="18" height="12" rx="2" fill="#012169"/><path d="M0 0l18 12M18 0L0 12" stroke="#FFF" stroke-width="2.2"/><path d="M0 0l18 12M18 0L0 12" stroke="#C8102E" stroke-width="1.1"/><path d="M9 0v12M0 6h18" stroke="#FFF" stroke-width="3.6"/><path d="M9 0v12M0 6h18" stroke="#C8102E" stroke-width="2"/></svg>',
    fr: '<svg viewBox="0 0 18 12" width="18" height="12" aria-hidden="true"><rect width="6" height="12" rx="2" fill="#002395"/><rect x="6" width="6" height="12" fill="#FFF"/><rect x="12" width="6" height="12" rx="2" fill="#ED2939"/><rect x="4" width="2" height="12" fill="#002395"/><rect x="12" width="2" height="12" fill="#ED2939"/></svg>'
  };
  function paintSwitch() {
    var code = lang.toUpperCase();
    var labels = document.querySelectorAll("[data-lang-code]");
    for (var i = 0; i < labels.length; i++) labels[i].textContent = code;
    var flags = document.querySelectorAll("[data-lang-flag]");
    for (var f = 0; f < flags.length; f++) {
      var targetLang = flags[f].getAttribute("data-lang-flag") || lang;
      if (targetLang === "active") targetLang = lang;
      flags[f].innerHTML = LANG_FLAGS[targetLang] || LANG_FLAGS.es;
    }
    var setters = document.querySelectorAll("[data-set-lang]");
    for (var j = 0; j < setters.length; j++) {
      var on = setters[j].getAttribute("data-set-lang") === lang;
      if (setters[j].getAttribute("role") === "option") setters[j].setAttribute("aria-selected", on ? "true" : "false");
      else setters[j].setAttribute("aria-pressed", on ? "true" : "false");
    }
    var full = document.body && document.body.getAttribute("data-i18n-coverage") === "full";
    var show = lang !== "es" && !full;
    var notes = document.querySelectorAll("[data-lang-fallback]");
    for (var n = 0; n < notes.length; n++) {
      if (show) notes[n].removeAttribute("hidden");
      else notes[n].setAttribute("hidden", "");
    }
  }
  function closeMenus() {
    var menus = document.querySelectorAll("[data-lang-menu]");
    for (var i = 0; i < menus.length; i++) {
      menus[i].hidden = true;
      var btn = document.querySelector('[aria-controls="' + menus[i].id + '"]');
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  }
  function bindSwitch() {
    document.addEventListener("click", function (e) {
      var target = e.target;
      var setter = target && target.closest ? target.closest("[data-set-lang]") : null;
      if (setter) {
        e.preventDefault();
        var next = allowed(setter.getAttribute("data-set-lang"));
        if (next) window.muntruI18n.set(next);
        return;
      }
      var toggle = target && target.closest ? target.closest("[data-lang-toggle]") : null;
      if (toggle) {
        e.preventDefault();
        e.stopPropagation();
        var menu = document.getElementById(toggle.getAttribute("aria-controls") || "");
        if (!menu) return;
        var open = menu.hidden;
        closeMenus();
        if (open) {
          menu.hidden = false;
          toggle.setAttribute("aria-expanded", "true");
          var current = menu.querySelector('[aria-selected="true"]') || menu.querySelector("button");
          if (current) current.focus();
        }
        return;
      }
      if (!target || !target.closest || !target.closest("[data-lang-root]")) closeMenus();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenus();
    });
    document.addEventListener("muntru:close-lang", closeMenus);
  }
  function isTranslatableText(str) {
    var s = String(str || "").trim();
    if (s.length < 3 || s.length > 580) return false;
    if (/^[\d\s.,:%+\-–—/()[\]<>→←↗·•|]+$/.test(s)) return false;
    if (/^(https?:\/\/|mailto:|\/[a-z0-9/_-]+$)/i.test(s)) return false;
    if (/^(ES|EN|CA|FR|MIT|API|SSE|JWT|MFA|TOTP|HTTP|CSV|SVG|HTML|JSON|DNS|CSP|URL|PC|PDF|XML|OK|HUD|STO|IBT|RAM|CPU|GPU|FPS|SDK|iRSDK|IRSDK)$/i.test(s)) return false;
    // Skip technical specs, version tags, and product proper nouns so m2m100 doesn't mangle "60 Hz" or "Tauri v2"
    if (/^(\d+(\.\d+)?\s*(%|Hz|FPS|MB|GB|KB|ms|s|min|h|x|kPa|PSI|L|iR|RPM)(\s+(CPU|RAM|GPU))?|SHA-\d+|Tauri\s*v?\d+(\.\d+)?|WebView2|Cloudflare(\s+D1)?|D1(\s+Online)?|MMT(\s+(Sync|HUD|Companion|Motorsport|Steward\s+Bot))?|Muntrume(\s+(Motorsport|AI|Security|Admin|ID))?|Garage\s*61|iRacing(\s+SDK)?|Standings|Relative|Track\s*Map|Fuel\s*Calc|Pit\s*Strategy|Inputs\s*&\s*Delta|Radar|Sprint\s*GT3|Endurance|Minimalist\s*Qualy|Replay\s*\(R\))$/i.test(s)) return false;
    return /[a-zA-ZáéíóúÁÉÍÓÚñÑüÜçÇ]{2,}/.test(s);
  }
  function collectAutoNodes() {
    var roots = document.querySelectorAll("main, article, .mdoc-page, .mm-login-page");
    if (!roots.length) roots = [document.body];
    var skipTags = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, SVG: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, KBD: 1 };
    var out = [];
    var seen = new Set();
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r];
      if (!root) continue;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while ((node = walker.nextNode())) {
        if (seen.has(node)) continue;
        var p = node.parentElement;
        if (!p || skipTags[p.tagName]) continue;
        if (p.closest("code, pre, script, style, svg, [data-i18n], [data-no-translate], [data-lang-root], .ov-spec__val, .rc-brand")) continue;
        var raw = node.nodeValue || "";
        if (!isTranslatableText(raw)) continue;
        seen.add(node);
        out.push({ node: node, raw: raw, trimmed: raw.trim() });
      }
    }
    return out;
  }
  function cacheKey(code, txt) {
    return "mm_tr2_" + code + "_" + txt.slice(0, 120) + "_" + txt.length;
  }
  function applyEdgeTranslation(entries) {
    if (!entries.length) return;
    var uncachedMap = {};
    var uncachedList = [];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var hit = null;
      try { hit = sessionStorage.getItem(cacheKey(lang, e.trimmed)); } catch (err) {}
      if (hit) {
        e.node.nodeValue = e.raw.replace(e.trimmed, hit);
      } else if (!uncachedMap[e.trimmed]) {
        uncachedMap[e.trimmed] = [];
        uncachedList.push(e.trimmed);
        uncachedMap[e.trimmed].push(e);
      } else {
        uncachedMap[e.trimmed].push(e);
      }
    }
    if (!uncachedList.length) {
      document.querySelectorAll("[data-lang-fallback]").forEach(function (el) { el.setAttribute("hidden", ""); });
      return;
    }
    var batches = [];
    for (var b = 0; b < uncachedList.length; b += 28) batches.push(uncachedList.slice(b, b + 28));
    var chain = Promise.resolve();
    batches.forEach(function (batch) {
      chain = chain.then(function () {
        return fetch(TRANSLATE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: lang, texts: batch })
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !Array.isArray(data.translations)) return;
            for (var k = 0; k < batch.length; k++) {
              var src = batch[k];
              var tr = data.translations[k];
              if (!tr || typeof tr !== "string") continue;
              try { sessionStorage.setItem(cacheKey(lang, src), tr); } catch (err) {}
              var targets = uncachedMap[src] || [];
              for (var t = 0; t < targets.length; t++) {
                targets[t].node.nodeValue = targets[t].raw.replace(src, tr);
              }
            }
          })
          .catch(function () {});
      });
    });
    chain.then(function () {
      document.querySelectorAll("[data-lang-fallback]").forEach(function (el) { el.setAttribute("hidden", ""); });
    });
  }
  function apply() {
    if (lang !== "es") {
      applyText();
      applyAttrs();
    }
    applyNums();
    applyLocale();
    paintSwitch();
    if (lang !== "es") {
      var full = document.body && document.body.getAttribute("data-i18n-coverage") === "full";
      if (!full) applyEdgeTranslation(collectAutoNodes());
    }
    try { document.dispatchEvent(new CustomEvent("muntru:i18n", { detail: { lang: lang } })); } catch (e) {}
  }
  function whenReady(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  lang = pick();
  document.documentElement.lang = lang;
  window.muntruI18n = {
    get lang() { return lang; },
    langs: { es: "Español", en: "English", ca: "Català", fr: "Français" },
    t: function (key) { return lookup(key); },
    set: function (code) {
      code = allowed(code);
      if (!code) return;
      closeMenus();
      if (code === lang) return;
      persist(code);
      var u = new URL(location.href);
      if (code === "es") u.searchParams.delete("lang");
      else u.searchParams.set("lang", code);
      location.href = u.pathname + u.search + u.hash;
    }
  };
  bindSwitch();
  if (lang === "es") whenReady(apply);
  else {
    fetch("/assets/i18n/" + lang + ".json?v=" + V)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (data) { dict = data || {}; whenReady(apply); });
  }
})();
