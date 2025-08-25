import { AxiosHeaders, type AxiosRequestConfig } from 'axios';

import type { AuthStrategy } from './config';
import {
  memoryStorage,
  localStorageStorage,
  type TokenStorage,
} from './storage';

function addAuthHeader<T extends AxiosRequestConfig>(
  config: T,
  token: string | null,
): T {
  if (token) {
    config.headers = AxiosHeaders.from({
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    });
  }
  return config;
}

/**
 * Cookie-based strategy:
 * - Access token lives in app state (memory/storage).
 * - Refresh relies on http-only cookie via a server endpoint.
 */
export function createCookieStrategy(opts: {
  storage?: TokenStorage;
  tokenField?: string; // default: "access_token"
  refreshPath: string; // e.g., '/auth/refresh'
}): AuthStrategy {
  const storage = opts.storage ?? memoryStorage;
  const accessKey = opts?.tokenField ?? 'access_token';

  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      return addAuthHeader(config, storage.getAccessToken());
    },
    async refresh(signal?: AbortSignal) {
      const res = await fetch(opts.refreshPath, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      try {
        const json = await res.json();
        if (json?.[accessKey]) {
          storage.setAccessToken(json[accessKey]);
        }
      } catch {
        // Some backends may not return JSON; cookie-only session is fine.
      }
    },
    setToken({ accessToken, refreshToken }) {
      if (accessToken) storage.setAccessToken(accessToken);
      if (refreshToken) storage.setRefreshToken?.(refreshToken);
    },
    clearToken() {
      storage.setAccessToken(null);
      storage.setRefreshToken?.(null);
    },
  };
}

/**
 * Token-exchange strategy:
 * - Both access and refresh tokens are readable by JS (NOT http-only).
 */
export function createTokenStrategy(opts: {
  storage?: TokenStorage;
  tokenField?: string; // default: "access_token"
  refreshPath: string;
}): AuthStrategy {
  const storage = opts.storage ?? localStorageStorage;
  const accessKey = opts?.tokenField ?? 'access_token';

  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      return addAuthHeader(config, storage.getAccessToken());
    },
    async refresh(signal?: AbortSignal) {
      const rt = storage.getRefreshToken?.();
      if (!rt) throw new Error('No refresh token');
      const res = await fetch(opts.refreshPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: rt }),
        signal,
      });
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      const json = await res.json();
      if (!json?.[accessKey]) throw new Error('Malformed refresh response');
      storage.setAccessToken(json[accessKey]);
      if (json.refresh_token) storage.setRefreshToken?.(json.refresh_token);
    },
    setToken({ accessToken, refreshToken }) {
      if (accessToken) storage.setAccessToken(accessToken);
      if (refreshToken) storage.setRefreshToken?.(refreshToken);
    },
    clearToken() {
      storage.setAccessToken(null);
      storage.setRefreshToken?.(null);
    },
  };
}
