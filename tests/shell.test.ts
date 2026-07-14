import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('static site shell', () => {
  it('renders the skip link, main landmark, masthead, and viewport metadata', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('The Independent Journal');
    expect(html).toContain('viewport-fit=cover');
  });
});
