/**
 * Build labeled left/right (0.6.1 | 0.9.1) comparison PNGs and a pixel-diff report.
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const beforeDir = path.join(here, 'before');
const afterDir = path.join(here, 'after');
const outDir = path.join(here, 'side-by-side');

const LABEL_H = 44;
const GAP = 8;
const LEFT_LABEL = 'justif 0.6.1  (before)';
const RIGHT_LABEL = 'justif 0.9.1  (after)';

function svgLabel(text, width, height, fill) {
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${fill}"/>
  <text x="16" y="${Math.round(height * 0.68)}" fill="#f4efe4" font-size="20"
    font-family="ui-sans-serif, system-ui, Helvetica, Arial, sans-serif">${escaped}</text>
</svg>`);
}

function meanAbsDiff(a, b) {
  if (a.length !== b.length) return null;
  let sum = 0;
  let changed = 0;
  const pixels = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const d =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
    sum += d;
    if (d > 12) changed += 1;
  }
  return {
    meanChannelDelta: sum / a.length,
    changedPixelRatio: changed / pixels,
  };
}

async function composePair(name) {
  const leftPath = path.join(beforeDir, name);
  const rightPath = path.join(afterDir, name);
  const left = sharp(leftPath);
  const right = sharp(rightPath);
  const leftMeta = await left.metadata();
  const rightMeta = await right.metadata();
  const width = Math.max(leftMeta.width ?? 1, rightMeta.width ?? 1);
  const height = Math.max(leftMeta.height ?? 1, rightMeta.height ?? 1);

  const leftBuf = await sharp(leftPath)
    .resize(width, height, { fit: 'contain', background: '#1b1814' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rightBuf = await sharp(rightPath)
    .resize(width, height, { fit: 'contain', background: '#1b1814' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const stats = meanAbsDiff(leftBuf.data, rightBuf.data);
  const identical = stats != null && stats.changedPixelRatio < 0.002 && stats.meanChannelDelta < 0.4;

  const leftPng = await sharp(leftBuf.data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();
  const rightPng = await sharp(rightBuf.data, {
    raw: { width, height, channels: 4 },
  }).png().toBuffer();

  const leftLabeled = await sharp({
    create: { width, height: height + LABEL_H, channels: 4, background: '#1b1814' },
  })
    .composite([
      { input: svgLabel(LEFT_LABEL, width, LABEL_H, '#3a2f22'), top: 0, left: 0 },
      { input: leftPng, top: LABEL_H, left: 0 },
    ])
    .png()
    .toBuffer();

  const rightLabeled = await sharp({
    create: { width, height: height + LABEL_H, channels: 4, background: '#1b1814' },
  })
    .composite([
      { input: svgLabel(RIGHT_LABEL, width, LABEL_H, '#1f3a32'), top: 0, left: 0 },
      { input: rightPng, top: LABEL_H, left: 0 },
    ])
    .png()
    .toBuffer();

  const canvasWidth = width * 2 + GAP;
  const canvasHeight = height + LABEL_H;
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: '#0f0d0a',
    },
  })
    .composite([
      { input: leftLabeled, top: 0, left: 0 },
      { input: rightLabeled, top: 0, left: width + GAP },
    ])
    .png()
    .toFile(path.join(outDir, name));

  return { file: name, width, height, identical, ...stats };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const names = (await readdir(beforeDir)).filter((n) => n.endsWith('.png')).sort();
  const report = [];
  for (const name of names) {
    const row = await composePair(name);
    report.push(row);
    console.log(
      `${name}: Δ=${row.meanChannelDelta?.toFixed(3)} changed=${((row.changedPixelRatio ?? 0) * 100).toFixed(2)}%${row.identical ? ' IDENTICAL' : ''}`
    );
  }
  await writeFile(path.join(here, 'pixel-diff.json'), `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
