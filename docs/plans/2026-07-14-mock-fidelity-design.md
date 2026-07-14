# Mock Fidelity Design

## Goal

Bring the Paper No. 1 experience—and the shared reading template used by all 85 papers—as close as practical to the approved aged-paper mock. This is a flagship visual-quality pass, not a redesign of the product or its behavior.

The original essays and commentary remain readable, selectable, and accessible. The masthead may be decorative vector artwork because it repeats information that is not required to understand the paper.

## Reference and Historical Position

The approved aged-paper mock is the visual contract for hierarchy, density, rules, and responsive behavior. Historical newspapers provide construction cues rather than a requirement to reproduce every defect of a surviving scan.

The Independent Journal masthead will serve as the consistent publication identity across the collection. The Library of Congress records that it published all 85 Federalist essays, even though some essays first appeared elsewhere and Papers 78–85 first appeared in McLean's bound edition. Paper-specific publication venue and date remain visible as text in the issue metadata.

## Masthead

Replace the current oversized live-text masthead with a responsive inline SVG lockup modeled on the approved mock:

- outlined Roman-capital artwork for “THE INDEPENDENT JOURNAL”;
- a smaller, widely spaced “OR, THE GENERAL ADVERTISER” line;
- restrained printer's ornaments and hairlines;
- a strong double rule separating the nameplate from the issue dateline;
- compact geometry at mobile widths without changing to an unrelated logo.

The artwork will be decorative to assistive technology. A concise textual publication label remains available in the document metadata where it contributes meaning.

## Typography

Remove IM FELL English from the paper masthead and primary essay hierarchy. Its distressed, irregular texture is the main source of the current mismatch.

Use a high-contrast Roman/Caslon display treatment for ceremonial newspaper headings and Libre Caslon Text for the essay body. Gazette metadata, issue lines, bylines, and section labels use serif small-cap styling rather than modern system-sans typography. System UI typography remains acceptable for functional site navigation and controls when it improves clarity.

The essay heading follows the mock's compact order:

1. `THE FEDERALIST. No. I.` (with the appropriate paper number);
2. italic recipient line;
3. small ornament;
4. `PUBLIUS`;
5. the credited author in small capitals.

Desktop body copy becomes denser than the current implementation: tighter leading, narrower measures, disciplined column rules, and newspaper-appropriate paragraph rhythm. Mobile remains a comfortable single column with no attempt to shrink a desktop broadsheet.

## Composition

Match the mock's vertical sequence and proportions:

1. masthead;
2. subtitle and double rule;
3. centered issue dateline;
4. compact reading controls;
5. formal essay heading;
6. body columns;
7. ruled “In a nutshell” companion area.

The toolbar should read as part of the sheet rather than as an application header. Desktop columns should begin higher on the page, and the essay heading should no longer consume a large hero-sized block.

Paper texture and unique deterministic wear remain, but wear marks are reduced wherever they compete with rules or letterforms. The sheet should feel preserved and handled, not distressed for effect.

## Responsive Behavior

- Desktop: three readable columns when width permits, matching the approved mock's density.
- Tablet: two columns only when each retains a suitable measure.
- Mobile: one column, compact masthead, abbreviated functional labels where needed, and at least 44px touch targets.
- Reader mode: clean typography without paper wear or decorative masthead dominance.
- Print, forced colors, and reduced transparency retain their existing accessible fallbacks.

## Scope

This pass changes the shared masthead, essay heading markup, newspaper typography, rules, spacing, and related visual tests. It does not change essay text, commentary content, publication data, navigation structure, local read state, or hosting architecture.

## Verification

Verify the result against the approved mock at desktop and mobile sizes, then test:

- Papers 1, 10, 51, 78, and 85;
- Gazette and Reader modes;
- 320px mobile, tablet, and wide desktop layouts;
- keyboard focus, 200% zoom, forced colors, reduced motion/transparency, and print;
- static build, existing tests, and console output.
