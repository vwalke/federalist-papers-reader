// scripts/generate-email-content.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const papersDir = join(root, 'src/content/papers');
const essaysDir = join(root, 'src/content/antifederalist');
const outFile = join(root, 'workers/post/content/debate.json');

/** Shared id space: 1–85 Publius, 100+n Brutus, 150+n Cato (src/lib/antifederalist.ts). */
const SERIES_BASE = { Brutus: 100, Cato: 150 };

const ROMAN_NUMERALS = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function toRomanNumeral(number) {
  let remaining = number;
  let result = '';
  for (const [value, glyph] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += glyph;
      remaining -= value;
    }
  }
  return result;
}

function parseContentFile(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('content file missing frontmatter');
  const meta = parseYaml(match[1]);
  const paragraphs = match[2]
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { meta, paragraphs };
}

function sharedFields(meta, paragraphs) {
  return {
    title: meta.title,
    publicationDate: meta.publicationDate,
    datelineLabel: meta.publicationDateLabel,
    recipient: meta.recipient,
    nutshell: meta.nutshell,
    talkItOver: meta.talkItOver,
    excerptParagraphs: paragraphs.slice(0, 2)
  };
}

export function parsePaperFile(raw) {
  const { meta, paragraphs } = parseContentFile(raw);
  return {
    kind: 'paper',
    id: meta.number,
    number: meta.number,
    ...sharedFields(meta, paragraphs)
  };
}

export function parseEssayFile(raw) {
  const { meta, paragraphs } = parseContentFile(raw);
  const base = SERIES_BASE[meta.series];
  if (base === undefined) throw new Error(`unknown essay series: ${meta.series}`);
  return {
    kind: 'essay',
    id: base + meta.seriesNumber,
    series: meta.series,
    seriesNumber: meta.seriesNumber,
    displayName: `${meta.series} No. ${toRomanNumeral(meta.seriesNumber)}`,
    slug: `${meta.series.toLowerCase()}-${meta.seriesNumber}`,
    ...sharedFields(meta, paragraphs)
  };
}

/**
 * The canonical merged order: publication date ascending; date ties put papers
 * (ids 1–85) before essays (101+) and then run by id — the same order the
 * site's combined ledger uses (src/lib/index-state.ts).
 */
export function buildExport(papers, essays) {
  const items = [...papers, ...essays].sort(
    (left, right) =>
      left.publicationDate.localeCompare(right.publicationDate) || left.id - right.id
  );
  return { items, sequence: items.map((item) => item.id) };
}

function readContentDir(dir, parse) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')));
}

function main() {
  const papers = readContentDir(papersDir, parsePaperFile);
  const essays = readContentDir(essaysDir, parseEssayFile);
  if (papers.length !== 85) throw new Error(`expected 85 papers, found ${papers.length}`);
  if (essays.length !== 8) throw new Error(`expected 8 essays, found ${essays.length}`);
  const exported = buildExport(papers, essays);
  if (exported.sequence.length !== 93) {
    throw new Error(`expected a 93-item sequence, found ${exported.sequence.length}`);
  }
  if (new Set(exported.sequence).size !== exported.sequence.length) {
    throw new Error('sequence contains duplicate ids');
  }
  if (exported.sequence[0] !== 101) {
    throw new Error('the debate must open with Brutus No. I (id 101)');
  }
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(exported, null, 2) + '\n');
  console.log(`Wrote ${papers.length} papers and ${essays.length} essays to ${outFile}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
