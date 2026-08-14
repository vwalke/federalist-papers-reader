import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('complete paper index', () => {
  it('opens directly with the masthead and complete paper index', async () => {
    const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(home).not.toContain('readpublius-notice');
    expect(home).not.toContain('https://x.com/');
    expect(home).toContain('class="gazette-masthead"');
    expect(home.match(/data-index-paper=/g) ?? []).toHaveLength(85);
  });

  it('renders all papers before JavaScript enhancement', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const rows = html.match(/data-index-paper=/g) ?? [];

    expect(rows).toHaveLength(85);
    expect(html.match(/data-index-status\s+aria-pressed="false"/g) ?? []).toHaveLength(93);
    expect(html).toContain('aria-label="Mark No. 85 as read"');
    expect(html).toContain('Search all papers');
    expect(html).toContain('Sort by');
    expect(html).toContain('Alexander Hamilton');
    expect(html).toContain('James Madison');
    expect(html).toContain('John Jay');
    expect(html).toContain('aria-live="polite"');
  });

  it('carries the eight Journal essays as hidden rows for the combined view', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(html.match(/data-index-essay=/g) ?? []).toHaveLength(8);
    expect(html.match(/data-index-kind="essay"/g) ?? []).toHaveLength(8);
    expect(html).toContain('aria-label="Mark Brutus No. I as read"');
    expect(html).toContain('aria-label="Mark Cato No. IV as read"');
    expect(html).toContain('href="/antifederalist/brutus-1/"');

    // The switch ships with the ledger; the default view stays the eighty-five.
    expect(html).toContain('The eighty-five');
    expect(html).toContain('With the opposition');
    expect(html).toContain('Showing all 85 papers');
  });

  it('features the opposition in the hero instead of a closing aside', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(html).toContain('eight Anti-Federalist essays');
    expect(html).not.toContain('index-opposition-note');
  });
});
