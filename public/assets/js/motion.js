/* t269: revelado al hacer scroll y contadores de cifras reales. Respeta prefers-reduced-motion. */
(function () {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var root = document.documentElement; root.classList.add('r-motion');
  var vh = innerHeight;
  var els = [].slice.call(document.querySelectorAll('.r-section .r-head, .r-section .r-card, .r-section .r-figs > *, .r-section .r-list > *'));
  els.forEach(function (e) { if (e.getBoundingClientRect().top > vh * 0.9) e.classList.add('r-reveal'); });
  var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.r-reveal').forEach(function (e, i) { e.style.transitionDelay = (i % 4) * 60 + 'ms'; io.observe(e); });
  /* Contadores: solo elementos con data-count (cifra real del catálogo) y fuera de la primera pantalla. */
  var co = new IntersectionObserver(function (es) {
    es.forEach(function (x) {
      if (!x.isIntersecting) return; co.unobserve(x.target);
      var el = x.target, to = +el.getAttribute('data-count'), fmt = new Intl.NumberFormat(document.documentElement.lang || 'es'), t0 = performance.now();
      (function f(t) { var p = Math.min(1, (t - t0) / 900); el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); })(t0);
    });
  });
  document.querySelectorAll('[data-count]').forEach(function (e) { if (e.getBoundingClientRect().top > vh) co.observe(e); });
})();
