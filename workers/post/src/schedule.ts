// workers/post/src/schedule.ts
import type { DebateItem } from './types';

/** Operator amendment 2026-07-18: papers 78-85 keep the season's stride. */
export const MCLEAN_OVERRIDES: Record<number, string> = {
  78: '04-05', 79: '04-08', 80: '04-11', 81: '04-14',
  82: '04-17', 83: '04-20', 84: '04-23', 85: '04-26'
};

type DatedItem = Pick<DebateItem, 'kind' | 'id' | 'publicationDate'>;

/** The McLean overrides apply to papers only; essays keep their real dates. */
export function effectiveMonthDay(item: DatedItem): string {
  const override = item.kind === 'paper' ? MCLEAN_OVERRIDES[item.id] : undefined;
  return override ?? item.publicationDate.slice(5);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Ids of every item — paper or essay — due on `isoDate`'s anniversary. */
export function itemsDueOnDate(
  items: ReadonlyArray<DatedItem>,
  isoDate: string
): number[] {
  const year = Number(isoDate.slice(0, 4));
  const monthDay = isoDate.slice(5);
  const wanted = new Set([monthDay]);
  if (monthDay === '02-28' && !isLeapYear(year)) wanted.add('02-29');
  return items
    .filter((item) => wanted.has(effectiveMonthDay(item)))
    .map((item) => item.id)
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
  makeup_pending: number;
}

export type WeeklyDue =
  | { kind: 'item'; id: number }
  | { kind: 'makeup'; essayIds: number[] };

/** Ids above the Federalist's 1–85 belong to the Journal (Brutus 101+, Cato 151+). */
const isEssayId = (id: number): boolean => id > 85;

/**
 * What the weekly program owes `sub` on `isoDate`, or null. Caller filters to
 * active subscribers. progress_index counts merged debate items consumed, so a
 * fresh subscriber's first item is sequence[0] — Brutus No. I, deliberately. A
 * pending make-up gathers the essays that ran before the subscriber's current
 * position into one catch-up issue without advancing progress.
 */
export function weeklyItemDue(
  sub: WeeklyState,
  isoDate: string,
  sequence: readonly number[]
): WeeklyDue | null {
  if (!sub.confirmed_at) return null;
  const today = new Date(`${isoDate}T00:00:00Z`);
  if (today.getUTCDay() !== sub.send_dow) return null;
  const confirmedDay = new Date(`${sub.confirmed_at.slice(0, 10)}T00:00:00Z`);
  // Send only on a calendar day strictly after confirmation: the welcome email
  // and the first item never land the same day, but next-day sends work.
  if (today.getTime() - confirmedDay.getTime() < DAY_MS) return null;
  if (sub.makeup_pending) {
    const essayIds = sequence.slice(0, sub.progress_index).filter(isEssayId);
    // A stale flag with nothing behind it (progress 0) falls through to the
    // regular sequence rather than sending an empty make-up.
    if (essayIds.length > 0) return { kind: 'makeup', essayIds };
  }
  if (sub.progress_index >= sequence.length) return null;
  return { kind: 'item', id: sequence[sub.progress_index] };
}
