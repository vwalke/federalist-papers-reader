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
    const essentials = await read('guides/most-important/index.html');
    expect(essentials).toContain('href="/papers/1/"');
    expect(essentials).toContain('href="/papers/10/"');
    expect(essentials).toContain('Faction and the Large Republic'); // paper 10 topic
    expect(essentials).toContain('Ambition must be made'); // paper 51 why-copy
  });

  it('emits ItemList JSON-LD on a curated guide', async () => {
    const essentials = await read('guides/most-important/index.html');
    expect(essentials).toContain('"@type":"ItemList"');
  });

  it('routes the where-to-start hub to the companions and Paper No. 1', async () => {
    const start = await read('guides/where-to-start/index.html');
    expect(start).toContain('href="/papers/1/"'); // begin-reading CTA
    expect(start).toContain('href="/guides/most-important/"');
    expect(start).toContain('href="/guides/faction/"');
    expect(start).toContain('href="/guides/the-judiciary/"');
    expect(start).not.toContain('"@type":"ItemList"'); // no curated list of its own
  });

  it('includes guide URLs in the sitemap', async () => {
    const sitemap = await read('sitemap.xml');
    expect(sitemap).toContain('https://federalistreader.org/guides/');
    expect(sitemap).toContain('https://federalistreader.org/guides/where-to-start/');
    expect(sitemap).toContain('https://federalistreader.org/guides/the-judiciary/');
  });

  it('surfaces the where-to-start hub from the homepage', async () => {
    const home = await read('index.html');
    expect(home).toContain('href="/guides/where-to-start/"');
  });

  it('cross-links a paper to its theme guide', async () => {
    const paper10 = await read('papers/10/index.html');
    expect(paper10).toContain('href="/guides/faction/"');
  });
});
