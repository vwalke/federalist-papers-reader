# justif 0.6.1 → 0.9.1 visual compare

Gazette mode only. Left = 0.6.1, right = 0.9.1. Same routes, viewports
(390×844 and 1280×800), default text scale, and Gazette reading settings.
Shots waited for `document.fonts.ready` plus `p[data-justif]` / `.justif-seg`.

**Code change:** `package.json` / `pnpm-lock.yaml` pin only. The existing
`src/lib/essay-justify.ts` call (`justify` + `hyphenateEnUS` +
`observeResize: false`, `ready`, `destroy`, `unjustify`) typechecks and
builds against 0.9.1 without edits. `hangingPunctuation` was left at the
new default (`line-end-only`); old `"first-line"` is still an alias if we
need it later. No `--justif-*` CSS was added.

Essay body paragraphs have no hyperlinks or footnotes. Brutus No. 1’s
quoted Constitution clause and editorial `[brackets]` are the closest
stand-in.

## Pixel summary

Mean channel delta and changed-pixel ratio from the paired PNGs
(`pixel-diff.json`). “Identical” means <0.2% of pixels moved.

| Shot | Δ | Changed | Note |
|---|---|---|---|
| federalist-10 phone dropcap / viewport | 15.7 / 14.1 | 15% / 14% | Real reflow |
| federalist-10 phone hanging-edge | 21.8 | 21% | Same reflow, right-edge crop |
| federalist-10 desktop viewport / dropcap / hanging-edge / column-break | 3.4–4.4 | 5–6% | Same breaks; margin marks move |
| federalist-51 desktop column-break | 18.8 | 17% | Semicolon hang + tighter spaces |
| federalist-51 desktop/phone dropcap + viewport + hanging-edge | 2.9–5.3 | 4–6% | Same breaks; hang/protrusion |
| brutus-1 desktop hanging / column-break | 43.4 | 34% | Mid-essay reflow (tax paragraph) |
| brutus-1 desktop viewport | 12.2 | 12% | Same page, includes that paragraph |
| brutus-1 desktop/phone dropcap + editorial + phone viewport | 2.3–4.9 | 3–7% | Mostly hang/protrusion |
| brutus-1 desktop/phone hanging-edge | 14.1 / 6.0 | 13% / 8% | Right-edge hang + some reflow |

Several phone mid-paragraph clips failed (2 CSS px tall — the target
paragraph sat off-viewport). Those files were deleted. The viewport-open,
drop-cap, hanging-edge, and successful desktop crops cover the same
questions.

## What I saw

### Rivers / spacing evenness

- **Federalist 10, phone:** 0.9.1 packs more of the opening paragraph onto
  earlier lines. Loose gaps in 0.6.1 (around “proper cure for it.” /
  mid-paragraph) tighten. This is the largest, clearest spacing change.
- **Federalist 51:** line breaks in the drop-cap opener match. Interior
  word spaces look slightly more even once hanging marks leave the
  measure; the column-break crop of “the primary control on the
  government;” is the easiest place to see it.
- **Brutus 1, Great Primer, desktop:** the long taxation paragraph in
  column 2 is looser in 0.6.1 and denser in 0.9.1 (see hanging /
  column-break pair). Opening column 1 is much closer.

### Hyphenation

- **Federalist 10, phone:** different hyphen points. 0.6.1: `him-` /
  `pop-` / `improve-`. 0.9.1: `dan-` / `prin-` / `confu-` / `popu-`, and
  “himself” / “improvements” often stay whole.
- **Federalist 10, desktop** and **Federalist 51** (both widths): opener
  hyphen points match (`ten-`, `him-`, `dan-`, `prin-`, `nec-`, `inte-`).
- **Brutus 1, desktop, mid-essay:** 0.9.1 hyphenates `govern-ment` in a
  place 0.6.1 kept whole. Opening drop-cap hyphen points (`commu-`,
  `inter-`) match on phone.

### Hanging punctuation / quotes

New default is line-end hang (hyphens, commas, periods, `;`, `?`). I did
not pin the old first-line default.

- Desktop hanging-edge crops (same scroll as the viewport-open shots):
  0.9.1 hyphens sit on or past the column rule; 0.6.1 keeps them inside
  the letter edge. Same pattern on Federalist 10, 51, and Brutus 1.
- Federalist 51 column-break: the semicolon after “government” hangs
  further in 0.9.1.
- Federalist 10 / 51 openers have no quotation marks. Brutus’s quoted
  Constitution clause lives in the long mid-essay paragraph; the
  desktop hanging crop of that paragraph is the quote/bracket sample.
- Opening-quote hang is no longer the default. None of these openers
  start with a quote, so that particular default change does not show
  here. It does **not** break the newspaper columns in these shots.

### Column overflow

No overflow, no clipped glyphs past the sheet, no `.justif-seg` wider
than a column in the screenshots. Desktop still sets 3 columns; phone
stays 1. Column-break positions on Federalist 10 and 51 desktop
viewport-open shots match (same last words at the column bottoms).
Brutus 1 desktop column 2/3 start at the same sentences in the
viewport-open pair; the tax paragraph *inside* column 2 reflows.

### Drop-cap wrap

Wrap around the green **A** (Federalist 10), green **T** (51), and red
**W** (Brutus 1) matches on every drop-cap crop. First-line indent
beside the float does not collapse.

### Great Primer (Brutus 1)

Journal sheets still set IM Fell Great Primer. The face is larger and
the oxblood drop-cap is intact. Changes are the same class as Publius
(line-end hang; one denser mid-essay paragraph on desktop), not a
broken measure.

## Reader mode (not in the compare set)

A post-bump check on `/papers/10/` with `publius:reading-mode=reader`:
`data-reading-mode=reader`, `p[data-justif]` count 0, `.justif-seg`
count 0, first paragraph `text-align: left`. Gazette enhancement still
tears down.

## Follow-up (not done)

If Vann wants the old first-line hang back, pass
`hangingPunctuation: 'first-line'` (aliased to
`first-line-and-line-ends`) in `essay-justify.ts`. I am not adding that
unless the new default is rejected — these shots do not show a column
breakage that would force it.
