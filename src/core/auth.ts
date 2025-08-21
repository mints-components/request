import { AxiosHeaders, type AxiosRequestConfig } from 'axios';

import type { AuthStrategy } from './config';

/**
 * Cookie-based strategy:
 * - Access token lives in app state (memory/storage).
 * - Refresh relies on http-only cookie via a server endpoint.
 */
export function createCookieStrategy(opts: {
  getAccessToken: () => string | null;
  setAccessToken: (t: string | null) => void;
  refreshPath: string; // e.g., '/auth/refresh'
  isTokenValid?: () => boolean;
}): AuthStrategy {
  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      const token = opts.getAccessToken();
      if (token) {
        config.headers = AxiosHeaders.from({
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        });
      }
      return config;
    },
    isAccessTokenValid: opts.isTokenValid,
    async refresh(signal?: AbortSignal) {
      const res = await fetch(opts.refreshPath, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal,
      });
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      try {
        const json = await res.json();
        if (json?.access_token) {
          opts.setAccessToken(json.access_token);
        }
      } catch {
        // Some backends may not return JSON; cookie-only session is fine.
      }
    },
    onRefreshFailed(reason) {
      opts.setAccessToken(null);
      console.warn('Refresh failed', reason);
    },
  };
}

/**
 * Token-exchange strategy:
 * - Both access and refresh tokens are readable by JS (NOT http-only).
 */
export function createTokenStrategy(opts: {
  getAccessToken: () => string | null;
  setAccessToken: (t: string | null) => void;
  getRefreshToken: () => string | null;
  setRefreshToken: (t: string | null) => void;
  refreshPath: string;
  isTokenValid?: () => boolean;
}): AuthStrategy {
  return {
    addAuthToRequest<T extends AxiosRequestConfig>(config: T): T {
      const token = opts.getAccessToken();
      if (token) {
        config.headers = AxiosHeaders.from({
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        });
      }
      return config;
    },
    isAccessTokenValid: opts.isTokenValid,
    async refresh(signal?: AbortSignal) {
      const rt = opts.getRefreshToken();
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
      opts.setAccessToken(json.access_token);
      if (json.refresh_token) opts.setRefreshToken(json.refresh_token);
    },
    onRefreshFailed(reason) {
      opts.setAccessToken(null);
      opts.setRefreshToken(null);
      console.warn('Refresh failed', reason);
    },
  };
}
