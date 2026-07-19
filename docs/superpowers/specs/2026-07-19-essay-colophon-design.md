# Essay colophon: mark read & continue from the foot of the paper

**Date:** 2026-07-19
**Status:** Approved for implementation

## Problem

The only "Mark as read" control sits in the reading toolbar at the top of each
paper. A reader finishes at the bottom — past the commentary, the share
colophon, and the subscription coupon — and must scroll back to the top to
record the paper as read, then find the Next link again. The natural moment of
completion has no affordance.

## Design

A new **essay colophon** block sits between the essay coda and the
Previous/Next grid, styled as period printer's furniture so the two read as
one closing "departure block" on the sheet:

```
┌───────────────────────────────────────────────┐
│                     ❧                         │
│              HERE ENDS No. X.                 │
│                                               │
│  [ ✓ Mark as read ]  [ MARK READ & CONTINUE → ]│
├───────────────────────┬───────────────────────┤
│ ← Previous            │                Next → │
│ No. IX: …             │              No. XI: …│
└───────────────────────┴───────────────────────┘
```

### Components

- **`EssayColophon.astro`** (new) — props `number: number`,
  `next: { number, title } | null`. Renders:
  - A centered fleuron ornament and small-caps finis line
    ("Here ends No. ⟨roman⟩.") echoing the essay heading's Roman numerals.
  - A **secondary control**: the existing `ProgressControl` component,
    reused verbatim — mark/unmark without leaving the page.
  - A **primary combined action** `[data-continue-control]`: an anchor to
    the next paper (or `/#all-papers` on No. 85) that calls
    `preferences.setPaperRead(number, true)` on click before navigation
    (localStorage is synchronous, so no navigation delay). Its label adapts
    to read state:
    - unread → "Mark read & continue" (next) / "Mark read & return to the
      collection" (last paper)
    - already read → "Continue to No. ⟨n⟩" / "Return to the collection"
- **`ProgressControl.astro`** (refactor) — the click handler currently
  re-renders only the clicked button. Refactor so a change re-renders **every**
  control bound to the same paper number, and dispatches a
  `paper-read-change` CustomEvent (`{ number, read }`) on `document`. The
  colophon listens to relabel its combined action; toolbar and colophon
  toggles stay in sync both ways.
- **`PaperLayout.astro`** — render `<EssayColophon>` between `.essay-coda`
  and `<EssayNavigation>`.

### Visual language (paper.css)

- `.essay-colophon`: 1px `--color-rule` border box, `--color-newsprint`
  ground, bottom border shared with `.essay-navigation` (nav's top margin
  collapses to 0 after a colophon) so the two form one bordered unit.
- Fleuron in oxblood; finis line in the small-caps utility style used by
  section kickers.
- Combined action styled like the subscribe coupon's button (ink fill, paper
  text, uppercase utility face) — the page's one filled primary at this
  point. The toggle keeps its oxblood outline style.
- Mobile (≤46rem): action row stacks, both controls full width; the colophon
  toggle keeps its text label (override the toolbar's icon-only collapse,
  which is scoped by element context).
- Reader mode: `.essay-colophon` joins the `max-inline-size` measure list so
  it tracks the text column.

### Explicitly not doing

- No auto-mark on plain Next/Previous navigation — skimming ahead must never
  silently mark a paper read.
- No sticky/floating "done" bar — fights the period aesthetic and adds
  scroll-position JS for no gain over end-of-sheet furniture.

## Testing

- e2e (`reader.spec.ts`): scope the existing mark-read test to the toolbar
  control; add coverage that (1) toggling either control syncs the other and
  relabels the combined action, (2) clicking the combined action on No. 1
  lands on `/papers/2/` with No. 1 recorded read (index ledger shows
  `data-read="true"`).
- Unit (`paper-page.test.ts`): existing check-mark assertion still passes;
  add an assertion that the colophon renders the combined action href to the
  next paper.
