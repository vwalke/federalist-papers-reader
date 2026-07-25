CREATE TABLE email_sends (
  provider_message_id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 1
    CHECK (recipient_count >= 1)
);

CREATE INDEX idx_email_sends_sent_at ON email_sends (sent_at);
