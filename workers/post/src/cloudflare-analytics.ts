import { easternWindow, summarizeDailyActivity, type DailyActivity } from './daily-activity';
import type { Env } from './types';

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
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
          start: window.start.toISOString(),
          end: window.end.toISOString()
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error();
    const payload: unknown = await response.json();
    const root = payload as {
      errors?: unknown[] | null;
      data?: { viewer?: { zones?: Array<{ hourly?: unknown[] }> } };
    };
    if ((root.errors?.length ?? 0) > 0 || root.data?.viewer?.zones?.length !== 1) {
      throw new Error();
    }
    const rows = root.data.viewer.zones[0].hourly;
    if (!Array.isArray(rows)) throw new Error();
    const timed = rows.map((row) => {
      const value = row as {
        dimensions?: { datetimeHour?: unknown };
        sum?: { visits?: unknown };
      };
      if (typeof value.dimensions?.datetimeHour !== 'string' ||
        !Number.isFinite(Date.parse(value.dimensions.datetimeHour)) ||
        typeof value.sum?.visits !== 'number' ||
        !Number.isSafeInteger(value.sum.visits) || value.sum.visits < 0) {
        throw new Error();
      }
      return {
        occurredAt: value.dimensions.datetimeHour,
        count: value.sum.visits
      };
    });
    return summarizeDailyActivity(timed, now);
  } catch {
    throw new Error('visit activity unavailable');
  }
}
