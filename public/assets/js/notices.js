/* Avisos de Muntrume: un solo componente para toda la web.
   info y success se cierran solos. warning y error se quedan hasta cerrarlos.
   La pila vive en el flujo de la página: no tapa el contenido ni el copiloto. */
(function () {
  "use strict";
  var ICONS = {
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8h.01"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 16.5h.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>'
  };
  var AUTO = { info: 6000, success: 4500, warning: 0, error: 0 };

  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function stack() {
    return document.getElementById("muntruNoticeStack");
  }

  function dismiss(id) {
    var el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el || !el.classList || !el.classList.contains("m-notice")) return;
    var parent = el.parentNode;
    if (el._timer) clearTimeout(el._timer);
    el.remove();
    if (parent && parent.id === "muntruNoticeStack" && !parent.querySelector(".m-notice")) parent.hidden = true;
  }

  function dismissSource(source) {
    document.querySelectorAll('.m-notice[data-source="' + CSS.escape(source) + '"]').forEach(dismiss);
  }

  function show(opts) {
    opts = opts || {};
    var severity = ICONS[opts.severity] ? opts.severity : "info";
    var host = opts.inline
      ? (typeof opts.inline === "string" ? document.querySelector(opts.inline) : opts.inline)
      : stack();
    if (!host) return "";
    if (opts.source) {
      host.querySelectorAll('.m-notice[data-source="' + CSS.escape(opts.source) + '"]').forEach(function (n) { n.remove(); });
    }
    var el = document.createElement("div");
    var id = opts.id || ("mn-" + Math.random().toString(36).slice(2, 9));
    el.id = id;
    el.className = "m-notice m-notice--" + severity + (opts.inline ? " m-notice--inline" : "") + " m-notice--in";
    el.setAttribute("role", severity === "warning" || severity === "error" ? "alert" : "status");
    if (opts.source) el.dataset.source = opts.source;
    el.innerHTML =
      '<span class="m-notice__icon">' + ICONS[severity] + "</span>" +
      '<div class="m-notice__body">' +
        (opts.title ? '<p class="m-notice__title"></p>' : "") +
        (opts.message ? '<p class="m-notice__msg"' + (opts.translateMessage === false ? ' data-no-i18n=""' : "") + "></p>" : "") +
      "</div>";
    if (opts.title) el.querySelector(".m-notice__title").textContent = opts.title;
    if (opts.message) el.querySelector(".m-notice__msg").textContent = opts.message;
    if (opts.dismissible !== false) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-notice__close";
      btn.setAttribute("aria-label", "Cerrar aviso");
      btn.innerHTML = '<span aria-hidden="true">×</span>';
      btn.addEventListener("click", function () {
        dismiss(id);
        if (typeof opts.onDismiss === "function") opts.onDismiss();
      });
      el.appendChild(btn);
    }
    if (opts.inline) host.appendChild(el);
    else host.insertBefore(el, host.firstChild);
    if (host.id === "muntruNoticeStack") host.hidden = false;
    else {
      host.hidden = false;
      host.classList.remove("hidden");
    }
    var dur = opts.duration;
    if (dur == null) dur = AUTO[severity];
    if (!opts.inline && dur > 0) {
      var arm = function () {
        clearTimeout(el._timer);
        el._timer = setTimeout(function () { dismiss(id); }, dur);
      };
      var stop = function () { clearTimeout(el._timer); };
      el.addEventListener("mouseenter", stop);
      el.addEventListener("mouseleave", arm);
      el.addEventListener("focusin", stop);
      el.addEventListener("focusout", function (e) {
        if (!el.contains(e.relatedTarget)) arm();
      });
      arm();
    }
    if (!opts.inline && el.getBoundingClientRect) {
      var rect = el.getBoundingClientRect();
      var viewH = window.innerHeight || 0;
      if (rect.top < 56 || rect.bottom > viewH - 8) {
        el.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
      }
    }
    return id;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (document.querySelector(".g-modal:not(.hidden)")) return;
    var active = document.activeElement;
    var focused = active && active.closest && active.closest(".m-notice");
    var inField = active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    if (inField && !focused) return;
    var target = focused || document.querySelector("#muntruNoticeStack .m-notice");
    if (!target) return;
    e.preventDefault();
    dismiss(target);
  });

  window.muntruNotice = { show: show, dismiss: dismiss, dismissSource: dismissSource };
})();
