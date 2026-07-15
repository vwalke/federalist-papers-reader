# Anonymous Gazette Heading and Reading Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present every Federalist essay anonymously as `PUBLIUS`, move its heading into the Gazette’s first column, and rebuild the reading companion around a compact lockup, full-width summary, and bottom author attribution.

**Architecture:** Add one pure formatter for authorship wording, then pass its output through the existing `Commentary.astro` boundary. Wrap the heading and essay body in one `.essay-flow` fragmentation container so CSS multi-column layout can place the heading at the top of column one without duplicating content or forcing breaks. Keep Reader mode, mobile, and print as single-column variants of the same DOM.

**Tech Stack:** Astro 7, TypeScript, CSS multi-column layout, Vitest 4, Playwright 1.57, axe-core accessibility tests.

## Global Constraints

- Do not alter any of the 85 Markdown essay bodies or their metadata.
- Gazette top matter contains only `THE FEDERALIST. No. …`, the recipient line, and `PUBLIUS`.
- Reader mode may show the modern descriptive title but never the identified author or repetitive publication label above the essay.
- The real author appears only in the reading companion footer.
- Preserve the original closing `PUBLIUS` in essay text.
- Use one server-rendered heading and one server-rendered essay body; do not duplicate content or use positioned overlays.
- Keep Gazette mode single-column below 46rem, at 200% zoom, and in print.
- Introduce no dependencies and no new client-side JavaScript.
- Preserve the existing `docs/about-two-column-roadmap.md` and any unrelated About-page or global-style edits.

---

### Task 1: Format companion author attribution

**Files:**
- Create: `src/lib/author-attribution.ts`
- Create: `tests/author-attribution.test.ts`

**Interfaces:**
- Consumes: `author: string` and `certainty: 'certain' | 'joint' | 'disputed'` from Federalist content metadata.
- Produces: `formatAuthorAttribution(author: string, certainty: AuthorCertainty): string`, used by `Commentary.astro` in Task 2.

- [ ] **Step 1: Write the failing formatter tests**

Create `tests/author-attribution.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatAuthorAttribution } from '../src/lib/author-attribution';

describe('author attribution', () => {
  it('identifies a certain author quietly at the end of the companion', () => {
    expect(formatAuthorAttribution('Alexander Hamilton', 'certain')).toBe(
      'Essay by Alexander Hamilton.'
    );
  });

  it('preserves joint authorship wording', () => {
    expect(formatAuthorAttribution('James Madison with Alexander Hamilton', 'joint')).toBe(
      'Essay by James Madison with Alexander Hamilton.'
    );
  });

  it('states disputed authorship without repeating the stored qualifier', () => {
    expect(
      formatAuthorAttribution('James Madison (attribution disputed)', 'disputed')
    ).toBe('Commonly attributed to James Madison; authorship disputed.');
  });
});
```

- [ ] **Step 2: Run the formatter test and verify RED**

Run:

```bash
pnpm vitest run tests/author-attribution.test.ts
```

Expected: FAIL because `src/lib/author-attribution.ts` does not exist.

- [ ] **Step 3: Add the minimal formatter**

Create `src/lib/author-attribution.ts`:

```ts
export type AuthorCertainty = 'certain' | 'joint' | 'disputed';

export function formatAuthorAttribution(author: string, certainty: AuthorCertainty) {
  const cleanAuthor = author.replace(/\s*\(attribution disputed\)\s*$/i, '').trim();

  if (certainty === 'disputed') {
    return `Commonly attributed to ${cleanAuthor}; authorship disputed.`;
  }

  return `Essay by ${cleanAuthor}.`;
}
```

- [ ] **Step 4: Run the formatter test and verify GREEN**

Run:

```bash
pnpm vitest run tests/author-attribution.test.ts
```

Expected: 1 test file and 3 tests pass.

- [ ] **Step 5: Commit the formatter**

```bash
git add src/lib/author-attribution.ts tests/author-attribution.test.ts
git commit -m "feat: format companion author attribution"
```

---

### Task 2: Render anonymous top matter and a coherent companion

**Files:**
- Modify: `src/layouts/PaperLayout.astro`
- Modify: `src/components/Commentary.astro`
- Modify: `tests/paper-page.test.ts`

**Interfaces:**
- Consumes: `formatAuthorAttribution()` from Task 1 and the existing `paper.data.author` / `paper.data.authorCertainty` metadata.
- Produces: `.essay-flow`, `.commentary__heading`, `.commentary__lead`, `.commentary__details`, and `.commentary__attribution` DOM contracts used by Task 3 browser tests and CSS.

- [ ] **Step 1: Update the server-rendered page test for the new contract**

Replace the first test in `tests/paper-page.test.ts` and add the disputed-attribution test, leaving the 85-route test intact:

```ts
it('pre-renders an anonymous essay followed by an attributed companion', async () => {
  const html = await readFile(new URL('../dist/papers/1/index.html', import.meta.url), 'utf8');

  expect(html).toContain('Federalist No. 1');
  expect(html).toContain('General Introduction');
  expect(html).toContain('src="/masthead-independent-journal.svg"');
  expect(html).toContain('alt=""');
  expect(html).toContain('class="essay-flow"');
  expect(html).toContain('THE FEDERALIST.');
  expect(html).toContain('No. I.');
  expect(html).toContain('class="essay-heading__byline">PUBLIUS</p>');
  expect(html).not.toContain('class="essay-heading__author"');
  expect(html).not.toContain('class="essay-heading__publication"');
  expect(html).not.toContain('For the Independent Journal. Saturday, October 27, 1787');
  expect(html).toContain('AFTER an unequivocal experience');
  expect(html).toContain('id="companion-heading"');
  expect(html).toContain('Reading companion');
  expect(html).not.toContain('In a nutshell');
  expect(html).toContain('class="commentary__attribution">Essay by Alexander Hamilton.</p>');
  expect(html).toContain('Talk it over');
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Reading style"');
  expect(html).not.toContain('>View</span>');
  expect(html).toContain('data-paper-wear="1"');
  expect(html).toContain('href="/papers/2/"');
});

it('renders disputed attribution without duplicated qualification', async () => {
  const html = await readFile(new URL('../dist/papers/49/index.html', import.meta.url), 'utf8');

  expect(html).toContain('Commonly attributed to James Madison; authorship disputed.');
  expect(html).not.toContain('James Madison (attribution disputed); authorship disputed.');
});
```

- [ ] **Step 2: Build and run the page test to verify RED**

Run:

```bash
pnpm build && pnpm vitest run tests/paper-page.test.ts
```

Expected: FAIL because the old heading still renders the author/publication line and the companion still renders `In a nutshell` without an attribution footer.

- [ ] **Step 3: Restructure the essay flow in `PaperLayout.astro`**

Replace the existing heading and essay-body siblings with this shared flow:

```astro
<div class="essay-flow">
  <header class="essay-heading">
    <h1 class="essay-heading__title">
      <span>THE FEDERALIST.</span>{' '}
      <span class="essay-heading__number">No. {toRomanNumeral(data.number)}.</span>
    </h1>
    <p class="essay-heading__topic">{data.title}</p>
    <p class="essay-heading__recipient">{data.recipient}</p>
    <span class="essay-heading__ornament" aria-hidden="true"></span>
    <p class="essay-heading__byline">PUBLIUS</p>
  </header>

  <div class="essay-body">
    <slot />
  </div>
</div>
```

Pass author metadata to the companion:

```astro
<Commentary
  author={data.author}
  authorCertainty={data.authorCertainty}
  nutshell={data.nutshell}
  keyArguments={data.keyArguments}
  whyItMattered={data.whyItMattered}
  talkItOver={data.talkItOver}
/>
```

Delete the former `.essay-heading__author`, `.essay-heading__publication`, and `.essay-heading__note` elements. Do not change `BaseLayout`’s document title or the content metadata.

- [ ] **Step 4: Replace `Commentary.astro` with the new semantic structure**

Use this complete component:

```astro
---
import {
  formatAuthorAttribution,
  type AuthorCertainty
} from '../lib/author-attribution';

interface Props {
  author: string;
  authorCertainty: AuthorCertainty;
  nutshell: string;
  keyArguments: string[];
  whyItMattered: string;
  talkItOver: string;
}

const {
  author,
  authorCertainty,
  nutshell,
  keyArguments,
  whyItMattered,
  talkItOver
} = Astro.props;
const attribution = formatAuthorAttribution(author, authorCertainty);
---

<aside class="commentary" aria-labelledby="companion-heading">
  <header class="commentary__intro">
    <h2 class="commentary__heading" id="companion-heading">
      <span aria-hidden="true">✦</span>
      <span>Reading companion</span>
    </h2>
    <p class="commentary__lead">{nutshell}</p>
  </header>

  <div class="commentary__details">
    <section aria-labelledby="arguments-heading">
      <h3 id="arguments-heading">The key moves</h3>
      <ol>
        {keyArguments.map((argument) => <li>{argument}</li>)}
      </ol>
    </section>
    {whyItMattered && (
      <section aria-labelledby="mattered-heading">
        <h3 id="mattered-heading">Why it mattered</h3>
        <p>{whyItMattered}</p>
      </section>
    )}
    <section class="commentary__question" aria-labelledby="question-heading">
      <h3 id="question-heading">Talk it over</h3>
      <p>{talkItOver}</p>
    </section>
  </div>

  <p class="commentary__attribution">{attribution}</p>
</aside>
```

- [ ] **Step 5: Build and run the focused unit tests to verify GREEN**

Run:

```bash
pnpm build && pnpm vitest run tests/author-attribution.test.ts tests/paper-page.test.ts
```

Expected: 2 test files and 6 tests pass; Astro builds 88 pages.

- [ ] **Step 6: Commit the semantic redesign**

```bash
git add src/layouts/PaperLayout.astro src/components/Commentary.astro tests/paper-page.test.ts
git commit -m "refactor: present essays anonymously"
```

---

### Task 3: Compose the Gazette flow and companion responsively

**Files:**
- Modify: `src/styles/paper.css`
- Modify: `tests/e2e/reader.spec.ts`

**Interfaces:**
- Consumes: The `.essay-flow` and companion class contracts from Task 2.
- Produces: A shared desktop multi-column flow, single-column Reader/mobile/print fallbacks, and a vertically coherent companion.

- [ ] **Step 1: Rewrite the wide Gazette browser test to target the shared flow**

Replace `matches the compact newspaper composition on a wide screen` in `tests/e2e/reader.spec.ts` with:

```ts
test('places anonymous top matter in the Gazette first column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/10/');

  const metrics = await page.locator('.essay-flow').evaluate((flow) => {
    const flowStyle = getComputedStyle(flow);
    const heading = flow.querySelector('.essay-heading') as Element;
    const title = flow.querySelector('.essay-heading__title') as Element;
    const paragraphs = [...flow.querySelectorAll('.essay-body > p')];
    const headingRect = heading.getBoundingClientRect();
    const paragraphRects = paragraphs.map((paragraph) => paragraph.getBoundingClientRect());
    const rightColumnTop = Math.min(
      ...paragraphRects
        .filter(({ x }) => x > headingRect.right + 10)
        .map(({ y }) => y)
    );
    const masthead = document.querySelector('.gazette-masthead__art');

    return {
      columnCount: flowStyle.columnCount,
      headingX: headingRect.x,
      headingY: headingRect.y,
      headingWidth: headingRect.width,
      flowWidth: flow.getBoundingClientRect().width,
      rightColumnTop,
      titleFontFamily: getComputedStyle(title).fontFamily,
      titleText: title.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      topAuthorVisible: Boolean(flow.querySelector('.essay-heading__author')),
      publicationVisible: Boolean(flow.querySelector('.essay-heading__publication')),
      mastheadVisible: masthead ? getComputedStyle(masthead).display !== 'none' : false,
      mastheadWidth: masthead?.getBoundingClientRect().width ?? Infinity,
      sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(metrics.columnCount).toBe('3');
  expect(metrics.headingWidth).toBeLessThan(metrics.flowWidth / 2);
  expect(Math.abs(metrics.rightColumnTop - metrics.headingY)).toBeLessThan(40);
  expect(metrics.titleFontFamily).toContain('Libre Caslon Display');
  expect(metrics.titleText).toContain('THE FEDERALIST. No. X.');
  expect(metrics.topAuthorVisible).toBe(false);
  expect(metrics.publicationVisible).toBe(false);
  expect(metrics.mastheadVisible).toBe(true);
  expect(metrics.mastheadWidth).toBeLessThanOrEqual(metrics.sheetWidth);
  expect(metrics.overflow).toBeLessThanOrEqual(0);
});
```

- [ ] **Step 2: Strengthen the companion browser test before changing CSS**

Replace `keeps the reading companion balanced on desktop and stacked on mobile` with:

```ts
test('keeps the companion introduction coherent and its details responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/2/');

  const desktop = await page.locator('.commentary').evaluate((commentary) => {
    const heading = commentary.querySelector('.commentary__heading') as Element;
    const ornament = heading.querySelector('[aria-hidden="true"]') as Element;
    const lead = commentary.querySelector('.commentary__lead') as Element;
    const details = commentary.querySelector('.commentary__details') as Element;
    const attribution = commentary.querySelector('.commentary__attribution') as Element;
    const sectionRects = [...details.querySelectorAll(':scope > section')].map((section) =>
      section.getBoundingClientRect()
    );
    const headingRect = heading.getBoundingClientRect();
    const ornamentRect = ornament.getBoundingClientRect();
    const leadRect = lead.getBoundingClientRect();
    const attributionRect = attribution.getBoundingClientRect();

    return {
      headingText: heading.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      headingY: headingRect.y,
      ornamentY: ornamentRect.y,
      leadY: leadRect.y,
      leadX: leadRect.x,
      companionX: commentary.getBoundingClientRect().x,
      sectionWidths: sectionRects.map(({ width }) => width),
      sectionYPositions: sectionRects.map(({ y }) => y),
      attributionY: attributionRect.y,
      detailsBottom: Math.max(...sectionRects.map(({ bottom }) => bottom)),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(desktop.headingText).toBe('✦ Reading companion');
  expect(Math.abs(desktop.ornamentY - desktop.headingY)).toBeLessThan(6);
  expect(desktop.leadY).toBeGreaterThan(desktop.headingY);
  expect(Math.abs(desktop.leadX - desktop.companionX)).toBeLessThan(2);
  expect(Math.min(...desktop.sectionWidths)).toBeGreaterThan(220);
  expect(Math.max(...desktop.sectionWidths) / Math.min(...desktop.sectionWidths)).toBeLessThan(1.5);
  expect(Math.max(...desktop.sectionYPositions) - Math.min(...desktop.sectionYPositions)).toBeLessThan(2);
  expect(desktop.attributionY).toBeGreaterThan(desktop.detailsBottom);
  expect(desktop.overflow).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/papers/2/');

  const mobile = await page.locator('.commentary').evaluate((commentary) => {
    const detailRects = [...commentary.querySelectorAll('.commentary__details > section')].map(
      (section) => section.getBoundingClientRect()
    );
    const heading = commentary.querySelector('.commentary__heading') as Element;
    const lead = commentary.querySelector('.commentary__lead') as Element;
    const attribution = commentary.querySelector('.commentary__attribution') as Element;

    return {
      headingY: heading.getBoundingClientRect().y,
      leadY: lead.getBoundingClientRect().y,
      detailXPositions: detailRects.map(({ x }) => x),
      detailYPositions: detailRects.map(({ y }) => y),
      detailWidths: detailRects.map(({ width }) => width),
      attributionY: attribution.getBoundingClientRect().y,
      detailsBottom: Math.max(...detailRects.map(({ bottom }) => bottom)),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(mobile.headingY).toBeLessThan(mobile.leadY);
  expect(Math.max(...mobile.detailXPositions) - Math.min(...mobile.detailXPositions)).toBeLessThan(2);
  expect(mobile.detailYPositions[0]).toBeLessThan(mobile.detailYPositions[1]);
  expect(mobile.detailYPositions[1]).toBeLessThan(mobile.detailYPositions[2]);
  expect(Math.min(...mobile.detailWidths)).toBeGreaterThan(300);
  expect(mobile.attributionY).toBeGreaterThan(mobile.detailsBottom);
  expect(mobile.overflow).toBeLessThanOrEqual(0);
});
```

In `uses one Gazette column on mobile without horizontal overflow`, change the locator and column read from `.essay-body` to `.essay-flow`:

```ts
const layout = await page.locator('.essay-flow').evaluate((element) => ({
  columns: getComputedStyle(element).columnCount,
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  mastheadWidth: document.querySelector('.gazette-masthead__art')?.getBoundingClientRect().width ?? 0,
  sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
  controlHeights: [...document.querySelectorAll('.reading-toolbar button')].map(
    (control) => control.getBoundingClientRect().height
  ),
  progressWidth: document.querySelector('.progress-control')?.getBoundingClientRect().width ?? Infinity,
  bookmarkBefore: getComputedStyle(
    document.querySelector('.progress-control__mark') as Element,
    '::before'
  ).content,
  bookmarkAfter: getComputedStyle(
    document.querySelector('.progress-control__mark') as Element,
    '::after'
  ).content
}));
```

- [ ] **Step 3: Run the focused browser tests and verify RED**

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e tests/e2e/reader.spec.ts
```

Expected: FAIL because `.essay-flow` is still single-column on desktop, the heading retains its full-width styles, and the companion lead does not yet span the full width beneath an inline heading lockup.

- [ ] **Step 4: Move multi-column layout from `.essay-body` to `.essay-flow`**

In `src/styles/paper.css`, add `.essay-flow` immediately before `.essay-heading`:

```css
.essay-flow {
  position: relative;
  z-index: 1;
}
```

Replace the base `.essay-heading` block with:

```css
.essay-heading {
  margin: 0 0 var(--space-md);
  padding-block-end: var(--space-sm);
  text-align: center;
  break-inside: avoid;
}
```

Remove `.essay-heading__author`, `.essay-heading__publication`, and `.essay-heading__note` from the shared small-caps selector and delete their standalone style blocks. Keep `.essay-heading__byline` and `.essay-heading__recipient` styles.

Remove `position: relative` and `z-index: 1` from `.essay-body`; retain its typography declarations:

```css
.essay-body {
  font-size: clamp(1.02rem, 1.35vw, 1.1rem);
  font-variant-numeric: oldstyle-nums;
  hyphens: auto;
  line-height: 1.38;
  text-align: left;
}
```

Replace the Reader-mode max-width group with:

```css
[data-reading-mode='reader'] .essay-flow,
[data-reading-mode='reader'] .commentary,
[data-reading-mode='reader'] .essay-navigation {
  max-inline-size: 68ch;
  margin-inline: auto;
}
```

Replace the Gazette multi-column rules at 46rem and 68rem:

```css
@media (min-width: 46rem) {
  [data-reading-mode='gazette'] .essay-flow {
    columns: 2 19rem;
    column-gap: clamp(1.5rem, 3vw, 2.5rem);
    column-rule: 1px solid color-mix(in oklab, var(--color-rule) 62%, transparent);
  }

  .commentary__details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .commentary__question {
    grid-column: 1 / -1;
  }

  .essay-navigation {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 68rem) {
  [data-reading-mode='gazette'] .essay-flow {
    columns: 3 18rem;
  }

  .commentary__details {
    grid-template-columns: minmax(0, 1.15fr) repeat(2, minmax(0, 1fr));
  }

  .commentary__question {
    grid-column: auto;
  }
}
```

Inside the existing print media query, replace the essay column reset with:

```css
.essay-flow {
  columns: auto !important;
  max-inline-size: none;
}

.essay-body {
  font-size: 11pt;
}
```

- [ ] **Step 5: Restyle the companion introduction and attribution**

Replace the base companion intro/heading styles with:

```css
.commentary__intro {
  display: grid;
  gap: var(--space-sm);
}

.commentary__details {
  display: grid;
  gap: var(--space-lg);
  align-items: start;
  margin-block-start: var(--space-lg);
  padding-block-start: var(--space-lg);
  border-block-start: 1px solid color-mix(in oklab, var(--color-rule) 48%, transparent);
}

.commentary__heading {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0;
  color: var(--color-ink);
  font: 700 clamp(1rem, 1.6vw, 1.2rem)/1.2 var(--font-reading);
  font-variant-caps: small-caps;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.commentary__heading > span:first-child {
  flex: 0 0 auto;
  color: var(--color-oxblood);
}

.commentary__lead {
  max-inline-size: 72ch;
  font-size: clamp(1.05rem, 1.5vw, 1.16rem) !important;
  line-height: 1.52 !important;
}

.commentary h3 {
  margin-block: var(--space-xs);
  font: 700 0.7rem/1.3 var(--font-reading);
  font-variant-caps: small-caps;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.commentary__attribution {
  margin-block-start: var(--space-lg);
  padding-block-start: var(--space-sm);
  border-block-start: 1px solid color-mix(in oklab, var(--color-rule) 48%, transparent);
  color: var(--color-muted-ink);
  font: 700 0.72rem/1.4 var(--font-reading) !important;
  font-variant-caps: small-caps;
  letter-spacing: 0.08em;
}
```

Delete the old `.commentary__heading > span`, `.commentary__heading > p`, and `.commentary h2` rules. At 46rem, remove the former `.commentary__intro` two-column rule entirely; retain the three detail-section grid rules. In the mobile media query, remove `.commentary__intro` from the shared gap override and delete the now-unnecessary `.commentary__heading { text-align: left; }` rule.

- [ ] **Step 6: Run the focused browser tests and verify GREEN**

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e tests/e2e/reader.spec.ts
```

Expected: all reader browser tests pass.

- [ ] **Step 7: Run full verification**

Run:

```bash
pnpm check
```

Expected: zero Astro diagnostics, 88 pages built, and all Vitest tests pass.

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e
```

Expected: every Playwright test, including all accessibility checks, passes.

- [ ] **Step 8: Run the design detector**

Run:

```bash
node '/Users/vwalke/.codex/plugins/cache/impeccable/impeccable/3.9.1/skills/impeccable/scripts/detect.mjs' --json --scope layout src/layouts/PaperLayout.astro src/components/Commentary.astro src/styles/paper.css
```

Expected: `[]`.

- [ ] **Step 9: Inspect the live page at required widths and modes**

Start the isolated worktree server:

```bash
pnpm run dev --host 127.0.0.1 --port 4322
```

Inspect `/papers/2/`, `/papers/10/`, and disputed-authorship `/papers/49/` at 320px, 390px, 768px, 1088px, 1280px, and 1440px. Confirm:

- no horizontal overflow;
- one Gazette column below 46rem;
- two columns from 46rem through 67.999rem;
- three columns at 68rem and wider;
- anonymous heading occupies the top of the first Gazette column;
- essay text begins near the top of later columns;
- Reader mode shows the modern descriptive title and stays within 68ch;
- the summary sits beneath the inline companion lockup;
- attribution follows all companion details;
- the disputed wording appears exactly once;
- 200% zoom collapses to the same linear reading order;
- print is one column.

- [ ] **Step 10: Commit the responsive composition**

```bash
git add src/styles/paper.css tests/e2e/reader.spec.ts
git commit -m "feat: compose anonymous Gazette columns"
```

---

## Final integration checklist

- [ ] Re-run `pnpm check` and `PLAYWRIGHT_PORT=4322 pnpm test:e2e` from the final feature commit.
- [ ] Confirm `git diff --check` is clean.
- [ ] Confirm the branch contains only the spec, plan, attribution helper, paper layout, commentary, paper stylesheet, and related tests.
- [ ] Use `superpowers:finishing-a-development-branch` to merge, push, preserve, or discard the isolated worktree.
