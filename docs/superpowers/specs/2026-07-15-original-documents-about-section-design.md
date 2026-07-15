# Original Documents About Section Design

**Date:** July 15, 2026

## Goal

Add a photo-led section to the About page that explains why seeing original historical documents matters, shares the family's personal experience with Seth Kaller and *The Promise of Liberty: Words That Shaped a Nation*, and invites readers to seek out exhibitions or explore collecting documents themselves.

The section should feel personal and enthusiastic rather than academic or promotional. Its central message is that this website can make the Federalist Papers inviting, but no digital presentation can replace standing in front of an original document.

## Narrative Placement

Place the new section immediately after “A family thread through the founding” and before “Their words, clearly set” / “A companion, not a lecture.” This position turns the Charles Thomson family history into a tangible encounter: the photograph shows Mom listening to Seth Kaller discuss a printing of the Declaration of Independence that carries Thomson's printed signature.

Retain the existing ornamental rule after the Charles Thomson section as the introduction to this new feature. Add a second matching rule after the new feature so the two short editorial notes remain a separate closing section.

The page's narrative order becomes:

1. the weekly reading project with Mom;
2. LetterJoy and the opening family photograph;
3. Charles Thomson's founding-era story;
4. encountering Thomson's printed name on an actual historical document;
5. the edition's two brief editorial notes; and
6. the WalkeForward colophon.

## Section Content

Use the kicker and heading:

> **History in the room**
>
> ## Nothing substitutes for the real thing.

Use this body copy:

> We are fortunate to know Seth Kaller, one of the country’s leading experts in original American documents. On July 5, 2026, Mom and I visited *The Promise of Liberty: Words That Shaped a Nation* at the South Street Seaport Museum, an extraordinary exhibition curated by Seth and the museum.
>
> The moment in this photograph could hardly have been more personal: Seth was showing Mom a historic printing of the Declaration of Independence carrying the printed signature of Charles Thomson—her fifth-great-uncle. We had read about Thomson’s place in the founding. Here it was, in ink and paper, directly in front of us.
>
> This site can make the Federalist Papers inviting, but no screen can reproduce the scale, texture, survival, and sheer presence of an original document. If *The Promise of Liberty*—or any exhibition of original historical material—comes near you, go see it. And if you find yourself wanting to bring a piece of history home, Seth’s collection is a fascinating place to begin.

Finish the copy with two clear text links:

- `Follow The Promise of Liberty` → `https://www.thepromiseofliberty.org/`
- `Explore history you can own` → `https://www.sethkaller.com/`

Do not add a sales price, affiliate disclosure, sponsorship language, or claim of affiliation. The opening sentence already explains the personal relationship, and there is no paid arrangement to disclose.

## Photograph

Source photograph:

`/Users/vwalke/Library/Group Containers/group.com.apple.coreservices.useractivityd/shared-pasteboard/items/C38F0740-7703-4016-A948-7602E5CEB1F3/IMG_1978.jpeg`

The source is a 3,632 × 4,744 portrait JPEG. Create a web derivative at:

`public/images/mom-and-seth-promise-of-liberty-2026.jpg`

Resize proportionally to 1,200 × 1,567 pixels without cropping. Preserve the full scene: Mom in the foreground, Seth presenting, the framed Declaration printing, and the exhibition wall text all contribute to the story. Remove metadata when creating the derivative and use a visually high-quality JPEG setting that avoids a multi-megabyte page asset.

Use this alternative text:

> Seth Kaller showing Mom a framed printing of the Declaration of Independence at The Promise of Liberty exhibition

Use this caption:

> **Mom and Seth Kaller**
>
> With a printing of the Declaration carrying Charles Thomson’s printed signature. July 5, 2026 · *The Promise of Liberty*, South Street Seaport Museum, New York City.

Mark the image `loading="lazy"` and `decoding="async"`, with its intrinsic 1,200 × 1,567 dimensions in the HTML.

## Responsive Layout and Styling

Create a semantic `section` with three focused children: heading block, figure, and copy block. Use source order heading → figure → copy so the mobile and no-CSS reading order is natural.

At widths of 56rem and above, use a two-column editorial composition:

- the portrait figure occupies the left column;
- the kicker and heading occupy the upper-right area;
- the prose and links continue beneath the heading in the right column; and
- the image is shown in full rather than cropped to match the prose height.

This reverses the opening About-page composition, where the family portrait sits on the right, and gives the long page a deliberate visual rhythm.

On narrower screens, retain a single column in source order. Keep the heading above the photograph, the caption attached to the photograph, and the copy below it. The section must not introduce horizontal scrolling at 320px or wider.

Frame the photograph with a restrained museum treatment:

- a dark charcoal mat;
- one fine brass-colored inset rule that echoes the frame visible in the photograph;
- the same paper-toned outer border and quiet shadow language used elsewhere on the About page; and
- a caption set in the existing reading and utility typefaces.

Use solid colors and existing design tokens. Do not add gradients, ornamental aging, faux damage, animation, or a competing card background. Links should use the established verdigris treatment and remain visibly distinct in forced-colors mode.

## Components and Scope

Keep the section directly in `src/pages/about.astro`; it is unique editorial content and does not justify a reusable component. Add only the new section-specific styles needed in `src/styles/global.css`, following the existing `about-*` naming pattern.

Do not alter the Federalist paper pages, analytics, navigation, LetterJoy section, Charles Thomson copy, existing family photograph, edition notes, or WalkeForward colophon.

## Accessibility and Failure Behavior

- The section must have a unique heading ID and an `aria-labelledby` relationship.
- The figure and caption must remain meaningful without CSS.
- The link labels must make sense out of context and must not rely on an icon alone.
- External links should follow the site's existing behavior and open in the same browsing context.
- A missing external website must not affect page rendering; both destinations are ordinary anchors with no embedded third-party scripts.
- The static image must be committed with the site so it does not depend on the temporary source path after implementation.

## Verification

Automated static-output tests will verify:

- the kicker, heading, three approved paragraphs, and Thomson connection are present;
- the two exact external destinations and link labels are present;
- the committed image path, intrinsic dimensions, lazy-loading behavior, alternative text, and caption are present; and
- the new section appears after the Charles Thomson section and before the edition notes and colophon.

Browser tests will verify:

- at desktop width, the figure is left of the heading and copy, with no overflow;
- at mobile width, the rendered order is heading → figure → copy, with no overflow;
- the caption remains attached visually to the image; and
- the existing About-page wide, intermediate, mobile, print, and accessibility checks still pass.

Run the complete Astro, content, Vitest, and Playwright checks before integration.

## Sources

- [The Promise of Liberty](https://www.thepromiseofliberty.org/)
- [The Promise of Liberty at the South Street Seaport Museum](https://southstreetseaportmuseum.org/promise-of-liberty/)
- [Seth Kaller, Inc.](https://www.sethkaller.com/)
