import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

const REQUIRED_FIELDS = [
  'number',
  'title',
  'author',
  'authorCertainty',
  'publicationKind',
  'publicationVenue',
  'publicationDate',
  'publicationDateLabel',
  'recipient',
  'indexSummary',
  'nutshell',
  'keyArguments',
  'whyItMattered',
  'talkItOver',
  'sources'
];

function splitMarkdown(source, filename) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error(`${filename} does not contain valid YAML frontmatter.`);
  }

  return { data: parse(match[1]), body: match[2].trim() };
}

export async function validateContentDirectory(directory) {
  let filenames = [];

  try {
    filenames = (await readdir(directory)).filter((filename) => filename.endsWith('.md')).sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const entries = await Promise.all(
    filenames.map(async (filename) => {
      const source = await readFile(new URL(filename, directory), 'utf8');
      return { filename, source, ...splitMarkdown(source, filename) };
    })
  );

  const numberCounts = new Map();
  const missingFields = [];
  const emptyBodies = [];
  const shortSummariesOver18Words = [];
  const unquotedDates = [];
  const commentaryOutsideTarget = [];

  for (const entry of entries) {
    numberCounts.set(entry.data.number, (numberCounts.get(entry.data.number) ?? 0) + 1);

    for (const field of REQUIRED_FIELDS) {
      const value = entry.data[field];
      const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
      if (empty) missingFields.push(`${entry.filename}:${field}`);
    }

    if (!entry.body) emptyBodies.push(entry.filename);
    if (/^publicationDate:\s+\d{4}-\d{2}-\d{2}$/m.test(entry.source)) unquotedDates.push(entry.filename);

    const summaryWords = String(entry.data.indexSummary ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (summaryWords > 18) shortSummariesOver18Words.push(entry.data.number);

    const commentaryWords = [
      entry.data.nutshell,
      ...(Array.isArray(entry.data.keyArguments) ? entry.data.keyArguments : []),
      entry.data.whyItMattered,
      entry.data.talkItOver
    ]
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    if (commentaryWords < 70 || commentaryWords > 130) commentaryOutsideTarget.push(entry.data.number);
  }

  const expectedNumbers = Array.from({ length: 85 }, (_, index) => index + 1);
  const missingNumbers = expectedNumbers.filter((number) => !numberCounts.has(number));
  const duplicateNumbers = [...numberCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((left, right) => left - right);

  return {
    count: entries.length,
    missingNumbers,
    duplicateNumbers,
    missingFields,
    emptyBodies,
    shortSummariesOver18Words,
    unquotedDates,
    commentaryOutsideTarget
  };
}

async function main() {
  const directory = new URL('../src/content/papers/', import.meta.url);
  const report = await validateContentDirectory(directory);
  const issues = Object.entries(report)
    .filter(([key, value]) => key !== 'count' && Array.isArray(value) && value.length > 0)
    .map(([key, value]) => `${key}: ${value.join(', ')}`);

  if (report.count !== 85) issues.unshift(`count: expected 85, received ${report.count}`);

  if (issues.length > 0) {
    throw new Error(`Federalist content validation failed:\n${issues.join('\n')}`);
  }

  console.log('Validated papers 1–85: no gaps, duplicates, empty bodies, or incomplete commentary.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
