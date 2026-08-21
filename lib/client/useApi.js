'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './api';
import { readCache, dropCache, shareRequest, invalidateApiCache } from './cache';

export { invalidateApiCache };

/**
 * Shared response cache.
 *
 * Two things this fixes. Several components ask for the same endpoint on one
 * screen — the sidebar badge and the dashboard both want the overview — and
 * without this each mounts its own request. And navigating back to a page
 * previously re-fetched from scratch, leaving the merchant looking at
 * skeletons for data they already had.
 *
 * Cached data renders immediately and is revalidated in the background, so a
 * revisit is instant but never stale for long.
 */
/** Data fetching with loading, error, refetch and a stale-while-revalidate cache. */
export function useApi(path, { skip = false } = {}) {
  const cached = !skip && path ? readCache(path) : null;

  const [data, setData] = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!skip && Boolean(path) && !cached);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ force = false } = {}) => {
      if (skip || !path) return;

      const entry = readCache(path);
      if (entry) {
        setData(entry.data);
        setLoading(false);
        // Fresh enough, and not an explicit refresh — nothing more to do.
        if (entry.fresh && !force) return;
      } else {
        setLoading(true);
      }

      setError(null);
      try {
        const result = await shareRequest(path, () => apiFetch(path));
        if (mounted.current) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (mounted.current) {
          setError(err);
          setLoading(false);
        }
      }
    },
    [path, skip]
  );

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => {
    if (path) cache.delete(path);
    return load({ force: true });
  }, [load, path]);

  return { data, loading, error, reload };
}
