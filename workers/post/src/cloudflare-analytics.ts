import { easternWindow, summarizeDailyActivity, type DailyActivity } from './daily-activity';
import type { Env } from './types';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const VISITS_QUERY = `query PostOfficeVisits(
  $accountTag: string!
  $start: Time!
  $end: Time!
  $requestHost: string!
) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      hourly: rumPageloadEventsAdaptiveGroups(
        limit: 1000
        orderBy: [datetimeHour_ASC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          requestHost: $requestHost
        }
      ) {
        dimensions { datetimeHour }
        sum { visits }
      }
    }
  }
}`;

type AnalyticsEnv = Partial<Pick<
  Env,
  'SITE_URL' | 'CLOUDFLARE_ACCOUNT_ID' | 'CLOUDFLARE_ANALYTICS_TOKEN'
>>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getVisitActivity(
  env: AnalyticsEnv,
  now: Date,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000
): Promise<DailyActivity> {
  if (!env.SITE_URL || !env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_TOKEN) {
    throw new Error('visit activity unavailable');
  }
  try {
    const window = easternWindow(now);
    const response = await fetchImpl(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: VISITS_QUERY,
        variables: {
          accountTag: env.CLOUDFLARE_ACCOUNT_ID,
          start: window.start.toISOString(),
          end: window.end.toISOString(),
          requestHost: new URL(env.SITE_URL).hostname
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    if (!isObject(payload)) throw new Error();
    const errors = payload.errors;
    if (errors !== undefined && errors !== null &&
      (!Array.isArray(errors) || errors.length > 0)) throw new Error();
    if (!isObject(payload.data) || !isObject(payload.data.viewer)) throw new Error();
    const accounts = payload.data.viewer.accounts;
    if (!Array.isArray(accounts) || accounts.length !== 1 || !isObject(accounts[0])) {
      throw new Error();
    }
    const rows = accounts[0].hourly;
    if (!Array.isArray(rows)) throw new Error();
    const timed = rows.map((row) => {
      if (!isObject(row) || !isObject(row.dimensions) || !isObject(row.sum)) {
        throw new Error();
      }
      const occurredAt = row.dimensions.datetimeHour;
      const visits = row.sum.visits;
      if (typeof occurredAt !== 'string' || !Number.isFinite(Date.parse(occurredAt)) ||
        typeof visits !== 'number' || !Number.isSafeInteger(visits) || visits < 0) {
        throw new Error();
      }
      return {
        occurredAt,
        count: visits
      };
    });
    return summarizeDailyActivity(timed, now);
  } catch {
    throw new Error('visit activity unavailable');
  }
}
