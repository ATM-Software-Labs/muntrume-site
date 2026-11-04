import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple static server for _site or dist
const PORT = 8099;
const SITE_DIR = path.resolve('public');
const DIST_DIR = path.resolve('dist');
const SERVE_DIR = fs.existsSync(DIST_DIR) ? DIST_DIR : path.resolve('_site');

console.log('Serving directory:', SERVE_DIR);

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
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.sto': 'application/octet-stream'
  };
  return map[ext] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  
  if (reqPath.startsWith('/api/helmet')) {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1E2A26"/></svg>');
    return;
  }
  if (reqPath.startsWith('/api/drivers')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
    return;
  }

  let filePath = path.join(SERVE_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  } else if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  // Fallback to public if in dev
  if (!fs.existsSync(filePath)) {
    filePath = path.join(SITE_DIR, reqPath);
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    res.writeHead(200, { 'Content-Type': getContentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found: ' + reqPath);
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`Server listening on http://localhost:${PORT}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 12/13/14 viewport
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true
});

const page = await context.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push({ url: page.url(), text: msg.text() });
  }
});

page.on('pageerror', err => {
  consoleErrors.push({ url: page.url(), text: err.toString() });
});

async function checkPage(pathname) {
  console.log(`\n=== CHECKING MOBILE: ${pathname} ===`);
  await page.goto(`http://localhost:${PORT}${pathname}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // 1. Check horizontal scroll / overflow
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    const overflowingElements = [];
    if (docWidth > winWidth) {
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.right > winWidth + 2) {
          overflowingElements.push({
            tag: el.tagName,
            id: el.id,
            className: el.className ? el.className.toString().slice(0, 80) : '',
            right: rect.right,
            width: rect.width
          });
        }
      });
    }
    return { docWidth, winWidth, hasOverflow: docWidth > winWidth, overflowingElements: overflowingElements.slice(0, 5) };
  });

  console.log(`Horizontal scroll overflow: ${overflow.hasOverflow ? 'YES (BUG!)' : 'NO (GOOD)'} (doc=${overflow.docWidth}px, win=${overflow.winWidth}px)`);
  if (overflow.hasOverflow) {
    console.log('Overflowing sample elements:', overflow.overflowingElements);
  }

  // 2. Test Mobile Menu drawer
  const drawerBtn = await page.$('#navDrawerOpenBtn');
  if (drawerBtn) {
    const isVisible = await drawerBtn.isVisible();
    console.log(`Navbar drawer button visible: ${isVisible}`);
    if (isVisible) {
      await drawerBtn.click({ force: true });
      await page.waitForTimeout(400);
      const isDrawerOpen = await page.evaluate(() => {
        const drawer = document.getElementById('mobileDrawer');
        return drawer && drawer.classList.contains('open');
      });
      console.log(`Drawer opens on click: ${isDrawerOpen ? 'PASS' : 'FAIL'}`);

      // Close drawer
      const closeBtn = await page.$('#navDrawerCloseBtn');
      if (closeBtn) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(400);
      }
    }
  }

  // 3. Special checks on /garage
  if (pathname.includes('/garage')) {
    console.log('\n--- TESTING GARAGE MOBILE INTERACTIONS ---');

    // Test guest mode click or catalog exploration
    const guestBtn = await page.$('button:has-text("Explorar Catálogo")');
    if (guestBtn) {
      console.log('Found guest preview button, clicking...');
      await guestBtn.click();
      await page.waitForTimeout(1000);
    }

    // Test category pills
    const gt3Pill = await page.$('#catPill-gt3');
    if (gt3Pill) {
      await gt3Pill.click();
      await page.waitForTimeout(500);
      console.log('Clicked GT3 Pro pill');
    }

    // Test tab switcher
    const telemetryTabBtn = await page.$('#tabBtnTelemetry');
    if (telemetryTabBtn) {
      await telemetryTabBtn.click();
      await page.waitForTimeout(300);
      console.log('Switched to Box #02 Telemetry tab');
    }

    const commsTabBtn = await page.$('#tabBtnComms');
    if (commsTabBtn) {
      await commsTabBtn.click();
      await page.waitForTimeout(300);
      console.log('Switched to Box #03 Comms tab');
    }

    const setupsTabBtn = await page.$('#tabBtnSetups');
    if (setupsTabBtn) {
      await setupsTabBtn.click();
      await page.waitForTimeout(300);
      console.log('Switched back to Box #01 Setups tab');
    }
  }
}

try {
  await checkPage('/');
  await checkPage('/pilotos');
  await checkPage('/paddock');
  await checkPage('/garage');
  await checkPage('/news');
} catch (e) {
  console.error('Test execution error:', e);
} finally {
  await browser.close();
  server.close();
}

console.log('\n=== CONSOLE ERRORS DETECTED ===');
console.log('Total console errors:', consoleErrors.length);
consoleErrors.forEach(err => console.log(`[${err.url}] ${err.text}`));
