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

  const run = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);

    request(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setData(data);
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          setError(err);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, deps);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return { data, error, loading, run, abort: () => abortRef.current?.abort() };
}
