const CLOUDFLARE_SITE_TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export function createCloudflareBeaconData(
  production: boolean,
  rawToken: string | undefined,
): string | undefined {
  if (!production) return undefined;

  const token = rawToken?.trim();
  if (!token || !CLOUDFLARE_SITE_TOKEN.test(token)) return undefined;

  return JSON.stringify({ token });
}
