import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);
const siteDir = path.join(rootDir, '_site');

const minifierOptions = {
  collapseWhitespace: false, // Preserve exact spacing between tags, buttons and spans to prevent UI collisions
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: false, // Astro/Vite already minifies CSS cleanly
  minifyJS: false,  // Preserve inline script literals and avoid Terser edge-case mangling
  keepClosingSlash: true
};

async function getHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(await getHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function compressAll() {
  if (!fs.existsSync(siteDir)) {
    console.error(`[compress-html] Output directory '${siteDir}' does not exist.`);
    process.exit(1);
  }

  const files = await getHtmlFiles(siteDir);
  console.log(`[compress-html] Found ${files.length} HTML files to minify...`);

  let totalOriginal = 0;
  let totalMinified = 0;

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, 'utf-8');
    const originalSize = Buffer.byteLength(original, 'utf-8');
    totalOriginal += originalSize;

    try {
      const minified = await minify(original, minifierOptions);
      const minifiedSize = Buffer.byteLength(minified, 'utf-8');
      totalMinified += minifiedSize;
      fs.writeFileSync(filePath, minified, 'utf-8');
    } catch (err) {
      console.warn(`[compress-html] Error minifying ${path.relative(siteDir, filePath)}:`, err.message);
    }
  }

  const reduction = (((totalOriginal - totalMinified) / totalOriginal) * 100).toFixed(1);
  console.log(`[compress-html] Successfully compressed ${files.length} HTML files.`);
  console.log(`[compress-html] Total size: ${(totalOriginal / 1024).toFixed(1)} KB -> ${(totalMinified / 1024).toFixed(1)} KB (-${reduction}%)`);
}

compressAll().catch(err => {
  console.error('[compress-html] Fatal error:', err);
  process.exit(1);
});
