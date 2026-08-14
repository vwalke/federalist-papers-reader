// tests/email-content.test.ts
import { describe, expect, it } from 'vitest';
import { parsePaperFile, parseEssayFile, buildExport } from '../scripts/generate-email-content.mjs';

const PAPER_SAMPLE = `---
number: 1
title: "General Introduction"
publicationDate: "1787-10-27"
publicationDateLabel: "For the Independent Journal. Saturday, October 27, 1787"
recipient: "To the People of the State of New York."
nutshell: "Hamilton opens by naming the stakes."
talkItOver: "What would a fair hearing take?"
---

AFTER an unequivocal experience, first paragraph.

Second paragraph of the essay.

Third paragraph must not appear.`;

const ESSAY_SAMPLE = `---
series: "Brutus"
seriesNumber: 1
title: "Against the Consolidated Republic"
publicationDate: "1787-10-18"
publicationDateLabel: "For the New-York Journal. Thursday, October 18, 1787"
recipient: "To the Citizens of the State of New-York."
nutshell: "Brutus opens the opposition's case."
talkItOver: "Does size still shape trust?"
---

When the public is called to investigate, first paragraph.

Second paragraph of the essay.

Third paragraph must not appear.`;

describe('parsePaperFile', () => {
  it('extracts frontmatter fields and the first two paragraphs', () => {
    const paper = parsePaperFile(PAPER_SAMPLE);
    expect(paper.kind).toBe('paper');
    expect(paper.id).toBe(1);
    expect(paper.number).toBe(1);
    expect(paper.title).toBe('General Introduction');
    expect(paper.publicationDate).toBe('1787-10-27');
    expect(paper.datelineLabel).toContain('Independent Journal');
    expect(paper.recipient).toBe('To the People of the State of New York.');
    expect(paper.nutshell).toContain('stakes');
    expect(paper.talkItOver).toContain('fair hearing');
    expect(paper.excerptParagraphs).toEqual([
      'AFTER an unequivocal experience, first paragraph.',
      'Second paragraph of the essay.'
    ]);
  });
});

describe('parseEssayFile', () => {
  it('maps an essay into the shared id space with its Journal identity', () => {
    const essay = parseEssayFile(ESSAY_SAMPLE);
    expect(essay.kind).toBe('essay');
    expect(essay.id).toBe(101);
    expect(essay.series).toBe('Brutus');
    expect(essay.seriesNumber).toBe(1);
    expect(essay.displayName).toBe('Brutus No. I');
    expect(essay.slug).toBe('brutus-1');
    expect(essay.datelineLabel).toContain('New-York Journal');
    expect(essay.recipient).toContain('Citizens of the State of New-York');
    expect(essay.excerptParagraphs).toEqual([
      'When the public is called to investigate, first paragraph.',
      'Second paragraph of the essay.'
    ]);
  });

  it('bases Cato ids at 150 and renders roman numerals', () => {
    const cato = parseEssayFile(ESSAY_SAMPLE.replace('"Brutus"', '"Cato"').replace('seriesNumber: 1', 'seriesNumber: 4'));
    expect(cato.id).toBe(154);
    expect(cato.displayName).toBe('Cato No. IV');
    expect(cato.slug).toBe('cato-4');
  });
});

describe('buildExport', () => {
  const paper = parsePaperFile(PAPER_SAMPLE);
  const essay = parseEssayFile(ESSAY_SAMPLE);

  it('merges papers and essays by publication date', () => {
    const { items, sequence } = buildExport([paper], [essay]);
    expect(items.map((item: { id: number }) => item.id)).toEqual([101, 1]);
    expect(sequence).toEqual([101, 1]);
  });

  it('breaks date ties with papers before essays, then by id', () => {
    const sameDayEssay = { ...essay, publicationDate: paper.publicationDate };
    const secondPaper = { ...paper, id: 2, number: 2 };
    const { sequence } = buildExport([secondPaper, paper], [sameDayEssay]);
    expect(sequence).toEqual([1, 2, 101]);
  });
});
