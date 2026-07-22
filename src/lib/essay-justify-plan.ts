/**
 * Eligibility planning for Gazette justification, kept free of browser
 * imports so it can be unit-tested in isolation.
 *
 * justif mis-measures paragraphs fragmented across a CSS multicol column
 * break (see
 * docs/superpowers/specs/2026-07-22-gazette-justif-justification-design.md);
 * those keep native CSS justification. The drop-cap opener was excluded
 * too until justif 0.5.0 added floated ::first-letter support.
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
    .filter((p) => !p.isSignature && !p.enhanced && p.fragmentCount <= 1)
    .map((p) => p.index);
}
