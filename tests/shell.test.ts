import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('static site shell', () => {
  it('uses concise Federalist Papers titles for the general and About pages', async () => {
    const home = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const about = await readFile(new URL('../dist/about/index.html', import.meta.url), 'utf8');

    expect(home).toContain('<title>The Federalist Papers — Full Text and Summaries of All 85 Essays</title>');
    expect(about).toContain('<title>About this edition - The Federalist Papers</title>');
  });

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

  it('publishes an installable Apple Home Screen shell with standalone safe areas', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    const css = await readFile(
      new URL('../src/styles/global.css', import.meta.url),
      'utf8',
    );

    expect(html).toContain('rel="manifest" href="/site.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Federalist"');
    expect(html).toContain(
      'name="apple-mobile-web-app-status-bar-style" content="black-translucent"',
    );
    expect(css).toContain('@media (display-mode: standalone)');
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('links the guides from the header nav and footer', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    expect(html).toContain('href="/guides/where-to-start/">Start here</a>');
    expect(html).toContain('href="/guides/">Guides</a>');
  });

  it('links the X account from the footer nav', async () => {
    const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    expect(html).toContain('href="https://x.com/ReadPublius">@ReadPublius on X</a>');
  });
});
