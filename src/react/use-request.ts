import { useState, useRef, useEffect, useCallback } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function useRequest<T, E = unknown>(
  request: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  initialValue?: T,
  opts?: { lazy?: boolean },
) {
  const [data, setData] = useState<T | undefined>(initialValue);
  const [error, setError] = useState<E | null>(null);
  const [status, setStatus] = useState<Status>(
    opts?.lazy ? 'idle' : initialValue === undefined ? 'loading' : 'idle',
  );

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Track mounted state to avoid state updates after unmount
  useEffect(() => {
    mountedRef.current = true;

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
      setStatus('loading');
      setError(null);
    }

    try {
      const res = await request(ctrl.signal);

      // stale or canceled -> do not write
      const isStale =
        !mountedRef.current || ctrl.signal.aborted || abortRef.current !== ctrl;
      if (isStale) return res;

      setData(res);
      setStatus('success');
      return res;
    } catch (e) {
      const isCanceled =
        (e as { name?: string })?.name === 'AbortError' ||
        (e as { name?: string })?.name === 'CanceledError' ||
        (e as { code?: string })?.code === 'ERR_CANCELED';

      const isStale =
        !mountedRef.current || ctrl.signal.aborted || abortRef.current !== ctrl;

      if (isCanceled || isStale) {
        // swallow cancellations/stale completions; keep current status
        return undefined as unknown as T;
      }

      // real error (current generation)
      setError(e as E);
      setStatus('error');
      throw e;
    }
  }, deps);

  useEffect(() => {
    if (!opts?.lazy) {
      // Swallow the rejection here — the error is already captured in state.
      // Callers who need to catch errors should use lazy mode and call run() directly.
      run().catch(() => {});
      return () => abortRef.current?.abort();
    }
  }, [run]);

  return {
    data,
    error,
    loading: status === 'loading',
    run,
    abort: () => abortRef.current?.abort(),
  };
}
