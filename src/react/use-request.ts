import { useState, useRef, useEffect, useCallback } from 'react';

export function useRequest<T, E>(
  request: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  initialValue?: T,
) {
  const [data, setData] = useState<T | undefined>(initialValue);
  const [error, setError] = useState<E | null>(null);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Track mounted state to avoid state updates after unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await request(ctrl.signal);

      // Guard: do not update state if aborted or unmounted
      if (!mountedRef.current || ctrl.signal.aborted) return res;

      setData(res);
      return res;
    } catch (e) {
      const isCanceled =
        (e as { name: string })?.name === 'AbortError' ||
        (e as { name: string })?.name === 'CanceledError' ||
        (e as { code: string })?.code === 'ERR_CANCELED';

      if (!isCanceled && mountedRef.current && !ctrl.signal.aborted) {
        setError(e as E);
      }
      throw e;
    } finally {
      if (mountedRef.current && !ctrl.signal.aborted) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return { data, error, loading, run, abort: () => abortRef.current?.abort() };
}
