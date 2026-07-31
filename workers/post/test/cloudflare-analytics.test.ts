import { describe, expect, it, vi } from 'vitest';
import { getVisitActivity } from '../src/cloudflare-analytics';

const ENV = {
  SITE_URL: 'https://federalistreader.org',
  CLOUDFLARE_ACCOUNT_ID: 'account_test',
  CLOUDFLARE_ANALYTICS_TOKEN: 'token_test'
};

const VALID_ROW = {
  dimensions: { datetimeHour: '2026-07-31T14:00:00Z' },
  sum: { visits: 3 }
};

function analyticsResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('Cloudflare visit activity', () => {
  it('requests 30 days of hourly Web Analytics visits and returns Eastern dates', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({
        data: { viewer: { accounts: [{ hourly: [
          { dimensions: { datetimeHour: '2026-04-06T03:00:00Z' }, sum: { visits: 2 } },
          { dimensions: { datetimeHour: '2026-04-06T14:00:00Z' }, sum: { visits: 3 } }
        ] }] } },
        errors: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await getVisitActivity(
      ENV,
      new Date('2026-04-06T16:00:00.000Z'),
      fetchImpl as typeof fetch
    );

    expect(result.days).toHaveLength(30);
    expect(result.days[0]?.date).toBe('2026-03-08');
    expect(result.days.find((day) => day.date === '2026-04-05')?.count).toBe(2);
    expect(result.days.at(-1)?.count).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token_test');
    const body = JSON.parse(String(init?.body));
    expect(body.query).toContain('rumPageloadEventsAdaptiveGroups');
    expect(body.query).toContain('requestHost: $requestHost');
    expect(body.query).toContain('datetimeHour');
    expect(body.query).toContain('visits');
    expect(body.variables.accountTag).toBe('account_test');
    expect(body.variables.requestHost).toBe('federalistreader.org');
    expect(body.variables.start).toBe('2026-03-08T05:00:00.000Z');
    expect(body.variables.end).toBe('2026-04-06T16:00:00.000Z');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['missing config', {}, undefined],
    ['HTTP failure', ENV, new Response('secret body', { status: 403 })],
    ['GraphQL errors', ENV, new Response(JSON.stringify({ errors: [{ message: 'private' }] }))],
    ['no account', ENV, new Response(JSON.stringify({ data: { viewer: { accounts: [] } } }))],
    ['negative visits', ENV, new Response(JSON.stringify({ data: { viewer: { accounts: [{ hourly: [
      { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: -1 } }
    ] }] } } }))]
  ])('%s is unavailable without leaking details', async (_name, env, response) => {
    const fetchImpl = vi.fn(async () => response ?? new Response('{}')) as unknown as typeof fetch;
    await expect(getVisitActivity(env, new Date('2026-07-31T16:00:00Z'), fetchImpl))
      .rejects.toThrow(/^visit activity unavailable$/);
  });

  it.each([
    ['an errors object', {
      errors: {},
      data: { viewer: { accounts: [{ hourly: [VALID_ROW] }] } }
    }],
    ['a non-array accounts value', {
      errors: [],
      data: { viewer: { accounts: { account: { hourly: [VALID_ROW] } } } }
    }],
    ['an array-like accounts object', {
      errors: [],
      data: { viewer: { accounts: { 0: { hourly: [VALID_ROW] }, length: 1 } } }
    }],
    ['multiple accounts', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [VALID_ROW] }, { hourly: [] }] } }
    }],
    ['a non-array hourly value', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: { 0: VALID_ROW, length: 1 } }] } }
    }],
    ['missing dimensions', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [{ sum: { visits: 3 } }] }] } }
    }],
    ['missing sum', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [{ dimensions: { datetimeHour: '2026-07-31T14:00:00Z' } }] }] } }
    }],
    ['an invalid time', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [{
        dimensions: { datetimeHour: 'not-a-time' }, sum: { visits: 3 }
      }] }] } }
    }],
    ['fractional visits', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [{
        dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 1.5 }
      }] }] } }
    }],
    ['unsafe-integer visits', {
      errors: [],
      data: { viewer: { accounts: [{ hourly: [{
        dimensions: { datetimeHour: '2026-07-31T14:00:00Z' },
        sum: { visits: Number.MAX_SAFE_INTEGER + 1 }
      }] }] } }
    }]
  ])('rejects %s as unavailable', async (_name, payload) => {
    const fetchImpl = vi.fn(async () => analyticsResponse(payload)) as unknown as typeof fetch;

    await expect(getVisitActivity(
      ENV,
      new Date('2026-07-31T16:00:00Z'),
      fetchImpl
    )).rejects.toThrow(/^visit activity unavailable$/);
  });

  it('normalizes invalid JSON without exposing the token or response body', async () => {
    const responseBody = 'private invalid JSON body';
    const fetchImpl = vi.fn(async () => new Response(responseBody)) as unknown as typeof fetch;

    const rejection = getVisitActivity(
      ENV,
      new Date('2026-07-31T16:00:00Z'),
      fetchImpl
    );

    await expect(rejection).rejects.toThrow(/^visit activity unavailable$/);
    await expect(rejection).rejects.not.toThrow(/token_test|private invalid JSON body/);
  });

  it('normalizes AbortError without exposing the token or upstream message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('private timeout detail', 'AbortError');
    }) as unknown as typeof fetch;

    const rejection = getVisitActivity(
      ENV,
      new Date('2026-07-31T16:00:00Z'),
      fetchImpl
    );

    await expect(rejection).rejects.toThrow(/^visit activity unavailable$/);
    await expect(rejection).rejects.not.toThrow(/token_test|private timeout detail/);
  });
});
