-- As It Happened catch-up (docs/catch-up/DESIGN.md). A reader who joins after
-- the season opens may ask for the papers already printed: one extra each
-- morning, earliest first, alongside the on-date papers, until the backlog is
-- spent. Progress is not counted here: it is read from deliveries, whose
-- UNIQUE (subscriber_id, paper_number, scheduled_for) claim already makes each
-- send exactly-once, so a retried cron can neither skip nor repeat a paper.

-- 1 when the signup form (or a repeat signup while pending) asked for it.
-- Consumed at confirmation, when the backlog is fixed.
ALTER TABLE subscribers ADD COLUMN catchup_requested INTEGER NOT NULL DEFAULT 0;
-- The backlog, frozen when catch-up begins: comma-separated item ids in the
-- order they are sent. NULL = not catching up. Its length is the "of N".
ALTER TABLE subscribers ADD COLUMN catchup_items TEXT;
-- ISO date of the first catch-up morning (the day after confirming or opting in).
ALTER TABLE subscribers ADD COLUMN catchup_starts_on TEXT;
-- ISO date the last catch-up paper was claimed; the daily run skips the
-- backlog lookup from then on.
ALTER TABLE subscribers ADD COLUMN caught_up_on TEXT;
