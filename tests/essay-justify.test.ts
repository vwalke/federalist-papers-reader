import { describe, expect, it } from 'vitest';

import { selectJustifiable, type ParagraphInfo } from '../src/lib/essay-justify-plan';

function paragraph(overrides: Partial<ParagraphInfo> & { index: number }): ParagraphInfo {
  return { isSignature: false, enhanced: false, ...overrides };
}

describe('selectJustifiable', () => {
  it('enhances every essay paragraph, drop-cap opener included', () => {
    const paras = [paragraph({ index: 0 }), paragraph({ index: 1 })];
    expect(selectJustifiable(paras)).toEqual([0, 1]);
  });

  it('enhances a column-straddling paragraph (justif 0.6 measures it per column)', () => {
    const paras = [paragraph({ index: 0 }), paragraph({ index: 1 }), paragraph({ index: 2 })];
    expect(selectJustifiable(paras)).toEqual([0, 1, 2]);
  });

  it('excludes the PUBLIUS signature', () => {
    const paras = [
      paragraph({ index: 0 }),
      paragraph({ index: 1 }),
      paragraph({ index: 2, isSignature: true }),
    ];
    expect(selectJustifiable(paras)).toEqual([0, 1]);
  });

  it('excludes paragraphs enhanced by an earlier pass', () => {
    const paras = [
      paragraph({ index: 0, enhanced: true }),
      paragraph({ index: 1, enhanced: true }),
      paragraph({ index: 2 }),
    ];
    expect(selectJustifiable(paras)).toEqual([2]);
  });

  it('returns no indexes for an empty essay', () => {
    expect(selectJustifiable([])).toEqual([]);
  });
});
