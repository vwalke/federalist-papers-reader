# As It Happened: catch-up mode

Readers who join As It Happened after the season has opened can ask for the
papers already printed. They get one extra paper each morning, earliest first,
until they are level with the season. Then they get the live calendar only.

Previews: [`index.html`](index.html) (every email, inline), `emails/*.html` and
`*.txt`, `signup.html`, and PNGs in `screenshots/` (light, dark, and 390px phone
width). Regenerate with `node scripts/render-catch-up-previews.mjs` after a
`PUBLIC_SITE_URL=https://federalistreader.org corepack pnpm build`. The catch-up
letters come from the Worker's real `runDaily` against an in-memory database,
so they are exactly what readers would receive.

## The schedule, and why plain one-a-day replay is not enough

The 2026–27 season runs 93 items from Brutus No. I (Oct 18) to Federalist No. 85
(Apr 26). The pace is uneven. October has three items, but in late November the
papers come almost daily, including **five consecutive days, Nov 27 – Dec 1**.
Jan 2 and Jan 5 each carry two papers.

The obvious design is a replay: a late joiner reads from Brutus No. I, one a
day in order, and the live papers queue behind. It does converge eventually,
because the season averages about one item every two days, but slowly. Measured
against the real schedule:

| Starts | Backlog | In-order replay, one a day | Catch-up in addition (chosen) |
|---|---|---|---|
| Nov 3 | 4 | 7 days | 4 days |
| Nov 15 | 9 | 19 days | 9 days |
| Nov 21 | 11 | 26 days | 11 days |
| Nov 30 | 17 | 39 days | 17 days |
| Dec 15 | 26 | 62 days | 26 days |

A replay reader spends weeks a fortnight or more behind, and catches up only
during whichever quiet stretch happens to come. (`season.test.ts` pins the
Nov 15 figure.)

## Pacing rule

**Catch-up papers come in addition to the on-date papers.** From the first
morning after confirming, a catch-up reader gets every paper on its anniversary,
like any calendar reader. Each morning they also get **one** catch-up paper,
taken from the backlog in season order.

- **Backlog**: every item of the season dated before the reader's first live
  morning, less anything they already hold this season. A returning or
  switching reader is never sent a paper twice. The first live morning is today
  if the 11:00 UTC run (7am EDT, 6am EST) has not gone out yet (read from
  `ops_meta.last_daily_run`), otherwise tomorrow.
- **Eastern dates**: "today" is always the America/New_York calendar date
  (`easternToday` in `season.ts`), on the Worker and in the signup form alike,
  so Nov 21 lasts until midnight in New York. The form, which cannot read
  `last_daily_run`, uses `dailyRunHasGoneOut`: on or after 11:00 UTC on the
  Eastern date, matching the cron.
- **Start**: the morning after confirming (or opting in). The welcome letter and
  the first paper never land on the same morning, matching the Weekly Course.
- **Convergence**: a backlog of N takes exactly N mornings, however bunched the
  calendar is. Last catch-up morning = start + N − 1.

### Cut-off date: Saturday, November 21, 2026

Catch-up can be requested, at signup or from the manage page, from opening day
(Oct 18) **through November 21**. On that date the backlog is at most **12**:
Brutus I, Federalist 1–9, Brutus II, Cato IV. From Nov 22 (Federalist No. 10)
the papers run nearly daily and the backlog would pass two weeks within days.
After the cut-off, late joiners go straight onto the live calendar, and their
welcome letter points them to the archive to read back.

A request made by the cut-off is **honoured for the life of the signup**:
unconfirmed signups are purged after 7 days, so the latest grant is a
confirmation on **Nov 28**, with a backlog of **16** that ends by **Dec 14**. A
slow inbox does not cost the reader their catch-up. `season.test.ts` simulates
every confirmation day from Oct 18 to Nov 28, before and after the morning run.
In every case the reader gets the whole season exactly once, at most two
papers a morning, finishing on the promised date and no later than Dec 14.

The dates are month-days (`SEASON_OPENS = '10-18'`,
`CATCH_UP_LAST_DAY = '11-21'`, `SEASON_CLOSES = '04-26'` in
`workers/post/src/season.ts`), so the window reopens on its own each season.

### Days when an on-date and a catch-up paper are both due: one letter

They go in **one combined letter**. Today's paper leads, and the catch-up
follows under a small "Catch-up 4 of 12" label. Reasons:

- **The promise is one letter a morning.** Two emails a day from the same sender
  looks like a fault and doubles the chance of the second being filtered or
  skipped.
- **The day's paper stays the news.** On an anniversary, that paper is what
  As It Happened is about. The catch-up is clearly a back number.
- **The machinery already does this.** Calendar days with two papers (Jan 2,
  Jan 5) already send one combined issue. A combined catch-up morning is one
  Resend message, one idempotency key, and one row per item in `deliveries`.
- **Never more than two papers.** No two on-date items share a day inside the
  catch-up window (Oct 18 – Dec 14), so a combined letter is never longer than
  two papers.

## What the reader sees

### Signup (`src/components/SubscribeCoupon.astro`)

Choosing *As It Happened* during the window reveals one quiet sub-option,
indented under it and ticked by default:

> ☑ Catch up on the eight already printed
> One extra each morning, earliest first, until you're level with the season.

The count is computed in the browser with the Worker's own rule (shared
`season.ts`), so the static page never goes stale. Outside the window, or for
the Weekly Course, the option is hidden *and disabled*, so it is never
submitted. Without JavaScript it never appears and the reader joins live. The
Worker re-checks the window on the server either way.

### Existing calendar subscribers (`/manage`)

During the window, a calendar reader who is missing papers (joined after
Oct 18, switched from the Weekly Course, or paused) sees:

> **Catch up.** Eight papers were printed before you joined. Catch up, and they
> arrive one extra each morning, earliest first, until you are current.
> [Catch up]

While catching up, the page shows *"3 of 8 sent. The last arrives Thursday,
November 19."* with an [End the catch-up] button. A paused reader sees *"The
catch-up waits while your subscription is paused."* No email is sent
unprompted to existing subscribers. The offer appears only on the manage page.

### Email states

| State | Subject | Body |
|---|---|---|
| **Catch-up alone** | `Catch-up 4 of 12: Federalist No. 3 — Concerning Dangers…` | Small centred label *Catch-up 4 of 12*, then the paper in the usual issue layout. On catch-up 1 an italic lead line: *"Here your catch-up begins: twelve papers already printed, the earliest first, one each morning alongside any new paper, until you are current."* A lone essay keeps the Journal masthead. |
| **Combined** | `Federalist No. 11, with catch-up 2 of 13` | Lead: *"Two papers this morning: today's, on its anniversary, and below it the next of your catch-up."* Today's paper, a rule, the label, then the catch-up paper. |
| **Last catch-up: caught up** | `The last catch-up: Federalist No. 9 — …` (or `Federalist No. 17, with the last catch-up`) | After the paper, a rule and: ***You are caught up.*** *That was the last of the papers printed before you joined. From tomorrow the debate reaches you as it reached New York: each paper on its anniversary, and quiet on the days between. The next, Federalist No. 16, comes on Friday, December 4.* Signed **PUBLIUS.** |
| **On-date only** | Unchanged | Unchanged. After catching up, readers get the ordinary calendar issue. |

Every catch-up letter's footer carries the position: *Catch-up 4 of 12 · As It
Happened*. The caught-up moment sits inside the last catch-up letter, not in a
separate email, so the reader gets no extra mail and reads the note right
after the final paper.

### Welcome letter (fixes the hard-coded "October 18")

`renderWelcome` now takes the reader's real position in the season:

| State | When | Copy |
|---|---|---|
| `before-season` | first live morning ≤ Oct 18 | *The season opens October 18 — Brutus No. I fires first — …* (as before) |
| `catch-up` | asked, granted, backlog ≥ 1 | *…eight papers were printed before you joined. You asked to catch up, so they begin on Wednesday, November 11 … The last arrives on Wednesday, November 18.* (singular form for one) |
| `live` | mid-season, no catch-up | *…Your first paper, Federalist No. 6, arrives on Saturday, November 14, the anniversary of its first printing…* plus a link to read back on the site |
| `between-seasons` | after the last paper | *This season closed on April 26. The next opens on October 18…* |

All welcome letters are now signed *PUBLIUS.* Dates name the weekday, not
"tomorrow", because the reader's local day can differ from the run's.

### Confirmation reminder

If the signup asked for catch-up, the one reminder adds: *"The catch-up you
asked for is kept for you: once you confirm, the papers already printed follow,
one each morning, until you are current."*

### Design

Everything uses the existing Fœderalist shell, unchanged in substance:
Georgia, ink on paper, double rule under the masthead, hairline rules, and the
existing letter-spaced Arial labels. No new colours, badges, bars, or icons.
The only new elements are the small-caps label, an italic muted lead line, and
the signature. The shell gains a `color-scheme` meta and a
`prefers-color-scheme: dark` block (Apple Mail, iOS Mail, Outlook): lamp-black
surround, dark paper, warm ink, lightened verdigris. Clients that ignore it
(Gmail) keep the inline light colours or apply their own inversion. A viewport
meta keeps the 560px sheet fluid on phones.

## Edge cases

- **Idempotent sends.** Catch-up progress is not a counter. It is read from
  `deliveries`, whose `UNIQUE (subscriber_id, paper_number, scheduled_for)` is
  the existing exactly-once claim. The next catch-up is the first backlog item
  with no delivery row. If a backlog item already has a row dated today, the
  morning's catch-up was claimed and a rerun sends nothing. Two concurrent runs
  pick the same item and the UNIQUE claim admits one. The Resend batch
  idempotency key covers the combined item list as before.
- **Failed sends.** These ride the existing retry machinery: failed or stranded
  rows, retried for 2 days. A retried catch-up is recognised (in the backlog and
  sent after its anniversary) and re-rendered as a catch-up letter with its
  number. The next morning's catch-up does not wait for it and does not repeat
  it.
- **Caught up.** `caught_up_on` is set when the last backlog item is *claimed*,
  as the weekly make-up flag is consumed at claim. From then on the run skips
  the backlog lookup entirely.
- **Pause.** Paused readers are not deliverable, so nothing is claimed. On
  resume the catch-up continues where it stopped. The finishing date moves
  later, and the manage page says so. On-date papers missed while paused are
  missed, as for any calendar reader, but a reader can end and restart the
  catch-up from the manage page during the window to pick them up.
- **Unsubscribe mid-catch-up.** Delivery stops at once. Re-subscribing is a new
  signup: catch-up columns are cleared, and if they ask again within the window
  their backlog excludes what they already received this season.
- **Switching program** clears catch-up: it belongs to the calendar. Switching
  into the calendar during the window shows the opt-in.
- **Pending confirmation.** The request is stored as `catchup_requested` on the
  pending row. A repeat signup while pending replaces it, and it is re-checked
  against the window at that moment. The backlog is fixed at confirmation, not
  at signup, so papers printed while the letter sat unread are included.
- **Re-subscribe bug (fixed).** `upsertPending` kept the original `created_at`
  (and `confirmed_at`) when an unsubscribed address signed up again. The next
  daily run then purged the fresh pending signup as more than 7 days stale,
  before the reader could confirm. A repeat signup while pending had the same
  problem: the fresh confirmation link died on the old clock. A pending or
  unsubscribed row now restarts `created_at`, and an unsubscribed one also
  clears `confirmed_at` and the catch-up columns. Active and paused rows are
  untouched.
- **Welcome "October 18" bug (fixed)**: see the welcome states above.
- **Next season.** Backlogs and "already held" look only at deliveries since
  this season's opening, so a returning reader from last year is not mistaken
  for one who already has this year's papers. The catch-up columns are scoped
  the same way: every reader of them goes through `catchUpStateFor`, which
  treats state whose `catchup_starts_on` (or `caught_up_on`) falls in an
  earlier season as no catch-up. Last year's reader is offered catch-up again,
  may opt in (`startCatchUp` overwrites the old columns), and the daily run
  sends nothing from the old backlog. No migration is needed.

## Data

Migration **`0007_calendar_catch_up.sql`** is additive only. It adds four
nullable or defaulted columns to `subscribers`, and the current Worker ignores
them.

| Column | Meaning |
|---|---|
| `catchup_requested INTEGER NOT NULL DEFAULT 0` | Signup asked for it; consumed at confirmation |
| `catchup_items TEXT` | Frozen backlog, comma-separated ids in send order; its length is the "of N" |
| `catchup_starts_on TEXT` | First catch-up morning |
| `caught_up_on TEXT` | Day the last catch-up was claimed |

## Code map

- `workers/post/src/season.ts`: the season calendar, the window, the backlog,
  and `catchUpItemDue` / `catchUpPosition`. It is pure and imports nothing, so
  the site bundles it too. The McLean overrides moved here; `schedule.ts`
  re-exports them.
- `deliver.ts`: one catch-up item per morning, rendered with the day's papers,
  and retries rendered as catch-up.
- `email.ts`: `renderCalendarIssue`, the welcome states, the reminder line, and
  dark-mode hooks in the shell.
- `handlers.ts`: signup flag, grant at confirmation, and manage-page view,
  opt-in, and opt-out.
- `db.ts`: `listDeliveredItems`, `startCatchUp`, `stopCatchUp`, `markCaughtUp`,
  `getLastDailyRun`, and the re-subscribe reset.
- Tests: `season.test.ts` (pacing over the real schedule),
  `catch-up-deliver.test.ts`, `catch-up-handlers.test.ts`,
  `catch-up-migration.test.ts` (real SQLite), and e2e `subscribe.spec.ts`.
