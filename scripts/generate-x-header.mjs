import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('public/profile/federalist-reader-x-header.png', ROOT);
export const HEADER_LAYOUT = Object.freeze({
  width: 1500,
  height: 500,
  safeTop: 60,
  safeBottom: 440,
  avatarSafeX: 380,
  avatarSafeY: 330,
  paddingTop: 64,
  paddingRight: 78,
  paddingBottom: 72,
  paddingLeft: 78,
});
const WIDTH = HEADER_LAYOUT.width;
const HEIGHT = HEADER_LAYOUT.height;

async function fontFace(family, style, weight, relativePath) {
  const bytes = await readFile(new URL(relativePath, ROOT));
  return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2');}`;
}

async function loadFontCss() {
  const faces = await Promise.all([
    fontFace(
      'IM Fell English',
      'normal',
      400,
      'node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2',
    ),
    fontFace(
      'Libre Caslon Display',
      'normal',
      400,
      'node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff2',
    ),
    fontFace(
      'IM Fell DW Pica',
      'italic',
      400,
      'node_modules/@fontsource/im-fell-dw-pica/files/im-fell-dw-pica-latin-400-italic.woff2',
    ),
    fontFace(
      'Libre Caslon Text',
      'normal',
      700,
      'node_modules/@fontsource/libre-caslon-text/files/libre-caslon-text-latin-700-normal.woff2',
    ),
  ]);
  return faces.join('');
}

export function headerHtml(fontCss) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
:root{--newsprint:oklch(0.91 0.018 82);--ink:oklch(0.19 0.018 70);--oxblood:oklch(0.38 0.12 28);--muted:oklch(0.48 0.025 70);}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;}
.header{position:relative;width:100%;height:100%;overflow:hidden;background:var(--newsprint);color:var(--ink);padding:${HEADER_LAYOUT.paddingTop}px ${HEADER_LAYOUT.paddingRight}px ${HEADER_LAYOUT.paddingBottom}px ${HEADER_LAYOUT.paddingLeft}px;display:grid;grid-template-rows:auto auto 1fr auto;box-shadow:inset 0 0 80px color-mix(in oklab,var(--ink) 5%,transparent);}
.header::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.045;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%2328241f' stroke-width='.45'%3E%3Cpath d='M3 9h17M31 14h25M10 37h29M43 45h16M5 58h31'/%3E%3Cpath d='M22 3v12M48 24v9M17 44v14'/%3E%3C/g%3E%3C/svg%3E");}
.header::after{content:'';position:absolute;inset:24px;border:1px solid color-mix(in oklab,var(--ink) 75%,transparent);box-shadow:inset 0 0 0 4px var(--newsprint),inset 0 0 0 5px color-mix(in oklab,var(--ink) 45%,transparent);pointer-events:none;}
.journal{position:relative;text-align:center;font:400 56px/1 'IM Fell English',serif;letter-spacing:.12em;}
.advertiser{position:relative;display:flex;align-items:center;justify-content:center;gap:18px;margin-top:10px;color:var(--muted);font:400 18px/1 'Libre Caslon Display',serif;letter-spacing:.28em;text-transform:uppercase;}
.advertiser::before,.advertiser::after{content:'';width:160px;border-top:1px solid currentColor;}
.diamond{color:var(--oxblood);font-size:14px;letter-spacing:0;}
.hero{position:relative;align-self:center;text-align:center;padding-bottom:16px;}
.title{font:400 112px/.92 'IM Fell English',serif;letter-spacing:.015em;}
.tagline{margin-top:18px;font:italic 400 30px/1 'IM Fell DW Pica',serif;}
.footer{position:relative;display:flex;justify-content:flex-end;align-items:center;gap:185px;padding-right:45px;font:700 22px/1 'Libre Caslon Text',serif;}
.url{color:var(--oxblood);}
.publius{color:var(--muted);letter-spacing:.34em;}
</style></head><body>
<header class="header" data-x-header="federalist-reader" data-safe-top="${HEADER_LAYOUT.safeTop}" data-safe-bottom="${HEADER_LAYOUT.safeBottom}" data-avatar-safe-x="${HEADER_LAYOUT.avatarSafeX}" data-avatar-safe-y="${HEADER_LAYOUT.avatarSafeY}">
  <div class="journal">THE INDEPENDENT JOURNAL</div>
  <div class="advertiser"><span class="diamond">◆</span>OR, THE GENERAL ADVERTISER<span class="diamond">◆</span></div>
  <div class="hero"><div class="title">THE FŒDERALIST</div><div class="tagline">All Eighty-Five Essays, Made for Reading Together</div></div>
  <div class="footer"><span class="url">federalistreader.org</span><span class="publius">PUBLIUS</span></div>
</header></body></html>`;
}

export async function generateXHeader() {
  const fontCss = await loadFontCss();
  await mkdir(fileURLToPath(new URL('public/profile/', ROOT)), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    await page.setContent(headerHtml(fontCss), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: fileURLToPath(OUTPUT),
      type: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    });
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateXHeader();
}
