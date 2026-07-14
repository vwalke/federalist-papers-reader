import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { JSDOM } from 'jsdom';

const SOURCE_URL = 'https://www.gutenberg.org/files/1404/1404-h/1404-h.htm';
const OUTPUT_DIRECTORY = new URL('../src/content/papers/', import.meta.url);
const EDITORIAL_PATH = new URL('../src/data/editorial.json', import.meta.url);
const options = new Set(process.argv.slice(2));

if (!options.has('--download')) {
  throw new Error('Pass --download to fetch the public-domain source explicitly.');
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Source download failed: ${response.status}`);

const [html, editorialSource] = await Promise.all([response.text(), readFile(EDITORIAL_PATH, 'utf8')]);
const editorial = JSON.parse(editorialSource);
const document = new JSDOM(html).window.document;

const paperHeadings = [...document.querySelectorAll('h2')].filter((heading) =>
  /^FEDERALIST No\. \d+\./.test(clean(heading.textContent))
);

if (paperHeadings.length !== 85) {
  throw new Error(`Expected 85 Federalist headings, found ${paperHeadings.length}.`);
}

await mkdir(OUTPUT_DIRECTORY, { recursive: true });

for (const heading of paperHeadings) {
  const headingText = clean(heading.textContent);
  const match = headingText.match(/^FEDERALIST No\. (\d+)\.\s*(.+)$/);
  if (!match) throw new Error(`Could not parse heading: ${headingText}`);

  const number = Number(match[1]);
  const title = match[2];
  const publicationNode = heading.nextElementSibling;
  const authorNode = publicationNode?.nextElementSibling;
  const recipientNode = authorNode?.nextElementSibling;
  const publicationLabel = clean(publicationNode?.textContent);
  const sourceAuthor = clean(authorNode?.textContent);
  const recipient = clean(recipientNode?.textContent).replace(/:$/, '.');
  const entry = editorial[String(number)];

  if (!entry) throw new Error(`Missing editorial entry for Paper ${number}.`);
  if (!/^To the People of the State of New[- ]York[.:]?$/.test(clean(recipientNode?.textContent))) {
    throw new Error(`Unexpected recipient for Paper ${number}: ${recipient}`);
  }

  const body = collectBody(recipientNode?.nextElementSibling);
  const publicationDate = parseDate(publicationLabel);
  const publicationKind = number >= 78 ? 'book' : 'newspaper';
  const publicationVenue = parseVenue(publicationLabel, publicationKind);
  const { author, authorCertainty } = parseAuthor(sourceAuthor, number);
  const sources = [
    {
      label: 'Library of Congress full-text guide',
      url: 'https://guides.loc.gov/federalist-papers/full-text'
    },
    {
      label: 'Project Gutenberg source text',
      url: SOURCE_URL
    }
  ];

  const markdown = `---
number: ${number}
title: ${yamlString(title)}
author: ${yamlString(author)}
authorCertainty: ${authorCertainty}
publicationKind: ${publicationKind}
publicationVenue: ${yamlString(publicationVenue)}
publicationDate: ${yamlString(publicationDate)}
publicationDateLabel: ${yamlString(publicationLabel)}
recipient: ${yamlString(recipient)}
indexSummary: ${yamlString(entry.indexSummary)}
nutshell: ${yamlString(entry.nutshell)}
keyArguments:
${entry.keyArguments.map((argument) => `  - ${yamlString(argument)}`).join('\n')}
whyItMattered: ${yamlString(entry.whyItMattered)}
talkItOver: ${yamlString(entry.talkItOver)}
sources:
${sources.map((source) => `  - label: ${yamlString(source.label)}\n    url: ${yamlString(source.url)}`).join('\n')}
---

${body}
`;

  const filename = `${String(number).padStart(3, '0')}.md`;
  const destination = new URL(filename, OUTPUT_DIRECTORY);

  if (!options.has('--force')) {
    try {
      await readFile(destination, 'utf8');
      throw new Error(`${filename} already exists. Pass --force to replace imported content.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  await writeFile(destination, markdown, 'utf8');
}

console.log('Wrote 85 papers.');

function clean(value = '') {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function collectBody(startNode) {
  const blocks = [];
  let node = startNode;

  while (node && !(node.tagName === 'H2' && /^FEDERALIST No\. \d+\./.test(clean(node.textContent)))) {
    if (node.matches?.('p, blockquote')) {
      const text = clean(node.textContent);
      if (text) blocks.push(text);
    } else if (node.matches?.('ul, ol')) {
      const items = [...node.querySelectorAll(':scope > li')].map((item) => clean(item.textContent)).filter(Boolean);
      if (items.length) blocks.push(items.map((item) => `- ${item}`).join('\n'));
    }
    node = node.nextElementSibling;
  }

  return blocks.join('\n\n');
}

function parseDate(label) {
  const match = label.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(178[78])/i);
  if (!match) throw new Error(`Could not parse publication date: ${label}`);
  const months = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12
  };
  return `${match[3]}-${String(months[match[1].toLowerCase()]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`;
}

function parseVenue(label, publicationKind) {
  if (publicationKind === 'book') return "McLean's Edition, Volume II";
  if (/New York Packet/i.test(label)) return 'The New-York Packet';
  if (/Daily Advertiser/i.test(label)) return 'The Daily Advertiser';
  return 'The Independent Journal';
}

function parseAuthor(sourceAuthor, number) {
  if (/MADISON, with HAMILTON/i.test(sourceAuthor)) {
    return { author: 'James Madison with Alexander Hamilton', authorCertainty: 'joint' };
  }

  const disputedMadison = (number >= 49 && number <= 58) || number === 62 || number === 63;
  if (/MADISON/i.test(sourceAuthor)) {
    return {
      author: disputedMadison ? 'James Madison (attribution disputed)' : 'James Madison',
      authorCertainty: disputedMadison ? 'disputed' : 'certain'
    };
  }
  if (/JAY/i.test(sourceAuthor)) return { author: 'John Jay', authorCertainty: 'certain' };
  if (/HAMILTON/i.test(sourceAuthor)) return { author: 'Alexander Hamilton', authorCertainty: 'certain' };
  throw new Error(`Could not parse author for Paper ${number}: ${sourceAuthor}`);
}
