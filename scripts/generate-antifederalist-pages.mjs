// Fetches the New-York Journal page carrying each Anti-Federalist essay from
// the Library of Congress (Chronicling America, public domain) and derives
// committed web images plus a dimensions manifest. Needs only the network —
// re-runnable any time; skips pages whose derivatives already exist.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = new URL('../', import.meta.url);
const OUT_DIR = new URL('public/images/antifederalist/', ROOT);
const MANIFEST_PATH = new URL('src/data/antifederalist-images.json', ROOT);
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

const THUMB_WIDTH = 640;
const LARGE_WIDTH = 2000;

// Keep in lockstep with each essay's `loc` frontmatter block.
const ISSUES = [
  { slug: 'brutus-1', lccn: 'sn83030565', date: '1787-10-18', page: 2 },
  // LOC digitized only the outer sheet of the 1787-11-01 issue (pages 1 and 4,
  // both advertisements) plus a two-page EXTRAORDINARY supplement (ed-2); the
  // inner leaf carrying Brutus II is not held. We show the issue's front page
  // (masthead: "Numb. 44, of Vol. xli", Thursday, November 1, 1787) instead,
  // and flag it so the essay page captions the strip as a stand-in.
  { slug: 'brutus-2', lccn: 'sn83030565', date: '1787-11-01', page: 1, carriesEssay: false },
  { slug: 'cato-4', lccn: 'sn83030565', date: '1787-11-08', page: 2 },
  { slug: 'brutus-4', lccn: 'sn83030566', date: '1787-11-29', page: 2 },
  { slug: 'brutus-6', lccn: 'sn83030566', date: '1787-12-27', page: 2 },
  { slug: 'brutus-10', lccn: 'sn83030566', date: '1788-01-24', page: 2 },
  { slug: 'brutus-12', lccn: 'sn83030566', date: '1788-02-07', page: 2 },
  { slug: 'brutus-15', lccn: 'sn83030566', date: '1788-03-20', page: 2 }
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

/** The resource endpoint returns a pct-scaled IIIF URL; rewrite it full-size. */
function fullSizeUrl(iiifSample) {
  // Fail fast on shape drift: a silent no-op here would commit the pct-scaled
  // sample as the "large" derivative.
  if (!/\/full\/[^/]+\/0\/default\.jpg$/.test(iiifSample)) {
    throw new Error(`Unexpected IIIF URL shape: ${iiifSample}`);
  }
  return iiifSample.replace(/\/full\/[^/]+\/0\/default\.jpg$/, '/full/full/0/default.jpg');
}

/**
 * `resource.image` is pinned to segment 0001 (the front page) no matter which
 * `sp` was requested — only `resource.pdf` / `resource.fulltext_file` track the
 * requested page. Parse the 4-digit segment from the pdf URL and substitute it
 * into the IIIF identifier (which ends `...:print:XXXXXXXXXX:0001`).
 */
function pageImageUrl(resource, issue) {
  const segmentMatch = /(\d{4})\.pdf$/.exec(resource.pdf ?? '');
  if (!segmentMatch) {
    throw new Error(`${issue.slug}: cannot parse segment from resource.pdf (${resource.pdf})`);
  }
  const segment = segmentMatch[1];
  const expected = String(issue.page).padStart(4, '0');
  if (segment !== expected) {
    throw new Error(`${issue.slug}: pdf segment ${segment} != expected ${expected} for sp=${issue.page}`);
  }
  // Fail fast on shape drift: a silent no-op would refetch the front page
  // under this essay's slug — the exact bug this function works around.
  if (!/:(\d{4})\/full\//.test(resource.image)) {
    throw new Error(`${issue.slug}: cannot find segment in resource.image (${resource.image})`);
  }
  const url = resource.image.replace(/:(\d{4})\/full\//, `:${segment}/full/`);
  console.log(`${issue.slug}: IIIF segment ${segment} (${url})`);
  return url;
}

const manifest = {};

for (const issue of ISSUES) {
  const setDir = new URL(`${issue.slug}/`, OUT_DIR);
  await mkdir(setDir, { recursive: true });

  const resourceUrl =
    `https://www.loc.gov/resource/${issue.lccn}/${issue.date}/ed-1/` +
    `?sp=${issue.page}&fo=json&at=resource`;
  const { resource } = await fetchJson(resourceUrl);
  if (!resource?.image) throw new Error(`${issue.slug}: no image service at ${resourceUrl}`);

  const entry = {
    page: issue.page,
    locUrl: `https://www.loc.gov/resource/${issue.lccn}/${issue.date}/ed-1/?sp=${issue.page}`
  };
  // Emitted only when false so entries whose page carries the essay stay unchanged.
  if (issue.carriesEssay === false) entry.carriesEssay = false;

  const largeBase = fileURLToPath(new URL('page-large', setDir));
  const thumbBase = fileURLToPath(new URL('page-thumb', setDir));

  // All four derivatives must exist to skip — a crashed run that wrote only
  // the thumb pair should regenerate, not die on a missing large file.
  const derivatives = [
    `${thumbBase}.jpg`, `${thumbBase}.avif`, `${largeBase}.jpg`, `${largeBase}.avif`
  ];
  const allPresent = (await Promise.all(derivatives.map(exists))).every(Boolean);

  if (allPresent) {
    for (const [variant, base] of [['thumb', thumbBase], ['large', largeBase]]) {
      const metadata = await sharp(`${base}.jpg`).metadata();
      entry[variant] = { w: metadata.width, h: metadata.height };
    }
  } else {
    const imageResponse = await fetch(fullSizeUrl(pageImageUrl(resource, issue)), {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!imageResponse.ok) {
      throw new Error(`${issue.slug}: image fetch -> HTTP ${imageResponse.status}`);
    }
    const source = Buffer.from(await imageResponse.arrayBuffer());

    for (const [variant, width, base] of [
      ['thumb', THUMB_WIDTH, thumbBase],
      ['large', LARGE_WIDTH, largeBase]
    ]) {
      const pipeline = sharp(source, { limitInputPixels: false })
        .resize({ width, withoutEnlargement: true });
      const info = await pipeline.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(`${base}.jpg`);
      await pipeline.clone().avif({ quality: 50 }).toFile(`${base}.avif`);
      entry[variant] = { w: info.width, h: info.height };
      console.log(`${issue.slug} ${variant}: ${info.width}×${info.height}`);
    }
  }

  manifest[issue.slug] = entry;
}

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${fileURLToPath(MANIFEST_PATH)}`);
