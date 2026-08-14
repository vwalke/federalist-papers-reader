import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const SLUGS = [
  'brutus-1',
  'brutus-2',
  'cato-4',
  'brutus-4',
  'brutus-6',
  'brutus-10',
  'brutus-12',
  'brutus-15'
];

async function readPage(path: string): Promise<string> {
  return readFile(new URL(`../dist/${path}/index.html`, import.meta.url), 'utf8');
}

function ogImage(page: string): string {
  const match = page.match(/<meta property="og:image" content="([^"]+)"/);
  if (!match) throw new Error('page has no og:image');
  return match[1];
}

async function assertCardExists(cardPath: string): Promise<void> {
  // The card must exist both in the source of truth and in the deployed output.
  await expect(
    access(new URL(`../public${cardPath}`, import.meta.url)),
    `public${cardPath} should exist`
  ).resolves.toBeUndefined();
  await expect(
    access(new URL(`../dist${cardPath}`, import.meta.url)),
    `dist${cardPath} should exist`
  ).resolves.toBeUndefined();
}

describe('antifederalist built pages', () => {
  it('renders all eight essays and the index', async () => {
    await expect(readPage('antifederalist')).resolves.toContain('The Anti-Federalist Papers');
    for (const slug of SLUGS) {
      await expect(readPage(`antifederalist/${slug}`)).resolves.toBeTruthy();
    }
  });

  it('sets the shelf in the main index ledger idiom', async () => {
    const page = await readPage('antifederalist');

    // Column labels row and one ledger row per essay, in publication order.
    expect(page).toContain('index-ledger__labels');
    expect(page.match(/class="index-entry"/g)).toHaveLength(8);
    const order = SLUGS.map((slug) => page.indexOf(`href="/antifederalist/${slug}/"`));
    expect(order.every((at) => at !== -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // No. column: roman numeral with a visually-hidden series prefix.
    expect(page).toMatch(/<span class="visually-hidden"[^>]*>Brutus number <\/span>I</);
    expect(page).toMatch(/<span class="visually-hidden"[^>]*>Cato number <\/span>IV</);

    // Author and Published columns as printed in the Journal.
    expect(page).toMatch(/<p class="index-entry__author"[^>]*>Brutus<\/p>/);
    expect(page).toMatch(/<p class="index-entry__author"[^>]*>Cato<\/p>/);
    expect(page).toMatch(/<time datetime="1787-10-18"[^>]*>Oct 18, 1787<\/time>/);

    // Status toggles carry the main ledger's semantics from first paint.
    expect(page.match(/data-journal-status/g)).toHaveLength(8);
    expect(page).toContain('aria-label="Mark Brutus No. I as read"');
    expect(page).toContain('aria-label="Mark Cato No. IV as read"');
    expect(page).not.toContain('journal-entry__');

    // Continue link defaults to the first essay; the script refines it.
    expect(page).toMatch(/data-continue-link[\s\S]*?Begin with Brutus No\. I/);
  });

  it('sets the Journal masthead and signs the essays', async () => {
    const page = await readPage('antifederalist/brutus-1');
    expect(page).toContain('/masthead-new-york-journal.svg');
    expect(page).toContain('TRUTH unlicens’d reigns');
    expect(page).toMatch(/class="essay-signature"[^>]*>BRUTUS</);
  });

  it('prints the Journal on its own lighter sheet stock', async () => {
    await expect(readPage('antifederalist/brutus-1')).resolves.toContain('paper-sheet--journal');
    await expect(readPage('antifederalist')).resolves.toContain('paper-sheet--journal');
    // The Federalist keeps its own stock.
    await expect(readPage('papers/1')).resolves.not.toContain('paper-sheet--journal');
  });

  it('carries the Greenleaf motto on the shelf and the essays', async () => {
    // "TRUTH unlicens" sidesteps the curly apostrophe in "unlicens’d".
    await expect(readPage('antifederalist')).resolves.toContain('TRUTH unlicens');
    await expect(readPage('antifederalist/brutus-15')).resolves.toContain('TRUTH unlicens');
  });

  it('shows the LOC strip with credit', async () => {
    const page = await readPage('antifederalist/brutus-15');
    expect(page).toContain('/images/antifederalist/brutus-15/page-thumb.jpg');
    expect(page).toContain('Library of Congress, Chronicling America');
  });

  it('labels the Brutus II page image as a stand-in front page', async () => {
    // Brutus II's inner leaf was never digitized: the strip shows the issue's
    // front page and must not claim the essay itself is on the pictured page.
    const page = await readPage('antifederalist/brutus-2');
    expect(page).toContain('Front page of the issue');
    expect(page).not.toContain('New-York Journal issue carrying');
    expect(page).not.toMatch(/Page \d+ of Thomas Greenleaf/);
  });

  it('agrees with the social-card generator on every og:image', async () => {
    for (const slug of SLUGS) {
      const page = await readPage(`antifederalist/${slug}`);
      const cardPath = `/social-cards/antifederalist-${slug}.jpg`;
      expect(ogImage(page)).toBe(`https://federalistreader.org${cardPath}`);
      await assertCardExists(cardPath);
    }

    const index = await readPage('antifederalist');
    expect(ogImage(index)).toBe(
      'https://federalistreader.org/social-cards/antifederalist-default.jpg'
    );
    await assertCardExists('/social-cards/antifederalist-default.jpg');
  });

  it('links every essay to its Publius answers', async () => {
    const page = await readPage('antifederalist/brutus-12');
    expect(page).toContain('href="/papers/78/"');
  });

  it('keeps reply links reciprocal on the Federalist side', async () => {
    const expectations: Array<[number, string]> = [
      [10, 'brutus-1'],
      [84, 'brutus-2'],
      [67, 'cato-4'],
      [68, 'cato-4'],
      [69, 'cato-4'],
      [55, 'brutus-4'],
      [56, 'brutus-4'],
      [57, 'brutus-4'],
      [23, 'brutus-6'],
      [33, 'brutus-6'],
      [24, 'brutus-10'],
      [29, 'brutus-10'],
      [78, 'brutus-12'],
      [78, 'brutus-15'],
      [81, 'brutus-15']
    ];
    for (const [paper, slug] of expectations) {
      const page = await readPage(`papers/${paper}`);
      expect(page, `paper ${paper} should link ${slug}`).toContain(
        `href="/antifederalist/${slug}/"`
      );
    }
  });

  it('lists the new routes in the sitemap', async () => {
    const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
    expect(sitemap).toContain('https://federalistreader.org/antifederalist/');
    for (const slug of SLUGS) {
      expect(sitemap).toContain(`https://federalistreader.org/antifederalist/${slug}/`);
    }
  });
});
