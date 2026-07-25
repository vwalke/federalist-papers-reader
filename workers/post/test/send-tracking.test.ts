import { describe, expect, it, vi } from 'vitest';
import { sendAndRecord } from '../src/send-tracking';

const mail = {
  from: 'Publius <publius@federalistreader.org>',
  to: 'reader@example.com',
  subject: 'A paper',
  html: '<p>A paper</p>',
  text: 'A paper',
  unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=x'
};

describe('sendAndRecord', () => {
  it('records one recipient after Resend accepts the message', async () => {
    const db = { recordEmailSend: vi.fn(async () => {}) };
    const send = vi.fn(async () => 'email-id');

    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' },
      db as never,
      send,
      mail,
      () => new Date('2026-07-25T12:00:00.000Z')
    )).resolves.toBe('email-id');
    expect(db.recordEmailSend).toHaveBeenCalledWith(
      'email-id', '2026-07-25T12:00:00.000Z', 1
    );
  });

  it('keeps an accepted send successful when D1 recording fails', async () => {
    const db = {
      recordEmailSend: vi.fn(async () => {
        throw new Error('D1 unavailable');
      })
    };
    const send = vi.fn(async () => 'email-id');

    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' }, db as never, send, mail
    )).resolves.toBe('email-id');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not record when Resend rejects the send', async () => {
    const db = { recordEmailSend: vi.fn(async () => {}) };
    const send = vi.fn(async () => {
      throw new Error('Resend 429');
    });

    await expect(sendAndRecord(
      { RESEND_API_KEY: 'key' }, db as never, send, mail
    )).rejects.toThrow('Resend 429');
    expect(db.recordEmailSend).not.toHaveBeenCalled();
  });
});
