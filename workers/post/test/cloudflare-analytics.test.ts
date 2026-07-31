import { describe, expect, it, vi } from 'vitest';
import { getVisitActivity } from '../src/cloudflare-analytics';

const ENV = {
  CLOUDFLARE_ZONE_ID: 'zone_test',
  CLOUDFLARE_ANALYTICS_TOKEN: 'token_test'
};

describe('Cloudflare visit activity', () => {
  it('requests hourly end-user visits and returns 30 Eastern dates', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify({
        data: { viewer: { zones: [{ hourly: [
          { dimensions: { datetimeHour: '2026-07-31T03:00:00Z' }, sum: { visits: 2 } },
          { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 3 } }
        ] }] } },
        errors: null
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const result = await getVisitActivity(
      ENV,
      new Date('2026-07-31T16:00:00.000Z'),
      fetchImpl as typeof fetch
    );

    expect(result.days).toHaveLength(30);
    expect(result.days.find((day) => day.date === '2026-07-30')?.count).toBe(2);
    expect(result.days.at(-1)?.count).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token_test');
    const body = JSON.parse(String(init?.body));
    expect(body.query).toContain('httpRequestsAdaptiveGroups');
    expect(body.query).toContain('requestSource: "eyeball"');
    expect(body.query).toContain('datetimeHour');
    expect(body.query).toContain('visits');
    expect(body.variables.zoneTag).toBe('zone_test');
    expect(body.variables.start).toMatch(/Z$/);
    expect(body.variables.end).toBe('2026-07-31T16:00:00.000Z');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
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
