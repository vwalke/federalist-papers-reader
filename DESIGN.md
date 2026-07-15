# Design System

## Intent

The interface is an eighteenth-century New York print shop interpreted by a contemporary editorial designer. It should feel physically specific—dense ink, disciplined rules, compact datelines, printer’s ornaments—while remaining calm and highly legible. The approved north star is a desktop newspaper with real columns that becomes a single-column broadside on mobile.

## Color

Use a restrained strategy. Newsprint and ink carry almost the entire surface; verdigris and oxblood together occupy less than ten percent and appear only where interaction or editorial annotation benefits from a distinct signal.

```css
:root {
  --color-newsprint: oklch(0.91 0.018 82);
  --color-paper: oklch(0.96 0.010 82);
  --color-ink: oklch(0.19 0.018 70);
  --color-verdigris: oklch(0.42 0.075 188);
  --color-oxblood: oklch(0.38 0.12 28);
  --color-muted-ink: oklch(0.48 0.025 70);
  --color-rule: color-mix(in oklab, var(--color-ink) 72%, transparent);
}
```

Newsprint is an intentional environmental surface, not a generic warm-neutral brand background. Avoid gradients, sepia filters, stains, tears, and false aging. Text uses ink or muted ink only when the resulting contrast meets the approved threshold.

## Typography

- The outlined masthead artwork remains independent of live web fonts.
- Gazette paper titles and recipient lines use **IM FELL English**, self-hosted, for restrained period texture.
- Reader paper titles use **Libre Caslon Display**; essay body, commentary, and metadata use **Libre Caslon Text**, all self-hosted.
- Gazette prose enables font-supported common and historical ligatures and uses source-attested `fœderal` rendering; Reader mode normalizes that form to `federal`.
- Utility labels and form controls use the reader’s native system sans-serif stack for clarity and input familiarity.
- Body copy starts at 1.0625rem on phones and grows modestly on larger screens. Reader mode is capped near 68 characters.
- Gazette mode uses one column through 46rem, two columns at medium widths, and three only when each column remains readable.
- Use old-style numerals and common ligatures where the typeface supports them, but never the long s.

## Spacing

Use a four-pixel-derived scale with semantic roles:

```css
:root {
  --space-2xs: 0.25rem;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: clamp(3rem, 7vw, 6rem);
  --space-3xl: clamp(4.5rem, 10vw, 9rem);
}
```

Essay metadata stays tightly grouped. Mastheads, the full index, and companion notes receive generous separation. Pages should feel composed, not padded uniformly.

## Layout

- Mobile first from 320px.
- The paper surface spans the phone viewport with safe-area-aware gutters and no nested card treatment.
- Desktop pages sit as one decisive sheet within a darkened reading-room surround; the sheet has square corners and subtle physical lift, never a floating rounded card.
- The index is a ruled ledger on desktop and a sequence of stacked ledger entries on mobile.
- Controls stay in the normal document flow or a compact sticky utility strip; content must never slide beneath an unreadable overlay.

## Components

### Gazette masthead

A centered publication name, compact descriptor, double rule, issue metadata, and dateline. The compact mobile version shortens secondary copy but preserves the hierarchy.

### Reading toolbar

Text-first segmented controls for Gazette and Reader modes, a clearly labeled read-status button, and a route back to the index. Every control has a 44px target and visible focus.

### Essay

Centered paper number and recipient line followed by original body text. The first paragraph earns one drop cap. Columns use a fine rule and balanced gap; paragraphs never use artificial page breaks.

### Commentary

An editor’s note separated by ornament and rules rather than a card. “In a nutshell” leads, followed by key arguments, optional historical color, and one discussion question.

### Index ledger

A complete semantic list before enhancement. Search and sort controls use native form elements. Read state appears as both text and a small printer’s mark.

## Motion

One restrained entrance may reveal the masthead and rules as if a press sheet has settled into place. Interaction feedback uses 100–200ms color, opacity, or transform transitions with ease-out-quart. No scroll-reveal sequence, bounce, paper flutter, or motion that delays reading. Reduced-motion mode removes all nonessential animation.

## Responsive Behavior

- 320–735px: single-column Gazette, stacked ledger rows, touch-first controls.
- 736–1087px: single- or two-column Gazette depending on actual measure; compact horizontal controls.
- 1088px and above: up to three Gazette columns inside a bounded sheet.
- At 200% zoom, the layout follows the same content-driven collapse rather than clipping.
- Print removes controls and background material, uses one black-on-white column, and includes commentary.

## Paper Material and Wear

Every paper in Gazette mode receives a stable, unique material fingerprint derived from its paper number. The fingerprint varies the edge silhouette, tiny nicks, corner softness, and the presence and size of a single lifted corner, which appears on roughly two of three papers so flat sheets keep the folded ones honest. No two papers may share the same combined pattern, but revisiting a paper must reproduce its original fingerprint. Full-length crease lines were tried and rejected as artificial; do not reintroduce them.

Generate the variation as build-time CSS custom properties and lightweight inline SVG/CSS overlays, never as 85 large raster backgrounds. Keep all distress outside the live text area. Wear is more restrained on narrow screens and absent from Reader mode, print, high-contrast/forced-colors mode, and reduced-transparency fallbacks. The page should appear carefully preserved, not dirty: no stains, foxing, burns, missing chunks, tape, or deep folds. The one sanctioned aging tone is a very slight warm browning that hugs the deckled boundary and its nicks — oxidized fiber at the exposed edge, never a wash over the sheet interior.

## Accessibility

The skip link is the first focusable element. All stateful buttons expose `aria-pressed`; result counts use a polite live region. Focus rings use a high-contrast verdigris/ink combination and are never removed. The original essay is always present in server-rendered HTML.
