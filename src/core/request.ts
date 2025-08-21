import axios, {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

import { getGlobalRequestConfig } from './config';

/** Per-request behavior toggles */
export type RequestMeta = {
  /** Do not attach credentials (skip strategy.addAuthToRequest) */
  skipAuth?: boolean;
  /** Do not attempt refresh on 401/419 */
  skipRefresh?: boolean;
  /** Do not call global onUnauthorized when unauthorized */
  skipUnauthorizedHandler?: boolean;
  /** Internal guard to avoid infinite retry loops */
  _retried?: number;
};

// Axios module augmentation to allow config.meta
declare module 'axios' {
  export interface AxiosRequestConfig {
    meta?: RequestMeta;
  }
}

const instance = axios.create();

// ---- request interceptor: baseURL, headers, auth attachment ----
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const global = getGlobalRequestConfig();

  // Merge headers (defaultHeaders first so explicit config wins)
  const mergedHeaders = {
    ...(global.defaultHeaders?.() || {}),
    ...(config.headers || {}),
  };

  config.headers = AxiosHeaders.from(mergedHeaders);
  config.baseURL = config.baseURL || global.baseURL || '/api';

  // Attach Authorization (or other credentials) if strategy is present and not skipped
  if (!config.meta?.skipAuth && global.auth) {
    config = global.auth.addAuthToRequest(config);
  }

  return config;
});

// ---- refresh de-duplication ----
let refreshPromise: Promise<void> | null = null;

async function ensureRefreshed(signal?: AbortSignal) {
  const { auth } = getGlobalRequestConfig();
  if (!auth) return;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        await auth.refresh(signal);
      } finally {
        // Reset promise regardless of success/failure
        const p = refreshPromise;
        refreshPromise = null;
        await (p as Promise<void> | null)?.catch(() => undefined);
      }
    })();
  }
  return refreshPromise;
}

function shouldAttemptRefresh(error: AxiosError): boolean {
  const { shouldRefreshOnStatus } = getGlobalRequestConfig();
  const status = error.response?.status;
  return typeof status === 'number' && !!shouldRefreshOnStatus?.(status);
}

async function retryOnce<T>(
  original: InternalAxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  const global = getGlobalRequestConfig();
  const retryMax = Math.max(1, global.retryAfterRefresh ?? 1);

  const meta = original.meta || (original.meta = {});
  const count = meta._retried ?? 0;

  if (count >= retryMax) {
    throw new Error('Max retries after refresh exceeded');
  }

  meta._retried = count + 1;
  return instance.request<T>(original);
}

// ---- response interceptor: 401 -> refresh -> retry ----
instance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const global = getGlobalRequestConfig();
    const cfg = (error.config || {}) as InternalAxiosRequestConfig;

    // If no strategy or refresh is skipped, do not handle here
    if (cfg.meta?.skipRefresh || !global.auth || !shouldAttemptRefresh(error)) {
      if (shouldAttemptRefresh(error) && !cfg.meta?.skipUnauthorizedHandler) {
        global.onUnauthorized?.();
      }
      return Promise.reject(error);
    }

    // Optional proactive validity check (if provided)
    if (global.auth.isAccessTokenValid?.()) {
      // Token claims still "valid" but server says unauthorized -> bubble up
      return Promise.reject(error);
    }

    try {
      await ensureRefreshed(cfg.signal as AbortSignal | undefined);
      const retried = await retryOnce(cfg);
      return retried;
    } catch (refreshErr) {
      global.auth.onRefreshFailed?.(refreshErr);
      if (!cfg.meta?.skipUnauthorizedHandler) {
        global.onUnauthorized?.();
      }
      return Promise.reject(error);
    }
  },
);

// ---- public/auth helpers on top of base request() ----

type CredentialsMode = 'auto' | 'always' | 'never';
function computeWithCredentials(mode?: CredentialsMode): boolean {
  if (!mode || mode === 'auto') return false;
  return mode === 'always';
}

export type PublicOptions = { credentials?: CredentialsMode };
export type AuthOptions = {
  noRefresh?: boolean;
  credentials?: CredentialsMode;
};

// Core callable function (default = public)
export type RequestFn = <T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
) => Promise<T>;

async function baseRequest<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await instance.request<T>({ url, ...config });
  return res.data;
}

/**
 * The exported request is both callable and has .public/.auth shortcuts.
 * Calling request(url, config) equals request.public(url, config).
 */
const request = ((url: string, config?: AxiosRequestConfig) => {
  return request.public(url, config);
}) as RequestFn & {
  public: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig & PublicOptions,
  ) => Promise<T>;
  auth: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig & AuthOptions,
  ) => Promise<T>;
};

request.public = async function <T = unknown>(
  url: string,
  config?: AxiosRequestConfig & PublicOptions,
): Promise<T> {
  const withCredentials = computeWithCredentials(config?.credentials);
  return baseRequest<T>(url, {
    ...config,
    withCredentials,
    meta: {
      ...(config?.meta || {}),
      skipAuth: true,
      skipRefresh: true,
      skipUnauthorizedHandler: true,
    },
  });
};

request.auth = async function <T = unknown>(
  url: string,
  config?: AxiosRequestConfig & AuthOptions,
): Promise<T> {
  const withCredentials = computeWithCredentials(config?.credentials);
  return baseRequest<T>(url, {
    ...config,
    withCredentials,
    meta: {
      ...(config?.meta || {}),
      ...(config?.noRefresh ? { skipRefresh: true } : {}),
    },
  });
};

export { request };
export type { AxiosRequestConfig } from 'axios';
