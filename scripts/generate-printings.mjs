import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

// Turns Seth Kaller's original scans (kept outside the repo — some exceed
// Cloudflare Pages' 25 MiB file cap) into committed web derivatives plus a
// dimensions manifest consumed by src/data/printings.ts.
const ROOT = new URL('../', import.meta.url);
const OUT_DIR = new URL('public/images/printings/', ROOT);
const MANIFEST_PATH = new URL('src/data/printings-images.json', ROOT);

const SOURCE_ROOT =
  process.env.PRINTINGS_SOURCE_DIR ?? join(homedir(), 'Downloads', 'z Federalist Nw');

const THUMB_WIDTH = 640;
const LARGE_WIDTH = 2000;

const SETS = [
  {
    slug: 'federalist-2-pennsylvania-journal',
    dir: '22899.44',
    file: (page) => `22899.44_post_p${page}.jpg`,
    pages: 4
  },
  {
    slug: 'federalist-85-new-york-packet',
    dir: '21076',
    file: (page) => `SJR 021_Ks21076_p${page}.jpg`,
    pages: 4
  },
  {
    slug: 'new-haven-gazette-1787',
    dir: '25030',
    file: (page) => `25030 p${page}.jpg`,
    pages: 8,
    // Interior spreads were scanned sideways, alternating direction by leaf.
    rotate: { 2: 270, 3: 90, 4: 270, 5: 90, 6: 270, 7: 90 }
  },
  {
    slug: 'massachusetts-centinel-1788',
    dir: '30282',
    file: (page) => `30282 p${String(page).padStart(2, '0')}.jpg`,
    pages: 4,
    // The 30282 scans include a color calibration target along the right edge.
    cropRight: 0.09
  }
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isCurrent(outputPath, sourcePath) {
  try {
    const [output, source] = await Promise.all([stat(outputPath), stat(sourcePath)]);
    return output.mtimeMs >= source.mtimeMs;
  } catch {
    return false;
  }
}

async function derive(source, rotation, cropRight, width, outputBase) {
  let pipeline = sharp(source, { limitInputPixels: false }).rotate(rotation ?? 0);
  if (rotation) {
    // extract() reads pre-rotation coordinates unless the rotation is baked in first.
    pipeline = sharp(await pipeline.toBuffer(), { limitInputPixels: false });
  }
  if (cropRight) {
    const metadata = await pipeline.metadata();
    pipeline = pipeline.extract({
      left: 0,
      top: 0,
      width: Math.round(metadata.width * (1 - cropRight)),
      height: metadata.height
    });
  }
  pipeline = pipeline.resize({ width, withoutEnlargement: true });

  const jpegInfo = await pipeline
    .clone()
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(`${outputBase}.jpg`);
  await pipeline.clone().avif({ quality: 50 }).toFile(`${outputBase}.avif`);
  return { w: jpegInfo.width, h: jpegInfo.height };
}

if (!(await exists(SOURCE_ROOT))) {
  console.error(
    `Source scans not found at ${SOURCE_ROOT}.\n` +
      'Set PRINTINGS_SOURCE_DIR to the folder holding the Kaller scan sets ' +
      '(22899.44, 21076, 25030, 30282). Committed derivatives remain valid; ' +
      'this script is only needed to regenerate them.'
  );
  process.exit(1);
}

const manifest = {};

for (const set of SETS) {
  const setDir = new URL(`${set.slug}/`, OUT_DIR);
  await mkdir(setDir, { recursive: true });
  manifest[set.slug] = [];

  for (let page = 1; page <= set.pages; page += 1) {
    const source = join(SOURCE_ROOT, set.dir, set.file(page));
    if (!(await exists(source))) {
      console.error(`Missing source scan: ${source}`);
      process.exit(1);
    }

    const entry = { page };
    for (const [variant, width] of [
      ['thumb', THUMB_WIDTH],
      ['large', LARGE_WIDTH]
    ]) {
      const outputBase = fileURLToPath(new URL(`page-${page}-${variant}`, setDir));
      if (await isCurrent(`${outputBase}.avif`, source)) {
        const metadata = await sharp(`${outputBase}.jpg`).metadata();
        entry[variant] = { w: metadata.width, h: metadata.height };
      } else {
        entry[variant] = await derive(source, set.rotate?.[page], set.cropRight, width, outputBase);
        console.log(`${set.slug} page ${page} ${variant}: ${entry[variant].w}×${entry[variant].h}`);
      }
    }
    manifest[set.slug].push(entry);
  }
}

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${fileURLToPath(MANIFEST_PATH)}`);
