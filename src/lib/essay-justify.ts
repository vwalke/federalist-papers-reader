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
import { justify, type JustifyController } from 'justif';
import { hyphenateEnUS } from 'justif/hyphenate/en-us';

import { selectJustifiable, type ParagraphInfo } from './essay-justify-plan';

/** A second pass catches paragraphs that stop straddling a column break
 * after the first pass shortens the flow. More passes buy nothing. */
const PASSES = 2;
const REFRESH_DEBOUNCE_MS = 150;

export function initEssayJustify(): void {
  const flowEl = document.querySelector<HTMLElement>('.essay-flow');
  const bodyEl = document.querySelector<HTMLElement>('.essay-body');
  if (!flowEl || !bodyEl || typeof ResizeObserver === 'undefined') return;
  const flow: HTMLElement = flowEl;
  const essayBody: HTMLElement = bodyEl;

  let generation = 0;
  let controllers: JustifyController[] = [];
  let debounce: number | undefined;

  const inGazette = () => document.documentElement.dataset.readingMode !== 'reader';

  function describe(paragraphs: readonly HTMLElement[]): ParagraphInfo[] {
    return paragraphs.map((p, index) => ({
      index,
      isSignature: p.classList.contains('essay-signature'),
      fragmentCount: p.getClientRects().length,
      enhanced: p.hasAttribute('data-justif'),
    }));
  }

  function clear(): void {
    generation += 1;
    for (const controller of controllers) controller.destroy();
    controllers = [];
  }

  async function refresh(): Promise<void> {
    clear();
    if (!inGazette()) return;
    const gen = generation;
    await document.fonts.ready;
    if (gen !== generation) return;
    for (let pass = 0; pass < PASSES; pass += 1) {
      const paragraphs = [...essayBody.querySelectorAll<HTMLElement>(':scope > p')];
      const eligible = selectJustifiable(describe(paragraphs)).map((i) => paragraphs[i]);
      if (eligible.length === 0) break;
      const controller = justify(eligible, {
        hyphenate: hyphenateEnUS,
        // This module re-plans fragmentation on every width change; justif's
        // own observer would re-layout straddling paragraphs it mis-measures.
        observeResize: false,
      });
      controllers.push(controller);
      await controller.ready;
      if (gen !== generation) return;
    }
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
