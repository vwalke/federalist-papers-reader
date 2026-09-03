/**
 * Gazette-mode justif screenshot capture.
 *
 * Usage:
 *   node notes/justif-0.9.1-compare/capture.mjs --label before --base http://127.0.0.1:4321
 *   node notes/justif-0.9.1-compare/capture.mjs --label after --base http://127.0.0.1:4321
 *
 * Waits for document.fonts.ready and justif markers (p[data-justif], .justif-seg)
 * before shooting. Gazette mode is the default; localStorage is cleared so Reader
 * never leaks in. After shots reuse the before-run paragraph indexes and the
 * same scrollIntoView alignment.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));

const PAGES = [
  { id: 'federalist-10', path: '/papers/10/', title: 'Federalist 10' },
  { id: 'federalist-51', path: '/papers/51/', title: 'Federalist 51' },
  { id: 'brutus-1', path: '/antifederalist/brutus-1/', title: 'Brutus No. 1' },
];

const VIEWPORTS = [
  { id: 'phone', width: 390, height: 844, isMobile: true },
  { id: 'desktop', width: 1280, height: 800, isMobile: false },
];

function parseArgs(argv) {
  const args = { label: '', base: 'http://127.0.0.1:4321' };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--label') args.label = argv[++i];
    else if (argv[i] === '--base') args.base = argv[++i];
  }
  if (args.label !== 'before' && args.label !== 'after') {
    throw new Error('Pass --label before|after');
  }
  return args;
}

async function waitForJustif(page) {
  await page.waitForFunction(
    () => {
      const body = document.querySelector('.essay-body');
      if (!body) return false;
      const mode = document.documentElement.dataset.readingMode;
      if (mode === 'reader') return false;
      const justified = body.querySelectorAll(':scope > p[data-justif]');
      const segs = body.querySelectorAll('.justif-seg');
      return (
        document.fonts.status === 'loaded' &&
        justified.length >= 3 &&
        segs.length >= 20
      );
    },
    { timeout: 20_000 }
  );
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
  // Overflow sweep in essay-justify.ts waits two frames after controller.ready.
  await page.waitForTimeout(200);
}

async function planShots(page) {
  return page.evaluate(() => {
    const paras = [...document.querySelectorAll('.essay-body > p')].filter(
      (p) => !p.classList.contains('essay-signature')
    );

    const info = paras.map((p, index) => {
      const text = (p.textContent ?? '').replace(/\s+/g, ' ').trim();
      const rects = [...p.getClientRects()];
      return {
        index,
        enhanced: p.hasAttribute('data-justif'),
        rectCount: rects.length,
        textStart: text.slice(0, 80),
        hasQuote: /[“”‘’"«»]/.test(text),
        hasBracket: /\[[^\]]+\]/.test(text),
        hyphenCount: (p.textContent ?? '').split('\u00ad').length - 1 + (p.querySelectorAll('.justif-hyphen, [data-justif-hyphen]').length),
      };
    });

    const dropcap = 0;
    const columnBreak = info.findIndex((p) => p.rectCount > 1);
    const hanging = info.findIndex((p) => p.hasQuote);
    const editorial = info.findIndex((p) => p.hasBracket);
    const mid = info.findIndex((p, i) => i >= 4 && p.enhanced && p.rectCount === 1);

    return {
      paragraphCount: paras.length,
      enhancedCount: info.filter((p) => p.enhanced).length,
      info,
      targets: {
        dropcap,
        'column-break': columnBreak >= 0 ? columnBreak : Math.min(5, paras.length - 1),
        hanging: hanging >= 0 ? hanging : Math.min(2, paras.length - 1),
        editorial: editorial >= 0 ? editorial : hanging >= 0 ? hanging : Math.min(6, paras.length - 1),
        mid: mid >= 0 ? mid : Math.min(6, paras.length - 1),
      },
    };
  });
}

function clipScript() {
  return ({ paragraphIndex, pad }) => {
    const paras = [...document.querySelectorAll('.essay-body > p')].filter(
      (p) => !p.classList.contains('essay-signature')
    );
    const el = paras[paragraphIndex];
    if (!el) return null;
    const flow = document.querySelector('.essay-flow');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rects = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) return null;

    // Prefer the first fragment that still has a visible slice in the viewport.
    let target = rects.find((r) => r.bottom > 8 && r.top < vh - 8) ?? rects[0];
    const alignY = window.scrollY + target.top - 72;
    window.scrollTo(0, Math.max(0, alignY));

    const after = [...el.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    const visible = after.filter((r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw);
    const use = visible.length > 0 ? visible : after;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of use) {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    const flowRect = flow?.getBoundingClientRect();
    if (flowRect && use.length > 1) {
      left = Math.min(left, flowRect.left);
      right = Math.max(right, Math.min(flowRect.right, vw));
    }
    left -= pad;
    top -= pad;
    right += pad;
    bottom += pad;
    const x = Math.min(vw - 1, Math.max(0, Math.floor(left)));
    const y = Math.min(vh - 1, Math.max(0, Math.floor(top)));
    const width = Math.max(1, Math.min(vw - x, Math.ceil(right) - x));
    const height = Math.max(1, Math.min(vh - y, Math.ceil(bottom) - y));
    return {
      x,
      y,
      width,
      height,
      scrollY: window.scrollY,
      scrollX: window.scrollX,
    };
  };
}

async function shootElement(page, paragraphIndex, pad = 16) {
  await page.evaluate(clipScript(), { paragraphIndex, pad });
  await page.waitForTimeout(80);
  const settled = await page.evaluate(clipScript(), { paragraphIndex, pad });
  if (!settled) throw new Error(`Missing paragraph ${paragraphIndex}`);
  return settled;
}

async function shootViewport(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) el.scrollIntoView({ block: 'start' });
  }, selector);
  await page.waitForTimeout(80);
  return page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollX: window.scrollX,
  }));
}

async function main() {
  const { label, base } = parseArgs(process.argv);
  const outDir = path.join(here, label);
  await mkdir(outDir, { recursive: true });

  const manifestPath = path.join(here, 'manifest.json');
  const prior = label === 'after' ? JSON.parse(await readFile(manifestPath, 'utf8')) : null;

  const browser = await chromium.launch({ headless: true });
  const run = {
    label,
    capturedAt: new Date().toISOString(),
    justifVersion: label,
    pages: {},
  };

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 2,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      localStorage.removeItem('publius:reading-mode');
      localStorage.removeItem('publius:text-scale');
    });
    const page = await context.newPage();

    for (const sitePage of PAGES) {
      const url = new URL(sitePage.path, base).href;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        document.documentElement.dataset.readingMode = 'gazette';
        localStorage.setItem('publius:reading-mode', 'gazette');
      });
      // Re-apply in case the toolbar script overwrote after our set.
      await page.waitForSelector('.essay-body');
      await waitForJustif(page);

      const mode = await page.evaluate(() => document.documentElement.dataset.readingMode);
      if (mode === 'reader') {
        throw new Error(`${sitePage.id} loaded in Reader mode`);
      }

      const plan = await planShots(page);
      const priorPage = prior?.pages?.[`${sitePage.id}:${viewport.id}`];
      const targets = priorPage?.targets ?? plan.targets;

      const key = `${sitePage.id}:${viewport.id}`;
      run.pages[key] = {
        title: sitePage.title,
        path: sitePage.path,
        viewport: viewport.id,
        paragraphCount: plan.paragraphCount,
        enhancedCount: plan.enhancedCount,
        targets,
        info: plan.info,
        shots: {},
      };

      const shots = [
        { id: 'viewport-open', kind: 'viewport', selector: '.essay-flow' },
        { id: 'dropcap', kind: 'element', paragraph: targets.dropcap },
        { id: 'column-break', kind: 'element', paragraph: targets['column-break'] },
        { id: 'hanging', kind: 'element', paragraph: targets.hanging },
        { id: 'editorial', kind: 'element', paragraph: targets.editorial },
      ];

      for (const shot of shots) {
        const file = `${sitePage.id}--${viewport.id}--${shot.id}.png`;
        const dest = path.join(outDir, file);
        if (shot.kind === 'viewport') {
          const pos = await shootViewport(page, shot.selector);
          await page.screenshot({ path: dest, type: 'png' });
          run.pages[key].shots[shot.id] = { file, ...pos, kind: 'viewport' };
        } else {
          const clip = await shootElement(page, shot.paragraph);
          const vp = page.viewportSize();
          const safe = {
            x: Math.max(0, clip.x),
            y: Math.max(0, clip.y),
            width: Math.max(1, Math.min(clip.width, (vp?.width ?? clip.width) - Math.max(0, clip.x))),
            height: Math.max(1, Math.min(clip.height, (vp?.height ?? clip.height) - Math.max(0, clip.y))),
          };
          await page.screenshot({ path: dest, type: 'png', clip: safe });
          run.pages[key].shots[shot.id] = {
            file,
            kind: 'element',
            paragraph: shot.paragraph,
            ...clip,
          };
        }
        console.log(`wrote ${label}/${file}`);
      }
    }

    await context.close();
  }

  await browser.close();
  const destManifest = path.join(here, `manifest-${label}.json`);
  await writeFile(destManifest, `${JSON.stringify(run, null, 2)}\n`);
  if (label === 'before') {
    await writeFile(manifestPath, `${JSON.stringify(run, null, 2)}\n`);
  }
  console.log(`manifest → ${destManifest}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
