import { SHOPIFY_API_KEY, SHOPIFY_API_SECRET } from '@/lib/config';
import { AppError } from '@/lib/util/errors';

const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:token-exchange';
const SUBJECT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token';
const OFFLINE_TOKEN_TYPE = 'urn:shopify:params:oauth:token-type:offline-access-token';
const ONLINE_TOKEN_TYPE = 'urn:shopify:params:oauth:token-type:online-access-token';

/**
 * Exchanges an App Bridge session token for an Admin API access token.
 *
 * This is how apps using Shopify managed installation obtain a token. Shopify
 * performs the install itself and never redirects through the app's OAuth
 * endpoint, so there is no authorization code to exchange — the session token
 * the embedded app already holds is the proof of installation.
 *
 * The legacy OAuth flow in oauth.js is still supported for apps configured with
 * `use_legacy_install_flow`.
 */
export async function exchangeSessionTokenForAccessToken({
  shopDomain,
  sessionToken,
  online = false,
}) {
  if (!sessionToken) {
    throw new AppError('A session token is required for token exchange.', {
      code: 'TOKEN_EXCHANGE_FAILED',
      status: 401,
    });
  }

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      grant_type: GRANT_TYPE,
      subject_token: sessionToken,
      subject_token_type: SUBJECT_TOKEN_TYPE,
      requested_token_type: online ? ONLINE_TOKEN_TYPE : OFFLINE_TOKEN_TYPE,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.access_token) {
    // Shopify signals an expired or already-used session token this way; the
    // client simply retries with a fresh one.
    const expired =
      body?.error === 'invalid_subject_token' ||
      /invalid_subject_token/i.test(JSON.stringify(body || {}));

    throw new AppError(
      expired
        ? 'That session has expired. Reload the app to continue.'
        : 'Shopify did not grant CreditLoop access to this store.',
      {
        code: expired ? 'SESSION_TOKEN_EXPIRED' : 'TOKEN_EXCHANGE_FAILED',
        status: 401,
        details: { status: response.status, error: body?.error, shopDomain },
      }
    );
  }

  // Shopify now issues *expiring* offline tokens and rejects non-expiring ones
  // on the Admin API. `expires_in` is seconds from now; a token without one is
  // treated as short-lived so it is refreshed rather than trusted forever.
  const expiresIn = Number(body.expires_in);
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  return { accessToken: body.access_token, scope: body.scope, expiresAt };
}
