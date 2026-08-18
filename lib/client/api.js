'use client';

/**
 * Client-side API helper.
 *
 * Every request carries a fresh App Bridge session token, which is how the
 * server knows which shop is calling. The shop is never sent in the body.
 */

const APP_BRIDGE_TIMEOUT_MS = 8000;

/**
 * App Bridge loads from Shopify's CDN, so `window.shopify` may not exist yet
 * when the first component mounts. Wait for it rather than failing the request
 * on a race.
 */
async function waitForAppBridge() {
  if (typeof window === 'undefined') return null;
  const deadline = Date.now() + APP_BRIDGE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (typeof window.shopify?.idToken === 'function') return window.shopify;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

async function getSessionToken() {
  const appBridge = await waitForAppBridge();
  if (!appBridge) {
    const error = new Error(
      'CreditLoop could not connect to Shopify. Open the app from your Shopify admin rather than visiting the URL directly.'
    );
    error.code = 'APP_BRIDGE_UNAVAILABLE';
    throw error;
  }
  return appBridge.idToken();
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const token = await getSessionToken();

  const response = await fetch(path, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    /* handled below */
  }

  if (!response.ok || json?.ok === false) {
    const error = new Error(json?.error?.message || 'Something went wrong. Please try again.');
    error.code = json?.error?.code;
    error.status = response.status;
    error.requestId = json?.error?.requestId;
    throw error;
  }
  return json;
}
