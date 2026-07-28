# Remove X from User-Facing Surfaces

**Date:** July 28, 2026

## Objective

Remove every visible reference and outbound link to X from the Federalist
Reader website and subscription emails. Preserve non-visible social-card
metadata that helps shared links render previews, as well as historical
internal documentation and asset-generation scripts.

## Scope

The change removes X from six user-facing surfaces:

1. The promotional notice on the homepage.
2. The shared footer navigation.
3. The About page's follow section.
4. The subscription-confirmed page.
5. The footer content in generated subscription emails.
6. The paper-page sharing control.

The homepage promotional component and its dedicated styling will be removed
when they no longer have a caller. Paper sharing will retain its copy-link
action, including copied-state feedback, but will no longer render or
construct an X posting intent.

## Out of Scope

The following remain because they are not visible invitations or outbound
traffic sources:

- `twitter:*` metadata used by link-preview crawlers.
- Existing social-card images.
- Historical design and implementation documents.
- Internal scripts and tests for generating the existing X header asset.

## User Flow

- The homepage proceeds directly from its existing introductory content into
  the paper index without the dismissible X promotion.
- Global navigation and the footer continue to expose the site's internal
  destinations without an X destination.
- The About page ends with its contact information and existing colophon,
  without a follow-on-X section.
- The subscription-confirmed page confirms enrollment and points readers back
  into the site without an X invitation.
- Subscription emails retain their required delivery, management,
  unsubscribe, and postal-address content without an X invitation.
- Paper pages retain a working "Copy link" sharing action without an X posting
  action or an unnecessary action divider.

## Implementation Boundaries

Production changes stay limited to the affected Astro pages, shared layout,
email renderer, share component, and any styling made unreachable by removing
the homepage notice. No replacement social network, feature flag, or new
promotional copy will be introduced.

## Testing and Verification

Tests will be changed before production code so they fail against the current
X-bearing output. They will then verify:

- Built homepage, About, subscription-confirmed, global footer, and paper
  pages contain no visible X invitations or `x.com`/Twitter intent links.
- The homepage remains usable without the removed notice.
- The paper share control still exposes and executes the copy-link path.
- Generated confirmation, welcome, and paper-issue email output contains no X
  invitation while preserving required subscription links and content.
- Existing accessibility checks continue to pass.

Final verification will include the full project check and build, targeted
email tests, a repository audit for user-facing X links, and rendered
browser-flow checks across the affected pages.
