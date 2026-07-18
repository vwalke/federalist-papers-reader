# Delivery cron heartbeat design

**Date:** July 19, 2026
**Status:** Approved

## Problem

`docs/deployment.md` told the operator to create a Cloudflare notification
for the worker's cron failures, but Cloudflare's notification catalog has no
alert type for Workers at all — no cron-failure, no worker-error events.
Cron Triggers have no retries and no built-in failure alerting; Cron Events
and Workers Logs are view-only. A dead delivery cron is silent until a
subscriber notices.

## Decision

A dead-man's switch built from parts already in place. Every completed
`runDaily` writes a heartbeat into D1; the nightly backup workflow — which
already downloads the full database dump at 12:00 UTC, an hour after the
delivery cron — checks the heartbeat inside that dump and fails the run if
it is stale. GitHub's workflow-failure email (already proven end to end) is
the alert channel. No new accounts, secrets, or services.

This detects the two silent-death modes: the cron not firing at all, and
`runDaily` crashing partway. Individual send failures are out of scope —
the worker already logs and retries those; the heartbeat means "the daily
run completed."

## Shape

- Migration `0002_ops_meta.sql`: a small `ops_meta (key PRIMARY KEY, value,
  updated_at)` key-value table for operational state.
- `Db.recordDailyRun(todayIso)`: upserts `last_daily_run` = the run's ISO
  date. Called as the final act of `runDaily`, before the `runDaily done`
  log line, so a mid-run crash leaves the heartbeat unwritten.
- Backup workflow: a step after the dump sanity gate extracts
  `last_daily_run` from `backup.sql` and reports it. On **scheduled** runs
  it fails unless the value is today's UTC date; on manual dispatches (any
  time of day, possibly before 11:00 UTC) it only reports.
- `docs/deployment.md`: the impossible "set up a Cloudflare notification"
  bullet is replaced with a description of this switch.

## Failure analysis

- Cron never fires / worker throws before completion → heartbeat stays at
  yesterday → scheduled backup fails → email. Detection lag ≤ 25 hours.
- Backup workflow itself breaks → same email channel, by construction.
- Cloudflare cron delayed past 12:00 UTC (crons are typically delayed
  seconds to minutes, GitHub's scheduler minutes) → false alarm; acceptable
  for a one-a-day signal.

## Out of scope

Per-send failure alerting, external heartbeat services (healthchecks.io),
and any dashboard-dependent configuration.
