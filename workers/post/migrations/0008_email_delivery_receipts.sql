-- Resend delivery events (email.delivered / email.delivery_delayed) keyed by
-- message id, kept whether or not the email_sends row exists yet. During a
-- batch send an event can arrive before the worker saves the row; db.ts writes
-- the receipt here first and then applies it to email_sends, and recordEmailSend
-- applies any waiting receipt when the row lands, so whichever side comes second
-- carries the status across. Delivered is final, as in email_sends. Purged with
-- email_sends after 45 days.
CREATE TABLE email_delivery_receipts (
  provider_message_id TEXT PRIMARY KEY,
  delivery_status TEXT NOT NULL
    CHECK (delivery_status IN ('delivered', 'delivery_delayed')),
  delivery_status_at TEXT NOT NULL
);

CREATE INDEX idx_email_delivery_receipts_at ON email_delivery_receipts (delivery_status_at);
