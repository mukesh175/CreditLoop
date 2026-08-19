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

/**
 * Sends the merchant through OAuth when the store has not finished installing.
 *
 * OAuth cannot run inside the admin iframe, so this must break out to the top
 * window. Returns true when a redirect was started, so the caller stops.
 */
function redirectToInstall() {
  if (typeof window === 'undefined') return false;
  const shop = window.shopify?.config?.shop;
  if (!shop) return false;

  const target = `/api/auth/login?shop=${encodeURIComponent(shop)}`;
  const absolute = new URL(target, window.location.origin).toString();

  try {
    // Escape the iframe — Shopify's OAuth screen refuses to render inside one.
    if (window.top && window.top !== window.self) {
      window.top.location.href = absolute;
    } else {
      window.location.href = absolute;
    }
    return true;
  } catch {
    // Cross-origin frame access can throw; fall back to navigating ourselves.
    window.location.href = absolute;
    return true;
  }
}

export async function apiFetch(path, { method = 'GET', body, signal, _retried = false } = {}) {
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
    const code = json?.error?.code;

    // Session tokens are short-lived. One retry with a fresh token, so a token
    // that expired in flight does not surface as an error.
    if (code === 'SESSION_TOKEN_EXPIRED' && !_retried) {
      return apiFetch(path, { method, body, signal, _retried: true });
    }

    // Recoverable: finish installing rather than showing the merchant an error.
    if (code === 'SHOP_NOT_INSTALLED' && redirectToInstall()) {
      // Never resolves — the page is navigating away.
      return new Promise(() => {});
    }

    const error = new Error(json?.error?.message || 'Something went wrong. Please try again.');
    error.code = code;
    error.status = response.status;
    error.requestId = json?.error?.requestId;
    throw error;
  }
  return json;
}
