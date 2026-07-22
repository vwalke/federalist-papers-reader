import manifest from './printings-images.json';

// The print room: original newspaper printings from Seth Kaller, Inc.
// Captions condense Kaller's catalog descriptions, used with permission.
// Credit lines follow Seth's corrected table of 2026-07-22: Rubenstein on
// 27488, 22899.44, 26169, 25693, and 24854 (the New-York Packet Federalist 85,
// originally mislabelled 21076); the Federalist 13 Centinel is at the Peoria
// Riverfront Museum.

const RUBENSTEIN = 'Collection of David M. Rubenstein.';

export interface PrintingPageImage {
  page: number;
  alt: string;
  /** Strip label, e.g. "Front page", "Page 2", "Detail". */
  label: string;
  thumb: { w: number; h: number };
  large: { w: number; h: number };
}

export interface Printing {
  slug: string;
  inventory: string;
  /** Federalist essay numbers this printing carries; empty for context items. */
  paperNumbers: number[];
  newspaper: string;
  /** Compact name plus date for running prose, e.g. "the New-York Packet of August 15, 1788". */
  proseName: string;
  imprint: string;
  heading: string;
  /** Paragraphs; may carry inline HTML (rendered with set:html — authored constants only). */
  caption: string[];
  excerpt?: string;
  /** Essay number the excerpt quotes; defaults to the first of paperNumbers. */
  excerptFrom?: number;
  pages: PrintingPageImage[];
  /** Collection or location line shown under the entry, e.g. the Rubenstein credit. */
  credit?: string;
}

interface PrintingSource extends Omit<Printing, 'pages'> {
  pageAlts: string[];
  pageLabels?: string[];
}

const sources: PrintingSource[] = [
  {
    slug: 'federalist-1-pennsylvania-journal',
    inventory: '27488',
    paperNumbers: [1],
    newspaper: 'The Pennsylvania Journal; and the Weekly Advertiser',
    proseName: 'the Pennsylvania Journal of November 7, 1787',
    imprint: 'Philadelphia: Thomas Bradford. November 7, 1787.',
    heading: 'Publius reaches Philadelphia — on page one',
    caption: [
      'Eleven days after Federalist No. 1 opened the series in New York, Philadelphia read it on the front page. The Pennsylvania Journal of November 7, 1787 sets Hamilton’s introduction in its right-hand column, credited “From the New-York Packet”—the opening question of the whole enterprise, whether good government can be founded on reflection and choice rather than accident and force.',
      'This is issue No. 2215; the very next issue of the same paper, No. 2216 of November 10, carried Federalist No. 2, and both now hang together in this print room.'
    ],
    excerpt:
      'It seems to have been reserved to the people of this country, by their conduct and example, to decide the important question, whether societies of men are really capable or not, of establishing good government from reflection and choice, or whether they are forever destined to depend, for their political constitutions, on accident and force.',
    pageAlts: [
      'Front page of the Pennsylvania Journal and Weekly Advertiser of November 7, 1787, carrying Federalist No. 1 in its right-hand column',
      'Page two of the Pennsylvania Journal of November 7, 1787',
      'Page three of the Pennsylvania Journal of November 7, 1787',
      'Back page of the Pennsylvania Journal of November 7, 1787, with advertisements and Thomas Bradford’s printer’s line'
    ],
    credit: RUBENSTEIN
  },
  {
    slug: 'federalist-2-pennsylvania-journal',
    inventory: '22899.44',
    paperNumbers: [2],
    newspaper: 'The Pennsylvania Journal; and the Weekly Advertiser',
    proseName: 'the Pennsylvania Journal of November 10, 1787',
    imprint: 'Philadelphia: Thomas Bradford. November 10, 1787.',
    heading: 'Federalist No. 2 follows in the next issue',
    caption: [
      'Ten days after John Jay opened his case for Union in New York, Philadelphia readers met it here. The Pennsylvania Journal reprinted Federalist No. 2 from its first New York appearance while Pennsylvania was fighting over the Constitution in its own ratifying convention—proof, in ink, of how quickly Publius traveled beyond New York.',
      'Jay begins with the question beneath every other question of the debate: whether America should be one nation under one federal government, or several confederacies. Government is indispensable, he argues, and the people must cede some natural rights to give it requisite powers—so the only real choice is what form best protects their safety and interests.'
    ],
    excerpt:
      'Nothing is more certain than the indispensable necessity of government, and it is equally undeniable, that whenever and however it is instituted, the people must cede to it some of their natural rights in order to vest it with requisite powers.',
    pageAlts: [
      'Front page of the Pennsylvania Journal and Weekly Advertiser of November 10, 1787',
      'Page two of the Pennsylvania Journal of November 10, 1787, carrying Federalist No. 2 in its first two columns',
      'Page three of the Pennsylvania Journal of November 10, 1787',
      'Back page of the Pennsylvania Journal of November 10, 1787, with advertisements and notices'
    ],
    credit: RUBENSTEIN
  },
  {
    slug: 'federalist-7-8-new-york-packet',
    inventory: '26169',
    paperNumbers: [7, 8],
    newspaper: 'The New-York Packet',
    proseName: 'the New-York Packet of November 20, 1787',
    imprint: 'New York: Samuel and John Loudon. November 20, 1787.',
    heading: 'The first printing of No. 8 — and a publishing announcement',
    caption: [
      'A surviving detail from the issue that printed Federalist No. 8 for the first time anywhere, with No. 7 alongside. Hamilton’s pair imagines disunion honestly: No. 7 counts the quarrels—territory, commerce, the public debt—that would set the states against each other, and No. 8 follows the logic to standing armies and the slow trade of liberty for safety.',
      'Look above the heading: a printers’ note announces that, so the whole subject can be laid before the public as fast as possible, Publius will now appear four times a week—“on Tuesday in the New-York Packet, and Thursday in the Daily Advertiser.” The series had found its audience.'
    ],
    excerpt:
      'To be more safe, they at length become willing to run the risk of being less free.',
    excerptFrom: 8,
    pageAlts: [
      'Detail of the New-York Packet of November 20, 1787, showing the heading of Federalist No. 8 beneath the printers’ note announcing publication four times a week'
    ],
    pageLabels: ['Detail'],
    credit: RUBENSTEIN
  },
  {
    slug: 'federalist-13-massachusetts-centinel',
    inventory: '26566',
    paperNumbers: [13],
    newspaper: 'The Massachusetts Centinel',
    proseName: 'the Massachusetts Centinel of December 8, 1787',
    imprint: 'Boston: Benjamin Russell. December 8, 1787.',
    heading: 'Publius, introduced to New England',
    caption: [
      'Federalist No. 13 leads page two of Benjamin Russell’s stoutly Federalist Centinel—the essay’s first appearance outside New York. An introductory note signed “Philo-Publius” commends it to the printer: the Constitution’s critics had proposed no substitute beyond carving America into “three great republicks,” and here was the essay that demonstrated the scheme’s ineligibility.',
      'Hamilton’s argument is economy: one Union needs one national civil list, while separate confederacies would each need a government as extensive as the one proposed—plus the customs officers and armies their jealousies would breed.'
    ],
    excerpt:
      'A separation would be not less injurious to the economy than to the tranquility, commerce, revenue and liberty of every part.',
    pageAlts: [
      'Front page of the Massachusetts Centinel of December 8, 1787',
      'Page two of the Massachusetts Centinel of December 8, 1787, with Federalist No. 13 leading the first column under a Philo-Publius introduction'
    ],
    credit: 'Now at the Peoria Riverfront Museum.'
  },
  {
    slug: 'federalist-85-new-york-packet',
    inventory: '24854',
    paperNumbers: [85],
    newspaper: 'The New-York Packet',
    proseName: 'the New-York Packet of August 15, 1788',
    imprint: 'New York: Samuel and John Loudon. August 15, 1788.',
    heading: 'Publius takes his leave',
    caption: [
      'The last Federalist essay, complete on page two of this issue. Numbers 78 through 85 appeared first in the M‘Lean book edition of May 1788, so the newspapers printed the conclusion months after New York had already ratified—this sheet also reports North Carolina’s initial rejection of the Constitution and a Flushing celebration of the new federal roof.',
      'Hamilton closes the whole enterprise with an argument for adopting the imperfect: amendments will be easier to obtain after ratification than before, and a nation cannot stay suspended between governments while it chases a perfect plan.'
    ],
    excerpt:
      'A Nation without a National Government is, in my view, an awful spectacle. The establishment of a Constitution, in time of profound peace, by the voluntary consent of a whole people, is a Prodigy, to the completion of which I look forward with trembling anxiety.',
    pageAlts: [
      'Front page of the New-York Packet of August 15, 1788',
      'Page two of the New-York Packet of August 15, 1788, printing Federalist No. 85 in full',
      'Page three of the New-York Packet of August 15, 1788',
      'Back page of the New-York Packet of August 15, 1788'
    ],
    credit: RUBENSTEIN
  },
  {
    slug: 'new-haven-gazette-1787',
    inventory: '25030',
    paperNumbers: [],
    newspaper: 'The New-Haven Gazette, and the Connecticut Magazine',
    proseName: 'the New-Haven Gazette of October 25, 1787',
    imprint: 'New Haven, Connecticut. October 25, 1787.',
    heading: 'Two days before Publius',
    caption: [
      'The stage being set. This Connecticut magazine of October 25, 1787 prints Congress’s resolution transmitting the new Constitution to the states and Connecticut’s call for a ratifying convention—together with the letter from Roger Sherman and Oliver Ellsworth reporting the Philadelphia convention’s work to Governor Huntington. Federalist No. 1 would not appear in New York until two days later.',
      'Look closely at the front page: the resolution goes out over the name of Charles Thomson, the Continental Congress’s only secretary—set by the New Haven compositor as “Charles Thompson,” a misspelling he endured all his life. He is the same Charles Thomson of <a href="/about/">the family thread on our About page</a>, attesting here, in type, to the very act that set the whole ratification debate in motion.'
    ],
    pageAlts: [
      'Front page of the New-Haven Gazette and Connecticut Magazine of October 25, 1787, printing Congress’s resolution transmitting the Constitution to the states over the name of Secretary Charles Thomson, misspelled Thompson',
      'Page two of the New-Haven Gazette of October 25, 1787',
      'Page three of the New-Haven Gazette of October 25, 1787',
      'Page four of the New-Haven Gazette of October 25, 1787',
      'Page five of the New-Haven Gazette of October 25, 1787',
      'Page six of the New-Haven Gazette of October 25, 1787, with Roger Sherman and Oliver Ellsworth’s letter to Governor Huntington',
      'Page seven of the New-Haven Gazette of October 25, 1787',
      'Back page of the New-Haven Gazette of October 25, 1787'
    ]
  },
  {
    slug: 'massachusetts-centinel-1788',
    inventory: '30282',
    paperNumbers: [],
    newspaper: 'The Massachusetts Centinel',
    proseName: 'the Massachusetts Centinel of January 9, 1788',
    imprint: 'Boston: Benjamin Russell. January 9, 1788.',
    heading: 'Massachusetts, mid-debate',
    caption: [
      'The fight Publius was written to win, seen from Boston. On the day Massachusetts’ ratifying convention convened, Benjamin Russell’s stoutly Federalist Centinel addresses the delegates directly and trades arguments over revising constitutions. Within the month, Massachusetts would ratify by nineteen votes—proposing the amendments that pointed toward a bill of rights.'
    ],
    pageAlts: [
      'Front page of the Massachusetts Centinel of January 9, 1788, addressed to the members of the Massachusetts ratifying convention',
      'Page two of the Massachusetts Centinel of January 9, 1788',
      'Page three of the Massachusetts Centinel of January 9, 1788',
      'Back page of the Massachusetts Centinel of January 9, 1788'
    ]
  }
];

const manifestBySlug = manifest as Record<
  string,
  { page: number; thumb: { w: number; h: number }; large: { w: number; h: number } }[]
>;

export const printings: Printing[] = sources.map(({ pageAlts, pageLabels, ...printing }) => {
  const images = manifestBySlug[printing.slug];
  if (!images) throw new Error(`No generated images for printing "${printing.slug}"`);
  if (images.length !== pageAlts.length) {
    throw new Error(
      `Printing "${printing.slug}" has ${pageAlts.length} alt texts for ${images.length} images`
    );
  }
  return {
    ...printing,
    pages: images.map((image, index) => ({
      ...image,
      alt: pageAlts[index],
      label:
        pageLabels?.[index] ?? (image.page === 1 && !pageLabels ? 'Front page' : `Page ${image.page}`)
    }))
  };
});

export function getPrintingForPaper(number: number): Printing | undefined {
  return printings.find((printing) => printing.paperNumbers.includes(number));
}

/** In-page anchor id, e.g. "federalist-2" or "federalist-7-8"; context items use their slug. */
export function printingAnchor(printing: Printing): string {
  return printing.paperNumbers.length > 0
    ? `federalist-${printing.paperNumbers.join('-')}`
    : printing.slug;
}

/** "No. 2" or "Nos. 7 & 8" for headings and links. */
export function formatPaperNumbers(printing: Printing): string {
  const numbers = printing.paperNumbers;
  return numbers.length > 1 ? `Nos. ${numbers.join(' & ')}` : `No. ${numbers[0]}`;
}

export function printingImagePath(
  printing: Printing,
  page: number,
  variant: 'thumb' | 'large',
  format: 'jpg' | 'avif'
): string {
  return `/images/printings/${printing.slug}/page-${page}-${variant}.${format}`;
}
