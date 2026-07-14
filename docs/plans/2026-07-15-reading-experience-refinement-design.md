# Reading Experience Refinement Design

## Goal

Refine the shared Federalist reading experience after the first mock-fidelity pass: replace the artificial clipped-page damage with convincing, varied paper wear; clarify the Gazette/Reader control; repair the companion layout; make publication sorting historically meaningful; and give the About page the personal story that inspired the project.

## Paper Surface and Wear

The current `clip-path` corners, triangular nicks, and single-pixel crease lines read as CSS effects rather than handled paper. Remove them entirely.

Each paper will instead receive a deterministic inline SVG overlay derived from its paper number. The overlay contains broad, soft shadow/highlight pairs for folds, faint fiber noise, edge toning, small abrasion marks, and corner-fold shading. Paths and positions vary by paper number, remain stable between visits, and do not remove any part of the sheet. Gazette mode shows the effect; Reader mode, print, forced colors, and reduced-transparency preferences suppress it. Mobile uses lower contrast and fewer visible details so the article remains the focus.

The target is the atmosphere of the approved mock—a preserved sheet with subtle handling marks—not a claim that the page is a scan or a photorealistic facsimile.

## Reading Style Control

The toolbar will expose a two-option segmented control containing only `Gazette` and `Reader`. `Reading style` remains available as the accessible group label but will not look like a third selectable option. The active choice uses the existing verdigris accent and a clear pressed state. Touch targets remain at least 44 CSS pixels.

## Reading Companion

The companion will have two explicit rows:

1. a compact heading paired with the plain-language nutshell summary;
2. a balanced detail grid for `The key moves`, `Why it mattered`, and `Talk it over`.

Wide screens use three readable columns, with slightly more room for the numbered argument list. Intermediate screens use two columns with the discussion prompt spanning the available width. Mobile stacks every section in source order. The discussion prompt retains an oxblood accent without a full-height divider.

## Index Order and Historical Dates

Correct Federalist No. 26 from December 22, 1788 to December 22, 1787 in both its machine-readable and display dates.

Retain both index sorts because number order and first-publication order are not identical. Federalist No. 29 appeared after Nos. 30–36, and Nos. 78–85 first appeared together in the second bound volume. Rename the choices to `Paper order` and `First publication` and add a concise explanatory note near the sort control. Date ties continue to fall back to paper number.

## About Page

Lead with the personal origin of the project: a LetterJoy Federalist Papers subscription given to the author's mom, the decision to follow along online, and the pleasure of turning the essays into a weekly conversation.

Add a visually distinct but restrained LetterJoy callout linking to `https://www.letterjoy.co/pages/federalist-papers`. Describe the mailed series warmly and make clear that this site is an independent reading companion inspired by that experience.

Add the family connection to Charles Thomson. For historical precision, say that his name appeared with John Hancock's on the first printed Declaration as the attesting Secretary of Congress, rather than calling him one of the 56 delegates who signed the engrossed parchment. State that he was the author's sixth-great-uncle and the author's mom's fifth-great-uncle. Link the historical statement to the National Archives.

## Accessibility and Responsive Behavior

- Essay and companion text remain selectable, semantic, and machine readable.
- SVG wear is decorative and hidden from assistive technology.
- Gazette/Reader buttons preserve `aria-pressed` state and persistent local preference.
- Companion sections use headings and natural source order.
- External links use descriptive text and visible focus states.
- No layout introduces horizontal overflow at 320 CSS pixels.
- Reader mode remains a clean, wear-free presentation.

## Verification

Use unit/static tests for deterministic wear data, corrected publication metadata, About copy, and server-rendered control semantics. Use Playwright at wide desktop, tablet, and mobile sizes to verify the control, companion grid, paper-wear visibility, sorting, touch targets, and lack of horizontal overflow. Finish with the full Astro check/build, Vitest suite, accessibility checks, and Playwright suite.
