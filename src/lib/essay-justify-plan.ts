/**
 * Eligibility planning for Gazette justification, kept free of browser
 * imports so it can be unit-tested in isolation.
 *
 * justif mis-measures two shapes of paragraph (see
 * docs/superpowers/specs/2026-07-22-gazette-justif-justification-design.md):
 * the drop-cap opener (floated ::first-letter) and paragraphs fragmented
 * across a CSS multicol column break. Both keep native CSS justification.
 */

export interface ParagraphInfo {
  /** Position within .essay-body's direct <p> children. */
  index: number;
  /** The PUBLIUS signature line keeps its text-align: end. */
  isSignature: boolean;
  /** getClientRects().length — more than one box means a column break. */
  fragmentCount: number;
  /** Already enhanced by an earlier pass this layout. */
  enhanced: boolean;
}

/** Indexes of paragraphs justif may safely enhance this pass. */
export function selectJustifiable(paragraphs: readonly ParagraphInfo[]): number[] {
  return paragraphs
    .filter(
      (p) => p.index > 0 && !p.isSignature && !p.enhanced && p.fragmentCount <= 1
    )
    .map((p) => p.index);
}
