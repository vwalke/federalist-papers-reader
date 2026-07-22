import manifest from './printings-images.json';

// The print room: original newspaper printings from Seth Kaller, Inc.
// Captions condense Kaller's catalog descriptions, used with permission.
// The Rubenstein flags follow Seth's credit instructions (22899.44 explicitly;
// the New-York Packet issue per its DMR-labelled catalog description) and can
// be adjusted if he corrects the mapping.

export interface PrintingPageImage {
  page: number;
  alt: string;
  thumb: { w: number; h: number };
  large: { w: number; h: number };
}

export interface Printing {
  slug: string;
  inventory: string;
  paperNumber: number | null;
  newspaper: string;
  imprint: string;
  heading: string;
  caption: string[];
  excerpt?: string;
  pages: PrintingPageImage[];
  rubenstein: boolean;
}

interface PrintingSource extends Omit<Printing, 'pages'> {
  pageAlts: string[];
}

const sources: PrintingSource[] = [
  {
    slug: 'federalist-2-pennsylvania-journal',
    inventory: '22899.44',
    paperNumber: 2,
    newspaper: 'The Pennsylvania Journal; and the Weekly Advertiser',
    imprint: 'Philadelphia: Thomas Bradford. November 10, 1787.',
    heading: 'Federalist No. 2 reaches Philadelphia',
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
    rubenstein: true
  },
  {
    slug: 'federalist-85-new-york-packet',
    inventory: '21076',
    paperNumber: 85,
    newspaper: 'The New-York Packet',
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
    rubenstein: true
  },
  {
    slug: 'new-haven-gazette-1787',
    inventory: '25030',
    paperNumber: null,
    newspaper: 'The New-Haven Gazette, and the Connecticut Magazine',
    imprint: 'New Haven, Connecticut. October 25, 1787.',
    heading: 'Two days before Publius',
    caption: [
      'The stage being set. This Connecticut magazine of October 25, 1787 prints Congress’s resolution transmitting the new Constitution to the states and Connecticut’s call for a ratifying convention—together with the letter from Roger Sherman and Oliver Ellsworth reporting the Philadelphia convention’s work to Governor Huntington. Federalist No. 1 would not appear in New York until two days later.'
    ],
    pageAlts: [
      'Front page of the New-Haven Gazette and Connecticut Magazine of October 25, 1787, printing Congress’s resolution transmitting the Constitution to the states',
      'Page two of the New-Haven Gazette of October 25, 1787',
      'Page three of the New-Haven Gazette of October 25, 1787',
      'Page four of the New-Haven Gazette of October 25, 1787',
      'Page five of the New-Haven Gazette of October 25, 1787',
      'Page six of the New-Haven Gazette of October 25, 1787, with Roger Sherman and Oliver Ellsworth’s letter to Governor Huntington',
      'Page seven of the New-Haven Gazette of October 25, 1787',
      'Back page of the New-Haven Gazette of October 25, 1787'
    ],
    rubenstein: false
  },
  {
    slug: 'massachusetts-centinel-1788',
    inventory: '30282',
    paperNumber: null,
    newspaper: 'The Massachusetts Centinel',
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
    ],
    rubenstein: false
  }
];

const manifestBySlug = manifest as Record<
  string,
  { page: number; thumb: { w: number; h: number }; large: { w: number; h: number } }[]
>;

export const printings: Printing[] = sources.map(({ pageAlts, ...printing }) => {
  const images = manifestBySlug[printing.slug];
  if (!images) throw new Error(`No generated images for printing "${printing.slug}"`);
  if (images.length !== pageAlts.length) {
    throw new Error(
      `Printing "${printing.slug}" has ${pageAlts.length} alt texts for ${images.length} images`
    );
  }
  return {
    ...printing,
    pages: images.map((image, index) => ({ ...image, alt: pageAlts[index] }))
  };
});

export function getPrintingForPaper(number: number): Printing | undefined {
  return printings.find((printing) => printing.paperNumber === number);
}

export function printingImagePath(
  printing: Printing,
  page: number,
  variant: 'thumb' | 'large',
  format: 'jpg' | 'avif'
): string {
  return `/images/printings/${printing.slug}/page-${page}-${variant}.${format}`;
}
