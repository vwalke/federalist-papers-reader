// tests/email-content.test.ts
import { describe, expect, it } from 'vitest';
import { parsePaperFile, buildExport } from '../scripts/generate-email-content.mjs';

const SAMPLE = `---
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

describe('parsePaperFile', () => {
  it('extracts frontmatter fields and the first two paragraphs', () => {
    const paper = parsePaperFile(SAMPLE);
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

describe('buildExport', () => {
  it('sorts papers by number', () => {
    const a = parsePaperFile(SAMPLE);
    const b = { ...a, number: 2 };
    expect(buildExport([b, a]).map((p) => p.number)).toEqual([1, 2]);
  });
});
