# Cloudflare Web Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free, production-only Cloudflare Web Analytics for aggregate site and paper traffic while removing the obsolete About-page tracking explanation.

**Architecture:** A pure helper validates the build-time Cloudflare site token and produces the beacon configuration only for production builds. A focused Astro component owns the third-party script, and the shared base layout renders it once on every page. With no valid token, the static site builds and operates exactly as it does today.

**Tech Stack:** Astro 7 static output, TypeScript 5.9, Vitest 4, Playwright 1.61, Cloudflare Web Analytics JavaScript beacon

## Global Constraints

- Use Cloudflare Web Analytics with the site remaining on AWS; do not move DNS or hosting.
- Collect only standard aggregate visits, page views, paths, referrers, country, device/browser/OS, and performance metrics.
- Do not add custom events, individual reading histories, mark-as-read tracking, Reader/Gazette tracking, scroll tracking, or link tracking.
- Do not add accounts, advertising, paid infrastructure, a cookie banner, a privacy explanation, a login explanation, or an analytics callout.
- Analytics must load only in production when a valid token is configured.
- Missing or invalid analytics configuration must never affect reading, navigation, preferences, or local progress.
- Preserve the unrelated untracked `_to_delete/` directory and `docs/about-two-column-roadmap.md` file.
- Do not stop or replace the existing review server on port `4321`; use port `4323` for isolated Playwright verification.

---

## File Structure

- Create `src/lib/analytics.ts`: validate the Cloudflare site token and serialize its public beacon configuration.
- Create `src/components/Analytics.astro`: conditionally render the Cloudflare beacon in production.
- Modify `src/layouts/BaseLayout.astro`: render the analytics component once for every page.
- Create `tests/analytics.test.ts`: unit-test production gating, validation, and serialization.
- Modify `tests/shell.test.ts`: verify the shared integration point and the no-token build behavior.
- Modify `src/pages/about.astro`: remove the complete “No account, no tracking your reading” section.
- Modify `src/styles/global.css`: remove CSS that existed only for the deleted third About note.
- Modify `tests/about-page.test.ts`: assert that the obsolete section is absent.
- Modify `tests/e2e/about.spec.ts`: preserve desktop/mobile About layout expectations with two notes.
- Modify `docs/deployment.md`: document the Cloudflare token for manual and Amplify builds.

---

### Task 1: Production Analytics Configuration

**Files:**
- Create: `tests/analytics.test.ts`
- Create: `src/lib/analytics.ts`

**Interfaces:**
- Consumes: a production flag and optional raw Cloudflare site token from the build environment.
- Produces: `createCloudflareBeaconData(production: boolean, rawToken: string | undefined): string | undefined`.
- Token contract: after trimming, accept 20–128 ASCII letters, digits, underscores, or hyphens; reject missing, blank, short, spaced, or otherwise malformed values.

- [ ] **Step 1: Write the failing configuration tests**

Create `tests/analytics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { createCloudflareBeaconData } from '../src/lib/analytics';

const VALID_TOKEN = '0123456789abcdef0123456789abcdef';

describe('Cloudflare Web Analytics configuration', () => {
  it('stays disabled outside production', () => {
    expect(createCloudflareBeaconData(false, VALID_TOKEN)).toBeUndefined();
  });

  it('stays disabled when production configuration is missing or invalid', () => {
    expect(createCloudflareBeaconData(true, undefined)).toBeUndefined();
    expect(createCloudflareBeaconData(true, '   ')).toBeUndefined();
    expect(createCloudflareBeaconData(true, 'not a valid token')).toBeUndefined();
  });

  it('trims and serializes a valid production site token', () => {
    expect(createCloudflareBeaconData(true, `  ${VALID_TOKEN}  `)).toBe(
      `{"token":"${VALID_TOKEN}"}`,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```bash
pnpm test -- tests/analytics.test.ts
```

Expected: FAIL because `../src/lib/analytics` does not exist.

- [ ] **Step 3: Implement the minimal validated configuration helper**

Create `src/lib/analytics.ts`:

```ts
const CLOUDFLARE_SITE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export function createCloudflareBeaconData(
  production: boolean,
  rawToken: string | undefined,
): string | undefined {
  if (!production) return undefined;

  const token = rawToken?.trim();
  if (!token || !CLOUDFLARE_SITE_TOKEN.test(token)) return undefined;

  return JSON.stringify({ token });
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
pnpm test -- tests/analytics.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the configuration unit**

```bash
git add tests/analytics.test.ts src/lib/analytics.ts
git commit -m "feat: validate analytics build configuration"
```

---

### Task 2: Shared Cloudflare Beacon Integration

**Files:**
- Create: `src/components/Analytics.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/shell.test.ts`

**Interfaces:**
- Consumes: `createCloudflareBeaconData(production, rawToken)` from Task 1, `import.meta.env.PROD`, and `import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN`.
- Produces: one deferred `https://static.cloudflareinsights.com/beacon.min.js` script with `data-cf-beacon` on every production page when configuration is valid; otherwise no markup.

- [ ] **Step 1: Add failing shared-layout assertions**

Replace `tests/shell.test.ts` with:

```ts
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('static site shell', () => {
  it('renders the skip link, main landmark, masthead, and viewport metadata', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('src="/masthead-independent-journal.svg"');
    expect(html).toContain('viewport-fit=cover');
  });

  it('owns analytics in the shared layout and omits the beacon without configuration', async () => {
    const layout = await readFile(
      new URL('../src/layouts/BaseLayout.astro', import.meta.url),
      'utf8',
    );
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(layout).toContain("import Analytics from '../components/Analytics.astro';");
    expect(layout).toContain('<Analytics />');
    expect(html).not.toContain('static.cloudflareinsights.com/beacon.min.js');
    expect(html).not.toContain('data-cf-beacon');
  });
});
```

- [ ] **Step 2: Build and run the shell test to confirm the integration assertions fail**

Run:

```bash
pnpm build && pnpm test -- tests/shell.test.ts
```

Expected: the existing shell test passes, while the new test FAILS because `BaseLayout.astro` does not import or render `Analytics`.

- [ ] **Step 3: Create the focused Astro analytics component**

Create `src/components/Analytics.astro`:

```astro
---
import { createCloudflareBeaconData } from '../lib/analytics';

const beaconData = createCloudflareBeaconData(
  import.meta.env.PROD,
  import.meta.env.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN,
);
---

{
  beaconData && (
    <script
      is:inline
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={beaconData}
    />
  )
}
```

- [ ] **Step 4: Render analytics once in the shared layout**

In `src/layouts/BaseLayout.astro`, add this import after the font and stylesheet imports:

```astro
import Analytics from '../components/Analytics.astro';
```

Then render the component immediately before `</body>`:

```astro
    <Analytics />
  </body>
```

- [ ] **Step 5: Rebuild without a token and run focused unit tests**

Run:

```bash
pnpm build && pnpm test -- tests/analytics.test.ts tests/shell.test.ts
```

Expected: 5 tests PASS, and `dist/index.html` contains no Cloudflare beacon.

- [ ] **Step 6: Confirm a valid production token emits exactly one beacon**

Run:

```bash
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=0123456789abcdef0123456789abcdef pnpm build
rg -o 'static\.cloudflareinsights\.com/beacon\.min\.js' dist/index.html
rg 'data-cf-beacon="\{&quot;token&quot;:&quot;0123456789abcdef0123456789abcdef&quot;\}"' dist/index.html
```

Expected: the first `rg` prints exactly one match, and the second finds the serialized test token. If Astro serializes the JSON attribute with literal quotation marks rather than `&quot;`, inspect `dist/index.html` and adjust only the second verification pattern; do not change the component's `JSON.stringify` data contract.

- [ ] **Step 7: Restore a normal no-token build and commit the integration**

Run:

```bash
pnpm build
git add src/components/Analytics.astro src/layouts/BaseLayout.astro tests/shell.test.ts
git commit -m "feat: add production-only web analytics"
```

Expected: the build succeeds, the unconfigured `dist/` contains no beacon, and the commit includes only the three listed files.

---

### Task 3: Remove the Obsolete About Note

**Files:**
- Modify: `tests/about-page.test.ts`
- Modify: `tests/e2e/about.spec.ts`
- Modify: `src/pages/about.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the existing `.about-notes` two-column layout.
- Produces: exactly two About notes on desktop and mobile, followed directly by the WalkeForward colophon; no privacy/tracking note or orphaned privacy-only CSS.

- [ ] **Step 1: Change the static About test to require the section's removal**

In `tests/about-page.test.ts`, replace:

```ts
    expect(html).toContain('class="about-notes__privacy"');
```

with:

```ts
    expect(html).not.toContain('class="about-notes__privacy"');
    expect(html).not.toContain('No account, no tracking your reading');
```

- [ ] **Step 2: Change the wide-screen layout expectations from three notes to two**

In the first test in `tests/e2e/about.spec.ts`, replace:

```ts
  expect(layout.noteBoxes).toHaveLength(3);
  expect(Math.abs(layout.noteBoxes[0].y - layout.noteBoxes[1].y)).toBeLessThan(2);
  expect(layout.noteBoxes[2].y).toBeGreaterThan(layout.noteBoxes[0].y);
  expect(layout.noteBoxes[2].width).toBeGreaterThan(layout.noteBoxes[0].width * 1.75);
  expect(layout.colophon.y).toBeGreaterThan(layout.noteBoxes[2].y + layout.noteBoxes[2].height);
```

with:

```ts
  expect(layout.noteBoxes).toHaveLength(2);
  expect(Math.abs(layout.noteBoxes[0].y - layout.noteBoxes[1].y)).toBeLessThan(2);
  expect(layout.colophon.y).toBeGreaterThan(
    Math.max(...layout.noteBoxes.map(({ y, height }) => y + height)),
  );
```

- [ ] **Step 3: Change the mobile layout expectations from three notes to two**

In the mobile test in `tests/e2e/about.spec.ts`, replace:

```ts
  expect(layout.noteYPositions[0]).toBeLessThan(layout.noteYPositions[1]);
  expect(layout.noteYPositions[1]).toBeLessThan(layout.noteYPositions[2]);
```

with:

```ts
  expect(layout.noteYPositions).toHaveLength(2);
  expect(layout.noteYPositions[0]).toBeLessThan(layout.noteYPositions[1]);
```

- [ ] **Step 4: Run the tests and confirm they fail against the existing third note**

Run:

```bash
pnpm build
pnpm test -- tests/about-page.test.ts
PLAYWRIGHT_PORT=4323 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: the static test FAILS because the privacy class and heading remain; the desktop and mobile browser tests FAIL because three note sections remain.

- [ ] **Step 5: Delete the complete privacy section from the About page**

Remove this block from `src/pages/about.astro`:

```astro
      <section class="about-notes__privacy" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading">No account, no tracking your reading</h2>
        <p>
          Marking a paper read saves that fact only in this browser. It will not follow you to a new
          device, and clearing browser storage clears the record. The essays and navigation remain
          available if storage or JavaScript is disabled.
        </p>
      </section>
```

- [ ] **Step 6: Remove desktop CSS that existed only for the deleted note**

Remove this rule from `src/styles/global.css`:

```css
  .about-notes > .about-notes__privacy {
    grid-column: 1 / -1;
    margin-block-start: var(--space-xl);
    padding-block-start: var(--space-xl);
    border-block-start: 1px solid var(--color-rule);
  }
```

- [ ] **Step 7: Remove the deleted note from the mobile selector**

In `src/styles/global.css`, change:

```css
  .about-notes > section,
  .about-notes > section:first-child,
  .about-notes > section:nth-child(2),
  .about-notes > .about-notes__privacy {
```

to:

```css
  .about-notes > section,
  .about-notes > section:first-child,
  .about-notes > section:nth-child(2) {
```

- [ ] **Step 8: Rebuild and run the focused static and browser tests**

Run:

```bash
pnpm build
pnpm test -- tests/about-page.test.ts
PLAYWRIGHT_PORT=4323 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: the static About test and all four About browser tests PASS at desktop, mobile, intermediate, and print layouts.

- [ ] **Step 9: Commit the About cleanup**

```bash
git add src/pages/about.astro src/styles/global.css tests/about-page.test.ts tests/e2e/about.spec.ts
git commit -m "refactor: remove tracking note from About page"
```

---

### Task 4: Deployment Documentation and Final Verification

**Files:**
- Modify: `docs/deployment.md`

**Interfaces:**
- Consumes: the Cloudflare site token created in the Cloudflare Web Analytics dashboard.
- Produces: an exact `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` build configuration path for manual and connected Amplify deployments.

- [ ] **Step 1: Document both production build variables**

In `docs/deployment.md`, replace:

````markdown
Set this Amplify environment variable for canonical URLs:

```text
PUBLIC_SITE_URL=https://<your-production-domain>
```

No other environment variables or secrets are required.
````

with:

````markdown
Set these Amplify environment variables for canonical URLs and aggregate traffic analytics:

```text
PUBLIC_SITE_URL=https://<your-production-domain>
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<your-Cloudflare-site-token>
```

Create the site token by adding the production hostname in the Cloudflare Web Analytics dashboard. The token is embedded in the public beacon markup and is not an account credential. If the analytics token is missing or invalid, the site still builds normally and emits no analytics beacon.
````

- [ ] **Step 2: Update the manual deployment build command**

In the “Updating a manual deployment” list in `docs/deployment.md`, replace step 2 with:

```markdown
2. Run `pnpm install --frozen-lockfile`, then build and test with `PUBLIC_SITE_URL=<live-url> PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<site-token> pnpm check`.
```

- [ ] **Step 3: Add Cloudflare setup documentation to Sources**

Append this bullet to the Sources list in `docs/deployment.md`:

```markdown
- [Cloudflare: Enable Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
```

- [ ] **Step 4: Run formatting checks and the complete project suite**

Run:

```bash
git diff --check
pnpm check
PLAYWRIGHT_PORT=4323 pnpm test:e2e
```

Expected: `git diff --check` prints no errors; Astro checks, content validation, static build, all Vitest tests, and all Playwright tests PASS.

- [ ] **Step 5: Verify configured and unconfigured production output**

Run:

```bash
PUBLIC_SITE_URL=https://federalistreader.com PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=0123456789abcdef0123456789abcdef pnpm build
rg -l 'static\.cloudflareinsights\.com/beacon\.min\.js' dist -g '*.html' | wc -l
rg -n 'about-notes__privacy|No account, no tracking your reading' dist/about/index.html
pnpm build
rg -n 'static\.cloudflareinsights\.com/beacon\.min\.js|data-cf-beacon' dist/index.html
```

Expected:

- the configured build reports one beacon-bearing file for every generated HTML page;
- the About-page search exits with no matches;
- the final unconfigured build succeeds; and
- the final search exits with no Cloudflare beacon matches.

The exact number of generated HTML files may change as Astro output evolves, so compare the first count with `find dist -name '*.html' | wc -l` rather than hard-coding a page count.

- [ ] **Step 6: Review the final diff and commit documentation**

Run:

```bash
git diff --check
git status --short
git diff -- docs/deployment.md
git add docs/deployment.md
git commit -m "docs: configure production web analytics"
```

Expected: the commit contains only `docs/deployment.md`; `_to_delete/` and `docs/about-two-column-roadmap.md` remain untouched and untracked.

- [ ] **Step 7: Record activation as an external deployment step**

After the production hostname is available:

1. Add `federalistreader.com` in Cloudflare Web Analytics without changing its DNS or proxy settings.
2. Copy the generated site token into `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` in the personal `walkeonline` AWS Amplify app.
3. Deploy a fresh production build.
4. Open one live paper and confirm that its path appears in the Cloudflare dashboard after the documented processing delay.

Do not use a MotionPro, Vinli, or SOFICO AWS account for activation.
