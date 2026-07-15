# Anonymous Gazette Heading and Reading Companion Design

## Goal

Bring each Federalist paper closer to its anonymous newspaper presentation while improving the visual hierarchy of the reading companion. Preserve the current readable type, period atmosphere, responsive behavior, and complete original essay text.

## Essay heading

Gazette mode presents only:

- `THE FEDERALIST. No. …`
- `To the People of the State of New York.`
- `PUBLIUS`

The modern descriptive title, identified author, publication label, and authorship-certainty note do not appear above the essay in Gazette mode. The masthead dateline remains the sole publication-date treatment.

Reader mode keeps the modern descriptive title because it is useful modern navigation, but it also keeps the historical anonymity of the top matter: `PUBLIUS` appears above the essay, while the identified author and publication label do not.

## Gazette column composition

At widths where Gazette mode uses multiple columns, the heading participates in the same multi-column flow as the essay. It begins at the top of the first column, and the essay continues immediately after it. Subsequent columns begin at the top of the shared flow, recovering the vertical space that the former full-width centered heading occupied.

On narrow screens, the same semantic order becomes a single natural column: heading, essay, companion. Reader mode remains a single readable measure. Print remains a single column.

The implementation must not duplicate the heading or essay in the DOM, rely on CSS positioning overlays, or insert artificial page or column breaks.

## Reading companion

The companion begins with one compact inline lockup: the oxblood printer’s ornament immediately followed by `Reading companion`. `In a nutshell` is removed from both the visible interface and the accessible name.

The short summary sits directly beneath the lockup and spans the full companion width. The existing detail sections follow beneath it:

- The key moves
- Why it mattered, when present
- Talk it over

At wide widths, the detail sections remain balanced columns. On mobile, they stack in reading order.

## Author attribution

The real author appears only in a quiet footer at the bottom of the companion:

- Certain: `Essay by Alexander Hamilton.`
- Joint: `Essay by James Madison with Alexander Hamilton.`
- Disputed: `Commonly attributed to James Madison; authorship disputed.`

For disputed entries, remove the stored parenthetical ` (attribution disputed)` before composing the footer so the sentence is not repetitive. The existing content metadata remains unchanged.

The original essay text, including its closing `PUBLIUS` when present, remains untouched.

## Accessibility and responsive requirements

- The companion is labelled by the visible `Reading companion` heading.
- The printer’s ornament remains decorative with `aria-hidden="true"`.
- No author information is lost; it moves from the top matter to the companion footer.
- Gazette mode remains one column below the existing responsive threshold and at 200% zoom.
- The page must have no horizontal overflow at 320px and wider.
- Reader mode, print, JavaScript-disabled reading, keyboard operation, and screen-reader structure remain functional.

## Verification

Add or update automated tests to prove:

- the server-rendered page includes only `PUBLIUS` in top matter;
- the repetitive publication label and `In a nutshell` are absent;
- the real author appears in the companion footer;
- disputed attribution is rendered without duplicated wording;
- the Gazette heading and essay share one multi-column flow on desktop;
- mobile and Reader mode remain single-column without overflow;
- the companion lockup, summary, details, and attribution have the intended order;
- the full unit, build, accessibility, and browser suites remain green.
