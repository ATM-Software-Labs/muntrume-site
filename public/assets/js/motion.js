/* t340: Google Product Showcase Choreography — Scroll Progress, Staggered Reveal, Spotlight Glow & Animated Telemetry Counters. Respeta prefers-reduced-motion. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* 1. Top Scroll Progress Bar */
  if (!reduce && document.body && !document.querySelector('.g-scroll-bar')) {
    var bar = document.createElement('div');
    bar.className = 'g-scroll-bar';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="g-scroll-bar__fill"></div>';
    document.body.appendChild(bar);
    var ticking = false;
    var updateScroll = function () {
      var max = root.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      root.style.setProperty('--g-scroll', p.toFixed(4));
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateScroll);
      }
    }, { passive: true });
    updateScroll();
  }

  if (!('IntersectionObserver' in window) || reduce) return;
  root.classList.add('r-motion');
  var vh = window.innerHeight || 800;

  /* 2. Staggered Scroll Reveal Engine across all pages */
  var selectors = [
    '.r-section .r-head',
    '.r-section .r-card',
    '.r-section .d-card',
    '.r-section .mmt-week-card',
    '.r-section .g-bento-card',
    '.r-section .r-value',
    '.r-section .r-figs > *',
    '.r-section .r-list > *',
    '.ov-card',
    '.ov-arch-card',
    '.ov-step',
    '.app-card',
    '.track-card',
    '.fleet-card',
    '[data-g-reveal]'
  ].join(', ');

  var els = [].slice.call(document.querySelectorAll(selectors));
  els.forEach(function (e) {
    var rect = e.getBoundingClientRect();
    if (rect.top > vh * 0.88) {
      e.classList.add('r-reveal');
    } else {
      e.classList.add('is-in');
    }
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

  document.querySelectorAll('.r-reveal, [data-g-reveal]').forEach(function (e, i) {
    if (!e.classList.contains('is-in')) {
      var delay = e.getAttribute('data-g-delay') || ((i % 4) * 65);
      e.style.transitionDelay = delay + 'ms';
      io.observe(e);
    }
  });

  /* 3. Interactive Mouse Spotlight for Bento & Showcase Cards (Desktop fine pointer only) */
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', function (ev) {
      var card = ev.target && ev.target.closest ? ev.target.closest('.g-bento-card, .mmt-week-card, .d-card') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* 4. Telemetry Number Counters: data-count & data-g-count */
  var co = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      co.unobserve(entry.target);
      var el = entry.target;
      var raw = el.getAttribute('data-count') || el.getAttribute('data-g-count');
      var to = Number(raw);
      if (!isFinite(to) || to <= 0) return;
      var suffix = el.getAttribute('data-g-suffix') || '';
      var prefix = el.getAttribute('data-g-prefix') || '';
      var decimals = Number(el.getAttribute('data-g-decimals') || 0);
      var fmt = new Intl.NumberFormat(root.lang || 'es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      var t0 = performance.now();
      var dur = 1100;
      (function tick(now) {
        var p = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3.5);
        var current = decimals > 0 ? (to * eased) : Math.round(to * eased);
        el.textContent = prefix + fmt.format(current) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('[data-count], [data-g-count]').forEach(function (e) {
    co.observe(e);
  });
})();
