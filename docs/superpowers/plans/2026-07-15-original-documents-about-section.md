# Original Documents About Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a photo-led About-page section connecting the Charles Thomson family story to seeing an original Declaration printing with Seth Kaller at *The Promise of Liberty*.

**Architecture:** Keep the one-off editorial section in `about.astro`, with a committed, optimized local photograph and section-scoped `about-documents` styles. Source order remains heading → figure → copy; CSS turns it into a figure-left editorial grid only at the existing 56rem About-page breakpoint.

**Tech Stack:** Astro 7 static output, semantic HTML, CSS Grid, ffmpeg image conversion, Vitest 4 static-output tests, Playwright 1.61 responsive browser tests

## Global Constraints

- Place the new section immediately after “A family thread through the founding” and before “Their words, clearly set” / “A companion, not a lecture.”
- Preserve source order heading → figure → copy.
- Use the approved kicker, heading, three paragraphs, two link labels, two destinations, alternative text, and caption verbatim from the design specification.
- Preserve the complete 3,632 × 4,744 photograph composition without cropping; commit a metadata-free 1,200 × 1,567 JPEG derivative.
- Use a restrained dark museum mat, fine brass-colored rule, paper-toned border, and quiet shadow; use solid colors and existing design tokens only.
- At 56rem and wider, place the figure left and the heading/copy right; below 56rem, use one column in source order.
- Do not add gradients, ornamental aging, faux damage, animation, embedded third-party scripts, affiliate copy, sponsorship copy, prices, or new reusable components.
- Do not alter Federalist paper pages, analytics, navigation, LetterJoy, Charles Thomson copy, the existing family photograph, edition notes, or the WalkeForward colophon.
- External links open in the same browsing context.
- Preserve unrelated untracked `_to_delete/` and `docs/about-two-column-roadmap.md` content.
- Do not stop or replace the existing review server on port `4321`; use port `4323` for isolated Playwright verification.

---

## File Structure

- Create `public/images/mom-and-seth-promise-of-liberty-2026.jpg`: optimized local derivative of the supplied photograph.
- Modify `src/pages/about.astro`: add the unique editorial section, figure, caption, copy, links, and separating rule.
- Modify `tests/about-page.test.ts`: verify exact copy, image contract, links, caption, and narrative order.
- Modify `src/styles/global.css`: add focused base, wide-screen, mobile/print, and forced-color-safe styling.
- Modify `tests/e2e/about.spec.ts`: verify desktop and mobile geometry, caption attachment, intermediate fallback, print fallback, and overflow.

---

### Task 1: Photograph and Editorial Markup

**Files:**
- Create: `public/images/mom-and-seth-promise-of-liberty-2026.jpg`
- Modify: `tests/about-page.test.ts`
- Modify: `src/pages/about.astro`

**Interfaces:**
- Consumes: source photograph `/Users/vwalke/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard/items/C38F0740-7703-4016-A948-7602E5CEB1F3/IMG_1978.jpeg`.
- Produces: a static image at `/images/mom-and-seth-promise-of-liberty-2026.jpg` with intrinsic dimensions 1,200 × 1,567, and a semantic `.about-documents` section in heading → figure → copy source order.

- [ ] **Step 1: Add failing static-output assertions**

In `tests/about-page.test.ts`, add these class assertions with the existing About structure assertions:

```ts
    expect(html).toContain('class="about-documents"');
    expect(html).toContain('class="about-documents__head"');
    expect(html).toContain('class="about-documents__figure"');
    expect(html).toContain('class="about-documents__copy"');
```

Immediately after the existing `colophonIndex` declaration—so `notesIndex` is already initialized—add:

```ts
    const documentsIndex = html.indexOf('class="about-documents"');
    const documentsHtml = html.slice(documentsIndex, notesIndex);
```

After the existing index-presence and ordering assertions, add:

```ts
    expect(documentsIndex).toBeGreaterThan(familyIndex);
    expect(documentsIndex).toBeLessThan(notesIndex);
```

Before the end of the test, add the complete content contract:

```ts
    expect(html).toContain('History in the room');
    expect(html).toContain('Nothing substitutes for the real thing.');
    expect(html).toContain('We are fortunate to know Seth Kaller');
    expect(html).toContain('On July 5, 2026, Mom and I visited');
    expect(html).toContain('The Promise of Liberty: Words That Shaped a Nation');
    expect(html).toContain('carrying the printed signature of Charles Thomson—her fifth-great-uncle');
    expect(html).toContain('Here it was, in ink and paper, directly in front of us.');
    expect(html).toContain('no screen can reproduce the scale, texture, survival, and sheer presence');
    expect(html).toContain('wanting to bring a piece of history home');
    expect(html).toContain('href="https://www.thepromiseofliberty.org/"');
    expect(html).toContain('Follow <em>The Promise of Liberty</em>');
    expect(html).toContain('href="https://www.sethkaller.com/"');
    expect(html).toContain('Explore history you can own');
    expect(html).toContain('src="/images/mom-and-seth-promise-of-liberty-2026.jpg"');
    expect(html).toContain(
      'alt="Seth Kaller showing Mom a framed printing of the Declaration of Independence at The Promise of Liberty exhibition"',
    );
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="1567"');
    expect(html).toContain('loading="lazy"');
    expect(documentsHtml).toContain('decoding="async"');
    expect(documentsHtml).not.toContain('target="_blank"');
    expect(html).toContain('Mom and Seth Kaller');
    expect(html).toContain('With a printing of the Declaration carrying Charles Thomson’s printed signature.');
    expect(html).toContain('July 5, 2026 ·');
    expect(html).toContain('South Street Seaport Museum, New York City.');
```

- [ ] **Step 2: Build and confirm the static test fails for the missing section**

Run:

```bash
pnpm build && pnpm test -- tests/about-page.test.ts
```

Expected: FAIL at the first `.about-documents` assertion.

- [ ] **Step 3: Create the optimized local photograph**

Run this exact conversion from the repository root:

```bash
ffmpeg -y \
  -i '/Users/vwalke/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard/items/C38F0740-7703-4016-A948-7602E5CEB1F3/IMG_1978.jpeg' \
  -map_metadata -1 \
  -vf 'scale=1200:1567:flags=lanczos' \
  -frames:v 1 \
  -q:v 3 \
  public/images/mom-and-seth-promise-of-liberty-2026.jpg
```

Verify its contract:

```bash
sips -g pixelWidth -g pixelHeight public/images/mom-and-seth-promise-of-liberty-2026.jpg
ls -lh public/images/mom-and-seth-promise-of-liberty-2026.jpg
```

Expected: width `1200`, height `1567`, and a substantially smaller file than the 2.8 MB source. If ffmpeg reports a JPEG pixel-format deprecation warning but exits successfully and the dimensions are correct, record the warning in the task report; do not introduce a new image dependency solely to suppress it.

- [ ] **Step 4: Add the approved semantic section**

In `src/pages/about.astro`, keep the existing ornamental rule after `.about-family`, then insert this section before `.about-notes`:

```astro
    <section class="about-documents" aria-labelledby="documents-heading">
      <header class="about-documents__head">
        <p class="section-kicker">History in the room</p>
        <h2 id="documents-heading">Nothing substitutes for the real thing.</h2>
      </header>

      <figure class="about-documents__figure">
        <div class="about-documents__mat">
          <img
            class="about-documents__image"
            src="/images/mom-and-seth-promise-of-liberty-2026.jpg"
            alt="Seth Kaller showing Mom a framed printing of the Declaration of Independence at The Promise of Liberty exhibition"
            width="1200"
            height="1567"
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption class="about-documents__caption">
          <strong>Mom and Seth Kaller</strong>
          <span>
            With a printing of the Declaration carrying Charles Thomson’s printed signature. July
            5, 2026 · <em>The Promise of Liberty</em>, South Street Seaport Museum, New York City.
          </span>
        </figcaption>
      </figure>

      <div class="about-documents__copy">
        <p>
          We are fortunate to know Seth Kaller, one of the country’s leading experts in original
          American documents. On July 5, 2026, Mom and I visited
          <em>The Promise of Liberty: Words That Shaped a Nation</em> at the South Street Seaport
          Museum, an extraordinary exhibition curated by Seth and the museum.
        </p>
        <p>
          The moment in this photograph could hardly have been more personal: Seth was showing Mom
          a historic printing of the Declaration of Independence carrying the printed signature of
          Charles Thomson—her fifth-great-uncle. We had read about Thomson’s place in the founding.
          Here it was, in ink and paper, directly in front of us.
        </p>
        <p>
          This site can make the Federalist Papers inviting, but no screen can reproduce the scale,
          texture, survival, and sheer presence of an original document. If
          <em>The Promise of Liberty</em>—or any exhibition of original historical material—comes
          near you, go see it. And if you find yourself wanting to bring a piece of history home,
          Seth’s collection is a fascinating place to begin.
        </p>
        <p class="about-documents__links">
          <a class="about-documents__link" href="https://www.thepromiseofliberty.org/">
            Follow <em>The Promise of Liberty</em> <span aria-hidden="true">↗</span>
          </a>
          <a class="about-documents__link" href="https://www.sethkaller.com/">
            Explore history you can own <span aria-hidden="true">↗</span>
          </a>
        </p>
      </div>
    </section>

    <div class="about-rule" aria-hidden="true"><span class="about-rule__mark"></span></div>
```

The first rule separates Charles Thomson from the encounter; the newly added second rule separates the encounter from the edition notes.

- [ ] **Step 5: Rebuild and run the focused static test**

Run:

```bash
pnpm build && pnpm test -- tests/about-page.test.ts
```

Expected: the About static-output test PASSes with the exact copy, asset contract, links, caption, and narrative order.

- [ ] **Step 6: Commit the photograph and editorial markup**

```bash
git add public/images/mom-and-seth-promise-of-liberty-2026.jpg src/pages/about.astro tests/about-page.test.ts
git commit -m "feat: add original documents story to About page"
```

---

### Task 2: Museum Presentation and Responsive Verification

**Files:**
- Modify: `tests/e2e/about.spec.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `.about-documents`, `.about-documents__head`, `.about-documents__figure`, `.about-documents__image`, `.about-documents__caption`, and `.about-documents__copy` from Task 1.
- Produces: a figure-left two-column grid at ≥56rem, a source-ordered single column below 56rem and in print, and a fully attached image caption without horizontal overflow.

- [ ] **Step 1: Add failing wide-screen geometry assertions**

In the first test in `tests/e2e/about.spec.ts`, add these values to the object returned from `.about-page`:

```ts
      documentsDisplay: getComputedStyle(
        about.querySelector('.about-documents') as Element,
      ).display,
      documentsHead: box('.about-documents__head'),
      documentsFigure: box('.about-documents__figure'),
      documentsImage: box('.about-documents__image'),
      documentsCaption: box('.about-documents__caption'),
      documentsCopy: box('.about-documents__copy'),
```

Add these assertions after the existing family geometry assertions:

```ts
  expect(layout.documentsDisplay).toBe('grid');
  expect(layout.documentsFigure.x).toBeLessThan(layout.documentsHead.x);
  expect(layout.documentsFigure.x).toBeLessThan(layout.documentsCopy.x);
  expect(Math.abs(layout.documentsHead.x - layout.documentsCopy.x)).toBeLessThan(2);
  expect(layout.documentsCopy.y).toBeGreaterThan(layout.documentsHead.y);
  expect(layout.documentsCaption.y).toBeGreaterThan(
    layout.documentsImage.y + layout.documentsImage.height,
  );
  expect(layout.documentsCaption.y + layout.documentsCaption.height).toBeLessThanOrEqual(
    layout.documentsFigure.y + layout.documentsFigure.height + 1,
  );
```

- [ ] **Step 2: Add failing mobile source-order assertions**

In the mobile test, add these selectors between `.about-family` and `.about-notes` in the existing `selectors` array:

```ts
      '.about-documents__head',
      '.about-documents__figure',
      '.about-documents__copy',
```

Add this returned value:

```ts
      documentsDisplay: getComputedStyle(
        about.querySelector('.about-documents') as Element,
      ).display,
```

Replace the current sequence of six `boxes` order assertions with these eight transitions:

```ts
  expect(layout.boxes[0].y).toBeLessThan(layout.boxes[1].y);
  expect(layout.boxes[1].y).toBeLessThan(layout.boxes[2].y);
  expect(layout.boxes[2].y).toBeLessThan(layout.boxes[3].y);
  expect(layout.boxes[3].y).toBeLessThan(layout.boxes[4].y);
  expect(layout.boxes[4].y).toBeLessThan(layout.boxes[5].y);
  expect(layout.boxes[5].y).toBeLessThan(layout.boxes[6].y);
  expect(layout.boxes[6].y).toBeLessThan(layout.boxes[7].y);
  expect(layout.boxes[7].y).toBeLessThan(layout.boxes[8].y);
```

Add:

```ts
  expect(layout.documentsDisplay).toBe('block');
```

The final selector array contains nine entries: origin copy, existing portrait, LetterJoy callout, family, documents head, documents figure, documents copy, notes, and colophon.

- [ ] **Step 3: Add intermediate and print fallback assertions**

In the 880px test, add `documents` to the returned display values:

```ts
    documents: getComputedStyle(about.querySelector('.about-documents') as Element).display,
```

and assert:

```ts
  expect(displays.documents).toBe('block');
```

In the print test, add the same `documents` value and assertion:

```ts
  expect(printLayout.documents).toBe('block');
```

- [ ] **Step 4: Run the focused browser test and confirm the unstyled layout fails**

Run:

```bash
PLAYWRIGHT_PORT=4323 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: the wide-screen test FAILS because `.about-documents` is `block` and the figure is not positioned left of the heading/copy. Mobile source order may already pass because the HTML order is correct.

- [ ] **Step 5: Add base museum and single-column styles**

In `src/styles/global.css`, add `.about-documents` to the shared 74rem About width selector:

```css
.about-origin,
.about-family,
.about-documents,
.about-notes {
  max-inline-size: 74rem;
}
```

Add this section after the existing `.about-family__copy` rules and before `.about-notes`:

```css
.about-documents {
  margin-inline: auto;
}

.about-documents__head h2 {
  max-inline-size: 20ch;
  margin-block-start: var(--space-xs);
}

.about-documents__figure {
  inline-size: min(100%, 34rem);
  margin: var(--space-xl) auto 0;
}

.about-documents__mat {
  padding: clamp(0.55rem, 2vw, 0.85rem);
  border: 0.35rem solid color-mix(in oklab, var(--color-paper) 82%, var(--color-newsprint));
  outline: 1px solid var(--color-ink);
  background: color-mix(in oklab, var(--color-room) 88%, var(--color-paper));
  box-shadow: 0.45rem 0.55rem 0 color-mix(in oklab, var(--color-ink) 18%, transparent);
}

.about-documents__image {
  display: block;
  inline-size: 100%;
  block-size: auto;
  border: 2px solid color-mix(in oklab, var(--color-newsprint) 66%, var(--color-oxblood));
  background: var(--color-room);
}

.about-documents__caption {
  display: grid;
  gap: 0.25rem;
  padding-block-start: var(--space-sm);
  color: var(--color-muted-ink);
  font: 600 0.72rem/1.45 var(--font-utility);
  letter-spacing: 0.025em;
}

.about-documents__caption strong {
  color: var(--color-oxblood);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.about-documents__copy {
  max-inline-size: 58ch;
  margin-block-start: var(--space-xl);
}

.about-documents__copy p + p {
  margin-block-start: var(--space-md);
}

.about-documents__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm) var(--space-lg);
  padding-block-start: var(--space-md);
  border-block-start: 1px solid color-mix(in oklab, var(--color-rule) 62%, transparent);
}

.about-documents__link {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-xs);
  color: var(--color-verdigris);
  font-weight: 700;
  text-decoration-thickness: 0.1em;
}
```

- [ ] **Step 6: Add the wide-screen figure-left grid**

Inside the existing `@media (min-width: 56rem)` block, after `.about-family__head + .about-family__copy`, add:

```css
  .about-documents {
    display: grid;
    grid-template-areas:
      'figure head'
      'figure copy';
    grid-template-columns: minmax(20rem, 0.9fr) minmax(0, 1.1fr);
    gap: var(--space-xl) clamp(var(--space-xl), 4vw, var(--space-2xl));
    align-items: start;
  }

  .about-documents__head {
    grid-area: head;
  }

  .about-documents__figure {
    grid-area: figure;
    inline-size: 100%;
    max-inline-size: 30rem;
    margin: 0;
    justify-self: start;
  }

  .about-documents__copy {
    grid-area: copy;
    margin-block-start: 0;
  }
```

- [ ] **Step 7: Add print and forced-colors safeguards**

In `@media (forced-colors: active)`, add:

```css
  .about-documents__mat,
  .about-documents__image {
    border-color: CanvasText;
    background: Canvas;
  }

  .about-documents__mat {
    outline-color: CanvasText;
  }
```

In `@media print`, add `.about-documents` to the existing block-layout selector:

```css
  .about-origin,
  .about-family,
  .about-documents,
  .about-notes {
```

Add `.about-documents__copy` to the existing unrestricted measure selector:

```css
  .about-origin__copy,
  .about-family__copy,
  .about-documents__copy {
```

Add this figure rule after `.about-portrait`:

```css
  .about-documents__figure {
    max-inline-size: 24rem;
    break-inside: avoid;
  }
```

Add `.about-documents__figure` to the existing break-inside selector:

```css
  .about-callout,
  .about-family,
  .about-documents__figure,
  .about-notes > section {
```

- [ ] **Step 8: Run focused browser and static verification**

Run:

```bash
pnpm build
pnpm test -- tests/about-page.test.ts
PLAYWRIGHT_PORT=4323 pnpm test:e2e tests/e2e/about.spec.ts
```

Expected: the About static-output test PASSes and all four About browser tests PASS at wide, mobile, intermediate, and print layouts with no overflow.

- [ ] **Step 9: Run the complete project verification**

Run:

```bash
git diff --check
pnpm check
PLAYWRIGHT_PORT=4323 pnpm test:e2e
```

Expected: no whitespace errors; Astro diagnostics, content validation, configured/unconfigured analytics verification, all Vitest tests, and all 17 or more Playwright tests PASS.

- [ ] **Step 10: Commit the responsive presentation**

```bash
git add src/styles/global.css tests/e2e/about.spec.ts
git commit -m "style: present original documents story as museum feature"
```
