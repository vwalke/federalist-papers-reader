-- Junk signups from the scripted-POST bot of 2026-11-03 — READ-ONLY listing.
--
-- NOT RUN AUTOMATICALLY. Nothing in the Worker, the migrations, or CI executes
-- this file. It only SELECTs: it deletes and changes nothing.
--
-- The bot began about 4pm Eastern on November 3, 2026 = 2026-11-03 21:00 UTC.
-- subscribers.created_at is SQLite datetime('now') text in UTC
-- ('YYYY-MM-DD HH:MM:SS'), so the cut-off below is compared as UTC text.
-- A pending row's created_at is its latest signup (upsertPending resets it),
-- so a real pre-attack reader who re-submitted after the cut-off appears too:
-- eyeball the list before acting on it.
--
-- Run it yourself, from workers/post (operator only):
--   npx wrangler d1 execute publius-post --remote --file ops/list-junk-signups-2026-11-03.sql
-- or against a local copy first:
--   npx wrangler d1 execute publius-post --local  --file ops/list-junk-signups-2026-11-03.sql
--
-- Time-sensitive: the daily run (7am Eastern) sends each pending signup ONE
-- confirmation reminder once it is 3 days old (CONFIRM_REMINDER_AFTER_DAYS),
-- so these addresses get a second unwanted email from the 2026-11-07 run on,
-- and it DELETES pending rows 7 days old (STALE_PENDING_DAYS), so they
-- disappear from the 2026-11-11 run on. List (and export) them before then.

-- 1. The junk: signed up since the attack began, never confirmed, still pending.
SELECT id, email, program, created_at, confirm_reminded_at, catchup_requested
FROM subscribers
WHERE status = 'pending'
  AND confirmed_at IS NULL
  AND created_at >= '2026-11-03 21:00:00'
ORDER BY created_at;

-- 2. How many, by program and hour (UTC) — the bot's shape at a glance.
SELECT program, substr(created_at, 1, 13) AS hour_utc, COUNT(*) AS signups
FROM subscribers
WHERE status = 'pending'
  AND confirmed_at IS NULL
  AND created_at >= '2026-11-03 21:00:00'
GROUP BY program, hour_utc
ORDER BY hour_utc, program;

-- 3. Never-confirmed rows from the same window that are already 'unsubscribed'
--    (the ones that "unsubscribed within seconds": most likely Resend bounce or
--    complaint webhooks for made-up addresses). Purged 30 days after unsubscribing.
SELECT id, email, program, created_at, unsubscribed_at
FROM subscribers
WHERE status = 'unsubscribed'
  AND confirmed_at IS NULL
  AND created_at >= '2026-11-03 21:00:00'
ORDER BY created_at;
