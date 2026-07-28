# X UI Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every visible X invitation and outbound X link from the site and subscription emails while preserving link-preview metadata and the paper copy-link flow.

**Architecture:** Delete the dedicated homepage promotion and remove isolated X markup from the shared layout, About page, confirmation page, email shell, and paper share component. Keep the remaining navigation, subscription controls, contact route, and copy-link behavior unchanged, with built-output tests and browser acceptance checks guarding the user flow.

**Tech Stack:** Astro 7, TypeScript 5.9, Vitest 4, Playwright 1.61, Cloudflare Worker email renderer

## Global Constraints

- Remove all visible X references and outbound X/Twitter links from the UI and generated emails.
- Preserve `twitter:*` metadata used by link-preview crawlers.
- Preserve social-card images, historical internal documents, and X-header generation scripts.
- Do not add a replacement network, feature flag, or promotional campaign.
- Preserve the paper-page "Copy link" action and its copied-state feedback.
- Preserve required email management, unsubscribe, and postal-address content.
- Do not include the user's existing changes in `docs/social/marketing-plan.md` or `docs/social/strategy.md` in implementation commits.
- Final verification must cover the rendered page flow as well as source and unit tests.

---

### Task 1: Remove Site-Wide and Page-Specific X Invitations

**Files:**
- Delete: `src/components/ReadPubliusNotice.astro`
- Modify: `src/pages/index.astro:4-24`
- Modify: `src/layouts/BaseLayout.astro:99-110`
- Modify: `src/pages/about.astro:216-240`
- Modify: `src/pages/subscribe/confirmed.astro:43-52`
- Modify: `src/styles/global.css:196-253, 859-866, 918-920, 942-946`
- Modify: `tests/index-page.test.ts:5-26`
- Modify: `tests/about-page.test.ts:22-28`
- Modify: `tests/shell.test.ts:82-85`
- Modify: `tests/e2e/index.spec.ts:3-84`
- Modify: `tests/e2e/accessibility.spec.ts:12-31`
- Modify: `tests/e2e/subscribe.spec.ts:29-37`
- Create: `tests/e2e/x-removal.spec.ts`

**Interfaces:**
- Consumes: Existing static Astro routes and shared `BaseLayout` footer.
- Produces: Homepage, About, and confirmed-subscription routes with no visible X invitation or outbound X link.

- [ ] **Step 1: Replace positive X assertions with user-visible absence and continuity assertions**

In `tests/index-page.test.ts`, replace the promotion test with:

```ts
it('opens directly with the masthead and complete paper index', async () => {
  const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

  expect(home).not.toContain('readpublius-notice');
  expect(home).not.toContain('https://x.com/');
  expect(home).toContain('class="gazette-masthead"');
  expect(home.match(/data-index-paper=/g) ?? []).toHaveLength(85);
});
```

In `tests/about-page.test.ts`, change the X assertion to:

```ts
expect(html).not.toContain('https://x.com/');
expect(html).not.toContain('Follow along on X');
```

In `tests/shell.test.ts`, replace the footer-X test with:

```ts
it('keeps the footer navigation on Federalist Reader destinations', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  expect(html).not.toContain('href="https://x.com/');
  expect(html).toContain('href="/colophon/">Colophon</a>');
});
```

In `tests/e2e/subscribe.spec.ts`, make the result-page assertions:

```ts
await page.goto('/subscribe/confirmed/');
await expect(page.getByText(/Confirmed/i)).toBeVisible();
await expect(page.getByRole('link', { name: 'Read Federalist No. 1' })).toHaveAttribute(
  'href',
  '/papers/1/',
);
await expect(page.getByRole('link', { name: 'browse the full collection' })).toHaveAttribute(
  'href',
  '/#all-papers',
);
await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
```

- [ ] **Step 2: Add rendered flow coverage for affected site routes**

Create `tests/e2e/x-removal.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('affected site routes retain their primary next step without X referrals', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.gazette-masthead')).toBeVisible();
  await expect(page.locator('[data-index-paper]')).toHaveCount(85);
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);

  await page.goto('/about/');
  await expect(page.getByRole('link', { name: 'publius@federalistreader.org' })).toHaveAttribute(
    'href',
    'mailto:publius@federalistreader.org',
  );
  await expect(page.getByText('This is a production of')).toBeVisible();
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);

  await page.goto('/subscribe/confirmed/');
  await expect(page.getByRole('link', { name: 'Read Federalist No. 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'browse the full collection' })).toBeVisible();
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
});
```

Delete the three notice-specific tests and `READPUBLIUS_DISMISS_KEY` from
`tests/e2e/index.spec.ts`. In the no-JavaScript test in
`tests/e2e/accessibility.spec.ts`, replace the notice assertions with:

```ts
await expect(page.locator('.gazette-masthead')).toBeVisible();
await expect(page.locator('[data-index-paper]')).toHaveCount(85);
await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
```

- [ ] **Step 3: Build current production code and verify the new tests fail for the intended X surfaces**

Run:

```bash
pnpm build
pnpm exec vitest run tests/index-page.test.ts tests/about-page.test.ts tests/shell.test.ts
```

Expected: the build succeeds, then Vitest fails because the current built
homepage, About page, and footer still contain the X promotion or link.

- [ ] **Step 4: Remove the site invitation markup and dead homepage promotion**

In `src/pages/index.astro`, delete the `ReadPubliusNotice` import and
`<ReadPubliusNotice />` call. Delete
`src/components/ReadPubliusNotice.astro`.

In `src/layouts/BaseLayout.astro`, remove:

```astro
<a href="https://x.com/ReadPublius">@ReadPublius on X</a>
```

In `src/pages/about.astro`, delete the full section whose heading is
`Follow along on X`, leaving the contact section as the second closing-column
content.

In `src/pages/subscribe/confirmed.astro`, delete the first
`subscribe-privacy` paragraph containing the ongoing-commentary invitation;
retain the paragraph linking to Paper No. 1 and the full collection.

In `src/styles/global.css`, delete every `.readpublius-notice*` rule and remove
`.readpublius-notice` from the print-media selector:

```css
.site-utility,
.site-footer,
.skip-link {
  display: none;
}
```

- [ ] **Step 5: Rebuild and verify the site tests pass**

Run:

```bash
pnpm build
pnpm exec vitest run tests/index-page.test.ts tests/about-page.test.ts tests/shell.test.ts
pnpm exec playwright test tests/e2e/index.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/subscribe.spec.ts tests/e2e/x-removal.spec.ts
```

Expected: all listed Vitest and Playwright tests pass.

- [ ] **Step 6: Commit the site-surface removal**

```bash
git add src/pages/index.astro src/layouts/BaseLayout.astro src/pages/about.astro src/pages/subscribe/confirmed.astro src/styles/global.css src/components/ReadPubliusNotice.astro tests/index-page.test.ts tests/about-page.test.ts tests/shell.test.ts tests/e2e/index.spec.ts tests/e2e/accessibility.spec.ts tests/e2e/subscribe.spec.ts tests/e2e/x-removal.spec.ts
git commit -m "refactor: remove X invitations from site"
```

---

### Task 2: Remove X Invitations from Generated Emails

**Files:**
- Modify: `workers/post/test/email.test.ts:13-71`
- Modify: `workers/post/src/email.ts:22-38`

**Interfaces:**
- Consumes: `EmailContext` and the existing `renderPaperIssue`, `renderConfirmation`, and `renderWelcome` functions.
- Produces: The same `RenderedEmail` shape with management, unsubscribe, and postal-address content but no X invitation.

- [ ] **Step 1: Write failing email-output assertions**

In the `renderPaperIssue` test, replace the positive X assertions with:

```ts
expect(mail.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
expect(mail.html).not.toContain('@ReadPublius');
expect(mail.html).toContain(CTX.manageUrl);
expect(mail.html).toContain(CTX.unsubscribeUrl);
```

In the confirmation test, replace its positive X assertions with:

```ts
expect(mail.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
expect(mail.html).not.toContain('@ReadPublius');
```

In the welcome test, add:

```ts
expect(weekly.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
expect(weekly.html).not.toContain('@ReadPublius');
expect(weekly.html).toContain(CTX.manageUrl);
expect(weekly.html).toContain(CTX.unsubscribeUrl);
expect(weekly.html).toContain(CTX.postalAddress);
```

- [ ] **Step 2: Run the email test and verify it fails on the shared footer**

Run:

```bash
pnpm exec vitest run workers/post/test/email.test.ts
```

Expected: failures show `https://x.com/ReadPublius` or `@ReadPublius on X`
still exists in generated HTML.

- [ ] **Step 3: Remove only the X line from the shared email shell**

In `workers/post/src/email.ts`, delete:

```ts
Ongoing commentary on the papers, the founding, and the news they still speak to: <a href="https://x.com/ReadPublius" style="color:${MUTED};">@ReadPublius on X</a><br>
```

Keep the progress line, manage link, unsubscribe link, and postal address
unchanged.

- [ ] **Step 4: Verify all email renderer tests pass**

Run:

```bash
pnpm exec vitest run workers/post/test/email.test.ts
```

Expected: all email renderer tests pass.

- [ ] **Step 5: Commit the email removal**

```bash
git add workers/post/src/email.ts workers/post/test/email.test.ts
git commit -m "refactor: remove X invitation from emails"
```

---

### Task 3: Reduce Paper Sharing to the Copy-Link Flow

**Files:**
- Modify: `src/components/EssayShare.astro:1-68`
- Modify: `src/layouts/PaperLayout.astro`
- Modify: `src/styles/paper.css:506-543`
- Modify: `tests/paper-page.test.ts:18-22`
- Modify: `tests/e2e/x-removal.spec.ts`

**Interfaces:**
- Consumes: The browser's canonical current URL and Clipboard API.
- Produces: A `data-share-copy` button that writes the fragment-free current URL and announces `Link copied`.

- [ ] **Step 1: Write the failing built-output share assertions**

In `tests/paper-page.test.ts`, replace the X share assertions with:

```ts
expect(html).not.toContain('data-share-x');
expect(html).not.toContain('twitter.com/intent/tweet');
expect(html).toContain('data-share-copy');
expect(html).toContain('Copy link');
```

Append this test to `tests/e2e/x-removal.spec.ts`:

```ts
test('paper sharing copies the canonical page URL without an X action', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/papers/1/#companion-heading');

  const share = page.getByRole('complementary', { name: 'Share this paper' });
  await expect(share.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
  await share.getByRole('button', { name: 'Copy link' }).click();
  await expect(share.getByText('Link copied')).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    'http://127.0.0.1:4321/papers/1/',
  );
});
```

- [ ] **Step 2: Rebuild current production code and verify the share test fails for the X action**

Run:

```bash
pnpm build
pnpm exec vitest run tests/paper-page.test.ts
```

Expected: Vitest fails because the built paper still contains
`data-share-x` and the Twitter intent URL.

- [ ] **Step 3: Remove the X intent and retain the copy-link behavior**

Replace the top and markup of `src/components/EssayShare.astro` with:

```astro
<aside class="essay-share" aria-label="Share this paper">
  <span class="essay-share__ornament" aria-hidden="true">✦</span>
  <p class="essay-share__prompt">Share this paper</p>
  <div class="essay-share__actions">
    <button type="button" class="essay-share__action" data-share-copy>
      <span data-copy-label aria-live="polite">Copy link</span>
    </button>
  </div>
</aside>
```

Keep the existing copy-button script, but delete `xLink` lookup and intent
rewriting. Change the clipboard failure comment to:

```ts
// Clipboard blocked; the address bar remains available.
```

In `src/layouts/PaperLayout.astro`, change:

```astro
<EssayShare number={paper.data.number} />
```

to:

```astro
<EssayShare />
```

Delete `.essay-share__divider` from `src/styles/paper.css`; keep the action
container and button styling.

- [ ] **Step 4: Rebuild and verify static and browser share behavior**

Run:

```bash
pnpm build
pnpm exec vitest run tests/paper-page.test.ts
pnpm exec playwright test tests/e2e/x-removal.spec.ts
```

Expected: the static paper test passes, the paper page has no X link, clicking
"Copy link" changes the live label, and the clipboard contains the
fragment-free paper URL.

- [ ] **Step 5: Commit the paper-sharing change**

```bash
git add src/components/EssayShare.astro src/layouts/PaperLayout.astro src/styles/paper.css tests/paper-page.test.ts tests/e2e/x-removal.spec.ts
git commit -m "refactor: remove X paper sharing"
```

---

### Task 4: Verify the Complete Design and Page Flow

**Files:**
- Verify: all affected production and test files

**Interfaces:**
- Consumes: The completed site build and generated email renderers.
- Produces: Fresh evidence that every approved requirement and primary user path is intact.

- [ ] **Step 1: Audit production sources for remaining outbound X traffic**

Run:

```bash
rg -n -i 'https?://(www\.)?(x\.com|twitter\.com)|@ReadPublius on X|Post on X|Follow along on X' src workers/post/src
```

Expected: no matches. The retained `twitter:*` metadata is not an outbound URL
and is intentionally unaffected.

- [ ] **Step 2: Run the production build**

Run:

```bash
pnpm build
```

Expected: content validation and the Astro production build complete with exit
code 0.

- [ ] **Step 3: Run the complete project check**

Run:

```bash
pnpm check
```

Expected: Astro checks, analytics-output verification, and all Vitest suites
complete with exit code 0.

- [ ] **Step 4: Run the full browser suite**

Run:

```bash
pnpm test:e2e
```

Expected: all Playwright tests pass, including accessibility and the dedicated
X-removal page-flow scenarios.

- [ ] **Step 5: Inspect affected rendered pages in a browser**

Open `/`, `/about/`, `/subscribe/confirmed/`, and `/papers/1/` against the
production preview. Verify the following at desktop and mobile widths:

```text
Homepage: masthead leads naturally into the introduction; all 85 papers remain reachable.
About: contact information and the Walke Forward colophon close the page cleanly.
Confirmed: Paper No. 1 and full-collection links remain the clear next steps.
Paper: the coda remains balanced; Copy link is visible and reports Link copied.
All four: no visible X wording or outbound X/Twitter link appears.
```

- [ ] **Step 6: Review the final diff and preserve unrelated user changes**

Run:

```bash
git status --short
git diff HEAD~3 -- src workers/post/src tests workers/post/test
```

Expected: only the approved X UI/email/share removals and their tests appear;
`docs/social/marketing-plan.md` and `docs/social/strategy.md` remain modified
but uncommitted and untouched by this implementation.
