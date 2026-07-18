# Federalist Reader X Header Design

## Decision

Use the selected **Gazette Masthead** composition for the Federalist Reader X header.

## Purpose

Give the X account the atmosphere of the live Federalist Reader: an eighteenth-century New York print shop interpreted with the site's calm editorial discipline. The header should feel like a panoramic press sheet, not a generic historical illustration.

## Canvas and Safe Areas

- Render at X's recommended 1500×500 pixels.
- Keep all essential typography within the central vertical band from `y = 60` through `y = 440`; X may crop approximately 60 pixels from the top and bottom on some displays.
- Reserve the lower-left region from `x = 0–380`, `y = 330–500` for the overlapping profile picture. Decorative rules may pass behind it, but no essential wording may occupy that region.
- Let the outer double rule extend into the possible crop area because it is decorative and remains coherent when partially trimmed.

## Exact Copy and Hierarchy

From top to bottom:

1. `THE INDEPENDENT JOURNAL`
2. `OR, THE GENERAL ADVERTISER`, flanked by fine rules and oxblood printer's diamonds
3. `THE FŒDERALIST` as the dominant centered line
4. `All Eighty-Five Essays, Made for Reading Together` in restrained italic
5. `federalistreader.org` and `PUBLIUS` aligned across the lower-right safe area

Use the historical `Œ` ligature exactly as shown. Do not add modern branding copy or a second logo.

## Typography

- Use self-hosted IM FELL English for `THE INDEPENDENT JOURNAL` and `THE FŒDERALIST`.
- Use self-hosted Libre Caslon Display for the advertiser line.
- Use self-hosted IM FELL DW Pica Italic for the tagline.
- Use self-hosted Libre Caslon Text Bold for the URL and Publius signature.
- Render fonts before capture; do not rely on fallback fonts in the final image.

## Color and Material

- Newsprint: `oklch(0.91 0.018 82)`
- Ink: `oklch(0.19 0.018 70)`
- Oxblood: `oklch(0.38 0.12 28)`
- Muted ink: `oklch(0.48 0.025 70)`
- Use a restrained, fine paper grain and subtle edge density consistent with the existing social cards.
- Do not use gradients, sepia effects, stains, tears, folds, heavy distressing, photographic objects, shadows behind typography, or false antique decoration.

## Composition

- Center the masthead and hero line across the full canvas so the banner remains balanced on desktop and mobile.
- Give `THE FŒDERALIST` the greatest scale and generous surrounding space.
- Keep printer's rules thin and disciplined.
- Place the URL and Publius signature far enough right to remain clear of the profile picture while preserving the asymmetric footer rhythm used by the social cards.
- The Pressmark F profile picture should complement the header rather than be repeated inside it.

## Deliverable

- `public/profile/federalist-reader-x-header.png`: upload-ready 1500×500 PNG.
- A deterministic generator should remain in the repository so the image can be recreated with the project's self-hosted fonts.

## Verification

- Confirm the PNG is exactly 1500×500 pixels and uses RGB/RGBA color.
- Confirm the file remains comfortably below 2 MB.
- Inspect the full banner and a center-cropped 1500×380 preview.
- Inspect the header with the existing profile picture overlaid in the lower-left corner.
- Confirm every exact text string is present, the `Œ` ligature renders correctly, and no essential content enters the crop or profile-overlap regions.

