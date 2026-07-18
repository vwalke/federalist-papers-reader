// scripts/generate-email-content.mjs
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const papersDir = join(root, 'src/content/papers');
const outFile = join(root, 'workers/post/content/papers.json');

export function parsePaperFile(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error('paper file missing frontmatter');
  const meta = parseYaml(match[1]);
  const paragraphs = match[2]
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return {
    number: meta.number,
    title: meta.title,
    publicationDate: meta.publicationDate,
    datelineLabel: meta.publicationDateLabel,
    recipient: meta.recipient,
    nutshell: meta.nutshell,
    talkItOver: meta.talkItOver,
    excerptParagraphs: paragraphs.slice(0, 2)
  };
}

export function buildExport(papers) {
  return [...papers].sort((a, b) => a.number - b.number);
}

function main() {
  const papers = readdirSync(papersDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parsePaperFile(readFileSync(join(papersDir, f), 'utf8')));
  const exported = buildExport(papers);
  if (exported.length !== 85) throw new Error(`expected 85 papers, found ${exported.length}`);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(exported, null, 2) + '\n');
  console.log(`Wrote ${exported.length} papers to ${outFile}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
