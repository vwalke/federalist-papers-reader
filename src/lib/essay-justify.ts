/**
 * Gazette justification: enhances essay paragraphs with justif's
 * Knuth–Plass line breaker so the facsimile columns set flush, the way
 * The Independent Journal composed them in 1787.
 *
 * The CSS baseline (text-align: justify in Gazette mode) is the fallback
 * for no-JS visitors and for the paragraphs planned out by
 * selectJustifiable. Reader mode never justifies: uniform word spacing
 * reads better, so switching modes tears the enhancement down.
 */
import { justify, unjustify, type JustifyController } from 'justif';
import { hyphenateEnUS } from 'justif/hyphenate/en-us';

import { selectJustifiable, type ParagraphInfo } from './essay-justify-plan';

const REFRESH_DEBOUNCE_MS = 150;

export function initEssayJustify(): void {
  const flowEl = document.querySelector<HTMLElement>('.essay-flow');
  const bodyEl = document.querySelector<HTMLElement>('.essay-body');
  if (!flowEl || !bodyEl || typeof ResizeObserver === 'undefined') return;
  const flow: HTMLElement = flowEl;
  const essayBody: HTMLElement = bodyEl;

  // Idempotence: a second instance (dev HMR, double include) must not
  // fight the first over the same paragraphs.
  if (essayBody.hasAttribute('data-essay-justify')) return;
  essayBody.setAttribute('data-essay-justify', '');

  let generation = 0;
  let controllers: JustifyController[] = [];
  let hyphensSuppressed: HTMLElement[] = [];
  let debounce: number | undefined;

  const inGazette = () => document.documentElement.dataset.readingMode !== 'reader';

  function describe(paragraphs: readonly HTMLElement[]): ParagraphInfo[] {
    return paragraphs.map((p, index) => ({
      index,
      isSignature: p.classList.contains('essay-signature'),
      enhanced: p.hasAttribute('data-justif'),
    }));
  }

  function clear(): void {
    generation += 1;
    for (const controller of controllers) controller.destroy();
    controllers = [];
    // Sweep enhancements this instance does not own (a stale instance,
    // a bfcache restore) so clear() always leaves a pristine baseline.
    const stray = essayBody.querySelectorAll(':scope > p[data-justif]');
    if (stray.length > 0) unjustify(stray);
    for (const p of hyphensSuppressed) p.style.removeProperty('hyphens');
    hyphensSuppressed = [];
  }

  /** Defensive net: justif 0.6 measures each column fragment on its own,
   * so lines should never exceed their fragment, but if one ever does
   * (an unforeseen mis-measure), restore that paragraph to the native
   * justify baseline rather than let it overflow the column. */
  function revertOverflowing(): void {
    const broken = [...essayBody.querySelectorAll<HTMLElement>(':scope > p[data-justif]')].filter(
      (p) => {
        const fragmentWidth = p.getClientRects()[0]?.width ?? p.getBoundingClientRect().width;
        // Hanging punctuation legitimately protrudes ~0.35em past the
        // measure and grows with the text-size slider; a real
        // mis-measure overshoots by half a column or more.
        const tolerance = Number.parseFloat(getComputedStyle(p).fontSize) * 0.6;
        return [...p.querySelectorAll<HTMLElement>('.justif-seg')].some(
          (seg) => seg.getBoundingClientRect().width > fragmentWidth + tolerance
        );
      }
    );
    if (broken.length > 0) unjustify(broken);
  }

  async function refresh(): Promise<void> {
    clear();
    if (!inGazette()) return;
    const gen = generation;
    await document.fonts.ready;
    if (gen !== generation) return;
    const paragraphs = [...essayBody.querySelectorAll<HTMLElement>(':scope > p')];
    const eligible = selectJustifiable(describe(paragraphs)).map((i) => paragraphs[i]);
    if (eligible.length === 0) return;
    // justif brings its own TeX hyphenation; the baseline's hyphens: auto
    // must go first or the drop-cap first line sets at full measure
    // instead of wrapping the float (the isolation for justif#4, fixed in
    // 0.5.1 but cheap to keep as belt-and-braces). clear() restores.
    for (const p of eligible) {
      p.style.hyphens = 'manual';
      hyphensSuppressed.push(p);
    }
    // This module fully rebuilds on every width change (clear + refresh),
    // so justif's own resize observer would only duplicate that work.
    const controller = justify(eligible, { hyphenate: hyphenateEnUS, observeResize: false });
    controllers.push(controller);
    await controller.ready;
    if (gen !== generation) return;
    // Let the settled layout paint before the defensive overflow sweep.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (gen !== generation) return;
    revertOverflowing();
  }

  function scheduleRefresh(): void {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
  }

  // Mode toggle and text-size slider (ReadingToolbar). The toolbar swaps
  // period spellings before dispatching, so measurements see current text.
  document.addEventListener('publius:reading-changed', (event) => {
    const detail = (event as CustomEvent<{ mode?: string }>).detail;
    if (detail?.mode === 'reader') {
      window.clearTimeout(debounce);
      clear();
      return;
    }
    scheduleRefresh();
  });

  // Viewport resizes move column breaks; the slider does not change the
  // flow's width, which is why the toolbar event above exists.
  let lastWidth = flow.getBoundingClientRect().width;
  const observer = new ResizeObserver((entries) => {
    const width = entries[entries.length - 1]?.contentRect.width ?? lastWidth;
    if (Math.abs(width - lastWidth) < 0.5) return;
    lastWidth = width;
    scheduleRefresh();
  });
  observer.observe(flow);

  void refresh();
}
