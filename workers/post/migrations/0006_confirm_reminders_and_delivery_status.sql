-- One confirmation reminder per signup. Set when the daily run claims the
-- reminder, before the send, so a failed send is never retried into a loop and
-- a rerun of the same day never mails the reminder twice. A resubscribe after
-- unsubscribing clears it (db.upsertPending), since that is a new signup.
ALTER TABLE subscribers ADD COLUMN confirm_reminded_at TEXT;

-- Latest Resend delivery outcome per accepted email (email.delivered /
-- email.delivery_delayed webhooks). NULL means no delivery event has arrived
-- yet. Purged with the row after 45 days, like the rest of email_sends.
ALTER TABLE email_sends ADD COLUMN delivery_status TEXT
  CHECK (delivery_status IN ('delivered', 'delivery_delayed'));
ALTER TABLE email_sends ADD COLUMN delivery_status_at TEXT;
