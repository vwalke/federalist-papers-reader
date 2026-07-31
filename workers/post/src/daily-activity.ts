export interface TimedCount {
  occurredAt: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyActivity {
  days: DailyCount[];
}

const EASTERN_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit'
});

const EASTERN_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23'
});

function parts(formatter: Intl.DateTimeFormat, instant: Date): Map<string, string> {
  return new Map(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
}

export function easternDate(instant: Date): string {
  const value = parts(EASTERN_DATE, instant);
  return `${value.get('year')}-${value.get('month')}-${value.get('day')}`;
}

export function recentEasternDates(now: Date): string[] {
  const today = new Date(`${easternDate(now)}T12:00:00.000Z`);
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (29 - index));
    return date.toISOString().slice(0, 10);
  });
}

function easternMidnight(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const value = parts(EASTERN_PARTS, new Date(guess));
    const represented = Date.UTC(
      Number(value.get('year')), Number(value.get('month')) - 1,
      Number(value.get('day')), Number(value.get('hour')),
      Number(value.get('minute')), Number(value.get('second'))
    );
    const correction = target - represented;
    guess += correction;
    if (correction === 0) break;
  }
  return new Date(guess);
}

export function easternWindow(now: Date): { labels: string[]; start: Date; end: Date } {
  const labels = recentEasternDates(now);
  return { labels, start: easternMidnight(labels[0]), end: new Date(now) };
}

export function summarizeDailyActivity(rows: TimedCount[], now: Date): DailyActivity {
  const { labels } = easternWindow(now);
  const counts = new Map(labels.map((date) => [date, 0]));
  for (const row of rows) {
    const instant = Date.parse(row.occurredAt);
    if (!Number.isFinite(instant) || instant > now.getTime() ||
      !Number.isInteger(row.count) || row.count < 0) continue;
    const date = easternDate(new Date(instant));
    if (counts.has(date)) counts.set(date, counts.get(date)! + row.count);
  }
  return { days: labels.map((date) => ({ date, count: counts.get(date) ?? 0 })) };
}
