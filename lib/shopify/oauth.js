import crypto from 'node:crypto';
import { APP_URL, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_SCOPES } from '@/lib/config';
import { AuthError } from '@/lib/util/errors';
import { isValidShopDomain } from './hmac';

export const OAUTH_STATE_COOKIE = 'creditloop_oauth_state';

export function buildAuthorizeUrl(shopDomain, state) {
  if (!isValidShopDomain(shopDomain)) throw new AuthError('Invalid shop domain.');
  const params = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    scope: SHOPIFY_SCOPES.join(','),
    redirect_uri: `${APP_URL}/api/auth/callback`,
    state,
    'grant_options[]': '', // offline access token
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export function generateState() {
  return crypto.randomBytes(24).toString('hex');
}

export async function exchangeCodeForToken(shopDomain, code) {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });
  if (!response.ok) {
    throw new AuthError('Shopify did not return an access token for this store.');
  }
  const json = await response.json();
  if (!json.access_token) throw new AuthError('Shopify did not return an access token.');
  return {
    accessToken: json.access_token,
    scope: json.scope,
    expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : null,
  };
}
