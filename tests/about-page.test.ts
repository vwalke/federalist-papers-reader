import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('About this edition', () => {
  it('tells the family reading story and credits its historical inspirations', async () => {
    const html = await readFile(new URL('../dist/about/index.html', import.meta.url), 'utf8');

    expect(html).toContain('This edition began with a gift for my mom.');
    expect(html).toContain('href="https://www.letterjoy.co/pages/federalist-papers"');
    expect(html).toContain('LetterJoy’s Federalist Papers series');
    expect(html).toContain('class="paper-sheet about-page"');
    expect(html).toContain('class="about-lead"');
    expect(html).toContain('class="about-origin"');
    expect(html).toContain('class="about-origin__copy"');
    expect(html).toContain('class="about-family"');
    expect(html).toContain('class="about-family__copy"');
    expect(html).toContain('class="about-documents"');
    expect(html).toContain('class="about-documents__head"');
    expect(html).toContain('class="about-documents__figure"');
    expect(html).toContain('class="about-documents__copy"');
    expect(html).toContain('class="about-closing"');
    expect(html).toContain('class="about-closing__column"');
    expect(html).toContain('Questions, comments');
    expect(html).toContain('mailto:publius@federalistreader.org');
    expect(html).toContain('https://x.com/ReadPublius');
    expect(html).not.toContain('class="about-notes__privacy"');
    expect(html).not.toContain('No account, no tracking your reading');
    expect(html).toContain('class="about-colophon"');
    expect(html).toContain('This is a production of');
    expect(html).toContain('<a href="https://walkeforward.com">Walke Forward, LLC.</a>');

    const introductionIndex = html.indexOf('class="about-origin__copy"');
    const portraitIndex = html.indexOf('class="about-portrait"');
    const letterJoyIndex = html.indexOf('class="about-callout"');
    const familyIndex = html.indexOf('class="about-family"');
    const notesIndex = html.indexOf('class="about-closing"');
    const colophonIndex = html.indexOf('class="about-colophon"');
    const documentsIndex = html.indexOf('class="about-documents"');
    const documentsHtml = html.slice(documentsIndex, notesIndex);

    expect(introductionIndex).toBeGreaterThan(-1);
    expect(introductionIndex).toBeLessThan(portraitIndex);
    expect(portraitIndex).toBeLessThan(letterJoyIndex);
    expect(letterJoyIndex).toBeLessThan(familyIndex);
    expect(familyIndex).toBeLessThan(notesIndex);
    expect(documentsIndex).toBeGreaterThan(familyIndex);
    expect(documentsIndex).toBeLessThan(notesIndex);
    expect(colophonIndex).toBeGreaterThan(notesIndex);
    expect(html).toContain('sixth-great-uncle');
    expect(html).toContain('my mom’s fifth-great-uncle');
    expect(html).toContain('At ten years old, he arrived in America with no parents and no money.');
    expect(html).toContain('the only Secretary of the Continental Congress');
    expect(html).toContain('the two names printed on the Dunlap broadside');
    expect(html).toContain('first carried independence into American public life');
    expect(html).toContain('helped bring the Great Seal of the United States to its final design');
    expect(html).toContain('personally carried word of George Washington’s unanimous election');
    expect(html).toContain('translating the Septuagint Bible from Greek into English');
    expect(html).toContain('The penniless ten-year-old orphan grew into a man');
    expect(html).not.toContain('his was the quieter role');
    expect(html).toContain('href="https://www.carpentershall.org/pages/my-zeal-for-liberty"');
    expect(html).toContain(
      'href="https://www.loc.gov/collections/continental-congress-and-constitutional-convention-from-1774-to-1789/articles-and-essays/to-form-a-more-perfect-union/charles-thomson/"',
    );
    expect(html).toContain('href="https://www.archives.gov/founding-docs/declaration-history"');
    expect(html).toContain('href="https://diplomacy.state.gov/the-great-seal/"');
    expect(html).toContain(
      'href="https://founders.archives.gov/documents/Washington/05-02-02-0056"',
    );
    expect(html).toContain(
      'href="https://collections.museumofthebible.org/artifacts/45021-thomson-bible?theme=a-history-of-translation"',
    );
    expect(html).toContain('class="about-portrait"');
    expect(html).toContain('src="/images/mom-and-me-sail4th-2026.jpg"');
    expect(html).toContain('alt="Mom and me together at Sail4th 250 in New York Harbor"');
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="1600"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('Mom and me');
    expect(html).toContain('July 4, 2026 · Sail4th 250, New York Harbor');
    expect(html).toContain('History in the room');
    expect(html).toContain('Nothing substitutes for the real thing.');
    expect(html).toContain('We are fortunate to know Seth Kaller');
    expect(html).toContain('On July 5, 2026, Mom and I visited');
    expect(html).toContain('visited <em>The Promise of Liberty: Words That Shaped a Nation</em>');
    expect(html).toContain('The Promise of Liberty: Words That Shaped a Nation');
    expect(html).toContain(
      'carrying the printed signature of Charles Thomson—her fifth-great-uncle',
    );
    expect(html).toContain('Here it was, in ink and paper, directly in front of us.');
    expect(html).toContain(
      'no screen can reproduce the scale, texture, survival, and sheer presence',
    );
    expect(html).toContain('If <em>The Promise of Liberty</em>—or any exhibition');
    expect(html).toContain('wanting to bring a piece of history home');
    expect(html).toContain('href="https://www.thepromiseofliberty.org/"');
    expect(html).toContain('Follow <em>The Promise of Liberty</em>');
    expect(html).toContain('href="https://www.sethkaller.com/"');
    expect(html).toContain('Explore history you can own');
    expect(html).toContain('src="/images/mom-and-seth-promise-of-liberty-2026.jpg"');
    expect(html).toContain(
      'alt="Seth Kaller showing Mom a framed printing of the Declaration of Independence at The Promise of Liberty exhibition"',
    );
    expect(html).toContain('width="1200"');
    expect(html).toContain('height="1567"');
    expect(html).toContain('loading="lazy"');
    expect(documentsHtml).toContain('decoding="async"');
    expect(documentsHtml).not.toContain('target="_blank"');
    expect(html).toContain('Mom and Seth Kaller');
    expect(html).toContain(
      'With a printing of the Declaration carrying Charles Thomson’s printed signature.',
    );
    expect(html).toContain('July 5, 2026 ·');
    expect(html).toContain('South Street Seaport Museum, New York City.');
  });
});
