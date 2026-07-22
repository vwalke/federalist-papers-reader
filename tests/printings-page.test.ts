import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const load = (path: string) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

describe('The print room', () => {
  it('presents the Federalist printings ahead of the context issues, fully credited', async () => {
    const html = await load('printings/index.html');

    expect(html).toContain('class="paper-sheet printings-page"');
    expect(html).toContain('The print room');
    expect(html).toContain('id="federalist-1"');
    expect(html).toContain('id="federalist-2"');
    expect(html).toContain('id="federalist-7-8"');
    expect(html).toContain('id="federalist-13"');
    expect(html).toContain('id="federalist-85"');
    expect(html).toContain('Federalist Nos. 7 &amp; 8');
    expect(html).toContain('Philadelphia: Thomas Bradford. November 7, 1787.');
    expect(html).toContain('New York: Samuel and John Loudon. November 20, 1787.');
    expect(html).toContain('Boston: Benjamin Russell. December 8, 1787.');
    expect(html).toContain('The Pennsylvania Journal; and the Weekly Advertiser');
    expect(html).toContain('Philadelphia: Thomas Bradford. November 10, 1787.');
    expect(html).toContain('The New-York Packet');
    expect(html).toContain('New York: Samuel and John Loudon. August 15, 1788.');
    expect(html).toContain('id="new-haven-gazette-1787"');
    expect(html).toContain('id="massachusetts-centinel-1788"');

    // Federalist entries run in essay order ahead of the stage-setting section.
    const anchors = ['federalist-1', 'federalist-2', 'federalist-7-8', 'federalist-13', 'federalist-85']
      .map((id) => html.indexOf(`id="${id}"`));
    const context = html.indexOf('Setting the stage');
    for (const [index, position] of anchors.entries()) {
      expect(position).toBeGreaterThan(-1);
      if (index > 0) expect(position).toBeGreaterThan(anchors[index - 1]);
    }
    expect(anchors.at(-1)).toBeLessThan(context);

    // Credits per Seth's corrected table: four Rubenstein items, Fed 13 at Peoria.
    expect(html).toContain('href="https://www.sethkaller.com/"');
    expect(html).toContain('Images courtesy of');
    expect(html.match(/Collection of David M\. Rubenstein\./g)).toHaveLength(4);
    expect(html).toContain('Now at the Peoria Riverfront Museum.');

    // Await real scans before this appears.
    expect(html).not.toContain('No. 51');

    // Reading paths into the site's own text — the 7 & 8 pair links both essays.
    for (const number of [1, 2, 7, 8, 13, 85]) {
      expect(html).toContain(`href="/papers/${number}/"`);
    }
    expect(html).toContain('appear four times a week');
    expect(html).toContain('Detail</span>');

    // The family tie-in: Charles Thomson attests the Gazette's front page,
    // misspelled by the compositor, linked back to the About story.
    expect(html).toContain('“Charles Thompson,”');
    expect(html).toContain('the Continental Congress’s only secretary');
    expect(html).toContain('<a href="/about/">the family thread on our About page</a>');

    // Image discipline: dimensions, alt text, AVIF sources, lazy interior pages.
    expect(html).toContain(
      'src="/images/printings/federalist-2-pennsylvania-journal/page-1-thumb.jpg"'
    );
    expect(html).toContain(
      'srcset="/images/printings/federalist-2-pennsylvania-journal/page-1-thumb.avif"'
    );
    expect(html).toContain(
      'carrying Federalist No. 2 in its first two columns'
    );
    expect(html).toContain('printing Federalist No. 85 in full');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('target="_blank"');
    // Every gallery image carries real alt text (masthead art and the JS-filled
    // lightbox image are the only sanctioned empty alts on the page).
    const gallery = html.slice(html.indexOf('id="federalist-1"'), html.indexOf('<dialog'));
    expect(gallery).not.toContain('alt=""');

    // Progressive enhancement: thumbnails link straight to the large scans.
    expect(html).toContain(
      'href="/images/printings/federalist-2-pennsylvania-journal/page-1-large.jpg"'
    );
    expect(html).toContain('<dialog class="printing-lightbox"');
  });

  it('is linked from the site chrome and sitemap', async () => {
    const [home, sitemap] = await Promise.all([load('index.html'), load('sitemap.xml')]);
    expect(home).toContain('href="/printings/"');
    expect(sitemap).toContain('<loc>https://federalistreader.org/printings/</loc>');
  });

  it('sends readers of covered papers to the print room', async () => {
    const expectations: Array<[number, string]> = [
      [1, 'federalist-1'],
      [2, 'federalist-2'],
      [7, 'federalist-7-8'],
      [8, 'federalist-7-8'],
      [13, 'federalist-13'],
      [85, 'federalist-85']
    ];
    for (const [number, anchor] of expectations) {
      const paper = await load(`papers/${number}/index.html`);
      expect(paper, `paper ${number}`).toContain(`href="/printings/#${anchor}"`);
      expect(paper, `paper ${number}`).toContain('class="essay-printing-link"');
    }
    const uncovered = await load('papers/51/index.html');
    expect(uncovered).not.toContain('/printings/#');
  });
});
