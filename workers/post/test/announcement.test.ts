// workers/post/test/announcement.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIH_SEASON_ANNOUNCEMENT } from '../src/announcement';
import { runAnnouncement, runDaily } from '../src/deliver';
import type { Db } from '../src/db';
import type { EmailContext } from '../src/email';
import type { Env, Subscriber } from '../src/types';
import type { BatchEmailOutcome, OutboundEmail } from '../src/resend';
import { verifyToken } from '../src/tokens';

const ENV = {
  SITE_URL: 'https://federalistreader.org', FROM_ADDRESS: 'Publius <p@f.org>',
  RESEND_API_KEY: 'k', TOKEN_SECRET: 's', POSTAL_ADDRESS: '1 Wall St, New York, NY'
} as Env;

const CTX: EmailContext = {
  siteUrl: 'https://federalistreader.org',
  postalAddress: 'PO Box 1787',
  manageUrl: 'https://federalistreader.org/manage?token=MANAGE_TOK',
  unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=UNSUB_TOK'
};

const SWITCH_LINE = 'If you’re on the Weekly Course, nothing changes for you.';
const ALREADY_SET = 'You’re already on As It Happened, so you’re all set for the season.';

function sub(overrides: Partial<Subscriber>): Subscriber {
  return {
    id: 1, email: 'a@example.com', program: 'weekly', status: 'active',
    progress_index: 4, send_dow: 6, paused_until: null, makeup_pending: 0,
    token_secret: 'ts', confirmed_at: '2026-07-01T00:00:00Z', ...overrides
  };
}

/** A stub with a real claim table, so reruns behave as they would on D1. */
function makeStubDb(subscribers: Subscriber[]) {
  const claims = new Map<string, { status: string; messageId?: string }>();
  const db = {
    claims,
    recordEmailSend: vi.fn(async () => {}),
    purgeEmailSends: vi.fn(async () => {}),
    getSubscriberById: vi.fn(async (id: number) => subscribers.find((s) => s.id === id) ?? null),
    purgeUnsubscribed: vi.fn(async () => {}),
    purgeStalePending: vi.fn(async () => {}),
    setProgress: vi.fn(async () => {}),
    clearMakeupPending: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => subscribers.filter((s) => s.status === 'active')),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async () => true),
    markDelivery: vi.fn(async () => {}),
    listRetryable: vi.fn(async () => []),
    claimAnnouncement: vi.fn(async (id: number, announcementId: string) => {
      const key = `${id}:${announcementId}`;
      if (claims.has(key)) return false;
      claims.set(key, { status: 'queued' });
      return true;
    }),
    markAnnouncement: vi.fn(async (id: number, announcementId: string, status: string, messageId?: string) => {
      claims.set(`${id}:${announcementId}`, { status, messageId });
    }),
    listRetryableAnnouncement: vi.fn(async (announcementId: string) =>
      subscribers.filter((s) => s.status === 'active' &&
        claims.get(`${s.id}:${announcementId}`)?.status === 'failed')),
    recordDailyRun: vi.fn(async () => {})
  };
  return db as unknown as Db & typeof db;
}

describe('AIH season announcement copy', () => {
  it('uses the approved subject', () => {
    expect(AIH_SEASON_ANNOUNCEMENT.render('weekly', CTX).subject)
      .toBe('The Debate Begins Again on October 18');
  });

  for (const program of ['weekly', 'calendar'] as const) {
    it(`fills every placeholder for a ${program} reader`, () => {
      const mail = AIH_SEASON_ANNOUNCEMENT.render(program, CTX);
      for (const body of [mail.html, mail.text]) {
        expect(body).not.toMatch(/\{\{[^}]*\}\}/);
        expect(body).toContain(CTX.manageUrl);
        expect(body).toContain(CTX.unsubscribeUrl);
        expect(body).toContain(CTX.postalAddress);
      }
    });

    it(`keeps the pass-it-along paragraph, share row, and sign-off for a ${program} reader`, () => {
      const { html, text } = AIH_SEASON_ANNOUNCEMENT.render(program, CTX);
      expect(html).toContain('In the spirit of 1787');
      expect(html).toContain('href="mailto:?subject=The%20ratification%20debate');
      expect(html).toContain('href="https://twitter.com/intent/tweet?text=');
      expect(html).toContain('href="https://www.facebook.com/sharer/sharer.php?u=');
      expect(html).toContain('margin-bottom:0;">Publius</p>');
      expect(text).toContain('Share on X: https://twitter.com/intent/tweet');
      expect(text).toMatch(/\n\nPublius\n\n/);
    });
  }

  it('centers the summary line in italic with no teal rule', () => {
    const { html } = AIH_SEASON_ANNOUNCEMENT.render('weekly', CTX);
    const summary = html.match(/<div style="([^"]*)">Starting October 18, As It Happened/);
    expect(summary?.[1]).toContain('text-align:center');
    expect(summary?.[1]).toContain('font-style:italic');
    expect(summary?.[1]).not.toContain('border-left');
  });

  it('offers weekly readers the switch button pointing at their manage link', () => {
    const { html, text } = AIH_SEASON_ANNOUNCEMENT.render('weekly', CTX);
    expect(html).toContain(SWITCH_LINE);
    expect(html).toMatch(/<a href="https:\/\/federalistreader\.org\/manage\?token=MANAGE_TOK"[^>]*>Switch to As It Happened<\/a>/);
    expect(html).not.toContain(ALREADY_SET);
    expect(text).toContain(`you can switch here: ${CTX.manageUrl}`);
  });

  it('tells calendar readers they are set, without the switch paragraph or button', () => {
    const { html, text } = AIH_SEASON_ANNOUNCEMENT.render('calendar', CTX);
    expect(html).toContain(ALREADY_SET);
    expect(text).toContain(ALREADY_SET);
    for (const body of [html, text]) {
      expect(body).not.toContain(SWITCH_LINE);
      expect(body).not.toContain('Switch to As It Happened');
      expect(body).not.toContain('switch here');
    }
  });

  it('escapes the manage link in the button href', () => {
    const { html } = AIH_SEASON_ANNOUNCEMENT.render('weekly', {
      ...CTX, manageUrl: 'https://federalistreader.org/manage?token=a&b="c'
    });
    expect(html).toContain('href="https://federalistreader.org/manage?token=a&amp;b=&quot;c"');
  });
});

describe('runAnnouncement', () => {
  let sent: OutboundEmail[];
  let keys: string[];
  let next: number;
  const batchSender = async (
    _key: string,
    mails: OutboundEmail[],
    idempotencyKey: string
  ): Promise<BatchEmailOutcome[]> => {
    keys.push(idempotencyKey);
    sent.push(...mails);
    return mails.map(() => ({ status: 'sent', id: `msg_${next++}` }));
  };
  beforeEach(() => {
    sent = [];
    keys = [];
    next = 1;
  });

  it('is scheduled for Sunday, October 11, 2026', () => {
    expect(AIH_SEASON_ANNOUNCEMENT.sendOn).toBe('2026-10-11');
    expect(new Date(`${AIH_SEASON_ANNOUNCEMENT.sendOn}T00:00:00Z`).getUTCDay()).toBe(0);
  });

  it('sends nothing before the send date', async () => {
    const db = makeStubDb([sub({})]);
    for (const day of ['2026-07-18', '2026-10-09', '2026-10-10']) {
      await runAnnouncement(ENV, db, batchSender, day, AIH_SEASON_ANNOUNCEMENT);
    }
    expect(sent).toHaveLength(0);
    expect(db.claimAnnouncement).not.toHaveBeenCalled();
  });

  it('does not sweep again after the send date', async () => {
    const db = makeStubDb([sub({})]);
    await runAnnouncement(ENV, db, batchSender, '2026-10-12', AIH_SEASON_ANNOUNCEMENT);
    expect(sent).toHaveLength(0);
    expect(db.claimAnnouncement).not.toHaveBeenCalled();
  });

  it('sends each active subscriber their own variant on the send date', async () => {
    const db = makeStubDb([
      sub({ id: 1, email: 'weekly@example.com', program: 'weekly' }),
      sub({ id: 2, email: 'season@example.com', program: 'calendar' }),
      sub({ id: 3, email: 'paused@example.com', status: 'paused' }),
      sub({ id: 4, email: 'gone@example.com', status: 'unsubscribed' }),
      sub({ id: 5, email: 'pending@example.com', status: 'pending', confirmed_at: null })
    ]);
    const result = await runAnnouncement(ENV, db, batchSender, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);

    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(sent.map((m) => m.to)).toEqual(['weekly@example.com', 'season@example.com']);
    expect(sent[0].html).toContain('Switch to As It Happened');
    expect(sent[1].html).not.toContain('Switch to As It Happened');
    expect(sent[1].html).toContain(ALREADY_SET);
    for (const mail of sent) {
      expect(mail.subject).toBe('The Debate Begins Again on October 18');
      expect(mail.from).toBe(ENV.FROM_ADDRESS);
      expect(mail.html).not.toMatch(/\{\{[^}]*\}\}/);
      expect(mail.text).not.toMatch(/\{\{[^}]*\}\}/);
      expect(mail.html).toContain(ENV.POSTAL_ADDRESS);
    }
    expect(db.markAnnouncement).toHaveBeenCalledWith(1, 'aih-season-2026', 'sent', 'msg_1');
    expect(db.markAnnouncement).toHaveBeenCalledWith(2, 'aih-season-2026', 'sent', 'msg_2');
    expect(db.recordEmailSend).toHaveBeenCalledTimes(2);
  });

  it('signs per-subscriber manage and unsubscribe tokens', async () => {
    const db = makeStubDb([sub({ id: 7, token_secret: 'salt7' })]);
    await runAnnouncement(ENV, db, batchSender, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);
    const [mail] = sent;
    const manage = mail.html.match(/\/manage\?token=([^"&]+)/)?.[1];
    const unsub = mail.unsubscribeUrl.match(/\/api\/unsubscribe\?token=(.+)$/)?.[1];
    expect(manage).toBeTruthy();
    expect(unsub).toBeTruthy();
    expect(mail.html).toContain(`${ENV.SITE_URL}/api/unsubscribe?token=${unsub}`);
    expect(mail.text).toContain(`Manage: ${ENV.SITE_URL}/manage?token=${manage}`);
    await expect(verifyToken(decodeURIComponent(manage!), 'manage', ENV.TOKEN_SECRET,
      async () => 'salt7')).resolves.toBe(7);
    await expect(verifyToken(decodeURIComponent(unsub!), 'unsub', ENV.TOKEN_SECRET,
      async () => 'salt7')).resolves.toBe(7);
  });

  it('mails each subscriber at most once across same-day reruns and later days', async () => {
    const db = makeStubDb([sub({ id: 1 }), sub({ id: 2, email: 'b@example.com' })]);
    await runAnnouncement(ENV, db, batchSender, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);
    await runAnnouncement(ENV, db, batchSender, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);
    await runAnnouncement(ENV, db, batchSender, '2026-10-12', AIH_SEASON_ANNOUNCEMENT);
    expect(sent.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com']);
  });

  it('marks a rejected send failed, logs it, and retries it', async () => {
    const db = makeStubDb([sub({ id: 1 }), sub({ id: 2, email: 'b@example.com' })]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const flaky = async (key: string, mails: OutboundEmail[], idem: string) => {
      if (calls++ === 0) {
        return mails.map((_, i): BatchEmailOutcome => i === 1
          ? { status: 'failed', error: 'rate limited' }
          : { status: 'sent', id: `msg_${next++}` });
      }
      return batchSender(key, mails, idem);
    };
    const result = await runAnnouncement(ENV, db, flaky, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);

    expect(db.markAnnouncement).toHaveBeenCalledWith(2, 'aih-season-2026', 'failed');
    expect(errors).toHaveBeenCalledWith('announcement batch item failed',
      expect.objectContaining({ subscriberId: 2 }));
    expect(sent.map((m) => m.to)).toEqual(['b@example.com']); // the retry
    expect(db.claims.get('2:aih-season-2026')?.status).toBe('sent');
    expect(result).toEqual({ sent: 2, failed: 1 });
    errors.mockRestore();
  });

  it('marks the whole chunk failed when the batch request throws', async () => {
    const db = makeStubDb([sub({ id: 1 }), sub({ id: 2, email: 'b@example.com' })]);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = async () => { throw new Error('Resend 503'); };
    const result = await runAnnouncement(ENV, db, down, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);
    expect(result.sent).toBe(0);
    expect(db.claims.get('1:aih-season-2026')?.status).toBe('failed');
    expect(db.claims.get('2:aih-season-2026')?.status).toBe('failed');
    errors.mockRestore();
  });

  it('reuses the idempotency key for the same recipients', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb([sub({ id: 1 })]);
    const idems: string[] = [];
    const down = async (_k: string, _m: OutboundEmail[], idem: string): Promise<BatchEmailOutcome[]> => {
      idems.push(idem);
      throw new Error('timeout');
    };
    await runAnnouncement(ENV, db, down, '2026-10-11', AIH_SEASON_ANNOUNCEMENT);
    expect(idems).toHaveLength(2); // the sweep, then the same-run retry
    expect(idems[0]).toMatch(/^announcement\/v1\/aih-season-2026\/[0-9a-f]{64}$/);
    expect(idems[1]).toBe(idems[0]);
    errors.mockRestore();
  });
});

describe('runDaily with the announcement', () => {
  let sent: OutboundEmail[];
  const batchSender = async (_key: string, mails: OutboundEmail[]): Promise<BatchEmailOutcome[]> => {
    sent.push(...mails);
    return mails.map((_, i) => ({ status: 'sent', id: `msg_${sent.length}_${i}` }));
  };
  beforeEach(() => {
    sent = [];
  });

  it('still delivers a Sunday weekly paper alongside the announcement', async () => {
    const db = makeStubDb([sub({ id: 1, send_dow: 0, progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-10-11');
    expect(sent.map((m) => m.subject)).toEqual([
      expect.stringContaining('Federalist No. 3'),
      'The Debate Begins Again on October 18'
    ]);
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-10-11');
  });

  it('sends no announcement through the daily run on other days', async () => {
    const db = makeStubDb([sub({ program: 'calendar' })]);
    await runDaily(ENV, db, batchSender, '2026-10-10');
    await runDaily(ENV, db, batchSender, '2026-10-18');
    expect(sent.map((m) => m.subject)).not.toContain('The Debate Begins Again on October 18');
    expect(sent.map((m) => m.subject)).toEqual([expect.stringContaining('Brutus No. I')]);
  });

  it('keeps the heartbeat when the announcement step blows up', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb([sub({})]);
    vi.mocked(db.claimAnnouncement).mockRejectedValue(new Error('no such table'));
    await runDaily(ENV, db, batchSender, '2026-10-11');
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-10-11');
    expect(errors).toHaveBeenCalledWith('announcement run failed', expect.anything());
    errors.mockRestore();
  });
});
