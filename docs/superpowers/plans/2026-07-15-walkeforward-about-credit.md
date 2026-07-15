# WalkeForward About Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quiet, accessible WalkeForward, LLC production credit at the end of the About article.

**Architecture:** Add one semantic article footer to the existing About page and style it through the established About-page rules in `global.css`. Extend the existing static and Playwright About tests so the exact copy, destination, document order, centering, and narrow-screen overflow behavior remain protected.

**Tech Stack:** Astro 7, CSS, Vitest, Playwright

## Global Constraints

- Exact sentence: `This is a production of WalkeForward, LLC.`
- Only `WalkeForward, LLC.` links to `https://walkeforward.com`.
- The credit remains subtle, centered, readable, and distinct from both editorial content and the global footer.
- The link opens in the current tab and uses the existing focus treatment.
- The credit remains visible in print and wraps without horizontal overflow on narrow screens.
- Do not add a logo, icon, badge, call to action, dependency, or JavaScript behavior.

---

### Task 1: Add and protect the About-page colophon

**Files:**
- Modify: `src/pages/about.astro`
- Modify: `src/styles/global.css`
- Test: `tests/about-page.test.ts`
- Test: `tests/e2e/about.spec.ts`

**Interfaces:**
- Consumes: the existing `.about-page`, `.about-notes`, `--color-muted-ink`, `--color-rule`, `--font-reading`, and spacing tokens.
- Produces: a semantic `<footer class="about-colophon">` containing one `https://walkeforward.com` link.

- [ ] **Step 1: Write the failing static regression assertions**

Add these assertions after the existing `.about-notes__privacy` assertion in `tests/about-page.test.ts`:

```ts
expect(html).toContain('class="about-colophon"');
expect(html).toContain('This is a production of');
expect(html).toContain('<a href="https://walkeforward.com">WalkeForward, LLC.</a>');

const colophonIndex = html.indexOf('class="about-colophon"');
expect(colophonIndex).toBeGreaterThan(notesIndex);
```

This deliberately reuses the test's existing `notesIndex` declaration.

- [ ] **Step 2: Run the static test to verify it fails**

Run:

```bash
pnpm build && pnpm exec vitest run tests/about-page.test.ts
```

Expected: FAIL because `class="about-colophon"` is absent from the built About page.

- [ ] **Step 3: Add the semantic colophon markup**

Insert this markup immediately after `.about-notes` and before `</article>` in `src/pages/about.astro`:

```astro
<footer class="about-colophon">
  <p>This is a production of <a href="https://walkeforward.com">WalkeForward, LLC.</a></p>
</footer>
```

- [ ] **Step 4: Add the restrained colophon styling**

Add these rules after the `.about-notes` rules in `src/styles/global.css`:

```css
.about-colophon {
  max-inline-size: 74rem;
  margin: var(--space-2xl) auto 0;
  color: var(--color-muted-ink);
  text-align: center;
}

.about-colophon::before {
  content: '';
  display: block;
  inline-size: 3rem;
  margin: 0 auto var(--space-md);
  border-block-start: 1px solid var(--color-rule);
}

.about-page .about-colophon p {
  font: 400 0.82rem/1.5 var(--font-reading);
}

.about-colophon a {
  color: inherit;
  text-decoration-color: color-mix(in oklab, currentColor 58%, transparent);
  text-underline-offset: 0.18em;
}

.about-colophon a:hover {
  color: var(--color-ink);
  text-decoration-color: currentColor;
}
```

Do not override `:focus-visible`; the global link focus treatment remains authoritative.

- [ ] **Step 5: Run the static test to verify it passes**

Run:

```bash
pnpm build && pnpm exec vitest run tests/about-page.test.ts
```

Expected: PASS with the exact credit, URL, and document order confirmed.

- [ ] **Step 6: Add desktop and mobile layout assertions**

In the wide-screen test in `tests/e2e/about.spec.ts`, add `colophon: box('.about-colophon')` to the returned object, then add:

```ts
expect(layout.colophon.y).toBeGreaterThan(layout.noteBoxes[2].y + layout.noteBoxes[2].height);
```

In the mobile test, append `'.about-colophon'` to the `selectors` array and retain the existing order and horizontal-overflow assertions. Add:

```ts
expect(layout.boxes[4].y).toBeLessThan(layout.boxes[5].y);
```

- [ ] **Step 7: Run the focused browser tests**

Run:

```bash
PLAYWRIGHT_PORT=4322 pnpm exec playwright test tests/e2e/about.spec.ts
```

Expected: 4 tests pass, including desktop, mobile, intermediate-width, and print behavior.

- [ ] **Step 8: Run the complete verification gate**

Run:

```bash
pnpm check
PLAYWRIGHT_PORT=4322 pnpm test:e2e
node '/Users/vwalke/.codex/plugins/cache/impeccable/impeccable/3.9.1/skills/impeccable/scripts/detect.mjs' --json --scope layout src/pages/about.astro src/styles/global.css
git diff --check
```

Expected: 0 Astro diagnostics, 88 pages built, all Vitest and Playwright tests pass, the design detector returns `[]`, and `git diff --check` reports no whitespace errors.

- [ ] **Step 9: Commit**

```bash
git add src/pages/about.astro src/styles/global.css tests/about-page.test.ts tests/e2e/about.spec.ts
git commit -m "feat: credit WalkeForward on About page"
```
