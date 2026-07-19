# Pick-Your-Day Weekly Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly Course subscribers get a per-subscriber send day — defaulting to the day after signup (Eastern time), changeable from the manage page — spreading sends across the week so Resend's 100/day free limit applies per weekday cohort.

**Architecture:** The plumbing exists: `subscribers.send_dow` (default 6), a daily 11:00 UTC cron, and `weeklyPaperDue` already gating on `send_dow`. This plan assigns the day at signup, relaxes the first-send guard from 2 days to 1, surfaces the day in the welcome email and manage page, and adds a `setday` manage action. No schema migration, no cron change.

**Tech Stack:** Cloudflare Worker (TypeScript), D1/SQLite, vitest (run from repo root), Resend.

**Spec:** `docs/superpowers/specs/2026-07-19-pick-your-day-design.md`

**Commands:**
- Tests: `pnpm test` from repo root (runs `tests/*` and `workers/post/test/*`). Single file: `pnpm test workers/post/test/schedule.test.ts`
- Typecheck: `pnpm exec tsc -p workers/post --noEmit`

---

### Task 1: Next-day-in-Eastern helper

**Files:**
- Modify: `workers/post/src/schedule.ts`
- Test: `workers/post/test/schedule.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `workers/post/test/schedule.test.ts` (add `nextDayDowEastern` to the existing import from `../src/schedule`):

```ts
describe('nextDayDowEastern', () => {
  it('assigns the day after signup', () => {
    // 2026-07-20T16:00Z is Monday noon Eastern → Tuesday (2)
    expect(nextDayDowEastern(new Date('2026-07-20T16:00:00Z'))).toBe(2);
  });
  it('uses the Eastern calendar day, not UTC', () => {
    // 2026-07-21T01:00Z is already Tuesday in UTC but still Monday 9pm Eastern → Tuesday (2)
    expect(nextDayDowEastern(new Date('2026-07-21T01:00:00Z'))).toBe(2);
  });
  it('wraps Saturday to Sunday', () => {
    // 2026-07-18T16:00Z is Saturday noon Eastern → Sunday (0)
    expect(nextDayDowEastern(new Date('2026-07-18T16:00:00Z'))).toBe(0);
  });
  it('respects the DST fall-back boundary', () => {
    // 2026-11-01T06:30Z: DST ended at 06:00Z, so this is 1:30am EST Sunday → Monday (1)
    expect(nextDayDowEastern(new Date('2026-11-01T06:30:00Z'))).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test workers/post/test/schedule.test.ts`
Expected: FAIL — `nextDayDowEastern` is not exported.

- [ ] **Step 3: Implement**

In `workers/post/src/schedule.ts`, after the `DAY_MS` constant:

```ts
export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const EASTERN_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
const DOW_BY_SHORT: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The day after `now` on the Eastern calendar — a new subscriber's default send day. */
export function nextDayDowEastern(now: Date): number {
  return (DOW_BY_SHORT[EASTERN_WEEKDAY.format(now)] + 1) % 7;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test workers/post/test/schedule.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add workers/post/src/schedule.ts workers/post/test/schedule.test.ts
git commit -m "feat: derive the next-day send day in Eastern time"
```

---

### Task 2: Relax the first-send guard to 1 day

**Files:**
- Modify: `workers/post/src/schedule.ts:41-48` (`weeklyPaperDue`)
- Test: `workers/post/test/schedule.test.ts` (the `weeklyPaperDue` describe block)

- [ ] **Step 1: Update the tests to the 1-day rule**

Replace the `weeklyPaperDue` describe block body with (base fixture unchanged):

```ts
describe('weeklyPaperDue', () => {
  const base = { progress_index: 0, send_dow: 6, confirmed_at: '2026-07-16T09:00:00Z' };
  it('sends the next paper on the send day when confirmation was an earlier day', () => {
    expect(weeklyPaperDue({ ...base }, '2026-07-18')).toBe(1); // Thu confirm → Sat send
    expect(weeklyPaperDue({ ...base, confirmed_at: '2026-07-17T22:00:00Z' }, '2026-07-18')).toBe(1); // Fri night → Sat
  });
  it('waits a week when confirmation lands on the send day itself', () => {
    expect(weeklyPaperDue({ ...base, confirmed_at: '2026-07-18T05:00:00Z' }, '2026-07-18')).toBeNull();
  });
  it('honors a non-Saturday send day', () => {
    expect(weeklyPaperDue({ ...base, send_dow: 2 }, '2026-07-21')).toBe(1); // Tuesday
    expect(weeklyPaperDue({ ...base, send_dow: 2 }, '2026-07-18')).toBeNull();
  });
  it('does nothing off the send day', () => {
    expect(weeklyPaperDue({ ...base }, '2026-07-19')).toBeNull();
  });
  it('advances through the course and stops at 85', () => {
    expect(weeklyPaperDue({ ...base, progress_index: 23 }, '2026-07-18')).toBe(24);
    expect(weeklyPaperDue({ ...base, progress_index: 85 }, '2026-07-18')).toBeNull();
  });
  it('never runs for unconfirmed subscribers', () => {
    expect(weeklyPaperDue({ ...base, confirmed_at: null }, '2026-07-18')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify the new expectations fail**

Run: `pnpm test workers/post/test/schedule.test.ts`
Expected: FAIL — the Friday-night→Saturday case returns null under the 2-day guard.

- [ ] **Step 3: Change the guard**

In `weeklyPaperDue` (`workers/post/src/schedule.ts`), change:

```ts
  if (today.getTime() - confirmedDay.getTime() < 2 * DAY_MS) return null;
```

to:

```ts
  // Send only on a calendar day strictly after confirmation: the welcome email
  // and the first paper never land the same day, but next-day sends work.
  if (today.getTime() - confirmedDay.getTime() < DAY_MS) return null;
```

- [ ] **Step 4: Run the full suite** (deliver.ts depends on this function)

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/post/src/schedule.ts workers/post/test/schedule.test.ts
git commit -m "feat: send the first weekly paper the day after confirmation"
```

---

### Task 3: Assign the send day at signup

**Files:**
- Modify: `workers/post/src/db.ts` (interface + `upsertPending` + new `setSendDow`)
- Modify: `workers/post/src/handlers.ts` (`handleSubscribe`)
- Test: `workers/post/test/handlers.test.ts` (also stub updates there and in `workers/post/test/deliver.test.ts`)

- [ ] **Step 1: Write the failing test**

In `workers/post/test/handlers.test.ts`, replace the first subscribe test with a fake-clock version (add `afterEach` to the vitest import):

```ts
  it('creates a pending subscriber with a next-day send day, sends confirmation, redirects', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T16:00:00Z')); // Monday noon Eastern
    try {
      const db = makeStubDb();
      const res = await handleRequest(
        post('/api/subscribe', { email: 'reader@example.com', program: 'weekly' }), ENV, db, sender);
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toBe('https://federalistreader.org/subscribe/check-inbox/');
      expect(db.upsertPending).toHaveBeenCalledWith('reader@example.com', 'weekly', expect.any(String), 2);
      expect(sent[0].subject).toContain('Confirm');
    } finally {
      vi.useRealTimers();
    }
  });
```

Also update both stub factories for the interface change coming in Step 3:
- `handlers.test.ts` `makeStubDb`: add `setSendDow: vi.fn(async () => {}),` after `setProgress`.
- `deliver.test.ts` `makeStubDb`: add `setSendDow: vi.fn(async () => {}),` after `setProgress`.

- [ ] **Step 2: Run tests to verify the new expectation fails**

Run: `pnpm test workers/post/test/handlers.test.ts`
Expected: FAIL — `upsertPending` called with 3 arguments, not 4.

- [ ] **Step 3: Implement db + handler**

`workers/post/src/db.ts` — interface lines:

```ts
  upsertPending(email: string, program: Program, tokenSecret: string, sendDow: number): Promise<Subscriber>;
  setSendDow(id: number, dow: number): Promise<void>;
```

`upsertPending` implementation (send_dow updates on re-signup under the same conditions as program):

```ts
    async upsertPending(email, program, tokenSecret, sendDow) {
      const row = await d1.prepare(
        `INSERT INTO subscribers (email, program, token_secret, send_dow) VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           program = CASE WHEN subscribers.status IN ('pending','unsubscribed') THEN excluded.program ELSE subscribers.program END,
           send_dow = CASE WHEN subscribers.status IN ('pending','unsubscribed') THEN excluded.send_dow ELSE subscribers.send_dow END,
           status = CASE WHEN subscribers.status = 'unsubscribed' THEN 'pending' ELSE subscribers.status END,
           token_secret = CASE WHEN subscribers.status = 'unsubscribed' THEN excluded.token_secret ELSE subscribers.token_secret END,
           unsubscribed_at = CASE WHEN subscribers.status = 'unsubscribed' THEN NULL ELSE subscribers.unsubscribed_at END
         RETURNING *`
      ).bind(email.toLowerCase(), program, tokenSecret, sendDow).first();
      if (!row) throw new Error('upsertPending returned no row');
      return row as unknown as Subscriber;
    },
```

New method after `setProgress`:

```ts
    async setSendDow(id, dow) {
      await d1.prepare('UPDATE subscribers SET send_dow = ? WHERE id = ?').bind(dow, id).run();
    },
```

`workers/post/src/handlers.ts` — import `nextDayDowEastern` from `./schedule`, and in `handleSubscribe` change:

```ts
  const sub = await db.upsertPending(email, program, tokenSecret);
```

to:

```ts
  const sub = await db.upsertPending(email, program, tokenSecret, nextDayDowEastern(new Date()));
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test && pnpm exec tsc -p workers/post --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add workers/post/src/db.ts workers/post/src/handlers.ts workers/post/test/handlers.test.ts workers/post/test/deliver.test.ts
git commit -m "feat: assign the send day at signup"
```

---

### Task 4: Welcome email names the day

**Files:**
- Modify: `workers/post/src/email.ts` (`renderWelcome`)
- Modify: `workers/post/src/handlers.ts` (`nextSendDate`, `handleConfirm`)
- Test: `workers/post/test/email.test.ts`

- [ ] **Step 1: Update the welcome tests**

In `workers/post/test/email.test.ts`, replace the two welcome tests:

```ts
  it('welcome states the first delivery expectation per program', () => {
    const weekly = renderWelcome('weekly', 'July 21, 2026', 'Tuesday', CTX);
    expect(weekly.html).toContain('Tuesday, July 21, 2026');
    expect(weekly.html).toContain('each Tuesday');
    expect(weekly.html).toContain('Change your delivery day');
    const calendar = renderWelcome('calendar', 'October 27', 'Saturday', CTX);
    expect(calendar.html).toContain('October 27');
    expect(calendar.html).not.toContain('Change your delivery day');
  });
  it('welcome text carries the delivery date, manage link, and no HTML residue', () => {
    const weekly = renderWelcome('weekly', 'July 21, 2026', 'Tuesday', CTX);
    expect(weekly.text).toContain('Tuesday, July 21, 2026');
    expect(weekly.text).toContain(CTX.manageUrl);
    const calendar = renderWelcome('calendar', 'October 27', 'Saturday', CTX);
    expect(calendar.text).toContain('October 27');
    for (const text of [weekly.text, calendar.text]) {
      expect(text).not.toContain('&oelig;');
      expect(text).not.toContain('<');
    }
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test workers/post/test/email.test.ts`
Expected: FAIL — `renderWelcome` takes 3 arguments.

- [ ] **Step 3: Implement**

`workers/post/src/email.ts` — replace `renderWelcome`:

```ts
/**
 * @param firstDelivery Human-formatted date for the reader (e.g. "July 25, 2026"),
 *   not an ISO string — it is interpolated verbatim into the email copy.
 * @param sendDayName Weekday name of the subscriber's send day (weekly program only).
 */
export function renderWelcome(
  program: Program, firstDelivery: string, sendDayName: string, ctx: EmailContext
): RenderedEmail {
  const body = program === 'weekly'
    ? `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>The Weekly Course</strong>. Federalist No. 1 arrives <strong>${escapeHtml(sendDayName)}, ${escapeHtml(firstDelivery)}</strong>, and one paper follows each ${escapeHtml(sendDayName)} for eighty-five weeks.</p>`
    : `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>As It Happened</strong>. The season opens <strong>October 27</strong> — Federalist No. 1's own date — and each paper arrives on the anniversary of its first printing, through the season's close on April 26.</p>`;
  const manageLine = program === 'weekly'
    ? 'Change your delivery day, pause, switch, or stop any time from the manage link below.'
    : 'Pause, switch, or stop any time from the manage link below.';
  const html = shell(body + `<p style="font-size:14px;color:${MUTED};">${manageLine}</p>`, ctx);
  const textBody = program === 'weekly'
    ? `Welcome to The Weekly Course. Federalist No. 1 arrives ${sendDayName}, ${firstDelivery}, and one paper follows each ${sendDayName} for eighty-five weeks.`
    : `Welcome to As It Happened. The season opens October 27 — Federalist No. 1's own date — and each paper arrives on the anniversary of its first printing, through the season's close on April 26.`;
  return {
    subject: 'Welcome — The Federalist by Post',
    html,
    text: `${textBody}\n\n${manageLine.replace(' from the manage link below', '')}: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`
  };
}
```

`workers/post/src/handlers.ts` — add `DOW_NAMES` to the `./schedule` import. Simplify `nextSendDate` (the do-while already guarantees a full day's gap, matching the new 1-day guard; the +7 branch was the 2-day rule):

```ts
/** Next occurrence of sendDow strictly after fromIso — mirrors weeklyPaperDue's 1-day guard. */
function nextSendDate(fromIso: string, sendDow: number): string {
  const date = new Date(`${fromIso}T00:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() + 1); } while (date.getUTCDay() !== sendDow);
  return date.toISOString().slice(0, 10);
}
```

In `handleConfirm`, change the render call:

```ts
  await deliver(env, send, sub,
    renderWelcome(sub.program, firstDelivery, DOW_NAMES[sub.send_dow], ctx), ctx);
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm test && pnpm exec tsc -p workers/post --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/post/src/email.ts workers/post/src/handlers.ts workers/post/test/email.test.ts
git commit -m "feat: name the delivery day in the weekly welcome"
```

---

### Task 5: Manage-page picker and setday action

**Files:**
- Modify: `workers/post/src/handlers.ts` (`managePage`, `handleManagePost`)
- Test: `workers/post/test/handlers.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('manage', ...)` block of `workers/post/test/handlers.test.ts`:

```ts
  it('shows the delivery day and a picker for weekly subscribers', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'active' as const, send_dow: 2 })) });
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    const html = await res.text();
    expect(html).toContain('arriving Tuesdays');
    expect(html).toContain('<option value="2" selected>Tuesday</option>');
  });

  it('hides the day picker for calendar subscribers', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'active' as const, program: 'calendar' as const })) });
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    expect(await res.text()).not.toContain('name="dow"');
  });

  it('sets the delivery day', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'setday', dow: '3' }), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(db.setSendDow).toHaveBeenCalledWith(7, 3);
  });

  it('rejects an out-of-range day with 400', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'setday', dow: '9' }), ENV, db, sender);
    expect(res.status).toBe(400);
    expect(db.setSendDow).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test workers/post/test/handlers.test.ts`
Expected: FAIL — no picker markup, unknown action `setday`.

- [ ] **Step 3: Implement**

In `managePage` (`workers/post/src/handlers.ts`), change the progress line and add the day form:

```ts
  const progress = sub.program === 'weekly'
    ? `Paper ${sub.progress_index} of 85 — The Weekly Course, arriving ${DOW_NAMES[sub.send_dow]}s`
    : 'As It Happened — papers arrive on their original dates';
```

After the `field` constant:

```ts
  const dayOptions = DOW_NAMES.map((name, dow) =>
    `<option value="${dow}"${dow === sub.send_dow ? ' selected' : ''}>${name}</option>`).join('');
  const dayForm = sub.program === 'weekly'
    ? `<p><form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="setday">
<label>Delivery day <select name="dow">${dayOptions}</select></label> <button>Set day</button></form></p>`
    : '';
```

Add `select{font-family:Arial,sans-serif;font-size:0.8rem;padding:0.5rem;background:#F4EFE2;border:1px solid #2A2118}` to the `<style>` block, and render `${dayForm}` on its own line directly after `<h1>Your subscription</h1><p>${progress}</p>${status}`.

In `handleManagePost`, add before `default`:

```ts
    case 'setday': {
      const dow = Number(form.get('dow'));
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return page('<h1>That day is not valid.</h1>', 400);
      }
      await db.setSendDow(sub.id, dow);
      break;
    }
```

- [ ] **Step 4: Run the full suite and typecheck**

Run: `pnpm test && pnpm exec tsc -p workers/post --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add workers/post/src/handlers.ts workers/post/test/handlers.test.ts
git commit -m "feat: add the delivery-day picker to the manage page"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full check**

Run: `pnpm test && pnpm exec tsc -p workers/post --noEmit`
Expected: all green.

- [ ] **Step 2: Review the diff against the spec**

Run: `git log --oneline main@{u}..HEAD 2>/dev/null || git log --oneline -6` and `git diff HEAD~5 --stat`
Confirm every spec section maps to a commit; no stray files.

- [ ] **Step 3: Deployment note**

The worker deploys manually: `pnpm -C workers/post deploy` (site deploys via push to main; the worker does not). Surface this to the operator — do not deploy without their go-ahead.

## Behavior notes for the implementer

- Existing subscribers keep `send_dow = 6` (Saturday); nothing migrates.
- Confirm on the assigned day after the 11:00 UTC cron → first paper waits a week; the welcome email's `nextSendDate` uses the same strictly-after rule, so its promised date is correct either way.
- `send_dow` is assigned for calendar signups too, so a later switch to weekly has a sensible day.
