// workers/post/src/season.ts
// The As It Happened season calendar and the catch-up rule. Pure: no Worker
// bindings and no bundled content, so the site's signup form imports it too.
//
// Catch-up (docs/catch-up/DESIGN.md): a reader who joins after the season has
// opened may ask for the papers already printed. They receive every on-date
// paper live from their first morning, plus one catch-up paper each morning,
// earliest first, until the backlog is spent. Backlog N takes exactly N
// mornings whatever the season's pace, so it always converges.
//
// Imports nothing, deliberately: the site bundles this file into the signup
// form's script, where the Worker's types and content must not follow.

/** Month-days, applied to the year the season opens. */
export const SEASON_OPENS = '10-18';
export const SEASON_CLOSES = '04-26';
/**
 * Last day a signup (or a manage-page opt-in) may ask for catch-up. On this
 * date the backlog is at most twelve papers; the day after, Federalist No. 10
 * runs and the backlog would keep growing past a fortnight.
 */
export const CATCH_UP_LAST_DAY = '11-21';

/** The fields of a debate item the calendar needs (a structural DebateItem). */
export interface DatedItem {
  kind: 'paper' | 'essay';
  id: number;
  publicationDate: string;
}

/** Operator amendment 2026-07-18: papers 78-85 keep the season's stride. */
export const MCLEAN_OVERRIDES: Record<number, string> = {
  78: '04-05', 79: '04-08', 80: '04-11', 81: '04-14',
  82: '04-17', 83: '04-20', 84: '04-23', 85: '04-26'
};

/** The McLean overrides apply to papers only; essays keep their real dates. */
export function effectiveMonthDay(item: DatedItem): string {
  const override = item.kind === 'paper' ? MCLEAN_OVERRIDES[item.id] : undefined;
  return override ?? item.publicationDate.slice(5);
}

export interface SeasonEntry {
  id: number;
  /** ISO date this item is due in the given season. */
  date: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

/** The year the season containing (or next following) `iso` opens. May–September look ahead. */
export function seasonStartYear(iso: string): number {
  const year = Number(iso.slice(0, 4));
  return Number(iso.slice(5, 7)) >= 5 ? year : year - 1;
}

export function seasonOpens(iso: string): string {
  return `${seasonStartYear(iso)}-${SEASON_OPENS}`;
}

export function seasonCloses(iso: string): string {
  return `${seasonStartYear(iso) + 1}-${SEASON_CLOSES}`;
}

export function catchUpLastDay(iso: string): string {
  return `${seasonStartYear(iso)}-${CATCH_UP_LAST_DAY}`;
}

/** True on the days a reader may ask for catch-up: from opening day through the cut-off. */
export function catchUpOpen(iso: string): boolean {
  return seasonOpens(iso) <= iso && iso <= catchUpLastDay(iso);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Month-day -> ISO date in the season that opens in `startYear`. */
export function seasonDateFor(monthDay: string, startYear: number): string {
  const year = Number(monthDay.slice(0, 2)) >= 5 ? startYear : startYear + 1;
  // Mirrors itemsDueOnDate: a Feb 29 anniversary runs Feb 28 in common years.
  const day = monthDay === '02-29' && !isLeapYear(year) ? '02-28' : monthDay;
  return `${year}-${day}`;
}

/**
 * Every item in the season containing `iso`, in the order it runs: by date,
 * then id (Federalist papers before the Journal on a shared day).
 */
export function seasonCalendar(items: ReadonlyArray<DatedItem>, iso: string): SeasonEntry[] {
  const startYear = seasonStartYear(iso);
  return items
    .map((item) => ({ id: item.id, date: seasonDateFor(effectiveMonthDay(item), startYear) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}

/**
 * The first morning a reader activated on `todayIso` receives live: today if
 * the daily run has not yet gone out, otherwise tomorrow.
 */
export function firstLiveDay(todayIso: string, ranToday: boolean): string {
  return ranToday ? addDays(todayIso, 1) : todayIso;
}

/**
 * The catch-up backlog for a reader whose first live morning is `firstLive`:
 * every item of the season dated before it, earliest first, less anything the
 * reader already holds this season (a returning or switching subscriber).
 */
export function catchUpBacklog(
  items: ReadonlyArray<DatedItem>,
  firstLive: string,
  alreadyHave: ReadonlySet<number> = new Set()
): number[] {
  return seasonCalendar(items, firstLive)
    .filter((entry) => entry.date < firstLive && !alreadyHave.has(entry.id))
    .map((entry) => entry.id);
}

/** The first item of the season due on or after `fromIso`, or null once the season has run out. */
export function nextOnDate(items: ReadonlyArray<DatedItem>, fromIso: string): SeasonEntry | null {
  return seasonCalendar(items, fromIso).find((entry) => entry.date >= fromIso) ?? null;
}

/** Catch-up papers go one a morning, beginning the morning after the reader asked. */
export function catchUpStartsOn(todayIso: string): string {
  return addDays(todayIso, 1);
}

/** The morning the last of `remaining` catch-up papers arrives, sending from `fromIso`. */
export function catchUpFinishesOn(fromIso: string, remaining: number): string {
  return addDays(fromIso, Math.max(remaining, 1) - 1);
}

export interface CatchUpState {
  /** Comma-separated item ids, in the order they are sent; null when not catching up. */
  catchup_items: string | null;
  catchup_starts_on: string | null;
  caught_up_on: string | null;
}

export function parseCatchUpItems(value: string | null): number[] {
  if (!value) return [];
  return value.split(',').map(Number).filter((id) => Number.isInteger(id) && id > 0);
}

export interface DeliveredItem {
  paper_number: number;
  scheduled_for: string;
}

export interface CatchUpDue {
  id: number;
  /** 1-based place in the reader's backlog. */
  position: number;
  total: number;
}

/**
 * The catch-up paper owed on `todayIso`, or null. `delivered` is every
 * delivery row the reader has this season, any status: a row means the item
 * was claimed (sent, in flight, or failed and left to the retry machinery), so
 * it is never chosen twice. A catch-up row already scheduled for today means
 * today's paper was claimed by an earlier run, so a rerun sends nothing more.
 */
export function catchUpItemDue(
  state: CatchUpState,
  todayIso: string,
  delivered: ReadonlyArray<DeliveredItem>
): CatchUpDue | null {
  const ids = parseCatchUpItems(state.catchup_items);
  if (ids.length === 0 || state.caught_up_on) return null;
  if (!state.catchup_starts_on || todayIso < state.catchup_starts_on) return null;
  const backlog = new Set(ids);
  const claimed = new Set<number>();
  for (const row of delivered) {
    if (!backlog.has(row.paper_number)) continue;
    if (row.scheduled_for === todayIso) return null;
    claimed.add(row.paper_number);
  }
  const index = ids.findIndex((id) => !claimed.has(id));
  if (index === -1) return null;
  return { id: ids[index], position: index + 1, total: ids.length };
}

/** How many of the backlog's papers have been claimed so far. */
export function catchUpClaimed(state: CatchUpState, delivered: ReadonlyArray<DeliveredItem>): number {
  const backlog = new Set(parseCatchUpItems(state.catchup_items));
  return new Set(delivered.map((row) => row.paper_number).filter((id) => backlog.has(id))).size;
}

/**
 * When `itemId`, sent on `scheduledFor`, is one of the reader's catch-up
 * papers, its place in the backlog; otherwise null. A catch-up paper always
 * goes out after its anniversary, which is what tells it apart from the same
 * item arriving live. Used for first sends and retries alike.
 */
export function catchUpPosition(
  state: CatchUpState,
  items: ReadonlyArray<DatedItem>,
  itemId: number,
  scheduledFor: string
): { position: number; total: number } | null {
  const ids = parseCatchUpItems(state.catchup_items);
  const index = ids.indexOf(itemId);
  if (index === -1) return null;
  const entry = seasonCalendar(items, scheduledFor).find((e) => e.id === itemId);
  if (!entry || entry.date >= scheduledFor) return null;
  return { position: index + 1, total: ids.length };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** '2026-11-21' -> 'November 21'. */
export function monthDayLabel(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

/** '2026-11-21' -> 'Saturday, November 21'. */
export function weekdayDateLabel(iso: string): string {
  return `${WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()]}, ${monthDayLabel(iso)}`;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty'];

/** Spelled out through twenty, as the letters do; figures beyond. */
export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
