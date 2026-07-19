# Fold the mark-read colophon into the Next cell

**Date:** 2026-07-19
**Status:** Approved for implementation
**Supersedes:** 2026-07-19-essay-colophon-design.md

## Problem

The colophon shipped earlier today costs a full bordered block at the foot of
an already busy sheet, its finis line adds nothing, and once a paper is
marked read the page shows two links to the same next paper (the colophon's
"Continue" button and the navigation grid's Next cell).

## Design

Remove the colophon entirely. The Next cell of the existing navigation grid
becomes the combined action — no new furniture, no added height:

```
├───────────────────────┬───────────────────────┤
│ ← PREVIOUS            │ MARK READ & CONTINUE →│   (unread)
│ No. IX: …             │ No. XI: …             │
├───────────────────────┼───────────────────────┤
│ ← PREVIOUS            │                NEXT → │   (already read)
│ No. IX: …             │ No. XI: …             │
```

- **`EssayNavigation.astro`** gains a `number` prop (the current paper). The
  next anchor carries `data-continue-control` plus unread/read label text:
  - next paper exists: unread → "Mark read & continue →", read → "Next →"
  - last paper (No. 85): unread → "Mark read & finish →", read → "The full
    collection →"; destination line stays "Return to the index".
  A small script sets the label from stored state on load, relabels on the
  `paper-read-change` event (so toggling the toolbar control updates it
  live), and on click does exactly what the label states: in the unread
  state it records the paper as read before navigating; in the read state
  it is plain navigation with no writes.
- **`EssayColophon.astro`** is deleted, along with its layout usage and all
  `.essay-colophon` CSS (including the reader-measure entry and mobile
  stacking rule). No new CSS is needed: the label span keeps the existing
  `essay-navigation__label` styling.
- **`ProgressControl.astro`** keeps the multi-instance sync refactor and the
  `paper-read-change` event — the toolbar toggle remains the only
  mark-without-leaving control, and the event now drives the Next label.
- The Previous cell never marks anything.

### Explicitly not doing

- No separate bottom "mark as read" toggle: the combined Next action covers
  the finish-and-continue flow, and the toolbar toggle covers mark-and-stay.
- No hidden side effects: the cell never does anything its current label
  does not say.

## Testing

- e2e: toolbar toggle flips the Next label between "Mark read & continue →"
  and "Next →"; clicking the unread Next cell on No. 1 lands on
  `/papers/2/` with No. 1 recorded read in the index ledger.
- Unit: paper 1 renders `data-continue-control="1"` with the combined
  label; paper 85 renders the finish variant; colophon markup is gone.
