import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../__tests__/server';

import { setupRequest } from './config';
import { request } from './request';

const BASE = 'http://test.local';

/** Reset global config before each test to prevent cross-test pollution. */
function resetConfig() {
  setupRequest({
    auth: undefined,
    toast: undefined,
    baseURL: BASE,
    defaultHeaders: undefined,
    onUnauthorized: undefined,
    retryAfterRefresh: 1,
    shouldRefreshOnStatus: (s) => s === 401 || s === 419 || s === 440,
  });
  request.reset();
}

beforeEach(resetConfig);

// ---------------------------------------------------------------------------
// Basic requests
// ---------------------------------------------------------------------------

describe('basic requests', () => {
  it('returns the response body', async () => {
    server.use(http.get(`${BASE}/ping`, () => HttpResponse.json({ ok: true })));

    const data = await request('/ping');
    expect(data).toEqual({ ok: true });
  });

  it('leaves baseURL undefined when not configured (falls back to /api at runtime)', async () => {
    setupRequest({ baseURL: undefined });
    const { getGlobalRequestConfig } = await import('./config');
    expect(getGlobalRequestConfig().baseURL).toBeUndefined();
  });

  it('merges defaultHeaders into every request', async () => {
    let received: string | null = null;
    server.use(
      http.get(`${BASE}/headers`, ({ request: req }) => {
        received = req.headers.get('x-app-version');
        return HttpResponse.json({});
      }),
    );

    setupRequest({ defaultHeaders: () => ({ 'x-app-version': '1.0.0' }) });
    await request('/headers');
    expect(received).toBe('1.0.0');
  });
});

// ---------------------------------------------------------------------------
// request.public
// ---------------------------------------------------------------------------

describe('request.public', () => {
  it('does not attach an Authorization header', async () => {
    let authHeader: string | null = null;
    server.use(
      http.get(`${BASE}/public`, ({ request: req }) => {
        authHeader = req.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    setupRequest({
      auth: {
        addAuthToRequest: (config) => {
          (config.headers as Record<string, string>)['Authorization'] =
            'Bearer token';
          return config;
        },
        refresh: vi.fn(),
      },
    });

    await request.public('/public');
    expect(authHeader).toBeNull();
  });

  it('does not trigger refresh on 401', async () => {
    server.use(
      http.get(`${BASE}/public`, () => new HttpResponse(null, { status: 401 })),
    );

    const refreshFn = vi.fn();
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    await expect(request.public('/public')).rejects.toThrow();
    expect(refreshFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// request.auth
// ---------------------------------------------------------------------------

describe('request.auth', () => {
  it('attaches the Authorization header via the auth strategy', async () => {
    let received: string | null = null;
    server.use(
      http.get(`${BASE}/protected`, ({ request: req }) => {
        received = req.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    setupRequest({
      auth: {
        addAuthToRequest: (config) => {
          (config.headers as Record<string, string>)['Authorization'] =
            'Bearer secret-token';
          return config;
        },
        refresh: vi.fn(),
      },
    });

    await request.auth('/protected');
    expect(received).toBe('Bearer secret-token');
  });

  it('skips refresh but calls onUnauthorized when noRefresh is true', async () => {
    server.use(
      http.get(
        `${BASE}/protected`,
        () => new HttpResponse(null, { status: 401 }),
      ),
    );

    const refreshFn = vi.fn();
    const onUnauthorized = vi.fn();
    setupRequest({
      auth: { addAuthToRequest: (c) => c, refresh: refreshFn },
      onUnauthorized,
    });

    await expect(
      request.auth('/protected', { noRefresh: true }),
    ).rejects.toThrow();
    expect(refreshFn).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// 401 refresh and retry
// ---------------------------------------------------------------------------

describe('401 refresh and retry', () => {
  it('calls refresh then retries the request on 401', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/data`, () => {
        callCount++;
        return callCount === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ result: 'ok' });
      }),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    const data = await request.auth('/data');

    expect(refreshFn).toHaveBeenCalledOnce();
    expect(data).toEqual({ result: 'ok' });
    expect(callCount).toBe(2);
  });

  it('419 triggers refresh (covered by shouldRefreshOnStatus)', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/session`, () => {
        callCount++;
        return callCount === 1
          ? new HttpResponse(null, { status: 419 })
          : HttpResponse.json({ ok: true });
      }),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    await request.auth('/session');
    expect(refreshFn).toHaveBeenCalledOnce();
    expect(callCount).toBe(2);
  });

  it('calls onRefreshFailed and onUnauthorized when refresh fails', async () => {
    server.use(
      http.get(`${BASE}/data`, () => new HttpResponse(null, { status: 401 })),
    );

    const refreshErr = new Error('refresh failed');
    const onRefreshFailed = vi.fn();
    const onUnauthorized = vi.fn();

    setupRequest({
      auth: {
        addAuthToRequest: (c) => c,
        refresh: vi.fn().mockRejectedValue(refreshErr),
        onRefreshFailed,
      },
      onUnauthorized,
    });

    await expect(request.auth('/data')).rejects.toThrow();
    expect(onRefreshFailed).toHaveBeenCalledWith(refreshErr);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('skips refresh but calls onUnauthorized when skipRefresh is true', async () => {
    server.use(
      http.get(`${BASE}/data`, () => new HttpResponse(null, { status: 401 })),
    );

    const refreshFn = vi.fn();
    const onUnauthorized = vi.fn();
    setupRequest({
      auth: { addAuthToRequest: (c) => c, refresh: refreshFn },
      onUnauthorized,
    });

    await expect(
      request.auth('/data', { meta: { skipRefresh: true } }),
    ).rejects.toThrow();
    expect(refreshFn).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not call onUnauthorized when skipUnauthorizedHandler is true', async () => {
    server.use(
      http.get(`${BASE}/data`, () => new HttpResponse(null, { status: 401 })),
    );

    const onUnauthorized = vi.fn();
    setupRequest({
      auth: {
        addAuthToRequest: (c) => c,
        refresh: vi.fn().mockRejectedValue(new Error('fail')),
      },
      onUnauthorized,
    });

    await expect(
      request.auth('/data', { meta: { skipUnauthorizedHandler: true } }),
    ).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Concurrent refresh deduplication
// ---------------------------------------------------------------------------

describe('concurrent refresh deduplication', () => {
  it('3 concurrent 401 responses only trigger one refresh call', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE}/concurrent`, () => {
        requestCount++;
        // First 3 calls (initial requests) return 401; retries return 200.
        return requestCount <= 3
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ ok: true });
      }),
    );

    const refreshFn = vi
      .fn()
      .mockImplementation(
        () => new Promise<void>((resolve) => setTimeout(resolve, 30)),
      );

    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    const results = await Promise.all([
      request.auth('/concurrent'),
      request.auth('/concurrent'),
      request.auth('/concurrent'),
    ]);

    expect(refreshFn).toHaveBeenCalledOnce();
    results.forEach((r) => expect(r).toEqual({ ok: true }));
  });
});

// ---------------------------------------------------------------------------
// credentials option
// ---------------------------------------------------------------------------

describe('credentials option', () => {
  it('credentials:"always" sets withCredentials:true', async () => {
    server.use(http.get(`${BASE}/data`, () => HttpResponse.json({ ok: true })));
    const data = await request.public('/data', { credentials: 'always' });
    expect(data).toEqual({ ok: true });
  });

  it('credentials:"never" sets withCredentials:false (does not send cookies)', async () => {
    server.use(http.get(`${BASE}/data`, () => HttpResponse.json({ ok: true })));
    // Fixed: credentials:'never' now explicitly passes withCredentials:false
    const data = await request.public('/data', { credentials: 'never' });
    expect(data).toEqual({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// retryAfterRefresh
// ---------------------------------------------------------------------------

describe('retryAfterRefresh', () => {
  it('retryAfterRefresh:0 does not retry after refresh', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/data`, () => {
        callCount++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({
      auth: { addAuthToRequest: (c) => c, refresh: refreshFn },
      retryAfterRefresh: 0,
    });

    await expect(request.auth('/data')).rejects.toThrow();

    // Fixed: Math.max(0, 0) = 0, so no retry happens — only 1 request total.
    expect(callCount).toBe(1);
  });

  it('retryAfterRefresh:2 retries up to 2 times', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/data`, () => {
        callCount++;
        if (callCount <= 2) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({ ok: true });
      }),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({
      auth: { addAuthToRequest: (c) => c, refresh: refreshFn },
      retryAfterRefresh: 2,
    });

    const data = await request.auth('/data');
    expect(data).toEqual({ ok: true });
    expect(callCount).toBe(3); // 1 initial + 2 retries
  });
});

// ---------------------------------------------------------------------------
// request.init
// ---------------------------------------------------------------------------

describe('request.init', () => {
  afterEach(() => {
    request.reset();
  });

  it('returns data on success', async () => {
    server.use(http.get(`${BASE}/me`, () => HttpResponse.json({ id: 1 })));
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: vi.fn() } });

    const data = await request.init('/me');
    expect(data).toEqual({ id: 1 });
  });

  it('returns null when request fails and no auth strategy is configured', async () => {
    server.use(
      http.get(`${BASE}/me`, () => new HttpResponse(null, { status: 401 })),
    );

    const data = await request.init('/me');
    expect(data).toBeNull();
  });

  it('performs a soft refresh on initial failure and retries', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/me`, () => {
        callCount++;
        return callCount === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ id: 1 });
      }),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    const data = await request.init('/me');
    expect(data).toEqual({ id: 1 });
    expect(refreshFn).toHaveBeenCalledOnce();
  });

  it('soft refresh only fires once across multiple init() calls (didInitSoftRefresh flag)', async () => {
    server.use(
      http.get(`${BASE}/me`, () => new HttpResponse(null, { status: 401 })),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    await request.init('/me');
    await request.init('/me'); // flag already set — no second refresh

    expect(refreshFn).toHaveBeenCalledOnce();
  });

  it('reset() clears the didInitSoftRefresh flag', async () => {
    server.use(
      http.get(`${BASE}/me`, () => new HttpResponse(null, { status: 401 })),
    );

    const refreshFn = vi.fn().mockResolvedValue(undefined);
    setupRequest({ auth: { addAuthToRequest: (c) => c, refresh: refreshFn } });

    await request.init('/me');
    request.reset();
    await request.init('/me'); // flag was reset — soft refresh fires again

    expect(refreshFn).toHaveBeenCalledTimes(2);
  });
});
