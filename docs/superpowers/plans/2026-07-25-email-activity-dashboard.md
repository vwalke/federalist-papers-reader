# Email Activity Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an aggregate-only rolling 24-hour sent-email count and a DST-aware 30-day Eastern Time bar chart to the protected Post Office dashboard.

**Architecture:** Persist only Resend email IDs, UTC timestamps, and aggregate recipient counts in D1. Record Worker-originated sends immediately, reconcile every team send through the existing verified `email.sent` webhook, and backfill Resend's retained history once. Build dashboard aggregates locally and render an accessible, JavaScript-free SVG bar chart.

**Tech Stack:** Cloudflare Workers, D1/SQLite, TypeScript 5.9, Node.js 22, Vitest 4, Resend HTTP API and Svix-signed webhooks, server-rendered HTML/CSS/SVG.

## Global Constraints

- A sent email means one recipient accepted by a successful Resend send; later delivery events do not change the count.
- Calendar grouping uses the IANA `America/New_York` time zone and must honor EST/EDT transitions.
- The chart includes the current Eastern date plus the 29 preceding Eastern dates, including zero-send days.
- The rolling count uses the exact preceding 24 hours and is independent of calendar grouping.
- Store only Resend email IDs, UTC timestamps, and aggregate recipient counts.
- Never store or log recipient addresses, subjects, bodies, webhook payloads, IP addresses, or backfill records.
- Keep `/post-office*` behind the existing Cloudflare Access application.
- Preserve `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`.
- Keep the dashboard server-rendered and JavaScript-free.
- Keep `workers_dev = false` and `preview_urls = false`.
- Use no new runtime dependencies.
- A tracking write failure must never turn an accepted send into a failed delivery or cause a duplicate send.
- D1 and Resend mutations must be idempotent by provider email ID.
- Apply the remote D1 migration before deploying code that reads or writes `email_sends`.

---

## File Structure

**Create**

- `workers/post/migrations/0003_email_sends.sql` — D1 table and timestamp index.
- `workers/post/src/email-activity.ts` — pure Eastern-date grouping and rolling-window logic.
- `workers/post/src/send-tracking.ts` — one failure-safe wrapper around every successful Resend send.
- `workers/post/backfill-email-sends.mjs` — one-time paginated Resend-to-D1 backfill runner.
- `workers/post/test/email-activity.test.ts` — DST, rolling-window, and zero-day unit tests.
- `workers/post/test/send-tracking.test.ts` — accepted-send recording and failure isolation tests.
- `workers/post/test/backfill-email-sends.test.ts` — pagination, projection, SQL, and privacy tests.

**Modify**

- `workers/post/src/db.ts` — activity types and D1 record/query/purge methods.
- `workers/post/src/resend.ts` — move the shared `Sender` type beside `OutboundEmail`.
- `workers/post/src/handlers.ts` — use tracked sending, ingest `email.sent`, and degrade only the activity panel.
- `workers/post/src/deliver.ts` — use tracked sending for initial issues and retries; purge old activity rows.
- `workers/post/src/dashboard.ts` — activity summary, SVG daily bars, exact-value table, and unavailable state.
- `workers/post/test/db.test.ts` — repository SQL and mapping tests.
- `workers/post/test/handlers.test.ts` — dashboard degradation, transactional send recording, and webhook tests.
- `workers/post/test/deliver.test.ts` — paper/retry recording and purge tests.
- `workers/post/test/dashboard.test.ts` — visual contract, accessibility, scaling, and PII tests.
- `workers/post/package.json` — `backfill:email-sends` command.
- `docs/deployment.md` — webhook subscription, migration, backfill, privacy, and smoke-test instructions.

---

### Task 1: D1 Ledger and Eastern-Time Aggregation

**Files:**

- Create: `workers/post/migrations/0003_email_sends.sql`
- Create: `workers/post/src/email-activity.ts`
- Create: `workers/post/test/email-activity.test.ts`
- Modify: `workers/post/src/db.ts:1-188`
- Modify: `workers/post/test/db.test.ts:1-69`

**Interfaces:**

- Produces:

```ts
export interface EmailSendRow {
  sent_at: string;
  recipient_count: number;
}

export interface DailyEmailCount {
  date: string;
  count: number;
}

export interface EmailActivity {
  last24Hours: number;
  days: DailyEmailCount[];
}

export function easternDate(instant: Date): string;
export function summarizeEmailActivity(
  rows: EmailSendRow[],
  now: Date
): EmailActivity;
```

- Extends `Db` with:

```ts
recordEmailSend(
  providerMessageId: string,
  sentAt: string,
  recipientCount: number
): Promise<void>;
getEmailActivity(now: Date): Promise<EmailActivity>;
purgeEmailSends(olderThanDays: number): Promise<void>;
```

- Later tasks consume `EmailActivity`, `Db.recordEmailSend`,
  `Db.getEmailActivity`, and `Db.purgeEmailSends`.

- [ ] **Step 1: Write the migration**

Create `workers/post/migrations/0003_email_sends.sql`:

```sql
CREATE TABLE email_sends (
  provider_message_id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1
    CHECK (recipient_count >= 1)
);

CREATE INDEX idx_email_sends_sent_at ON email_sends (sent_at);
```

- [ ] **Step 2: Write failing aggregation tests**

Create `workers/post/test/email-activity.test.ts` with these cases:

```ts
import { describe, expect, it } from 'vitest';
import { easternDate, summarizeEmailActivity } from '../src/email-activity';

const row = (sent_at: string, recipient_count = 1) => ({
  sent_at, recipient_count
});

describe('email activity aggregation', () => {
  it('returns 30 chronological Eastern dates and fills empty days', () => {
    const result = summarizeEmailActivity(
      [row('2026-07-25T03:30:00.000Z', 2)],
      new Date('2026-07-25T16:00:00.000Z')
    );
    expect(result.days).toHaveLength(30);
    expect(result.days[0].date).toBe('2026-06-26');
    expect(result.days.at(-1)).toEqual({ date: '2026-07-25', count: 0 });
    expect(result.days.find((day) => day.date === '2026-07-24))
      .toEqual({ date: '2026-07-24', count: 2 });
  });

  it('includes the exact rolling cutoff and excludes one millisecond before it', () => {
    const result = summarizeEmailActivity([
      row('2026-07-24T16:00:00.000Z', 3),
      row('2026-07-24T15:59:59.999Z', 7),
      row('2026-07-25T16:00:00.001Z', 11)
    ], new Date('2026-07-25T16:00:00.000Z'));
    expect(result.last24Hours).toBe(3);
    expect(result.days.at(-1)?.count).toBe(3);
  });

  it('uses the 23-hour spring-forward Eastern day', () => {
    expect(easternDate(new Date('2026-03-08T04:59:59.999Z'))).toBe('2026-03-07');
    expect(easternDate(new Date('2026-03-08T05:00:00.000Z'))).toBe('2026-03-08');
    expect(easternDate(new Date('2026-03-09T03:59:59.999Z'))).toBe('2026-03-08');
    expect(easternDate(new Date('2026-03-09T04:00:00.000Z'))).toBe('2026-03-09');
  });

  it('uses the 25-hour fall-back Eastern day', () => {
    expect(easternDate(new Date('2026-11-01T03:59:59.999Z'))).toBe('2026-10-31');
    expect(easternDate(new Date('2026-11-01T04:00:00.000Z'))).toBe('2026-11-01');
    expect(easternDate(new Date('2026-11-02T04:59:59.999Z'))).toBe('2026-11-01');
    expect(easternDate(new Date('2026-11-02T05:00:00.000Z'))).toBe('2026-11-02');
  });
});
```

- [ ] **Step 3: Run the aggregation tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/email-activity.test.ts
```

Expected: FAIL because `../src/email-activity` does not exist.

- [ ] **Step 4: Implement the pure aggregation module**

Create `workers/post/src/email-activity.ts`. Use one module-level formatter:

```ts
const EASTERN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
```

Implement `easternDate` by reading `formatToParts` and returning
`YYYY-MM-DD`. Generate the 30 date labels from the current Eastern date by
anchoring each label at `T12:00:00Z` and decrementing with `setUTCDate`; these
are date labels, not time-zone boundary calculations. Sum `recipient_count`
for rows whose instant is not after `now` and whose Eastern date is in the
30-label map. Sum the rolling window by comparing parsed epoch milliseconds to
`now.getTime() - 86_400_000`, inclusive at the cutoff and exclusive after
`now`.

Reject rows with an invalid timestamp or a non-positive/non-integer recipient
count by skipping them; the write paths validate before insertion, and a
malformed historical row must not break the operator dashboard.

- [ ] **Step 5: Run the aggregation tests and verify GREEN**

Run:

```bash
pnpm exec vitest run workers/post/test/email-activity.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Write failing D1 repository tests**

Extend `workers/post/test/db.test.ts` with a D1 stub that captures SQL and
bound values. Test:

```ts
await db.recordEmailSend(
  '56761188-7520-42d8-8898-ff6fc54ce618',
  '2026-07-25T12:00:00.000Z',
  3
);
```

Assertions:

```ts
expect(sql).toContain('ON CONFLICT(provider_message_id) DO UPDATE');
expect(bind).toEqual([
  '56761188-7520-42d8-8898-ff6fc54ce618',
  '2026-07-25T12:00:00.000Z',
  3
]);
```

Also stub the activity query to return:

```ts
[
  { sent_at: '2026-07-25T12:00:00.000Z', recipient_count: 2 },
  { sent_at: '2026-07-25T13:00:00.000Z', recipient_count: 1 }
]
```

and assert `getEmailActivity(new Date('2026-07-25T14:00:00.000Z'))` returns
`last24Hours: 3` with 30 days. Assert the query binds an ISO cutoff at least 31
days before `now`, and `purgeEmailSends(45)` binds a computed ISO cutoff rather
than interpolating a number into SQL.

- [ ] **Step 7: Run the D1 tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/db.test.ts
```

Expected: FAIL because the three activity methods are absent.

- [ ] **Step 8: Implement the D1 methods**

In `workers/post/src/db.ts`:

1. Import `EmailActivity`, `EmailSendRow`, and `summarizeEmailActivity`.
2. Re-export `EmailActivity` for dashboard consumers.
3. Add the three signatures to `Db`.
4. Implement the upsert:

```sql
INSERT INTO email_sends
  (provider_message_id, sent_at, recipient_count)
VALUES (?, ?, ?)
ON CONFLICT(provider_message_id) DO UPDATE SET
  sent_at = excluded.sent_at,
  recipient_count = excluded.recipient_count
```

5. Implement `getEmailActivity(now)` with:

```sql
SELECT sent_at, recipient_count
FROM email_sends
WHERE sent_at >= ?
ORDER BY sent_at
```

Bind `new Date(now.getTime() - 31 * 86_400_000).toISOString()`, then pass the
rows to `summarizeEmailActivity`.
6. Implement `purgeEmailSends(olderThanDays)` as
`DELETE FROM email_sends WHERE sent_at < ?`, binding an ISO instant calculated
from `Date.now()`.

- [ ] **Step 9: Run Task 1 tests and type-check**

Run:

```bash
pnpm exec vitest run workers/post/test/email-activity.test.ts workers/post/test/db.test.ts
pnpm exec tsc -p workers/post/tsconfig.json
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 10: Commit Task 1**

```bash
git add workers/post/migrations/0003_email_sends.sql \
  workers/post/src/email-activity.ts workers/post/src/db.ts \
  workers/post/test/email-activity.test.ts workers/post/test/db.test.ts
git commit -m "feat: aggregate sent email activity"
```

---

### Task 2: Failure-Safe Recording for Every Worker Send

**Files:**

- Create: `workers/post/src/send-tracking.ts`
- Create: `workers/post/test/send-tracking.test.ts`
- Modify: `workers/post/src/resend.ts:1-23`
- Modify: `workers/post/src/handlers.ts:1-114`
- Modify: `workers/post/src/deliver.ts:1-139`
- Modify: `workers/post/test/handlers.test.ts:12-53`
- Modify: `workers/post/test/deliver.test.ts:20-139`

**Interfaces:**

- Consumes `Db.recordEmailSend` from Task 1.
- Moves the shared sender type to `workers/post/src/resend.ts`:

```ts
export type Sender = (
  apiKey: string,
  mail: OutboundEmail
) => Promise<string>;
```

- Produces:

```ts
export async function sendAndRecord(
  env: Pick<Env, 'RESEND_API_KEY'>,
  db: Db,
  send: Sender,
  mail: OutboundEmail,
  now?: () => Date
): Promise<string>;
```

- [ ] **Step 1: Write failing send-tracking tests**

Create `workers/post/test/send-tracking.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { sendAndRecord } from '../src/send-tracking';

const mail = {
  from: 'Publius <publius@federalistreader.org>',
  to: 'reader@example.com',
  subject: 'A paper',
  html: '<p>A paper</p>',
  text: 'A paper',
  unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=x'
};

describe('sendAndRecord', () => {
  it('records one recipient after Resend accepts the message', async () => {
    const db = { recordEmailSend: vi.fn(async () => {}) };
    const send = vi.fn(async () => 'email-id');
    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' },
      db as never,
      send,
      mail,
      () => new Date('2026-07-25T12:00:00.000Z')
    )).resolves.toBe('email-id');
    expect(db.recordEmailSend).toHaveBeenCalledWith(
      'email-id', '2026-07-25T12:00:00.000Z', 1
    );
  });

  it('keeps an accepted send successful when D1 recording fails', async () => {
    const db = {
      recordEmailSend: vi.fn(async () => {
        throw new Error('D1 unavailable');
      })
    };
    const send = vi.fn(async () => 'email-id');
    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' }, db as never, send, mail
    )).resolves.toBe('email-id');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not record when Resend rejects the send', async () => {
    const db = { recordEmailSend: vi.fn(async () => {}) };
    const send = vi.fn(async () => {
      throw new Error('Resend 429');
    });
    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' }, db as never, send, mail
    )).rejects.toThrow('Resend 429');
    expect(db.recordEmailSend).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/send-tracking.test.ts
```

Expected: FAIL because `../src/send-tracking` does not exist.

- [ ] **Step 3: Implement `sendAndRecord`**

Move `Sender` from `handlers.ts` to `resend.ts`, then create
`send-tracking.ts`. Call the sender first. In a separate `try/catch`, call
`db.recordEmailSend(id, now().toISOString(), 1)`. On the D1 error, emit only:

```ts
console.error('accepted email activity could not be recorded');
```

Do not include the error object, message ID, recipient, subject, or message
payload. Return the Resend ID whether recording succeeds or fails.

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run:

```bash
pnpm exec vitest run workers/post/test/send-tracking.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Write failing integration assertions for all send paths**

Update the `Db` stubs in `handlers.test.ts` and `deliver.test.ts` with
`recordEmailSend`, `getEmailActivity`, and `purgeEmailSends`.

Add or extend assertions so:

- a confirmation email records `msg_test`;
- a welcome email records `msg_test`;
- the already-subscribed manage-link email records `msg_test`;
- a first paper delivery records `msg`;
- a retry records `msg`;
- `runDaily` calls `purgeEmailSends(45)`;
- when `recordEmailSend` rejects, each accepted send still produces its
  existing successful response/delivery status and the sender runs once.

- [ ] **Step 6: Run integration tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts workers/post/test/deliver.test.ts
```

Expected: the new recording and purge assertions fail because direct `send`
calls remain.

- [ ] **Step 7: Route every Worker send through the helper**

In `handlers.ts`, make the local `deliver` helper accept `db` and call
`sendAndRecord`. Update all three callers.

In `deliver.ts`, replace both direct send calls—initial issue and retry—with
`sendAndRecord`. Keep delivery marking based on the returned provider ID.

At the start of `runDaily`, after existing subscriber cleanup, call:

```ts
await db.purgeEmailSends(45);
```

Do not alter send pacing, delivery claims, retry rules, subscriber progress, or
the daily heartbeat.

- [ ] **Step 8: Run Task 2 tests and type-check**

Run:

```bash
pnpm exec vitest run workers/post/test/send-tracking.test.ts \
  workers/post/test/handlers.test.ts workers/post/test/deliver.test.ts
pnpm exec tsc -p workers/post/tsconfig.json
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit Task 2**

```bash
git add workers/post/src/resend.ts workers/post/src/send-tracking.ts \
  workers/post/src/handlers.ts workers/post/src/deliver.ts \
  workers/post/test/send-tracking.test.ts workers/post/test/handlers.test.ts \
  workers/post/test/deliver.test.ts
git commit -m "feat: record every accepted email send"
```

---

### Task 3: Authenticated `email.sent` Webhook Ingestion

**Files:**

- Modify: `workers/post/src/handlers.ts:244-296`
- Modify: `workers/post/test/handlers.test.ts:302-352`

**Interfaces:**

- Consumes `Db.recordEmailSend`.
- Accepts this Resend shape after Svix verification:

```ts
interface ResendSentEvent {
  type: 'email.sent';
  data: {
    email_id: string;
    created_at: string;
    to?: unknown[];
    cc?: unknown[];
    bcc?: unknown[];
  };
}
```

- [ ] **Step 1: Generalize the webhook test request helper**

Change `webhookRequest` to accept `payload`:

```ts
function webhookRequest(
  payload: string,
  headers: Record<string, string>
): Request
```

Keep all existing missing-secret, bounce, complaint, and forged-signature
tests green after updating their calls.

- [ ] **Step 2: Add failing `email.sent` tests**

Add tests for:

1. a valid signed event records:

```ts
expect(db.recordEmailSend).toHaveBeenCalledWith(
  '56761188-7520-42d8-8898-ff6fc54ce618',
  '2026-07-25T12:34:56.000Z',
  4
);
```

using `to` with 2 values, `cc` with 1, and `bcc` with 1;
2. missing/invalid `email_id` or `created_at` returns `400`;
3. an empty recipient set records a defensive minimum of 1;
4. a `recordEmailSend` rejection returns `500` with generic text;
5. the response body never contains an address, subject, provider ID, SQL
   detail, or webhook payload.

- [ ] **Step 3: Run webhook tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts -t "resend webhook"
```

Expected: the `email.sent` assertions fail because the handler ignores the
event.

- [ ] **Step 4: Implement validated sent-event ingestion**

Refactor only JSON parsing into a `try/catch` that returns `400`. Inspect the
parsed value as `unknown`; do not cast before checking object shape.

For `email.sent`:

1. require non-empty string `email_id`;
2. require a finite `Date.parse(created_at)`;
3. normalize with `new Date(created_at).toISOString()`;
4. calculate
   `Math.max(1, to.length + cc.length + bcc.length)`, treating non-arrays as
   empty;
5. call `db.recordEmailSend`.

Wrap only the database call in a second `try/catch`. Log
`email.sent webhook persistence failed` without the caught error and return
`new Response('webhook persistence failed', { status: 500 })`.

Preserve existing bounce/complaint unsubscribe behavior and unknown-event
`200` responses.

- [ ] **Step 5: Run webhook and full handler tests**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts
```

Expected: all handler tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add workers/post/src/handlers.ts workers/post/test/handlers.test.ts
git commit -m "feat: ingest sent email webhooks"
```

---

### Task 4: Accessible 30-Day Dashboard Bars and Graceful Degradation

**Files:**

- Modify: `workers/post/src/dashboard.ts:1-317`
- Modify: `workers/post/src/handlers.ts:38-54`
- Modify: `workers/post/test/dashboard.test.ts:1-58`
- Modify: `workers/post/test/handlers.test.ts:12-125`

**Interfaces:**

- Consumes `EmailActivity` from Task 1.
- Changes the renderer signature to:

```ts
export function renderDashboard(
  stats: SubscriberStats,
  weeklyRows: WeeklyDayStats[],
  emailActivity: EmailActivity | null,
  refreshedAt: Date
): string;
```

- `null` means only the email-activity panel is unavailable.

- [ ] **Step 1: Update existing renderer calls**

Pass `null` as the third argument in existing tests that are unrelated to
email activity. This keeps the compiler focused on the new behavior rather
than signature errors.

- [ ] **Step 2: Write failing renderer contract tests**

Create an activity fixture:

```ts
const activity = {
  last24Hours: 42,
  days: Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 5, 26 + index))
      .toISOString().slice(0, 10),
    count: index === 29 ? 87 : index
  }))
};
```

Assert the HTML contains:

- `Sent mail`;
- `Last 24 hours`;
- `42`;
- `of 100 sent`;
- `Eastern Time`;
- an SVG `<title>` and `<desc>`;
- 30 elements with `class="email-bar"`;
- a quota line with `data-value="100"`;
- exact accessible rows for `2026-06-26` and `2026-07-25`;
- a usage width capped at 100% when `last24Hours` is 140;
- no `reader@example.com`, `mailto:`, `provider_message_id`, or fixture
  provider ID.

Add a `null` test asserting `Email activity temporarily unavailable` while
subscriber and weekday figures remain present.

- [ ] **Step 3: Run renderer tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/dashboard.test.ts
```

Expected: FAIL because the renderer has no activity section or new signature.

- [ ] **Step 4: Implement the activity renderer**

Add focused helpers in `dashboard.ts`:

```ts
function renderEmailActivity(activity: EmailActivity | null): string;
function renderEmailBars(activity: EmailActivity): string;
function shortDate(isoDate: string): string;
```

Rendering rules:

- `chartMax = Math.max(100, ...activity.days.map(day => day.count), 1)`;
- use a `viewBox="0 0 600 220"` SVG with 30 equal-width bar slots;
- assign each bar a `<title>` of `Jul 25: 87 sent`;
- draw the 100 reference at `plotBottom - (100 / chartMax) * plotHeight`;
- use `vector-effect="non-scaling-stroke"` for rules;
- emit selected weekly x-axis labels plus first and final dates;
- put exact daily values in a `<details>` block containing a semantic table;
- keep all values escaped or numeric;
- render the rolling usage width as
  `Math.min(100, Math.max(0, last24Hours))%`;
- label the reference as `100-send reference`, not exact quota remaining.

Extend existing CSS for `.email-summary`, `.quota-meter`, `.email-chart`,
`.email-bar`, `.email-values`, and forced-colors. Ensure SVG is
`display:block; width:100%; height:auto; overflow:visible`.

- [ ] **Step 5: Run renderer tests and verify GREEN**

Run:

```bash
pnpm exec vitest run workers/post/test/dashboard.test.ts
```

Expected: all renderer tests pass.

- [ ] **Step 6: Write failing handler degradation tests**

Extend the dashboard stub with a successful `getEmailActivity`. Assert the
normal dashboard calls it with a `Date` and renders the activity section.

Add a test where only `getEmailActivity` rejects. Assert:

- response status is `200`;
- subscriber counts and Friday remain;
- `Email activity temporarily unavailable` appears;
- D1 error text and addresses do not appear.

Keep the existing core-statistics failure test expecting the generic private
`500` page.

- [ ] **Step 7: Run handler dashboard tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts -t "operator dashboard"
```

Expected: FAIL because `handleDashboard` neither queries nor isolates activity.

- [ ] **Step 8: Implement activity-query isolation**

After the core subscriber/weekday `Promise.all` succeeds, call
`db.getEmailActivity(refreshedAt)` in a nested `try/catch`. On failure, log only
`dashboard email activity unavailable` and pass `null` to the renderer. Keep
core failures on the generic private `500` path.

Create one `refreshedAt = new Date()` and pass the same instant to both the
query and renderer.

- [ ] **Step 9: Run Task 4 tests and type-check**

Run:

```bash
pnpm exec vitest run workers/post/test/dashboard.test.ts \
  workers/post/test/handlers.test.ts
pnpm exec tsc -p workers/post/tsconfig.json
```

Expected: all selected tests pass and TypeScript exits 0.

- [ ] **Step 10: Commit Task 4**

```bash
git add workers/post/src/dashboard.ts workers/post/src/handlers.ts \
  workers/post/test/dashboard.test.ts workers/post/test/handlers.test.ts
git commit -m "feat: chart sent email activity"
```

---

### Task 5: Resumable Aggregate-Only Resend Backfill

**Files:**

- Create: `workers/post/backfill-email-sends.mjs`
- Create: `workers/post/test/backfill-email-sends.test.ts`
- Modify: `workers/post/package.json:5-11`
- Modify: `docs/deployment.md:126-217,292-307`

**Interfaces:**

- Produces pure exports for tests:

```js
export async function listRetainedSends(apiKey, fetchImpl = fetch);
export function renderBackfillSql(rows);
export async function main(options = {});
```

- `listRetainedSends` returns only:

```js
{ id: string, createdAt: string, recipientCount: number }
```

- [ ] **Step 1: Write failing backfill tests**

Create `workers/post/test/backfill-email-sends.test.ts`. Mock two Resend pages:

```ts
{
  object: 'list',
  has_more: true,
  data: [{
    id: '56761188-7520-42d8-8898-ff6fc54ce618',
    created_at: '2026-07-25 12:00:00+00',
    to: ['private@example.com'],
    cc: ['copy@example.com'],
    bcc: null,
    subject: 'Must not survive projection'
  }]
}
```

and a final page with `has_more: false`.

Assert:

- the second request contains `limit=100` and `after=<first-page-last-id>`;
- returned rows contain only `id`, normalized `createdAt`, and
  `recipientCount`;
- multi-recipient counts are summed with a minimum of one;
- `renderBackfillSql` contains the D1 upsert and no email address, subject,
  sender, API key, or JSON payload;
- an empty retained history returns no SQL and `main` skips Wrangler while
  reporting `Backfilled 0 sent-email records.`;
- invalid IDs/timestamps cause a generic thrown error without echoing the
  record;
- a failed HTTP response throws `Resend list failed with status 403` without
  including the response body.

- [ ] **Step 2: Run backfill tests and verify RED**

Run:

```bash
pnpm exec vitest run workers/post/test/backfill-email-sends.test.ts
```

Expected: FAIL because the backfill module does not exist.

- [ ] **Step 3: Implement pagination and privacy projection**

In `backfill-email-sends.mjs`:

- require `RESEND_API_KEY` from the environment;
- request `https://api.resend.com/emails?limit=100`;
- use each page's final ID as the `after` cursor while `has_more`;
- validate `id` as a UUID-like lowercase/uppercase hex-hyphen string;
- normalize `created_at` with `new Date(value).toISOString()`;
- calculate recipient count from `to`, `cc`, and `bcc`;
- discard every other field before adding the row to the in-memory array;
- never print API responses or individual rows.

Generate one transaction with repeated parameter-free, safely quoted upserts:

```sql
BEGIN;
INSERT INTO email_sends
  (provider_message_id, sent_at, recipient_count)
VALUES ('...', '...', 1)
ON CONFLICT(provider_message_id) DO UPDATE SET
  sent_at = excluded.sent_at,
  recipient_count = excluded.recipient_count;
COMMIT;
```

The UUID and normalized ISO validators make the values safe; still escape
single quotes defensively.

- [ ] **Step 4: Implement the temporary-file Wrangler runner**

Use Node built-ins only:

- `mkdtemp`, `writeFile`, and `rm` from `node:fs/promises`;
- `tmpdir` from `node:os`;
- `join` from `node:path`;
- `spawn` from `node:child_process`.

Write the SQL under a fresh OS temporary directory. Invoke:

```bash
pnpm exec wrangler d1 execute publius-post --remote --file <temporary-file>
```

with inherited environment and stdio. Delete the temporary directory in
`finally`. If no retained rows exist, do not create a temporary file or invoke
Wrangler. Guard the executable entry point so importing the module in Vitest
does not run `main`; compare `import.meta.url` with
`pathToFileURL(process.argv[1]).href` from `node:url`. Print only:

```text
Backfilled N sent-email records.
```

Exit non-zero if listing, validation, file creation, Wrangler execution, or
cleanup before execution fails. Re-running is safe because of the upsert.

- [ ] **Step 5: Add the package command**

Add to `workers/post/package.json`:

```json
"backfill:email-sends": "node backfill-email-sends.mjs"
```

- [ ] **Step 6: Run backfill tests and verify GREEN**

Run:

```bash
pnpm exec vitest run workers/post/test/backfill-email-sends.test.ts
```

Expected: all backfill tests pass.

- [ ] **Step 7: Update deployment documentation**

In `docs/deployment.md`:

- update the existing webhook event list to `email.sent`,
  `email.bounced`, and `email.complained`;
- document `pnpm migrate:remote` before the Worker deploy;
- document an interactive, non-echoing temporary full-access key:

```bash
read -s "RESEND_API_KEY?Temporary full-access Resend key: "
export RESEND_API_KEY
pnpm run backfill:email-sends
unset RESEND_API_KEY
```

- state that the temporary key must be revoked after verification;
- state that only IDs, timestamps, and aggregate recipient counts enter D1;
- add smoke checks for the rolling count, Eastern Time labels, 30 bars,
  accessible exact values, and absence of PII;
- preserve the current Cloudflare Access setup and privacy-header checks.

- [ ] **Step 8: Run Task 5 tests and documentation checks**

Run:

```bash
pnpm exec vitest run workers/post/test/backfill-email-sends.test.ts
git diff --check
```

Expected: tests pass and `git diff --check` exits 0.

- [ ] **Step 9: Commit Task 5**

```bash
git add workers/post/backfill-email-sends.mjs \
  workers/post/test/backfill-email-sends.test.ts workers/post/package.json \
  docs/deployment.md
git commit -m "feat: backfill sent email activity"
```

---

### Task 6: Full Local Verification

**Files:**

- Verify all files changed in Tasks 1-5.

**Interfaces:**

- Consumes the completed code paths.
- Produces a deployable Worker bundle and a clean feature branch.

- [ ] **Step 1: Apply migrations to a local D1 database**

Run from `workers/post/`:

```bash
pnpm run migrate:local
```

Expected: migration `0003_email_sends.sql` applies successfully.

- [ ] **Step 2: Verify the local schema without exposing PII**

Run from `workers/post/`:

```bash
pnpm exec wrangler d1 execute publius-post --local \
  --command "SELECT name FROM sqlite_schema WHERE type IN ('table','index') AND name LIKE 'email_sends%';"
```

Expected: `email_sends` and `idx_email_sends_sent_at` appear.

- [ ] **Step 3: Run the complete project check**

Run from the repository root:

```bash
PUBLIC_SITE_URL=https://federalistreader.org pnpm check
```

Expected: Astro check has 0 errors, the production analytics validation
passes, and every Vitest file/test passes.

- [ ] **Step 4: Type-check the Worker**

Run:

```bash
pnpm exec tsc -p workers/post/tsconfig.json
```

Expected: exit 0 with no diagnostics.

- [ ] **Step 5: Validate the Worker bundle**

Run from `workers/post/` with a writable log path:

```bash
WRANGLER_LOG_PATH=/tmp/wrangler-email-activity.log \
  pnpm exec wrangler deploy --dry-run
```

Expected: bundle succeeds, `workers_dev` remains disabled, and no preview URL
is introduced.

- [ ] **Step 6: Scan code and rendered fixtures for privacy regressions**

Run:

```bash
rg -n "console\\.(log|error).*\\b(to|subject|payload|email)\\b" workers/post/src \
  workers/post/backfill-email-sends.mjs
rg -n "mailto:|provider_message_id|reader@example\\.com" \
  workers/post/src/dashboard.ts
```

Expected: the first command shows only reviewed generic operational messages
with no interpolated values; the second returns no matches.

- [ ] **Step 7: Confirm the branch is clean**

Run:

```bash
git status --short --branch
git log --oneline --decorate -8
```

Expected: no uncommitted files and the five feature commits appear above the
design/plan commits.

---

### Task 7: Guarded Production Rollout and Verification

**Files:**

- No source changes expected.

**Interfaces:**

- Consumes the verified Worker, migration, existing Cloudflare Access
  application, existing Resend webhook, and temporary full-access Resend key.
- Produces the live 30-day chart with historical data.

- [ ] **Step 1: Reconfirm the unauthenticated Access boundary**

Open `https://federalistreader.org/post-office/` without an Access session or
use an unauthenticated header request.

Expected: Cloudflare Access intercepts the request before Worker content is
served.

- [ ] **Step 2: Apply the remote D1 migration**

Run from `workers/post/`:

```bash
WRANGLER_LOG_PATH=/tmp/wrangler-email-activity.log pnpm run migrate:remote
```

Expected: `0003_email_sends.sql` applies successfully. If it was already
applied, Wrangler reports no pending migrations.

- [ ] **Step 3: Verify only the aggregate-safe remote schema**

Run:

```bash
WRANGLER_LOG_PATH=/tmp/wrangler-email-activity.log \
  pnpm exec wrangler d1 execute publius-post --remote \
  --command "SELECT name FROM sqlite_schema WHERE type IN ('table','index') AND name LIKE 'email_sends%';"
```

Expected: the table and index names appear; no row data is selected.

- [ ] **Step 4: Deploy the Worker**

Run:

```bash
WRANGLER_LOG_PATH=/tmp/wrangler-email-activity.log pnpm run deploy
```

Expected: the existing `api/*`, `manage*`, and `post-office*` routes and daily
schedule remain attached.

- [ ] **Step 5: Update the existing Resend webhook**

Obtain browser action-time confirmation immediately before saving the change.
In Resend, edit the existing
`https://federalistreader.org/api/webhooks/resend` endpoint. Keep
`email.bounced` and `email.complained`, add `email.sent`, and do not create a
second endpoint or rotate the signing secret.

Expected: one enabled endpoint lists all three event types.

- [ ] **Step 6: Confirm one real sent event is recorded**

Trigger only a normal, user-authorized application email. Then run an
aggregate-only query:

```bash
WRANGLER_LOG_PATH=/tmp/wrangler-email-activity.log \
  pnpm exec wrangler d1 execute publius-post --remote \
  --command "SELECT COUNT(*) AS send_records, COALESCE(SUM(recipient_count),0) AS sent FROM email_sends;"
```

Expected: the aggregate count increases without printing any provider ID or
recipient data.

- [ ] **Step 7: Run the one-time retained-history backfill**

Create or use a temporary full-access Resend key. Enter it through an
interactive hidden prompt; never place it in the command line or transcript:

```bash
read -s "RESEND_API_KEY?Temporary full-access Resend key: "
export RESEND_API_KEY
pnpm run backfill:email-sends
unset RESEND_API_KEY
```

Expected: the script prints only `Backfilled N sent-email records.` Re-run once
and confirm the aggregate D1 total does not double.

- [ ] **Step 8: Revoke the temporary full-access key**

In Resend, delete the temporary key immediately after successful backfill.
Obtain browser action-time confirmation immediately before deletion.

Expected: the key no longer appears in Resend. The Worker's existing send key
remains unchanged.

- [ ] **Step 9: Verify aggregate totals and Eastern grouping**

Use only aggregate SQL:

```sql
SELECT substr(sent_at, 1, 10) AS utc_date,
       SUM(recipient_count) AS sent
FROM email_sends
WHERE sent_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-31 days')
GROUP BY utc_date
ORDER BY utc_date;
```

Use this only as a coarse UTC cross-check. Treat the dashboard's tested
`America/New_York` grouping as authoritative around UTC midnight and DST
transitions. Never select provider IDs or message metadata.

- [ ] **Step 10: Verify the protected live dashboard**

After authenticating through Cloudflare Access, confirm:

- subscriber and weekly figures still render;
- `Last 24 hours` has a numeric value and `of 100 sent`;
- exactly 30 vertical bars render;
- `Eastern Time` is visible;
- the 100-send reference line is visible;
- the exact-value disclosure has 30 dates including zeros;
- the page has no address, `mailto:`, provider ID, subject, or message body;
- a 390×844 viewport has no horizontal overflow;
- the page remains usable with JavaScript disabled;
- refresh updates the UTC `Updated` timestamp;
- privacy headers retain their exact values.

- [ ] **Step 11: Run final repository verification before integration**

Run from the repository root:

```bash
PUBLIC_SITE_URL=https://federalistreader.org pnpm check
pnpm exec tsc -p workers/post/tsconfig.json
git status --short --branch
```

Expected: all checks pass and the feature branch is clean.
