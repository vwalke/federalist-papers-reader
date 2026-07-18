# Federalist Reader X Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a deterministic, upload-ready 1500×500 Gazette Masthead header for the Federalist Reader X account.

**Architecture:** Add a focused Playwright generator that embeds the repository's self-hosted fonts, renders the approved press-sheet composition in HTML/CSS, and captures it as PNG. A Vitest file will verify exact copy, crop-safe metadata, package integration, image dimensions, and file size.

**Tech Stack:** Node.js 22, Playwright, self-hosted Fontsource WOFF2 files, HTML/CSS, Vitest, Sharp for temporary QA composites

## Global Constraints

- Render exactly 1500×500 pixels.
- Keep essential typography within `y = 60–440`.
- Keep essential wording out of the lower-left profile overlap region `x = 0–380`, `y = 330–500`.
- Use the exact copy `THE INDEPENDENT JOURNAL`, `OR, THE GENERAL ADVERTISER`, `THE FŒDERALIST`, `All Eighty-Five Essays, Made for Reading Together`, `federalistreader.org`, and `PUBLIUS`.
- Preserve the historical `Œ` ligature.
- Use self-hosted IM FELL English, Libre Caslon Display, IM FELL DW Pica Italic, and Libre Caslon Text Bold.
- Use newsprint `oklch(0.91 0.018 82)`, ink `oklch(0.19 0.018 70)`, oxblood `oklch(0.38 0.12 28)`, and muted ink `oklch(0.48 0.025 70)`.
- Do not use gradients, sepia effects, stains, tears, folds, heavy distressing, photographic objects, typography shadows, or a repeated logo.
- Commit `public/profile/federalist-reader-x-header.png` below 2 MB.

---

### Task 1: Generate and verify the Gazette Masthead header

**Files:**
- Create: `scripts/generate-x-header.mjs`
- Create: `tests/x-header.test.ts`
- Modify: `package.json`
- Create: `public/profile/federalist-reader-x-header.png`

**Interfaces:**
- Produces: `headerHtml(fontCss: string): string`
- Produces: `generateXHeader(): Promise<void>`
- Produces: package command `pnpm generate:x-header`
- Produces: upload-ready `public/profile/federalist-reader-x-header.png`

- [ ] **Step 1: Write the failing header tests**

Create `tests/x-header.test.ts`:

```ts
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('Federalist Reader X header', () => {
  it('builds the approved crop-aware Gazette Masthead markup', async () => {
    const module = await import('../scripts/generate-x-header.mjs');
    const html = module.headerHtml('/* embedded fonts */');

    expect(html).toContain('data-x-header="federalist-reader"');
    expect(html).toContain('data-safe-top="60"');
    expect(html).toContain('data-safe-bottom="440"');
    expect(html).toContain('data-avatar-safe-x="380"');
    expect(html).toContain('data-avatar-safe-y="330"');
    expect(html).toContain('THE INDEPENDENT JOURNAL');
    expect(html).toContain('OR, THE GENERAL ADVERTISER');
    expect(html).toContain('THE FŒDERALIST');
    expect(html).toContain('All Eighty-Five Essays, Made for Reading Together');
    expect(html).toContain('federalistreader.org');
    expect(html).toContain('PUBLIUS');
    expect(html).not.toContain('linear-gradient');
    expect(html).not.toContain('radial-gradient');
  });

  it('registers a deterministic header generation command', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );

    expect(packageJson.scripts['generate:x-header']).toBe('node scripts/generate-x-header.mjs');
  });

  it('keeps the bottom content row inset inside the 60-pixel X crop', async () => {
    const { HEADER_LAYOUT } = await import('../scripts/generate-x-header.mjs');

    expect(HEADER_LAYOUT).toBeDefined();
    if (!HEADER_LAYOUT) return;
    expect(HEADER_LAYOUT.height - HEADER_LAYOUT.paddingBottom).toBeLessThanOrEqual(
      HEADER_LAYOUT.safeBottom - 12,
    );
  });

  it('commits the upload-ready header at 1500×500 and below 2 MB', async () => {
    const bytes = await readFile(
      new URL('../public/profile/federalist-reader-x-header.png', import.meta.url),
    );

    expect(pngDimensions(bytes)).toEqual({ width: 1500, height: 500 });
    expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the new generator is absent**

Run:

```bash
pnpm exec vitest run tests/x-header.test.ts
```

Expected: FAIL because `scripts/generate-x-header.mjs`, the package command, and the PNG do not exist.

- [ ] **Step 3: Register the generator command**

Add this entry beside the existing generation scripts in `package.json`:

```json
"generate:x-header": "node scripts/generate-x-header.mjs"
```

- [ ] **Step 4: Implement the deterministic header generator**

Create `scripts/generate-x-header.mjs`:

```js
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
```

- [ ] **Step 5: Generate the image and run focused tests**

Run:

```bash
pnpm generate:x-header
pnpm exec vitest run tests/x-header.test.ts
```

Expected: generation exits successfully and all three X header tests pass.

- [ ] **Step 6: Run the full project verification**

Run:

```bash
pnpm check
```

Expected: Astro diagnostics contain no errors, the build succeeds, and all Vitest tests pass.

- [ ] **Step 7: Build crop and profile-overlap QA previews**

Run:

```bash
node --input-type=module -e "import sharp from 'sharp'; const source='public/profile/federalist-reader-x-header.png'; await sharp(source).extract({left:0,top:60,width:1500,height:380}).png().toFile('/private/tmp/federalist-reader-x-header-crop.png'); const avatar=await sharp('public/profile/federalist-reader-x-avatar.png').resize(190,190).toBuffer(); await sharp(source).composite([{input:avatar,left:85,top:310}]).png().toFile('/private/tmp/federalist-reader-x-header-profile-preview.png');"
```

Inspect the full header, `/private/tmp/federalist-reader-x-header-crop.png`, and `/private/tmp/federalist-reader-x-header-profile-preview.png`. Confirm that the title remains balanced, the URL and Publius stay readable, the avatar covers no essential wording, and the cropped version retains the full hierarchy.

- [ ] **Step 8: Commit the generated header**

```bash
git add package.json scripts/generate-x-header.mjs tests/x-header.test.ts public/profile/federalist-reader-x-header.png docs/superpowers/plans/2026-07-18-federalist-reader-x-header.md
git commit -m "feat: add Federalist Reader X header"
```
