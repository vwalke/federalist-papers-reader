import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('paper pages', () => {
  it('pre-renders an anonymous essay followed by an attributed companion', async () => {
    const html = await readFile(new URL('../dist/papers/1/index.html', import.meta.url), 'utf8');

    expect(html).toContain('Federalist No. 1');
    expect(html).toContain('General Introduction');
    expect(html).toContain('src="/masthead-independent-journal.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('class="essay-flow"');
    expect(html).toContain('THE FEDERALIST.');
    expect(html).toContain('No. I.');
    expect(html).toContain('class="essay-heading__byline">PUBLIUS</p>');
    expect(html).not.toContain('class="essay-heading__author"');
    expect(html).not.toContain('class="essay-heading__publication"');
    expect(html).not.toContain('For the Independent Journal. Saturday, October 27, 1787');
    expect(html).toContain('AFTER an unequivocal experience');
    expect(html).toContain('class="period-spelling"');
    expect(html).toContain('data-modern="federal"');
    expect(html).toContain('data-gazette="fœderal"');
    expect(html).toContain('aria-label="federal"');
    expect(html).toContain('>fœderal</span>');
    expect(html).toContain('id="companion-heading"');
    expect(html).toContain('Reading companion');
    expect(html).not.toContain('In a nutshell');
    expect(html).toContain('class="commentary__attribution">Essay by Alexander Hamilton.</p>');
    expect(html).toContain('Talk it over');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Reading style"');
    expect(html).not.toContain('>View</span>');
    expect(html).toContain('data-paper-wear="1"');
    expect(html).toContain('href="/papers/2/"');
  });

  it('renders disputed attribution without duplicated qualification', async () => {
    const html = await readFile(new URL('../dist/papers/49/index.html', import.meta.url), 'utf8');

    expect(html).toContain('Commonly attributed to James Madison; authorship disputed.');
    expect(html).not.toContain('James Madison (attribution disputed); authorship disputed.');
  });

  it('pre-renders all 85 numbered paper routes', async () => {
    const html = await readFile(new URL('../dist/papers/85/index.html', import.meta.url), 'utf8');

    expect(html).toContain('No. LXXXV.');
    expect(html).toContain('New-York · First collected May 28, 1788');
  });
});
