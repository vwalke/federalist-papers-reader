import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const load = (path: string) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');

describe('The print room', () => {
  it('presents the Federalist printings ahead of the context issues, fully credited', async () => {
    const html = await load('printings/index.html');

    expect(html).toContain('class="paper-sheet printings-page"');
    expect(html).toContain('The print room');
    expect(html).toContain('id="federalist-2"');
    expect(html).toContain('id="federalist-85"');
    expect(html).toContain('The Pennsylvania Journal; and the Weekly Advertiser');
    expect(html).toContain('Philadelphia: Thomas Bradford. November 10, 1787.');
    expect(html).toContain('The New-York Packet');
    expect(html).toContain('New York: Samuel and John Loudon. August 15, 1788.');
    expect(html).toContain('id="new-haven-gazette-1787"');
    expect(html).toContain('id="massachusetts-centinel-1788"');

    // Federalist entries precede the stage-setting section.
    const fed2 = html.indexOf('id="federalist-2"');
    const fed85 = html.indexOf('id="federalist-85"');
    const context = html.indexOf('Setting the stage');
    expect(fed2).toBeGreaterThan(-1);
    expect(fed2).toBeLessThan(fed85);
    expect(fed85).toBeLessThan(context);

    // Credits: page-wide Kaller line, Rubenstein on both Federalist items only.
    expect(html).toContain('href="https://www.sethkaller.com/"');
    expect(html).toContain('Images courtesy of');
    expect(html.match(/Collection of David M\. Rubenstein\./g)).toHaveLength(2);

    // Await real scans before these appear.
    expect(html).not.toContain('No. 13');
    expect(html).not.toContain('No. 51');

    // Reading paths into the site's own text.
    expect(html).toContain('href="/papers/2/"');
    expect(html).toContain('href="/papers/85/"');

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
    const gallery = html.slice(html.indexOf('id="federalist-2"'), html.indexOf('<dialog'));
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

  it('sends readers of papers 2 and 85 to the print room', async () => {
    const [paper2, paper85, paper1] = await Promise.all([
      load('papers/2/index.html'),
      load('papers/85/index.html'),
      load('papers/1/index.html')
    ]);
    expect(paper2).toContain('href="/printings/#federalist-2"');
    expect(paper2).toContain('class="essay-printing-link"');
    expect(paper85).toContain('href="/printings/#federalist-85"');
    expect(paper1).not.toContain('/printings/#');
  });
});
