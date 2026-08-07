import { describe, expect, it } from 'vitest';

import { validateAntifederalistDirectory } from '../scripts/validate-content.mjs';

const directory = new URL('../src/content/antifederalist/', import.meta.url);

describe('antifederalist content', () => {
  it('holds exactly the eight planned essays with complete companions', async () => {
    const report = await validateAntifederalistDirectory(directory);
    expect(report.count).toBe(8);
    expect(report.slugs).toEqual([
      'brutus-1', 'brutus-2', 'brutus-4', 'brutus-6',
      'brutus-10', 'brutus-12', 'brutus-15', 'cato-4'
    ]);
    expect(report.missingFields).toEqual([]);
    expect(report.emptyBodies).toEqual([]);
    expect(report.duplicateSlugs).toEqual([]);
    expect(report.summariesOver18Words).toEqual([]);
    expect(report.commentaryOutsideTarget).toEqual([]);
    expect(report.datesOutsideRange).toEqual([]);
    expect(report.badReplies).toEqual([]);
    expect(report.missingSignatures).toEqual([]);
    expect(report.unquotedDates).toEqual([]);
  });
});
