# About-page family photo design

## Purpose

Add the supplied portrait of the site creator and his mother to the About page. The image should make the personal origin of the edition tangible while remaining subordinate to the reading story and the Federalist Papers themselves.

## Placement and content

- Place the photo immediately after the two-paragraph opening story and before the LetterJoy callout.
- Preserve the complete portrait without a forced aspect-ratio crop.
- Use a semantic `figure` with useful alternative text describing the pair together in New York Harbor.
- Caption the image: “Mom and me · July 4, 2026 · Sail4th 250, New York Harbor.”
- Store a web-optimized copy in the repository so the static site has no external image dependency.

## Visual treatment

Treat the photograph as an editorial keepsake mounted on the existing newsprint page:

- a warm paper mat around the image;
- a fine oxblood inner rule and darker outer border;
- restrained depth from a small offset shadow;
- a compact caption set in the site’s utility type, with the event detail kept secondary;
- no torn edges, faux tape, rotation, heavy filters, or period-photo discoloration.

The frame should harmonize with the edition’s oxblood, ink, and aged-paper palette while allowing the photograph’s natural color to remain vivid.

## Responsive behavior

- Center the portrait at a comfortable reading-column width on desktop.
- Let it grow to nearly the full available width on phones while retaining enough mat and border to read as a framed object.
- Keep the full image visible at every breakpoint and prevent horizontal overflow.
- Use intrinsic width and height to reserve space, and lazy-load the image to avoid delaying the page’s opening copy.

## Verification

- Add a static About-page test for the image, alternative text, caption, dimensions, and lazy-loading behavior.
- Run the complete type/build/unit suite and browser accessibility checks.
- Visually inspect the About page at phone and desktop widths, including overflow measurements.

## Scope

This change adds one supplied photograph and its presentation. It does not alter the existing About copy, create a general gallery component, or change imagery elsewhere on the site.
