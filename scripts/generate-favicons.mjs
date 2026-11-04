import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SVG_FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0E1412"/>
      <stop offset="100%" stop-color="#060908"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00FFAA"/>
      <stop offset="100%" stop-color="#00E699"/>
    </linearGradient>
  </defs>
  <!-- Background squircle -->
  <rect width="64" height="64" rx="16" fill="url(#bg)"/>
  <rect x="1" y="1" width="62" height="62" rx="15" fill="none" stroke="#1A2823" stroke-width="1.5"/>
  <!-- Minimalist Racing "M" Glyph -->
  <path d="M12 47 V17 h7.5 l12.5 17 12.5 -17 H52 v30 h-7.5 V27.5 L32 44 19.5 27.5 V47 Z" fill="url(#neon)"/>
  <!-- Apex speed accent -->
  <circle cx="32" cy="14" r="2.5" fill="#00FFAA"/>
</svg>`;

async function main() {
  const publicDir = path.resolve('public');
  const imgDir = path.resolve('public/assets/img');

  // 1. Write public/favicon.svg
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), SVG_FAVICON, 'utf-8');
  console.log('Saved public/favicon.svg');

  const svgBuffer = Buffer.from(SVG_FAVICON);

  // 2. Generate PNG sizes
  const sizes = [
    { file: path.join(imgDir, 'favicon-16.png'), size: 16 },
    { file: path.join(imgDir, 'favicon-32.png'), size: 32 },
    { file: path.join(imgDir, 'favicon-48.png'), size: 48 },
    { file: path.join(imgDir, 'apple-touch-icon.png'), size: 180 },
    { file: path.join(imgDir, 'icon-192.png'), size: 192 },
    { file: path.join(imgDir, 'icon-512.png'), size: 512 },
    { file: path.join(imgDir, 'icon-maskable-512.png'), size: 512 }
  ];

  for (const s of sizes) {
    await sharp(svgBuffer)
      .resize(s.size, s.size)
      .png()
      .toFile(s.file);
    console.log(`Generated ${path.basename(s.file)} (${s.size}x${s.size})`);
  }

  // Also create a multi-size ICO or standard 48x48 / 32x32 favicon.ico from 48px PNG
  // A standard PNG-based ICO or 32px PNG renamed to favicon.ico is standard for modern browsers
  // But let's build a real ICO file format with 16, 32, 48 frames.
  const buf16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer();
  const buf32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const buf48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();

  const icoBuffer = buildIco([
    { size: 16, png: buf16 },
    { size: 32, png: buf32 },
    { size: 48, png: buf48 }
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Generated public/favicon.ico with 16x16, 32x32, 48x48 frames');
}

// Simple ICO builder for PNG-compressed frames
function buildIco(images) {
  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let offset = dirSize;
  const entries = [];
  const buffers = [];

  for (const img of images) {
    const s = img.size;
    const len = img.png.length;
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(s >= 256 ? 0 : s, 0); // width
    entry.writeUInt8(s >= 256 ? 0 : s, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(len, 8); // size in bytes
    entry.writeUInt32LE(offset, 12); // offset

    entries.push(entry);
    buffers.push(img.png);
    offset += len;
  }

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // image type 1 = ICO
  header.writeUInt16LE(count, 4); // number of images

  return Buffer.concat([header, ...entries, ...buffers]);
}

main().catch(console.error);
