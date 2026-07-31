import { describe, expect, it, vi } from 'vitest';
import { getVisitActivity } from '../src/cloudflare-analytics';

const ENV = {
  CLOUDFLARE_ZONE_ID: 'zone_test',
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
  it('keeps every analytics request within one day and returns 30 Eastern dates', async () => {
    const rows = [
      { dimensions: { datetimeHour: '2026-04-06T03:00:00Z' }, sum: { visits: 2 } },
      { dimensions: { datetimeHour: '2026-04-06T14:00:00Z' }, sum: { visits: 3 } }
    ];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const start = Date.parse(body.variables.start);
      const end = Date.parse(body.variables.end);
      const hourly = rows.filter((row) => {
        const occurredAt = Date.parse(row.dimensions.datetimeHour);
        return occurredAt >= start && occurredAt < end;
      });
      return new Response(JSON.stringify({
        data: { viewer: { zones: [{ hourly }] } },
        errors: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const result = await getVisitActivity(
      ENV,
      new Date('2026-04-06T16:00:00.000Z'),
      fetchImpl as typeof fetch
    );

    expect(result.days).toHaveLength(30);
    expect(result.days[0]?.date).toBe('2026-03-08');
    expect(result.days.find((day) => day.date === '2026-04-05')?.count).toBe(2);
    expect(result.days.at(-1)?.count).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(30);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token_test');
    const body = JSON.parse(String(init?.body));
    expect(body.query).toContain('httpRequestsAdaptiveGroups');
    expect(body.query).toContain('requestSource: "eyeball"');
    expect(body.query).toContain('datetimeHour');
    expect(body.query).toContain('visits');
    expect(body.variables.zoneTag).toBe('zone_test');
    expect(body.variables.start).toBe('2026-03-08T05:00:00.000Z');
    expect(body.variables.end).toBe('2026-03-09T05:00:00.000Z');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    for (const [, requestInit] of fetchImpl.mock.calls) {
      const variables = JSON.parse(String(requestInit?.body)).variables;
      expect(Date.parse(variables.end) - Date.parse(variables.start))
        .toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
    const finalBody = JSON.parse(String(fetchImpl.mock.calls.at(-1)?.[1]?.body));
    expect(finalBody.variables.end).toBe('2026-04-06T16:00:00.000Z');
  });

  it.each([
    ['missing config', {}, undefined],
    ['HTTP failure', ENV, new Response('secret body', { status: 403 })],
    ['GraphQL errors', ENV, new Response(JSON.stringify({ errors: [{ message: 'private' }] }))],
    ['no zone', ENV, new Response(JSON.stringify({ data: { viewer: { zones: [] } } }))],
    ['negative visits', ENV, new Response(JSON.stringify({ data: { viewer: { zones: [{ hourly: [
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
      data: { viewer: { zones: [{ hourly: [VALID_ROW] }] } }
    }],
    ['a non-array zones value', {
      errors: [],
      data: { viewer: { zones: { zone: { hourly: [VALID_ROW] } } } }
    }],
    ['an array-like zones object', {
      errors: [],
      data: { viewer: { zones: { 0: { hourly: [VALID_ROW] }, length: 1 } } }
    }],
    ['multiple zones', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [VALID_ROW] }, { hourly: [] }] } }
    }],
    ['a non-array hourly value', {
      errors: [],
      data: { viewer: { zones: [{ hourly: { 0: VALID_ROW, length: 1 } }] } }
    }],
    ['missing dimensions', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [{ sum: { visits: 3 } }] }] } }
    }],
    ['missing sum', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [{ dimensions: { datetimeHour: '2026-07-31T14:00:00Z' } }] }] } }
    }],
    ['an invalid time', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [{
        dimensions: { datetimeHour: 'not-a-time' }, sum: { visits: 3 }
      }] }] } }
    }],
    ['fractional visits', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [{
        dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 1.5 }
      }] }] } }
    }],
    ['unsafe-integer visits', {
      errors: [],
      data: { viewer: { zones: [{ hourly: [{
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
