CREATE TABLE subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  program TEXT NOT NULL CHECK (program IN ('weekly', 'calendar')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'unsubscribed')),
  progress_index INTEGER NOT NULL DEFAULT 0,   -- weekly: last paper sent (0..85)
  send_dow INTEGER NOT NULL DEFAULT 6
    CHECK (send_dow BETWEEN 0 AND 6),          -- 0=Sunday..6=Saturday
  paused_until TEXT,                           -- ISO date for timed pause, NULL otherwise
  token_secret TEXT NOT NULL,                  -- per-subscriber HMAC salt; rotating revokes links
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT
);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  paper_number INTEGER NOT NULL CHECK (paper_number BETWEEN 1 AND 85),
  scheduled_for TEXT NOT NULL,                 -- ISO date; UNIQUE below = exactly-once
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'bounced', 'failed')),
  provider_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subscriber_id, paper_number, scheduled_for)
);

CREATE INDEX idx_subscribers_status ON subscribers (status, program);
CREATE INDEX idx_deliveries_status ON deliveries (status, created_at);
