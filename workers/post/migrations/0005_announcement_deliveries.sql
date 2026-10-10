-- One-time announcements (e.g. the As It Happened season heads-up). Kept apart
-- from deliveries, whose paper_number CHECK only admits debate item ids. The
-- UNIQUE pair is the exactly-once claim: a subscriber gets each announcement at
-- most once, however many times the daily run is retried.
CREATE TABLE announcement_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  announcement_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'bounced', 'failed')),
  provider_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subscriber_id, announcement_id)
);

CREATE INDEX idx_announcement_deliveries_status
  ON announcement_deliveries (announcement_id, status, created_at);
