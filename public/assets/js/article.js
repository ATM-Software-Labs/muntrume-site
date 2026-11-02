/**
 * 🏁 Muntrume Motorsport · article.js
 * Institutional Client Engine
 */

function thumb640(src) {
      const m = /^assets\/img\/(coche[1-4]|race1)\.(webp|jpg)$/.exec(src || '/assets/img/coche1.webp');
      return m ? `/assets/img/${m[1]}-640.webp` : src;
    }

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

    // 2. Slug Helper
    function slugify(text) {
      return (text || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // 3. Fallback Team Articles (none published yet)
    const FALLBACK_DISPATCHES = [];

    // 4. Markdown Parser for Full Articles
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
          news.push({
            id: slugify(title),
            title,
            date: date || '2026-07-02',
            author: author || 'Muntrume Motorsport',
            category: category || 'General',
            image: image || '/assets/img/coche1.webp',
            content
          });
        }
      });
      return news.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // 5. HTML Markdown Converter for Editorial Body
    function renderMarkdownToHtml(md) {
      if (!md) return '';
      const lines = md.split(/\r?\n/);
      let html = '';
      let inList = false;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (!line) {
          if (inList) { html += '</ul>'; inList = false; }
          continue;
        }

        // Subheadings
        if (line.startsWith('### ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h3>${formatInline(line.substring(4))}</h3>`;
          continue;
        }
        if (line.startsWith('## ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<h2>${formatInline(line.substring(3))}</h2>`;
          continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
          if (inList) { html += '</ul>'; inList = false; }
          html += `<blockquote>${formatInline(line.substring(2))}</blockquote>`;
          continue;
        }

        // Bullet List
        if (line.startsWith('- ') || line.startsWith('* ')) {
          if (!inList) { html += '<ul>'; inList = true; }
          html += `<li>${formatInline(line.substring(2))}</li>`;
          continue;
        }

        if (inList) { html += '</ul>'; inList = false; }

        // Paragraph
        html += `<p>${formatInline(line)}</p>`;
      }

      if (inList) html += '</ul>';
      return html;
    }

    function formatInline(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    function formatDate(d) {
      try {
        return new Date(d).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
      } catch (e) {
        return d;
      }
    }

    function getAuthorInitials(name) {
      if (!name) return 'MRT';
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }

    function getAuthorRole(author) {
      return '';
    }

    // 6. Share Functionality
    function shareArticle() {
      const url = window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          const btnText = document.getElementById('shareBtnText');
          if (btnText) {
            btnText.textContent = 'Link Copied!';
            setTimeout(() => { btnText.textContent = 'Share Dispatch'; }, 2200);
          }
        });
      }
    }

    // 7. Core Dispatch Loader & Router
    async function loadArticle() {
      let articles = [...FALLBACK_DISPATCHES];

      try {
        const res = await fetch('noticias-equipo.md?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const md = await res.text();
          const parsed = parseTeamNewsMarkdown(md);
          if (parsed.length > 0) articles = parsed;
        }
      } catch (e) {
        console.warn('[Article] Using fallback team news baseline');
      }

      // Read ?id= or ?slug= from URL
      const params = new URLSearchParams(window.location.search);
      const requestedId = (params.get('id') || params.get('slug') || '').toLowerCase().trim();

      // Resolve matching article
      let activeArticle = null;
      if (requestedId) {
        activeArticle = articles.find(a => a.id === requestedId || slugify(a.title) === requestedId);
        if (!activeArticle) {
          activeArticle = articles.find(a => a.id.includes(requestedId) || requestedId.includes(a.id));
        }
      }

      // Not found: show an explicit empty state (no silent fallback to another article)
      if (!activeArticle) {
        document.title = 'Dispatch not found · Muntrume Motorsport';
        document.getElementById('articleNotFound').style.display = '';
        return;
      }
      document.getElementById('articleWrap').style.display = '';
      const robots = document.querySelector('meta[name="robots"]');
      if (robots) robots.remove();

      // Populate DOM elements
      document.title = `${activeArticle.title} · Muntrume Motorsport`;
      document.getElementById('metaTitle').setAttribute('content', `${activeArticle.title} · Muntrume Motorsport`);
      document.getElementById('ogTitle').setAttribute('content', `${activeArticle.title} · Muntrume Motorsport`);
      
      const cleanSnippet = (activeArticle.content || '').replace(/[#*>\-]/g, '').trim().substring(0, 160);
      document.getElementById('metaDesc').setAttribute('content', cleanSnippet);
      document.getElementById('ogDesc').setAttribute('content', cleanSnippet);

      document.getElementById('breadcrumbCategory').textContent = activeArticle.category || 'Team Dispatch';
      document.getElementById('articleCategoryBadge').textContent = activeArticle.category || 'Team Dispatch';
      document.getElementById('articleDate').textContent = formatDate(activeArticle.date);
      document.getElementById('articleTitle').textContent = activeArticle.title;
      
      const authorName = activeArticle.author || 'Muntrume Motorsport';
      document.getElementById('articleAuthor').textContent = authorName;
      document.getElementById('authorRole').innerHTML = getAuthorRole(authorName);
      document.getElementById('authorAvatar').textContent = getAuthorInitials(authorName);

      const coverImg = activeArticle.image || '/assets/img/race1.webp';
      const imgEl = document.getElementById('articleImage');
      imgEl.onerror = function() { this.onerror = null; this.src = '/assets/img/coche1.webp'; };
      imgEl.src = coverImg;
      imgEl.alt = activeArticle.title;
      document.getElementById('imageCaption').textContent = activeArticle.category || '';

      // Render Body
      document.getElementById('articleContent').innerHTML = renderMarkdownToHtml(activeArticle.content);

      // Render Related Team Dispatches (excluding current article)
      const related = articles.filter(a => a.id !== activeArticle.id).slice(0, 3);
      const relatedContainer = document.getElementById('relatedDispatchesGrid');
      if (relatedContainer) {
        relatedContainer.innerHTML = related.map(a => `
          <a href="/article?id=${a.id}" class="group block bg-[#161c24] border border-white/10 hover:border-emerald-500/30 rounded-2xl overflow-hidden transition duration-300 shadow-md flex flex-col justify-between">
            <div>
              <div class="h-36 w-full overflow-hidden bg-[#0e1217] relative">
                <img src="${thumb640(a.image)}" width="640" height="360" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/img/coche1-640.webp';" alt="${a.title}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100">
                <div class="absolute top-3 left-3">
                  <span class="px-2 py-0.5 rounded-full bg-[#0e1217]/80 backdrop-blur-md text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    ${a.category}
                  </span>
                </div>
              </div>
              <div class="p-5">
                <div class="text-[11px] text-neutral-400 mb-2">${formatDate(a.date)}</div>
                <h3 class="font-bold text-white text-sm line-clamp-2 mb-2 group-hover:text-emerald-400 transition-colors">
                  ${a.title}
                </h3>
                <p class="text-neutral-400 text-xs line-clamp-2 leading-relaxed">
                  ${(a.content || '').replace(/[#*>\-]/g, '').trim().substring(0, 90)}...
                </p>
              </div>
            </div>
            <div class="p-5 pt-0">
              <span class="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                <span>Read Dispatch</span>
                <span>&rarr;</span>
              </span>
            </div>
          </a>
        `).join('');
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadArticle);
    } else {
      loadArticle();
    }
