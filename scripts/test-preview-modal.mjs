import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8098;
const SERVE_DIR = path.resolve('_site');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return map[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(SERVE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }
  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 } // mobile
});
const page = await context.newPage();

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.toString()));

await page.goto(`http://localhost:${PORT}/setups`, { waitUntil: 'networkidle' });

// Click guest preview
await page.click('button:has-text("Explorar catálogo en modo invitado")');
await page.waitForTimeout(1000);

// Find and click the Preview button: "Vista Previa"
const previewBtn = await page.$('button:has-text("Vista Previa")');
console.log('Preview button exists:', !!previewBtn);

if (previewBtn) {
  await previewBtn.click();
  await page.waitForTimeout(1000);

  const modalState = await page.evaluate(() => {
    const m = document.getElementById('setupPreviewModal');
    return {
      exists: !!m,
      isHidden: m ? m.classList.contains('hidden') : true,
      title: document.getElementById('previewSetupTitle')?.textContent,
      car: document.getElementById('previewCarName')?.textContent,
      circuit: document.getElementById('previewCircuitName')?.textContent
    };
  });
  console.log('Modal state after click:', modalState);
}

console.log('Console/page errors:', errors);

await browser.close();
server.close();
