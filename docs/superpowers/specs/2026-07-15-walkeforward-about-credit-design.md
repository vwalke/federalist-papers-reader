# WalkeForward About Credit Design

## Goal

Give WalkeForward, LLC a restrained production credit on the About page without interrupting the personal story or making the site feel promotional.

## Content and destination

The credit reads:

> This is a production of WalkeForward, LLC.

Only `WalkeForward, LLC.` is linked. The destination is `https://walkeforward.com`. The link may remain in place before the WalkeForward site launches; no temporary disabled state or explanatory copy is needed.

## Placement and structure

Place the credit after the final About-page notes and before the About article closes. Use a semantic footer scoped to the article so the credit is clearly separate from the editorial sections and from the site-wide footer.

## Visual treatment

- Present the credit as a quiet closing colophon, centered across the available measure.
- Separate it from the notes with a short, fine horizontal rule rather than a full-width divider or boxed treatment.
- Use small, readable text in the existing muted-ink color and reading typeface.
- Keep the sentence in normal capitalization; do not turn it into a tracked uppercase label.
- Give the linked company name the site’s established underline and focus treatment, with no logo, icon, badge, or promotional call to action.

## Responsive and print behavior

The colophon remains one simple text line when space permits and wraps naturally on narrow screens without overflow. It remains visible in print as part of the About page’s provenance.

## Accessibility

The linked text identifies the destination without relying on an icon. The link opens in the current tab, follows the site’s existing keyboard-focus treatment, and must retain readable contrast against the paper background.

## Verification

- A static regression test confirms the exact credit copy, linked text, and `https://walkeforward.com` destination.
- Browser checks confirm the colophon follows the notes, stays centered, and does not introduce horizontal overflow on desktop or mobile.
- The existing accessibility and full build suites remain clean.
