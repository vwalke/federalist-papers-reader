# Email Activity Dashboard Design

## Goal

Extend the Cloudflare Access-protected Post Office dashboard with two
aggregate-only measures of successful outbound email activity:

1. the number of emails Resend accepted during the preceding rolling 24 hours;
2. a vertical bar chart of successful sends for each of the last 30 Eastern
   calendar days.

The figures include every successful send in the Resend team, including paper
issues, confirmation emails, welcome emails, and sends initiated outside the
Federalist Reader Worker. They do not include failed API requests or inbound
email.

No recipient address, subject, message body, IP address, or other PII may be
stored for this feature or rendered on the dashboard.

## Definitions

- A **sent email** is one recipient accepted through a successful Resend send.
  Resend emits `email.sent` when it accepts the API request and will attempt
  delivery. A request addressed to multiple recipients contributes one count
  per `To`, `CC`, or `BCC` recipient, matching Resend's quota accounting.
  Later delivery, bounce, complaint, open, and click events do not change the
  send count.
- The **rolling 24-hour count** includes records with `sent_at` greater than or
  equal to the instant 24 hours before the dashboard query.
- A **calendar day** uses the IANA `America/New_York` time zone. This is
  DST-aware: dates use EST or EDT according to the applicable date. The
  implementation must not use a fixed UTC offset.
- The **last 30 days** include the current Eastern calendar day and the 29
  preceding Eastern dates. Days without sends appear with a zero.
- The **100 line** is a visual reference to the current free-plan outbound
  allowance, not a claim that the displayed rolling sent count exactly equals
  Resend quota usage. Resend also counts inbound mail and each recipient
  separately.

## Architecture

Use a hybrid local ledger and Resend webhook:

1. The Worker records the Resend email ID immediately after every successful
   send made by Federalist Reader.
2. The existing verified Resend webhook additionally subscribes to
   `email.sent`. Its handler inserts the event's `data.email_id`,
   `data.created_at`, and aggregate recipient count.
3. Both paths use the Resend email ID as the primary key and insert
   idempotently. Webhook retries and overlap between immediate recording,
   webhook delivery, and historical backfill cannot double-count a send.
4. A one-time backfill pages through Resend's sent-email listing and inserts
   the ID, creation timestamp, and aggregate recipient count of retained
   messages from the preceding 30 days.
5. Dashboard queries operate only on the local D1 ledger. Loading the protected
   dashboard never calls Resend.

The webhook is authoritative for sends created outside the Federalist Reader
Worker and repairs missed immediate writes. Immediate recording keeps recent
figures current before webhook delivery.

## Data Model

Add a D1 migration with an aggregate-safe ledger:

```sql
CREATE TABLE email_sends (
  provider_message_id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1 CHECK (recipient_count >= 1)
);

CREATE INDEX idx_email_sends_sent_at ON email_sends (sent_at);
```

`provider_message_id` is Resend's opaque email ID, not the SMTP message ID.
`sent_at` is normalized to an ISO-8601 UTC instant on write.
`recipient_count` is the number of recipients from the send event; no recipient
address is retained. No source/category field is necessary because the
requested graph combines all successful sends.

Rows older than 45 days are deleted at the start of the existing daily job.
The margin beyond 30 calendar days protects the chart across time-zone
boundaries and delayed webhook retries while avoiding unnecessary retention.

## Components and Boundaries

### Email activity repository

Extend the D1 repository with narrowly scoped methods:

- `recordEmailSend(providerMessageId, sentAt, recipientCount)`
- `getEmailActivity(now)`
- `purgeEmailSends(olderThanDays)`

`getEmailActivity` returns:

- `last24Hours`;
- exactly 30 `{ date, count }` values in chronological order.

The repository never returns message IDs to the renderer.

### Send recording

Centralize post-send recording so article delivery, retries, confirmations, and
welcome messages use one path. After Resend returns an email ID, attempt the D1
insert.

A recording failure must not convert an accepted send into a failed delivery or
trigger a duplicate email. Log the storage error without the recipient address,
continue the original workflow, and rely on the `email.sent` webhook to repair
the ledger.

### Resend webhook

Keep the existing Svix signature verification and bounce/complaint behavior.
For `email.sent`:

1. validate that `data.email_id` and `data.created_at` are non-empty strings;
2. normalize and validate the timestamp;
3. count the entries in `data.to`, `data.cc`, and `data.bcc` without retaining
   their values, with a minimum count of one;
4. insert the email ID, timestamp, and count idempotently.

If a valid webhook cannot write to D1, return `500` so Resend retries it. Invalid
signatures remain `401`; malformed payloads remain `400`. The handler must not
log or persist the payload's recipient or subject fields.

The existing Resend webhook endpoint is updated in place to subscribe to
`email.sent`, `email.bounced`, and `email.complained`. No additional endpoint is
created.

### Historical backfill

Provide a repository script under `workers/post/` that:

1. reads a full-access Resend API key from the environment without printing it;
2. pages through `GET /emails` with at most 100 records per page;
3. stops after reaching messages older than the 30-day cutoff;
4. projects each result immediately to
   `{ id, created_at, recipient_count }`, reducing the address arrays to a
   number before any write or output;
5. inserts those fields with `INSERT OR IGNORE`;
6. prints aggregate progress counts only.

The script must never print, write, or retain recipient, sender, or subject
fields. It is an explicit one-time deployment step, not a dashboard code path.
If the existing send-only key cannot list emails, use a separate temporary
full-access key for the backfill and revoke it afterward.

## Time-Zone Calculation

Store all instants in UTC. Compute the current Eastern date and each Eastern
day's UTC start/end with `Intl.DateTimeFormat` configured for
`America/New_York`.

The algorithm must derive real boundaries for each date rather than subtracting
fixed 24-hour periods or applying `UTC-5`. Spring-forward days contain 23
hours; fall-back days contain 25 hours.

The database query may fetch all rows from the earliest calculated UTC boundary
through `now`; application code assigns each timestamp to its Eastern date.
At the current Resend limit this is at most roughly 3,000 small records and is
well inside D1 allowances. The rolling 24-hour value is calculated from the
same timestamps using an instant cutoff, independent of calendar-day grouping.

## Dashboard Presentation

Add a `Sent mail` section below the existing subscriber statistics:

1. A bordered summary displays `Last 24 hours`, the count, `of 100 sent`, and a
   horizontal usage bar capped visually at 100%.
2. A JavaScript-free, server-rendered vertical bar chart displays the 30
   Eastern daily counts.
3. A dashed oxblood line marks 100 sends. Bars may exceed the line if the plan
   changes or external activity exceeds the reference.
4. Labels identify `Eastern Time`, the date range, selected weekly date ticks,
   and the first and final date.
5. Exact daily values are available in an accessible text/table equivalent.
   The chart supplies an accessible title and description and does not depend
   on hover.
6. The chart fits a 390-pixel viewport without horizontal page overflow.
7. Existing broadside colors, typography, borders, and spacing remain in use.

The page stays server-rendered and JavaScript-free. Existing private caching,
robots, referrer, Cloudflare Access, and no-navigation rules remain unchanged.

## Failure Behavior

- Subscriber totals and weekly-day statistics still render if the email
  activity query fails.
- The failed section shows `Email activity temporarily unavailable` without
  internal error details.
- A successful Resend API response remains a successful send even if immediate
  ledger recording fails.
- A valid `email.sent` webhook returns `500` on a D1 failure so Resend retries.
- Replayed webhooks, send-path overlap, and repeated backfills are idempotent.
- Backfill failures stop with a non-zero exit status and an aggregate-only
  message; partial inserted data remains safe to resume.

## Privacy and Security

- Store only Resend email IDs, UTC timestamps, and aggregate recipient counts.
- Never expose provider IDs in the dashboard response.
- Never log webhook bodies, recipient addresses, subjects, or backfill records.
- Continue to require Cloudflare Access for `/post-office*`.
- Continue `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex, nofollow, noarchive`, and
  `Referrer-Policy: no-referrer`.
- Backfill credentials remain environment-only and are never placed in source,
  command arguments, logs, or committed files.

## Testing

Automated tests cover:

- idempotent recording by provider ID;
- multi-recipient sends counting once per recipient without persisting an
  address;
- all successful Worker send paths recording accepted sends;
- recording failures not changing send success or causing retries;
- authenticated `email.sent` handling and existing bounce/complaint behavior;
- invalid signatures and malformed `email.sent` payloads;
- webhook D1 failures producing a retryable response;
- rolling 24-hour inclusion and exclusion boundaries;
- 30 chronological dates including zero-send days;
- DST spring-forward and fall-back Eastern calendar boundaries;
- graceful dashboard degradation when activity queries fail;
- vertical bar, quota line, summary, time-zone label, and accessible exact
  values;
- absence of recipient addresses, `mailto:` links, provider IDs, and other PII
  in rendered HTML;
- 390-pixel responsive layout without horizontal overflow.

Production verification compares the protected dashboard only with
aggregate-only Resend or D1 totals. No individual email record is displayed or
printed during validation.

## Rollout

1. Implement and test the migration, repository, capture paths, webhook, and
   dashboard.
2. Apply the D1 migration remotely.
3. Deploy the Worker.
4. Update the existing Resend webhook to include `email.sent`.
5. Run the 30-day backfill with a full-access Resend key.
6. Verify webhook delivery, deduplication, rolling count, Eastern daily bars,
   privacy headers, and phone layout.
7. Revoke any temporary full-access key used for backfill.

No additional paid service, Worker, D1 database, or Resend webhook endpoint is
introduced. Expected incremental cost at the present scale is zero.
