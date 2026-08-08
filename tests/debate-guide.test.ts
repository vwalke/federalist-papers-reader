import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const guidePath = fileURLToPath(
  new URL('../src/content/guides/the-ratification-debate.md', import.meta.url)
);
const essaysDir = fileURLToPath(new URL('../src/content/antifederalist/', import.meta.url));

interface Exchange {
  essay: string;
  papers: number[];
  heading: string;
  why: string;
}

function frontmatter(text: string): string {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error('missing frontmatter block');
  }
  return match[1];
}

function parseExchanges(fm: string): Exchange[] {
  const block = fm.match(/^exchanges:\r?\n([\s\S]*)$/m);
  if (!block) {
    throw new Error('missing exchanges block');
  }

  return block[1]
    .split(/^ {2}- /m)
    .slice(1)
    .map((item) => {
      const essay = item.match(/essay:\s*(\S+)/)?.[1];
      const papersList = item.match(/papers:\s*\[([^\]]+)\]/)?.[1];
      const heading = item.match(/heading:\s*"([^"]+)"/)?.[1];
      const why = item.match(/why:\s*"([^"]+)"/)?.[1];
      if (!essay || !papersList || !heading || !why) {
        throw new Error(`malformed exchange entry:\n${item}`);
      }
      return {
        essay,
        papers: papersList.split(',').map((n) => Number(n.trim())),
        heading,
        why
      };
    });
}

async function loadExchanges(): Promise<Exchange[]> {
  return parseExchanges(frontmatter(await readFile(guidePath, 'utf-8')));
}

describe('the ratification debate guide', () => {
  it('exists as a kind "guide" with no flat papers list', async () => {
    const fm = frontmatter(await readFile(guidePath, 'utf-8'));
    expect(fm).toMatch(/^kind:\s*guide\s*$/m);
    expect(fm).toMatch(/^papers:\s*\[\]\s*$/m);
  });

  it('points every exchange at an existing Anti-Federalist essay', async () => {
    const files = await readdir(essaysDir);
    const essaySlugs = new Set(
      files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
    );

    for (const exchange of await loadExchanges()) {
      expect(essaySlugs.has(exchange.essay), `essay slug "${exchange.essay}" resolves`).toBe(true);
    }
  });

  it('keeps every answering paper within Federalist 1-85', async () => {
    for (const exchange of await loadExchanges()) {
      expect(exchange.papers.length).toBeGreaterThan(0);
      for (const number of exchange.papers) {
        expect(Number.isInteger(number), `${exchange.essay} paper ${number} is an integer`).toBe(
          true
        );
        expect(number).toBeGreaterThanOrEqual(1);
        expect(number).toBeLessThanOrEqual(85);
      }
    }
  });

  it('covers all eight essays exactly once', async () => {
    const files = await readdir(essaysDir);
    const essaySlugs = files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));

    const used = (await loadExchanges()).map((exchange) => exchange.essay);
    expect(used.length).toBe(essaySlugs.length);
    expect([...used].sort()).toEqual([...essaySlugs].sort());
  });
});
