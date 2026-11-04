-- Fixed-window counters for POST /api/subscribe (db.hitRateLimit). One row per
-- key: 'ip:<hash>' per client address, 'email:<hash>' and 'email-day:<hash>'
-- per address mailed. Keys are HMAC-SHA-256 digests (keyed with TOKEN_SECRET),
-- so neither raw IPs nor addresses are stored here. A hit in a new window
-- resets the count; the daily run purges rows whose window has long passed.
-- Purely additive: the old Worker never reads this table.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,               -- unix seconds, aligned to the window
  count INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
