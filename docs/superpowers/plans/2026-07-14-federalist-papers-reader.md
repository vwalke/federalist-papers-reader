# Federalist Papers Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a static Astro site containing all 85 Federalist Papers, a responsive period-newspaper reading mode, a modern reader mode, accessible commentary and index navigation, local read progress, and low-cost AWS deployment instructions.

**Architecture:** Astro 7 pre-renders every route from a validated local content collection. Original essay text and editorial metadata are committed to the repository; small framework-free TypeScript modules progressively enhance the index, reading mode, and local progress without making core reading depend on JavaScript. AWS Amplify serves the static `dist/` output, with S3 plus CloudFront documented as a fallback.

**Tech Stack:** Node.js 22.20 or newer, pnpm 10, Astro 7, TypeScript, Vitest, Playwright Chromium/WebKit, axe-core, HTML/CSS, browser `localStorage`.

## Global Constraints

- The collection must contain exactly 85 uniquely numbered papers.
- Preserve original wording; modernize typography and spacing only.
- Commentary voice is warm, plainspoken, nonpartisan, and intended for lay readers.
- Gazette mode uses two or three columns only when readable; it is one column from 320px through phone widths.
- No accounts, backend, database, runtime AI, or runtime content API.
- JavaScript failure must not hide essay text, essay navigation, or the full index.
- Body text contrast is at least 4.5:1; all controls are keyboard accessible; motion respects `prefers-reduced-motion`.
- Read status and preferred mode persist only in the current browser.
- No AWS resource is created or changed without separate user authorization.

---

## Planned File Structure

```text
.
├── amplify.yml                         # Amplify static-build instructions
├── astro.config.mjs                    # Static Astro configuration
├── package.json                        # Scripts and pinned dependencies
├── playwright.config.ts                # Chromium/WebKit end-to-end setup
├── public/
│   ├── favicon.svg                     # Publius monogram
│   └── social-card.svg                 # Share image
├── scripts/
│   ├── import-federalist.mjs           # Reproducible Gutenberg-to-Markdown importer
│   └── validate-content.mjs            # Independent completeness/link validation
├── src/
│   ├── components/
│   │   ├── Commentary.astro            # Reading companion sections
│   │   ├── EssayNavigation.astro        # Previous/next/next-unread links
│   │   ├── GazetteMasthead.astro        # Masthead and issue line
│   │   ├── IndexLedger.astro            # Full no-JS index and enhancement hooks
│   │   ├── ProgressControl.astro        # Read/unread control
│   │   └── ReadingToolbar.astro         # Gazette/Reader switch and text controls
│   ├── content/
│   │   └── papers/001.md … 085.md       # Text, metadata, and companion content
│   ├── content.config.ts                # Typed collection schema
│   ├── data/
│   │   ├── editorial.json               # Curated summaries, context, questions, dates
│   │   └── sources.json                 # Shared source labels and URLs
│   ├── layouts/
│   │   ├── BaseLayout.astro             # Metadata, skip link, site chrome
│   │   └── PaperLayout.astro            # Essay page composition
│   ├── lib/
│   │   ├── index-state.ts               # Pure sort/filter/search functions
│   │   ├── papers.ts                    # Typed paper lookup and ordering
│   │   └── preferences.ts               # Safe localStorage adapter
│   ├── pages/
│   │   ├── 404.astro
│   │   ├── about.astro
│   │   ├── index.astro
│   │   └── papers/[number].astro
│   ├── scripts/
│   │   ├── enhance-index.ts             # Index DOM enhancement
│   │   └── enhance-reader.ts            # Mode/progress DOM enhancement
│   └── styles/
│       ├── global.css                   # Tokens, reset, common type and focus
│       ├── index.css                    # Front page and ledger
│       ├── paper.css                    # Gazette, Reader, commentary, print
│       └── utilities.css                # Visually hidden and layout helpers
├── tests/
│   ├── content.test.ts                  # Collection completeness and metadata
│   ├── index-state.test.ts              # Search/sort/filter behavior
│   ├── preferences.test.ts              # Safe storage and next-unread behavior
│   └── e2e/
│       ├── accessibility.spec.ts         # axe, keyboard, zoom, no-JS core content
│       ├── index.spec.ts                 # Ledger interactions and mobile layout
│       └── reader.spec.ts                # Mode, progress, navigation, persistence
└── docs/
    ├── deployment.md                    # Amplify and S3/CloudFront instructions
    └── sources.md                       # Editorial provenance and import process
```

---

### Task 1: Static Project Foundation and Typed Content Contract

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/content.config.ts`
- Create: `src/lib/papers.ts`
- Create: `tests/content.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `PaperData`, `PaperAuthor`, `getOrderedPapers()`, `getPaperByNumber(number)`, `getAdjacentPapers(number)`.
- Consumes: Astro content entries loaded from `src/content/papers/*.md` beginning in Task 2.

- [ ] **Step 1: Add the project manifest and install exact dependencies**

Use scripts that make validation part of every build:

```json
{
  "name": "publius-federalist-reader",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.20.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "pnpm validate:content && astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "validate:content": "node scripts/validate-content.mjs",
    "check": "astro check && pnpm test && pnpm build"
  }
}
```

Run: `pnpm add astro@7.0.7 && pnpm add -D @astrojs/check typescript vitest jsdom @playwright/test @axe-core/playwright`

Expected: `package.json` and `pnpm-lock.yaml` contain Astro 7.0.7 and the test dependencies.

- [ ] **Step 2: Write the failing content-contract test**

```ts
import { describe, expect, it } from 'vitest';
import { validatePaperSet } from '../src/lib/papers';

describe('Federalist collection contract', () => {
  it('requires every number from 1 through 85 exactly once', () => {
    const papers = Array.from({ length: 85 }, (_, index) => ({ number: index + 1 }));
    expect(validatePaperSet(papers)).toEqual({ valid: true, missing: [], duplicates: [] });
  });

  it('reports missing and duplicate numbers', () => {
    expect(validatePaperSet([{ number: 1 }, { number: 1 }, { number: 3 }])).toEqual({
      valid: false,
      missing: expect.arrayContaining([2, 85]),
      duplicates: [1]
    });
  });
});
```

- [ ] **Step 3: Run the test and confirm the red state**

Run: `pnpm vitest run tests/content.test.ts`

Expected: FAIL because `src/lib/papers.ts` does not exist.

- [ ] **Step 4: Implement schema and pure collection validation**

Define `src/content.config.ts` with Astro's `glob()` loader and a Zod schema containing `number`, `title`, `author`, `authorCertainty`, `publicationKind`, `publicationVenue`, `publicationDate`, `publicationDateLabel`, `indexSummary`, `nutshell`, `keyArguments`, `whyItMattered`, `talkItOver`, and `sources`. Define `validatePaperSet()` so it compares numbers against `1..85`, reports duplicates, and never depends on Astro runtime state.

```ts
export function validatePaperSet(papers: Array<{ number: number }>) {
  const numbers = papers.map(({ number }) => number);
  const counts = new Map<number, number>();
  numbers.forEach((number) => counts.set(number, (counts.get(number) ?? 0) + 1));
  const expected = Array.from({ length: 85 }, (_, index) => index + 1);
  const missing = expected.filter((number) => !counts.has(number));
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((a, b) => a - b);
  return { valid: missing.length === 0 && duplicates.length === 0, missing, duplicates };
}
```

- [ ] **Step 5: Run foundation checks**

Run: `pnpm vitest run tests/content.test.ts && pnpm astro check`

Expected: content tests PASS; Astro check reports no TypeScript errors.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml astro.config.mjs tsconfig.json src/content.config.ts src/lib/papers.ts tests/content.test.ts .gitignore
git commit -m "build: scaffold validated Astro reader"
```

---

### Task 2: Reproducible Source Import and the Complete 85-Paper Corpus

**Files:**
- Create: `scripts/import-federalist.mjs`
- Create: `scripts/validate-content.mjs`
- Create: `src/data/editorial.json`
- Create: `src/data/sources.json`
- Create: `src/content/papers/001.md` through `src/content/papers/085.md`
- Create: `docs/sources.md`
- Modify: `tests/content.test.ts`

**Interfaces:**
- Consumes: Project Gutenberg HTML at `https://www.gutenberg.org/files/1404/1404-h/1404-h.htm`; Library of Congress publication metadata and the approved content schema.
- Produces: 85 committed Markdown entries consumed by `getCollection('papers')`; `pnpm validate:content` exits nonzero on incomplete data.

- [ ] **Step 1: Extend tests to enforce editorial completeness**

Load the generated Markdown frontmatter through a small parser in the validator and assert:

```ts
expect(report.count).toBe(85);
expect(report.numbers).toEqual(Array.from({ length: 85 }, (_, i) => i + 1));
expect(report.missingFields).toEqual([]);
expect(report.shortSummariesOver18Words).toEqual([]);
expect(report.emptyBodies).toEqual([]);
expect(report.commentaryOutsideTarget).toEqual([]);
```

- [ ] **Step 2: Confirm completeness tests fail before import**

Run: `pnpm vitest run tests/content.test.ts`

Expected: FAIL with count `0` instead of `85`.

- [ ] **Step 3: Implement the one-time importer**

The importer must:

1. Fetch the Gutenberg HTML only when `--download` is passed.
2. Split on the 85 Federalist headings, remove Gutenberg navigation/license chrome, and preserve paragraph text.
3. Merge by paper number with curated data from `src/data/editorial.json`.
4. Escape YAML safely and write zero-padded Markdown filenames.
5. Refuse to overwrite edited content without `--force`.

Its command contract is:

```js
const options = new Set(process.argv.slice(2));
if (!options.has('--download')) {
  throw new Error('Pass --download to fetch the public-domain source explicitly.');
}
const SOURCE_URL = 'https://www.gutenberg.org/files/1404/1404-h/1404-h.htm';
const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
```

- [ ] **Step 4: Create curated metadata and commentary for all 85 papers**

For every entry, write:

- An index summary of no more than 18 words.
- A two- or three-sentence `nutshell`.
- Three to five `keyArguments`.
- A concise `whyItMattered` paragraph only when context aids understanding; use an empty string when no extra context is needed.
- One open-ended `talkItOver` question.
- Source keys resolving through `sources.json`.
- The first-publication date and venue, with `publicationKind: book` for Papers 78–85 and a human-readable qualifier.
- Honest disputed attribution labels where the authoritative sources disagree.

Commentary must describe the author's argument before assessing its implications and must avoid modern partisan labels.

- [ ] **Step 5: Run the importer and independent validator**

Run: `node scripts/import-federalist.mjs --download && pnpm validate:content`

Expected: `Wrote 85 papers` followed by `Validated papers 1–85: no gaps, duplicates, empty bodies, or incomplete commentary.`

- [ ] **Step 6: Compare representative text with authoritative pages**

Compare Papers 1, 10, 51, 78, and 85 against the Library of Congress full-text presentation. Record the check and edition caveat in `docs/sources.md`. The document must state that the Library of Congress web presentation itself uses Project Gutenberg text and explain that Papers 78–85 are book-first publications.

- [ ] **Step 7: Run all content tests**

Run: `pnpm vitest run tests/content.test.ts && pnpm validate:content`

Expected: PASS and validator exit code 0.

- [ ] **Step 8: Commit the complete corpus**

```bash
git add scripts src/content/papers src/data tests/content.test.ts docs/sources.md
git commit -m "content: add all 85 Federalist Papers and companions"
```

---

### Task 3: Visual System, Base Layout, and Static Site Shell

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/styles/global.css`
- Create: `src/styles/utilities.css`
- Create: `src/components/GazetteMasthead.astro`
- Create: `public/favicon.svg`
- Create: `public/social-card.svg`
- Create: `src/pages/index.astro` (shell only)
- Create: `src/pages/about.astro` (shell only)

**Interfaces:**
- Produces: `<BaseLayout title description>` and `<GazetteMasthead compact?>` used by every page.
- Consumes: no client state; all shell content renders as semantic HTML.

- [ ] **Step 1: Add a structural rendering test**

Test the built home HTML after a temporary minimal page is added:

```ts
const html = await readFile('dist/index.html', 'utf8');
expect(html).toContain('href="#main-content"');
expect(html).toContain('<main id="main-content"');
expect(html).toContain('The Independent Journal');
expect(html).toContain('viewport');
```

- [ ] **Step 2: Run the build and confirm the structural test fails**

Run: `pnpm build && pnpm vitest run tests/content.test.ts`

Expected: FAIL because the base landmarks and masthead are absent.

- [ ] **Step 3: Implement the design tokens and base layout**

Use OKLCH tokens anchored by near-black ink, a neutral low-chroma newsprint surface, an oxblood action color, and a muted blue-black secondary ink. Use locally available system serif fallbacks first so the site has no font-network dependency. Include visible `:focus-visible`, fluid type, `text-wrap`, and reduced-motion rules.

Required layout skeleton:

```astro
<a class="skip-link" href="#main-content">Skip to the paper</a>
<header class="site-header" aria-label="Site header">…</header>
<main id="main-content"><slot /></main>
<footer>Original texts are in the public domain. <a href="/about/">About this edition</a></footer>
```

- [ ] **Step 4: Build and verify the shell**

Run: `pnpm build && pnpm astro check`

Expected: PASS; `dist/index.html` and `dist/about/index.html` exist.

- [ ] **Step 5: Commit the shell**

```bash
git add src/layouts src/styles src/components/GazetteMasthead.astro src/pages/index.astro src/pages/about.astro public
git commit -m "feat: establish the Publius newspaper visual system"
```

---

### Task 4: Essay Routes, Gazette/Reader Modes, and Commentary

**Files:**
- Create: `src/layouts/PaperLayout.astro`
- Create: `src/components/Commentary.astro`
- Create: `src/components/EssayNavigation.astro`
- Create: `src/components/ProgressControl.astro`
- Create: `src/components/ReadingToolbar.astro`
- Create: `src/pages/papers/[number].astro`
- Create: `src/styles/paper.css`
- Create: `src/scripts/enhance-reader.ts`
- Create: `tests/e2e/reader.spec.ts`

**Interfaces:**
- Consumes: ordered `PaperData` entries, `getAdjacentPapers()`, and preference functions from Task 5.
- Produces: 85 routes `/papers/1/` through `/papers/85/`; DOM hooks `[data-reading-mode]`, `[data-paper-number]`, `[data-mark-read]`, and `[data-next-unread]`.

- [ ] **Step 1: Write failing reader-route tests**

```ts
test('Gazette is readable and mode survives navigation', async ({ page }) => {
  await page.goto('/papers/1/');
  await expect(page.locator('article')).toContainText('After an unequivocal experience');
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'gazette');
  await page.getByRole('button', { name: 'Reader mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
  await page.getByRole('link', { name: /Next paper/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
});

test('commentary follows the unchanged essay', async ({ page }) => {
  await page.goto('/papers/10/');
  await expect(page.getByRole('heading', { name: 'In a nutshell' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Talk it over' })).toBeVisible();
});
```

- [ ] **Step 2: Run tests and confirm route failure**

Run: `pnpm build && pnpm exec playwright test tests/e2e/reader.spec.ts`

Expected: FAIL because `/papers/1/` does not exist.

- [ ] **Step 3: Implement static paths and semantic essay composition**

`getStaticPaths()` must sort the collection numerically and return each number as a route parameter. Keep all essay text in the initial HTML. Put commentary after `</article>` in a labeled complementary section. Previous/next anchors remain normal links even when JavaScript is disabled.

- [ ] **Step 4: Implement the responsive Gazette and Reader CSS**

Required behavior:

```css
.essay-body { max-width: 72ch; margin-inline: auto; }
[data-reading-mode="gazette"] .essay-body { max-width: none; column-count: 3; column-gap: clamp(1.5rem, 3vw, 3rem); column-rule: 1px solid var(--rule); }
@media (max-width: 68rem) { [data-reading-mode="gazette"] .essay-body { column-count: 2; } }
@media (max-width: 46rem) { [data-reading-mode="gazette"] .essay-body { column-count: 1; text-align: left; max-width: 68ch; } }
@media print { .reading-toolbar, .progress-control, .site-header { display: none; } .essay-body { column-count: 1 !important; } }
```

Avoid fixed heights so long papers flow naturally. Use `break-inside: avoid` only for headings and short ornamental blocks, never for body paragraphs.

- [ ] **Step 5: Implement mode enhancement without content dependency**

On initialization, read `publius:reading-mode`; accept only `gazette` or `reader`; update the root data attribute and `aria-pressed`; write changes safely. If storage throws, the current session still switches mode.

- [ ] **Step 6: Run reader tests at desktop and mobile projects**

Run: `pnpm exec playwright test tests/e2e/reader.spec.ts`

Expected: PASS in Chromium desktop, Chromium mobile, and WebKit projects.

- [ ] **Step 7: Commit essay reading**

```bash
git add src/layouts/PaperLayout.astro src/components src/pages/papers src/styles/paper.css src/scripts/enhance-reader.ts tests/e2e/reader.spec.ts
git commit -m "feat: add responsive Gazette and Reader essay pages"
```

---

### Task 5: Index, Search, Sorting, Filtering, and Local Progress

**Files:**
- Create: `src/lib/index-state.ts`
- Create: `src/lib/preferences.ts`
- Create: `src/components/IndexLedger.astro`
- Create: `src/scripts/enhance-index.ts`
- Create: `src/styles/index.css`
- Modify: `src/pages/index.astro`
- Modify: `src/components/ProgressControl.astro`
- Modify: `src/scripts/enhance-reader.ts`
- Create: `tests/index-state.test.ts`
- Create: `tests/preferences.test.ts`
- Create: `tests/e2e/index.spec.ts`

**Interfaces:**
- Produces: `filterPapers(papers, state)`, `sortPapers(papers, key, direction)`, `safePreferences(storage)`, `getNextUnread(numbers, readSet, current?)`.
- Consumes: paper summaries rendered into ledger rows with data attributes and localStorage keys `publius:read-papers` and `publius:reading-mode`.

- [ ] **Step 1: Write pure-function tests first**

```ts
expect(filterPapers(sample, { query: 'faction', author: 'all', status: 'all' }).map(p => p.number)).toEqual([10]);
expect(sortPapers(sample, 'author', 'asc').map(p => p.author)).toEqual(['Hamilton', 'Jay', 'Madison']);
expect(getNextUnread([1, 2, 3], new Set([1]), 1)).toBe(2);
expect(getNextUnread([1, 2, 3], new Set([1, 2, 3]))).toBeNull();
```

- [ ] **Step 2: Run unit tests and confirm missing-function failures**

Run: `pnpm vitest run tests/index-state.test.ts tests/preferences.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement pure state and safe storage adapters**

`safePreferences()` must catch exceptions for get, set, and malformed JSON; filter read numbers to integers from 1 to 85; and expose `{ getReadPapers, setReadPapers, getMode, setMode, available }`. Sorting must be stable with paper number as the tie-breaker.

- [ ] **Step 4: Run unit tests to green**

Run: `pnpm vitest run tests/index-state.test.ts tests/preferences.test.ts`

Expected: PASS.

- [ ] **Step 5: Render the entire index before enhancement**

`IndexLedger.astro` renders all 85 links in HTML. Search, sort, and filter controls have associated labels. The enhanced script may reorder or hide rows, but the baseline markup remains complete without JavaScript. Status text uses `aria-live="polite"` and reports results such as `12 of 85 papers shown`.

- [ ] **Step 6: Add progress synchronization**

Marking a paper read updates the button's pressed state, progress count, index row, next-unread link, and local storage. Dispatch one `publius:progress-change` custom event so page-specific scripts do not know each other's internals.

- [ ] **Step 7: Verify index and progress end to end**

```ts
test('filtering and progress work at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Search the papers').fill('faction');
  await expect(page.locator('[data-paper-row]:visible')).toHaveCount(2);
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
});
```

Run: `pnpm exec playwright test tests/e2e/index.spec.ts tests/e2e/reader.spec.ts`

Expected: PASS across configured projects.

- [ ] **Step 8: Commit navigation and progress**

```bash
git add src/lib src/components/IndexLedger.astro src/components/ProgressControl.astro src/scripts src/styles/index.css src/pages/index.astro tests
git commit -m "feat: add searchable index and local reading progress"
```

---

### Task 6: About, Error Recovery, Metadata, and Print

**Files:**
- Modify: `src/pages/about.astro`
- Create: `src/pages/404.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/paper.css`
- Modify: `public/social-card.svg`
- Create: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: source documentation and shared base components.
- Produces: `/about/`, `/404.html`, canonical metadata, social metadata, and clean print output.

- [ ] **Step 1: Write failing route and metadata checks**

```ts
for (const path of ['/', '/about/', '/papers/1/']) {
  test(`${path} has title, description, canonical, and one h1`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(/Publius|Federalist/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}
```

- [ ] **Step 2: Run tests and confirm missing content or metadata**

Run: `pnpm exec playwright test tests/e2e/accessibility.spec.ts`

Expected: FAIL for incomplete about/404 pages or missing canonical metadata.

- [ ] **Step 3: Complete supporting pages and metadata**

About must explain sources, text policy, authorship uncertainty, book-first Papers 78–85, local-only progress, and the historically inspired/non-facsimile design. The 404 page must offer `Return to all papers` and `Read Paper No. 1`. Add canonical, Open Graph, and color-scheme metadata from `BaseLayout` props.

- [ ] **Step 4: Verify print output manually and with CSS assertions**

Ensure print hides controls, URLs are not appended to every link, Gazette columns collapse to one, ink becomes high-contrast black on white, and companion notes remain included.

- [ ] **Step 5: Run route tests**

Run: `pnpm exec playwright test tests/e2e/accessibility.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit supporting pages**

```bash
git add src/pages/about.astro src/pages/404.astro src/layouts/BaseLayout.astro src/styles/paper.css public/social-card.svg tests/e2e/accessibility.spec.ts
git commit -m "feat: complete edition notes and recovery pages"
```

---

### Task 7: Accessibility, Responsive, and Visual Quality Gate

**Files:**
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/index.spec.ts`
- Modify: `tests/e2e/reader.spec.ts`
- Modify: styles/components identified by the tests
- Create: `tests/e2e/no-script.spec.ts`

**Interfaces:**
- Consumes: the complete built site.
- Produces: repeatable Chromium desktop, Chromium mobile, and WebKit quality checks.

- [ ] **Step 1: Configure representative browser projects**

```ts
projects: [
  { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  { name: 'chromium-mobile', use: { ...devices['iPhone 13'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } }
]
```

The web server command is `pnpm preview --host 127.0.0.1`; reuse the server outside CI.

- [ ] **Step 2: Add automated axe and progressive-enhancement tests**

Run axe on home, Papers 1/10/51/78/85, about, and 404 with WCAG 2.2 A/AA tags. In the no-script project, assert all 85 index links and complete essay text are still present.

- [ ] **Step 3: Add responsive overflow assertions**

For widths 320, 375, 768, and 1440, assert:

```ts
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
expect(overflow).toBeLessThanOrEqual(1);
```

At 320 and 375, assert computed `columnCount` is `1`; at 1440 in Gazette mode, assert it is `3`.

- [ ] **Step 4: Add keyboard, zoom, storage-failure, and reduced-motion coverage**

Tab from the skip link through index controls; assert visible focus. Emulate reduced motion. Override localStorage methods to throw and assert essay reading and mode switching still work. Set a 200% equivalent viewport/font scale and repeat overflow and landmark checks.

- [ ] **Step 5: Run the full quality suite and fix every failure**

Run: `pnpm check && pnpm exec playwright test`

Expected: all unit, content, build, Chromium, mobile, WebKit, axe, and no-script tests PASS.

- [ ] **Step 6: Inspect the built site in the in-app browser**

Review home, a short paper, a long paper, Paper 78, both reading modes, the mobile index, and mobile single-column Gazette mode. Compare against the approved facsimile mockup and correct visual defects before proceeding.

- [ ] **Step 7: Commit quality refinements**

```bash
git add playwright.config.ts tests src
git commit -m "test: verify accessibility and responsive reading"
```

---

### Task 8: AWS Deployment Assets and Final Verification

**Files:**
- Create: `amplify.yml`
- Create: `docs/deployment.md`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `pnpm build` producing `dist/`.
- Produces: Amplify-compatible build configuration and a secure S3/CloudFront fallback procedure.

- [ ] **Step 1: Add Amplify's deterministic build configuration**

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - corepack enable
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm check
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .pnpm-store/**/*
```

- [ ] **Step 2: Write deployment instructions**

Document:

1. Push the repository to a Git provider.
2. In Amplify Hosting, create an app from that repository and select `main`.
3. Confirm `amplify.yml` and `dist` as the artifact output.
4. Deploy to the generated HTTPS domain.
5. Optionally attach a custom domain and verify the certificate.
6. Set long immutable caching for hashed assets and short caching for HTML.
7. For the fallback, use a private S3 bucket behind CloudFront Origin Access Control; do not expose a public bucket website endpoint when HTTPS end-to-end is desired.

Include current links to the official AWS Amplify, S3, CloudFront, and custom-domain documentation. Do not claim a fixed monthly cost; explain that charges depend on build minutes, storage, and transfer.

- [ ] **Step 3: Add a concise project README**

Include purpose, prerequisites, `pnpm install`, `pnpm dev`, `pnpm check`, content provenance, local-only progress, and the deployment-doc link.

- [ ] **Step 4: Run a clean-install production verification**

Run: `pnpm install --frozen-lockfile && pnpm check && pnpm exec playwright test`

Expected: all commands exit 0 and `dist/` contains 85 paper directories plus home, about, and 404 output.

- [ ] **Step 5: Verify route count and artifact size**

Run: `find dist/papers -mindepth 1 -maxdepth 1 -type d | wc -l && du -sh dist`

Expected: route count `85`; artifact size is reported and suitable for static hosting.

- [ ] **Step 6: Commit deployment readiness**

```bash
git add amplify.yml docs/deployment.md README.md package.json pnpm-lock.yaml
git commit -m "docs: add low-cost AWS deployment path"
```

- [ ] **Step 7: Perform final evidence review**

Run: `git status --short && git log --oneline --decorate -10`

Expected: clean working tree and a sequence of focused implementation commits following the design-spec commit.

---

## Plan Self-Review

- **Spec coverage:** Tasks 2–8 cover the complete corpus, editorial companions, publication metadata, Gazette/Reader modes, responsive single-column mobile behavior, index navigation, local progress, resilience, accessibility, print, and AWS deployment.
- **Type consistency:** `PaperData`, storage keys, route shape, DOM hooks, and pure-function names remain consistent across tasks.
- **Scope:** The site remains static and intentionally excludes accounts, shared annotations, runtime APIs, and AWS mutations.
- **Execution:** Implement inline in this session because no subagent or parallel-agent work was requested.
