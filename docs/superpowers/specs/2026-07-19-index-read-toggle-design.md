# Toggle read state from the index ledger

**Date:** 2026-07-19
**Status:** Approved for implementation

## Problem

The index ledger shows each paper's read state ("○ Unread" / "✓ Read") but
cannot change it. Read state lives in localStorage, so a reader on a new
browser must open every already-read paper and mark it from the toolbar to
catch their ledger up — 30 page loads to record 30 papers.

## Design

The status cell each entry already carries becomes the control — no new
column, no layout change:

- **`IndexLedger.astro`**: the `.index-entry__status` paragraph becomes a
  `<button type="button">` with `aria-pressed`, hidden until the script
  binds (the ProgressControl convention — without JS the state is
  meaningless anyway). Clicking calls
  `preferences.setPaperRead(number, !read)` and re-runs the existing
  `render()`, which already refreshes everything downstream: the ✓/○
  printer's mark, the Read/Unread label, `data-read` styling, the
  "N of 85 read" summary, the status filter (a paper marked read while
  "Show: Unread" is active leaves the list immediately — the catch-up
  flow), and the continue-reading link.
- Accessible name: "Mark No. ⟨n⟩ as read" / "Mark No. ⟨n⟩ as unread",
  updated on every render.
- **index.css**: restyle the cell as a button — transparent, borderless,
  keeping the current ledger-line typography and placement. Padding with
  compensating negative margins enlarges the hit target without moving the
  visual line. Hover underlines the label the way the site's links do.

### Explicitly not doing

- No bulk "mark Nos. 1–30" range control; one honest toggle per row is the
  scope. (If catch-up proves tedious in practice, that is the next spec.)
- No cross-device sync; read state stays a per-browser localStorage fact,
  as the summary line already says.

## Testing

- e2e: from the index, clicking an entry's status toggle marks it read
  (✓, `data-read="true"`, summary increments) and clicking again unmarks
  it; with the "Show: Unread" filter active, marking a paper read removes
  its row from the visible list.
- Unit: the built index page renders 85 status buttons with
  `aria-pressed`.
