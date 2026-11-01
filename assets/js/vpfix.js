/* Muntrume: fallback for Android "Versión para ordenadores"/desktop-site mode.
   In that mode the browser ignores <meta name="viewport"> and lays the page out at ~980px
   on a ~412px screen, so everything looks tiny. If we detect a small touch screen with a much
   wider layout viewport, we zoom the root back to device width and re-evaluate width media
   queries against the real screen width so the mobile layout is used. No-op everywhere else. */
(function () {
  try {
    var d = document.documentElement, sw = Math.min(screen.width, screen.height) || 0,
        iw = window.innerWidth || d.clientWidth;
    var touch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (!touch || !sw || sw > 600 || iw < sw * 1.4) return;
    if (screen.width > screen.height) sw = screen.width; // landscape phone
    var z = iw / sw;
    d.classList.add('vp-forced');
    d.style.zoom = z;
    var W = sw;
    function evalQuery(q) {
      q = q.trim(); if (!q) return true;
      var neg = /^not\s/i.test(q); if (neg) q = q.replace(/^not\s+/i, '');
      q = q.replace(/^only\s+/i, '');
      var ok = true;
      q.split(/\s+and\s+/i).forEach(function (part) {
        part = part.trim(); var m;
        if (/^(all|screen)$/i.test(part)) return;
        if (/^print$/i.test(part)) { ok = false; return; }
        if ((m = part.match(/^\(\s*min-width\s*:\s*([\d.]+)px\s*\)$/i))) { if (!(W >= +m[1])) ok = false; return; }
        if ((m = part.match(/^\(\s*max-width\s*:\s*([\d.]+)px\s*\)$/i))) { if (!(W <= +m[1])) ok = false; return; }
        if (!(window.matchMedia && matchMedia(part).matches)) ok = false;
      });
      return neg ? !ok : ok;
    }
    function patch(rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i];
        if (r.media && r.cssRules && r.type === 4 && !r.__vp) {
          var t = r.media.mediaText;
          if (/width/i.test(t)) {
            var on = t.split(',').some(evalQuery);
            r.__vp = 1;
            try { r.media.mediaText = on ? 'all' : 'not all'; } catch (e) {}
          }
        }
        if (r.cssRules) patch(r.cssRules);
      }
    }
    function run() {
      for (var i = 0; i < document.styleSheets.length; i++) {
        try { patch(document.styleSheets[i].cssRules); } catch (e) {}
      }
    }
    run();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);
    if (document.head) new MutationObserver(run).observe(document.head, { childList: true });
  } catch (e) {}
})();
