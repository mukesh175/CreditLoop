'use client';

/**
 * Shared response cache for the admin.
 *
 * Kept in its own module so both the fetch helper and the data hook can reach
 * it without importing each other.
 */
const cache = new Map(); // path -> { data, at }
const inFlight = new Map(); // path -> Promise

export const FRESH_MS = 30_000;

export function readCache(path) {
  const entry = cache.get(path);
  if (!entry) return null;
  return { ...entry, fresh: Date.now() - entry.at < FRESH_MS };
}

export function writeCache(path, data) {
  cache.set(path, { data, at: Date.now() });
}

export function dropCache(path) {
  cache.delete(path);
}

/** Clears everything, or every entry under a path prefix. */
export function invalidateApiCache(prefix) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** De-duplicates concurrent requests for the same path. */
export function shareRequest(path, run) {
  const pending = inFlight.get(path);
  if (pending) return pending;

  const promise = run()
    .then((data) => {
      writeCache(path, data);
      return data;
    })
    .finally(() => inFlight.delete(path));

  inFlight.set(path, promise);
  return promise;
}
