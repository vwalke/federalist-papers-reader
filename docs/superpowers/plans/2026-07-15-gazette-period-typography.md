# Gazette Period Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Gazette paper pages a slightly roomier, one-line IM FELL English title and restrained period spelling while keeping Reader mode normalized and readable.

**Architecture:** A small local rehype plugin converts exact `federal` text nodes in rendered paper prose into annotated period-spelling spans without changing canonical Markdown. The existing reading-mode controller switches those spans between Gazette and modern text. Dedicated CSS and font tokens apply IM FELL English only to Gazette title furniture, preserving the existing Caslon system elsewhere.

**Tech Stack:** Astro 7 static output, TypeScript/Vitest, Playwright, rehype/HAST nodes supplied by Astro, Fontsource self-hosted fonts, CSS multi-column layout.

## Global Constraints

- Gazette title must remain real semantic text and stay on one visual line from 320px through desktop and at a 200%-zoom-equivalent width.
- Add exactly `0.75rem` of block-start space between the toolbar rule and the essay flow.
- Use IM FELL English only through a new `--font-period-display` token; do not change the global `--font-display` token.
- Keep Libre Caslon Text for body copy, commentary, toolbar text, and the `PUBLIUS` byline.
- Gazette mode may render exact standalone `federal` as `fœderal`; Reader mode must render normalized `federal`.
- Do not transform `Federalist`, substrings inside larger words, metadata, links, code, or frontmatter.
- Do not introduce the long `ſ` or attempt a full diplomatic transcription.
- Preserve keyboard, screen-reader, JavaScript-disabled, print, 200% zoom, and mobile behavior.
- Preserve the user-owned untracked `_to_delete/` and `docs/about-two-column-roadmap.md` paths.

---

## File Map

- Create `src/lib/rehype-period-spelling.mjs`: focused build-time HAST transformer for exact `federal` words.
- Create `tests/period-spelling.test.ts`: direct unit coverage for case preservation, exclusions, and accessible annotations.
- Modify `astro.config.mjs`: register the local rehype plugin for rendered paper Markdown.
- Modify `src/components/ReadingToolbar.astro`: synchronize annotated spellings whenever reading mode is applied.
- Modify `tests/paper-page.test.ts`: verify the build-time transform reaches static Gazette HTML with historical text and normalized metadata.
- Modify `tests/e2e/reader.spec.ts`: verify live mode switching, one-line title fit, font selection, spacing, and overflow.
- Modify `package.json` and `pnpm-lock.yaml`: restore pinned self-hosted IM FELL English assets.
- Modify `src/layouts/BaseLayout.astro`: import IM FELL English regular and italic Latin styles.
- Modify `src/styles/global.css`: define the isolated period-display font token.
- Modify `src/styles/paper.css`: implement spacing, title fit, mode-specific font roles, and font-supported ligatures.
- Modify `DESIGN.md`: record the final Gazette-versus-Reader typography roles.

---

### Task 1: Build-Time Period Spelling Transform

**Files:**
- Create: `src/lib/rehype-period-spelling.mjs`
- Create: `tests/period-spelling.test.ts`
- Modify: `astro.config.mjs`
- Modify: `tests/paper-page.test.ts`

**Interfaces:**
- Produces: `rehypePeriodSpelling(): (tree: HastNode) => void`
- Produces rendered spans with `.period-spelling`, `data-modern`, `data-gazette`, and `aria-label`.
- Consumed later by: `ReadingToolbar.astro` and `tests/e2e/reader.spec.ts`.

- [ ] **Step 1: Write failing unit tests for exact, case-preserving transformation**

Create `tests/period-spelling.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { rehypePeriodSpelling } from '../src/lib/rehype-period-spelling.mjs';

type Node = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

function paragraph(value: string): Node {
  return {
    type: 'root',
    children: [{
      type: 'element',
      tagName: 'p',
      properties: {},
      children: [{ type: 'text', value }]
    }]
  };
}

describe('period spelling rehype transform', () => {
  it('annotates standalone federal in lower, title, and uppercase forms', () => {
    const tree = paragraph('federal Federal FEDERAL Federalist confederal');

    rehypePeriodSpelling()(tree);

    const children = tree.children?.[0].children ?? [];
    const spans = children.filter((node) => node.tagName === 'span');
    expect(spans.map((node) => node.properties)).toEqual([
      {
        className: ['period-spelling'],
        'data-modern': 'federal',
        'data-gazette': 'fœderal',
        'aria-label': 'federal'
      },
      {
        className: ['period-spelling'],
        'data-modern': 'Federal',
        'data-gazette': 'Fœderal',
        'aria-label': 'Federal'
      },
      {
        className: ['period-spelling'],
        'data-modern': 'FEDERAL',
        'data-gazette': 'FŒDERAL',
        'aria-label': 'FEDERAL'
      }
    ]);
    expect(spans.map((node) => node.children?.[0].value)).toEqual([
      'fœderal',
      'Fœderal',
      'FŒDERAL'
    ]);
    expect(children.map((node) => node.value ?? node.children?.[0].value).join(''))
      .toBe('fœderal Fœderal FŒDERAL Federalist confederal');
  });

  it('leaves links and code untouched', () => {
    const tree: Node = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'a',
          properties: { href: '/federal/' },
          children: [{ type: 'text', value: 'federal' }]
        },
        {
          type: 'element',
          tagName: 'code',
          properties: {},
          children: [{ type: 'text', value: 'federal' }]
        }
      ]
    };

    rehypePeriodSpelling()(tree);

    expect(tree.children?.[0].children?.[0]).toEqual({ type: 'text', value: 'federal' });
    expect(tree.children?.[1].children?.[0]).toEqual({ type: 'text', value: 'federal' });
  });
});
```

- [ ] **Step 2: Run the unit test and verify the expected RED state**

Run:

```bash
pnpm vitest run tests/period-spelling.test.ts
```

Expected: FAIL because `src/lib/rehype-period-spelling.mjs` does not exist.

- [ ] **Step 3: Implement the minimal local rehype transform**

Create `src/lib/rehype-period-spelling.mjs`:

```js
const SKIPPED_TAGS = new Set(['a', 'code', 'pre', 'script', 'style']);
const EXACT_FEDERAL = /^federal$/i;

function toGazetteSpelling(word) {
  if (word === word.toUpperCase()) return 'FŒDERAL';
  if (word[0] === word[0].toUpperCase()) return 'Fœderal';
  return 'fœderal';
}

function periodizeText(value) {
  return value.split(/\b(federal)\b/gi).filter(Boolean).map((part) => {
    if (!EXACT_FEDERAL.test(part)) return { type: 'text', value: part };

    const gazette = toGazetteSpelling(part);
    return {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['period-spelling'],
        'data-modern': part,
        'data-gazette': gazette,
        'aria-label': part
      },
      children: [{ type: 'text', value: gazette }]
    };
  });
}

function transformChildren(node, blocked = false) {
  if (!Array.isArray(node.children)) return;

  const nextBlocked = blocked || (
    node.type === 'element' && SKIPPED_TAGS.has(node.tagName)
  );

  node.children = node.children.flatMap((child) => {
    if (child.type === 'text' && !nextBlocked) return periodizeText(child.value);
    transformChildren(child, nextBlocked);
    return [child];
  });
}

export function rehypePeriodSpelling() {
  return function transform(tree) {
    transformChildren(tree);
  };
}
```

- [ ] **Step 4: Add a failing static-output integration assertion**

In the first test in `tests/paper-page.test.ts`, after the body-text assertion, add:

```ts
expect(html).toContain('class="period-spelling"');
expect(html).toContain('data-modern="federal"');
expect(html).toContain('data-gazette="fœderal"');
expect(html).toContain('aria-label="federal"');
expect(html).toContain('>fœderal</span>');
```

Run:

```bash
pnpm build
pnpm vitest run tests/paper-page.test.ts
```

Expected: FAIL because Astro has not registered the plugin, so static Paper 1 contains normalized `federal` without a `.period-spelling` span.

- [ ] **Step 5: Register the plugin with Astro Markdown**

Modify `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

import { rehypePeriodSpelling } from './src/lib/rehype-period-spelling.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  site: process.env.PUBLIC_SITE_URL,
  markdown: {
    rehypePlugins: [rehypePeriodSpelling]
  }
});
```

- [ ] **Step 6: Run focused tests and build integration**

Run:

```bash
pnpm build
pnpm vitest run tests/period-spelling.test.ts tests/paper-page.test.ts
```

Expected: 5 focused tests pass; 88 static pages build and content validation reports Papers 1–85 with no gaps or incomplete commentary.

- [ ] **Step 7: Commit the build-time transform**

```bash
git add astro.config.mjs src/lib/rehype-period-spelling.mjs tests/period-spelling.test.ts tests/paper-page.test.ts
git commit -m "feat: render restrained period spellings"
```

---

### Task 2: Reading-Mode Spelling Synchronization

**Files:**
- Modify: `src/components/ReadingToolbar.astro`
- Modify: `tests/e2e/reader.spec.ts`

**Interfaces:**
- Consumes: `.period-spelling[data-modern][data-gazette]` spans from Task 1.
- Produces: `applyMode(mode)` updates both the root reading-mode dataset and every period-spelling span.

- [ ] **Step 1: Add a failing browser assertion for Gazette/Reader spelling**

Extend `switches reading modes and remembers the preference` in `tests/e2e/reader.spec.ts`:

```ts
const periodWord = page.locator('.period-spelling').first();
await expect(periodWord).toHaveText('fœderal');
await expect(periodWord).toHaveAttribute('aria-label', 'federal');

await page.getByRole('button', { name: 'Reader' }).click();
await expect(periodWord).toHaveText('federal');
await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
await page.reload();
await expect(page.locator('.period-spelling').first()).toHaveText('federal');
await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');

await page.getByRole('button', { name: 'Gazette' }).click();
await expect(page.locator('.period-spelling').first()).toHaveText('fœderal');
await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'gazette');
```

- [ ] **Step 2: Run the focused check and verify the expected RED state**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm playwright test tests/e2e/reader.spec.ts --grep "switches reading modes"
```

Expected: FAIL because Reader mode still displays `fœderal`.

- [ ] **Step 3: Synchronize period spans inside the existing mode controller**

In the script in `src/components/ReadingToolbar.astro`, add:

```ts
const periodSpellings = document.querySelectorAll<HTMLElement>(
  '.period-spelling[data-modern][data-gazette]'
);

function applyPeriodSpellings(mode: 'gazette' | 'reader') {
  for (const spelling of periodSpellings) {
    const value = mode === 'reader' ? spelling.dataset.modern : spelling.dataset.gazette;
    if (value) spelling.textContent = value;
  }
}
```

Then call it from `applyMode` before persistence:

```ts
function applyMode(mode: 'gazette' | 'reader') {
  root.dataset.readingMode = mode;
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  applyPeriodSpellings(mode);
  preferences.setReadingMode(mode);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm playwright test tests/e2e/reader.spec.ts --grep "switches reading modes"
```

Expected: the focused browser test passes; Gazette renders `fœderal`, Reader renders `federal`, and the stored Reader preference remains normalized after reload.

- [ ] **Step 5: Commit reading-mode synchronization**

```bash
git add src/components/ReadingToolbar.astro tests/e2e/reader.spec.ts
git commit -m "feat: normalize period spellings in Reader mode"
```

---

### Task 3: Period Display Font, One-Line Title, and Breathing Room

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`
- Modify: `src/styles/paper.css`
- Modify: `tests/e2e/reader.spec.ts`
- Modify: `DESIGN.md`

**Interfaces:**
- Produces: CSS token `--font-period-display`.
- Produces: Gazette title and recipient computed font family containing `IM FELL English`.
- Preserves: Reader title computed font family containing `Libre Caslon Display`.

- [ ] **Step 1: Add reusable title-line metrics to the browser test**

Near the top of `tests/e2e/reader.spec.ts`, after `beforeEach`, add:

```ts
async function titleMetrics(page: import('@playwright/test').Page) {
  return page.locator('.essay-heading__title').evaluate((title) => {
    const range = document.createRange();
    range.selectNodeContents(title);
    const lineTops = new Set(
      [...range.getClientRects()]
        .filter(({ width, height }) => width > 0 && height > 0)
        .map(({ top }) => Math.round(top))
    );
    const toolbar = document.querySelector('.reading-toolbar') as Element;
    const flow = document.querySelector('.essay-flow') as Element;
    const titleStyle = getComputedStyle(title);

    return {
      lines: lineTops.size,
      titleFontFamily: titleStyle.fontFamily,
      titleText: title.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      contentGap: title.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom,
      flowPaddingTop: Number.parseFloat(getComputedStyle(flow).paddingTop),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
}
```

- [ ] **Step 2: Strengthen mobile and desktop tests before changing CSS**

At the end of `uses one Gazette column on mobile without horizontal overflow`, add a 320px Paper 85 check:

```ts
await page.setViewportSize({ width: 320, height: 800 });
await page.goto('/papers/85/');
const narrowTitle = await titleMetrics(page);
expect(narrowTitle.lines).toBe(1);
expect(narrowTitle.titleText).toBe('THE FEDERALIST. No. LXXXV.');
expect(narrowTitle.titleFontFamily).toContain('IM FELL English');
expect(narrowTitle.flowPaddingTop).toBeCloseTo(12, 0);
expect(narrowTitle.contentGap).toBeGreaterThanOrEqual(10);
expect(narrowTitle.overflow).toBeLessThanOrEqual(0);
```

In `places anonymous top matter in the Gazette first column`, replace the existing Libre Caslon assertion with:

```ts
expect(metrics.titleFontFamily).toContain('IM FELL English');
```

Then add the 200%-zoom-equivalent and Reader checks:

```ts
await page.setViewportSize({ width: 640, height: 900 });
await page.goto('/papers/85/');
const zoomEquivalent = await titleMetrics(page);
expect(zoomEquivalent.lines).toBe(1);
expect(zoomEquivalent.overflow).toBeLessThanOrEqual(0);

await page.getByRole('button', { name: 'Reader' }).click();
const readerTitle = await titleMetrics(page);
expect(readerTitle.lines).toBe(1);
expect(readerTitle.titleFontFamily).toContain('Libre Caslon Display');
expect(readerTitle.overflow).toBeLessThanOrEqual(0);
```

- [ ] **Step 3: Run the focused browser tests and verify the expected RED state**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm playwright test tests/e2e/reader.spec.ts --grep "mobile|anonymous top matter"
```

Expected: FAIL because the Gazette title still uses Libre Caslon Display, Paper 85 can wrap at narrow widths, and `.essay-flow` has zero top padding.

- [ ] **Step 4: Restore the pinned self-hosted IM FELL package**

Run:

```bash
pnpm add @fontsource/im-fell-english@5.2.6 --save-exact
```

Expected: `package.json` and `pnpm-lock.yaml` add only the pinned Fontsource dependency and its lock entry.

- [ ] **Step 5: Import the regular and italic font assets**

At the top of `src/layouts/BaseLayout.astro`, before the Caslon imports, add:

```astro
import '@fontsource/im-fell-english/latin-400.css';
import '@fontsource/im-fell-english/latin-400-italic.css';
```

- [ ] **Step 6: Add an isolated period-display token**

In `:root` in `src/styles/global.css`, add immediately before `--font-display`:

```css
--font-period-display: 'IM FELL English', 'Libre Caslon Text', Georgia, serif;
```

- [ ] **Step 7: Implement spacing, font roles, ligatures, and one-line fit**

Update the relevant rules in `src/styles/paper.css`:

```css
.essay-flow {
  position: relative;
  z-index: 1;
  padding-block-start: var(--space-sm);
}

.essay-heading__title {
  margin: 0;
  font: 400 clamp(1.15rem, 5.8vw, 2rem)/1 var(--font-period-display);
  font-variant-ligatures: common-ligatures discretionary-ligatures historical-ligatures contextual;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.essay-heading__recipient {
  margin-block-start: 0.2rem;
  font-family: var(--font-period-display);
  font-size: clamp(1rem, 1.7vw, 1.25rem);
  font-style: italic;
  line-height: 1.25;
}

.essay-body {
  font-size: clamp(1.02rem, 1.35vw, 1.1rem);
  font-variant-ligatures: common-ligatures discretionary-ligatures historical-ligatures contextual;
  font-variant-numeric: oldstyle-nums;
  hyphens: auto;
  line-height: 1.38;
  text-align: left;
}

[data-reading-mode='reader'] .essay-heading__title {
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 4vw, 2.45rem);
  font-variant-ligatures: common-ligatures;
  letter-spacing: 0.015em;
}

[data-reading-mode='reader'] .essay-heading__recipient {
  font-family: var(--font-reading);
}
```

Replace the current mobile `.essay-heading__title` override with:

```css
.essay-heading {
  margin-block: var(--space-sm) var(--space-md);
}

.essay-heading__title {
  font-size: clamp(1.15rem, 5.8vw, 1.75rem);
}

[data-reading-mode='reader'] .essay-heading__title {
  font-size: clamp(1.25rem, 6.3vw, 1.8rem);
}
```

In print styles, normalize the ceremonial font while retaining a one-line title when it fits:

```css
.essay-heading__title,
.essay-heading__recipient {
  font-family: var(--font-reading);
}
```

- [ ] **Step 8: Update the design-system documentation**

Replace the current Typography bullets in `DESIGN.md` that describe ceremonial and essay heading roles with:

```md
- The outlined masthead artwork remains independent of live web fonts.
- Gazette paper titles and recipient lines use **IM FELL English**, self-hosted, for restrained period texture.
- Reader paper titles use **Libre Caslon Display**; essay body, commentary, and metadata use **Libre Caslon Text**, all self-hosted.
- Gazette prose enables font-supported common and historical ligatures and uses source-attested `fœderal` rendering; Reader mode normalizes that form to `federal`.
```

Leave the existing utility-font, sizing, and column bullets unchanged.

- [ ] **Step 9: Run focused browser tests and tune only within the approved constraints**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm playwright test tests/e2e/reader.spec.ts --grep "mobile|anonymous top matter"
```

Expected: the focused tests pass at 320px, 390px, 640px, and 1280px; title line count is 1, Gazette computed font contains IM FELL English, Reader contains Libre Caslon Display, flow padding is 12 CSS pixels, and horizontal overflow is zero.

If a title does not fit, adjust only the two title `clamp()` minimum/fluid values; do not condense, scale, rasterize, or alter the title text.

- [ ] **Step 10: Commit the typography and spacing work**

```bash
git add DESIGN.md package.json pnpm-lock.yaml src/layouts/BaseLayout.astro src/styles/global.css src/styles/paper.css tests/e2e/reader.spec.ts
git commit -m "style: restore period Gazette typography"
```

---

### Task 4: Full Verification and Visual Review

**Files:**
- Modify only if a verification failure reveals an in-scope regression.

**Interfaces:**
- Consumes all behavior from Tasks 1–3.
- Produces a clean, verified feature branch ready for integration.

- [ ] **Step 1: Run the complete static and unit verification**

Run:

```bash
pnpm check
```

Expected:

- Astro reports 0 errors, 0 warnings, and 0 hints.
- Content validation confirms Papers 1–85 with no gaps, duplicates, empty bodies, or incomplete commentary.
- 88 static pages build.
- All Vitest files and tests pass.

- [ ] **Step 2: Run the complete browser and accessibility suite**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e
```

Expected: all Playwright tests pass, including accessibility, JavaScript-disabled reading, print layout, period spelling, mobile title fit, and archival wear.

- [ ] **Step 3: Run the frontend layout detector**

Run:

```bash
node /Users/vwalke/.codex/plugins/cache/impeccable/impeccable/3.9.1/skills/impeccable/scripts/detect.mjs --json --scope layout src/layouts/PaperLayout.astro src/styles/global.css src/styles/paper.css
```

Expected: `[]`.

- [ ] **Step 4: Review representative live pages**

Start or reuse the isolated review server on port 4322 and inspect:

- Paper 1 in Gazette and Reader at 320px, 390px, 768px, 1280px, and 1440px.
- Paper 85 at 320px and 640px to exercise the longest Roman numeral title.
- Paper 54 in Gazette to confirm repeated `fœderal` rendering.
- A 200%-zoom-equivalent 640px viewport for collapse and overflow.

Confirm the toolbar rule has slightly more breathing room, the title is one line, the IM FELL texture is confined to Gazette title furniture, body reading remains Caslon, and no page horizontally scrolls.

- [ ] **Step 5: Verify repository cleanliness**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no uncommitted feature files. The user-owned `_to_delete/` and `docs/about-two-column-roadmap.md` remain untracked only in the main checkout, not in the isolated worktree.

- [ ] **Step 6: Finish the branch**

Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Merge the verified branch into `main`, rerun `pnpm check` and `pnpm test:e2e` on merged `main`, push to `git@github.com:vwalke/federalist-papers-reader.git`, and verify the remote `main` SHA before cleaning up the temporary worktree.
