# Gazette justif justification

**Date:** 2026-07-22
**Status:** Approved (amended same day for justif 0.5.0)

## Amendment: justif 0.5.0

Upstream fixed the floated `::first-letter` bug (justif e1fb682, v0.5.0)
and the drop-cap opener was briefly enhanced. Two further defects
surfaced, so **the drop-cap exclusion is back** and the opener stays on
native justify (which handles the float correctly):

- CSS `hyphens: auto` defeats 0.5.0's drop-cap support entirely: first
  lines set at the full measure and clear below the float
  (single-variable repro; lyallcooper/justif#4). Worked around by setting
  `hyphens: manual` inline on paragraphs the module enhances — kept, since
  justif supplies its own hyphenation and this isolates it from CSS
  hyphenation generally.
- Even with that workaround, a line that hyphenates at the float boundary
  is measured beside the float but rendered below it, leaving a ragged
  right gap (No. 2: "ques-" line set 290 px wide in a 367 px column,
  placed at full-left below the "W"; No. 10 showed the same with "ten-").
  Reported as lyallcooper/justif#5; revisit the exclusion when it's fixed.
- The multicol fragmentation exclusion remains; 0.5.0 does not address it.

## Goal

Set the Gazette view's essay text with true Knuth–Plass justification using
[justif](https://github.com/lyallcooper/justif) 0.4.2, matching how The
Independent Journal and its peers actually composed columns in 1787. Reader
mode stays ragged right: uniform word spacing is the evidence-backed choice
for modern reading (WCAG 1.4.8 advises against full justification; dyslexia
style guides recommend left alignment).

Findings from the live-injection experiment (2026-07-22, artifact
`claude.ai/code/artifact/25f16ac9-ba4d-4452-8744-f6a80cdc46cf`):

- Whole-paragraph optimization saves ~13 of 365 lines on No. 10 and removes
  the loose-spacing "rivers" native CSS justify produces at the Gazette's
  ~356 px measure.
- justif mis-measures paragraphs with a floated `::first-letter` drop cap
  (first line overflows the gutter). The opening paragraph must be excluded.
- justif mis-measures paragraphs fragmented across CSS multicol column
  breaks (it sees the full spread width, ~736 px). Fragmented paragraphs
  must be excluded per layout pass.
- Full-essay enhancement costs ~280 ms, run after fonts load.

## Behavior

- **Baseline (no JS / unsupported browsers):** in Gazette mode every essay
  paragraph except the signature gets `text-align: justify` via CSS. Native
  justification is period-appropriate even without justif's refinements.
- **Enhanced:** after `document.fonts.ready`, justif re-breaks every
  eligible paragraph with en-US TeX hyphenation, hanging punctuation, and
  per-line spacing. Ineligible paragraphs (drop cap, signature, paragraphs
  straddling a column break) keep native justify, so margins stay flush
  everywhere.
- **Mode toggle:** switching to Reader unjustifies everything (frozen
  gazette line breaks must not leak into the single-column layout); Reader
  rendering is unchanged from today. Switching back re-plans and re-applies.
- **Text-size slider / viewport resize:** re-plan and re-apply, debounced.
  Fragmentation eligibility is recomputed each pass because column breaks
  move.
- **Period spellings (fœderal/federal):** the toolbar swaps text before the
  module re-justifies, so measurements always see the current text.

## Components

### `src/lib/essay-justify.ts` (new)

Owns the justif lifecycle. Exports:

- `selectJustifiable(paras: ParagraphInfo[]): number[]` — pure eligibility
  planner (unit-tested): excludes index 0 (drop cap), `essay-signature`,
  already-enhanced paragraphs, and paragraphs whose `fragmentCount > 1`.
- `initEssayJustify(): void` — wires everything:
  - waits for `document.fonts.ready`, then runs up to two enhancement
    passes (pass two catches paragraphs that stopped straddling a column
    break after pass one shortened the flow), with a settle delay between;
  - listens for the toolbar's `publius:reading-changed` event: `reader` →
    unjustify all; `gazette`/scale change → full refresh;
  - observes `.essay-flow` width with a debounced ResizeObserver and
    refreshes only when the width actually changed (justif's own layout
    mutations must not retrigger);
  - guards against stale async passes with a generation counter.

Dependency: `justif@0.4.2` (exact), imported as
`import { justify, unjustify } from 'justif'` and
`import { hyphenateEnUS } from 'justif/hyphenate/en-us'`, bundled by Astro.
No external origins — same policy as the Fontsource fonts.

### `src/components/ReadingToolbar.astro` (edit)

`applyMode` and `applyTextScale` dispatch
`document.dispatchEvent(new CustomEvent('publius:reading-changed', { detail: { mode, scale } }))`
after applying their changes (after period-spelling swaps in particular).
The toolbar stays ignorant of justif.

### `src/styles/paper.css` (edit)

```css
[data-reading-mode='gazette'] .essay-body p:not(.essay-signature) {
  text-align: justify;
}
```

The `:not()` keeps the PUBLIUS signature on its existing `text-align: end`
(the attribute+class selector would otherwise outweigh `.essay-signature`).

### `src/layouts/PaperLayout.astro` (edit)

Module script: import and call `initEssayJustify()`. Paper pages only.

## Testing

- **Unit (vitest):** `tests/essay-justify.test.ts` covers
  `selectJustifiable` — drop-cap exclusion, signature exclusion,
  fragmentation exclusion, already-enhanced exclusion, happy path.
- **e2e (Playwright, `tests/e2e/reader.spec.ts`):** in Gazette mode,
  eligible essay paragraphs gain `data-justif` and computed
  `text-align: justify`; toggling to Reader removes enhancement and
  restores ragged left; moving the text-size slider re-enhances. Run with
  `PLAYWRIGHT_PORT` set per the project workflow note.
- **Manual:** dev-server check of No. 10 including the two paragraphs that
  straddle column breaks, mode toggling, slider sweep, and a narrow
  viewport.

## Trade-offs accepted

- One visible re-break shortly after fonts load (baseline native justify →
  justif lines). Margins do not move; only some break points shift.
  Avoiding it would need render-blocking JS, rejected for this site.
- Straddling paragraphs keep native justify. Flush margins are preserved;
  those paragraphs may show slightly looser spacing. Upstream fixes
  (drop-cap and multicol measurement) may later shrink the exclusion list.
