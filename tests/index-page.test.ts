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
    expect(html).toContain('Alexander Hamilton');
    expect(html).toContain('James Madison');
    expect(html).toContain('John Jay');
    expect(html).toContain('aria-live="polite"');
  });

  it('runs the ledger in publication order with no sort control', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    // One order for every reader: the sort select is gone.
    expect(html).not.toContain('name="sort"');
    expect(html).not.toContain('Sort by');
    expect(html).toContain('the order they reached readers');

    // Chronology holds before JavaScript: No. 1 opens; No. 29 sits after
    // No. 36 at its true date; the bound-edition papers close the run.
    const order = [...html.matchAll(/data-index-paper="(\d+)"/g)].map((match) => Number(match[1]));
    expect(order).toHaveLength(85);
    expect(order[0]).toBe(1);
    expect(order.indexOf(29)).toBeGreaterThan(order.indexOf(36));
    expect(order[order.length - 1]).toBe(85);
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
