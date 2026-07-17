# Mobile Standalone Experience

## Problem

Saving the site to an Apple Home Screen currently produces a generic icon and
an experience that still feels accidental rather than designed. The site only
publishes an SVG browser favicon; it has no Apple touch icon, web app manifest,
installed title, or standalone metadata. The mobile reading layout is already
strong, but the reading-mode toggle, text-size slider, and read-status button
compete for one narrow toolbar row on small phones.

## Goals

- Give Federalist Reader a recognizable installed identity tied directly to
  `FederalistReader.org`.
- Make Home Screen launches feel like a deliberate standalone reading edition.
- Preserve the existing newspaper character and single-column mobile reading
  experience.
- Improve the narrow-phone toolbar without adding persistent app chrome over
  the essay.
- Keep installation and standalone behavior progressive: unsupported metadata
  must never interfere with normal browser reading.

## Non-goals

- No service worker, offline cache, update prompt, or full PWA lifecycle.
- No sticky mobile dock or controls that cover essay text.
- No account, synchronization, or change to the existing local progress model.
- No custom launch image matrix for individual Apple device sizes.
- No redesign of the desktop or tablet newspaper composition.

## Installed Identity

The site uses the approved **Federalist broadside monogram** as its unified
small-format mark:

- warm newsprint field;
- double ink printer's rule inset safely from the icon boundary;
- one large oxblood `F` for “Federalist”;
- a restrained horizontal printer's ornament above and below the initial.

The icon remains crisp and graphic. It does not use simulated paper fibers,
tears, stains, or photographic texture: those details disappear or turn muddy
at Home Screen size. The entire design stays within the mask-safe center so
Apple's rounded icon treatment and Android maskable crops cannot clip the
border or ornament.

The existing browser favicon changes from `P` to the same `F` identity. Publius
remains the voice and historical signature inside the reading experience;
Federalist is the outward-facing product and domain identity.

## Icon Assets

Export raster assets from one vector master so their geometry and colors stay
identical:

- `/apple-touch-icon.png` at 180 × 180 pixels;
- `/icons/icon-192.png` at 192 × 192 pixels;
- `/icons/icon-512.png` at 512 × 512 pixels;
- `/icons/icon-maskable-512.png` at 512 × 512 pixels with the complete mark
  contained inside the maskable safe zone;
- `/favicon.svg`, revised to use the same `F` mark.

The PNGs use an opaque newsprint background. None relies on transparency or on
fonts being available at runtime.

## Manifest and Apple Metadata

Add `/site.webmanifest` with:

- `name`: `Federalist Reader`;
- `short_name`: `Federalist`;
- `start_url`: `/`;
- `scope`: `/`;
- `display`: `standalone`;
- newsprint `background_color`;
- dark ink `theme_color`;
- standard and maskable icon declarations.

The shared page layout links the manifest and Apple touch icon and declares:

- `apple-mobile-web-app-capable=yes`;
- `apple-mobile-web-app-title=Federalist`;
- a dark, translucent Apple status-bar treatment that blends into the existing
  reading-room surround;
- the existing viewport declaration with `viewport-fit=cover`.

Normal browser tabs continue to use the page title and favicon. Installed
launches open at the complete index, where the reader can continue with the
first unread paper or choose another.

## Standalone Layout and Safe Areas

The dark site surround extends behind the Apple status area. The utility header
adds `env(safe-area-inset-top)` only in standalone display mode, while existing
left and right safe-area gutters continue to protect content around rounded
screen corners. The footer adds the bottom safe-area inset so its links never
collide with the Home indicator.

The paper itself remains a full-width single-column broadside on phones. There
is no extra rounded app shell, simulated device chrome, or installed-only
navigation system. Existing site links provide the navigation required when
Safari's address bar is absent. External links may hand off to the browser in
the platform's normal way.

## Narrow-phone Reading Toolbar

At widths below 30rem (480px), reorganize the existing toolbar into two rows:

1. Gazette/Reader occupies the flexible first column and the read-status button
   occupies a 44px second column.
2. The text-size control spans the full second row, with small and large Caslon
   `A` labels visible on either side of the slider.

At larger mobile and tablet widths, retain the existing compact horizontal
toolbar. The narrow layout stays in normal document flow; it is not sticky and
never overlays the essay.

Every button and range control keeps a minimum 44 × 44 CSS-pixel target. The
mode toggle, text-size preference, and local read state continue to use their
existing behavior and storage keys.

## Read-status Symbol

Replace the bookmark-like mark with a checkmark because the interaction records
completed reading rather than saving a paper for later.

- Unread: transparent button, oxblood border, oxblood checkmark.
- Read: oxblood-filled button, light newsprint checkmark.

The checkmark remains visible in both states so the control does not rely on
color alone. Desktop retains the visible `Mark as read` / `Marked as read`
label. Narrow mobile may hide the visible label, but the button always updates
its `aria-label` and `aria-pressed` values exactly as it does now.

## Accessibility and Failure Behavior

- The standalone additions are metadata and CSS enhancements; the complete
  server-rendered site remains available if the manifest is ignored or fails
  to load.
- Icons have opaque high-contrast artwork and contain no essential tiny text.
- Safe-area additions must not create double padding in normal browser mode.
- All toolbar controls remain keyboard operable and retain the existing visible
  focus treatment.
- The read state uses shape, fill, text, and ARIA state rather than color alone.
- Text enlargement through the existing five-step slider must continue to
  reflow without horizontal scrolling.

## Verification

### Automated

- Static shell tests confirm the manifest, touch icon, installed title,
  standalone metadata, theme colors, and existing `viewport-fit=cover` output.
- Asset tests confirm that every referenced icon exists, is a valid image, and
  has the declared dimensions.
- Component tests confirm the checkmark markup and preserved read-state labels.
- Responsive end-to-end tests cover 320px, 390px, and 430px phone widths plus an
  iPad-sized viewport. They assert no horizontal overflow, 44px control targets,
  the two-row toolbar below 480px, and the existing layout above that boundary.
- Existing Gazette/Reader, text-size persistence, read-state persistence,
  accessibility, index, About, and navigation tests continue to pass.

### Manual Apple check

After deployment, add the production site to the Home Screen on one iPhone and
one iPad. Confirm:

- the `F` icon is sharp, centered, and unclipped;
- the displayed name is `Federalist`;
- launch opens the index without Safari's address bar;
- the status area and Home-indicator area blend with the site surround;
- internal navigation, Back behavior, scrolling, mode changes, text sizing,
  read status, and external links behave naturally;
- reopening the installed edition retains its local reading preferences.
