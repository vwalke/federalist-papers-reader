export interface EmailSendRow {
  sent_at: string;
  recipient_count: number;
}

export interface DailyEmailCount {
  date: string;
  count: number;
}

export interface EmailActivity {
  last24Hours: number;
  days: DailyEmailCount[];
}

const EASTERN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function easternDate(instant: Date): string {
  const parts = new Map(
    EASTERN.formatToParts(instant).map((part) => [part.type, part.value])
  );
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

function dateLabels(now: Date): string[] {
  const today = new Date(`${easternDate(now)}T12:00:00.000Z`);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (29 - index));
    return date.toISOString().slice(0, 10);
  });
}

export function summarizeEmailActivity(
  rows: EmailSendRow[],
  now: Date
): EmailActivity {
  const labels = dateLabels(now);
  const counts = new Map(labels.map((date) => [date, 0]));
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
    const date = easternDate(new Date(sentAt));
    if (counts.has(date)) counts.set(date, counts.get(date)! + row.recipient_count);
  }

  return {
    last24Hours,
    days: labels.map((date) => ({ date, count: counts.get(date) ?? 0 }))
  };
}
