import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('About this edition', () => {
  it('tells the family reading story and credits its historical inspirations', async () => {
    const html = await readFile(new URL('../dist/about/index.html', import.meta.url), 'utf8');

    expect(html).toContain('This edition began with a gift for my mom.');
    expect(html).toContain('href="https://www.letterjoy.co/pages/federalist-papers"');
    expect(html).toContain('LetterJoy’s Federalist Papers series');
    expect(html).toContain('sixth-great-uncle');
    expect(html).toContain('my mom’s fifth-great-uncle');
    expect(html).toContain('the only Secretary of the Continental Congress');
    expect(html).toContain('first printed Declaration of Independence');
    expect(html).toContain('attesting it as Secretary');
    expect(html).toContain('href="https://www.archives.gov/milestone-documents/declaration-of-independence"');
  });
});
