// workers/post/test/schedule.test.ts
import { describe, expect, it } from 'vitest';
import { effectiveMonthDay, nextDayDowEastern, papersDueOnDate, weeklyPaperDue } from '../src/schedule';
import papers from '../content/papers.json';

describe('effectiveMonthDay', () => {
  it('uses the original month-day for newspaper papers', () => {
    expect(effectiveMonthDay(papers.find((p) => p.number === 1)!)).toBe('10-27');
    expect(effectiveMonthDay(papers.find((p) => p.number === 77)!)).toBe('04-02');
  });
  it('overrides the McLean papers onto the April finale cadence', () => {
    expect(effectiveMonthDay(papers.find((p) => p.number === 78)!)).toBe('04-05');
    expect(effectiveMonthDay(papers.find((p) => p.number === 85)!)).toBe('04-26');
  });
});

describe('papersDueOnDate', () => {
  it('finds the season opener on October 27', () => {
    expect(papersDueOnDate(papers, '2026-10-27')).toEqual([1]);
  });
  it('groups multiple papers sharing a date into one issue', () => {
    expect(papersDueOnDate(papers, '2027-01-02')).toEqual([32, 33]); // Fed 32 & 33 both ran January 2
  });
  it('routes the McLean papers through their April override dates', () => {
    expect(papersDueOnDate(papers, '2027-04-05')).toEqual([78]);
    expect(papersDueOnDate(papers, '2027-05-28')).toEqual([]);
  });
  it('returns nothing between seasons', () => {
    expect(papersDueOnDate(papers, '2026-08-15')).toEqual([]);
  });
  it('absorbs Feb 29 into Feb 28 in non-leap years', () => {
    const fake = [{ ...papers[0], number: 99, publicationDate: '1788-02-29' }];
    expect(papersDueOnDate(fake, '2027-02-28')).toEqual([99]); // 2027 is not a leap year
    expect(papersDueOnDate(fake, '2028-02-28')).toEqual([]);   // 2028 is: Feb 29 exists
    expect(papersDueOnDate(fake, '2028-02-29')).toEqual([99]);
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

describe('weeklyPaperDue', () => {
  const base = { progress_index: 0, send_dow: 6, confirmed_at: '2026-07-16T09:00:00Z' };
  it('sends the next paper on the send day when confirmation was an earlier day', () => {
    expect(weeklyPaperDue({ ...base }, '2026-07-18')).toBe(1); // Thu confirm → Sat send
    expect(weeklyPaperDue({ ...base, confirmed_at: '2026-07-17T22:00:00Z' }, '2026-07-18')).toBe(1); // Fri night → Sat
  });
  it('waits a week when confirmation lands on the send day itself', () => {
    expect(weeklyPaperDue({ ...base, confirmed_at: '2026-07-18T05:00:00Z' }, '2026-07-18')).toBeNull();
  });
  it('honors a non-Saturday send day', () => {
    expect(weeklyPaperDue({ ...base, send_dow: 2 }, '2026-07-21')).toBe(1); // Tuesday
    expect(weeklyPaperDue({ ...base, send_dow: 2 }, '2026-07-18')).toBeNull();
  });
  it('does nothing off the send day', () => {
    expect(weeklyPaperDue({ ...base }, '2026-07-19')).toBeNull();
  });
  it('advances through the course and stops at 85', () => {
    expect(weeklyPaperDue({ ...base, progress_index: 23 }, '2026-07-18')).toBe(24);
    expect(weeklyPaperDue({ ...base, progress_index: 85 }, '2026-07-18')).toBeNull();
  });
  it('never runs for unconfirmed subscribers', () => {
    expect(weeklyPaperDue({ ...base, confirmed_at: null }, '2026-07-18')).toBeNull();
  });
});
