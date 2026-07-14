# About-page Family Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the supplied portrait of Mom and the site creator to the About page as a responsive, accessible editorial keepsake.

**Architecture:** A web-optimized JPEG will live with the static public assets and be rendered directly by the About page in a semantic `figure`. Page-specific CSS in the existing global stylesheet will provide the paper mat, rules, caption hierarchy, and responsive sizing without introducing a one-off component or runtime JavaScript.

**Tech Stack:** Astro 7, semantic HTML, responsive CSS, Vitest static-build assertions, Playwright accessibility and layout tests, macOS `sips` for deterministic JPEG resizing.

## Global Constraints

- Place the photo immediately after the two-paragraph opening story and before the LetterJoy callout.
- Preserve the complete portrait without a forced aspect-ratio crop.
- Caption it exactly: “Mom and me · July 4, 2026 · Sail4th 250, New York Harbor.”
- Keep the photograph’s natural color; do not add torn edges, faux tape, rotation, heavy filters, or period discoloration.
- Use intrinsic dimensions and lazy loading, retain the framed treatment on mobile, and prevent horizontal overflow.
- Do not alter the existing About copy, create a general gallery component, or add imagery elsewhere.

---

### Task 1: Add and present the family portrait

**Files:**
- Create: `public/images/mom-and-me-sail4th-2026.jpg`
- Modify: `tests/about-page.test.ts`
- Modify: `src/pages/about.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: the supplied 1536 × 2048 JPEG at `/Users/vwalke/Pictures/Photos Library.photoslibrary/scopes/cloudsharing/data/129163546/3ED6ABEC-A03D-4889-B542-FF740A2841CE/6D65F5A9-5E68-41E6-B185-A1FD35B77187.JPG`.
- Produces: the public URL `/images/mom-and-me-sail4th-2026.jpg` and the page-level classes `.about-portrait`, `.about-portrait__mat`, `.about-portrait__image`, and `.about-portrait__caption`.

- [ ] **Step 1: Add the failing static-build assertions**

Extend `tests/about-page.test.ts` inside the existing test:

```ts
expect(html).toContain('class="about-portrait"');
expect(html).toContain('src="/images/mom-and-me-sail4th-2026.jpg"');
expect(html).toContain('alt="Mom and me together at Sail4th 250 in New York Harbor"');
expect(html).toContain('width="1200"');
expect(html).toContain('height="1600"');
expect(html).toContain('loading="lazy"');
expect(html).toContain('decoding="async"');
expect(html).toContain('Mom and me');
expect(html).toContain('July 4, 2026 · Sail4th 250, New York Harbor');
```

- [ ] **Step 2: Build and run the About-page test to verify RED**

Run:

```bash
pnpm build && pnpm vitest run tests/about-page.test.ts
```

Expected: the build succeeds and the test fails because `class="about-portrait"` is absent from the generated About page.

- [ ] **Step 3: Create the optimized static asset**

Create `public/images/`, then use `sips` to make a 1200 × 1600 progressive-sized web JPEG while preserving the original 3:4 composition:

```bash
mkdir -p public/images
sips --resampleWidth 1200 --setProperty format jpeg --setProperty formatOptions 82 \
  /Users/vwalke/Pictures/Photos\ Library.photoslibrary/scopes/cloudsharing/data/129163546/3ED6ABEC-A03D-4889-B542-FF740A2841CE/6D65F5A9-5E68-41E6-B185-A1FD35B77187.JPG \
  --out public/images/mom-and-me-sail4th-2026.jpg
```

Verify the output dimensions:

```bash
sips -g pixelWidth -g pixelHeight public/images/mom-and-me-sail4th-2026.jpg
```

Expected: `pixelWidth: 1200` and `pixelHeight: 1600`.

- [ ] **Step 4: Add semantic portrait markup**

In `src/pages/about.astro`, insert this directly after the second introductory paragraph and before the LetterJoy `aside`:

```astro
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
```

- [ ] **Step 5: Add the editorial-keepsake styling**

Add these page-specific rules after `.about-copy__lede` in `src/styles/global.css`:

```css
.about-portrait {
  inline-size: min(100%, 34rem);
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
```

In the existing phone media query, add:

```css
.about-portrait {
  inline-size: calc(100% - 0.5rem);
}

.about-portrait__caption {
  display: grid;
}
```

- [ ] **Step 6: Build and run the focused test to verify GREEN**

Run:

```bash
pnpm build && pnpm vitest run tests/about-page.test.ts
```

Expected: one About-page test passes.

- [ ] **Step 7: Run full automated verification**

Run:

```bash
pnpm check
pnpm test:e2e
```

Expected: Astro checks, static build, all Vitest tests, and all Playwright tests pass with zero accessibility violations.

- [ ] **Step 8: Verify responsive presentation**

Start the local site and inspect `/about/` at 320 × 900, 390 × 1000, 768 × 1100, and 1280 × 900. Confirm that `document.documentElement.scrollWidth === document.documentElement.clientWidth`, the full portrait remains visible, the frame reads clearly, and the caption wraps without collision.

- [ ] **Step 9: Commit the implementation**

```bash
git add public/images/mom-and-me-sail4th-2026.jpg tests/about-page.test.ts src/pages/about.astro src/styles/global.css
git commit -m "feat: add family portrait to about page"
```
