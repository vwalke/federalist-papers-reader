import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('static site shell', () => {
  it('renders the skip link, main landmark, masthead, and viewport metadata', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(html).toContain('href="#main-content"');
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('src="/masthead-independent-journal.svg"');
    expect(html).toContain('viewport-fit=cover');
  });

  it('owns analytics in the shared layout and omits the beacon without configuration', async () => {
    const layout = await readFile(
      new URL('../src/layouts/BaseLayout.astro', import.meta.url),
      'utf8',
    );
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

    expect(layout).toContain("import Analytics from '../components/Analytics.astro';");
    expect(layout).toContain('<Analytics />');
    expect(html).not.toContain('static.cloudflareinsights.com/beacon.min.js');
    expect(html).not.toContain('data-cf-beacon');
  });
});
