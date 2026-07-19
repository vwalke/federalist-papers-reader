# Pick-Your-Day Weekly Delivery — Design

**Date:** 2026-07-19
**Status:** Approved

## Problem

The Weekly Course sends every subscriber's paper on Saturday (`send_dow` default 6).
Resend's free tier caps sends at 100 emails/day, so the whole weekly list shares one
day's budget. Spreading subscribers across the week raises the effective free-tier
ceiling roughly seven-fold and is a better reader experience besides. The original
email-subscription spec anticipated exactly this mitigation: "assign send-day by
signup day-of-week … kept as an option via `send_dow`."

## Decisions

1. **Default send day = the day after signup, in Eastern time.** Computed in
   `handleSubscribe` via `Intl.DateTimeFormat` with `America/New_York` (DST-safe),
   so a Monday-9pm-ET signup is assigned Tuesday, not Wednesday. Assigned for every
   signup regardless of program so the value is ready if a calendar subscriber later
   switches to weekly. Existing subscribers keep Saturday; no migration.
2. **First-send guard relaxed from 2 days to 1.** `weeklyPaperDue` sends only on a
   calendar day (UTC) strictly after the confirmation day. Confirm Monday → assigned
   Tuesday → first paper Tuesday 7am ET. Confirm on the assigned day after the
   11:00 UTC cron → the first paper waits a week; accepted trade-off. The welcome
   email's promised date uses the same rule so copy and cron never disagree.
3. **Picker lives on the manage page only.** Signup stays frictionless. Weekly
   subscribers see a select of the seven days (current pre-selected) and a
   "Set day" button posting `action=setday`, `dow=0..6`. Calendar subscribers do
   not see the picker.
4. **The assigned day is visible.** Manage-page progress line reads
   "Paper N of 85 — arrives Tuesdays"; the weekly welcome email names the day and
   notes it can be changed from the manage link.

## Changes by file

- `workers/post/src/handlers.ts` — compute next-day dow (pure helper
  `nextDayDowEastern(now)`); pass to `upsertPending`; simplify `nextSendDate` to the
  1-day rule; `setday` action + validation in `handleManagePost`; day select in
  `managePage`; pass the day name into the welcome render.
- `workers/post/src/db.ts` — `upsertPending(email, program, tokenSecret, sendDow)`
  stores `send_dow`, updating it on re-signup under the same conditions as
  `program`; new `setSendDow(id, dow)`.
- `workers/post/src/schedule.ts` — `weeklyPaperDue` guard becomes 1 day.
- `workers/post/src/email.ts` — `renderWelcome` names the weekly day and the
  change-it note.
- Tests: `nextDayDowEastern` (incl. evening-ET/DST boundary), 1-day guard, upsert
  `send_dow` persistence and re-signup update, `setday` action, picker rendering,
  welcome copy.

## Out of scope

- Signup-form day picker.
- Per-subscriber send *time* (cron stays 11:00 UTC / 7am ET daily).
- Schema changes (column and daily cron already exist).

## Effect on the Resend ceiling

Weekly sends now cluster by signup-day cohort instead of all on Saturday, so the
100-email/day free limit applies per weekday cohort — roughly a 7× stretch before
the $20/mo Pro plan, minus whatever the calendar program sends that day.
