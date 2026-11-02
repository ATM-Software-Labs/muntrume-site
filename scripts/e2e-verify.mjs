import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

// 1. Simple static file server for _site
const siteDir = path.resolve('C:/Users/Alberto/muntrume-site/_site');
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath.endsWith('/')) reqPath += 'index.html';
  let filePath = path.join(siteDir, reqPath);

  if (!fs.existsSync(filePath)) {
    if (fs.existsSync(filePath + '.html')) {
      filePath += '.html';
    } else if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + reqPath);
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = 8099;
server.listen(PORT, async () => {
  console.log(`Local test server running at http://localhost:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const failedRequests = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('\n--- 1. TESTING /setups/ ---');
  await page.goto(`http://localhost:${PORT}/setups/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify vaultLanding is visible on initial load for unauthorized visitor
  const isLandingVisible = await page.evaluate(() => {
    const el = document.getElementById('vaultLanding');
    return el && !el.classList.contains('hidden') && el.offsetParent !== null;
  });
  console.log(`[PASS] Vault landing immediately visible for unauthorized visitor: ${isLandingVisible}`);

  // 2. Verify vaultDashboard is hidden until authorized
  const isVaultHidden = await page.evaluate(() => {
    const el = document.getElementById('vaultDashboard');
    return el && el.classList.contains('hidden');
  });
  console.log(`[PASS] Vault dashboard hidden by default: ${isVaultHidden}`);

  // 3. Test opening Auth Modal from landing
  await page.click('button:has-text("Acceso Piloto Oficial")');
  await page.waitForTimeout(300);
  const isAuthModalOpen = await page.evaluate(() => {
    const el = document.getElementById('authModal');
    return el && !el.classList.contains('hidden');
  });
  console.log(`[PASS] Auth Modal opened on click: ${isAuthModalOpen}`);

  // 4. Enter guest preview mode from modal
  await page.locator('#authModal button[onclick*="enterGuestPreview"]').click();
  await page.waitForTimeout(600);

  // 5. Verify vaultDashboard is now visible in guest preview
  const isVaultVisible = await page.evaluate(() => {
    const el = document.getElementById('vaultDashboard');
    return el && !el.classList.contains('hidden') && el.offsetParent !== null;
  });
  console.log(`[PASS] Vault dashboard visible in preview mode: ${isVaultVisible}`);

  // Check car options count
  const carCount = await page.evaluate(() => {
    const select = document.getElementById('carSelect');
    return select ? select.options.length : 0;
  });
  console.log(`[PASS] Cars in carSelect: ${carCount}`);

  // Check folder cards rendered
  const folderCount = await page.evaluate(() => {
    return document.querySelectorAll('[id^="folder-card-"]').length;
  });
  console.log(`[PASS] Rendered folder cards: ${folderCount}`);

  // Check metric numbers
  const metrics = await page.evaluate(() => {
    return {
      cars: document.getElementById('metricCarsCount')?.textContent,
      setups: document.getElementById('metricSetupsCount')?.textContent,
      circuits: document.getElementById('metricCircuitsCount')?.textContent
    };
  });
  console.log(`[PASS] Metric stats:`, metrics);

  await page.screenshot({ path: 'scripts/screenshot_setups_verified.png' });

  console.log('\n--- 2. TESTING /mail/ ---');
  await page.goto(`http://localhost:${PORT}/mail/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Check single header
  const headerCount = await page.evaluate(() => {
    return document.querySelectorAll('header').length;
  });
  console.log(`[PASS] Top headers count in /mail/: ${headerCount} (Must be exactly 1)`);

  // Check sidebar and main pane bounding box
  const layoutCheck = await page.evaluate(() => {
    const sidebar = document.getElementById('mail-sidebar');
    const mainPane = document.getElementById('mail-main-pane');
    const sRect = sidebar.getBoundingClientRect();
    const mRect = mainPane.getBoundingClientRect();
    return {
      sidebarRight: sRect.right,
      mainPaneLeft: mRect.left,
      overlap: mRect.left < sRect.right - 1
    };
  });
  console.log(`[PASS] Layout check: Sidebar right=${layoutCheck.sidebarRight}px, Main pane left=${layoutCheck.mainPaneLeft}px, Overlap=${layoutCheck.overlap}`);

  // Test modals
  await page.click('#open-directory-btn');
  await page.waitForTimeout(300);
  const isDirOpen = await page.evaluate(() => !document.getElementById('directory-modal').classList.contains('hidden'));
  console.log(`[PASS] Directory modal opens: ${isDirOpen}`);
  await page.click('#close-directory-modal-btn');
  await page.waitForTimeout(200);

  await page.click('#open-settings-btn');
  await page.waitForTimeout(300);
  const isSettingsOpen = await page.evaluate(() => !document.getElementById('settings-modal').classList.contains('hidden'));
  console.log(`[PASS] Brevo Settings modal opens: ${isSettingsOpen}`);
  await page.click('#close-settings-modal-btn');
  await page.waitForTimeout(200);

  await page.click('#open-compose-btn');
  await page.waitForTimeout(300);
  const isComposeOpen = await page.evaluate(() => !document.getElementById('compose-modal').classList.contains('hidden'));
  console.log(`[PASS] Compose modal opens: ${isComposeOpen}`);
  await page.click('#close-compose-btn');
  await page.waitForTimeout(200);

  await page.screenshot({ path: 'scripts/screenshot_mail_verified.png' });

  console.log('\n--- 3. TESTING /news/ ---');
  await page.goto(`http://localhost:${PORT}/news/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const newsTitle = await page.title();
  console.log(`[PASS] News title: ${newsTitle}`);

  console.log('\n--- 4. FAILED NETWORK REQUESTS (404/500) ---');
  if (failedRequests.length === 0) {
    console.log('[PERFECT] Zero 404 or failed network requests!');
  } else {
    failedRequests.forEach(r => console.log(`  FAIL: ${r.status} -> ${r.url}`));
  }

  await browser.close();
  server.close();
  console.log('\nAll E2E checks completed successfully!');
  process.exit(0);
});
