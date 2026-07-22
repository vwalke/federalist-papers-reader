import { describe, expect, it } from 'vitest';

import { selectJustifiable, type ParagraphInfo } from '../src/lib/essay-justify-plan';

function paragraph(overrides: Partial<ParagraphInfo> & { index: number }): ParagraphInfo {
  return { isSignature: false, fragmentCount: 1, enhanced: false, ...overrides };
}

describe('selectJustifiable', () => {
  it('excludes the drop-cap opener', () => {
    const paras = [paragraph({ index: 0 }), paragraph({ index: 1 })];
    expect(selectJustifiable(paras)).toEqual([1]);
  });

  it('excludes the PUBLIUS signature', () => {
    const paras = [
      paragraph({ index: 0 }),
      paragraph({ index: 1 }),
      paragraph({ index: 2, isSignature: true }),
    ];
    expect(selectJustifiable(paras)).toEqual([1]);
  });

  it('excludes paragraphs fragmented across a column break', () => {
    const paras = [
      paragraph({ index: 0 }),
      paragraph({ index: 1, fragmentCount: 2 }),
      paragraph({ index: 2 }),
    ];
    expect(selectJustifiable(paras)).toEqual([2]);
  });

  it('excludes paragraphs enhanced by an earlier pass', () => {
    const paras = [
      paragraph({ index: 0 }),
      paragraph({ index: 1, enhanced: true }),
      paragraph({ index: 2 }),
    ];
    expect(selectJustifiable(paras)).toEqual([2]);
  });

  it('selects a formerly straddling paragraph once it fits one column', () => {
    const before = [
      paragraph({ index: 0 }),
      paragraph({ index: 1, fragmentCount: 2 }),
      paragraph({ index: 2, enhanced: true }),
    ];
    expect(selectJustifiable(before)).toEqual([]);
    const secondPass = [
      paragraph({ index: 0 }),
      paragraph({ index: 1, fragmentCount: 1 }),
      paragraph({ index: 2, enhanced: true }),
    ];
    expect(selectJustifiable(secondPass)).toEqual([1]);
  });

  it('returns no indexes for an empty essay', () => {
    expect(selectJustifiable([])).toEqual([]);
  });
});
