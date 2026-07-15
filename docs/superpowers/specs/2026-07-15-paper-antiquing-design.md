# Paper Antiquing (Wear v3): Silhouette and Light

## Problem

Two prior wear treatments failed the same way: they painted gray marks onto a
perfectly straight-edged rectangle. Attempt one (`edgeDepth`/nick custom
properties) was too flat to register. Attempt two (the current full-page SVG)
reads as dirt: a radial vignette, oxblood stains that the design system
forbids, and stroked "fold" lines whose geometry stretches with a
`0 0 100 100` viewBox across pages of very different heights, so the same
crease looks right on one paper and warped on another.

What makes real paper read as physical is not surface tone. It is the
**silhouette** — edges that are not ruler-straight against the dark reading
room — and **light relief** — paired shadow/highlight along a crease or a
lifted corner. Those two cues are what the approved mock shows and what both
attempts lacked.

## Principles

1. **Silhouette first.** Every edge gets a shallow deckled boundary that
   visually eats 0–5px into the sheet. Implemented as room-colored intrusions
   (`--color-room` over the sheet edge), which is indistinguishable from
   clipping against the near-black room but needs no filters, no clip-path,
   and keeps the existing box-shadow.
2. **Relief, not marks.** The lifted corner is light logic: a flap
   catch-light, a soft contact shadow, a thin rim highlight. No stroked gray
   lines. No stains, vignettes, or abrasion blotches — per DESIGN.md the sheet
   is carefully preserved, not dirty. (A first pass also drew full-length
   gutter creases; review found them artificial and distracting, so straight
   creases were cut entirely.)
3. **Fixed-pixel geometry.** All wear detail is generated in px units (mask
   tiles with fixed `mask-size`, px-anchored gradient stops, fixed-size corner
   blocks anchored to % offsets). Nothing stretches with page height or
   viewport width, which fixes attempt two's distortion.
4. **Deterministic fingerprints.** `getPaperWear(number)` seeds everything
   from the paper number (mulberry32, unchanged). All 85 papers are unique;
   revisiting a paper reproduces its exact wear.
5. **Text is sacred.** Deckle depth stays under ~6px (sheet padding is ≥16px).
   Corner folds are fixed-size blocks that live in corner whitespace.
6. **Existing guards stay.** Wear is absent in Reader mode, print,
   forced-colors, and reduced-transparency; edge deckle is hidden and the
   corner fold dimmed on narrow screens where the sheet is full-bleed.

## Components

### `src/lib/paper-wear.ts` (rewrite, same entry point)

`getPaperWear(number)` returns a `PaperWear` fingerprint:

- `edges` — for each of top/right/bottom/left: a seamless deckle tile
  (`path` in px, `tileLength` 340–520px, `depth` mean 1.5–3.5px, amplitude
  0.8–2.2px) built from two seeded periodic sines plus seeded per-point
  jitter, so tiles repeat without seams.
- `nicks` — 2–4 small bites (18–36px wide, 4–8px deep), each on a seeded edge
  at a seeded 8–92% offset. Discrete, so nothing repeats along an edge.
- `cornerFold` — a dog-ear on roughly two of three papers (seeded coin), or
  `null`: seeded corner, 48–150px with the spread squared so small casual
  lifts outnumber dramatic ones, flap-light / contact-shadow / rim-light
  parameters.
- `cornerSofteners` — tiny 6–14px chamfer bites for the remaining corners.
- `toning` — per-paper edge browning: a mask-stretch scale (1.65–2.3) and
  opacity (0.20–0.32) for the sepia fringe described below, plus four
  `bands` (one per edge) whose depth (24–72px), blotch length, turbulence
  seed, and opacity differ per edge, so one edge can be heavily aged while
  another stays cleaner — the asymmetry real documents show.
- `signature` — a stable string over the edge tiles for uniqueness tests and
  the e2e `data-wear-signature` hook.

### `src/components/PaperWear.astro` (rewrite)

Renders a `<div class="paper-wear" aria-hidden="true">` overlay (absolute,
inset 0, pointer-events none) containing:

- `.paper-wear__edge--{side}` ×4 — thin strips along each edge,
  `background: var(--color-room)`, masked by a per-paper SVG-data-URI deckle
  tile (`mask-repeat` along the edge, fixed `mask-size`). Color lives in CSS
  (theme-safe); the mask only carries shape.
- `.paper-wear__nick` ×2–4 — small room-colored bites, same mask technique,
  positioned at % offsets along their edge.
- `.paper-wear__corner-chip` ×3 — chamfer bites at the non-dog-ear corners.
- `.paper-wear__fold` — the dog-ear block with layered corner gradients,
  rendered only when the paper carries a fold.
- `.paper-wear__edge-band` ×4 — broad oxidation bands: a tea-tan layer
  masked by a seeded SVG tile in which a dense-at-the-edge white gradient is
  gated through stitched fractal noise, so the browning depth wanders and
  blotches instead of reading as a uniform vignette. Bands overlap at the
  corners, which naturally ages corners hardest.
- `.paper-wear__edge-toning` / `.paper-wear__bite-toning` — sepia twins of
  every deckle strip, nick, and chip, drawn underneath from the same masks
  but stretched by the toning scale, so a browned-fiber fringe hugs each
  torn boundary (multiply blend, per-paper opacity). Deeper bites earn
  proportionally wider browning, which is how real paper oxidizes.
- Edge tone: a warm inset box-shadow on the overlay root (`~36px` reach, ≤6%
  of the toning color) replaces the radial vignette; the tiled grain in
  `global.css` stays and the full-page SVG turbulence rect goes away.

### `src/styles/paper.css`

Replace the wear rules; keep and extend the guards (`[data-reading-mode='reader']`,
print, forced-colors, reduced-transparency, `max-width: 45.999rem`).

## Testing

- Unit (`tests/paper-wear.test.ts`, rewritten): stable + unique fingerprints
  for all 85 papers; tile paths seamless (start/end depth equal) and within
  depth bounds; nick offsets within 8–92%; folds on 45–70 of the 85 papers at
  genuinely varied sizes within 48–150px; range errors outside 1–85.
- Page (`tests/paper-page.test.ts`): `data-paper-wear` attribute still
  asserted, unchanged.
- E2E (`tests/e2e/reader.spec.ts`): wear present in Gazette mode with a
  `data-wear-signature` that differs between paper 1 and paper 2; overlay
  hidden in Reader mode; no legacy stain/abrasion nodes.
- Visual: screenshot sweep of several papers at desktop width plus one mobile
  check, compared against the approved mock.
