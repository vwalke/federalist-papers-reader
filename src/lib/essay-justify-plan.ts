/**
 * Eligibility planning for Gazette justification, kept free of browser
 * imports so it can be unit-tested in isolation.
 *
 * As of justif 0.6.0 the engine measures a paragraph fragmented across a
 * CSS multicolumn break against its individual column width (and keeps a
 * fragmented drop cap in native layout on its own), so straddlers no
 * longer need excluding here. Every essay paragraph is eligible except
 * the PUBLIUS signature, which keeps its end alignment, and a paragraph
 * already enhanced by a previous pass through this layout.
 */

export interface ParagraphInfo {
  /** Position within .essay-body's direct <p> children. Index 0 is the
   * drop-cap opener, enhanced since justif 0.5.1. */
  index: number;
  /** The PUBLIUS signature line keeps its text-align: end. */
  isSignature: boolean;
  /** Already enhanced by an earlier pass this layout. */
  enhanced: boolean;
}

/** Indexes of paragraphs justif may safely enhance this pass. */
export function selectJustifiable(paragraphs: readonly ParagraphInfo[]): number[] {
  return paragraphs
    .filter((p) => !p.isSignature && !p.enhanced)
    .map((p) => p.index);
}
