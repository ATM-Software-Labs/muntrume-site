import fs from 'node:fs';
import path from 'node:path';

const SITE_ROOT = path.resolve('_site');
const PUBLIC_SITEMAP = path.resolve('public/sitemap.xml');
const SITE_SITEMAP = path.resolve('_site/sitemap.xml');
const BASE_URL = 'https://muntru.me';

function slashPath(pathname) {
  if (!pathname || pathname === '/') return '/';
  const withLead = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withLead.endsWith('/') ? withLead : `${withLead}/`;
}

function getPriorityAndFreq(urlPath) {
  const p = slashPath(urlPath);
  if (p === '/') return { priority: '1.0', changefreq: 'daily' };
  if (p === '/garage/') return { priority: '1.0', changefreq: 'daily' };
  if (p === '/app/') return { priority: '0.8', changefreq: 'weekly' };
  if (p === '/news/' || p === '/noticias/' || p === '/drivers/' || p === '/pilotos/' || p === '/paddock/') {
    return { priority: '0.9', changefreq: 'daily' };
  }
  if (p.startsWith('/news/') || p.startsWith('/noticias/')) {
    return { priority: '0.8', changefreq: 'weekly' };
  }
  if (p.startsWith('/drivers/') || p.startsWith('/pilotos/') || p.startsWith('/d/')) {
    return { priority: '0.7', changefreq: 'weekly' };
  }
  if (p === '/aviso-legal/' || p === '/privacidad/' || p === '/cookies/' || p.startsWith('/legal/')) {
    return { priority: '0.3', changefreq: 'monthly' };
  }
  return { priority: '0.6', changefreq: 'weekly' };
}

function scanHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scanHtmlFiles(full, fileList);
    else if (entry.isFile() && entry.name.endsWith('.html')) fileList.push(full);
  }
  return fileList;
}

function headHtml(html) {
  const match = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : '';
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? match[1] : '';
}

/** True only when <head> has a real robots meta whose content includes noindex. */
function headIsNoindex(head) {
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const name = attr(tag, 'name').toLowerCase();
    const content = attr(tag, 'content');
    if (name === 'robots' && /\bnoindex\b/i.test(content)) return true;
  }
  return false;
}

function canonicalHref(head) {
  const links = head.match(/<link\b[^>]*>/gi) || [];
  for (const tag of links) {
    const rel = attr(tag, 'rel').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return attr(tag, 'href');
  }
  return '';
}

function isRedirectDocument(head) {
  return /http-equiv\s*=\s*["']refresh["']/i.test(head);
}

function fileToPath(rel) {
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return slashPath(`/${rel.slice(0, -'index.html'.length)}`);
  if (rel.endsWith('.html')) return `/${rel}`;
  return null;
}

const allHtml = scanHtmlFiles(SITE_ROOT);
const urls = new Map();
const today = new Date().toISOString().split('T')[0];

for (const filePath of allHtml) {
  const rel = path.relative(SITE_ROOT, filePath).replace(/\\/g, '/');
  if (
    rel === '404.html' ||
    rel.startsWith('admin/') ||
    rel === 'admin.html' ||
    rel.startsWith('email-preferences') ||
    rel.startsWith('login') ||
    rel.startsWith('app/vincular') ||
    rel.startsWith('paddock/sala') ||
    /^google[0-9a-f]+\.html$/i.test(rel)
  ) {
    continue;
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const head = headHtml(html);
  if (!head) continue;
  if (isRedirectDocument(head)) continue;
  if (headIsNoindex(head)) continue;

  const pagePath = fileToPath(rel);
  if (!pagePath) continue;

  const canonRaw = canonicalHref(head);
  let locPath = slashPath(pagePath);
  if (canonRaw) {
    let canonUrl;
    try { canonUrl = new URL(canonRaw, BASE_URL); }
    catch { continue; }
    const host = canonUrl.hostname.replace(/^www\./, '');
    if (host !== 'muntru.me') continue;
    const canonPath = slashPath(canonUrl.pathname);
    // Legacy aliases stay out unless this document is the canonical URL.
    if (canonPath !== slashPath(pagePath)) continue;
    locPath = canonPath;
  }

  const loc = locPath === '/' ? `${BASE_URL}/` : `${BASE_URL}${locPath}`;
  const { priority, changefreq } = getPriorityAndFreq(locPath);
  urls.set(loc, { priority, changefreq });
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

const sortedUrls = Array.from(urls.entries()).sort((a, b) => {
  if (b[1].priority !== a[1].priority) return parseFloat(b[1].priority) - parseFloat(a[1].priority);
  return a[0].localeCompare(b[0]);
});

for (const [loc, meta] of sortedUrls) {
  xml += `  <url>\n`;
  xml += `    <loc>${loc}</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>${meta.changefreq}</changefreq>\n`;
  xml += `    <priority>${meta.priority}</priority>\n`;
  xml += `  </url>\n`;
}

xml += `</urlset>\n`;

fs.writeFileSync(PUBLIC_SITEMAP, xml, 'utf8');
if (fs.existsSync(SITE_ROOT)) fs.writeFileSync(SITE_SITEMAP, xml, 'utf8');

console.log(`[generate-sitemap] Generated full sitemap with ${urls.size} URLs!`);
