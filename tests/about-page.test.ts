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
    expect(html).toContain('class="about-notes"');
    expect(html).toContain('class="about-notes__privacy"');
    expect(html).toContain('class="about-colophon"');
    expect(html).toContain('This is a production of');
    expect(html).toContain('<a href="https://walkeforward.com">WalkeForward, LLC.</a>');

    const introductionIndex = html.indexOf('class="about-origin__copy"');
    const portraitIndex = html.indexOf('class="about-portrait"');
    const letterJoyIndex = html.indexOf('class="about-callout"');
    const familyIndex = html.indexOf('class="about-family"');
    const notesIndex = html.indexOf('class="about-notes"');
    const colophonIndex = html.indexOf('class="about-colophon"');

    expect(introductionIndex).toBeGreaterThan(-1);
    expect(introductionIndex).toBeLessThan(portraitIndex);
    expect(portraitIndex).toBeLessThan(letterJoyIndex);
    expect(letterJoyIndex).toBeLessThan(familyIndex);
    expect(familyIndex).toBeLessThan(notesIndex);
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
  });
});
