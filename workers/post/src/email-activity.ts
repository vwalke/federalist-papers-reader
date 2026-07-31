import {
  type DailyCount,
  easternDate,
  summarizeDailyActivity
} from './daily-activity';

export interface EmailSendRow {
  sent_at: string;
  recipient_count: number;
}

export { easternDate };
export type DailyEmailCount = DailyCount;

export interface EmailActivity {
  last24Hours: number;
  days: DailyEmailCount[];
}

export function summarizeEmailActivity(
  rows: EmailSendRow[],
  now: Date
): EmailActivity {
  const days = summarizeDailyActivity(rows.map((row) => ({
    occurredAt: row.sent_at,
    count: row.recipient_count
  })), now).days;
  const nowMs = now.getTime();
  const rollingCutoff = nowMs - 86_400_000;
  let last24Hours = 0;

  for (const row of rows) {
    const sentAt = Date.parse(row.sent_at);
    if (!Number.isFinite(sentAt) || sentAt > nowMs ||
      !Number.isInteger(row.recipient_count) || row.recipient_count <= 0) {
      continue;
    }
    if (sentAt >= rollingCutoff) last24Hours += row.recipient_count;
  }

  return {
    last24Hours,
    days
  };
}
