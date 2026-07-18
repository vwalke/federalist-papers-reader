import { chromium } from '@playwright/test';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const ROOT = new URL('../', import.meta.url);
const PAPERS_DIR = new URL('src/content/papers/', ROOT);
const OUT_DIR = new URL('public/social-cards/', ROOT);

const WIDTH = 1200;
const HEIGHT = 630;

const ROMAN = [
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
];

function toRoman(value) {
  let remaining = value;
  let result = '';
  for (const [amount, glyph] of ROMAN) {
    while (remaining >= amount) {
      result += glyph;
      remaining -= amount;
    }
  }
  return result;
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[character]));
}

async function fontFace(family, style, weight, relativePath) {
  const bytes = await readFile(new URL(relativePath, ROOT));
  const base64 = bytes.toString('base64');
  return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${base64}) format('woff2');}`;
}

async function loadFontCss() {
  const faces = await Promise.all([
    fontFace('IM Fell English', 'normal', 400, 'node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2'),
    fontFace('IM Fell DW Pica', 'italic', 400, 'node_modules/@fontsource/im-fell-dw-pica/files/im-fell-dw-pica-latin-400-italic.woff2'),
    fontFace('Libre Caslon Text', 'normal', 400, 'node_modules/@fontsource/libre-caslon-text/files/libre-caslon-text-latin-400-normal.woff2'),
    fontFace('Libre Caslon Text', 'normal', 700, 'node_modules/@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2')
  ]);
  return faces.join('');
}

/** The card body: a numbered essay, or the site-identity default when roman is null. */
function bodyMarkup({ roman, title }) {
  if (roman === null) {
    return `<div class="fed">THE FŒDERALIST</div>
      <div class="topic">All Eighty-Five Essays, Made for Reading Together</div>`;
  }
  const long = title.length > 46;
  return `<div class="fed">THE FŒDERALIST. <span class="no">No. ${roman}.</span></div>
    <div class="topic${long ? ' small' : ''}">${escapeHtml(title)}</div>`;
}

function cardHtml(fontCss, card) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
:root{
  --newsprint:oklch(0.91 0.018 82);--ink:oklch(0.19 0.018 70);--oxblood:oklch(0.38 0.12 28);
  --muted:oklch(0.48 0.025 70);--rule:color-mix(in oklab,var(--ink) 72%,transparent);
  --toning:oklch(0.57 0.088 72);
}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:${WIDTH}px;height:${HEIGHT}px;}
.card{width:${WIDTH}px;height:${HEIGHT}px;background:var(--newsprint);position:relative;overflow:hidden;
  display:flex;flex-direction:column;padding:64px 80px;
  box-shadow:inset 0 0 120px color-mix(in oklab,var(--toning) 14%,transparent),
             inset 0 0 24px color-mix(in oklab,var(--toning) 10%,transparent);}
.card::before{content:'';position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;opacity:0.1;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.16'/%3E%3C/svg%3E");}
.card::after{content:'';position:absolute;inset:22px;pointer-events:none;border:1px solid var(--rule);
  box-shadow:inset 0 0 0 4px var(--newsprint),inset 0 0 0 5px color-mix(in oklab,var(--rule) 55%,transparent);}
.plate{text-align:center;position:relative;z-index:1;}
.plate .name{font:400 34px/1 'IM Fell English',serif;letter-spacing:0.14em;color:var(--ink);}
.plate .sub{display:flex;align-items:center;justify-content:center;gap:14px;margin-top:12px;
  font:400 15px/1 'Libre Caslon Text',serif;letter-spacing:0.3em;text-transform:uppercase;color:var(--muted);}
.plate .sub::before,.plate .sub::after{content:'';width:90px;border-top:1px solid var(--rule);}
.plate .dia{color:var(--oxblood);}
.body{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:center;
  text-align:center;gap:18px;}
.fed{font:400 74px/1 'IM Fell English',serif;letter-spacing:0.02em;color:var(--ink);}
.fed .no{white-space:nowrap;}
.topic{max-width:900px;margin:0 auto;font:italic 400 34px/1.28 'IM Fell DW Pica',serif;color:var(--ink);}
.topic.small{font-size:27px;}
.foot{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;}
.foot .url{font:700 22px/1 'Libre Caslon Text',serif;letter-spacing:0.02em;color:var(--oxblood);}
.foot .pub{font:700 18px/1 'Libre Caslon Text',serif;letter-spacing:0.34em;text-transform:uppercase;color:var(--muted);}
</style></head><body>
<div class="card">
  <div class="plate">
    <div class="name">THE INDEPENDENT JOURNAL</div>
    <div class="sub"><span class="dia">&#10022;</span> OR, THE GENERAL ADVERTISER <span class="dia">&#10022;</span></div>
  </div>
  <div class="body">${bodyMarkup(card)}</div>
  <div class="foot"><span class="url">federalistreader.org</span><span class="pub">Publius</span></div>
</div></body></html>`;
}

async function loadPapers() {
  const filenames = (await readdir(PAPERS_DIR)).filter((name) => name.endsWith('.md')).sort();
  const papers = [];
  for (const filename of filenames) {
    const source = await readFile(new URL(filename, PAPERS_DIR), 'utf8');
    const match = source.match(/^---\n([\s\S]*?)\n---/);
    if (!match) throw new Error(`${filename} is missing frontmatter.`);
    const data = parse(match[1]);
    papers.push({ number: data.number, title: data.title });
  }
  return papers;
}

async function generate() {
  const papers = await loadPapers();
  const fontCss = await loadFontCss();
  await mkdir(fileURLToPath(OUT_DIR), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });

  const jobs = [
    { file: 'default.jpg', card: { roman: null, title: '' } },
    ...papers.map((paper) => ({
      file: `${paper.number}.jpg`,
      card: { roman: toRoman(paper.number), title: paper.title }
    }))
  ];

  for (const { file, card } of jobs) {
    await page.setContent(cardHtml(fontCss, card), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: fileURLToPath(new URL(file, OUT_DIR)),
      type: 'jpeg',
      quality: 86,
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT }
    });
  }

  await browser.close();
  console.log(`Generated ${jobs.length} social cards in public/social-cards/`);
}

await generate();
