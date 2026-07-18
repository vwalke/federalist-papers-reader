import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const guidesDir = fileURLToPath(new URL('../src/content/guides/', import.meta.url));

const guideFiles = ['most-important', 'where-to-start'] as const;
const themeFiles = ['faction', 'separation-of-powers', 'the-judiciary', 'the-presidency'] as const;
const allSlugs = [...guideFiles, ...themeFiles].sort();

async function readGuide(slug: string): Promise<string> {
  return readFile(`${guidesDir}${slug}.md`, 'utf-8');
}

function frontmatter(text: string): string {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('missing frontmatter block');
  }
  return match[1];
}

describe('guides content collection', () => {
  it('has all six guide markdown files', async () => {
    for (const slug of allSlugs) {
      const text = await readGuide(slug);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('marks the two guides with kind "guide"', async () => {
    for (const slug of guideFiles) {
      const fm = frontmatter(await readGuide(slug));
      expect(fm).toMatch(/^kind:\s*guide\s*$/m);
    }
  });

  it('marks the four theme guides with kind "theme"', async () => {
    for (const slug of themeFiles) {
      const fm = frontmatter(await readGuide(slug));
      expect(fm).toMatch(/^kind:\s*theme\s*$/m);
    }
  });

  it('gives every curated guide a papers block with at least one referenced paper and a why', async () => {
    // where-to-start is the hub: it routes to the companions instead of
    // carrying a curated list of its own.
    const curatedSlugs = allSlugs.filter((slug) => slug !== 'where-to-start');

    for (const slug of curatedSlugs) {
      const fm = frontmatter(await readGuide(slug));

      const papersMatch = fm.match(/^papers:\s*\r?\n([\s\S]*)$/m);
      expect(papersMatch, `${slug} has a papers: block`).not.toBeNull();
      const papersBlock = papersMatch![1];

      const numbers = papersBlock.match(/^\s*-\s*number:\s*(\d+)\s*$/gm) ?? [];
      expect(numbers.length, `${slug} lists at least one paper number`).toBeGreaterThan(0);

      const whys = papersBlock.match(/^\s*why:\s*\S/gm) ?? [];
      expect(whys.length, `${slug} pairs a why with its papers`).toBeGreaterThanOrEqual(numbers.length);
    }
  });

  it('keeps the where-to-start hub free of a curated papers list', async () => {
    const fm = frontmatter(await readGuide('where-to-start'));
    expect(fm).not.toMatch(/^papers:/m);
  });
});
