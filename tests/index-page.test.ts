import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('complete paper index', () => {
  it('promotes the ReadPublius feed only at the top of the homepage sheet', async () => {
    const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const paper = await readFile(new URL('../dist/papers/1/index.html', import.meta.url), 'utf8');
    const about = await readFile(new URL('../dist/about/index.html', import.meta.url), 'utf8');
    const homeText = home.replace(/\s+/g, ' ');

    expect(home).toContain('class="readpublius-notice"');
    expect(homeText).toContain('From the public square');
    expect(homeText).toContain(
      'Ongoing commentary on the Federalist Papers, dispatches from the 1787 Constitutional Convention, and glimpses into the newspapers and history behind the debate.',
    );
    expect(home).toContain('href="https://x.com/ReadPublius"');
    expect(home).toContain('data-readpublius-link');
    expect(homeText).toContain('Follow @ReadPublius on X');
    expect(home).toContain('aria-label="Dismiss ReadPublius notice"');
    expect(home.indexOf('class="readpublius-notice"')).toBeLessThan(
      home.indexOf('class="gazette-masthead"'),
    );
    expect(paper).not.toContain('data-readpublius-notice');
    expect(about).not.toContain('data-readpublius-notice');
  });

  it('renders all papers before JavaScript enhancement', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const rows = html.match(/data-index-paper=/g) ?? [];

    expect(rows).toHaveLength(85);
    expect(html.match(/data-index-status\s+aria-pressed="false"/g) ?? []).toHaveLength(85);
    expect(html).toContain('aria-label="Mark No. 85 as read"');
    expect(html).toContain('Search all papers');
    expect(html).toContain('Sort by');
    expect(html).toContain('Alexander Hamilton');
    expect(html).toContain('James Madison');
    expect(html).toContain('John Jay');
    expect(html).toContain('aria-live="polite"');
  });
});
