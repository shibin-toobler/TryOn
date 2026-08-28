import crypto from 'crypto';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** URL-safe random token, lowercase alphanumeric. */
export function token(length = 32): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Public key the widget ships in merchant HTML. Safe to expose. */
export const publishableKey = () => `pk_${token(32)}`;

/** Server-side key for /v1/admin/*. Never exposed to the browser. */
export const secretKey = () => `sk_${token(40)}`;

/** Anonymous per-browser identifier, minted by the widget or the API. */
export const visitorToken = () => `vis_${token(24)}`;
