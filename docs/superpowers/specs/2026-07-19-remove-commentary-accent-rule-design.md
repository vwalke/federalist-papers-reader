# Remove Commentary Accent Rule

## Goal

Remove the oxblood vertical rule that appears before “Talk it over” on individual paper pages. The rule adds visual noise between two adjacent companion sections without clarifying their relationship.

## Design

Delete the `border-inline-start` and its compensating `padding-inline-start` from `.commentary__question`. Keep the existing responsive grid, headings, copy, spacing between grid items, semantic markup, and source order unchanged.

This makes “Talk it over” visually consistent with “The key moves” and “Why it mattered” while preserving the companion’s established hierarchy.

## Verification

- Confirm the question section has no inline-start border or extra inline-start padding at desktop, tablet, and mobile widths.
- Confirm all three companion sections retain their current responsive placement and readable spacing.
- Run the focused paper-page and reader layout tests.

## Scope

No commentary content, data, accessibility semantics, colors elsewhere, or individual-paper layout outside this accent rule will change.
