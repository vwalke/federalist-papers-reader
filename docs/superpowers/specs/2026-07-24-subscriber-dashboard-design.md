# Subscriber Dashboard Design

**Date:** July 24, 2026  
**Status:** Approved

## Purpose

Provide the Federalist Reader operator with current subscriber summary
statistics from a phone without exposing subscriber records or requiring the
local `pnpm stats` command.

The dashboard is an operator-only view. It is not part of the public reading
experience, site navigation, sitemap, or search index.

## Chosen Approach

The existing `publius-post` Cloudflare Worker will serve a small,
server-rendered dashboard at:

```text
https://federalistreader.org/post-office/
```

This Worker already owns the D1 binding used by the subscription system. It
can query aggregate statistics without adding a public data API or copying
subscriber data into the static Astro site.

A Cloudflare Access self-hosted application will protect
`federalistreader.org/post-office*`. The suffix wildcard deliberately covers
both `/post-office` and `/post-office/`; Cloudflare's `/post-office/*` form
does not cover the parent path. Access will use Cloudflare as the
identity provider, allow only members of the current Cloudflare account, and
issue a one-month session. Cloudflare Access is the authentication boundary;
the dashboard is deployed only after that boundary is configured.

## Alternatives Considered

### Static Astro page with a protected JSON API

This would separate the HTML shell from the data endpoint, but it would add
client-side JavaScript, an extra public route, and two independently secured
surfaces. It provides no useful benefit for this read-only dashboard.

### Periodically generated snapshot

A scheduled job could write aggregate data to KV or a static file. This would
reduce live D1 reads, but the data would become stale and the added scheduler,
storage, and failure modes are unjustified for one operator and two small
queries.

## Data and Privacy

The dashboard runs aggregate SQL queries only. It never selects, returns,
logs, or renders email addresses, subscriber IDs, confirmation IP addresses,
token secrets, or other subscriber-level data.

The subscriber summary uses the same definitions as the existing
`workers/post/stats.mjs` command:

- **Active:** subscribers whose status is `active`.
- **Pending:** subscribers whose status is `pending`.
- **Gone:** subscribers whose status is neither `active` nor `pending`,
  including paused and unsubscribed rows that have not yet been purged.
- **Weekly:** active subscribers in the `weekly` program.
- **As it happened:** active subscribers in the `calendar` program.

The weekly send-day summary includes Sunday through Saturday in calendar
order. Each day shows active and pending counts for the `weekly` program,
including zero-count days.

The web dashboard intentionally omits the CLI command's recent signups and
recent deliveries sections. Those sections are unnecessary for the requested
summary, and recent signups contain PII.

## Worker Structure and Data Flow

The D1 access layer gains two focused read methods:

1. Retrieve the five subscriber summary counts as one aggregate row.
2. Retrieve active and pending weekly subscriber counts grouped by
   `send_dow`.

The request handler accepts `GET /post-office` and
`GET /post-office/`, calls both read methods, fills in missing weekday rows
with zeroes, and passes the aggregate values to a dedicated HTML renderer.
No JSON endpoint or browser-side fetch is introduced.

The Worker route configuration adds
`federalistreader.org/post-office*`. All existing `/api/*` and `/manage*`
behavior remains unchanged, and every other site path continues to resolve to
Cloudflare Pages. The Wrangler configuration explicitly disables the
Worker's `workers.dev` hostname and preview URLs so neither can bypass the
custom-domain Access application.

## Interface

The page is phone-first and follows the existing Federalist visual language
without imitating the public newspaper layout too heavily:

- A compact **Post Office** heading.
- An unambiguous UTC “last refreshed” timestamp.
- Five readable subscriber total cards.
- A seven-row weekly send-day table with active and pending columns.
- A standard refresh link or button that reloads the page.

The page uses semantic headings, definition-list or equivalent summary
markup, a properly headed table, high-contrast colors, visible focus styles,
and touch targets at least 44 CSS pixels high. It requires no JavaScript.

## Discovery and Caching Controls

The dashboard is absent from:

- Public navigation.
- The generated sitemap.
- Astro's static route tree.
- Public documentation that is rendered on the site.

Every dashboard response includes:

```text
Cache-Control: private, no-store
X-Robots-Tag: noindex, nofollow, noarchive
Referrer-Policy: no-referrer
```

The HTML also contains a matching robots meta directive. These controls reduce
accidental discovery and prevent authenticated content from being cached, but
they are not treated as authentication. Cloudflare Access provides the actual
access control.

## Failure Behavior

- Unsupported methods return `405 Method Not Allowed`.
- An unknown path continues to return `404 Not Found`.
- A D1 failure returns a generic `500` HTML page with the same no-store and
  noindex headers.
- Database error messages and stack traces are not included in the response.
- If the Access application is not configured, deployment must stop; the
  Worker route must not be made live without the authentication boundary.

## Testing

Automated tests will verify:

- The database methods return only the specified aggregate shapes.
- The summary definitions match the existing CLI query semantics.
- All seven weekdays render in order, including zero-count days.
- The dashboard handles both trailing-slash forms.
- Non-GET methods are rejected.
- Dashboard and error responses carry the privacy and caching headers.
- Rendered HTML contains the requested totals and no representative email
  address or subscriber-level fields.
- Existing subscription, management, webhook, delivery, and schedule tests
  continue to pass.

Local verification will run the Worker test suite and TypeScript checking.
Production verification will confirm that:

1. An unauthenticated phone is redirected to Cloudflare authentication.
2. A Cloudflare account member can authenticate and view current counts.
3. A non-member cannot access the dashboard.
4. Refreshing produces current D1 values.
5. The production response contains the no-store and noindex headers.

## Deployment and Operations

Deployment is intentionally ordered:

1. In Cloudflare Zero Trust, create a self-hosted Access application for
   `federalistreader.org/post-office*`.
2. Use Cloudflare as the login method.
3. Add an Allow policy whose selector is **Cloudflare Account Member** for the
   current account.
4. Set the application or policy session duration to one month.
5. Verify Access intercepts the path before the Worker route exists.
6. Confirm Wrangler has `workers_dev = false` and `preview_urls = false`.
7. Deploy `publius-post` manually with Wrangler, following the repository's
   existing Worker deployment process.
8. Perform the production checks above.

The one-time Access setup, deployment order, and smoke test will be added to
`docs/deployment.md`. No D1 migration, Astro deployment, navigation change, or
new secret is required.

## Scope Boundaries

This work does not add subscriber search, lists, exports, mutations, charts,
historical trends, delivery logs, or email addresses. Those capabilities would
change the privacy and security profile and require a separate design.
