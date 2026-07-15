# About Page Two-Column Design

**Date:** July 15, 2026
**Status:** Approved design

## Goal

Make `/about/` feel like a deliberate page from the same publication as the Federalist essays by using a two-column desktop composition. Preserve the About page's warm personal story, image, LetterJoy recommendation, historical context, and comfortable mobile reading order.

## Inputs and decision

This design incorporates the strongest ideas from `docs/about-two-column-roadmap.md`: use distinct editorial zones, reuse the existing gazette system, and never apply columns indiscriminately across figures and headings.

It intentionally departs from the roadmap's proposed multicolumn notes flow. Since that roadmap was drafted, the Charles Thomson section has become a substantial three-paragraph narrative. Treating it as one of four short, unsplittable notes would create badly unbalanced columns and diminish its importance.

The approved composition is **Option A: Composed family feature**.

## Editorial hierarchy

The page will have four zones beneath the existing compact masthead.

### 1. Headline

The About kicker and H1 remain a full-width editorial opening. The block is centered on the same approximately 58rem spine used by essay headings.

### 2. Origin story and portrait

The opening narrative, portrait, and LetterJoy notice form one feature package.

On wide screens:

- The two introductory paragraphs occupy the left column.
- The LetterJoy notice sits below those paragraphs in the left column.
- The portrait and caption occupy the right column and span the height of the narrative and notice.

On narrow screens, source order remains:

1. Introductory paragraphs
2. Portrait and caption
3. LetterJoy notice

The desktop grid must place the notice visually below the copy without changing this source order.

### 3. Charles Thomson narrative bridge

The Charles Thomson section becomes a full-width ruled bridge rather than an item inside the notes grid. On wide screens its heading occupies a narrow left rail, while all three paragraphs remain together in a comfortable prose column capped near 65–70 characters.

This section receives no drop cap. Drop caps remain reserved for the original Federalist essays.

### 4. Closing notes

“Their words, clearly set” and “A companion, not a lecture” form two equal columns. “No account, no tracking your reading” follows as a compact closing strip spanning both columns.

## Markup structure

`src/pages/about.astro` will preserve all existing text and links while replacing the single `.about-copy` wrapper with explicit zones. Ellipses in this structural sketch represent the current content copied without alteration:

```astro
<article class="paper-sheet about-page">
  <GazetteMasthead compact dateLine="A note to the reader" />

  <header class="about-lead">
    <p class="section-kicker">About this edition</p>
    <h1>A conversation with my mom, one paper at a time.</h1>
  </header>

  <div class="about-origin">
    <div class="about-origin__copy">
      <p class="about-lede">…</p>
      <p>…</p>
    </div>
    <figure class="about-portrait">…</figure>
    <aside class="about-callout" aria-labelledby="letterjoy-heading">…</aside>
  </div>

  <section class="about-family" aria-labelledby="family-heading">
    <h2 id="family-heading">A family thread through the founding</h2>
    <div class="about-family__copy">
      <p>…</p>
      <p>…</p>
      <p>…</p>
    </div>
  </section>

  <div class="about-notes">
    <section aria-labelledby="words-heading">…</section>
    <section aria-labelledby="notes-heading">…</section>
    <section class="about-notes__privacy" aria-labelledby="privacy-heading">…</section>
  </div>
</article>
```

The semantic headings, `aria-labelledby` relationships, alt text, caption, disclosure, and outbound links remain unchanged.

## Layout behavior

### Base and narrow screens

- All zones are a single column.
- The paper retains its existing safe-area-aware gutters.
- The portrait uses nearly the available width but never overflows the sheet.
- Major zones use `--space-2xl` separation; related content inside a zone uses the tighter existing spacing tokens.
- The three closing notes are separated by horizontal rules.

### Wide screens

The two-column composition activates at approximately `56rem`, only when the inner sheet can support useful measures. At narrower viewports and at 200% browser zoom, the page remains one column.

The origin feature uses CSS Grid with named areas:

```css
grid-template-areas:
  'copy portrait'
  'callout portrait';
grid-template-columns: minmax(0, 1.15fr) minmax(19rem, 0.85fr);
```

The gap uses existing tokens or a fluid `clamp()` derived from them. The copy column is capped near 55 characters. The portrait is capped around 26–28rem, remains uncropped, and aligns to the top/right of its column.

The family bridge uses a heading rail of approximately 12–14rem and one flexible prose column. The closing notes use an explicit two-column grid. The second note receives a fine one-pixel inline divider; the privacy note spans both columns and receives a top rule.

CSS Grid—not CSS multicolumn—is the structural tool because these are discrete editorial units, not one continuous essay.

## Typography and visual treatment

- Preserve the existing Libre Caslon display and reading families.
- Scope the kicker adjustment to `.about-page .section-kicker`: small-caps Libre Caslon in the essay-label voice.
- Do not change the shared home-page kicker.
- Preserve the existing body size and high-contrast ink color.
- Apply `text-wrap: balance` to headings and `text-wrap: pretty` to About prose where supported.
- Keep the existing portrait mat, oxblood inner rule, and caption styling.
- Remove the LetterJoy notice's thick inset side stripe. Use its existing tint and full border with a fine double top rule in verdigris, giving it the feel of a newspaper notice without resembling a modern card accent.
- Add no new animation, decorative imagery, or color roles.

## Responsive and print requirements

- At `320–895px`, the page is one column.
- At `896px` (`56rem`) and above, the origin feature, family bridge, and closing notes use their approved grids.
- At 200% zoom, the page must collapse rather than clip or create horizontal scrolling.
- Print forces every zone to one column, removes decorative grid dividers that no longer make sense, and protects the portrait, notice, and individual notes from awkward internal page breaks.

## Accessibility and content integrity

- Source order remains meaningful without CSS: headline → introduction → portrait → LetterJoy → Charles Thomson → edition notes → privacy.
- No CSS `order` values or JavaScript reordering may be used.
- All existing focus treatments remain visible.
- Links remain recognizable without relying on color alone.
- The layout must have zero horizontal overflow at supported widths.
- Existing text, links, disclosure, photo alt text, caption, and historical claims remain unchanged.
- The page remains fully rendered without JavaScript.

## Testing

### Static-output test

Extend `tests/about-page.test.ts` to verify:

- the new zone classes render;
- the source-order indices are introduction < portrait < LetterJoy < family < closing notes;
- the two short notes and spanning privacy note remain present;
- all existing copy, source, LetterJoy, and image assertions continue to pass.

### Browser tests

Add focused About-page layout coverage:

- At `1280×900`, introduction and LetterJoy share the left grid column, the portrait occupies the right column, the family heading is left of its prose, and the two short notes share a row.
- The privacy note is below and wider than either short note.
- At `390×844`, all zones share the same horizontal start, appear in source order, remain comfortably wide, and create no horizontal overflow.
- Just below the wide-layout threshold, the page is still one column.
- Print media computes to one-column zones.
- The existing Axe check for `/about/` remains clean.

### Visual review

Inspect at `320`, `390`, `768`, approximately `896`, `1280`, and `1440` CSS pixels, plus 200% browser zoom. Confirm:

- the portrait and left-column feature feel balanced;
- the LetterJoy notice reads as part of the origin story rather than an advertisement;
- the Charles section has clear prominence without excessive line length;
- no heading is stranded or clipped;
- the page has a varied editorial rhythm rather than repeated identical ruled sections.

## Non-goals

- Do not change the About-page prose.
- Do not change the photo asset or crop it.
- Do not redesign the site header, masthead, footer, or essay pages.
- Do not introduce JavaScript, dependencies, animation, or a generic layout component.
- Do not reproduce the essays' three narrow columns; About uses at most two wider columns.
