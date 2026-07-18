import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFile(new URL(`../dist/${p}`, import.meta.url), 'utf8');

describe('guide pages', () => {
  it('builds the index and each guide with a title and canonical', async () => {
    const index = await read('guides/index.html');
    expect(index).toContain('<title>Guides to the Federalist Papers | Federalist Reader</title>');

    const start = await read('guides/where-to-start/index.html');
    expect(start).toContain(
      '<title>Where to Start with the Federalist Papers | Federalist Reader</title>'
    );
    expect(start).toContain('rel="canonical" href="https://federalistreader.org/guides/where-to-start/"');
  });

  it('lists curated papers with resolved topics and links', async () => {
    const start = await read('guides/where-to-start/index.html');
    expect(start).toContain('href="/papers/10/"');
    expect(start).toContain('Faction and the Large Republic'); // paper 10 topic
    expect(start).toContain('If men were angels'); // paper 51 why-copy
  });

  it('emits ItemList JSON-LD on a guide', async () => {
    const start = await read('guides/where-to-start/index.html');
    expect(start).toContain('"@type":"ItemList"');
  });

  it('includes guide URLs in the sitemap', async () => {
    const sitemap = await read('sitemap.xml');
    expect(sitemap).toContain('https://federalistreader.org/guides/');
    expect(sitemap).toContain('https://federalistreader.org/guides/where-to-start/');
    expect(sitemap).toContain('https://federalistreader.org/guides/the-judiciary/');
  });

  it('surfaces the guides from the homepage', async () => {
    const home = await read('index.html');
    expect(home).toContain('href="/guides/where-to-start/"');
    expect(home).toContain('href="/guides/most-important/"');
  });
});
