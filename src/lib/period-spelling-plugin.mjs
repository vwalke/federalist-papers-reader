const SKIPPED_TAGS = new Set(['a', 'code', 'pre', 'script', 'style']);
const EXACT_FEDERAL = /^federal$/i;

/** @typedef {{ type: 'text', value: string }} TextNode */
/** @typedef {{
 *   type: 'element',
 *   tagName: 'span',
 *   properties: {
 *     className: string[],
 *     'data-modern': string,
 *     'data-gazette': string,
 *     'aria-label': string
 *   },
 *   children: TextNode[]
 * }} PeriodSpellingNode */

function toGazetteSpelling(word) {
  if (word === word.toUpperCase()) return 'FŒDERAL';
  if (word[0] === word[0].toUpperCase()) return 'Fœderal';
  return 'fœderal';
}

/**
 * @param {string} value
 * @returns {(TextNode | PeriodSpellingNode)[]}
 */
export function periodizeText(value) {
  return value.split(/\b(federal)\b/gi).filter(Boolean).map((part) => {
    if (!EXACT_FEDERAL.test(part)) return { type: 'text', value: part };

    const gazette = toGazetteSpelling(part);
    return {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['period-spelling'],
        'data-modern': part,
        'data-gazette': gazette,
        'aria-label': part
      },
      children: [{ type: 'text', value: gazette }]
    };
  });
}

function hasSkippedAncestor(node, context) {
  let parent = context.parent(node);
  while (parent) {
    if (parent.type === 'element' && SKIPPED_TAGS.has(parent.tagName)) return true;
    parent = context.parent(parent);
  }
  return false;
}

export const periodSpellingPlugin = {
  name: 'period-spelling',
  text(node, context) {
    if (hasSkippedAncestor(node, context) || !/\bfederal\b/i.test(node.value)) return;

    context.insertBefore(node, periodizeText(node.value));
    context.removeNode(node);
  }
};
