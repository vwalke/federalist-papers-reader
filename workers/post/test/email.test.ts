// workers/post/test/email.test.ts
import { describe, expect, it } from 'vitest';
import { renderConfirmation, renderIssue, renderMakeupIssue, renderWelcome } from '../src/email';
import debate from '../content/debate.json';
import type { DebateItem, EssayContent, PaperContent } from '../src/types';

const items = debate.items as DebateItem[];
const papers = items.filter((item): item is PaperContent => item.kind === 'paper');
const essays = items.filter((item): item is EssayContent => item.kind === 'essay');

const CTX = {
  siteUrl: 'https://federalistreader.org',
  postalAddress: 'WalkeForward, LLC · 1 Test Lane, Anywhere USA',
  manageUrl: 'https://federalistreader.org/manage?token=T',
  unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=U'
};

describe('renderIssue', () => {
  const one = papers.find((p) => p.number === 1)!;

  it('renders subject, dateline, nutshell, link, and footer for a paper', () => {
    const mail = renderIssue([one], { ...CTX, progressLine: '2 of 93 · The Weekly Course' });
    expect(mail.subject).toBe('Federalist No. 1 — General Introduction');
    expect(mail.html).toContain('The F&oelig;deralist');
    expect(mail.html).toContain('Saturday, October 27, 1787');
    expect(mail.html).toContain('naming the stakes');
    expect(mail.html).toContain('https://federalistreader.org/papers/1/');
    expect(mail.html).toContain('2 of 93');
    expect(mail.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
    expect(mail.html).not.toContain('@ReadPublius');
    expect(mail.html).toContain(CTX.manageUrl);
    expect(mail.html).toContain(CTX.unsubscribeUrl);
    expect(mail.html).toContain(CTX.postalAddress);
    expect(mail.text).toContain('https://federalistreader.org/papers/1/');
  });

  it('renders an essay under the Journal masthead with its own signature', () => {
    const brutus = essays.find((essay) => essay.id === 101)!;
    const mail = renderIssue([brutus], CTX);
    expect(mail.subject).toBe('Brutus No. I — Against the Consolidated Republic');
    expect(mail.html).toContain('The New-York Journal');
    expect(mail.html).not.toContain('The F&oelig;deralist');
    expect(mail.html).toContain('For the New-York Journal. Thursday, October 18, 1787');
    expect(mail.html).toContain('BRUTUS. No. I. &mdash; Against the Consolidated Republic');
    expect(mail.html).toContain('To the Citizens of the State of New-York.');
    expect(mail.html).toContain('BRUTUS.</p>');
    expect(mail.html).toContain('Continue Reading at the Journal');
    expect(mail.html).toContain('https://federalistreader.org/antifederalist/brutus-1/');
    expect(mail.html).toContain('Talk it over.');
    expect(mail.html).toContain(CTX.manageUrl);
    expect(mail.html).toContain(CTX.unsubscribeUrl);
    expect(mail.text).toContain('BRUTUS.');
    expect(mail.text).toContain('https://federalistreader.org/antifederalist/brutus-1/');
  });

  it('signs Cato essays CATO', () => {
    const cato = essays.find((essay) => essay.id === 154)!;
    const mail = renderIssue([cato], CTX);
    expect(mail.subject).toContain('Cato No. IV');
    expect(mail.html).toContain('CATO.</p>');
    expect(mail.html).toContain('https://federalistreader.org/antifederalist/cato-4/');
  });

  it('renders a combined subject for multi-paper issues', () => {
    const two = papers.find((p) => p.number === 2)!;
    const mail = renderIssue([one, two], CTX);
    expect(mail.subject).toBe('Federalist Nos. 1 & 2');
    expect(mail.html).toContain('General Introduction');
    expect(mail.html).toContain(two.title);
  });

  it('names both sides in a mixed issue subject and keeps the Gazette masthead', () => {
    const brutus = essays.find((essay) => essay.id === 101)!;
    const mail = renderIssue([one, brutus], CTX);
    expect(mail.subject).toBe('Federalist No. 1 & Brutus No. I');
    expect(mail.html).toContain('The F&oelig;deralist');
  });

  it('escapes HTML in content fields', () => {
    const evil = { ...one, title: 'x <script>alert(1)</script>' };
    const mail = renderIssue([evil], CTX);
    expect(mail.html).not.toContain('<script>alert(1)');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('renderMakeupIssue', () => {
  const owed = essays.filter((essay) => [101, 102, 154].includes(essay.id));

  it('bundles the owed essays under the Journal masthead with the standard footer', () => {
    const mail = renderMakeupIssue(owed, CTX);
    expect(mail.subject).toBe('The other side of the argument — a catch-up from the New-York Journal');
    expect(mail.html).toContain('The New-York Journal');
    expect(mail.html).toContain('The ratification debate had two sides.');
    expect(mail.html).toContain('ran before the point you have reached');
    for (const essay of owed) {
      expect(mail.html).toContain(essay.displayName);
      expect(mail.html).toContain(`https://federalistreader.org/antifederalist/${essay.slug}/`);
    }
    expect(mail.html).toContain('Brutus No. I &mdash; Against the Consolidated Republic');
    expect(mail.html).toContain(CTX.manageUrl);
    expect(mail.html).toContain(CTX.unsubscribeUrl);
    expect(mail.html).toContain(CTX.postalAddress);
  });

  it('mirrors the essays and footer into the text part', () => {
    const mail = renderMakeupIssue(owed, CTX);
    expect(mail.text).toContain('The ratification debate had two sides.');
    expect(mail.text).toContain('Brutus No. I — Against the Consolidated Republic');
    expect(mail.text).toContain('https://federalistreader.org/antifederalist/cato-4/');
    expect(mail.text).toContain(CTX.manageUrl);
    expect(mail.text).not.toContain('<');
  });
});

describe('confirmation and welcome', () => {
  it('confirmation names both sides and carries the confirm link', () => {
    const mail = renderConfirmation('https://federalistreader.org/api/confirm?token=C', CTX);
    expect(mail.html).toContain('/api/confirm?token=C');
    expect(mail.subject).toContain('Confirm');
    expect(mail.html).toContain('the eighty-five Federalist papers and the eight essays that answered them');
    expect(mail.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
    expect(mail.html).not.toContain('@ReadPublius');
  });
  it('welcome states the first delivery expectation per program', () => {
    const weekly = renderWelcome('weekly', 'July 21, 2026', 'Tuesday', CTX);
    expect(weekly.html).toContain('Brutus No. I');
    expect(weekly.html).toContain('Tuesday, July 21, 2026');
    expect(weekly.html).toContain('each Tuesday');
    expect(weekly.html).toContain('the eighty-five papers and the eight essays that answered them');
    expect(weekly.html).toContain('Change your delivery day');
    expect(weekly.html).not.toMatch(/https:\/\/(?:x\.com|twitter\.com)\//);
    expect(weekly.html).not.toContain('@ReadPublius');
    expect(weekly.html).toContain(CTX.manageUrl);
    expect(weekly.html).toContain(CTX.unsubscribeUrl);
    expect(weekly.html).toContain(CTX.postalAddress);
    const calendar = renderWelcome('calendar', 'October 18', 'Saturday', CTX);
    expect(calendar.html).toContain('October 18');
    expect(calendar.html).toContain('each paper and essay arrives on the anniversary');
    expect(calendar.html).not.toContain('Change your delivery day');
  });
  it('welcome text carries the delivery date, manage link, and no HTML residue', () => {
    const weekly = renderWelcome('weekly', 'July 21, 2026', 'Tuesday', CTX);
    expect(weekly.text).toContain('Tuesday, July 21, 2026');
    expect(weekly.text).toContain(CTX.manageUrl);
    const calendar = renderWelcome('calendar', 'October 18', 'Saturday', CTX);
    expect(calendar.text).toContain('October 18');
    for (const text of [weekly.text, calendar.text]) {
      expect(text).not.toContain('&oelig;');
      expect(text).not.toContain('<');
    }
  });
});
