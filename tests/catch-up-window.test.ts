// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import debate from '../workers/post/content/debate.json';
import type { DatedItem } from '../workers/post/src/season';
import {
  catchUpMonthDays,
  catchUpWindowOpen,
  notTooLateLine,
  revealInCatchUpWindow
} from '../src/lib/catch-up-window';

const days = catchUpMonthDays(debate.items as DatedItem[]);

// Instants either side of the window's edges, in New York: EDT (UTC-4) on
// October 17 and 18, EST (UTC-5) on November 21 and 22.
const OCT_17_NOON_ET = new Date('2026-10-17T16:00:00Z');
const OCT_17_LATE_ET = new Date('2026-10-18T03:59:00Z');
const OCT_18_MIDNIGHT_ET = new Date('2026-10-18T04:01:00Z');
const OCT_18_AFTER_RUN_ET = new Date('2026-10-18T12:00:00Z');
const NOV_21_NOON_ET = new Date('2026-11-21T17:00:00Z');
const NOV_21_LATE_ET = new Date('2026-11-22T04:30:00Z');
const NOV_22_MIDNIGHT_ET = new Date('2026-11-22T05:01:00Z');
const NOV_22_NOON_ET = new Date('2026-11-22T17:00:00Z');

const inside = [OCT_18_MIDNIGHT_ET, OCT_18_AFTER_RUN_ET, NOV_21_NOON_ET, NOV_21_LATE_ET];
const outside = [OCT_17_NOON_ET, OCT_17_LATE_ET, NOV_22_MIDNIGHT_ET, NOV_22_NOON_ET];

function page(): Document {
  return new DOMParser().parseFromString(`
    <aside data-site-notice data-catch-up-window hidden>As It Happened is underway.</aside>
    <p data-line data-catch-up-window data-days='${JSON.stringify(days)}' hidden>Static line.</p>
  `, 'text/html');
}

describe('the catch-up window', () => {
  it('is open from October 18 through November 21, Eastern', () => {
    for (const now of inside) expect(catchUpWindowOpen(now), now.toISOString()).toBe(true);
    for (const now of outside) expect(catchUpWindowOpen(now), now.toISOString()).toBe(false);
    expect(catchUpWindowOpen(new Date('2027-03-01T17:00:00Z'))).toBe(false);
  });

  it('holds the late evening of November 21 in New York, already November 22 in UTC', () => {
    expect(NOV_21_LATE_ET.toISOString().slice(0, 10)).toBe('2026-11-22');
    expect(catchUpWindowOpen(NOV_21_LATE_ET)).toBe(true);
  });
});

describe('the "not too late" line', () => {
  it('leaves the count out before anything has been printed', () => {
    expect(notTooLateLine(days, OCT_18_MIDNIGHT_ET)).toBe(
      'Missed October 18? It isn’t too late. Join As It Happened and we’ll catch you up, one extra paper each morning.'
    );
  });

  it('gives the live count once papers are out', () => {
    expect(notTooLateLine(days, OCT_18_AFTER_RUN_ET)).toBe(
      'Missed October 18? It isn’t too late. Join As It Happened and we’ll catch you up on the one already printed, one extra paper each morning.'
    );
    expect(notTooLateLine(days, NOV_21_LATE_ET)).toContain('on the twelve already printed');
  });
});

describe('revealInCatchUpWindow', () => {
  it('shows the line and the notice inside the window', () => {
    for (const now of inside) {
      const doc = page();
      revealInCatchUpWindow(doc, now);
      const line = doc.querySelector<HTMLElement>('[data-line]')!;
      expect(line.hidden, now.toISOString()).toBe(false);
      expect(line.textContent).toBe(notTooLateLine(days, now));
      expect(doc.querySelector<HTMLElement>('[data-site-notice]')!.hidden).toBe(false);
    }
  });

  it('leaves both hidden, as rendered, outside the window', () => {
    for (const now of outside) {
      const doc = page();
      revealInCatchUpWindow(doc, now);
      const line = doc.querySelector<HTMLElement>('[data-line]')!;
      expect(line.hidden, now.toISOString()).toBe(true);
      expect(line.textContent).toBe('Static line.');
      expect(doc.querySelector<HTMLElement>('[data-site-notice]')!.hidden).toBe(true);
    }
  });
});
