import { describe, expect, it, vi } from 'vitest';
import {
  listRetainedSends,
  main,
  renderBackfillSql
} from '../backfill-email-sends.mjs';

describe('sent-email history backfill', () => {
  it('paginates and projects retained email records to aggregate-only rows', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        object: 'list',
        has_more: true,
        data: [{
          id: '56761188-7520-42d8-8898-ff6fc54ce618',
          created_at: '2026-07-25 12:00:00+00',
          from: 'private-sender@example.com',
          to: ['private@example.com'],
          cc: ['copy@example.com'],
          bcc: null,
          subject: 'Must not survive projection'
        }]
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        object: 'list',
        has_more: false,
        data: [{
          id: '13b216e9-51a2-4df5-9e80-6bfe49862c56',
          created_at: '2026-07-24T11:00:00Z',
          from: 'private-sender@example.com',
          to: [],
          cc: null,
          bcc: null,
          subject: 'Also private'
        }]
      }), { status: 200 }));

    const rows = await listRetainedSends('secret-api-key', fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.resend.com/emails?limit=100');
    expect(fetchImpl.mock.calls[1][0]).toContain(
      'limit=100&after=56761188-7520-42d8-8898-ff6fc54ce618'
    );
    expect(rows).toEqual([
      {
        id: '56761188-7520-42d8-8898-ff6fc54ce618',
        createdAt: '2026-07-25T12:00:00.000Z',
        recipientCount: 2
      },
      {
        id: '13b216e9-51a2-4df5-9e80-6bfe49862c56',
        createdAt: '2026-07-24T11:00:00.000Z',
        recipientCount: 1
      }
    ]);
    expect(JSON.stringify(rows)).not.toMatch(
      /private@example|copy@example|subject|sender|secret-api-key/i
    );
  });

  it('renders idempotent SQL without retained PII', () => {
    const sql = renderBackfillSql([{
      id: '56761188-7520-42d8-8898-ff6fc54ce618',
      createdAt: '2026-07-25T12:00:00.000Z',
      recipientCount: 3
    }]);

    expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT|SAVEPOINT)\b/i);
    expect(sql).toContain('ON CONFLICT(provider_message_id) DO UPDATE');
    expect(sql).toContain("'56761188-7520-42d8-8898-ff6fc54ce618'");
    expect(sql).toContain("'2026-07-25T12:00:00.000Z'");
    expect(sql).not.toMatch(/example\.com|subject|sender|api[_-]?key|JSON/i);
  });

  it('fails generically on malformed records and HTTP errors', async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({
      object: 'list',
      has_more: false,
      data: [{
        id: 'private-bad-id',
        created_at: 'not-a-date',
        to: ['private@example.com']
      }]
    }), { status: 200 }));
    const denied = vi.fn(async () => new Response(
      'private API response body',
      { status: 403 }
    ));

    await expect(listRetainedSends('key', malformed))
      .rejects.toThrow('Invalid retained email record');
    await expect(listRetainedSends('key', denied))
      .rejects.toThrow('Resend list failed with status 403');
    await expect(listRetainedSends('key', denied))
      .rejects.not.toThrow(/private API response body/);
  });

  it('skips Wrangler for an empty retained history', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      object: 'list',
      has_more: false,
      data: []
    }), { status: 200 }));
    const runSql = vi.fn(async () => {});
    const log = vi.fn();

    await main({ apiKey: 'key', fetchImpl, runSql, log });

    expect(runSql).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Backfilled 0 sent-email records.');
  });
});
