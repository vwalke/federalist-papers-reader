import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('complete paper index', () => {
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
