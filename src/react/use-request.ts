import { useState, useRef, useEffect, useCallback } from 'react';

export const useRequest = <T>(
  request: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  initialValue?: T,
) => {
  const [state, setState] = useState<{
    loading: boolean;
    data?: T;
    error?: unknown;
  }>({
    loading: false,
    data: initialValue,
  });

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ loading: true });

    request(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setState({ loading: false, data });
        }
      })
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          setState({ loading: false, error: err });
        }
      });

    return () => {
      ctrl.abort();
    };
  }, deps);

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
  }, [run]);

  return state;
};
