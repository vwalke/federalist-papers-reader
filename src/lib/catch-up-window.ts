// The "not too late" line and the As It Happened notice: both shown only
// while a late joiner may still ask for catch-up, judged on the Eastern
// calendar in the browser so the static pages never go stale. The season
// rules themselves live in the Worker's season.ts; this only phrases them.
import {
  CATCH_UP_LAST_DAY,
  SEASON_OPENS,
  catchUpOpen,
  easternToday,
  effectiveMonthDay,
  monthDayLabel,
  numberWord,
  seasonOpens,
  signupCatchUpBehind,
  type DatedItem
} from '../../workers/post/src/season';

/** Anniversaries a late joiner could still catch up on: opening day through the cut-off. */
export function catchUpMonthDays(items: ReadonlyArray<DatedItem>): string[] {
  return items
    .map(effectiveMonthDay)
    .filter((day) => day >= SEASON_OPENS && day <= CATCH_UP_LAST_DAY)
    .sort();
}

/** True from opening day through the catch-up cut-off, in New York. */
export function catchUpWindowOpen(now: Date = new Date()): boolean {
  return catchUpOpen(easternToday(now));
}

/**
 * The line telling a late visitor they can still join, with the live count
 * when there is one. Before the first run on opening day nothing has been
 * printed yet, so the count is left out.
 */
export function notTooLateLine(monthDays: ReadonlyArray<string>, now: Date = new Date()): string {
  const opened = monthDayLabel(seasonOpens(easternToday(now)));
  const behind = signupCatchUpBehind(monthDays, now);
  const catchUp = behind > 0
    ? `we’ll catch you up on the ${numberWord(behind)} already printed`
    : 'we’ll catch you up';
  return `Missed ${opened}? It isn’t too late. Join As It Happened and ${catchUp}, one extra paper each morning.`;
}

/**
 * Reveals every `[data-catch-up-window]` element while the window is open;
 * outside it they stay hidden as rendered. An element carrying `data-days`
 * is the "not too late" line and takes the live wording.
 */
export function revealInCatchUpWindow(root: ParentNode, now: Date = new Date()): void {
  if (!catchUpWindowOpen(now)) return;
  for (const element of root.querySelectorAll<HTMLElement>('[data-catch-up-window]')) {
    if (element.dataset.days) element.textContent = notTooLateLine(JSON.parse(element.dataset.days), now);
    element.hidden = false;
  }
}
