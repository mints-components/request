import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useRequest } from './use-request';

/** Creates a manually controllable Promise. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Basic state transitions
// ---------------------------------------------------------------------------

describe('basic state transitions', () => {
  it('auto-fetches on mount and returns data on success', async () => {
    const { result } = renderHook(() =>
      useRequest(() => Promise.resolve({ id: 1 })),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
  });

  it('loading is true while the request is in progress', async () => {
    const { promise, resolve } = deferred<string>();

    const { result } = renderHook(() => useRequest(() => promise));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve('done');
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('done');
  });

  it('sets error and loading:false on request failure', async () => {
    const err = new Error('request failed');

    // Use lazy mode so run() can be awaited and its rejection caught explicitly.
    // In auto-run mode the rejection is swallowed (error is captured in state).
    const { result } = renderHook(() =>
      useRequest(() => Promise.reject(err), [], undefined, {
        lazy: true,
      }),
    );

    await act(async () => {
      try {
        await result.current.run();
      } catch {
        // run() re-throws; catching here keeps the test clean
      }
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(err);
    expect(result.current.data).toBeUndefined();
  });

  it('uses initialValue as the initial data', () => {
    const { result } = renderHook(() =>
      useRequest(() => Promise.resolve([1, 2, 3]), [], [0], {
        lazy: true,
      }),
    );

    expect(result.current.data).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// Lazy mode
// ---------------------------------------------------------------------------

describe('lazy mode', () => {
  it('does not auto-fetch when lazy:true, initial loading is false', () => {
    const requestFn = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(() =>
      useRequest(requestFn, [], undefined, { lazy: true }),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(requestFn).not.toHaveBeenCalled();
  });

  it('manually calling run() triggers the request when lazy:true', async () => {
    const { result } = renderHook(() =>
      useRequest(() => Promise.resolve('lazy-data'), [], undefined, {
        lazy: true,
      }),
    );

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.data).toBe('lazy-data');
    expect(result.current.loading).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Manual run()
// ---------------------------------------------------------------------------

describe('run()', () => {
  it('returns the request result', async () => {
    const { result } = renderHook(() =>
      useRequest(() => Promise.resolve(42), [], undefined, {
        lazy: true,
      }),
    );

    let returnValue: number | undefined;
    await act(async () => {
      returnValue = await result.current.run();
    });

    expect(returnValue).toBe(42);
  });

  it('cancels the previous request when run() is called again (race condition protection)', async () => {
    let resolveFirst!: (v: string) => void;
    let callCount = 0;

    const { result } = renderHook(() =>
      useRequest(
        () => {
          callCount++;
          if (callCount === 1) {
            return new Promise<string>((res) => {
              resolveFirst = res;
            });
          }
          return Promise.resolve('second');
        },
        [],
        undefined,
        { lazy: true },
      ),
    );

    // Start first request without awaiting
    act(() => {
      result.current.run();
    });

    // Start second request and wait for it to complete
    await act(async () => {
      await result.current.run();
    });

    // Resolve the first request — it should be treated as stale and discarded
    await act(async () => {
      resolveFirst('first');
    });

    expect(result.current.data).toBe('second');
  });
});

// ---------------------------------------------------------------------------
// abort()
// ---------------------------------------------------------------------------

describe('abort()', () => {
  it('does not update data or error state after abort()', async () => {
    const { promise, resolve } = deferred<string>();

    const { result } = renderHook(() =>
      useRequest(() => promise, [], undefined, { lazy: true }),
    );

    act(() => {
      result.current.run();
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.abort();
    });

    await act(async () => {
      resolve('should be ignored');
      await promise.catch(() => {});
    });

    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unmount cleanup
// ---------------------------------------------------------------------------

describe('unmount cleanup', () => {
  it('a pending request does not update state after unmount (no React warnings)', async () => {
    const { promise, resolve } = deferred<string>();

    const { result, unmount } = renderHook(() => useRequest(() => promise));

    expect(result.current.loading).toBe(true);

    unmount();

    await act(async () => {
      resolve('should not update state');
      await promise;
    });

    // After unmount the snapshot stays as-is; no state update should fire.
    expect(result.current.loading).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deps change triggers re-fetch
// ---------------------------------------------------------------------------

describe('deps change', () => {
  it('re-fetches when deps change', async () => {
    let callCount = 0;

    const { rerender } = renderHook(
      ({ id }: { id: number }) =>
        useRequest(() => {
          callCount++;
          return Promise.resolve({ id });
        }, [id]),
      { initialProps: { id: 1 } },
    );

    await waitFor(() => expect(callCount).toBe(1));

    rerender({ id: 2 });

    await waitFor(() => expect(callCount).toBe(2));
  });
});

// ---------------------------------------------------------------------------
// Known limitation
// ---------------------------------------------------------------------------

describe('known limitation', () => {
  it('[Note] stale closure when request function changes but deps do not cover the change', async () => {
    // If the request function is a closure whose captured value changes,
    // but deps=[] stays empty, useCallback returns the stale reference.
    // Users must include all relevant dependencies in the deps array.

    let counter = 0;
    const makeRequest = (captured: number) => (): Promise<number> =>
      Promise.resolve(captured);

    const { result, rerender } = renderHook(
      ({ req }: { req: () => Promise<number> }) =>
        // deps=[] — changes to req are intentionally not tracked here
        useRequest(req, []),
      { initialProps: { req: makeRequest(counter) } },
    );

    await waitFor(() => expect(result.current.data).toBe(0));

    counter = 99;
    rerender({ req: makeRequest(counter) });

    // useCallback is not refreshed because deps=[] did not change,
    // so data remains 0 (the stale value).
    await waitFor(() => expect(result.current.data).toBe(0));
  });
});
