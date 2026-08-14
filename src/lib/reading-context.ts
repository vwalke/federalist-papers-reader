import debateSequence from '../data/debate-sequence.json';

import { createPreferences } from './preferences';

/**
 * Context-aware prev/next: the reader may have arrived on a paper or essay
 * from a guide's curated list (a journey held in sessionStorage) or be
 * reading the home ledger's "With the opposition" view (a localStorage
 * preference). Either frame replaces the server-rendered numeric/shelf
 * order in the nav. Precedence: guide journey, then debate view, then the
 * server default stands.
 */

export const READING_CONTEXT_KEY = 'publius:reading-context';

/** One stop in a reading sequence. Guide items carry the whole display
 *  string in `label`; debate items render as `label: title`. */
export interface SequenceItem {
  href: string;
  label: string;
  title?: string;
}

export interface GuideReadingContext {
  kind: 'guide';
  /** The guide page's h1, for the "From the guide: …" context line. */
  title: string;
  /** The guide page URL — where the sequence's ends fall back to. */
  home: string;
  items: SequenceItem[];
}

export interface SequenceNeighbors {
  previous: SequenceItem | null;
  next: SequenceItem | null;
}

/** Site URLs are directory-style; comparisons always carry the trailing slash. */
export function normalizePath(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** Neighbors of `href` in `items`, or null when `href` is not in the sequence. */
export function findNeighbors(
  items: readonly SequenceItem[],
  href: string
): SequenceNeighbors | null {
  const current = normalizePath(href);
  const index = items.findIndex((item) => normalizePath(item.href) === current);
  if (index === -1) return null;
  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index < items.length - 1 ? items[index + 1] : null
  };
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readGuideContext(storage: Storage | null): GuideReadingContext | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(READING_CONTEXT_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const context = parsed as Record<string, unknown>;
    if (context.kind !== 'guide') return null;
    if (typeof context.title !== 'string' || typeof context.home !== 'string') return null;
    if (!Array.isArray(context.items) || context.items.length === 0) return null;
    const items: SequenceItem[] = [];
    for (const item of context.items as unknown[]) {
      if (typeof item !== 'object' || item === null) return null;
      const { href, label } = item as Record<string, unknown>;
      // Blank labels would render empty nav titles; treat them as corrupt.
      if (typeof href !== 'string' || typeof label !== 'string' || !label.trim()) return null;
      items.push({ href, label });
    }
    return { kind: 'guide', title: context.title, home: context.home, items };
  } catch {
    return null;
  }
}

export function clearGuideContext(storage: Storage | null): void {
  try {
    storage?.removeItem(READING_CONTEXT_KEY);
  } catch {
    // Best effort: an unclearable context still fails the membership check.
  }
}

/**
 * Called by the guide-page scripts: entry links write the journey on click,
 * so the sequence a reader is following is exactly the list they clicked.
 */
export function rememberGuideJourney(context: Omit<GuideReadingContext, 'kind'>): void {
  try {
    window.sessionStorage.setItem(
      READING_CONTEXT_KEY,
      JSON.stringify({ kind: 'guide', ...context })
    );
  } catch {
    // Journeys are an enhancement; the guide links still navigate.
  }
}

/**
 * Wires a guide page's entry links: clicking one records the whole list —
 * in document order, as rendered — as the reader's journey. The page h1
 * names the journey and the page itself is its home.
 */
export function bindGuideJourney(
  entries: Array<{ anchor: HTMLAnchorElement; label: string }>
): void {
  const heading = document.querySelector('h1');
  const title = heading?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!title || entries.length === 0) return;
  const home = normalizePath(window.location.pathname);
  const items = entries
    .map(({ anchor, label }) => ({
      href: normalizePath(new URL(anchor.href).pathname),
      label: label.replace(/\s+/g, ' ').trim()
    }))
    // A markup refactor that loses an entry's heading must not produce
    // blank nav titles — drop such entries rather than store them.
    .filter((item) => item.label.length > 0);
  if (items.length === 0) return;
  for (const { anchor } of entries) {
    anchor.addEventListener('click', () => rememberGuideJourney({ title, home, items }));
  }
}

interface NavAnchors {
  previous: HTMLAnchorElement;
  next: HTMLAnchorElement;
  contextLine: HTMLElement;
}

function findNavAnchors(): NavAnchors | null {
  const nav = document.querySelector('.essay-navigation');
  if (!nav) return null;
  const previous = nav.querySelector<HTMLAnchorElement>('.essay-navigation__previous');
  const next = nav.querySelector<HTMLAnchorElement>('a[data-continue-control]');
  const contextLine = nav.querySelector<HTMLElement>('[data-nav-context]');
  if (!previous || !next || !contextLine) return null;
  return { previous, next, contextLine };
}

/** The plain-text span beside the kicker label inside a nav cell. */
function titleSpan(anchor: HTMLAnchorElement): HTMLElement | null {
  const spans = anchor.querySelectorAll<HTMLElement>(':scope > span');
  return spans.length > 1 ? spans[spans.length - 1] : null;
}

function labelSpan(anchor: HTMLAnchorElement): HTMLElement | null {
  return anchor.querySelector<HTMLElement>('.essay-navigation__label');
}

function displayText(item: SequenceItem): string {
  return item.title ? `${item.label}: ${item.title}` : item.label;
}

interface SequenceEnds {
  /** Where prev points before the first item and next after the last. */
  homeHref: string;
  homeText: string;
  /** The read-state label for the end-of-sequence Next cell. */
  homeReadLabel: string;
}

function rewriteNav(
  anchors: NavAnchors,
  neighbors: SequenceNeighbors,
  ends: SequenceEnds,
  contextText: string
): void {
  const { previous, next, contextLine } = anchors;

  /* Mutate in place: the mark-read click handler and label machinery are
     bound to these anchors (data-continue-control), and must survive. */
  if (neighbors.previous) {
    previous.href = neighbors.previous.href;
    const label = labelSpan(previous);
    if (label) label.textContent = '← Previous';
    const title = titleSpan(previous);
    if (title) title.textContent = displayText(neighbors.previous);
  } else {
    previous.href = ends.homeHref;
    const label = labelSpan(previous);
    if (label) label.textContent = '← Return';
    const title = titleSpan(previous);
    if (title) title.textContent = ends.homeText;
  }

  if (neighbors.next) {
    next.href = neighbors.next.href;
    next.dataset.unreadLabel = 'Mark read & continue →';
    next.dataset.readLabel = 'Next →';
    const title = titleSpan(next);
    if (title) title.textContent = displayText(neighbors.next);
  } else {
    next.href = ends.homeHref;
    next.dataset.unreadLabel = 'Mark read & finish →';
    next.dataset.readLabel = ends.homeReadLabel;
    const title = titleSpan(next);
    if (title) title.textContent = ends.homeText;
  }

  /* Re-render the Next kicker from the (possibly changed) labels. The page
     script renders it too, from the same dataset, so order does not matter. */
  const storage = ((): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const read = createPreferences(storage).isPaperRead(Number(next.dataset.continueControl));
  const kicker = next.querySelector<HTMLElement>('[data-continue-label]');
  const text = read ? next.dataset.readLabel : next.dataset.unreadLabel;
  if (kicker && text) kicker.textContent = text;

  contextLine.textContent = contextText;
  contextLine.hidden = false;
}

/**
 * Rewrites the prev/next nav on a paper or essay page to follow the
 * reader's context. Call before (or after — it is order-independent) the
 * page's own continue-control wiring.
 */
export function applyReadingContext(): void {
  const anchors = findNavAnchors();
  if (!anchors) return;

  const currentPath = normalizePath(window.location.pathname);
  const session = safeSessionStorage();

  const guide = readGuideContext(session);
  if (guide) {
    const neighbors = findNeighbors(guide.items, currentPath);
    if (neighbors) {
      rewriteNav(
        anchors,
        neighbors,
        {
          homeHref: guide.home,
          homeText: guide.title,
          homeReadLabel: 'Back to the guide →'
        },
        `From the guide: ${guide.title}`
      );
      return;
    }
    /* The reader left the journey: forget it so plain reading resumes. */
    clearGuideContext(session);
  }

  const storage = ((): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  if (createPreferences(storage).getIndexView() !== 'debate') return;

  const neighbors = findNeighbors(debateSequence as SequenceItem[], currentPath);
  if (!neighbors) return;
  rewriteNav(
    anchors,
    neighbors,
    {
      /* The debate frame's home is the combined ledger, not the shelf:
         even Brutus I's prev points at /#all-papers. */
      homeHref: '/#all-papers',
      homeText: 'Return to the index',
      homeReadLabel: 'The full collection →'
    },
    'The whole debate · in publication order'
  );
}
