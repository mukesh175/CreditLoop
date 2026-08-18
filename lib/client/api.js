'use client';

/**
 * Client-side API helper.
 *
 * Every request carries a fresh App Bridge session token, which is how the
 * server knows which shop is calling. The shop is never sent in the body.
 */
async function getSessionToken() {
  if (typeof window === 'undefined') return null;
  if (window.shopify?.idToken) {
    try {
      return await window.shopify.idToken();
    } catch {
      return null;
    }
  }
  return null;
}

export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const token = await getSessionToken();
  const response = await fetch(path, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
