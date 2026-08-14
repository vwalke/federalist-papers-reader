// workers/post/test/schedule.test.ts
import { describe, expect, it } from 'vitest';
import { effectiveMonthDay, itemsDueOnDate, nextDayDowEastern, weeklyItemDue, type WeeklyState } from '../src/schedule';
import debate from '../content/debate.json';
import type { DebateItem } from '../src/types';

const items = debate.items as DebateItem[];
const sequence = debate.sequence as number[];
const byId = new Map(items.map((item) => [item.id, item]));

describe('effectiveMonthDay', () => {
  it('uses the original month-day for newspaper papers', () => {
    expect(effectiveMonthDay(byId.get(1)!)).toBe('10-27');
    expect(effectiveMonthDay(byId.get(77)!)).toBe('04-02');
  });
  it('overrides the McLean papers onto the April finale cadence', () => {
    expect(effectiveMonthDay(byId.get(78)!)).toBe('04-05');
    expect(effectiveMonthDay(byId.get(85)!)).toBe('04-26');
  });
  it('leaves essays on their real Journal dates', () => {
    expect(effectiveMonthDay(byId.get(101)!)).toBe('10-18'); // Brutus No. I
    expect(effectiveMonthDay(byId.get(154)!)).toBe('11-08'); // Cato No. IV
  });
});

describe('itemsDueOnDate', () => {
  it('opens the season with Brutus No. I on October 18', () => {
    expect(itemsDueOnDate(items, '2026-10-18')).toEqual([101]);
  });
  it('finds Federalist No. 1 on October 27', () => {
    expect(itemsDueOnDate(items, '2026-10-27')).toEqual([1]);
  });
  it('groups multiple papers sharing a date into one issue', () => {
    expect(itemsDueOnDate(items, '2027-01-02')).toEqual([32, 33]); // Fed 32 & 33 both ran January 2
  });
  it('routes the McLean papers through their April override dates', () => {
    expect(itemsDueOnDate(items, '2027-04-05')).toEqual([78]);
    expect(itemsDueOnDate(items, '2027-05-28')).toEqual([]);
  });
  it('returns nothing between seasons', () => {
    expect(itemsDueOnDate(items, '2026-08-15')).toEqual([]);
  });
  it('never has to mix a paper and an essay in one anniversary issue', () => {
    // Derived from the content: no essay shares an effective month-day with a
    // paper, so every calendar send is single-kind. If content ever changes,
    // this asserts the collision would ride the existing multi-send path.
    const essayDays = items.filter((i) => i.kind === 'essay').map(effectiveMonthDay);
    const paperDays = new Set(items.filter((i) => i.kind === 'paper').map(effectiveMonthDay));
    expect(essayDays.filter((day) => paperDays.has(day))).toEqual([]);
  });
  it('absorbs Feb 29 into Feb 28 in non-leap years', () => {
    const fake = [{ kind: 'paper' as const, id: 99, publicationDate: '1788-02-29' }];
    expect(itemsDueOnDate(fake, '2027-02-28')).toEqual([99]); // 2027 is not a leap year
    expect(itemsDueOnDate(fake, '2028-02-28')).toEqual([]);   // 2028 is: Feb 29 exists
    expect(itemsDueOnDate(fake, '2028-02-29')).toEqual([99]);
  });
});

describe('nextDayDowEastern', () => {
  it('assigns the day after signup', () => {
    // 2026-07-20T16:00Z is Monday noon Eastern → Tuesday (2)
    expect(nextDayDowEastern(new Date('2026-07-20T16:00:00Z'))).toBe(2);
  });
  it('uses the Eastern calendar day, not UTC', () => {
    // 2026-07-21T01:00Z is already Tuesday in UTC but still Monday 9pm Eastern → Tuesday (2)
    expect(nextDayDowEastern(new Date('2026-07-21T01:00:00Z'))).toBe(2);
  });
  it('wraps Saturday to Sunday', () => {
    // 2026-07-18T16:00Z is Saturday noon Eastern → Sunday (0)
    expect(nextDayDowEastern(new Date('2026-07-18T16:00:00Z'))).toBe(0);
  });
  it('respects the DST fall-back boundary', () => {
    // 2026-11-01T06:30Z: DST ended at 06:00Z, so this is 1:30am EST Sunday → Monday (1)
    expect(nextDayDowEastern(new Date('2026-11-01T06:30:00Z'))).toBe(1);
  });
});

describe('weeklyItemDue', () => {
  const base: WeeklyState = { progress_index: 0, send_dow: 6, confirmed_at: '2026-07-16T09:00:00Z', makeup_pending: 0 };
  const due = (overrides: Partial<WeeklyState>, isoDate: string) =>
    weeklyItemDue({ ...base, ...overrides }, isoDate, sequence);

  it('opens a new subscriber with Brutus No. I — the debate begins on the other side', () => {
    expect(due({}, '2026-07-18')).toEqual({ kind: 'item', id: 101 });
  });
  it('sends on the send day when confirmation was an earlier day', () => {
    expect(due({ confirmed_at: '2026-07-17T22:00:00Z' }, '2026-07-18'))
      .toEqual({ kind: 'item', id: 101 }); // Fri night → Sat
  });
  it('waits a week when confirmation lands on the send day itself', () => {
    expect(due({ confirmed_at: '2026-07-18T05:00:00Z' }, '2026-07-18')).toBeNull();
  });
  it('honors a non-Saturday send day', () => {
    expect(due({ send_dow: 2 }, '2026-07-21')).toEqual({ kind: 'item', id: 101 }); // Tuesday
    expect(due({ send_dow: 2 }, '2026-07-18')).toBeNull();
  });
  it('does nothing off the send day', () => {
    expect(due({}, '2026-07-19')).toBeNull();
  });
  it('walks the merged sequence — papers and essays interleaved', () => {
    expect(due({ progress_index: 1 }, '2026-07-18')).toEqual({ kind: 'item', id: 1 });
    expect(due({ progress_index: 3 }, '2026-07-18')).toEqual({ kind: 'item', id: 102 }); // Brutus No. II
    expect(due({ progress_index: 4 }, '2026-07-18')).toEqual({ kind: 'item', id: 3 });
  });
  it('ends the course after all 93 items', () => {
    expect(due({ progress_index: 92 }, '2026-07-18')).toEqual({ kind: 'item', id: 85 });
    expect(due({ progress_index: 93 }, '2026-07-18')).toBeNull();
  });
  it('never runs for unconfirmed subscribers', () => {
    expect(due({ confirmed_at: null }, '2026-07-18')).toBeNull();
  });

  describe('make-up for migrated subscribers', () => {
    // Old progress N maps to mergedIndexOf(paper N)+1; the essays at earlier
    // positions are exactly what the subscriber never received.
    it('owes just Brutus No. I to a reader who had Paper 1 (old progress 1 → 2)', () => {
      expect(due({ progress_index: 2, makeup_pending: 1 }, '2026-07-18'))
        .toEqual({ kind: 'makeup', essayIds: [101] });
    });
    it('owes Brutus No. I to a reader who had Paper 2, then continues with Brutus No. II', () => {
      expect(due({ progress_index: 3, makeup_pending: 1 }, '2026-07-18'))
        .toEqual({ kind: 'makeup', essayIds: [101] });
      expect(due({ progress_index: 3 }, '2026-07-18'))
        .toEqual({ kind: 'item', id: 102 });
    });
    it('owes three essays to a reader who had Paper 5 (old progress 5 → 8)', () => {
      expect(due({ progress_index: 8, makeup_pending: 1 }, '2026-07-18'))
        .toEqual({ kind: 'makeup', essayIds: [101, 102, 154] });
    });
    it('owes all eight essays to a finished reader (old progress 85 → 93)', () => {
      expect(due({ progress_index: 93, makeup_pending: 1 }, '2026-07-18'))
        .toEqual({ kind: 'makeup', essayIds: [101, 102, 154, 104, 106, 110, 112, 115] });
    });
    it('keeps the make-up on the send day and behind the confirmation guard', () => {
      expect(due({ progress_index: 8, makeup_pending: 1 }, '2026-07-19')).toBeNull();
      expect(due({ progress_index: 8, makeup_pending: 1, confirmed_at: null }, '2026-07-18')).toBeNull();
    });
    it('falls through to the regular sequence when nothing is behind', () => {
      expect(due({ progress_index: 0, makeup_pending: 1 }, '2026-07-18'))
        .toEqual({ kind: 'item', id: 101 });
    });
  });
});
