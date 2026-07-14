# Reading Experience Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace artificial page damage, clarify reading controls, repair the companion layout, correct publication ordering, and add the personal LetterJoy and Charles Thomson story.

**Architecture:** Keep the existing Astro component boundaries. Expand the deterministic paper-wear helper into SVG-ready paths and tones, render the decorative SVG inside `PaperWear.astro`, and use responsive CSS for visual treatment. Treat copy, publication data, and index labels as server-rendered content while preserving the existing client-side preferences and sorting functions.

**Tech Stack:** Astro 7, TypeScript, Vitest, Playwright, CSS, inline SVG, static content.

## Global Constraints

- Work only in the existing `feature/mock-fidelity` linked worktree.
- Preserve static AWS-compatible output and local-only reading preferences.
- Remove clipped corners and triangular nicks; do not remove readable sheet area.
- Wear remains decorative, deterministic per paper, subtle, and disabled in Reader/print/forced-colors/reduced-transparency modes.
- The toolbar presents exactly two visible reading-style choices.
- The companion is readable at 320px and balanced at wide desktop widths.
- Use the exact LetterJoy URL supplied by the user.
- Describe Charles Thomson's Declaration role precisely.

---

### Task 1: Correct publication chronology and clarify sorting

**Files:**
- Modify: `tests/content.test.ts`
- Modify: `tests/e2e/index.spec.ts`
- Modify: `src/content/papers/026.md`
- Modify: `src/components/IndexLedger.astro`

**Interfaces:**
- Preserves `selectIndexPapers(papers, { sort: 'date' })`.
- Produces visible options `Paper order` and `First publication`.

- [ ] Add a failing content assertion that Paper 26 uses `1787-12-22` and a failing E2E assertion for the revised labels and chronology note.
- [ ] Run `pnpm build && pnpm test tests/content.test.ts` and the focused index E2E test; confirm failures describe the old date and labels.
- [ ] Correct both Paper 26 date fields and revise the sort copy plus explanatory note.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit with `fix: clarify Federalist publication chronology`.

### Task 2: Redesign the reading-style control

**Files:**
- Modify: `tests/paper-page.test.ts`
- Modify: `tests/e2e/reader.spec.ts`
- Modify: `src/components/ReadingToolbar.astro`
- Modify: `src/styles/paper.css`

**Interfaces:**
- Preserves `data-mode="gazette|reader"` and persistent `aria-pressed` behavior.
- Produces a semantic group labelled `Reading style` with exactly two buttons.

- [ ] Add failing static/E2E assertions that `View` is absent, the mode container is a labelled group, and both buttons retain 44px touch targets.
- [ ] Run the focused static and E2E tests and confirm the new assertions fail against the current markup.
- [ ] Replace the visible `View` label with an accessible group label and refine segmented-control CSS.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit with `refactor: clarify reading style control`.

### Task 3: Repair the companion composition

**Files:**
- Modify: `tests/e2e/reader.spec.ts`
- Modify: `src/components/Commentary.astro`
- Modify: `src/styles/paper.css`

**Interfaces:**
- Produces `.commentary__intro` and `.commentary__details` layout regions.
- Preserves the existing heading IDs and content order.

- [ ] Add failing wide/mobile layout assertions for balanced detail widths, natural section ordering, and no horizontal overflow.
- [ ] Run the focused reader E2E test and confirm the narrow key-moves column reproduces the failure.
- [ ] Wrap the intro and detail regions and implement three-column, two-column, and stacked responsive layouts.
- [ ] Re-run the focused tests and visually inspect Paper 2 at desktop and mobile widths.
- [ ] Commit with `fix: balance reading companion layout`.

### Task 4: Add the personal About story

**Files:**
- Create: `tests/about-page.test.ts`
- Modify: `src/pages/about.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces the exact LetterJoy external link and a National Archives link for Charles Thomson context.

- [ ] Add a failing static test for the family reading story, LetterJoy URL, sixth-/fifth-great-uncle relationship, and precise Declaration wording.
- [ ] Run `pnpm build && pnpm test tests/about-page.test.ts` and confirm the copy assertions fail.
- [ ] Rewrite the About opening and add restrained LetterJoy and family-history callouts.
- [ ] Rebuild, run the focused test, and visually inspect the page at desktop and mobile widths.
- [ ] Commit with `content: tell the story behind this edition`.

### Task 5: Replace clipped damage with deterministic SVG wear

**Files:**
- Modify: `tests/paper-wear.test.ts`
- Modify: `tests/e2e/reader.spec.ts`
- Modify: `src/lib/paper-wear.ts`
- Modify: `src/components/PaperWear.astro`
- Modify: `src/layouts/PaperLayout.astro`
- Modify: `src/styles/paper.css`

**Interfaces:**
- `getPaperWear(number)` produces stable fold paths, edge tones, abrasion positions, corner-fold geometry, and opacity values.
- `PaperWear.astro` renders one `aria-hidden` inline SVG with a unique filter ID.

- [ ] Replace the old shallow-edge tests with failing assertions for stable unique SVG-ready paths, safe coordinate ranges, and the absence of clipping/nick hooks.
- [ ] Add E2E assertions that Gazette mode shows SVG wear, Reader mode hides it, and representative papers have different path data.
- [ ] Run focused unit/E2E tests and confirm failures against the old span-based wear.
- [ ] Expand the seeded wear model, render soft SVG fold/stain/abrasion layers, and remove all `clip-path`, nick, and corner-line CSS.
- [ ] Re-run focused tests and visually compare Papers 1, 2, 29, 51, and 85 at desktop/mobile widths.
- [ ] Commit with `style: create varied archival paper wear`.

### Task 6: Full verification

**Files:**
- Modify only if verification exposes a regression.

**Interfaces:**
- No new interfaces.

- [ ] Run `pnpm check`; require zero Astro errors and all Vitest tests passing.
- [ ] Run `pnpm test:e2e`; require all Playwright and accessibility tests passing.
- [ ] Verify 320px, 390px, 768px, and 1280px screenshots for Papers 1 and 2 plus the About and index pages.
- [ ] Confirm `git diff --check` and review the final diff for unrelated changes.
- [ ] Commit any verification-only correction with a narrowly scoped message.
