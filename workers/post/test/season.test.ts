// workers/post/test/season.test.ts
//
// The catch-up pacing rule against the real season schedule: every possible
// late joiner converges, on the date promised, with at most two papers a
// morning, and never receives a paper twice or misses one.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import debate from '../content/debate.json';
import { itemsDueOnDate } from '../src/schedule';
import {
  addDays,
  catchUpBacklog,
  catchUpClaimed,
  catchUpFinishesOn,
  catchUpItemDue,
  catchUpLastDay,
  catchUpOpen,
  catchUpPosition,
  catchUpStartsOn,
  catchUpStateFor,
  CATCH_UP_LAST_DAY,
  DAILY_RUN_EASTERN_HOUR,
  dailyRunHasGoneOut,
  easternHour,
  easternToday,
  effectiveMonthDay,
  firstLiveDay,
  isDailyRunHour,
  nextOnDate,
  numberWord,
  seasonCalendar,
  SEASON_OPENS,
  seasonOpens,
  signupCatchUpBehind,
  weekdayDateLabel,
  type CatchUpState,
  type DeliveredItem
} from '../src/season';
import { STALE_PENDING_DAYS } from '../src/deliver';
import type { DebateItem } from '../src/types';

const items = debate.items as DebateItem[];

describe('the season calendar', () => {
  const season = seasonCalendar(items, '2026-11-10');

  it('runs all ninety-three items from Brutus No. I on October 18 to Federalist No. 85 on April 26', () => {
    expect(season).toHaveLength(93);
    expect(season[0]).toEqual({ id: 101, date: '2026-10-18' });
    expect(season[1]).toEqual({ id: 1, date: '2026-10-27' });
    expect(season.at(-1)).toEqual({ id: 85, date: '2027-04-26' });
  });

  it('agrees with the daily run about what is due on every day of the season', () => {
    for (let day = '2026-10-18'; day <= '2027-04-26'; day = addDays(day, 1)) {
      expect(season.filter((entry) => entry.date === day).map((entry) => entry.id))
        .toEqual(itemsDueOnDate(items, day));
    }
  });

  it('has stretches faster than one a day, so one-a-day replay alone would fall behind', () => {
    // November 27 – December 1: five on-date papers on five consecutive days.
    const run = ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01'];
    for (const day of run) expect(itemsDueOnDate(items, day)).toHaveLength(1);
    // A reader replaying in order from Brutus No. I at one a day, starting
    // November 15, would not reach the live edge for nineteen days.
    const printedBy = (day: string) => season.filter((entry) => entry.date <= day).length;
    let day = '2026-11-15';
    let read = 1; // one paper each morning, oldest first
    while (read < printedBy(day)) {
      day = addDays(day, 1);
      read++;
    }
    expect(read).toBe(19);
    // Catch-up in addition to the on-date papers takes as many mornings as
    // the backlog is long: nine, from the same start.
    expect(catchUpBacklog(items, '2026-11-15')).toHaveLength(9);
  });

  it('looks ahead to the next season between April and October', () => {
    expect(seasonOpens('2027-04-20')).toBe('2026-10-18');
    expect(seasonOpens('2027-06-01')).toBe('2027-10-18');
    expect(seasonCalendar(items, '2027-06-01')[0]).toEqual({ id: 101, date: '2027-10-18' });
  });
});

describe('the catch-up window', () => {
  it('opens on opening day and closes after November 21', () => {
    expect(catchUpOpen('2026-10-17')).toBe(false);
    expect(catchUpOpen('2026-10-18')).toBe(true);
    expect(catchUpOpen('2026-11-21')).toBe(true);
    expect(catchUpOpen('2026-11-22')).toBe(false);
    expect(catchUpOpen('2027-03-01')).toBe(false);
    expect(catchUpLastDay('2026-10-23')).toBe('2026-11-21');
  });

  it('reopens with each new season', () => {
    expect(catchUpOpen('2027-10-17')).toBe(false);
    expect(catchUpOpen('2027-10-18')).toBe(true);
    expect(catchUpOpen('2027-11-21')).toBe(true);
  });

  it('caps the backlog at twelve on the last day to ask', () => {
    const lastDay = catchUpLastDay('2026-11-01');
    expect(catchUpBacklog(items, firstLiveDay(lastDay, false))).toHaveLength(11);
    const afterRun = catchUpBacklog(items, firstLiveDay(lastDay, true));
    expect(afterRun).toEqual([101, 1, 2, 102, 3, 4, 154, 5, 6, 7, 8, 9]);
  });

  it('honours a cut-off request for the life of the signup: at most sixteen, done by December 14', () => {
    const lastConfirm = addDays(catchUpLastDay('2026-11-01'), STALE_PENDING_DAYS);
    expect(lastConfirm).toBe('2026-11-28');
    const backlog = catchUpBacklog(items, firstLiveDay(lastConfirm, true));
    expect(backlog).toHaveLength(16);
    expect(catchUpFinishesOn(catchUpStartsOn(lastConfirm), backlog.length)).toBe('2026-12-14');
  });

  it('counts only what has run before the first live morning', () => {
    expect(catchUpBacklog(items, '2026-10-18')).toEqual([]);
    expect(catchUpBacklog(items, '2026-10-19')).toEqual([101]);
    expect(catchUpBacklog(items, '2026-10-27')).toEqual([101]);
    expect(catchUpBacklog(items, '2026-10-28')).toEqual([101, 1]);
  });

  it('leaves out papers the reader already holds', () => {
    expect(catchUpBacklog(items, '2026-11-04', new Set([101, 1]))).toEqual([2, 102, 3]);
  });

  it('treats a morning as live until the daily run has gone out', () => {
    expect(firstLiveDay('2026-11-10', false)).toBe('2026-11-10');
    expect(firstLiveDay('2026-11-10', true)).toBe('2026-11-11');
  });
});

/** Drives the daily run's catch-up decision over the calendar, as runDaily does. */
function simulate(confirmedOn: string, ranToday: boolean) {
  const firstLive = firstLiveDay(confirmedOn, ranToday);
  const backlog = catchUpBacklog(items, firstLive);
  const state: CatchUpState = {
    catchup_items: backlog.join(','),
    catchup_starts_on: catchUpStartsOn(confirmedOn),
    caught_up_on: null
  };
  const delivered: DeliveredItem[] = [];
  const perDay = new Map<string, number[]>();
  for (let day = firstLive; day <= '2027-04-26'; day = addDays(day, 1)) {
    const ids = [...itemsDueOnDate(items, day)];
    const due = catchUpItemDue(state, day, delivered);
    if (due) {
      ids.push(due.id);
      if (due.position === due.total) state.caught_up_on = day;
    }
    // A rerun of the same morning must add nothing.
    expect(catchUpItemDue(state, day, [...delivered, ...ids.map((id) => ({ paper_number: id, scheduled_for: day }))]))
      .toBeNull();
    for (const id of ids) delivered.push({ paper_number: id, scheduled_for: day });
    if (ids.length > 0) perDay.set(day, ids);
  }
  return { backlog, state, delivered, perDay };
}

describe('catch-up pacing over the real season', () => {
  const confirmDays: string[] = [];
  for (let day = '2026-10-18'; day <= '2026-11-28'; day = addDays(day, 1)) confirmDays.push(day);

  it.each(confirmDays.flatMap((day) => [[day, false], [day, true]] as Array<[string, boolean]>))(
    'a reader confirming %s (run already out: %s) converges on the promised day',
    (confirmedOn, ranToday) => {
      const { backlog, state, delivered, perDay } = simulate(confirmedOn, ranToday);
      const startsOn = catchUpStartsOn(confirmedOn);
      if (backlog.length > 0) {
        // Exactly one catch-up a morning: done on startsOn + N - 1, never later.
        expect(state.caught_up_on).toBe(catchUpFinishesOn(startsOn, backlog.length));
        expect(state.caught_up_on! <= '2026-12-14').toBe(true);
      }
      // Never more than two papers in a morning's letter.
      for (const ids of perDay.values()) expect(ids.length).toBeLessThanOrEqual(2);
      // Every item of the season arrives exactly once.
      const ids = delivered.map((row) => row.paper_number);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.sort((a, b) => a - b)).toEqual(items.map((item) => item.id).sort((a, b) => a - b));
    }
  );
});

describe('catchUpItemDue', () => {
  const state: CatchUpState = { catchup_items: '101,1,2', catchup_starts_on: '2026-11-01', caught_up_on: null };

  it('waits for the first catch-up morning', () => {
    expect(catchUpItemDue(state, '2026-10-31', [])).toBeNull();
    expect(catchUpItemDue(state, '2026-11-01', [])).toEqual({ id: 101, position: 1, total: 3 });
  });

  it('moves on as each paper is claimed and stops at the end', () => {
    const rows = [{ paper_number: 101, scheduled_for: '2026-11-01' }];
    expect(catchUpItemDue(state, '2026-11-02', rows)).toEqual({ id: 1, position: 2, total: 3 });
    rows.push({ paper_number: 1, scheduled_for: '2026-11-02' }, { paper_number: 2, scheduled_for: '2026-11-03' });
    expect(catchUpItemDue(state, '2026-11-04', rows)).toBeNull();
  });

  it('sends nothing more on a rerun of a morning whose catch-up is already claimed', () => {
    expect(catchUpItemDue(state, '2026-11-01', [{ paper_number: 101, scheduled_for: '2026-11-01' }])).toBeNull();
  });

  it('ignores on-date rows that are not in the backlog', () => {
    expect(catchUpItemDue(state, '2026-11-01', [{ paper_number: 102, scheduled_for: '2026-11-01' }]))
      .toEqual({ id: 101, position: 1, total: 3 });
  });

  it('skips a paper the reader somehow already holds, keeping its number', () => {
    expect(catchUpItemDue(state, '2026-11-02', [{ paper_number: 101, scheduled_for: '2026-10-18' },
      { paper_number: 1, scheduled_for: '2026-10-27' }])).toEqual({ id: 2, position: 3, total: 3 });
  });

  it('does nothing once caught up or when not catching up', () => {
    expect(catchUpItemDue({ ...state, caught_up_on: '2026-11-03' }, '2026-11-04', [])).toBeNull();
    expect(catchUpItemDue({ ...state, catchup_items: null }, '2026-11-04', [])).toBeNull();
  });

  it('counts claimed papers for the manage page', () => {
    expect(catchUpClaimed(state, [{ paper_number: 101, scheduled_for: '2026-11-01' },
      { paper_number: 3, scheduled_for: '2026-11-03' }])).toBe(1);
  });
});

describe('catchUpPosition', () => {
  const state: CatchUpState = { catchup_items: '101,1,2', catchup_starts_on: '2026-11-01', caught_up_on: null };

  it('recognises a backlog paper going out after its anniversary', () => {
    expect(catchUpPosition(state, items, 1, '2026-11-02')).toEqual({ position: 2, total: 3 });
  });

  it('does not mistake the same paper arriving live on its anniversary', () => {
    expect(catchUpPosition(state, items, 1, '2026-10-27')).toBeNull();
    expect(catchUpPosition(state, items, 3, '2026-11-03')).toBeNull();
  });
});

describe('labels', () => {
  it('formats dates and counts the way the letters do', () => {
    expect(weekdayDateLabel('2026-11-21')).toBe('Saturday, November 21');
    expect(numberWord(12)).toBe('twelve');
    expect(numberWord(23)).toBe('23');
    expect(nextOnDate(items, '2026-11-11')).toEqual({ id: 6, date: '2026-11-14' });
    expect(nextOnDate(items, '2027-04-27')).toBeNull();
  });
});

describe('Eastern dates', () => {
  const today = (iso: string) => easternToday(new Date(iso));
  const ranAt = (iso: string) => dailyRunHasGoneOut(new Date(iso));

  it('keeps November 21 until midnight in New York', () => {
    expect(today('2026-11-22T00:30:00Z')).toBe('2026-11-21');
    expect(today('2026-11-22T04:59:59Z')).toBe('2026-11-21');
    expect(today('2026-11-22T05:00:00Z')).toBe('2026-11-22');
    expect(catchUpOpen(today('2026-11-22T00:30:00Z'))).toBe(true);
    expect(catchUpOpen(today('2026-11-22T05:30:00Z'))).toBe(false);
  });

  it('turns the day at 04:00 UTC under daylight time and 05:00 UTC under standard time', () => {
    expect(today('2026-07-01T03:59:00Z')).toBe('2026-06-30');
    expect(today('2026-07-01T04:00:00Z')).toBe('2026-07-01');
    // Clocks spring forward on March 14, 2027: that midnight is still EST.
    expect(today('2027-03-14T04:59:00Z')).toBe('2027-03-13');
    expect(today('2027-03-14T05:00:00Z')).toBe('2027-03-14');
    expect(today('2027-03-15T03:59:00Z')).toBe('2027-03-14');
    expect(today('2027-03-15T04:00:00Z')).toBe('2027-03-15');
    // Clocks fall back on November 1, 2026: that midnight is still EDT.
    expect(today('2026-11-01T03:59:00Z')).toBe('2026-10-31');
    expect(today('2026-11-01T04:00:00Z')).toBe('2026-11-01');
    expect(today('2026-11-02T04:30:00Z')).toBe('2026-11-01');
    expect(today('2026-11-02T05:00:00Z')).toBe('2026-11-02');
  });

  it('defaults to the present', () => {
    expect(easternToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('counts the run as out from 7am Eastern, summer and winter', () => {
    // Daylight time: 7am EDT is 11:00 UTC.
    expect(ranAt('2026-07-01T10:59:00Z')).toBe(false);
    expect(ranAt('2026-07-01T11:00:00Z')).toBe(true);
    expect(ranAt('2026-07-02T03:30:00Z')).toBe(true); // 11:30pm EDT, July 1
    expect(ranAt('2026-07-02T04:00:00Z')).toBe(false); // midnight EDT, July 2
    // Standard time: 7am EST is 12:00 UTC.
    expect(ranAt('2026-12-15T11:00:00Z')).toBe(false); // 6am EST
    expect(ranAt('2026-12-15T11:59:00Z')).toBe(false);
    expect(ranAt('2026-12-15T12:00:00Z')).toBe(true);
    expect(ranAt('2027-01-15T11:59:00Z')).toBe(false);
    expect(ranAt('2027-01-15T12:00:00Z')).toBe(true);
    expect(ranAt('2026-11-02T11:59:00Z')).toBe(false);
    expect(ranAt('2026-11-02T12:00:00Z')).toBe(true);
    expect(ranAt('2026-11-02T04:30:00Z')).toBe(true); // 11:30pm EST, November 1
    expect(ranAt('2026-11-02T05:00:00Z')).toBe(false); // midnight EST, November 2
    // Clocks fall back at 2am EDT on November 1, 2026, so 7am that day is EST.
    expect(ranAt('2026-10-31T10:59:00Z')).toBe(false);
    expect(ranAt('2026-10-31T11:00:00Z')).toBe(true);
    expect(ranAt('2026-11-01T11:00:00Z')).toBe(false); // 6am EST
    expect(ranAt('2026-11-01T11:59:00Z')).toBe(false);
    expect(ranAt('2026-11-01T12:00:00Z')).toBe(true);
    // Clocks spring forward at 2am EST on March 14, 2027, so 7am that day is EDT.
    expect(ranAt('2027-03-13T11:59:00Z')).toBe(false);
    expect(ranAt('2027-03-13T12:00:00Z')).toBe(true);
    expect(ranAt('2027-03-14T06:30:00Z')).toBe(false); // 1:30am EST, before the jump
    expect(ranAt('2027-03-14T10:59:00Z')).toBe(false);
    expect(ranAt('2027-03-14T11:00:00Z')).toBe(true);
    expect(ranAt('2027-03-14T04:30:00Z')).toBe(true); // 11:30pm EST, March 13
  });

  it('reads the hour on the New York clock', () => {
    expect(easternHour(new Date('2026-07-01T04:00:00Z'))).toBe(0);
    expect(easternHour(new Date('2026-07-01T11:00:00Z'))).toBe(7);
    expect(easternHour(new Date('2026-12-15T12:00:00Z'))).toBe(7);
    expect(easternHour(new Date('2026-12-16T04:59:00Z'))).toBe(23);
    expect(DAILY_RUN_EASTERN_HOUR).toBe(7);
  });
});

describe('the two cron fires', () => {
  const runs = (iso: string) => isDailyRunHour(new Date(iso));
  const fires = (day: string) => [runs(`${day}T11:00:00Z`), runs(`${day}T12:00:00Z`)];

  it('runs the 11:00 UTC fire under daylight time and skips 12:00', () => {
    expect(fires('2026-07-01')).toEqual([true, false]);
    expect(fires('2026-10-31')).toEqual([true, false]);
  });

  it('runs the 12:00 UTC fire under standard time and skips 11:00', () => {
    expect(fires('2026-12-15')).toEqual([false, true]);
    expect(fires('2027-01-15')).toEqual([false, true]);
    expect(fires('2027-03-13')).toEqual([false, true]);
  });

  it('runs 7am EST on the morning clocks fall back (11:00 UTC is 6am)', () => {
    expect(fires('2026-11-01')).toEqual([false, true]);
  });

  it('runs 7am EDT on the morning clocks spring forward (12:00 UTC is 8am)', () => {
    expect(fires('2027-03-14')).toEqual([true, false]);
  });

  it('runs exactly once on every Eastern day of the year', () => {
    for (let day = '2026-07-01'; day <= '2027-07-01'; day = addDays(day, 1)) {
      expect(fires(day).filter(Boolean), day).toHaveLength(1);
    }
  });

  it('matches the triggers in wrangler.toml', () => {
    const toml = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
    const line = toml.split('\n').find((l) => l.startsWith('crons = '));
    expect(JSON.parse(line!.slice('crons = '.length))).toEqual(['0 11 * * *', '0 12 * * *']);
  });
});

describe('the signup form’s count', () => {
  const days = items.map(effectiveMonthDay)
    .filter((day) => day >= SEASON_OPENS && day <= CATCH_UP_LAST_DAY).sort();
  const behind = (iso: string) => signupCatchUpBehind(days, new Date(iso));

  it('agrees with the Worker’s backlog, before and after the morning run', () => {
    expect(behind('2026-11-10T09:00:00Z')).toBe(catchUpBacklog(items, firstLiveDay('2026-11-10', false)).length);
    expect(behind('2026-11-10T16:00:00Z')).toBe(catchUpBacklog(items, firstLiveDay('2026-11-10', true)).length);
    expect(behind('2026-11-10T09:00:00Z')).toBe(7);
    expect(behind('2026-11-10T16:00:00Z')).toBe(8);
  });

  it('keeps the offer through the evening of November 21 in New York and drops it at midnight', () => {
    expect(behind('2026-11-22T00:30:00Z')).toBe(12);
    expect(behind('2026-11-22T05:30:00Z')).toBe(0);
    expect(behind('2026-10-17T16:00:00Z')).toBe(0);
  });

  it('is what the site’s signup component runs, with no UTC date of its own', () => {
    const source = readFileSync(new URL('../../../src/components/SubscribeCoupon.astro', import.meta.url), 'utf8');
    const script = source.slice(source.indexOf('<script>'));
    expect(script).toContain('signupCatchUpBehind(');
    expect(script).not.toMatch(/toISOString|getUTCHours/);
  });
});

describe('catchUpStateFor', () => {
  const state = (overrides: Partial<CatchUpState> = {}): CatchUpState => ({
    catchup_items: '101,1,2', catchup_starts_on: '2026-11-11', caught_up_on: null, ...overrides
  });
  const none = { catchup_items: null, catchup_starts_on: null, caught_up_on: null };

  it('keeps this season’s state, through the season’s close in April', () => {
    expect(catchUpStateFor(state(), '2026-11-20')).toEqual(state());
    expect(catchUpStateFor(state({ caught_up_on: '2026-11-13' }), '2027-04-26'))
      .toEqual(state({ caught_up_on: '2026-11-13' }));
  });

  it('reads an earlier season’s backlog, finished or not, as none', () => {
    expect(catchUpStateFor(state(), '2027-11-10')).toEqual(none);
    expect(catchUpStateFor(state({ caught_up_on: '2026-11-13' }), '2027-10-18')).toEqual(none);
    // From May the calendar looks ahead to the next season.
    expect(catchUpStateFor(state(), '2027-05-01')).toEqual(none);
  });

  it('falls back to the caught-up date when there is no start date, and passes no state through', () => {
    expect(catchUpStateFor(state({ catchup_starts_on: null, caught_up_on: '2026-11-13' }), '2027-11-10')).toEqual(none);
    expect(catchUpStateFor(none, '2027-11-10')).toEqual(none);
  });
});
