-- Operational key-value state. First use: the 'last_daily_run' heartbeat the
-- nightly backup workflow checks as a dead-man's switch for the delivery cron
-- (Cloudflare has no notification type for Workers cron failures).
CREATE TABLE ops_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
