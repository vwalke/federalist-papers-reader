# Text Size Slider

## Problem

Body text at the designed size can be hard on older eyes. Readers need a way
to enlarge the reading text without breaking the period look of the sheet or
the composure of the toolbar.

## Design

A five-step slider in the reading toolbar, beside the Gazette/Reader toggle.

- **Steps, not a free range.** Scales `1 / 1.12 / 1.25 / 1.4 / 1.55`, exposed
  as `TEXT_SCALE_STEPS` from `src/lib/preferences.ts`. Discrete stops keep
  every size deliberate and testable; `aria-valuetext` announces plain names
  (Standard → Largest).
- **What scales.** The chosen step lands in a `--reading-scale` custom
  property on `<html>`. It multiplies the essay body, the signature (which
  inherits), and the companion prose. Gazette column min-widths multiply by
  the same factor, so larger text reflows into fewer, wider columns instead
  of cramped ones; the Reader measure multiplies its `68ch` cap so the line
  length stays near 68 characters of the enlarged type. Mastheads, headings,
  rules, and controls stay fixed — the sheet keeps its architecture.
- **Persistence.** `publius:text-scale` in localStorage via the existing
  preferences module (validated against the known steps, tolerant of blocked
  storage). The BaseLayout inline script applies the saved scale before first
  paint, alongside the saved reading mode, so there is no flash.
- **Appearance.** A fine ink rule for the track with five hairline step
  ticks; the thumb is a small oxblood printer's diamond echoing the masthead
  ornaments. A small and a large Caslon "A" bracket the control. Native
  `<input type="range">` underneath: keyboard arrows, 44px hit target, the
  site's verdigris focus ring. On narrow screens the bracketing letters hide
  so the toolbar keeps to one line; print hides the toolbar as before.

## Testing

- Unit: `getTextScale` defaults to 1, round-trips valid steps, rejects
  unknown numbers and garbage strings, survives blocked storage.
- E2E: dragging the slider to the last stop enlarges the first essay
  paragraph ~1.55x, updates `aria-valuetext`, and the size and slider
  position survive a reload.
