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

const ANTIFEDERALIST_REQUIRED_FIELDS = [
  'series', 'seriesNumber', 'title', 'topic', 'author', 'authorCertainty',
  'publicationVenue', 'publicationDate', 'publicationDateLabel', 'recipient',
  'indexSummary', 'nutshell', 'keyArguments', 'whyItMattered', 'talkItOver',
  'repliesTo', 'loc', 'sources'
];

export async function validateAntifederalistDirectory(directory) {
  let filenames = [];
  try {
    filenames = (await readdir(directory)).filter((name) => name.endsWith('.md')).sort();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const entries = await Promise.all(
    filenames.map(async (filename) => {
      const source = await readFile(new URL(filename, directory), 'utf8');
      return { filename, source, ...splitMarkdown(source, filename) };
    })
  );

  const slugCounts = new Map();
  const missingFields = [];
  const emptyBodies = [];
  const summariesOver18Words = [];
  const commentaryOutsideTarget = [];
  const datesOutsideRange = [];
  const badReplies = [];
  const missingSignatures = [];
  const unquotedDates = [];

  for (const entry of entries) {
    const slug = `${String(entry.data.series ?? '').toLowerCase()}-${entry.data.seriesNumber}`;
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);

    for (const field of ANTIFEDERALIST_REQUIRED_FIELDS) {
      const value = entry.data[field];
      const empty = value === undefined || value === null || value === '' ||
        (Array.isArray(value) && value.length === 0);
      if (empty) missingFields.push(`${entry.filename}:${field}`);
    }

    if (!entry.body) emptyBodies.push(entry.filename);
    if (/^publicationDate:\s+\d{4}-\d{2}-\d{2}$/m.test(entry.source)) unquotedDates.push(entry.filename);

    const date = String(entry.data.publicationDate ?? '');
    if (date < '1787-10-01' || date > '1788-04-30') datesOutsideRange.push(entry.filename);

    const replies = Array.isArray(entry.data.repliesTo) ? entry.data.repliesTo : [];
    if (replies.some((n) => !Number.isInteger(n) || n < 1 || n > 85)) {
      badReplies.push(entry.filename);
    }

    const signature = String(entry.data.series ?? '').toUpperCase();
    if (!entry.body.endsWith(`\n\n${signature}`)) {
      missingSignatures.push(entry.filename);
    }

    const summaryWords = String(entry.data.indexSummary ?? '').trim().split(/\s+/).filter(Boolean).length;
    if (summaryWords > 18) summariesOver18Words.push(slug);

    const commentaryWords = [
      entry.data.nutshell,
      ...(Array.isArray(entry.data.keyArguments) ? entry.data.keyArguments : []),
      entry.data.whyItMattered,
      entry.data.talkItOver
    ].join(' ').trim().split(/\s+/).filter(Boolean).length;
    if (commentaryWords < 70 || commentaryWords > 130) commentaryOutsideTarget.push(slug);
  }

  const duplicateSlugs = [...slugCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([slug]) => slug)
    .sort();

  return {
    count: entries.length,
    slugs: [...slugCounts.keys()].sort((a, b) => {
      const seriesA = a.replace(/-\d+$/, '');
      const seriesB = b.replace(/-\d+$/, '');
      if (seriesA !== seriesB) return seriesA.localeCompare(seriesB);
      return Number(a.slice(seriesA.length + 1)) - Number(b.slice(seriesB.length + 1));
    }),
    duplicateSlugs,
    missingFields,
    emptyBodies,
    summariesOver18Words,
    commentaryOutsideTarget,
    datesOutsideRange,
    badReplies,
    missingSignatures,
    unquotedDates
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

  const antifederalistDirectory = new URL('../src/content/antifederalist/', import.meta.url);
  const antifederalistReport = await validateAntifederalistDirectory(antifederalistDirectory);
  const antifederalistIssues = Object.entries(antifederalistReport)
    .filter(([key, value]) => !['count', 'slugs'].includes(key) && Array.isArray(value) && value.length > 0)
    .map(([key, value]) => `${key}: ${value.join(', ')}`);
  if (antifederalistReport.count !== 8) {
    antifederalistIssues.unshift(`count: expected 8, received ${antifederalistReport.count}`);
  }
  if (antifederalistIssues.length > 0) {
    throw new Error(`Anti-Federalist content validation failed:\n${antifederalistIssues.join('\n')}`);
  }
  console.log('Validated the eight New-York Journal essays.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
