/**
 * Eligibility planning for Gazette justification, kept free of browser
 * imports so it can be unit-tested in isolation.
 *
 * justif mis-measures paragraphs fragmented across a CSS multicol column
 * break, so those keep native CSS justification. The drop-cap opener is
 * enhanced again as of justif 0.5.1, which fixed the two residual
 * drop-cap bugs (hyphens: auto defeating the float, and float-boundary
 * hyphens rendering below the float — lyallcooper/justif#4 and #5). See
 * docs/superpowers/specs/2026-07-22-gazette-justif-justification-design.md.
 */

export interface ParagraphInfo {
  /** Position within .essay-body's direct <p> children. Index 0 is the
   * drop-cap opener, enhanced again as of justif 0.5.1. */
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
