import axios from 'axios';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { setupRequest } from './config';
import { operator } from './operator';

beforeEach(() => {
  setupRequest({ toast: undefined, baseURL: undefined });
});

// ---------------------------------------------------------------------------
// Return value shape
// ---------------------------------------------------------------------------

describe('return value shape', () => {
  it('returns [true, data] on success', async () => {
    const [ok, data] = await operator(() => Promise.resolve({ id: 1 }));
    expect(ok).toBe(true);
    expect(data).toEqual({ id: 1 });
  });

  it('returns [false, error] on failure', async () => {
    const err = new Error('something went wrong');
    const [ok, error] = await operator(() => Promise.reject(err));
    expect(ok).toBe(false);
    expect(error).toBe(err);
  });

  it('returns [true, undefined] when resolved value is undefined', async () => {
    const [ok, data] = await operator(() => Promise.resolve(undefined));
    expect(ok).toBe(true);
    expect(data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setOperating (loading state)
// ---------------------------------------------------------------------------

describe('setOperating', () => {
  it('sets true before request and false after (success)', async () => {
    const calls: boolean[] = [];
    await operator(() => Promise.resolve('done'), {
      setOperating: (v) => calls.push(v),
    });
    expect(calls).toEqual([true, false]);
  });

  it('sets true before request and false after (failure)', async () => {
    const calls: boolean[] = [];
    await operator(() => Promise.reject(new Error('err')), {
      setOperating: (v) => calls.push(v),
    });
    expect(calls).toEqual([true, false]);
  });

  it('always calls setOperating(false) in finally even when async throws', async () => {
    const setOperating = vi.fn();
    await operator(
      async () => {
        await Promise.resolve();
        throw new Error('async error');
      },
      { setOperating },
    );
    expect(setOperating).toHaveBeenLastCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

describe('toast', () => {
  it('calls toast.success on success (local toast config)', async () => {
    const success = vi.fn();
    await operator(() => Promise.resolve('ok'), { toast: { success } });
    expect(success).toHaveBeenCalledOnce();
  });

  it('shows the message returned by formatMessage on success', async () => {
    const success = vi.fn();
    await operator(() => Promise.resolve('ok'), {
      formatMessage: () => 'Saved successfully',
      toast: { success },
    });
    expect(success).toHaveBeenCalledWith('Saved successfully');
  });

  it('calls toast.error on failure (local toast config)', async () => {
    const error = vi.fn();
    await operator(() => Promise.reject(new Error('fail')), {
      toast: { error },
    });
    expect(error).toHaveBeenCalledOnce();
  });

  it('does not call any toast when hideToast is true', async () => {
    const success = vi.fn();
    const error = vi.fn();
    await operator(() => Promise.resolve('ok'), {
      hideToast: true,
      toast: { success, error },
    });
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('local toast takes priority over global toast', async () => {
    const globalSuccess = vi.fn();
    const localSuccess = vi.fn();

    setupRequest({ toast: { success: globalSuccess } });

    await operator(() => Promise.resolve('ok'), {
      toast: { success: localSuccess },
    });

    expect(localSuccess).toHaveBeenCalledOnce();
    expect(globalSuccess).not.toHaveBeenCalled();
  });

  it('falls back to global toast when no local toast is provided', async () => {
    const globalError = vi.fn();
    setupRequest({ toast: { error: globalError } });

    await operator(() => Promise.reject(new Error('err')));

    expect(globalError).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Error message extraction (formatReason)
// ---------------------------------------------------------------------------

describe('error message extraction', () => {
  it('extracts the message field from an Axios error response', async () => {
    const errorFn = vi.fn();
    const axiosErr = new axios.AxiosError(
      'ignored',
      undefined,
      undefined,
      undefined,
      {
        data: { message: 'User not found' },
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config: {} as never,
      },
    );

    await operator(() => Promise.reject(axiosErr), {
      toast: { error: errorFn },
    });
    expect(errorFn).toHaveBeenCalledWith('User not found');
  });

  it('prefers message over error over detail in Axios error response', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ message: 'msg' }, 'msg'],
      [{ error: 'err' }, 'err'],
      [{ detail: 'detail' }, 'detail'],
      [{ errors: ['e1', 'e2'] }, 'e1, e2'],
      [{ errors: 'single' }, 'single'],
    ];

    for (const [data, expected] of cases) {
      const errorFn = vi.fn();
      const axiosErr = new axios.AxiosError(
        'ignored',
        undefined,
        undefined,
        undefined,
        {
          data,
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: {} as never,
        },
      );

      await operator(() => Promise.reject(axiosErr), {
        toast: { error: errorFn },
      });
      expect(errorFn).toHaveBeenCalledWith(expected);
    }
  });

  it('uses err.message for non-Axios errors', async () => {
    const errorFn = vi.fn();
    await operator(() => Promise.reject(new Error('plain error')), {
      toast: { error: errorFn },
    });
    expect(errorFn).toHaveBeenCalledWith('plain error');
  });

  it('formatReason can override the error message', async () => {
    const errorFn = vi.fn();
    await operator(() => Promise.reject(new Error('raw')), {
      formatReason: () => 'Custom error description',
      toast: { error: errorFn },
    });
    expect(errorFn).toHaveBeenCalledWith('Custom error description');
  });
});
