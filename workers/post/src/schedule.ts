// workers/post/src/schedule.ts
import type { PaperContent } from './types';

/** Operator amendment 2026-07-18: papers 78-85 keep the season's stride. */
export const MCLEAN_OVERRIDES: Record<number, string> = {
  78: '04-05', 79: '04-08', 80: '04-11', 81: '04-14',
  82: '04-17', 83: '04-20', 84: '04-23', 85: '04-26'
};

export function effectiveMonthDay(paper: Pick<PaperContent, 'number' | 'publicationDate'>): string {
  return MCLEAN_OVERRIDES[paper.number] ?? paper.publicationDate.slice(5);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function papersDueOnDate(
  papers: ReadonlyArray<Pick<PaperContent, 'number' | 'publicationDate'>>,
  isoDate: string
): number[] {
  const year = Number(isoDate.slice(0, 4));
  const monthDay = isoDate.slice(5);
  const wanted = new Set([monthDay]);
  if (monthDay === '02-28' && !isLeapYear(year)) wanted.add('02-29');
  return papers
    .filter((p) => wanted.has(effectiveMonthDay(p)))
    .map((p) => p.number)
    .sort((a, b) => a - b);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const EASTERN_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
const DOW_BY_SHORT: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The day after `now` on the Eastern calendar — a new subscriber's default send day. */
export function nextDayDowEastern(now: Date): number {
  return (DOW_BY_SHORT[EASTERN_WEEKDAY.format(now)] + 1) % 7;
}

export interface WeeklyState {
  progress_index: number;
  send_dow: number;
  confirmed_at: string | null;
}

/** Returns the paper number to send today, or null. Caller filters to active subscribers. */
export function weeklyPaperDue(sub: WeeklyState, isoDate: string): number | null {
  if (!sub.confirmed_at || sub.progress_index >= 85) return null;
  const today = new Date(`${isoDate}T00:00:00Z`);
  if (today.getUTCDay() !== sub.send_dow) return null;
  const confirmedDay = new Date(`${sub.confirmed_at.slice(0, 10)}T00:00:00Z`);
  if (today.getTime() - confirmedDay.getTime() < 2 * DAY_MS) return null;
  return sub.progress_index + 1;
}
