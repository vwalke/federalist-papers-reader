import { easternWindow, summarizeDailyActivity, type DailyActivity } from './daily-activity';
import type { Env } from './types';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const MAX_QUERY_WINDOW_MS = 24 * 60 * 60 * 1000;
const VISITS_QUERY = `query PostOfficeVisits($zoneTag: string, $start: Time, $end: Time) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      hourly: httpRequestsAdaptiveGroups(
        limit: 1000
        orderBy: [datetimeHour_ASC]
        filter: {
          datetime_geq: $start
          datetime_lt: $end
          requestSource: "eyeball"
        }
      ) {
        dimensions { datetimeHour }
        sum { visits }
      }
    }
  }
}`;

type AnalyticsEnv = Pick<Env, 'CLOUDFLARE_ZONE_ID' | 'CLOUDFLARE_ANALYTICS_TOKEN'>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getVisitActivity(
  env: AnalyticsEnv,
  now: Date,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<DailyActivity> {
  if (!env.CLOUDFLARE_ZONE_ID || !env.CLOUDFLARE_ANALYTICS_TOKEN) {
    throw new Error('visit activity unavailable');
  }
  try {
    const window = easternWindow(now);
    const ranges: Array<{ start: string; end: string }> = [];
    for (let start = window.start.getTime(); start < window.end.getTime();
      start += MAX_QUERY_WINDOW_MS) {
      ranges.push({
        start: new Date(start).toISOString(),
        end: new Date(Math.min(start + MAX_QUERY_WINDOW_MS, window.end.getTime())).toISOString()
      });
    }
    const payloads = await Promise.all(ranges.map(async (range) => {
      const response = await fetchImpl(GRAPHQL_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: VISITS_QUERY,
          variables: {
            zoneTag: env.CLOUDFLARE_ZONE_ID,
            start: range.start,
            end: range.end
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
      const zones = payload.data.viewer.zones;
      if (!Array.isArray(zones) || zones.length !== 1 || !isObject(zones[0])) throw new Error();
      const rows = zones[0].hourly;
      if (!Array.isArray(rows)) throw new Error();
      return rows;
    }));
    const timed = payloads.flat().map((row) => {
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
