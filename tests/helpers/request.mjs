import crypto from 'node:crypto';

const SECRET = process.env.SHOPIFY_API_SECRET;
const API_KEY = process.env.SHOPIFY_API_KEY;

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Builds a genuine App Bridge session token, signed the way Shopify signs one. */
export function makeSessionToken(shopDomain, userId = '1') {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(
    JSON.stringify({
      iss: `https://${shopDomain}/admin`,
      dest: `https://${shopDomain}`,
      aud: API_KEY,
      sub: userId,
      exp: now + 3600,
      nbf: now - 10,
      iat: now,
    })
  );
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${header}.${payload}.${signature}`;
}

/**
 * Minimal stand-in for NextRequest.
 *
 * `next/server` cannot be imported outside the Next runtime, and route handlers
 * only use `headers.get`, `nextUrl` and `json()` — so this covers the surface
 * without pulling in the framework.
 */
export function makeRequest(url, { method = 'GET', body, headers = {} } = {}) {
  const nextUrl = new URL(url, 'https://creditloop.test');
  const headerMap = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    method,
    url: nextUrl.toString(),
    nextUrl,
    headers: { get: (name) => headerMap.get(String(name).toLowerCase()) ?? null },
    async json() {
      if (body === undefined) throw new Error('No body');
      return body;
    },
    async text() {
      return body === undefined ? '' : JSON.stringify(body);
    },
  };
}

export function authedRequest(url, { method = 'GET', body, shopDomain, userId } = {}) {
  return makeRequest(url, {
    method,
    body,
    headers: {
      authorization: `Bearer ${makeSessionToken(shopDomain, userId)}`,
      'content-type': 'application/json',
    },
  });
}

/** Reads a route handler's response without assuming it succeeded. */
export async function readResponse(response) {
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  return { status: response.status, json, text };
}
