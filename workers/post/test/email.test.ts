// workers/post/test/email.test.ts
import { describe, expect, it } from 'vitest';
import { renderConfirmation, renderPaperIssue, renderWelcome } from '../src/email';
import papers from '../content/papers.json';

const CTX = {
  siteUrl: 'https://federalistreader.org',
  postalAddress: 'WalkeForward, LLC · 1 Test Lane, Anywhere USA',
  manageUrl: 'https://federalistreader.org/manage?token=T',
  unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=U'
};

describe('renderPaperIssue', () => {
  const one = papers.find((p) => p.number === 1)!;

  it('renders subject, dateline, nutshell, link, and footer', () => {
    const mail = renderPaperIssue([one], { ...CTX, progressLine: 'Paper 1 of 85 · The Weekly Course' });
    expect(mail.subject).toBe('Federalist No. 1 — General Introduction');
    expect(mail.html).toContain('Saturday, October 27, 1787');
    expect(mail.html).toContain('naming the stakes');
    expect(mail.html).toContain('https://federalistreader.org/papers/1/');
    expect(mail.html).toContain('Paper 1 of 85');
    expect(mail.html).toContain(CTX.unsubscribeUrl);
    expect(mail.html).toContain(CTX.postalAddress);
    expect(mail.text).toContain('https://federalistreader.org/papers/1/');
  });

  it('renders a combined subject for multi-paper issues', () => {
    const two = papers.find((p) => p.number === 2)!;
    const mail = renderPaperIssue([one, two], CTX);
    expect(mail.subject).toBe('Federalist Nos. 1 & 2');
    expect(mail.html).toContain('General Introduction');
    expect(mail.html).toContain(two.title);
  });

  it('escapes HTML in content fields', () => {
    const evil = { ...one, title: 'x <script>alert(1)</script>' };
    const mail = renderPaperIssue([evil], CTX);
    expect(mail.html).not.toContain('<script>alert(1)');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});

describe('confirmation and welcome', () => {
  it('confirmation carries the confirm link and no unsubscribe requirement', () => {
    const mail = renderConfirmation('https://federalistreader.org/api/confirm?token=C', CTX);
    expect(mail.html).toContain('/api/confirm?token=C');
    expect(mail.subject).toContain('Confirm');
  });
  it('welcome states the first delivery expectation per program', () => {
    const weekly = renderWelcome('weekly', '2026-07-25', CTX);
    expect(weekly.html).toContain('2026-07-25');
    const calendar = renderWelcome('calendar', '2026-10-27', CTX);
    expect(calendar.html).toContain('October 27');
  });
  it('welcome text carries the delivery date, manage link, and no HTML residue', () => {
    const weekly = renderWelcome('weekly', '2026-07-25', CTX);
    expect(weekly.text).toContain('2026-07-25');
    expect(weekly.text).toContain(CTX.manageUrl);
    const calendar = renderWelcome('calendar', '2026-10-27', CTX);
    expect(calendar.text).toContain('October 27');
    for (const text of [weekly.text, calendar.text]) {
      expect(text).not.toContain('&oelig;');
      expect(text).not.toContain('<');
    }
  });
});
