import fs from 'node:fs';
import path from 'node:path';

const SITE_ROOT = path.resolve('_site');
const PUBLIC_SITEMAP = path.resolve('public/sitemap.xml');
const SITE_SITEMAP = path.resolve('_site/sitemap.xml');
const BASE_URL = 'https://muntru.me';

function getPriorityAndFreq(urlPath) {
  if (urlPath === '' || urlPath === '/' || urlPath === '/garage') {
    return { priority: '1.0', changefreq: 'daily' };
  }
  if (urlPath === '/news' || urlPath === '/noticias' || urlPath === '/drivers' || urlPath === '/pilotos' || urlPath === '/paddock') {
    return { priority: '0.9', changefreq: 'daily' };
  }
  if (urlPath.startsWith('/news/') || urlPath.startsWith('/noticias/')) {
    return { priority: '0.8', changefreq: 'weekly' };
  }
  if (urlPath.startsWith('/drivers/') || urlPath.startsWith('/pilotos/') || urlPath.startsWith('/d/')) {
    return { priority: '0.7', changefreq: 'weekly' };
  }
  if (urlPath === '/aviso-legal' || urlPath === '/privacidad' || urlPath === '/cookies' || urlPath.startsWith('/legal/')) {
    return { priority: '0.3', changefreq: 'monthly' };
  }
  return { priority: '0.6', changefreq: 'weekly' };
}

function scanHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanHtmlFiles(full, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const allHtml = scanHtmlFiles(SITE_ROOT);
const urls = new Map();
const today = new Date().toISOString().split('T')[0];

for (const filePath of allHtml) {
  const rel = path.relative(SITE_ROOT, filePath).replace(/\\/g, '/');
  
  // Skip 404, private routes and pages marked noindex
  if (
    rel === '404.html' ||
    rel.startsWith('admin') ||
    rel.startsWith('email-preferences') ||
    rel.startsWith('login') ||
    rel.startsWith('paddock/sala')
  ) {
    continue;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  if (/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) continue;

  let cleanUrl = '';
  if (rel === 'index.html') {
    cleanUrl = `${BASE_URL}/`;
  } else if (rel.endsWith('/index.html')) {
    cleanUrl = `${BASE_URL}/${rel.replace(/\/index\.html$/, '')}`;
  } else if (rel.endsWith('.html')) {
    cleanUrl = `${BASE_URL}/${rel.replace(/\.html$/, '')}`;
  }

  const urlPath = cleanUrl.replace(BASE_URL, '');
  const { priority, changefreq } = getPriorityAndFreq(urlPath);
  urls.set(cleanUrl, { priority, changefreq });
}

// Ensure /garage is explicitly present
if (!urls.has(`${BASE_URL}/garage`)) {
  urls.set(`${BASE_URL}/garage`, { priority: '1.0', changefreq: 'daily' });
}

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

const sortedUrls = Array.from(urls.entries()).sort((a, b) => {
  if (b[1].priority !== a[1].priority) {
    return parseFloat(b[1].priority) - parseFloat(a[1].priority);
  }
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
if (fs.existsSync(SITE_ROOT)) {
  fs.writeFileSync(SITE_SITEMAP, xml, 'utf8');
}

console.log(`[generate-sitemap] Generated full sitemap with ${urls.size} URLs!`);
