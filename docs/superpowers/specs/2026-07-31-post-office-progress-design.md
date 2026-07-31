# Post Office Progress Design

## Goal

Make `/post-office` the single place to check the site's recent progress by
adding daily visits and daily confirmed subscriptions alongside the existing
sent-email activity.

## Success criteria

- The dashboard shows visits and newly confirmed subscriptions for the most
  recent 30 Eastern calendar dates, including the current partial date.
- The visit totals come from Cloudflare rather than from new first-party
  tracking.
- A new subscription counts on the date its address is confirmed, not when the
  subscription form is submitted.
- Visits, confirmed subscriptions, current subscriber totals, weekly delivery
  distribution, and sent-email activity remain available from one protected
  page.
- One unavailable source does not hide figures from sources that are still
  available.
- The page exposes no subscriber-level data, credentials, or upstream error
  details.

## Metric definitions

### Visits

Use Cloudflare's `visits` measure from the zone-scoped
`httpRequestsAdaptiveGroups` GraphQL dataset. Filter the dataset to
`requestSource: "eyeball"` so Cloudflare product activity and other non-user
request sources are excluded. A visit retains Cloudflare's definition: an
arrival whose referrer is external to the hostname, or a direct arrival; one
visit may contain multiple page views.

Request hourly groups and regroup them into `America/New_York` dates in the
Worker. This keeps the visit series on the same Eastern calendar boundaries as
the other two charts. Use exact UTC bounds that fully cover the 30 Eastern
dates, including 23-hour and 25-hour daylight-saving dates, and discard any
overfetched hour outside those date labels.

Cloudflare may adaptively sample analytics at higher volumes. The dashboard
will present Cloudflare's returned estimate as the visit count and will not
claim that it is an unsampled raw event total.

References:

- <https://developers.cloudflare.com/analytics/graphql-api/>
- <https://developers.cloudflare.com/analytics/graphql-api/migration-guides/graphql-api-analytics/>
- <https://developers.cloudflare.com/analytics/graphql-api/features/filtering/>
- <https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/>

### New subscriptions

Count rows from D1's `subscribers` table by `confirmed_at`. A row contributes
once, on the Eastern date containing its confirmation timestamp. Rows with a
null `confirmed_at` do not contribute, so pending and abandoned form
submissions are excluded. A later pause or unsubscribe does not erase the
historical confirmation from this growth series.

The query returns only confirmation timestamps inside a bounded lookback; it
never returns email addresses, IP addresses, tokens, or subscriber IDs to the
renderer.

### Sent mail

Keep the existing definition and presentation: accepted recipients by Eastern
date for 30 dates, plus the rolling last-24-hours total and the 100-send
reference. Sent mail remains separate from the new progress chart because its
quota context is operational rather than an audience-growth scale.

## Architecture and data flow

The post-office request continues to be handled by the `publius-post` Worker
behind Cloudflare Access.

1. Establish one `refreshedAt` instant for the entire response.
2. Load current subscriber totals and weekly delivery-day counts from D1 as the
   dashboard's core register.
3. In parallel, load the existing sent-mail activity, confirmation timestamps
   from D1, and hourly visit groups from Cloudflare GraphQL.
4. Normalize visits, confirmations, and email sends against the same ordered
   list of 30 Eastern date labels, filling missing dates with zero.
5. Render the page entirely on the server. No client-side request or dashboard
   JavaScript is introduced.

The Cloudflare client is a focused module that owns query construction,
authentication, timeout behavior, response validation, and conversion from
the GraphQL response shape into hourly visit rows. The daily-series logic owns
Eastern date boundaries, empty-date filling, and aggregation. The dashboard
renderer consumes already-normalized series and does not know about GraphQL or
D1 response details.

## Configuration and credentials

Add these Worker environment values:

- `CLOUDFLARE_ZONE_ID`: the zone identifier for `federalistreader.org`. This is
  configuration, not user-visible dashboard data.
- `CLOUDFLARE_ANALYTICS_TOKEN`: a Worker secret containing an API token scoped
  only to the analytics read access needed for that zone.

The API token is sent only in the server-side `Authorization: Bearer` header to
`https://api.cloudflare.com/client/v4/graphql`. It is never embedded in HTML,
returned in an error, or written to logs. Deployment documentation will name
both values and identify which one must be stored as a Wrangler secret.

No D1 migration or analytics snapshot table is required. Existing
`confirmed_at` history supplies subscription activity, and Cloudflare remains
the source of record for visits.

## Dashboard presentation

Preserve the existing operator-tally-sheet visual world: one newsprint sheet,
square ruled regions, serif display figures, restrained oxblood and verdigris,
and system-sans utility labels. Do not turn the page into a generic card-based
analytics dashboard.

The order remains:

1. masthead and refreshed timestamp;
2. current subscriber register;
3. weekly send-day table;
4. new **Progress** section;
5. existing **Sent mail** section;
6. refresh action.

The approved Progress layout is an aligned small-multiple view:

- **Visits** uses a verdigris line in its own labeled plot.
- **New subscriptions** uses oxblood bars in its own labeled plot.
- The two plots have independent vertical scales but identical horizontal date
  positions and shared endpoint/weekly date labels.
- Each plot exposes its own scale markings or values; the design never suggests
  that vertical positions are directly comparable between the two metrics.
- An expandable exact-values table has one row per Eastern date and columns for
  Date, Visits, and Confirmed subscriptions.

The Progress heading identifies the range as “30 days · Eastern Time.” The
current date is allowed to be partial. Copy uses “Confirmed subscriptions” in
the table and accessible descriptions even if the compact visible plot label
uses “New subscriptions.”

## Accessibility and responsive behavior

- Both charts are inline SVG with an accessible `<title>` and `<desc>`.
- Each mark has a text equivalent in its SVG title, and every value is also
  available in the semantic exact-values table.
- Series differ by geometry and direct labels as well as color.
- Forced-colors mode maps lines, bars, rules, and text to system colors while
  preserving the line-versus-bar distinction.
- The two plots remain vertically stacked at all widths. They share the same
  inner plotting width so dates remain aligned without requiring horizontal
  scrolling.
- The exact-values table may use the existing bounded horizontal overflow at
  narrow widths.
- The page remains useful with JavaScript disabled, at 200 percent zoom, with
  reduced transparency, and with keyboard-only navigation.

## Failure handling

Current subscriber totals and weekly send-day counts remain the core dashboard
load. If either core query fails, return the existing generic private error
page and HTTP 500 response.

Visits, confirmed-subscription history, and sent-mail activity are independent
optional panels:

- Fetch them independently so one rejection does not cancel the others.
- Bound the Cloudflare API request with a short timeout so a slow analytics
  response cannot hold the protected page indefinitely.
- If visits fail or their configuration is absent, keep the Progress section,
  show “Visit activity temporarily unavailable,” and continue to render
  confirmed subscriptions when available.
- If confirmation history fails, show “Subscription activity temporarily
  unavailable” and continue to render visits when available.
- If both progress series fail, show one compact Progress-unavailable message.
- Preserve the existing sent-mail unavailable behavior.
- Log only a stable source-specific diagnostic message. Do not log response
  bodies, GraphQL variables containing identifiers, authorization headers, D1
  statements, or subscriber data.

The response retains `Cache-Control: private, no-store`, robots exclusion,
`Referrer-Policy: no-referrer`, and the existing Cloudflare Access boundary.

## Response validation

Treat the Cloudflare response as unavailable unless all of these are true:

- the HTTP response is successful;
- the body parses as JSON;
- the GraphQL `errors` collection is absent or empty;
- exactly one authorized zone result is present;
- every accepted row contains a parseable hour and a finite, non-negative,
  integer visit total.

Rows outside the requested daily labels are ignored after Eastern regrouping.
Duplicate hourly groups are summed defensively. Missing hours and missing dates
represent zero activity rather than an error.

## Testing strategy

### Daily-series unit tests

- Produces exactly 30 chronological Eastern labels including today.
- Fills missing dates with zero.
- Assigns hours correctly across Eastern midnight.
- Handles the 23-hour spring-forward and 25-hour fall-back dates.
- Ignores timestamps outside the selected labels.

### Cloudflare client unit tests

- Sends one authenticated POST to the GraphQL endpoint with zone scope,
  `requestSource: "eyeball"`, hourly grouping, ordered results, and bounded
  time filters.
- Parses a valid response into hourly rows.
- Rejects HTTP, JSON, GraphQL, missing-zone, malformed-row, negative-count,
  timeout, and absent-configuration cases without leaking response details.

### D1 tests

- Reads only non-null confirmation timestamps in the bounded lookback.
- Counts a confirmation on its Eastern date.
- Excludes pending rows.
- Keeps confirmations from subscribers who later paused or unsubscribed.
- Does not expose PII in the returned activity type.

### Renderer tests

- Renders aligned, labeled visit and subscription plots with 30 points each.
- Includes accessible SVG titles, descriptions, mark text, and the exact-values
  table.
- Uses separate plot scales and retains the sent-mail quota treatment.
- Contains no email address, token, IP, zone ID, API token, provider message
  ID, or raw upstream error.

### Handler tests

- Passes one shared refresh instant to all three activity loaders.
- Fetches the optional activity sources independently.
- Renders each source while either of the other optional sources is down.
- Returns the existing private generic 500 page when a core subscriber query
  fails.
- Preserves dashboard security and cache headers on success and failure.

No test calls the live Cloudflare API. Network behavior is covered with an
injected fetch stub, while production provisioning is verified separately as a
deployment smoke test behind Cloudflare Access.

## Deployment and verification

Implementation deployment requires:

1. create a least-privilege Cloudflare API token with analytics read access for
   the `federalistreader.org` zone;
2. store it as the Worker's `CLOUDFLARE_ANALYTICS_TOKEN` secret;
3. configure `CLOUDFLARE_ZONE_ID` for the Worker;
4. deploy the Worker after the full unit and project check suites pass;
5. open `/post-office/` through Cloudflare Access and compare several daily
   visit totals with Cloudflare's analytics view;
6. confirm the page still renders useful partial data by exercising a
   non-production deployment with invalid analytics credentials.

## Out of scope

- Unique-visitor identity or cross-session tracking.
- Page-view, referrer, geography, device, or per-path breakdowns.
- Conversion-rate calculations or causal attribution between visits and
  subscriptions.
- Historical D1 snapshots of Cloudflare analytics.
- Changes to the public Cloudflare beacon.
- Changes to Cloudflare Access policy, subscriber workflows, email delivery,
  or cleanup retention.
