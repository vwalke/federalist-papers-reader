// Cloudflare's published always-passes, invisible test site key. It pairs with
// the always-passes test secret 1x0000000000000000000000000000000AA, so local
// builds and preview deployments render a working widget without real keys.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000BB';

/**
 * The Turnstile site key the signup form renders. A production Pages build
 * (CF_PAGES_BRANCH=main) without PUBLIC_TURNSTILE_SITE_KEY fails rather than
 * ship the test key, which the production secret would reject on every signup.
 */
export function turnstileSiteKey(
  rawKey: string | undefined,
  pagesBranch: string | undefined,
): string {
  const key = rawKey?.trim();
  if (key) return key;
  if (pagesBranch === 'main') {
    throw new Error(
      'PUBLIC_TURNSTILE_SITE_KEY is not set for the production build; the signup form needs it.',
    );
  }
  return TURNSTILE_TEST_SITE_KEY;
}
