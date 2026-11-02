/**
 * 🏁 Muntrume Motorsport · contact.js
 * Institutional Client Engine
 */

// 1. Mobile Drawer Controller
    function toggleNavDrawer() {
      const drawer = document.getElementById('mobileDrawer');
      const backdrop = document.getElementById('mobileBackdrop');
      if (!drawer || !backdrop) return;
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.style.overflow = '';
      } else {
        drawer.classList.add('open');
        backdrop.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }

    // 2. FAQ Accordion Toggle
    function toggleFaq(btn) {
      const card = btn.closest('.faq-card');
      const answer = card.querySelector('.faq-answer');
      const icon = card.querySelector('.faq-icon');
      const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';

      // Close all FAQs
      document.querySelectorAll('.faq-card').forEach(c => {
        const a = c.querySelector('.faq-answer');
        const i = c.querySelector('.faq-icon');
        if (a) a.style.maxHeight = '0px';
        if (i) i.textContent = '+';
        c.classList.remove('border-emerald-500/40');
      });

      if (!isOpen) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        icon.textContent = '−';
        card.classList.add('border-emerald-500/40');
      }
    }

    // 3. Contact Form Submission → Worker /api/contact (sends via Resend; "sent" only when the Worker confirms)
    (() => {
      const API = 'https://muntrume.atrumin16.workers.dev/api/contact';
      const form = document.getElementById('contactForm');
      const btn = document.getElementById('submitBtn');
      const btnText = document.getElementById('submitText');
      const feedback = document.getElementById('formFeedback');
      const val = (id) => document.getElementById(id).value.trim();
      let token = null;

      async function getToken() {
        try {
          const r = await fetch(API + '/token', { cache: 'no-store' });
          const d = await r.json();
          token = d && d.success ? d.token : null;
        } catch (_) { token = null; }
        return token;
      }
      getToken();

      function mailtoLink() {
        const body = `${val('message')}\n\n— ${val('name')} <${val('email')}>`;
        return `mailto:info@muntru.me?subject=${encodeURIComponent(val('subject') || 'Contact from muntru.me')}&body=${encodeURIComponent(body)}`;
      }
      const ICON_OK = '<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
      const ICON_ERR = '<svg class="w-4 h-4 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>';
      function show(kind, title, html) {
        feedback.className = 'p-5 rounded-2xl text-xs ' + (kind === 'ok'
          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
          : 'bg-rose-500/10 border border-rose-500/30 text-rose-200');
        feedback.innerHTML = `<div class="flex items-center gap-2 font-bold text-white mb-1">${kind === 'ok' ? ICON_OK : ICON_ERR}<span>${escapeHtml(title)}</span></div><div>${html}</div>`;
        feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      function busy(on) {
        btn.disabled = on;
        btn.style.opacity = on ? '0.6' : '';
        btn.style.cursor = on ? 'wait' : '';
        btnText.textContent = on ? 'Sending…' : 'Send message →';
      }

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const checks = [
          ['name', val('name').length >= 2, 'Please enter your name.'],
          ['email', /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(val('email')), 'Please enter a valid email address.'],
          ['subject', val('subject').length >= 3, 'Please add a short subject.'],
          ['message', val('message').length >= 20, 'Your message is too short (20+ characters).'],
        ];
        const bad = checks.find(c => !c[1]);
        if (bad) {
          const el = document.getElementById(bad[0]);
          el.setAttribute('aria-invalid', 'true'); el.focus();
          show('err', 'Check the form', escapeHtml(bad[2]));
          return;
        }
        checks.forEach(c => document.getElementById(c[0]).removeAttribute('aria-invalid'));
        busy(true);
        try {
          if (!token) await getToken();
          const r = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: val('name'), email: val('email'), type: document.getElementById('type').value,
              subject: val('subject'), message: val('message'), website: document.getElementById('website').value, token })
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d.success && d.id) {
            show('ok', `Message sent, ${val('name').split(/\s+/)[0]}!`,
              `Race Control has it in the team inbox. We'll reply to <span class="text-white">${escapeHtml(val('email'))}</span>.`);
            form.reset();
            getToken();
            return;
          }
          if (d.reload) await getToken();
          const tip = r.status < 429 ? '' : ` You can also <a class="underline text-white" href="${mailtoLink()}">email us directly</a>.`;
          show('err', 'Your message was not sent', escapeHtml(d.error || 'Something went wrong. Please try again.') + tip);
        } catch (_) {
          show('err', 'Your message was not sent', `We could not reach our server. Please <a class="underline text-white" href="${mailtoLink()}">email us directly</a> or try again in a moment.`);
        } finally {
          busy(false);
        }
      });
    })();

    function escapeHtml(t) {
      const d = document.createElement('div');
      d.textContent = t;
      return d.innerHTML;
    }
