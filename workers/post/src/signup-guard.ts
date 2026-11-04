// workers/post/src/signup-guard.ts
//
// The checks POST /api/subscribe makes before it may write a row or send a
// confirmation: same-origin, Turnstile, and the D1 rate limits (0009).

export const TURNSTILE_SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Per client IP: signup attempts that passed Turnstile, per hour. */
export const SIGNUP_IP_LIMIT = { limit: 20, windowSeconds: 3600 };
/** Per address: at most one email (confirmation or already-subscribed notice) per 10 minutes… */
export const SIGNUP_EMAIL_LIMIT = { limit: 1, windowSeconds: 600 };
/** …and at most three a day. */
export const SIGNUP_EMAIL_DAILY_LIMIT = { limit: 3, windowSeconds: 86_400 };

// Turnstile tokens are at most 2048 characters.
const MAX_TOKEN_LENGTH = 2048;

/**
 * True unless the browser says the form was posted from another site. Browsers
 * send Origin on every form POST; Referer is the fallback when Origin is absent
 * or opaque ("null"). A request carrying neither is let through to Turnstile,
 * which is the real gate.
 */
export function isSameOrigin(request: Request, siteUrl: string): boolean {
  const allowed = new Set([new URL(siteUrl).origin, new URL(request.url).origin]);
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null') return allowed.has(origin);
  const referer = request.headers.get('Referer');
  if (!referer) return true;
  try {
    return allowed.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

/**
 * Asks siteverify whether `token` is a fresh, unspent Turnstile token. Fails
 * closed: no configured secret, no token, an error from Cloudflare, or a
 * timeout all reject the signup.
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string | null,
  ip: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  if (!secret) {
    console.error('turnstile secret not configured; rejecting signup');
    return false;
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetchImpl(TURNSTILE_SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      console.error('turnstile siteverify failed', { status: response.status });
      return false;
    }
    const data = (await response.json()) as { success?: unknown; 'error-codes'?: unknown };
    if (data.success === true) return true;
    console.warn('turnstile rejected signup', { errors: data['error-codes'] });
    return false;
  } catch (error) {
    console.error('turnstile siteverify unreachable', { error: String(error) });
    return false;
  }
}

/** HMAC-SHA-256 of `value` under the Worker secret, hex — so counters never hold raw IPs or addresses. */
export async function rateLimitKey(kind: string, value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${kind}:${value}`));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
  return `${kind}:${hex.slice(0, 32)}`;
}
