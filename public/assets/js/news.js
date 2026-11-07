/**
 * 🏁 Muntrume Motorsport · news.js
 * Institutional Client Engine
 */



    // 2. SLUG HELPER & CURATED BASELINE DISPATCHES
    function slugify(text) {
      return (text || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Solo despachos propios del equipo. Las noticias externas llegan en vivo desde /api/news
    // (proxy RSS del Worker); si los feeds fallan no se muestra contenido inventado.
    const BASELINE_NEWS = [
      {
        id: 'dispatch-26s4-lemans',
        title: '🏁 Despacho Oficial 24H Le Mans 26S4: Setup Valkyrie GTP y Telemetría de Mulsanne',
        description: 'Análisis de telemetría a 60 Hz para prototipos GTP en Les Hunaudières. Calibración de alerón a 4.5° y gestión de consumo de 3.42 L/vuelta.',
        link: '/setups',
        pubDate: new Date().toISOString(),
        source: 'Muntrume Engineering',
        thumbnail: '/assets/img/coche1-640.webp',
        autoCategory: 'team',
        isBreaking: true,
        isTeam: true
      },
      {
        id: 'dispatch-gt3-spa',
        title: '🛠️ Calibración de Amortiguadores para Eau Rouge & Raidillon en GT3',
        description: 'Actualización del setup para Ferrari 296 y Porsche 992 GT3 R en Spa-Francorchamps con control de balance en cambios de compresión rápida.',
        link: '/setups',
        pubDate: new Date(Date.now() - 86400000).toISOString(),
        source: 'Muntrume Motorsport',
        thumbnail: '/assets/img/coche2-640.webp',
        autoCategory: 'team',
        isBreaking: false,
        isTeam: true
      },
    ];

    // Live external news: server-side RSS proxy on the Muntrume Worker (replaces rss2json)
    const NEWS_API = 'https://muntrume.atrumin16.workers.dev/api/news';
    let allNews = [...BASELINE_NEWS];
    let newsSources = [{ name: 'Muntrume Motorsport', category: 'team' }];
    let liveFeedStatus = 'pending'; // pending | ok | offline
    let currentFilter = 'all';
    let currentSearch = '';
    let lastUpdateTime = new Date();

    // 3. TEAM DISPATCH NEWS (Markdown & Fallbacks)
    const TEAM_NEWS_FILE = '/noticias-equipo.md';
    let teamNewsData = [];

    function parseTeamNewsMarkdown(markdown) {
      const blocks = markdown.split(/^---\s*$/m).filter(b => b.trim().length > 0);
      const news = [];
      blocks.forEach(block => {
        const lines = block.trim().split(/\r?\n/);
        let title = '', date = '', author = '', category = 'General', image = '', contentLines = [];
        const titleLine = lines.find(l => /^#\s+/.test(l));
        if (titleLine) title = titleLine.replace(/^#\s+/, '').trim();
        lines.forEach(l => {
          const trimmed = l.trim();
          const match = trimmed.match(/^\*\*(Date|Fecha|Author|Autor|Category|Categor[ií]a|Image|Imagen):\*\*\s*(.+)$/i);
          if (match) {
            const key = match[1].toLowerCase();
            const value = match[2].trim();
            if (key.includes('fecha') || key === 'date') date = value;
            else if (key.includes('autor') || key === 'author') author = value;
            else if (key.includes('categor') || key === 'category') category = value;
            else if (key.includes('imagen') || key === 'image') image = value;
          } else if (!/^#\s+/.test(trimmed) && trimmed.length > 0) {
            contentLines.push(trimmed);
          }
        });
        const content = contentLines.join('\n');
        if (title && !title.toLowerCase().includes('welcome')) {
          news.push({ title, date: date || '2026-07-02', author, category, image, content });
        }
      });
      return news.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    async function loadTeamNewsFromMD() {
      try {
        const res = await fetch(TEAM_NEWS_FILE + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('File not found');
        const md = await res.text();
        teamNewsData = parseTeamNewsMarkdown(md);
      } catch (e) {
        teamNewsData = [];
      }

      // Convert team dispatches into news articles with dedicated article URL
      const teamArticles = teamNewsData.map(n => {
        const slug = slugify(n.title);
        return {
          id: slug,
          title: n.title,
          description: n.content,
          link: `/article?id=${slug}`,
          slug: slug,
          pubDate: n.date ? new Date(n.date).toISOString() : new Date().toISOString(),
          source: "Muntrume Motorsport",
          thumbnail: n.image || (n.category.toLowerCase().includes('endurance') ? '/assets/img/race1.webp' : '/assets/img/coche1.webp'),
          autoCategory: n.category.toLowerCase().includes('endurance') ? 'endurance' : 'team',
          isBreaking: /victory|win|victoria|historic/i.test(n.title),
          isTeam: true
        };
      });

      // Merge into allNews, prioritizing team articles
      const existingTitles = new Set(teamArticles.map(a => a.title.toLowerCase()));
      // The markdown dispatches supersede the hard-coded team baseline (avoids duplicated stories)
      allNews = [...teamArticles, ...allNews.filter(a => !(teamArticles.length && a.isTeam) && !existingTitles.has(a.title.toLowerCase()))]
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      document.getElementById('articleCount').textContent = `${allNews.length} Articles`;
      document.getElementById('sourceCount').textContent = `${newsSources.length} Sources`;

      const breaking = allNews.filter(n => n.isBreaking);
      if (breaking.length > 0) showBreakingTicker(breaking);

      renderAllSections();
      renderTrending();
      loadAIBrief();
    }

    // 4. LIVE FEED (Worker proxy, plain-text items, cached at the edge)
    async function fetchLiveNews() {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(NEWS_API, { signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!data || !Array.isArray(data.items)) throw new Error('bad payload');
        return data;
      } finally { clearTimeout(tid); }
    }

    function safeLink(u) {
      if (typeof u !== 'string') return '#';
      if (u.startsWith('/article') || u.startsWith('article.html')) return u;
      try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch (e) { return '#'; }
    }

    async function loadAllNews() {
      const loadingEl = document.getElementById('loadingState');
      const featuredEl = document.getElementById('featuredGrid');
      const errorEl = document.getElementById('errorState');
      try {
        const data = await fetchLiveNews();
        const liveItems = data.items
          .filter(i => i && i.title && i.link)
          .map(i => ({
            title: String(i.title), description: String(i.description || ''), link: safeLink(i.link),
            pubDate: i.pubDate || null, source: String(i.source || ''), thumbnail: i.thumbnail || null,
            autoCategory: (() => {
            const text = ((i.title || '') + ' ' + (i.description || '')).toLowerCase();
            if (/hardware|fanatec|moza|cockpit|wheel|simagic|rig|pedal|direct drive|vrs|asetek|thrustmaster|logitech|rtx|gpu|vr|headset|chassis/i.test(text)) return 'tech';
            if (/iracing/i.test(text)) return 'iracing';
            if (/endurance|le mans|24h|nurburgring|spa|bathurst|wec|imsa|daytona/i.test(text)) return 'endurance';
            if (/esports|e-sports|championship|tournament|league|cup|pesc/i.test(text)) return 'esports';
            if (/sim\s*racing|simulator|acc|assetto|automobilista|rf2|rfactor|rennsport/i.test(text)) return 'simracing';
            return i.autoCategory || 'sport';
          })(),
            isBreaking: false
          }));
        const okSources = (data.sources || []).filter(s => s.ok);
        newsSources = [{ name: 'Muntrume Motorsport', category: 'team' }, ...okSources];
        const teamOnly = allNews.filter(a => a.isTeam);
        const teamTitles = new Set(teamOnly.map(a => a.title.toLowerCase()));
        allNews = [...teamOnly, ...liveItems.filter(i => !teamTitles.has(i.title.toLowerCase()))]
          .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
        liveFeedStatus = liveItems.length ? 'ok' : 'offline';
      } catch (err) {
        liveFeedStatus = 'offline';
      } finally {
        lastUpdateTime = new Date();
        document.getElementById('articleCount').textContent = `${allNews.length} Articles`;
        document.getElementById('sourceCount').textContent = `${newsSources.length} Sources`;
        const breaking = allNews.filter(n => n.isBreaking);
        if (breaking.length > 0) showBreakingTicker(breaking);
        renderAllSections();
        renderTrending();
        loadAIBrief();
        renderFeedNotice();
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (featuredEl) featuredEl.classList.remove('hidden');
      }
    }

    function renderFeedNotice() {
      let el = document.getElementById('feedNotice');
      const host = document.getElementById('featuredGrid');
      if (!host) return;
      if (liveFeedStatus !== 'offline') { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'feedNotice';
        el.setAttribute('role', 'status');
        el.className = 'flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--r-surface)] border border-[var(--r-line)] text-xs text-[var(--r-text)]';
        host.prepend(el);
      }
      el.innerHTML = '<span>External racing feeds are temporarily unavailable &mdash; showing team dispatches only.</span><button type="button" onclick="loadAllNews()" class="shrink-0 text-emerald-400 font-semibold hover:text-emerald-300">Retry</button>';
    }

    function showBreakingTicker(items) {
      const banner = document.getElementById('breakingBanner');
      const textEl = document.getElementById('breakingText');
      if (!banner || !textEl) return;
      const tickerText = items.map(a => `${a.title} · ${a.source}`).join('   —   ');
      textEl.textContent = tickerText + '   —   ' + tickerText;
      banner.classList.remove('hidden');
    }

    // 5. RENDER FUNCTIONS
    function renderAllSections() {
      renderTopStories();
      renderEsportsNews();
      renderSportNews();
    }

    function renderTopStories() {
      let filtered = allNews;
      if (currentFilter !== 'all') {
        if (currentFilter === 'breaking') {
          filtered = allNews.filter(n => n.isBreaking || /breaking|urgent|anuncio|update|oficial|patch|release|ganador|victoria|pole/i.test(n.title + ' ' + (n.description || '')));
          if (filtered.length === 0) filtered = allNews.slice(0, 4);
        } else if (currentFilter === 'team') {
          filtered = allNews.filter(n => n.isTeam || n.autoCategory === 'team' || /muntrume|equipo|piloto|driver|setup/i.test(n.source + ' ' + n.title));
        } else if (currentFilter === 'iracing') {
          filtered = allNews.filter(n => n.autoCategory === 'iracing' || /iracing/i.test(n.title + ' ' + (n.description || '')));
        } else if (currentFilter === 'endurance') {
          filtered = allNews.filter(n => n.autoCategory === 'endurance' || /endurance|spa|le mans|24h|nurburgring|daytona|bathurst|wec|imsa/i.test(n.title + ' ' + (n.description || '')));
        } else if (currentFilter === 'simracing') {
          filtered = allNews.filter(n => n.autoCategory === 'simracing' || /sim\s*racing|simulator|iracing|acc|assetto|automobilista|rf2|rfactor|rennsport/i.test(n.title + ' ' + (n.description || '')));
        } else if (currentFilter === 'esports') {
          filtered = allNews.filter(n => n.autoCategory === 'esports' || /esports|e-sports|championship|tournament|league|cup|series|qualifying|supercars|pesc|world championship/i.test(n.title + ' ' + (n.description || '')));
        } else if (currentFilter === 'sport') {
          filtered = allNews.filter(n => n.autoCategory === 'sport' || /f1|formula|wec|imsa|gt3|gt4|fia|motorsport|racing|nascar|indycar/i.test(n.title + ' ' + (n.description || '')));
        } else if (currentFilter === 'tech') {
          filtered = allNews.filter(n => n.autoCategory === 'tech' || /hardware|tech|fanatec|moza|cockpit|wheel|simagic|rig|pedal|dd|direct drive|heusinkveld|vrs|asetek|thrustmaster|logitech|gpu|nvidia|rtx|display|monitor|setup|telemetr/i.test(n.title + ' ' + (n.description || '')));
          if (filtered.length === 0) filtered = allNews.filter(n => n.isTeam || /setup|telemetr|ingenier/i.test(n.title + ' ' + (n.description || '')));
        } else {
          filtered = allNews.filter(n => n.autoCategory === currentFilter);
        }
      }

      if (currentSearch) {
        const s = currentSearch.toLowerCase();
        filtered = filtered.filter(n => n.title.toLowerCase().includes(s) || (n.description || '').toLowerCase().includes(s) || (n.source || '').toLowerCase().includes(s));
      }

      if (filtered.length === 0) {
        document.getElementById('mainFeatured').innerHTML = '<div class="text-center py-12 bg-[var(--r-surface)] rounded-2xl border border-[var(--r-line)] text-xs text-[var(--r-muted)]"><p class="text-sm font-semibold text-[var(--r-text)] mb-1">No stories match this filter</p><p>Try another category or clear the search box.</p></div>';
        document.getElementById('sideStories').innerHTML = '';
        document.getElementById('secondaryGrid').innerHTML = '';
        return;
      }

      document.getElementById('mainFeatured').innerHTML = renderFeaturedCard(filtered[0]);
      document.getElementById('sideStories').innerHTML = filtered.slice(1, 3).map(renderSideCard).join('');
      document.getElementById('secondaryGrid').innerHTML = filtered.slice(3, 7).map(renderSecondaryCard).join('');
    }

    function renderEsportsNews() {
      const container = document.getElementById('esportsGrid');
      if (!container) return;
      const esports = allNews.filter(n => n.autoCategory === 'esports').slice(0, 4);
      if (esports.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 rounded-2xl bg-[var(--r-surface)] border border-[var(--r-line)] text-[var(--r-muted)] text-xs">${liveFeedStatus === 'pending' ? 'Loading esports headlines…' : 'No sim racing esports headlines in the live feeds right now.'}</div>`;
        return;
      }
      container.innerHTML = esports.map(renderSecondaryCard).join('');
    }

    function renderSportNews() {
      const container = document.getElementById('sportGrid');
      if (!container) return;
      const sport = allNews.filter(n => n.autoCategory === 'sport').slice(0, 4);
      if (sport.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-8 rounded-2xl bg-[var(--r-surface)] border border-[var(--r-line)] text-[var(--r-muted)] text-xs">${liveFeedStatus === 'pending' ? 'Loading motorsport headlines…' : 'Motorsport headlines are temporarily unavailable.'}</div>`;
        return;
      }
      container.innerHTML = sport.map(renderSecondaryCard).join('');
    }

    // 6. CARD TEMPLATES (Modern Clean Motorsport Aesthetic)
    function getPlaceholderImg() {
      return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="500"%3E%3Crect fill="%23161c24" width="800" height="500"/%3E%3Ctext x="50%25" y="45%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="bold" fill="%2310b981"%3EMUNTRUME MOTORSPORT%3C/text%3E%3Ctext x="50%25" y="58%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="%2394a3b8"%3ERacing Dispatch%3C/text%3E%3C/svg%3E';
    }

    function esc(t) {
      return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Local images: use the lightweight 640px card variants
    function cardImg(src) {
      if (!src) return getPlaceholderImg();
      const m = /^assets\/img\/(coche[1-4]|race1)\.(webp|jpg)$/.exec(src);
      return m ? `/assets/img/${m[1]}-640.webp` : src;
    }

    function cleanDesc(html) {
      const plain = (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return plain.length > 160 ? plain.substring(0, 157) + '…' : plain;
    }

    function formatDate(d) {
      try { return new Date(d).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
    }

    function resolveNewsUrl(a) {
      if (a.slug) return '/noticias/' + a.slug;
      if (a.link && (a.link.startsWith('/') || a.link.startsWith('http'))) return a.link;
      return safeLink(a.link);
    }

    function renderFeaturedCard(a) {
      const href = esc(resolveNewsUrl(a));
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const targetAttr = isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
      const ctaText = isInternal ? (a.isTeam ? 'Leer Despacho Oficial &rarr;' : 'Leer Noticia y Contexto &rarr;') : 'Leer Noticia en ' + esc(a.source) + ' &rarr;';
      return `
        <a href="${href}" ${targetAttr} class="group block relative overflow-hidden rounded-3xl bg-[var(--r-surface)] border border-[var(--r-line)] hover:border-[var(--r-line-2)] transition duration-300 shadow-2xl">
          <div class="h-80 sm:h-96 w-full relative overflow-hidden bg-[var(--r-bg-2)]">
            <img src="${esc(cardImg(a.thumbnail))}" onerror="this.onerror=null;this.src='/assets/img/coche1-640.webp';" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-full object-cover transition duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-90">
            <div class="absolute inset-0" style="background: linear-gradient(to top, var(--r-surface) 0%, var(--r-surface) 55%, transparent 100%);"></div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <div class="flex items-center gap-2.5 mb-3 flex-wrap text-xs">
              ${a.isBreaking ? '<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[var(--r-accent)] border border-emerald-500/30 font-bold text-[10px] tracking-wider uppercase">Breaking</span>' : ''}
              <span class="px-2.5 py-0.5 rounded-full bg-[var(--r-bg-2)] text-[var(--r-text)] border border-[var(--r-line)] text-[11px] font-medium">${esc(a.source)}</span>
              <span class="text-[var(--r-muted)] text-xs">${formatDate(a.pubDate)}</span>
            </div>
            <h3 class="text-2xl sm:text-3xl font-extrabold text-[var(--r-text)] tracking-tight mb-2 group-hover:text-[var(--r-accent)] transition-colors leading-tight">
              ${esc(a.title)}
            </h3>
            <p class="text-[var(--r-text)] text-xs sm:text-sm line-clamp-2 mb-4 max-w-3xl leading-relaxed">
              ${esc(cleanDesc(a.description))}
            </p>
            <div class="inline-flex items-center gap-2 text-[var(--r-accent)] font-semibold text-xs group-hover:translate-x-1 transition-transform">
              <span>${ctaText}</span>
            </div>
          </div>
        </a>
      `;
    }

    function renderSideCard(a) {
      const href = esc(resolveNewsUrl(a));
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const targetAttr = isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
      const ctaText = isInternal ? (a.isTeam ? 'Leer Despacho &rarr;' : 'Ver Noticia &rarr;') : 'Leer en ' + esc(a.source) + ' &rarr;';
      return `
        <a href="${href}" ${targetAttr} class="group block bg-[var(--r-surface)] border border-[var(--r-line)] hover:border-[var(--r-line-2)] rounded-2xl overflow-hidden transition duration-300 shadow-md flex flex-col justify-between">
          <div>
            <div class="h-44 w-full overflow-hidden bg-[var(--r-bg-2)] relative">
              <img src="${esc(cardImg(a.thumbnail))}" onerror="this.onerror=null;this.src='/assets/img/coche1-640.webp';" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="w-full h-full object-cover transition duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100">
              <div class="absolute inset-0 bg-gradient-to-t from-[var(--r-surface)] via-transparent to-transparent"></div>
            </div>
            <div class="p-5">
              <div class="flex items-center gap-2 mb-2 text-[11px]">
                <span class="px-2 py-0.5 rounded-md bg-[var(--r-bg-2)] text-[var(--r-text)] border border-[var(--r-line)] font-medium">${esc(a.source)}</span>
                <span class="text-[var(--r-muted)]">${formatDate(a.pubDate)}</span>
              </div>
              <h3 class="font-bold text-[var(--r-text)] text-sm sm:text-base line-clamp-2 mb-2 group-hover:text-[var(--r-accent)] transition-colors">
                ${esc(a.title)}
              </h3>
              <p class="text-[var(--r-muted)] text-xs line-clamp-2 leading-relaxed">
                ${esc(cleanDesc(a.description))}
              </p>
            </div>
          </div>
          <div class="px-5 pb-5 pt-0">
            <span class="text-[var(--r-accent)] text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              <span>${ctaText}</span>
            </span>
          </div>
        </a>
      `;
    }

    function renderSecondaryCard(a) {
      const href = esc(resolveNewsUrl(a));
      const isInternal = href.startsWith('/') && !href.startsWith('//');
      const targetAttr = isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
      const ctaText = isInternal ? (a.isTeam ? 'Leer Despacho &rarr;' : 'Ver Noticia &rarr;') : 'Leer en ' + esc(a.source) + ' &rarr;';
      return `
        <a href="${href}" ${targetAttr} class="group block p-5 rounded-2xl bg-[var(--r-surface)] border border-[var(--r-line)] hover:border-[var(--r-line-2)] transition duration-300 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 mb-2.5 text-[11px]">
              <span class="px-2 py-0.5 rounded-md bg-[var(--r-bg-2)] text-[var(--r-text)] border border-[var(--r-line)] font-medium">${esc(a.source)}</span>
              <span class="text-[var(--r-muted)]">${formatDate(a.pubDate)}</span>
            </div>
            <h3 class="font-bold text-[var(--r-text)] text-sm sm:text-base line-clamp-2 mb-2 group-hover:text-[var(--r-accent)] transition-colors">
              ${esc(a.title)}
            </h3>
            <p class="text-[var(--r-muted)] text-xs line-clamp-2 mb-3 leading-relaxed">
              ${esc(cleanDesc(a.description))}
            </p>
          </div>
          <div class="text-[var(--r-accent)] text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform pt-2">
            <span>${ctaText}</span>
          </div>
        </a>
      `;
    }

    function renderTrending() {
      const container = document.getElementById('trendingList');
      if (!container) return;
      const trending = allNews.slice(0, 5);
      if (trending.length === 0) {
        container.innerHTML = '<p class="text-xs text-[var(--r-muted)]">No trending intel.</p>';
        return;
      }
      container.innerHTML = trending.map((a, i) => {
        const isInternal = (a.link || '').startsWith('/article');
        const targetAttr = isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
        return `
          <a href="${esc(safeLink(a.link))}" ${targetAttr} class="flex gap-3 items-start py-2.5 border-b border-[var(--r-line)] last:border-0 hover:pl-1 transition-all group">
            <span class="text-[var(--r-accent)] font-bold text-sm">#0${i + 1}</span>
            <div class="min-w-0 flex-1">
              <h3 class="text-xs font-semibold text-[var(--r-text)] line-clamp-2 group-hover:text-[var(--r-accent)] transition-colors">${esc(a.title)}</h3>
              <div class="text-[10px] text-[var(--r-muted)] mt-1">${esc(a.source)} • ${formatDate(a.pubDate)}</div>
            </div>
          </a>
        `;
      }).join('');
    }

    // 7. AI BRIEF & CHAT
    async function loadAIBrief() {
      const c = document.getElementById('aiBriefContent');
      if (!c || allNews.length === 0) return;
      const top = allNews.slice(0, 3);
      let brief = `<p class="mb-2 text-[var(--r-text)]">Latest of <strong>${allNews.length} stories</strong> from <strong>${newsSources.length} ${newsSources.length === 1 ? 'source' : 'sources'}</strong>:</p><div class="space-y-1.5 text-[var(--r-text)]">`;
      top.forEach(a => {
        brief += `<p class="leading-tight"><span class="text-[var(--r-accent)] font-bold">•</span> ${esc(a.title.length > 80 ? a.title.substring(0, 80) + '…' : a.title)}</p>`;
      });
      brief += '</div>';
      c.innerHTML = brief;
    }

    function refreshAIBrief() {
      const c = document.getElementById('aiBriefContent');
      if (!c) return;
      c.innerHTML = '<div class="loading-skeleton h-3 mb-2 rounded"></div><div class="loading-skeleton h-3 mb-2 rounded"></div><div class="loading-skeleton h-3 rounded"></div>';
      setTimeout(loadAIBrief, 400);
    }

    function escapeHtml(t) {
      const d = document.createElement('div');
      d.textContent = t;
      return d.innerHTML;
    }


    // 8. FILTERS & SEARCH EVENT LISTENERS
    function setupNewsListeners() {
      const filterBtns = document.getElementById('filterButtons');
      if (filterBtns) {
        filterBtns.addEventListener('click', (e) => {
          const btn = e.target.closest('.filter-btn');
          if (btn) {
            document.querySelectorAll('#filterButtons .filter-btn').forEach(b => {
              b.classList.remove('active');
            });
            btn.classList.add('active');
            currentFilter = btn.dataset.filter || 'all';
            renderTopStories();
          }
        });
      }

      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          currentSearch = e.target.value;
          renderTopStories();
        });
      }
    }

    function toggleGames() {
      const section = document.getElementById('gamesSection');
      const text = document.getElementById('gamesToggleText');
      if (!section) return;
      section.classList.toggle('hidden');
      text.textContent = section.classList.contains('hidden') ? 'Expand Module' : 'Collapse Module';
    }

    // 9. MINI-GAMES ENGINE
    function selectGame(game) {
      document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
      document.querySelectorAll('.game-card-btn').forEach(b => b.classList.remove('selected'));
      document.getElementById(`game-${game}`).classList.remove('hidden');
      document.getElementById(`gameBtn-${game}`).classList.add('selected');
      if (game === 'wordsearch') initWordSearch();
      else if (game === 'trivia') initTrivia();
      else if (game === 'reaction') resetReaction();
      else if (game === 'memory') initMemory();
    }

    // A. WORD SEARCH
    const WS_WORDS = ['APEX', 'DRS', 'SLICKS', 'PITSTOP', 'POLE', 'PODIUM', 'TELEMETRY', 'BRAKE', 'TURBO', 'AERO', 'CHASSIS', 'HYBRID'];
    let wsGrid = []; const wsSize = 12; let wsWordsInGrid = []; let wsFound = []; let wsSelecting = false; let wsStart = null; let wsCurrent = null;

    function initWordSearch() {
      wsFound = []; wsWordsInGrid = []; wsGrid = Array(wsSize).fill().map(() => Array(wsSize).fill(''));
      const words = [...WS_WORDS].sort(() => Math.random() - 0.5).slice(0, 8);
      words.forEach(w => placeWord(w));
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < wsSize; i++) {
        for (let j = 0; j < wsSize; j++) {
          if (!wsGrid[i][j]) wsGrid[i][j] = letters[Math.floor(Math.random() * 26)];
        }
      }
      renderWordSearch();
    }

    function placeWord(word) {
      const dirs = [[0,1],[1,0],[1,1],[-1,1]];
      let att = 0;
      while (att < 60) {
        const d = dirs[Math.floor(Math.random() * dirs.length)];
        const r = Math.floor(Math.random() * wsSize), c = Math.floor(Math.random() * wsSize);
        let ok = true; const pos = [];
        for (let i = 0; i < word.length; i++) {
          const nr = r + d[0] * i, nc = c + d[1] * i;
          if (nr < 0 || nr >= wsSize || nc < 0 || nc >= wsSize) { ok = false; break; }
          if (wsGrid[nr][nc] && wsGrid[nr][nc] !== word[i]) { ok = false; break; }
          pos.push([nr, nc]);
        }
        if (ok) {
          pos.forEach((p, i) => wsGrid[p[0]][p[1]] = word[i]);
          wsWordsInGrid.push({ word, positions: pos });
          return;
        }
        att++;
      }
    }

    function renderWordSearch() {
      const grid = document.getElementById('wordsearchGrid');
      grid.style.gridTemplateColumns = `repeat(${wsSize}, 1fr)`;
      grid.innerHTML = '';
      for (let i = 0; i < wsSize; i++) {
        for (let j = 0; j < wsSize; j++) {
          const cell = document.createElement('div');
          cell.className = 'ws-cell';
          cell.textContent = wsGrid[i][j];
          cell.dataset.row = i;
          cell.dataset.col = j;
          cell.addEventListener('mousedown', (e) => { e.preventDefault(); wsSelecting = true; wsStart = { row: i, col: j }; wsCurrent = { row: i, col: j }; updateSelection(); });
          cell.addEventListener('mouseenter', () => { if (wsSelecting) { wsCurrent = { row: i, col: j }; updateSelection(); } });
          grid.appendChild(cell);
        }
      }
      document.addEventListener('mouseup', () => { if (wsSelecting) { wsSelecting = false; checkWord(); clearSelection(); } });
      document.getElementById('wordList').innerHTML = wsWordsInGrid.map(w => `<div class="word-list-item" data-word="${w.word}">${w.word}</div>`).join('');
      document.getElementById('ws-found').textContent = '0';
      document.getElementById('wsWinMessage').classList.add('hidden');
    }

    function updateSelection() {
      document.querySelectorAll('.ws-cell').forEach(c => c.classList.remove('selecting'));
      if (!wsStart || !wsCurrent) return;
      const dr = Math.sign(wsCurrent.row - wsStart.row), dc = Math.sign(wsCurrent.col - wsStart.col);
      const steps = Math.max(Math.abs(wsCurrent.row - wsStart.row), Math.abs(wsCurrent.col - wsStart.col));
      for (let i = 0; i <= steps; i++) {
        const r = wsStart.row + dr * i, c = wsStart.col + dc * i;
        const cell = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
        if (cell) cell.classList.add('selecting');
      }
    }

    function clearSelection() {
      document.querySelectorAll('.ws-cell').forEach(c => c.classList.remove('selecting'));
    }

    function checkWord() {
      if (!wsStart || !wsCurrent) return;
      const dr = Math.sign(wsCurrent.row - wsStart.row), dc = Math.sign(wsCurrent.col - wsStart.col);
      const steps = Math.max(Math.abs(wsCurrent.row - wsStart.row), Math.abs(wsCurrent.col - wsStart.col));
      let sel = ''; const pos = [];
      for (let i = 0; i <= steps; i++) {
        const r = wsStart.row + dr * i, c = wsStart.col + dc * i;
        sel += wsGrid[r][c]; pos.push(`${r}-${c}`);
      }
      const rev = sel.split('').reverse().join('');
      const found = wsWordsInGrid.find(w => !wsFound.includes(w.word) && (w.word === sel || w.word === rev));
      if (found) {
        wsFound.push(found.word);
        pos.forEach(p => {
          const [r, c] = p.split('-');
          const cell = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
          if (cell) cell.classList.add('found');
        });
        const wi = document.querySelector(`.word-list-item[data-word="${found.word}"]`);
        if (wi) wi.classList.add('found');
        document.getElementById('ws-found').textContent = wsFound.length;
        if (wsFound.length === wsWordsInGrid.length) document.getElementById('wsWinMessage').classList.remove('hidden');
      }
    }

    // B. TRIVIA QUIZ
    const TRIVIA_QUESTIONS = [
      { q: "What does DRS stand for in aerodynamic regulation?", options: ["Drag Reduction System", "Direct Race Steering", "Downforce Recovery System", "Dynamic Rate Stabilizer"], correct: 0 },
      { q: "Which circuit features the iconic 'Eau Rouge - Raidillon' complex?", options: ["Circuit de Spa-Francorchamps", "Autodromo Nazionale Monza", "Suzuka International", "Silverstone Circuit"], correct: 0 },
      { q: "What is the primary objective of Trail Braking?", options: ["Keeping engine temps cold", "Maintaining front-end grip into corner entry", "Reducing brake pad wear", "Locking the rear differential"], correct: 1 },
      { q: "What metric does iRating determine on the iRacing service?", options: ["Vehicle speed multiplier", "Driver matchmaking skill rating", "Fuel burn efficiency", "Engine displacement class"], correct: 1 },
      { q: "What is the typical endurance stint length on a GT3 fuel tank in iRacing?", options: ["20 minutes", "60 to 65 minutes", "180 minutes", "10 minutes"], correct: 1 },
      { q: "What telemetry channel measures tire deformation relative to wheel velocity?", options: ["Slip Angle / Slip Ratio", "Pedal potentiometer", "Rocker travel", "Lambda sensor"], correct: 0 },
      { q: "In what Barcelona district is Muntrume Motorsport headquarters located?", options: ["Sant Andreu", "Eixample", "Gràcia", "Sants"], correct: 0 },
      { q: "What happens during aerodynamic pitch sensitivity on a GT3 car?", options: ["Brake fluid boils", "Center of pressure shifts between axles under braking", "Rear wing detaches", "Tire pressure drops"], correct: 1 },
      { q: "Who founded Muntrume Motorsport?", options: ["Alberto Trujillo", "Mateo Berbis", "Eduardo Chongkan", "Un patrocinador externo"], correct: 0 }
    ];

    let triviaCurrent = 0, triviaScore = 0, triviaAnswered = false, triviaQuestions = [];

    function initTrivia() {
      triviaQuestions = [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5);
      triviaCurrent = 0;
      triviaScore = 0;
      document.getElementById('trivia-score').textContent = '0';
      document.getElementById('triviaEnd').classList.add('hidden');
      document.getElementById('triviaContent').classList.remove('hidden');
      showTriviaQuestion();
    }

    function showTriviaQuestion() {
      triviaAnswered = false;
      const q = triviaQuestions[triviaCurrent];
      document.getElementById('triviaQuestion').textContent = q.q;
      document.getElementById('trivia-qnum').textContent = `${triviaCurrent + 1}/${triviaQuestions.length}`;
      document.getElementById('triviaNext').classList.add('hidden');
      document.getElementById('triviaOptions').innerHTML = q.options.map((opt, i) => `
        <button class="trivia-option font-medium" onclick="answerTrivia(${i})">${opt}</button>
      `).join('');
    }

    function answerTrivia(idx) {
      if (triviaAnswered) return;
      triviaAnswered = true;
      const q = triviaQuestions[triviaCurrent];
      const buttons = document.querySelectorAll('.trivia-option');
      buttons[q.correct].classList.add('correct');
      if (idx !== q.correct) {
        buttons[idx].classList.add('wrong');
      } else {
        triviaScore++;
      }
      buttons.forEach(b => b.disabled = true);
      document.getElementById('trivia-score').textContent = triviaScore;

      if (triviaCurrent < triviaQuestions.length - 1) {
        document.getElementById('triviaNext').classList.remove('hidden');
      } else {
        setTimeout(() => {
          document.getElementById('triviaContent').classList.add('hidden');
          document.getElementById('triviaEnd').classList.remove('hidden');
          document.getElementById('triviaFinalScore').textContent = triviaScore;
        }, 1200);
      }
    }

    function nextTrivia() {
      triviaCurrent++;
      showTriviaQuestion();
    }

    // C. F1 REACTION TEST
    let reactionState = 'idle', reactionTimeout = null, reactionStart = 0, reactionBest = null, lightInterval = null;

    function resetReaction() {
      reactionState = 'idle';
      clearTimeout(reactionTimeout);
      clearInterval(lightInterval);
      for (let i = 1; i <= 5; i++) document.getElementById(`light${i}`).className = 'f1-light';
      document.getElementById('reactionStatus').textContent = 'Press INITIATE SEQUENCE to begin';
      document.getElementById('reactionTime').classList.add('hidden');
      document.getElementById('reactionBtn').textContent = 'Initiate Sequence';
      document.getElementById('reactionBtn').disabled = false;
    }

    function handleReactionClick() {
      if (reactionState === 'idle' || reactionState === 'done' || reactionState === 'jumpstart') {
        startReactionSequence();
      } else if (reactionState === 'waiting') {
        jumpStart();
      } else if (reactionState === 'go') {
        recordReaction();
      }
    }

    function startReactionSequence() {
      reactionState = 'waiting';
      document.getElementById('reactionStatus').textContent = 'Holding revs... Watch the lights...';
      document.getElementById('reactionTime').classList.add('hidden');
      document.getElementById('reactionBtn').textContent = 'Wait For Lights Out';
      document.getElementById('reactionBtn').disabled = true;

      for (let i = 1; i <= 5; i++) document.getElementById(`light${i}`).className = 'f1-light';

      let lIdx = 1;
      lightInterval = setInterval(() => {
        if (lIdx > 5) {
          clearInterval(lightInterval);
          const delay = 1000 + Math.random() * 2500;
          reactionTimeout = setTimeout(() => {
            if (reactionState !== 'waiting') return;
            reactionState = 'go';
            for (let i = 1; i <= 5; i++) document.getElementById(`light${i}`).className = 'f1-light go';
            document.getElementById('reactionStatus').textContent = 'LIGHTS OUT! CLICK NOW!';
            document.getElementById('reactionBtn').textContent = 'DUMP CLUTCH NOW!';
            document.getElementById('reactionBtn').disabled = false;
            reactionStart = performance.now();
          }, delay);
          return;
        }
        document.getElementById(`light${lIdx}`).classList.add('on');
        lIdx++;
      }, 400);
    }

    function jumpStart() {
      reactionState = 'jumpstart';
      clearTimeout(reactionTimeout);
      clearInterval(lightInterval);
      for (let i = 1; i <= 5; i++) document.getElementById(`light${i}`).className = 'f1-light';
      document.getElementById('reactionStatus').innerHTML = '<span class="text-red-400 font-bold">False Start Penalty (+5.0s) · Jump Start Detected</span>';
      document.getElementById('reactionBtn').textContent = 'Reset Sequence';
      document.getElementById('reactionBtn').disabled = false;
    }

    function recordReaction() {
      const rt = Math.round(performance.now() - reactionStart);
      reactionState = 'done';
      for (let i = 1; i <= 5; i++) document.getElementById(`light${i}`).className = 'f1-light';
      document.getElementById('reactionTime').textContent = `${rt} ms`;
      document.getElementById('reactionTime').classList.remove('hidden');

      let rating = 'Class D: Below safety car threshold. Practice launch timing.';
      if (rt < 200) rating = 'Class S: Pro-grade reaction latency (<200ms).';
      else if (rt < 240) rating = 'Class A: Top split GT3 reaction benchmark (<240ms).';
      else if (rt < 300) rating = 'Class B: Competitive launch pace (<300ms).';

      document.getElementById('reactionStatus').textContent = rating;
      document.getElementById('reactionBtn').textContent = 'Run Again';
      document.getElementById('reactionBtn').disabled = false;

      if (!reactionBest || rt < reactionBest) {
        reactionBest = rt;
        document.getElementById('reaction-best').textContent = `${rt} ms`;
      }
    }

    // D. CIRCUIT MEMORY MATCH
    const CIRCUITS = [
      { code: 'SPA', name: 'Spa' },
      { code: 'MNZ', name: 'Monza' },
      { code: 'LMN', name: 'Le Mans' },
      { code: 'SUZ', name: 'Suzuka' },
      { code: 'NUR', name: 'Nordschleife' },
      { code: 'SEB', name: 'Sebring' },
      { code: 'DAY', name: 'Daytona' },
      { code: 'BTH', name: 'Bathurst' }
    ];
    let memoryCards = [], memoryFlipped = [], memoryMatched = 0, memoryMoves = 0, memoryLocked = false;

    function initMemory() {
      memoryMatched = 0; memoryMoves = 0; memoryFlipped = []; memoryLocked = false;
      memoryCards = [...CIRCUITS, ...CIRCUITS].sort(() => Math.random() - 0.5).map((c, i) => ({ ...c, id: i, flipped: false, matched: false }));
      renderMemory();
    }

    function renderMemory() {
      const grid = document.getElementById('memoryGrid');
      grid.innerHTML = memoryCards.map((card, i) => `
        <div class="memory-card ${card.flipped || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}" onclick="flipMemory(${i})">
          <div class="memory-card-inner">
            <div class="memory-back font-bold text-xs">MRT</div>
            <div class="memory-front">
              <div class="text-center px-1">
                <div class="inline-block text-xs font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-[var(--r-accent)]/15 text-[var(--r-accent)] border border-[var(--r-accent)]/30 mb-1">${card.code}</div>
                <div class="text-[11px] font-semibold text-[var(--r-text)] truncate">${card.name}</div>
              </div>
            </div>
          </div>
        </div>
      `).join('');
      document.getElementById('memory-moves').textContent = memoryMoves;
      document.getElementById('memory-pairs').textContent = `${memoryMatched}/8`;
      document.getElementById('memoryWin').classList.add('hidden');
    }

    function flipMemory(idx) {
      if (memoryLocked) return;
      const card = memoryCards[idx];
      if (card.flipped || card.matched) return;

      card.flipped = true;
      memoryFlipped.push(idx);
      document.querySelectorAll('.memory-card')[idx].classList.add('flipped');

      if (memoryFlipped.length === 2) {
        memoryMoves++;
        memoryLocked = true;
        const [i1, i2] = memoryFlipped;
        const c1 = memoryCards[i1], c2 = memoryCards[i2];
        if (c1.name === c2.name) {
          c1.matched = true; c2.matched = true;
          memoryMatched++;
          setTimeout(() => {
            document.querySelectorAll('.memory-card')[i1].classList.add('matched');
            document.querySelectorAll('.memory-card')[i2].classList.add('matched');
            memoryFlipped = [];
            memoryLocked = false;
            document.getElementById('memory-moves').textContent = memoryMoves;
            document.getElementById('memory-pairs').textContent = `${memoryMatched}/8`;
            if (memoryMatched === 8) {
              document.getElementById('memoryFinalMoves').textContent = memoryMoves;
              document.getElementById('memoryWin').classList.remove('hidden');
            }
          }, 400);
        } else {
          setTimeout(() => {
            c1.flipped = false; c2.flipped = false;
            document.querySelectorAll('.memory-card')[i1].classList.remove('flipped');
            document.querySelectorAll('.memory-card')[i2].classList.remove('flipped');
            memoryFlipped = [];
            memoryLocked = false;
            document.getElementById('memory-moves').textContent = memoryMoves;
          }, 900);
        }
      }
    }

    // 10. SYSTEM CLOCK & INITIALIZATION
    function updateSystemTime() {
      const el = document.getElementById('currentDate');
      if (el) el.textContent = new Date().toUTCString().replace('GMT', 'UTC');
    }

    function initNewsSystem() {
      setupNewsListeners();
      updateSystemTime();
      setInterval(updateSystemTime, 1000);
      selectGame('wordsearch');
      
      // 1. Instant render with baseline news (zero blank/skeleton screen)
      const loadingEl = document.getElementById('loadingState');
      const featuredEl = document.getElementById('featuredGrid');
      if (loadingEl) loadingEl.classList.add('hidden');
      if (featuredEl) featuredEl.classList.remove('hidden');

      renderAllSections();
      renderTrending();
      loadAIBrief();

      const breaking = allNews.filter(n => n.isBreaking);
      if (breaking.length > 0) showBreakingTicker(breaking);

      // 2. Load team dispatches from markdown file
      loadTeamNewsFromMD().finally(() => {
        // 3. Attempt background RSS sync without blocking the user
        loadAllNews();
      });

      // Background periodic sync every 15 minutes
      setInterval(loadAllNews, 15 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initNewsSystem);
    } else {
      initNewsSystem();
    }

    // Expose all interactive functions to global window scope
    window.loadAllNews = loadAllNews;
    window.refreshAIBrief = refreshAIBrief;
    window.toggleGames = toggleGames;
    window.selectGame = selectGame;
    window.initWordSearch = initWordSearch;
    window.initTrivia = initTrivia;
    window.answerTrivia = answerTrivia;
    window.nextTrivia = nextTrivia;
    window.resetReaction = resetReaction;
    window.handleReactionClick = handleReactionClick;
    window.initMemory = initMemory;
    window.flipMemory = flipMemory;
