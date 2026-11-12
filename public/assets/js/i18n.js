/* Spanish is the HTML source. en/ca/fr are key dictionaries.
   Choice persists in muntrume_lang and mm_lang. ?lang= overrides. */
(function () {
  "use strict";
  var LANGS = ["es", "en", "ca", "fr"];
  var V = "t330";
  var dict = null;
  var lang = "es";

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
  function paintSwitch() {
    var code = lang.toUpperCase();
    var labels = document.querySelectorAll("[data-lang-code]");
    for (var i = 0; i < labels.length; i++) labels[i].textContent = code;
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
  function apply() {
    if (lang !== "es") {
      applyText();
      applyAttrs();
    }
    applyNums();
    applyLocale();
    paintSwitch();
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
