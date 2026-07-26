// workers/post/test/resend.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendBatchEmails, sendEmail } from '../src/resend';

afterEach(() => vi.restoreAllMocks());

const MAILS = [
  {
    from: 'Publius <publius@federalistreader.org>',
    to: 'first@example.com',
    subject: 'First',
    html: '<p>first</p>',
    text: 'first',
    unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=first'
  },
  {
    from: 'Publius <publius@federalistreader.org>',
    to: 'second@example.com',
    subject: 'Second',
    html: '<p>second</p>',
    text: 'second',
    unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=second'
  }
];

describe('sendEmail', () => {
  it('posts to Resend with one-click unsubscribe headers and returns the id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 })
    );
    const id = await sendEmail('key', {
      from: 'Publius <publius@federalistreader.org>',
      to: 'reader@example.com',
      subject: 'S', html: '<p>h</p>', text: 't',
      unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=U'
    });
    expect(id).toBe('msg_1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.headers['List-Unsubscribe']).toContain('unsubscribe?token=U');
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('throws with the response body on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('rate limited', { status: 429 }));
    await expect(sendEmail('key', {
      from: 'f', to: 't', subject: 's', html: 'h', text: 't', unsubscribeUrl: 'u'
    })).rejects.toThrow(/429/);
  });
});

describe('sendBatchEmails', () => {
  it('sends personalized emails in one permissive batch request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: 'msg_1' }, { id: 'msg_2' }],
        errors: []
      }), { status: 200 })
    );

    await expect(sendBatchEmails('key', MAILS, 'scheduled/v1/digest')).resolves.toEqual([
      { status: 'sent', id: 'msg_1' },
      { status: 'sent', id: 'msg_2' }
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails/batch');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'scheduled/v1/digest',
      'x-batch-validation': 'permissive'
    });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toHaveLength(2);
    expect(body[0].to).toEqual(['first@example.com']);
    expect(body[0].headers['List-Unsubscribe']).toContain('token=first');
    expect(body[1].headers['List-Unsubscribe']).toContain('token=second');
    expect(body[0].headers['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click'
    );
  });

  it('maps permissive validation errors back to their input indexes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: 'msg_1' }],
        errors: [{ index: 1, message: 'invalid recipient' }]
      }), { status: 200 })
    );

    await expect(sendBatchEmails('key', MAILS, 'scheduled/v1/digest')).resolves.toEqual([
      { status: 'sent', id: 'msg_1' },
      { status: 'failed', error: 'invalid recipient' }
    ]);
  });

  it('rejects a malformed batch response instead of misassigning provider ids', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: 'msg_1' }],
        errors: []
      }), { status: 200 })
    );

    await expect(
      sendBatchEmails('key', MAILS, 'scheduled/v1/digest')
    ).rejects.toThrow(/outcome count/i);
  });

  it('rejects a failed batch request with the provider response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('rate limited', { status: 429 })
    );

    await expect(
      sendBatchEmails('key', MAILS, 'scheduled/v1/digest')
    ).rejects.toThrow(/429.*rate limited/i);
  });
});
