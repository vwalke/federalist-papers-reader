# Mock Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the shared Federalist paper presentation so its masthead, hierarchy, typography, rules, and responsive density closely match the approved aged-paper mock.

**Architecture:** A generated, path-only SVG provides a sharp and stable Independent Journal nameplate. Small pure display helpers provide Roman paper numbers and historically honest datelines, while the existing Astro components continue to render all meaningful essay and publication text. Shared CSS tokens and responsive rules bring Gazette mode into alignment with the mock without changing Reader mode, content, progress state, or routing.

**Tech Stack:** Astro 7, TypeScript, Vitest, Playwright, CSS, Fontsource, OpenType.js, static SVG.

## Global Constraints

- The approved aged-paper mock is the visual contract.
- The masthead may be decorative and not machine readable; essay and commentary text must remain accessible and selectable.
- The Independent Journal is the consistent masthead identity; original venue and publication date remain visible as text.
- Gazette mode uses three columns only when readable, two at intermediate widths, and exactly one on mobile.
- Existing local read state, navigation, content, paper-wear fingerprints, Reader mode, and static AWS-compatible output must continue to work.
- Functional touch targets remain at least 44 by 44 CSS pixels.
- Do not introduce raster masthead assets or remote font dependencies.

---

### Task 1: Paper display helpers

**Files:**
- Create: `src/lib/paper-display.ts`
- Create: `tests/paper-display.test.ts`

**Interfaces:**
- Produces: `toRomanNumeral(number: number): string`
- Produces: `formatIssueDateline(publicationDate: string, publicationKind: 'newspaper' | 'book'): string`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatIssueDateline, toRomanNumeral } from '../src/lib/paper-display';

describe('paper display helpers', () => {
  it('formats every supported paper number as an uppercase Roman numeral', () => {
    expect(toRomanNumeral(1)).toBe('I');
    expect(toRomanNumeral(10)).toBe('X');
    expect(toRomanNumeral(51)).toBe('LI');
    expect(toRomanNumeral(85)).toBe('LXXXV');
    expect(() => toRomanNumeral(0)).toThrow(/1 through 85/);
    expect(() => toRomanNumeral(86)).toThrow(/1 through 85/);
  });

  it('formats newspaper dates as New-York issue lines', () => {
    expect(formatIssueDateline('1787-10-27', 'newspaper')).toBe('New-York, Saturday, October 27, 1787');
  });

  it('labels first publication in the bound edition honestly', () => {
    expect(formatIssueDateline('1788-05-28', 'book')).toBe('New-York · First collected May 28, 1788');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm test tests/paper-display.test.ts`

Expected: FAIL because `src/lib/paper-display.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

```ts
const ROMAN_NUMERALS = [
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
] as const;

export function toRomanNumeral(number: number) {
  if (!Number.isInteger(number) || number < 1 || number > 85) {
    throw new RangeError('Paper number must be an integer from 1 through 85.');
  }
  let remaining = number;
  let result = '';
  for (const [value, glyph] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += glyph;
      remaining -= value;
    }
  }
  return result;
}

export function formatIssueDateline(publicationDate: string, publicationKind: 'newspaper' | 'book') {
  const date = new Date(`${publicationDate}T12:00:00Z`);
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(date);
  if (publicationKind === 'book') return `New-York · First collected ${monthDayYear}`;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
  return `New-York, ${weekday}, ${monthDayYear}`;
}
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run: `pnpm test tests/paper-display.test.ts`

Expected: 3 passing tests.

- [ ] **Step 5: Commit the helper contract**

```bash
git add src/lib/paper-display.ts tests/paper-display.test.ts
git commit -m "feat: add period paper display helpers"
```

---

### Task 2: Generated vector masthead

**Files:**
- Create: `scripts/generate-masthead.mjs`
- Create: `tests/masthead-art.test.ts`
- Create: `public/masthead-independent-journal.svg`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff`
- Produces: `buildMastheadSvg(font): string`
- Produces: `/masthead-independent-journal.svg`, a path-only decorative SVG with a `0 0 1200 190` responsive viewBox.

- [ ] **Step 1: Add the failing SVG contract test**

```ts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildMastheadSvg } from '../scripts/generate-masthead.mjs';

describe('Independent Journal masthead artwork', () => {
  it('generates vector outlines instead of machine-readable SVG text', async () => {
    const { default: opentype } = await import('opentype.js');
    const fontPath = new URL('../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff', import.meta.url);
    const font = await opentype.load(fileURLToPath(fontPath));
    const svg = buildMastheadSvg(font);
    expect(svg).toContain('viewBox="0 0 1200 190"');
    expect(svg).toContain('<path');
    expect(svg).toContain('<line');
    expect(svg).not.toContain('<text');
  });

  it('commits the generated asset used by the site', async () => {
    const svg = await readFile(new URL('../public/masthead-independent-journal.svg', import.meta.url), 'utf8');
    expect(svg).toContain('data-masthead-art="independent-journal"');
    expect(svg).not.toContain('<text');
  });
});
```

- [ ] **Step 2: Install the local font and outline generator, then verify RED**

Run: `pnpm add @fontsource/libre-caslon-display@5.2.7 && pnpm add -D opentype.js@1.3.4`

Run: `pnpm test tests/masthead-art.test.ts`

Expected: FAIL because the generator module and committed asset do not exist.

- [ ] **Step 3: Implement the generator**

Add `"generate:masthead": "node scripts/generate-masthead.mjs"` to `package.json`, then create:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const WIDTH = 1200;

function measureRun(font, text, size, spacing) {
  return [...text].reduce((width, character, index) => {
    const glyph = font.charToGlyph(character);
    const advance = ((glyph.advanceWidth ?? font.unitsPerEm / 2) / font.unitsPerEm) * size;
    return width + advance + (index === text.length - 1 ? 0 : spacing);
  }, 0);
}

function outlineRun(font, text, y, size, spacing) {
  let x = (WIDTH - measureRun(font, text, size, spacing)) / 2;
  let data = '';
  for (const character of text) {
    const glyph = font.charToGlyph(character);
    data += glyph.getPath(x, y, size).toPathData(2);
    x += ((glyph.advanceWidth ?? font.unitsPerEm / 2) / font.unitsPerEm) * size + spacing;
  }
  return data;
}

export function buildMastheadSvg(font) {
  const title = outlineRun(font, 'THE INDEPENDENT JOURNAL', 103, 76, 6.5);
  const subtitle = outlineRun(font, 'OR, THE GENERAL ADVERTISER', 159, 24, 7);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 190" data-masthead-art="independent-journal"><g fill="#28241f"><path d="${title}"/><path d="${subtitle}"/></g><g fill="#28241f" stroke="#28241f" stroke-width="1.5"><line x1="112" y1="151" x2="340" y2="151"/><path d="M356 151l8-3v6zM372 151l-8-3v6z"/><line x1="388" y1="151" x2="421" y2="151"/><line x1="779" y1="151" x2="812" y2="151"/><path d="M828 151l8-3v6zM844 151l-8-3v6z"/><line x1="860" y1="151" x2="1088" y2="151"/></g></svg>\n`;
}

async function generate() {
  const fontPath = fileURLToPath(new URL('../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff', import.meta.url));
  const outputPath = fileURLToPath(new URL('../public/masthead-independent-journal.svg', import.meta.url));
  const font = await opentype.load(fontPath);
  await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
  await writeFile(outputPath, buildMastheadSvg(font), 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await generate();
```

- [ ] **Step 4: Generate the asset and verify GREEN**

Run: `pnpm generate:masthead`

Run: `pnpm test tests/masthead-art.test.ts`

Expected: 2 passing tests.

- [ ] **Step 5: Commit the reproducible artwork**

```bash
git add package.json pnpm-lock.yaml scripts/generate-masthead.mjs tests/masthead-art.test.ts public/masthead-independent-journal.svg
git commit -m "feat: add engraved Independent Journal masthead"
```

---

### Task 3: Newspaper hierarchy and semantic publication metadata

**Files:**
- Modify: `tests/paper-page.test.ts`
- Modify: `tests/shell.test.ts`
- Modify: `src/components/GazetteMasthead.astro`
- Modify: `src/layouts/PaperLayout.astro`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `toRomanNumeral` and `formatIssueDateline` from Task 1.
- Consumes: `/masthead-independent-journal.svg` from Task 2.
- Produces: `.gazette-masthead__art`, `.gazette-masthead__dateline`, `.essay-heading__title`, `.essay-heading__ornament`, and `.essay-heading__publication` hooks.

- [ ] **Step 1: Tighten the static rendering tests**

Add assertions that Paper No. 1 contains:

```ts
expect(html).toContain('src="/masthead-independent-journal.svg"');
expect(html).toContain('alt=""');
expect(html).toContain('THE FEDERALIST.');
expect(html).toContain('No. I');
expect(html).toContain('PUBLIUS');
expect(html).toContain('For the Independent Journal. Saturday, October 27, 1787');
```

Change the shell test to assert the SVG path rather than requiring live masthead text.

- [ ] **Step 2: Run build-backed tests and verify RED**

Run: `pnpm build && pnpm test tests/paper-page.test.ts tests/shell.test.ts`

Expected: FAIL because the current masthead and heading markup do not satisfy the new contract.

- [ ] **Step 3: Rebuild the masthead and essay heading markup**

`GazetteMasthead.astro` renders the decorative SVG image, double issue rules, and the dynamic dateline. `PaperLayout.astro` imports the display helpers and renders:

```astro
<GazetteMasthead dateLine={formatIssueDateline(data.publicationDate, data.publicationKind)} />
<header class="essay-heading">
  <h1 class="essay-heading__title">
    <span>The Federalist.</span> <span class="essay-heading__number">No. {toRomanNumeral(data.number)}.</span>
  </h1>
  <p class="essay-heading__recipient">{data.recipient}</p>
  <span class="essay-heading__ornament" aria-hidden="true"></span>
  <p class="essay-heading__byline">Publius</p>
  <p class="essay-heading__author">{data.author}</p>
  <p class="essay-heading__publication">{data.publicationDateLabel}</p>
</header>
```

Import Libre Caslon Display in `BaseLayout.astro` for the essay display hierarchy. Keep the full essay and original venue as server-rendered text.

- [ ] **Step 4: Rebuild and verify GREEN**

Run: `pnpm build && pnpm test tests/paper-page.test.ts tests/shell.test.ts tests/paper-display.test.ts tests/masthead-art.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit the semantic hierarchy**

```bash
git add src/components/GazetteMasthead.astro src/layouts/PaperLayout.astro src/layouts/BaseLayout.astro tests/paper-page.test.ts tests/shell.test.ts
git commit -m "feat: compose authentic paper masthead and heading"
```

---

### Task 4: Mock-faithful Gazette typography and composition

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/styles/paper.css`
- Modify: `tests/e2e/reader.spec.ts`

**Interfaces:**
- Consumes the class hooks created in Task 3.
- Preserves `[data-reading-mode='gazette']` and `[data-reading-mode='reader']` behavior.

- [ ] **Step 1: Add failing layout assertions**

Extend the Playwright reader tests to assert at 1280px that the masthead artwork is visible, the essay body has three columns, the title uses Libre Caslon Display, the Gazette body leading is no looser than `1.45`, and the title block is materially shorter than the previous hero-like treatment. At 390px assert a single column, a masthead width within the viewport, no horizontal overflow, and touch targets at least 44px high.

```ts
expect(await page.locator('.gazette-masthead__art').isVisible()).toBe(true);
expect(metrics.columnCount).toBe('3');
expect(metrics.titleFontFamily).toContain('Libre Caslon Display');
expect(metrics.bodyLineHeight / metrics.bodyFontSize).toBeLessThanOrEqual(1.45);
expect(metrics.headingHeight).toBeLessThan(240);
```

- [ ] **Step 2: Run the focused E2E test and verify RED**

Run: `pnpm test:e2e tests/e2e/reader.spec.ts`

Expected: FAIL on the new masthead, typeface, leading, or height assertions.

- [ ] **Step 3: Implement the mock-faithful CSS system**

Update shared tokens and Gazette rules so that:

- `--font-display` is Libre Caslon Display with Libre Caslon Text fallback;
- the SVG masthead is centered at a controlled maximum width and never stretched;
- subtitle ornament and dateline rules match the mock's hairline/double-rule rhythm;
- Gazette controls use outlined paper buttons, verdigris active state, and oxblood progress state;
- the essay title is a compact high-contrast Roman line rather than a hero heading;
- recipient, Publius, author, and publication metadata are tightly grouped;
- the first drop cap is verdigris;
- desktop body leading is approximately `1.38`, hyphenation is enabled, and column gaps/rules match the mock;
- commentary becomes a horizontal ruled companion section at wide widths and remains naturally stacked on mobile;
- unique wear remains outside text and is visually subordinate to type;
- Reader mode retains a relaxed `1.68` line height and approximately 68-character measure;
- mobile uses one column, a compact masthead, readable 17px body type, and 44px controls.

- [ ] **Step 4: Run focused browser tests and verify GREEN**

Run: `pnpm test:e2e tests/e2e/reader.spec.ts`

Expected: all reader E2E tests pass at desktop and mobile widths.

- [ ] **Step 5: Commit the visual system**

```bash
git add src/styles/global.css src/styles/paper.css tests/e2e/reader.spec.ts
git commit -m "style: match approved Federalist newspaper mock"
```

---

### Task 5: Visual, accessibility, and regression verification

**Files:**
- Modify only if verification identifies a failing contract in the files already touched.

**Interfaces:**
- Verifies the complete shared paper template and does not add new product behavior.

- [ ] **Step 1: Build and run the complete automated suite**

Run: `pnpm check`

Expected: Astro check, content validation, static build, and all Vitest tests pass with no warnings.

Run: `pnpm test:e2e`

Expected: all Playwright tests pass, including axe accessibility checks.

- [ ] **Step 2: Capture reference-width screenshots**

Use Playwright against Paper No. 1 to capture:

```text
/tmp/federalist-paper-1-desktop.png at 1536×1000
/tmp/federalist-paper-1-mobile.png at 390×844
```

Compare both directly to the approved mock. Inspect masthead scale, title compactness, rules, column start, body density, toolbar alignment, paper wear, and mobile single-column behavior.

- [ ] **Step 3: Inspect representative papers and reading states**

Open Papers 1, 10, 51, 78, and 85 in Gazette mode, then verify Paper 1 in Reader mode. Confirm the book-publication dateline on Papers 78–85 is honest, long titles wrap without collision, and all navigation remains usable.

- [ ] **Step 4: Run final repository checks**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors; only intentional implementation changes are present before the final commit.

- [ ] **Step 5: Commit any verification corrections**

If corrections were required, commit only the already scoped implementation files:

```bash
git add src/components/GazetteMasthead.astro src/layouts/BaseLayout.astro src/layouts/PaperLayout.astro src/styles/global.css src/styles/paper.css tests/e2e/reader.spec.ts tests/paper-page.test.ts tests/shell.test.ts
git commit -m "fix: refine newspaper fidelity across breakpoints"
```

If no corrections were required, do not create an empty commit.
