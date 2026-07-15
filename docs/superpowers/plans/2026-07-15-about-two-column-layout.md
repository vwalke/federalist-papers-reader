# About Page Two-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose `/about/` as the approved two-column family feature on wide screens while retaining a linear, comfortable single-column page on mobile, at 200% zoom, and in print.

**Architecture:** Replace the monolithic `.about-copy` wrapper with semantic headline, origin, family, and closing-notes zones. Use explicit CSS Grid at `56rem` and above because the page contains discrete editorial units; preserve meaningful DOM order and use a configurable Playwright port so the isolated worktree can be tested without stopping the persistent `main` review server.

**Tech Stack:** Astro 7, CSS Grid, TypeScript 5.9, Vitest 4, Playwright 1.61, pnpm 10

## Global Constraints

- Preserve every word, outbound link, disclosure, photo attribute, and caption currently rendered on `/about/`.
- Source order must remain headline → introduction → portrait → LetterJoy → Charles Thomson → edition notes → privacy.
- Use no CSS `order`, JavaScript reordering, new dependency, new image, photo crop, or new animation.
- Keep `/about/` one column below `56rem`, at 200% zoom, and in print.
- Use at most two wide columns; do not reproduce the essays' three narrow columns.
- Scope the small-caps kicker change to `.about-page .section-kicker`; do not alter the home-page kicker.
- Retain the existing portrait mat and replace the LetterJoy side stripe with a full border and fine double top rule.
- Keep the existing `main` review server on port `4321` running throughout feature work.
- Preserve the user's untracked `docs/about-two-column-roadmap.md` without adding, editing, or deleting it.

---

### Task 1: Introduce semantic About-page zones

**Files:**
- Modify: `tests/about-page.test.ts`
- Modify: `src/pages/about.astro`

**Interfaces:**
- Consumes: The existing `/about/` content and static `dist/about/index.html` artifact.
- Produces: `.about-page`, `.about-lead`, `.about-origin`, `.about-origin__copy`, `.about-family`, `.about-family__copy`, `.about-notes`, and `.about-notes__privacy` markup contracts for Task 2.

- [ ] **Step 1: Add failing static-output assertions for the new zones and source order**

In `tests/about-page.test.ts`, add the following assertions after the LetterJoy-series assertion and retain every existing content/source/image assertion:

```ts
    expect(html).toContain('class="paper-sheet about-page"');
    expect(html).toContain('class="about-lead"');
    expect(html).toContain('class="about-origin"');
    expect(html).toContain('class="about-origin__copy"');
    expect(html).toContain('class="about-family"');
    expect(html).toContain('class="about-family__copy"');
    expect(html).toContain('class="about-notes"');
    expect(html).toContain('class="about-notes__privacy"');

    const introductionIndex = html.indexOf('class="about-origin__copy"');
    const portraitIndex = html.indexOf('class="about-portrait"');
    const letterJoyIndex = html.indexOf('class="about-callout"');
    const familyIndex = html.indexOf('class="about-family"');
    const notesIndex = html.indexOf('class="about-notes"');

    expect(introductionIndex).toBeGreaterThan(-1);
    expect(introductionIndex).toBeLessThan(portraitIndex);
    expect(portraitIndex).toBeLessThan(letterJoyIndex);
    expect(letterJoyIndex).toBeLessThan(familyIndex);
    expect(familyIndex).toBeLessThan(notesIndex);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm vitest run tests/about-page.test.ts
```

Expected: FAIL because the current built page does not contain `class="paper-sheet about-page"`.

- [ ] **Step 3: Replace the About-page article with the approved semantic zones**

In `src/pages/about.astro`, replace the current `<article class="paper-sheet">…</article>` with this complete article:

```astro
  <article class="paper-sheet about-page">
    <GazetteMasthead compact dateLine="A note to the reader" />

    <header class="about-lead">
      <p class="section-kicker">About this edition</p>
      <h1>A conversation with my mom, one paper at a time.</h1>
    </header>

    <div class="about-origin">
      <div class="about-origin__copy">
        <p class="about-lede">
          This edition began with a gift for my mom. I gave her a subscription to LetterJoy’s
          Federalist Papers series, which sends one paper each week on 1780s-inspired newsprint. As
          she opened them at home, I started following along online.
        </p>
        <p>
          What might have become a dutiful march through a famous book became something much better:
          a standing conversation between us. The weekly rhythm makes each argument feel less like a
          monument and more like what it first was—a public letter meant to be read, considered, and
          talked over.
        </p>
      </div>

      <figure class="about-portrait">
        <div class="about-portrait__mat">
          <img
            class="about-portrait__image"
            src="/images/mom-and-me-sail4th-2026.jpg"
            alt="Mom and me together at Sail4th 250 in New York Harbor"
            width="1200"
            height="1600"
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption class="about-portrait__caption">
          <strong>Mom and me</strong>
          <span>July 4, 2026 · Sail4th 250, New York Harbor</span>
        </figcaption>
      </figure>

      <aside class="about-callout" aria-labelledby="letterjoy-heading">
        <p class="section-kicker">The gift that started it</p>
        <h2 id="letterjoy-heading">History worth looking for in the mailbox</h2>
        <p>
          LetterJoy turns historic writing into something tactile and wonderfully anticipatory.
          Their Federalist Papers series is beautifully made, paced one essay at a time, and—quite
          honestly—a very cool gift for someone who enjoys history.
        </p>
        <p>
          <a class="about-callout__link" href="https://www.letterjoy.co/pages/federalist-papers">
            See LetterJoy’s Federalist Papers series <span aria-hidden="true">↗</span>
          </a>
        </p>
        <p class="about-callout__disclosure">
          This independent reading companion is not affiliated with LetterJoy; it was inspired by
          the experience their mailed edition created for our family.
        </p>
      </aside>
    </div>

    <section class="about-family" aria-labelledby="family-heading">
      <h2 id="family-heading">A family thread through the founding</h2>
      <div class="about-family__copy">
        <p>
          The reading has another personal connection. Charles Thomson was my sixth-great-uncle—my
          mom’s fifth-great-uncle.{' '}
          <a href="https://www.carpentershall.org/pages/my-zeal-for-liberty">
            At ten years old, he arrived in America with no parents and no money.
          </a>{' '}
          His mother had died in Ireland; his father died during the Atlantic crossing, and the
          brothers were separated after they landed. From that beginning, Thomson rose to become{' '}
          <a href="https://www.loc.gov/collections/continental-congress-and-constitutional-convention-from-1774-to-1789/articles-and-essays/to-form-a-more-perfect-union/charles-thomson/">
            the only Secretary of the Continental Congress
          </a>
          , serving from its first meeting in 1774 until the new federal government began in 1789.
        </p>
        <p>
          <a href="https://www.archives.gov/founding-docs/declaration-history">
            Thomson’s and John Hancock’s were the two names printed on the Dunlap broadside—the
            Declaration of Independence’s first published form
          </a>
          , dispatched throughout the states and to Washington’s army before the famous parchment
          was engrossed and signed. The parchment became the enduring national icon; Thomson’s
          attestation appeared on the version that first carried independence into American public
          life.
        </p>
        <p>
          And that was only one chapter. Thomson{' '}
          <a href="https://diplomacy.state.gov/the-great-seal/">
            helped bring the Great Seal of the United States to its final design
          </a>
          ,{' '}
          <a href="https://founders.archives.gov/documents/Washington/05-02-02-0056">
            personally carried word of George Washington’s unanimous election to Mount Vernon
          </a>
          , and later spent nearly twenty years{' '}
          <a href="https://collections.museumofthebible.org/artifacts/45021-thomson-bible?theme=a-history-of-translation">
            translating the Septuagint Bible from Greek into English—the first published English
            translation of the ancient Greek Old Testament.
          </a>{' '}
          The penniless ten-year-old orphan grew into a man who helped give the new nation its public
          words, its emblem, and its institutional memory. That is a remarkable family thread for my
          mom and me to feel as we read these arguments together.
        </p>
      </div>
    </section>

    <div class="about-notes">
      <section aria-labelledby="words-heading">
        <h2 id="words-heading">Their words, clearly set</h2>
        <p>
          The essays retain their original wording. Modern type, comfortable spacing, and a clean
          Reader option make them easier on contemporary eyes. The newspaper view is atmosphere,
          not a claim that every rule and column exactly reproduces one historic printing.
        </p>
      </section>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading">A companion, not a lecture</h2>
        <p>
          Each paper has a short plain-language note: the argument in a nutshell, its key moves,
          why it mattered, and a question worth discussing. Historical details appear when they add
          color or make the stakes clearer—not simply because they are available.
        </p>
      </section>

      <section class="about-notes__privacy" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">No account, no tracking your reading</h2>
        <p>
          Marking a paper read saves that fact only in this browser. It will not follow you to a new
          device, and clearing browser storage clears the record. The essays and navigation remain
          available if storage or JavaScript is disabled.
        </p>
      </section>
    </div>
  </article>
```

- [ ] **Step 4: Build and verify GREEN with the focused test**

Run:

```bash
pnpm build && pnpm vitest run tests/about-page.test.ts
```

Expected: Astro builds 88 pages and the About-page test passes.

- [ ] **Step 5: Commit the semantic restructure**

```bash
git add src/pages/about.astro tests/about-page.test.ts
git commit -m "refactor: divide about page into editorial zones"
```

---

### Task 2: Implement and verify the responsive two-column composition

**Files:**
- Modify: `playwright.config.ts`
- Create: `tests/e2e/about.spec.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: The zone classes created by Task 1 and the existing layout/color/spacing/font tokens from `src/styles/global.css`.
- Produces: A two-column origin feature, heading-rail family bridge, two-column notes band, linear mobile/print fallbacks, and `PLAYWRIGHT_PORT` support for isolated browser testing.

- [ ] **Step 1: Make the Playwright preview port configurable**

Replace `playwright.config.ts` with:

```ts
import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '4321';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
});
```

- [ ] **Step 2: Write the failing responsive and print browser tests**

Create `tests/e2e/about.spec.ts` with:

```ts
import { expect, test } from '@playwright/test';

test('composes the About story as an editorial grid on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/about/');

  const layout = await page.locator('.about-page').evaluate((about) => {
    const box = (selector: string) => {
      const element = about.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };

    const noteBoxes = [...about.querySelectorAll('.about-notes > section')].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });

    return {
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      familyDisplay: getComputedStyle(about.querySelector('.about-family') as Element).display,
      notesDisplay: getComputedStyle(about.querySelector('.about-notes') as Element).display,
      copy: box('.about-origin__copy'),
      portrait: box('.about-portrait'),
      callout: box('.about-callout'),
      familyHeading: box('.about-family > h2'),
      familyCopy: box('.about-family__copy'),
      noteBoxes,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(layout.originDisplay).toBe('grid');
  expect(layout.familyDisplay).toBe('grid');
  expect(layout.notesDisplay).toBe('grid');
  expect(layout.copy.x).toBeLessThan(layout.portrait.x);
  expect(Math.abs(layout.copy.x - layout.callout.x)).toBeLessThan(2);
  expect(layout.callout.y).toBeGreaterThan(layout.copy.y);
  expect(layout.familyHeading.x).toBeLessThan(layout.familyCopy.x);
  expect(layout.noteBoxes).toHaveLength(3);
  expect(Math.abs(layout.noteBoxes[0].y - layout.noteBoxes[1].y)).toBeLessThan(2);
  expect(layout.noteBoxes[2].y).toBeGreaterThan(layout.noteBoxes[0].y);
  expect(layout.noteBoxes[2].width).toBeGreaterThan(layout.noteBoxes[0].width * 1.75);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('keeps the About story linear and roomy on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about/');

  const layout = await page.locator('.about-page').evaluate((about) => {
    const selectors = [
      '.about-origin__copy',
      '.about-portrait',
      '.about-callout',
      '.about-family',
      '.about-notes'
    ];
    const boxes = selectors.map((selector) => {
      const element = about.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    const noteYPositions = [...about.querySelectorAll('.about-notes > section')].map(
      (element) => element.getBoundingClientRect().y
    );

    return {
      boxes,
      noteYPositions,
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(layout.originDisplay).toBe('block');
  expect(Math.max(...layout.boxes.map(({ x }) => x)) - Math.min(...layout.boxes.map(({ x }) => x))).toBeLessThan(5);
  expect(Math.min(...layout.boxes.map(({ width }) => width))).toBeGreaterThan(330);
  expect(layout.boxes[0].y).toBeLessThan(layout.boxes[1].y);
  expect(layout.boxes[1].y).toBeLessThan(layout.boxes[2].y);
  expect(layout.boxes[2].y).toBeLessThan(layout.boxes[3].y);
  expect(layout.boxes[3].y).toBeLessThan(layout.boxes[4].y);
  expect(layout.noteYPositions[0]).toBeLessThan(layout.noteYPositions[1]);
  expect(layout.noteYPositions[1]).toBeLessThan(layout.noteYPositions[2]);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('waits for a comfortable measure before enabling the grids', async ({ page }) => {
  await page.setViewportSize({ width: 880, height: 900 });
  await page.goto('/about/');

  const displays = await page.locator('.about-page').evaluate((about) => ({
    origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
    family: getComputedStyle(about.querySelector('.about-family') as Element).display,
    notes: getComputedStyle(about.querySelector('.about-notes') as Element).display,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));

  expect(displays.origin).toBe('block');
  expect(displays.family).toBe('block');
  expect(displays.notes).toBe('block');
  expect(displays.overflow).toBeLessThanOrEqual(0);
});

test('prints the About page in one column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/about/');
  await page.emulateMedia({ media: 'print' });

  const printLayout = await page.locator('.about-page').evaluate((about) => {
    const secondNote = about.querySelector('.about-notes > section:nth-child(2)') as Element;
    return {
      origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      family: getComputedStyle(about.querySelector('.about-family') as Element).display,
      notes: getComputedStyle(about.querySelector('.about-notes') as Element).display,
      secondNoteDivider: getComputedStyle(secondNote).borderInlineStartWidth
    };
  });

  expect(printLayout.origin).toBe('block');
  expect(printLayout.family).toBe('block');
  expect(printLayout.notes).toBe('block');
  expect(printLayout.secondNoteDivider).toBe('0px');
});
```

- [ ] **Step 3: Run the focused browser suite and verify RED**

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: FAIL in the wide-screen test because `.about-origin` currently computes to `block`, not `grid`.

- [ ] **Step 4: Replace the legacy About selectors and add the approved layout CSS**

In `src/styles/global.css`:

1. Change `.home-intro h1, .about-copy h1` to `.home-intro h1, .about-lead h1`.
2. Change `.home-note, .about-copy { margin-block-start: var(--space-2xl); }` to `.home-note { margin-block-start: var(--space-2xl); }`.
3. Change `.home-note h2, .about-copy h2` to `.home-note h2`.
4. Change `.home-note p, .about-copy p, .about-copy li` to `.home-note p`.
5. Delete the legacy block from `.about-copy {` through `.about-callout__disclosure { … }` and insert this complete replacement after `.home-note p`:

```css
.about-lead,
.about-origin,
.about-family,
.about-notes {
  margin-inline: auto;
}

.about-lead {
  max-inline-size: 58rem;
  margin-block-start: var(--space-2xl);
}

.about-lead h1 {
  max-inline-size: 15ch;
  margin-block-start: var(--space-sm);
  font: 400 clamp(2.1rem, 6vw, 4.8rem)/0.98 var(--font-display);
  text-wrap: balance;
}

.about-page .section-kicker {
  font-family: var(--font-reading);
  font-variant-caps: small-caps;
  letter-spacing: 0.13em;
}

.about-page h2 {
  font: 400 clamp(1.6rem, 3vw, 2.25rem)/1.1 var(--font-display);
  text-wrap: balance;
}

.about-page p,
.about-page li {
  font-size: 1.0625rem;
  line-height: 1.65;
  text-wrap: pretty;
}

.about-origin,
.about-family,
.about-notes {
  max-inline-size: 74rem;
}

.about-origin {
  margin-block-start: var(--space-xl);
}

.about-origin__copy {
  max-inline-size: 55ch;
}

.about-origin__copy p + p,
.about-family__copy p + p,
.about-callout h2 + p,
.about-callout p + p,
.about-notes h2 + p {
  margin-block-start: var(--space-md);
}

.about-family > h2 + .about-family__copy {
  margin-block-start: var(--space-md);
}

.about-lede {
  font-size: clamp(1.15rem, 2vw, 1.35rem) !important;
  line-height: 1.55 !important;
}

.about-portrait {
  inline-size: min(100% - 0.5rem, 34rem);
  margin: var(--space-xl) auto 0;
}

.about-portrait__mat {
  padding: clamp(0.55rem, 2vw, 0.9rem);
  border: 1px solid var(--color-ink);
  background: color-mix(in oklab, var(--color-paper) 82%, var(--color-newsprint));
  box-shadow: 0.45rem 0.55rem 0 color-mix(in oklab, var(--color-ink) 18%, transparent);
}

.about-portrait__image {
  display: block;
  inline-size: 100%;
  block-size: auto;
  border: 1px solid var(--color-oxblood);
}

.about-portrait__caption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.25rem var(--space-md);
  padding: var(--space-sm) 0 0;
  color: var(--color-muted-ink);
  font: 600 0.72rem/1.4 var(--font-utility);
  letter-spacing: 0.04em;
}

.about-portrait__caption strong {
  color: var(--color-oxblood);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-callout {
  margin-block-start: var(--space-xl);
  padding: clamp(1.25rem, 4vw, 2rem);
  border: 1px solid var(--color-rule);
  border-block-start: 3px double var(--color-verdigris);
  background: color-mix(in oklab, var(--color-paper) 62%, transparent);
}

.about-callout h2 {
  max-inline-size: 22ch;
  margin-block-start: var(--space-xs);
}

.about-callout__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding-block-end: 0.18rem;
  color: var(--color-verdigris);
  font-weight: 700;
  text-decoration-thickness: 0.1em;
}

.about-callout__disclosure {
  color: var(--color-muted-ink);
  font: 500 0.78rem/1.5 var(--font-utility) !important;
}

.about-family {
  margin-block-start: var(--space-2xl);
  padding-block: var(--space-xl);
  border-block: 1px solid var(--color-rule);
}

.about-family__copy {
  max-inline-size: 70ch;
}

.about-notes {
  margin-block-start: var(--space-2xl);
}

.about-notes > section {
  padding-block-start: var(--space-xl);
  border-block-start: 1px solid var(--color-rule);
}

.about-notes > section + section {
  margin-block-start: var(--space-xl);
}

@media (min-width: 56rem) {
  .about-origin {
    display: grid;
    grid-template-areas:
      'copy portrait'
      'callout portrait';
    grid-template-columns: minmax(0, 1.15fr) minmax(19rem, 0.85fr);
    gap: var(--space-xl) clamp(var(--space-xl), 4vw, var(--space-2xl));
    align-items: start;
  }

  .about-origin__copy {
    grid-area: copy;
  }

  .about-portrait {
    grid-area: portrait;
    inline-size: 100%;
    max-inline-size: 28rem;
    margin: 0;
    justify-self: end;
  }

  .about-callout {
    grid-area: callout;
    align-self: end;
    margin: 0;
  }

  .about-family {
    display: grid;
    grid-template-columns: minmax(12rem, 0.42fr) minmax(0, 1.58fr);
    gap: clamp(var(--space-xl), 4vw, var(--space-2xl));
    align-items: start;
  }

  .about-family > h2 {
    max-inline-size: 13ch;
  }

  .about-family > h2 + .about-family__copy {
    margin-block-start: 0;
  }

  .about-notes {
    --about-column-gap: clamp(var(--space-lg), 3vw, var(--space-xl));
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .about-notes > section {
    margin: 0;
    padding-block-start: 0;
    border-block-start: 0;
  }

  .about-notes > section:first-child {
    padding-inline-end: var(--about-column-gap);
  }

  .about-notes > section:nth-child(2) {
    padding-inline-start: var(--about-column-gap);
    border-inline-start: 1px solid color-mix(in oklab, var(--color-rule) 62%, transparent);
  }

  .about-notes > .about-notes__privacy {
    grid-column: 1 / -1;
    margin-block-start: var(--space-xl);
    padding-block-start: var(--space-xl);
    border-block-start: 1px solid var(--color-rule);
  }
}
```

6. Remove the obsolete mobile `.about-portrait` width override; retain the mobile caption grid override:

```css
  .about-portrait__caption {
    display: grid;
  }
```

7. Append these About rules inside the existing `@media print` block:

```css
  .about-origin,
  .about-family,
  .about-notes {
    display: block;
    max-inline-size: none;
  }

  .about-origin__copy,
  .about-family__copy {
    max-inline-size: none;
  }

  .about-portrait {
    max-inline-size: 24rem;
    break-inside: avoid;
  }

  .about-callout,
  .about-family,
  .about-notes > section {
    break-inside: avoid;
  }

  .about-notes > section,
  .about-notes > section:first-child,
  .about-notes > section:nth-child(2),
  .about-notes > .about-notes__privacy {
    margin-block-start: var(--space-lg);
    padding: var(--space-lg) 0 0;
    border: 0;
    border-block-start: 1px solid var(--color-rule);
  }
```

- [ ] **Step 5: Run the focused browser suite and verify GREEN**

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: all four About layout tests pass.

- [ ] **Step 6: Run the full automated verification**

Run:

```bash
pnpm check
```

Expected: Astro reports zero diagnostics, 88 pages build, and all Vitest tests pass.

Run with localhost permission:

```bash
PLAYWRIGHT_PORT=4322 pnpm test:e2e
```

Expected: all existing Playwright tests plus the four new About layout tests pass.

- [ ] **Step 7: Re-run the mechanical layout scan**

Run:

```bash
node '/Users/vwalke/.codex/plugins/cache/impeccable/impeccable/3.9.1/skills/impeccable/scripts/detect.mjs' --json --scope layout src/pages/about.astro src/styles/global.css
```

Expected: `[]`.

Run:

```bash
rg -n 'gap-\[|p[trblxy]?-\[|m[trblxy]?-\[|z-\[' src/pages/about.astro src/styles/global.css
```

Expected: no matches.

- [ ] **Step 8: Inspect the worktree page in a browser at the required widths**

Start or reuse the worktree server on port `4322`, then inspect `/about/` at `320`, `390`, `768`, `896`, `1280`, and `1440` CSS pixels. At each width record the `.about-page` document overflow and confirm it is `0` or less. At `896px` and above confirm the portrait balances the introduction/LetterJoy column, the Charles prose remains comfortable, and the privacy strip spans the notes grid. At narrower widths confirm introduction → portrait → LetterJoy → family → notes order.

Set the browser to 200% zoom at a desktop window and confirm the composition collapses to one column without clipping. Inspect print preview and confirm all zones are one column.

- [ ] **Step 9: Commit the responsive layout and tests**

```bash
git add playwright.config.ts tests/e2e/about.spec.ts src/styles/global.css
git commit -m "feat: compose about page in two columns"
```
