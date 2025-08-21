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

function isJwtValid(t: string | null, leewaySec = 30) {
  if (!t) return false;
  const [, payload] = t.split('.');
  try {
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === 'number' && Date.now() / 1000 < exp - leewaySec;
  } catch {
    return false;
  }
}

/**
 * Cookie-based strategy:
 * - Access token lives in app state (memory/storage).
 * - Refresh relies on http-only cookie via a server endpoint.
 */
export function createCookieStrategy(opts: {
  storage?: TokenStorage;
  refreshPath: string; // e.g., '/auth/refresh'
  isTokenValid?: () => boolean;
}): AuthStrategy {
  const storage = opts.storage ?? memoryStorage;

  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      return addAuthHeader(config, storage.getAccessToken());
    },
    isAccessTokenValid:
      opts.isTokenValid ?? (() => isJwtValid(storage.getAccessToken())),
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
        if (json?.access_token) {
          storage.setAccessToken(json.access_token);
        }
      } catch {
        // Some backends may not return JSON; cookie-only session is fine.
      }
    },
    onRefreshFailed(reason) {
      storage.setAccessToken(null);
      console.warn('Refresh failed', reason);
    },
  };
}

/**
 * Token-exchange strategy:
 * - Both access and refresh tokens are readable by JS (NOT http-only).
 */
export function createTokenStrategy(opts: {
  storage?: TokenStorage;
  refreshPath: string;
  isTokenValid?: () => boolean;
}): AuthStrategy {
  const storage = opts.storage ?? localStorageStorage;

  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      return addAuthHeader(config, storage.getAccessToken());
    },
    isAccessTokenValid:
      opts.isTokenValid ?? (() => isJwtValid(storage.getAccessToken())),
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
      if (!json?.access_token) throw new Error('Malformed refresh response');
      storage.setAccessToken(json.access_token);
      if (json.refresh_token) storage.setRefreshToken?.(json.refresh_token);
    },
    onRefreshFailed(reason) {
      storage.setAccessToken(null);
      storage.setRefreshToken?.(null);
      console.warn('Refresh failed', reason);
    },
  };
}
