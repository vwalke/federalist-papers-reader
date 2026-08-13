// scripts/import-antifederalist.mjs
// One-time import of the eight New-York Journal essays from Teaching
// American History (teachingamericanhistory.org). The 1787–88 text is
// public domain; TAH is credited as the source edition in each file
// (docs/sources.md documents provenance). Wording and punctuation are
// preserved; whitespace is normalized to Markdown paragraphs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { stringify } from 'yaml';

const OUT_DIR = new URL('../src/content/antifederalist/', import.meta.url);
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
const options = new Set(process.argv.slice(2));

if (!options.has('--download')) {
  throw new Error('Pass --download to fetch the public-domain source explicitly.');
}

const ESSAYS = [
  {
    slug: 'brutus-1',
    // TAH's Brutus I carries one marked elision (". . . ." after
    // "posterity will execrate your memory") cutting a 139-word passage
    // ("Momentous then is the question … how you deposit the powers of
    // government."). The committed file restores that passage from the
    // complete Documentary History of the Ratification text (CSAC/UW–
    // Madison PDF, cited in sources below); a refetch would clobber the
    // restoration, so this entry is skipped.
    skip: 'TAH elision restored from CSAC — see comment',
    tah: 'https://teachingamericanhistory.org/document/brutus-i/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 1,
      title: 'Against the Consolidated Republic',
      topic: 'The Extended Republic',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1787-10-18',
      publicationDateLabel: 'For the New-York Journal. Thursday, October 18, 1787',
      recipient: 'To the Citizens of the State of New-York.',
      indexSummary:
        'Argues a republic as large as America must slide into consolidation and lose its liberty.',
      nutshell:
        'Brutus opens the opposition’s case: the Constitution creates not a confederation but one consolidated government, and history shows no free republic has ever governed a territory so large. Power this distant from the people, he warns, must finally rest on force.',
      keyArguments: [
        'The necessary-and-proper and supremacy clauses annihilate the states in all but name.',
        'Free republics survive only where territory is small and citizens share manners and interests.',
        'A distant government the people cannot know or trust must rule by standing armies.'
      ],
      whyItMattered:
        'Madison’s Federalist 10 answered with the opposite wager: that an extended republic would tame faction, not destroy liberty.',
      talkItOver:
        'Does the size of a country still shape how much its citizens trust the government they share?',
      repliesTo: [10],
      loc: { lccn: 'sn83030565', date: '1787-10-18', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-i/'
        },
        {
          label: 'Documentary History of the Ratification source text (CSAC)',
          url: 'https://archive.csac.history.wisc.edu/Brutus_I(1).pdf'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030565/1787-10-18/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-2',
    tah: 'https://teachingamericanhistory.org/document/brutus-ii/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 2,
      title: 'The Missing Bill of Rights',
      topic: 'Reserved Rights',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1787-11-01',
      publicationDateLabel: 'For the New-York Journal. Thursday, November 1, 1787',
      recipient: 'To the Citizens of the State of New-York.',
      indexSummary:
        'Demands a bill of rights, since a government of the whole people will absorb reserved powers.',
      nutshell:
        'Why does the Constitution, unlike most state constitutions, arrive without a bill of rights? Brutus argues that in forming any government the people must expressly reserve their most precious rights—and that the plan’s own logic makes the omission dangerous rather than harmless.',
      keyArguments: [
        'Rights not expressly reserved will be presumed surrendered.',
        'The Constitution already protects some rights, admitting the principle while abandoning the rest.',
        'State bills of rights cannot bind a supreme national government.'
      ],
      whyItMattered:
        'Hamilton spent much of Federalist 84 answering this charge; ratification in several states turned on the promise of amendments that became the Bill of Rights.',
      talkItOver: 'If a right isn’t written down, is it protected?',
      repliesTo: [84],
      loc: { lccn: 'sn83030565', date: '1787-11-01', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-ii/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030565/1787-11-01/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'cato-4',
    // TAH's Cato IV is abridged: it drops the essay's opening paragraph
    // ("Admitting, however, that the vast extent of America…") and elides
    // three further passages. The committed body was instead transcribed
    // from the complete Documentary History of the Ratification text
    // (CSAC/UW–Madison PDF, cited in sources below), so this entry is
    // skipped to avoid overwriting it with the abridged TAH text.
    skip: 'body transcribed from CSAC Documentary History PDF — see comment',
    tah: 'https://teachingamericanhistory.org/document/cato-iv/',
    frontmatter: {
      series: 'Cato',
      seriesNumber: 4,
      title: 'The President as Elective King',
      topic: 'Executive Power',
      author: 'George Clinton',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1787-11-08',
      publicationDateLabel: 'For the New-York Journal. Thursday, November 8, 1787',
      recipient: 'To the Citizens of the State of New-York.',
      indexSummary:
        'Warns the presidency’s term, powers, and patronage make it an elective monarchy in waiting.',
      nutshell:
        'Cato reads Article II and sees a king by another name: a single magistrate with a long re-eligible term, command of the army, the pardon power, and a court of favorites around him. An office like that, he argues, invites the ambition it is meant to restrain.',
      keyArguments: [
        'A four-year re-eligible term gives a president time and motive to entrench himself.',
        'Command of the military and the pardon power are royal prerogatives in republican dress.',
        'Patronage will gather a class of dependents around the executive.'
      ],
      whyItMattered:
        'Hamilton wrote Federalist 67–69 largely against Cato—No. 67’s footnote cites Cato No. V, this argument’s continuation—comparing the presidency with the British crown clause by clause.',
      talkItOver:
        'Which guardrails on the presidency matter more today: written limits, or the habits of the people who hold it?',
      repliesTo: [67, 68, 69],
      loc: { lccn: 'sn83030565', date: '1787-11-08', page: 2 },
      sources: [
        {
          label: 'Documentary History of the Ratification source text (CSAC)',
          url: 'https://archive.csac.history.wisc.edu/Cato_IV(1).pdf'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030565/1787-11-08/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-4',
    tah: 'https://teachingamericanhistory.org/document/brutus-iv/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 4,
      title: 'Too Few to Speak for So Many',
      topic: 'Representation',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1787-11-29',
      publicationDateLabel: 'For the New-York Journal. Thursday, November 29, 1787',
      recipient: 'To the People of the State of New-York.',
      indexSummary:
        'Argues sixty-five representatives cannot mirror the people and will be drawn from the few.',
      nutshell:
        'A representative body, Brutus argues, should be a miniature of the people—thinking, feeling, and acting as the community itself would. Sixty-five men for three million cannot be that; so small a house will be filled by the conspicuous few and moved by intrigue.',
      keyArguments: [
        'True representation must resemble the whole community, middling classes included.',
        'So few seats will fall to the wealthy and well-known, not the yeomanry.',
        'A small legislature is easier to corrupt and easier for a faction to command.'
      ],
      whyItMattered:
        'Madison answered in Federalist 55–57, defending both the number and the character of the House.',
      talkItOver:
        'Should a legislature look like the people it represents, or just be chosen by them?',
      repliesTo: [55, 56, 57],
      loc: { lccn: 'sn83030566', date: '1787-11-29', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-iv/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030566/1787-11-29/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-6',
    tah: 'https://teachingamericanhistory.org/document/brutus-vi/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 6,
      title: 'The Sweeping Clause',
      topic: 'Necessary and Proper',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1787-12-27',
      publicationDateLabel: 'For the New-York Journal. Thursday, December 27, 1787',
      recipient: 'To the People of the State of New-York.',
      indexSummary:
        'Reads the taxing and necessary-and-proper powers as a grant of unlimited government.',
      nutshell:
        'Brutus turns to the money powers. The power to lay taxes “for the general welfare,” joined to the necessary-and-proper clause, reads to him as a power without limits—one that will absorb the states’ objects of government until their legislatures have little left to do.',
      keyArguments: [
        '“General welfare” is a purpose so broad it excludes nothing.',
        'Necessary and proper lets Congress choose any means to its ends.',
        'Concurrent taxation must end with the national government crowding the states out of their own revenue.'
      ],
      whyItMattered:
        'Hamilton’s Federalist 23 and 33 met the charge head-on: the clauses grant nothing beyond the powers already given.',
      talkItOver: 'Where would you draw the line between a power’s letter and its reach?',
      repliesTo: [23, 33],
      loc: { lccn: 'sn83030566', date: '1787-12-27', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-vi/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030566/1787-12-27/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-10',
    tah: 'https://teachingamericanhistory.org/document/brutus-x/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 10,
      title: 'The Danger of Standing Armies',
      topic: 'Standing Armies',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1788-01-24',
      publicationDateLabel: 'For the New-York Journal. Thursday, January 24, 1788',
      recipient: 'To the People of the State of New-York.',
      indexSummary:
        'Warns that unlimited power to raise standing armies in peacetime endangers the republic.',
      nutshell:
        'Standing armies in peacetime, Brutus argues, have been the instrument by which free governments die—and the Constitution sets no limit on raising them. He asks for what the plan omits: a hard constitutional check on military establishments when there is no war.',
      keyArguments: [
        'History’s republics fell to armies kept in peace, from Rome to Cromwell’s England.',
        'The two-year appropriation clause is a parchment restraint, not a barrier.',
        'Defense needs can be met by militia and by armies raised when danger actually appears.'
      ],
      whyItMattered:
        'Hamilton devoted Federalist 24–29 to the military question, arguing union itself was the best security against large establishments.',
      talkItOver: 'What counts as a “standing army” in an age of permanent defense budgets?',
      repliesTo: [24, 25, 26, 27, 28, 29],
      loc: { lccn: 'sn83030566', date: '1788-01-24', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-x/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030566/1788-01-24/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-12',
    tah: 'https://teachingamericanhistory.org/document/brutus-xii/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 12,
      title: 'Courts That Will Enlarge the Government',
      topic: 'Judicial Power',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1788-02-07',
      publicationDateLabel: 'For the New-York Journal. Thursday, February 7, 1788',
      recipient: 'To the People of the State of New-York.',
      indexSummary:
        'Predicts federal courts will read the Constitution expansively and carry consolidation forward.',
      nutshell:
        'The courts, Brutus argues, are where consolidation will actually happen. Empowered to construe the Constitution “in equity”—by its spirit and reasoning, not its letter alone—federal judges will steadily enlarge national power, and every enlargement they approve becomes precedent for the next.',
      keyArguments: [
        'Judicial construction, not amendment, will settle what the Constitution means.',
        'Courts deciding by spirit rather than letter can extend power without appearing to.',
        'Legislatures will follow the judges’ lead, sheltered by their authority.'
      ],
      whyItMattered:
        'Hamilton’s Federalist 78 answered with the judiciary as the “least dangerous” branch—an exchange still cited on both sides of arguments over judicial power.',
      talkItOver: 'Is a constitution what it says, or what its judges say it says?',
      repliesTo: [78],
      loc: { lccn: 'sn83030566', date: '1788-02-07', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-xii/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030566/1788-02-07/ed-1/'
        }
      ]
    }
  },
  {
    slug: 'brutus-15',
    tah: 'https://teachingamericanhistory.org/document/brutus-xv/',
    frontmatter: {
      series: 'Brutus',
      seriesNumber: 15,
      title: 'Judges Accountable to No One',
      topic: 'Judicial Independence',
      author: 'Robert Yates',
      authorCertainty: 'disputed',
      publicationVenue: 'The New-York Journal',
      publicationDate: '1788-03-20',
      publicationDateLabel: 'For the New-York Journal. Thursday, March 20, 1788',
      recipient: 'To the People of the State of New-York.',
      indexSummary:
        'Argues life-tenured judges, subject to no correction, stand above the Constitution itself.',
      nutshell:
        'Brutus closes his case against the judiciary at its sharpest point: judges holding office during good behavior, whose errors no legislature can correct, and whose power reaches the Constitution’s meaning itself, are “independent of heaven itself.”',
      keyArguments: [
        'Federal judges answer to no earthly correction short of impeachment for crimes.',
        'Even Britain lets Parliament overrule its courts’ constructions of law.',
        'Errors of the supreme court become permanent parts of the Constitution.'
      ],
      whyItMattered:
        'Read beside Federalist 78 and 81, this is the debate’s fullest exchange on judicial power, and the one classrooms still assign.',
      talkItOver: 'Who should have the last word on what a constitution means?',
      repliesTo: [78, 81],
      loc: { lccn: 'sn83030566', date: '1788-03-20', page: 2 },
      sources: [
        {
          label: 'Teaching American History source text',
          url: 'https://teachingamericanhistory.org/document/brutus-xv/'
        },
        {
          label: 'Library of Congress — original issue',
          url: 'https://www.loc.gov/resource/sn83030566/1788-03-20/ed-1/'
        }
      ]
    }
  }
];

async function fetchBody(url, frontmatter) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  const dom = new JSDOM(await response.text());
  const container = dom.window.document.querySelector(
    '.elementor-widget-theme-post-content'
  );
  if (!container) throw new Error(`${url}: no theme-post-content container`);

  // Salutation comparison tolerates TAH's hyphenation drift ("New York"
  // vs "New-York") and the trailing period.
  const normalizeSalutation = (text) =>
    text.replace(/\.$/, '').replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();

  const paragraphs = [...container.querySelectorAll('p')]
    .map((p) =>
      p.textContent
        // TAH wraps its ellipsis abridgment marks in zero-width spaces.
        .replace(/[\u200B\uFEFF]/g, '')
        // Strip TAH's injected footnote reference markers ("[1]").
        .replace(/\[\d+\]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    // Drop TAH's salutation line if present — the recipient renders from
    // frontmatter.
    .filter((text) => normalizeSalutation(text) !== normalizeSalutation(frontmatter.recipient));

  const signature = frontmatter.series.toUpperCase();
  const signatureIndex = paragraphs.findIndex(
    // TAH renders the signature in title case ("Brutus."); match
    // case-insensitively and emit the canonical uppercase form.
    (text) => text.replace(/[.\s]/g, '').toUpperCase() === signature
  );
  let body;
  if (signatureIndex !== -1) {
    body = paragraphs.slice(0, signatureIndex);
  } else {
    // TAH omits the closing signature line on several transcriptions; the
    // originals were all signed. Drop a trailing printer's device (Brutus
    // XII part one closes "(To be continued.)") and restore the signature.
    body = [...paragraphs];
    if (/^\(to be continued\.?\)$/i.test(body[body.length - 1])) body.pop();
  }
  body.push(signature);
  return body.join('\n\n');
}

await mkdir(OUT_DIR, { recursive: true });

for (const essay of ESSAYS) {
  if (essay.skip) {
    console.log(`${essay.slug}: skipped — ${essay.skip}`);
    continue;
  }
  const body = await fetchBody(essay.tah, essay.frontmatter);
  const yamlText = stringify(essay.frontmatter, {
    defaultStringType: 'QUOTE_DOUBLE',
    defaultKeyType: 'PLAIN',
    lineWidth: 0
  });
  const file = `---\n${yamlText}---\n\n${body}\n`;
  const path = new URL(`${essay.slug}.md`, OUT_DIR);

  if (!options.has('--force')) {
    try {
      await readFile(path, 'utf8');
      throw new Error(`${essay.slug}.md already exists. Pass --force to replace imported content.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  await writeFile(path, file, 'utf8');
  const words = body.split(/\s+/).length;
  console.log(`${essay.slug}: ${words} words — opens “${body.slice(0, 70)}…”`);
}
console.log('Import complete. Verify openings/closings before committing.');
