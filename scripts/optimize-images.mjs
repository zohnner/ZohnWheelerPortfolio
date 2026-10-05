#!/usr/bin/env node
// One-off stock photo optimizer. sharp is NOT a project dependency:
//   npm i --no-save sharp
//   node scripts/optimize-images.mjs <sourceDir> <industry>
// Each <sourceDir>/<name>.(jpg|jpeg|png|webp) becomes
// public/sk/stock/<industry>/<name>.jpg and <name>-sm.jpg. Heroes are
// 1600x900/800x450; everything else 1200x750/600x375 (matches imgAttrs()).

import fs from 'node:fs';
import path from 'node:path';

const [srcDir, industry] = process.argv.slice(2);
if (!srcDir || !industry) {
  console.error('Usage: node scripts/optimize-images.mjs <sourceDir> <industry>');
  process.exit(1);
}

const { default: sharp } = await import('sharp');
const outDir = path.join('public', 'sk', 'stock', industry);
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  const name = path.parse(file).name;
  const [w, h] = /^hero(-\d+)?$/.test(name) ? [1600, 900] : [1200, 750];
  const src = path.join(srcDir, file);
  for (const [suffix, scale] of [['', 1], ['-sm', 0.5]]) {
    const dest = path.join(outDir, `${name}${suffix}.jpg`);
    await sharp(src)
      .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(dest);
    console.log(`${dest} ${Math.round(fs.statSync(dest).size / 1024)}KB`);
  }
}
