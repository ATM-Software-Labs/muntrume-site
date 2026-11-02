/**
 * 🏁 Muntrume Motorsport · home.js
 * Institutional Client Engine
 */

// 1. Confirmed Competition Schedule (Sorted Chronologically)
    // Only real events entered by an admin in Race Control (D1 team_events) are shown; none are hard-coded.
    let EVENTS = [];
    const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function loadTeamEvents() {
      fetch('https://muntrume.atrumin16.workers.dev/api/events', { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d || !Array.isArray(d.events) || !d.events.length) return;
          EVENTS = d.events.map((e) => ({ date: e.starts_at, name: escHtml(e.title), track: escHtml(e.track || 'iRacing'), category: escHtml(e.car_class || '—') }));
          initCalendarAndHUD();
        })
        .catch(() => {});
    }

    // 2. Mobile Drawer Controller
    function toggleNavDrawer() {
      const drawer = document.getElementById('mobileDrawer');
      const backdrop = document.getElementById('mobileBackdrop');
      if (!drawer || !backdrop) return;
      const isOpen = drawer.classList.contains('open');
      drawer.classList.toggle('open', !isOpen);
      backdrop.classList.toggle('open', !isOpen);
      document.body.style.overflow = !isOpen ? 'hidden' : '';
    }

    // 3. Render Calendar Table & Find Next Event
    function initCalendarAndHUD() {
      const tbody = document.getElementById('events-table-body');
      const now = new Date();
      
      // Filter upcoming
      const upcoming = EVENTS.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
      const targetEvent = upcoming.length > 0 ? upcoming[0] : null;
      if (!targetEvent) {
        renderSeasonComplete(now);
      }

      // Update HUD and Hero Badge
      const heroBadge = document.getElementById('hero-live-badge');
      if (targetEvent && heroBadge) {
        heroBadge.textContent = `Next Event: ${targetEvent.name} · ${targetEvent.track}`;
      }

      const hudEvent = document.getElementById('hud-next-event');
      if (targetEvent && hudEvent) {
        hudEvent.innerHTML = `<span>${targetEvent.name}</span><span class="text-xs text-emerald-400 font-normal">${targetEvent.track}</span>`;
      }

      const hudDate = document.getElementById('hud-target-date');
      if (targetEvent && hudDate) {
        hudDate.textContent = targetEvent.date.slice(0, 10);
      }

      // Populate Table
      if (tbody) {
        tbody.innerHTML = EVENTS.map((ev, idx) => {
          const evDate = new Date(ev.date);
          const diffMs = evDate - now;
          const isUpcoming = diffMs > 0;
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

          const statusBadge = isUpcoming 
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>In ${days}d ${hours}h</span>`
            : `<span class="text-neutral-500 text-xs font-medium">Finished</span>`;

          return `
            <tr class="hover:bg-white/5 transition-colors">
              <td class="py-4 px-5 text-neutral-400 font-medium">${ev.date.slice(0, 10)}</td>
              <td class="py-4 px-5 font-bold text-white">${ev.name}</td>
              <td class="py-4 px-5 text-neutral-300">${ev.track}</td>
              <td class="py-4 px-5"><span class="px-2.5 py-1 rounded-md bg-[#1c232d] text-xs text-neutral-300 font-medium border border-white/5">${ev.category}</span></td>
              <td class="py-4 px-5 text-right">${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }

      // Start live countdown timer
      if (targetEvent) {
        const label = document.getElementById('hud-status-label');
        const badge = document.getElementById('hud-status-badge');
        if (label) label.textContent = 'Next race';
        if (badge) badge.textContent = 'Confirmed Entry';
        startCountdown(new Date(targetEvent.date));
      }
    }

    // Empty state: every listed event is in the past -> no fake countdown
    function renderSeasonComplete(now) {
      const past = EVENTS.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
      const last = past[0];
      const year = last ? last.date.slice(0, 4) : String(now.getFullYear());
      const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
      set('hero-live-badge', 'iRacing sim racing · Barcelona');
      set('hud-status-label', 'Race Calendar');
      set('hud-status-badge', 'TBA');
      const wrap = document.getElementById('hud-status-wrap');
      if (wrap) { wrap.classList.remove('text-emerald-400'); wrap.classList.add('text-neutral-300'); }
      const dot = document.getElementById('hud-status-dot');
      if (dot) { dot.classList.remove('animate-pulse', 'bg-emerald-400'); dot.style.background = '#a3a3a3'; }
      const hudEvent = document.getElementById('hud-next-event');
      if (hudEvent) {
        hudEvent.className = 'text-lg font-bold text-white flex flex-col gap-1';
        hudEvent.innerHTML = last
          ? `<span>Next calendar TBA</span><span class="text-xs text-neutral-400 font-normal"><span>Last:</span> ${last.name} · ${last.date.slice(0, 10)}</span>`
          : `<span>Next calendar TBA</span>`;
      }
      set('hud-countdown-label', 'Next race');
      set('hud-target-date', 'TBA');
      const cd = document.getElementById('hud-countdown');
      if (cd) {
        cd.className = 'bg-[#1c232d] border border-white/10 p-4 rounded-xl text-center text-sm text-neutral-300';
        cd.innerHTML = 'No upcoming races scheduled yet. Follow our <a href="https://discord.gg/ehX6B8JUtE" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:text-emerald-300 font-semibold">Discord</a> for the next calendar.';
      }
    }

    // 4. Precision Countdown Function
    function startCountdown(target) {
      function tick() {
        const now = new Date();
        const diff = target - now;

        if (diff <= 0) {
          document.getElementById('cd-days').textContent = '00';
          document.getElementById('cd-hours').textContent = '00';
          document.getElementById('cd-mins').textContent = '00';
          document.getElementById('cd-secs').textContent = '00';
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
        document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
        document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
        document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
      }
      tick();
      setInterval(tick, 1000);
    }

    // Initialize on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      initCalendarAndHUD();
      loadTeamEvents();
    });
