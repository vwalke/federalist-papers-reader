# Remove Commentary Accent Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the oxblood vertical rule and its compensating indentation from “Talk it over” on individual paper pages.

**Architecture:** Keep the existing `Commentary.astro` markup and responsive grid unchanged. Protect the visual simplification with a Playwright computed-style assertion, then remove only the two declarations from `.commentary__question`.

**Tech Stack:** Astro 7, CSS, Playwright 1.61

## Global Constraints

- Preserve the commentary content, semantic headings, source order, and responsive grid placement.
- Do not change colors or layout outside the “Talk it over” accent treatment.
- Preserve unrelated working-tree changes.

---

### Task 1: Remove the “Talk it over” Accent Rule

**Files:**
- Modify: `tests/e2e/reader.spec.ts`
- Modify: `src/styles/paper.css`

**Interfaces:**
- Consumes: `.commentary__question`, the existing question-section class rendered by `Commentary.astro`.
- Produces: a question section whose computed inline-start border and padding are both `0px`.

- [x] **Step 1: Write the failing regression assertion**

In `keeps the companion introduction coherent and its details responsive`, read the computed styles of `.commentary__question` in the desktop evaluation:

```ts
const question = commentary.querySelector('.commentary__question') as Element;
const questionStyle = getComputedStyle(question);

return {
  questionBorderInlineStart: questionStyle.borderInlineStartWidth,
  questionPaddingInlineStart: questionStyle.paddingInlineStart,
  // existing metrics remain unchanged
};
```

Then assert:

```ts
expect(desktop.questionBorderInlineStart).toBe('0px');
expect(desktop.questionPaddingInlineStart).toBe('0px');
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `pnpm exec playwright test tests/e2e/reader.spec.ts --grep "keeps the companion"`

Expected: FAIL because the current computed values are `3px` and `16px` rather than `0px`.

- [x] **Step 3: Remove the accent and compensating indentation**

Delete this complete rule from `src/styles/paper.css`:

```css
.commentary__question {
  padding-inline-start: var(--space-md);
  border-inline-start: 3px solid var(--color-oxblood);
}
```

Keep the responsive `.commentary__question` grid-placement rules unchanged.

- [x] **Step 4: Run focused verification**

Run: `pnpm exec playwright test tests/e2e/reader.spec.ts --grep "keeps the companion"`

Expected: PASS.

Run: `pnpm exec vitest run tests/paper-page.test.ts`

Expected: PASS.

Run: `pnpm exec astro check`

Expected: PASS with no errors.

- [x] **Step 5: Review the final diff**

Run: `git diff --check && git diff -- src/styles/paper.css tests/e2e/reader.spec.ts`

Expected: no whitespace errors; the diff contains only the regression assertion and removal of the accent rule.
