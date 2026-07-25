# ReadPublius Homepage Banner Design

**Date:** 2026-07-25  
**Status:** Approved for implementation planning

## Purpose

Give interested readers a clear path to the substantive material published by
`@ReadPublius` on X without interrupting the Federalist Papers themselves.

The X feed extends the site with ongoing commentary, reports from the 1787
Constitutional Convention, connections to individual papers, original-newspaper
discoveries, and print-history details. The banner should communicate that
editorial value rather than read as a generic request for followers.

## Placement and scope

Render one editorial notice on the homepage only:

- It is the first element inside the homepage's `.paper-sheet`, immediately
  above the Gazette masthead.
- It does not render on individual Federalist paper pages.
- It does not render on guide, subscription, About, teacher, print-room, or
  other supporting pages.
- It remains in normal document flow. It is not sticky, fixed, modal, or
  overlaid on other content.

This placement makes the notice prominent while preserving the site's calm
reading experience.

## Content

Use the following approved copy:

**Label**

> From the public square

**Message**

> Ongoing commentary on the Federalist Papers, dispatches from the 1787
> Constitutional Convention, and glimpses into the newspapers and history
> behind the debate.

**Action**

> Follow @ReadPublius on X ↗

The action links to `https://x.com/ReadPublius`. It follows the site's existing
external-link convention and does not force a new browsing context.

## Visual treatment

Use the approved “editorial notice” treatment:

- Warm paper surface distinct enough from the surrounding newsprint to establish
  hierarchy without becoming a card.
- Compact utility-style label in oxblood.
- Reading-face message copy.
- Text link styled consistently with other editorial actions.
- A fine double rule at the lower edge to separate the notice from the masthead.
- Square edges, restrained color, and no shadow, animation, iconography, X logo,
  or promotional artwork.
- On narrow screens, the content may reflow into multiple rows. The message and
  action remain comfortably readable without horizontal scrolling.

The component should reuse the existing design tokens and typography rather
than introduce a separate campaign style.

## Persistence and interaction

The notice appears on every homepage visit until the visitor explicitly
dismisses it.

- A dismiss button is always visible.
- Dismissing hides the notice immediately and writes `1` to
  `localStorage["publius:x-promo-dismissed"]`.
- Before rendering the notice, an inline initialization script reads that key
  and marks the root document when it is set, preventing a flash of previously
  dismissed content.
- Following the X link does not dismiss the notice or change the stored
  preference.
- If storage is unavailable, dismissal still hides the notice for the current
  page. It may return on a later visit.
- With JavaScript disabled, the notice remains visible and the X link remains
  usable; only persistence and dismissal are unavailable.

The storage key is `publius:x-promo-dismissed`.

## Component boundary

Create a small homepage-specific component responsible for:

1. Rendering the semantic editorial notice and X link.
2. Rendering the dismiss control.
3. Reading and writing only its own namespaced preference.
4. Hiding itself when a stored dismissal exists.

The homepage decides where the component appears. No global layout or
paper-page code should know about the promotion.

## Accessibility

- Use an `aside` with an editorially descriptive accessible label.
- Give the dismiss button the accessible name `Dismiss ReadPublius notice`.
- Preserve the existing 44px minimum interaction target.
- Keep the close mark decorative inside the labeled button.
- Maintain a visible focus indicator for the link and dismiss button.
- Ensure the reading order is label, message, action, dismiss control.
- Do not move focus when the notice is dismissed; the next normal tab stop
  follows in document order.
- Meet the existing contrast standard in default and forced-colors modes.

## Verification

Automated coverage should confirm:

1. The homepage contains the approved label, message, and X destination.
2. Individual paper pages and other site shells do not contain the notice.
3. Activating dismiss hides the notice and writes the namespaced preference.
4. Reloading the homepage with the preference set keeps the notice hidden.
5. Following the X link does not write the dismissal preference.
6. Storage failures do not break dismissal for the current page.
7. The dismiss control is keyboard operable and exposes its accessible name.

Visual verification should cover:

- 320px mobile width.
- The existing tablet and desktop homepage layouts.
- 200% zoom.
- Keyboard focus treatment.
- Forced colors.
- JavaScript-disabled fallback.

## Non-goals

- No modal, popover, sticky banner, or timed prompt.
- No promotion on Federalist paper pages.
- No promise of daily publishing.
- No follower count, social proof, live X data, embedded timeline, or X SDK.
- No custom analytics event or campaign dashboard in this first version.
- No change to the existing footer and About-page X links.
