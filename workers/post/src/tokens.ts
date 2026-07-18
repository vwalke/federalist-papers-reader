// workers/post/src/tokens.ts
export type TokenPurpose = 'confirm' | 'manage' | 'unsub';

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return b64url(new Uint8Array(sig));
}

export async function signToken(
  subscriberId: number, purpose: TokenPurpose, envSecret: string, subscriberSecret: string
): Promise<string> {
  const payload = `${subscriberId}.${purpose}`;
  return `${payload}.${await hmac(envSecret + subscriberSecret, payload)}`;
}

/** Returns the subscriber id, or null for any invalid token. Never throws. */
export async function verifyToken(
  token: string, purpose: TokenPurpose, envSecret: string,
  lookupSubscriberSecret: (id: number) => Promise<string | null>
): Promise<number | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [idRaw, tokenPurpose, signature] = parts;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0 || tokenPurpose !== purpose) return null;
  const subscriberSecret = await lookupSubscriberSecret(id);
  if (!subscriberSecret) return null;
  const expected = await hmac(envSecret + subscriberSecret, `${id}.${purpose}`);
  if (expected.length !== signature.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0 ? id : null;
}
