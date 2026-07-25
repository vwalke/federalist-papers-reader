# ReadPublius Homepage Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a homepage-only editorial notice that promotes the substantive `@ReadPublius` X feed and remains visible until explicitly dismissed in that browser.

**Architecture:** A focused `ReadPubliusNotice.astro` component owns the notice markup, its small progressive-enhancement script, and its persistence key. The homepage owns placement; existing global homepage styles own responsive presentation. Static build tests verify scope and approved copy, while Playwright verifies dismissal, persistence, blocked-storage recovery, link behavior, and the no-JavaScript fallback.

**Tech Stack:** Astro 7, TypeScript, CSS, browser `localStorage`, Vitest, Playwright

## Global Constraints

- Render the notice only on `/`, as the first element inside the homepage `.paper-sheet`.
- Never render it on Federalist paper pages or supporting pages.
- Use the exact label `From the public square`.
- Use the exact message `Ongoing commentary on the Federalist Papers, dispatches from the 1787 Constitutional Convention, and glimpses into the newspapers and history behind the debate.`
- Link `Follow @ReadPublius on X ↗` to `https://x.com/ReadPublius` without forcing a new browsing context.
- Store explicit dismissal as `localStorage["publius:x-promo-dismissed"] = "1"`.
- Following the X link must not write the dismissal preference.
- Keep the notice in normal document flow: no modal, overlay, sticky, or fixed behavior.
- Reuse existing design tokens and fonts; add no dependencies, X SDK, embedded feed, follower count, or custom analytics.
- With JavaScript disabled, keep the notice and X link visible and usable; do not expose a dead dismiss control.

## File map

- Create `src/components/ReadPubliusNotice.astro`: semantic notice markup, early stored-state application, dismiss enhancement, and the exact storage key.
- Modify `src/pages/index.astro`: import and render the notice before `GazetteMasthead`.
- Modify `src/styles/global.css`: editorial-notice layout, responsive reflow, interaction targets, forced-colors support, and print suppression.
- Modify `tests/index-page.test.ts`: built-output coverage for approved copy, placement, homepage-only scope, and semantic controls.
- Modify `tests/e2e/index.spec.ts`: live-browser coverage for dismissal, reload persistence, link non-dismissal, and storage failure.
- Modify `tests/e2e/accessibility.spec.ts`: no-JavaScript fallback coverage.

---

### Task 1: Render and style the homepage-only editorial notice

**Files:**

- Create: `src/components/ReadPubliusNotice.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/index-page.test.ts`

**Interfaces:**

- Consumes: existing homepage `.paper-sheet`, global color/spacing/font tokens, and `GazetteMasthead`.
- Produces: `[data-readpublius-notice]`, `[data-readpublius-dismiss]`, and `[data-readpublius-link]` hooks for Task 2.

- [ ] **Step 1: Write the failing built-output test**

Add this test to `tests/index-page.test.ts`:

```ts
it('promotes the ReadPublius feed only at the top of the homepage sheet', async () => {
  const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const paper = await readFile(new URL('../dist/papers/1/index.html', import.meta.url), 'utf8');
  const about = await readFile(new URL('../dist/about/index.html', import.meta.url), 'utf8');
  const homeText = home.replace(/\s+/g, ' ');

  expect(home).toContain('class="readpublius-notice"');
  expect(homeText).toContain('From the public square');
  expect(homeText).toContain(
    'Ongoing commentary on the Federalist Papers, dispatches from the 1787 Constitutional Convention, and glimpses into the newspapers and history behind the debate.',
  );
  expect(home).toContain('href="https://x.com/ReadPublius"');
  expect(home).toContain('data-readpublius-link');
  expect(homeText).toContain('Follow @ReadPublius on X');
  expect(home).toContain('aria-label="Dismiss ReadPublius notice"');
  expect(home.indexOf('class="readpublius-notice"')).toBeLessThan(
    home.indexOf('class="gazette-masthead"'),
  );
  expect(paper).not.toContain('data-readpublius-notice');
  expect(about).not.toContain('data-readpublius-notice');
});
```

- [ ] **Step 2: Build and run the focused test to verify it fails**

Run:

```bash
pnpm build
pnpm exec vitest run tests/index-page.test.ts
```

Expected: the new test fails because `data-readpublius-notice` and the approved copy are absent.

- [ ] **Step 3: Create the semantic component markup**

Create `src/components/ReadPubliusNotice.astro`:

```astro
<aside
  class="readpublius-notice"
  aria-labelledby="readpublius-notice-title"
  data-readpublius-notice
>
  <p class="readpublius-notice__label" id="readpublius-notice-title">
    From the public square
  </p>
  <p class="readpublius-notice__message">
    Ongoing commentary on the Federalist Papers, dispatches from the 1787 Constitutional
    Convention, and glimpses into the newspapers and history behind the debate.
  </p>
  <a
    class="readpublius-notice__link"
    href="https://x.com/ReadPublius"
    data-readpublius-link
  >
    Follow @ReadPublius on X <span aria-hidden="true">↗</span>
  </a>
  <button
    class="readpublius-notice__dismiss"
    type="button"
    aria-label="Dismiss ReadPublius notice"
    data-readpublius-dismiss
    hidden
  >
    <span aria-hidden="true">×</span>
  </button>
</aside>
```

The dismiss button starts hidden so the no-JavaScript fallback never exposes a control that cannot work. Task 2 reveals it only after its handler is attached.

- [ ] **Step 4: Place the component before the masthead**

In `src/pages/index.astro`, add:

```astro
import ReadPubliusNotice from '../components/ReadPubliusNotice.astro';
```

Then render it as the first child of `.paper-sheet`:

```astro
<article class="paper-sheet">
  <ReadPubliusNotice />
  <GazetteMasthead />
```

- [ ] **Step 5: Add the editorial-notice styling**

Add this block near the other homepage rules in `src/styles/global.css`:

```css
.readpublius-notice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'label message dismiss'
    'label action dismiss';
  align-items: center;
  gap: var(--space-xs) var(--space-lg);
  padding: var(--space-md);
  border-block-end: 5px double var(--color-rule);
  background: color-mix(in oklab, var(--color-paper) 82%, var(--color-newsprint));
}

html[data-readpublius-dismissed] .readpublius-notice {
  display: none;
}

.readpublius-notice__label {
  grid-area: label;
  color: var(--color-oxblood);
  font: 700 0.68rem/1.3 var(--font-utility);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.readpublius-notice__message {
  grid-area: message;
  max-inline-size: 72ch;
  font-size: 1rem;
  line-height: 1.45;
}

.readpublius-notice__link {
  grid-area: action;
  justify-self: start;
  color: var(--color-verdigris);
  font-style: italic;
}

.readpublius-notice__dismiss {
  grid-area: dismiss;
  inline-size: 2.75rem;
  block-size: 2.75rem;
  padding: 0;
  border: 0;
  color: var(--color-ink);
  background: transparent;
  font: 400 1.5rem/1 var(--font-utility);
  cursor: pointer;
}

.readpublius-notice__dismiss:hover {
  color: var(--color-oxblood);
}

@media (max-width: 45.999rem) {
  .readpublius-notice {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'label dismiss'
      'message message'
      'action action';
    gap: var(--space-sm);
  }
}

@media (forced-colors: active) {
  .readpublius-notice {
    border: 1px solid CanvasText;
    border-block-end-width: 5px;
  }
}

@media print {
  .readpublius-notice {
    display: none;
  }
}
```

- [ ] **Step 6: Build and run the focused test to verify it passes**

Run:

```bash
pnpm build
pnpm exec vitest run tests/index-page.test.ts
```

Expected: all `tests/index-page.test.ts` tests pass.

- [ ] **Step 7: Commit the static notice**

```bash
git add src/components/ReadPubliusNotice.astro src/pages/index.astro src/styles/global.css tests/index-page.test.ts
git commit -m "feat: add ReadPublius homepage notice"
```

---

### Task 2: Add resilient explicit-dismissal persistence

**Files:**

- Modify: `src/components/ReadPubliusNotice.astro`
- Modify: `tests/e2e/index.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**

- Consumes: `[data-readpublius-notice]`, `[data-readpublius-dismiss]`, `[data-readpublius-link]`, and the `html[data-readpublius-dismissed]` CSS hook from Task 1.
- Produces: exact persistence contract `localStorage["publius:x-promo-dismissed"] === "1"` and document-state marker `data-readpublius-dismissed`.

- [ ] **Step 1: Write the failing interaction tests**

Append these tests to `tests/e2e/index.spec.ts`:

```ts
const READPUBLIUS_DISMISS_KEY = 'publius:x-promo-dismissed';

test('keeps the ReadPublius notice dismissed across homepage visits', async ({ page }) => {
  await page.goto('/');
  const notice = page.getByRole('complementary', { name: 'From the public square' });

  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Dismiss ReadPublius notice' }).click();
  await expect(notice).toBeHidden();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), READPUBLIUS_DISMISS_KEY))
    .toBe('1');

  await page.reload();
  await expect(notice).toBeHidden();
});

test('following ReadPublius does not dismiss the notice', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Follow @ReadPublius on X' });

  await link.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
    (element as HTMLElement).click();
  });

  await expect(page.locator('[data-readpublius-notice]')).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), READPUBLIUS_DISMISS_KEY))
    .toBeNull();
});

test('dismisses for the current page when localStorage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
  });

  await page.goto('/');
  const notice = page.getByRole('complementary', { name: 'From the public square' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Dismiss ReadPublius notice' }).click();
  await expect(notice).toBeHidden();

  await page.reload();
  await expect(notice).toBeVisible();
});
```

Extend the no-JavaScript homepage assertions in `tests/e2e/accessibility.spec.ts`:

```ts
await expect(
  page.getByRole('complementary', { name: 'From the public square' }),
).toBeVisible();
await expect(
  page.getByRole('link', { name: 'Follow @ReadPublius on X' }),
).toHaveAttribute('href', 'https://x.com/ReadPublius');
await expect(
  page.getByRole('button', { name: 'Dismiss ReadPublius notice' }),
).toHaveCount(0);
```

- [ ] **Step 2: Run the focused browser tests to verify they fail**

Run:

```bash
pnpm exec playwright test tests/e2e/index.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: the dismissal tests fail because the button remains hidden and no persistence behavior exists.

- [ ] **Step 3: Add early state application and dismiss enhancement**

In `src/components/ReadPubliusNotice.astro`, add this inline script immediately before the `<aside>`:

```astro
<script is:inline>
  try {
    if (localStorage.getItem('publius:x-promo-dismissed') === '1') {
      document.documentElement.dataset.readpubliusDismissed = '';
    }
  } catch {
    // The notice remains available when storage access is blocked.
  }
</script>
```

Add this bundled script immediately after the `</aside>`:

```astro
<script>
  const notice = document.querySelector<HTMLElement>('[data-readpublius-notice]');
  const dismiss = notice?.querySelector<HTMLButtonElement>('[data-readpublius-dismiss]');

  if (notice && dismiss) {
    dismiss.addEventListener('click', () => {
      document.documentElement.dataset.readpubliusDismissed = '';
      try {
        window.localStorage.setItem('publius:x-promo-dismissed', '1');
      } catch {
        // The document marker still dismisses the notice for this page.
      }
    });
    dismiss.hidden = false;
  }
</script>
```

The document marker is applied before storage is written so a storage exception cannot prevent current-page dismissal. No listener is attached to the X link, so following never changes the preference.

- [ ] **Step 4: Run the focused browser tests to verify they pass**

Run:

```bash
pnpm exec playwright test tests/e2e/index.spec.ts tests/e2e/accessibility.spec.ts
```

Expected: the dismissal, persistence, link, blocked-storage, accessibility, and no-JavaScript tests pass.

- [ ] **Step 5: Run the complete repository verification**

Run:

```bash
pnpm check
pnpm exec playwright test
```

Expected: Astro checks, analytics verification, all Vitest tests, and all Playwright tests pass.

- [ ] **Step 6: Commit the behavior**

```bash
git add src/components/ReadPubliusNotice.astro tests/e2e/index.spec.ts tests/e2e/accessibility.spec.ts
git commit -m "feat: persist ReadPublius notice dismissal"
```

## Final visual check

After both tasks pass, inspect `/` at 320px and desktop width. Confirm the notice
is the first item on the sheet, the content reflows without horizontal overflow,
the dismiss control has a visible focus ring and 44px target, the masthead retains
its hierarchy, dismissal does not shift focus unexpectedly, and `/papers/1/`
contains no notice.
