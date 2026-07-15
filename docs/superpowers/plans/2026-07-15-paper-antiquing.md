# Paper Antiquing (Wear v3) — Implementation Plan

Spec: `docs/superpowers/specs/2026-07-15-paper-antiquing-design.md`

## Tasks

1. **Rewrite the fingerprint library.**
   - Replace the `PaperWear` model in `src/lib/paper-wear.ts` with the v3
     shape: `edges` (four seamless px-unit deckle tiles), `nicks`, `creases`,
     `cornerFold`, `cornerSofteners`, `signature`.
   - Keep `mulberry32`, `between`, the `getPaperWear(number)` signature, and
     the 1–85 range error.
   - Rewrite `tests/paper-wear.test.ts` first (stability, uniqueness,
     seamless tiles, bounds), then make it pass with `pnpm test`.

2. **Rewrite the overlay component.**
   - `src/components/PaperWear.astro`: emit the edge strips (room-colored,
     SVG-data-URI masks), nicks, corner chips, crease gradient layer, and the
     dog-ear block. Keep `data-paper-wear` and add `data-wear-signature`.
   - Replace the wear rules in `src/styles/paper.css`; keep reader/print/
     forced-colors/reduced-transparency/narrow guards. Remove the stain,
     abrasion, vignette, and SVG grain rules.

3. **Update e2e coverage.**
   - `tests/e2e/reader.spec.ts`: wear present with differing
     `data-wear-signature` between papers 1 and 2, hidden in Reader mode, no
     legacy stain/abrasion/fold nodes.

4. **Verify.**
   - Browser sweep: papers 1, 10, 51, 84 at desktop width; one mobile check;
     Reader-mode check; compare against the approved mock.
   - `pnpm check` (astro check + build + unit tests) and
     `pnpm test:e2e`.
