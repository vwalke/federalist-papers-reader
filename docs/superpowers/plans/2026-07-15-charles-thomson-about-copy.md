# Charles Thomson About Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the About page's understated Charles Thomson passage with the approved inspiring three-paragraph profile and unobtrusive historical links.

**Architecture:** Keep the change inside the existing About page section and its focused static-output test. The Astro page continues to own the prose and links; the Vitest assertion reads the built HTML so it verifies both the visible copy and the rendered citation destinations.

**Tech Stack:** Astro 7, TypeScript, Vitest 4, Playwright 1.61, pnpm 10

## Global Constraints

- Keep the existing heading, typography, spacing, and About-page layout.
- Use three paragraphs and plain language suitable for a curious twelve-year-old.
- Include the phrases “Septuagint Bible” and “from Greek into English.”
- Treat Thomson's Declaration role affirmatively and do not claim Congress sent a copy directly to King George III.
- Attach citations to natural phrases in the prose; do not add a footnote block.
- Keep the existing localhost review server running.

---

### Task 1: Replace and verify the Charles Thomson mini-profile

**Files:**
- Modify: `tests/about-page.test.ts`
- Modify: `src/pages/about.astro`

**Interfaces:**
- Consumes: Astro's existing `/about/` static route and the `dist/about/index.html` artifact produced by `pnpm build`.
- Produces: Three rendered paragraphs under `#family-heading`, with historical source URLs embedded as standard anchor `href` attributes.

- [ ] **Step 1: Write the failing copy-and-citation assertions**

Replace the old Thomson-specific assertions in `tests/about-page.test.ts` with:

```ts
    expect(html).toContain('At ten years old, he arrived in America with no parents and no money.');
    expect(html).toContain('the only Secretary of the Continental Congress');
    expect(html).toContain('the two names printed on the Dunlap broadside');
    expect(html).toContain('first carried independence into American public life');
    expect(html).toContain('helped bring the Great Seal of the United States to its final design');
    expect(html).toContain('personally carried word of George Washington’s unanimous election');
    expect(html).toContain('translating the Septuagint Bible from Greek into English');
    expect(html).toContain('The penniless ten-year-old orphan grew into a man');
    expect(html).not.toContain('his was the quieter role');
    expect(html).toContain('href="https://www.carpentershall.org/pages/my-zeal-for-liberty"');
    expect(html).toContain('href="https://www.loc.gov/collections/continental-congress-and-constitutional-convention-from-1774-to-1789/articles-and-essays/to-form-a-more-perfect-union/charles-thomson/"');
    expect(html).toContain('href="https://www.archives.gov/founding-docs/declaration-history"');
    expect(html).toContain('href="https://diplomacy.state.gov/the-great-seal/"');
    expect(html).toContain('href="https://founders.archives.gov/documents/Washington/05-02-02-0056"');
    expect(html).toContain('href="https://collections.museumofthebible.org/artifacts/45021-thomson-bible?theme=a-history-of-translation"');
```

Retain the family-relationship, LetterJoy, portrait, and caption assertions already in the test.

- [ ] **Step 2: Run the focused test against the current build and verify RED**

Run:

```bash
pnpm vitest run tests/about-page.test.ts
```

Expected: FAIL because the current built page does not contain “At ten years old, he arrived in America with no parents and no money.”

- [ ] **Step 3: Replace the existing family section with the approved three paragraphs**

In `src/pages/about.astro`, keep the existing `<section aria-labelledby="family-heading">` and heading, then replace its two paragraphs with:

```astro
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
```

- [ ] **Step 4: Build and verify GREEN with the focused test**

Run:

```bash
pnpm build && pnpm vitest run tests/about-page.test.ts
```

Expected: Astro builds 88 pages and the single About-page test passes.

- [ ] **Step 5: Run the full automated verification**

Run:

```bash
pnpm check
```

Expected: Astro check reports zero errors, the production build completes, and all Vitest tests pass.

Run:

```bash
pnpm test:e2e
```

Expected: All Playwright tests pass, including accessibility checks for `/about/`.

- [ ] **Step 6: Inspect the result in the existing review server**

Open `http://127.0.0.1:4321/about/` and verify at desktop and mobile widths that:

- the section has three readable paragraphs;
- no paragraph produces awkward narrow fragments or horizontal overflow;
- the historical links remain visually unobtrusive;
- the portrait and surrounding About-page sections retain their existing layout.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/pages/about.astro tests/about-page.test.ts
git commit -m "feat: celebrate Charles Thomson on about page"
```

