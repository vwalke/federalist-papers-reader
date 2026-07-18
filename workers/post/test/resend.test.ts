// workers/post/test/resend.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../src/resend';

afterEach(() => vi.restoreAllMocks());

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
