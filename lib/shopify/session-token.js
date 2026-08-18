import crypto from 'node:crypto';
import { SHOPIFY_API_KEY, SHOPIFY_API_SECRET } from '@/lib/config';
import { AuthError } from '@/lib/util/errors';
import { safeEqual } from '@/lib/util/crypto';

function base64UrlDecode(input) {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Verifies an App Bridge session token (JWT, HS256, signed with the app secret).
 *
 * This is how every embedded admin request proves which shop it belongs to.
 * The shop is taken from the verified `dest` claim — never from a request body
 * or query parameter the browser could tamper with.
 */
export function verifySessionToken(token) {
  if (!token) throw new AuthError('Missing session token.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed session token.');

  const [headerB64, payloadB64, signatureB64] = parts;
  const expected = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (!safeEqual(expected, signatureB64)) {
    throw new AuthError('Session token signature is invalid.');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    throw new AuthError('Session token payload is unreadable.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new AuthError('Session token has expired.');
  if (payload.nbf && payload.nbf > now + 5) throw new AuthError('Session token is not yet valid.');
  if (payload.aud !== SHOPIFY_API_KEY) throw new AuthError('Session token was issued for another app.');

  const dest = String(payload.dest || '');
  const shopDomain = dest.replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    throw new AuthError('Session token does not identify a valid store.');
  }

  return { shopDomain, userId: payload.sub || null, payload };
}
