import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('paper pages', () => {
  it('pre-renders the complete reading experience for Paper No. 1', async () => {
    const html = await readFile(new URL('../dist/papers/1/index.html', import.meta.url), 'utf8');

    expect(html).toContain('Federalist No. 1');
    expect(html).toContain('General Introduction');
    expect(html).toContain('src="/masthead-independent-journal.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('THE FEDERALIST.');
    expect(html).toContain('No. I.');
    expect(html).toContain('PUBLIUS');
    expect(html).toContain('For the Independent Journal. Saturday, October 27, 1787');
    expect(html).toContain('AFTER an unequivocal experience');
    expect(html).toContain('In a nutshell');
    expect(html).toContain('Talk it over');
    expect(html).toContain('data-paper-wear="1"');
    expect(html).toContain('href="/papers/2/"');
  });

  it('pre-renders all 85 numbered paper routes', async () => {
    const html = await readFile(new URL('../dist/papers/85/index.html', import.meta.url), 'utf8');

    expect(html).toContain('No. LXXXV.');
    expect(html).toContain('New-York · First collected May 28, 1788');
  });
});
