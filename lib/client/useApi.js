'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

/** Small data-fetching hook with loading, error and refetch, used by every page. */
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (skip || !path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch(path));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path, skip]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
