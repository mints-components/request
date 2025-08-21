import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

export type ToastFn = (msg: string) => void;

export interface AuthStrategy {
  /** Attach credentials (e.g., Authorization header) */
  addAuthToRequest: <T extends AxiosRequestConfig | InternalAxiosRequestConfig>(
    config: T,
  ) => T;

  /** Optional: return true if access token is still valid */
  isAccessTokenValid?: () => boolean;

  /** Refresh credentials; may rely on http-only cookie or token exchange */
  refresh: (signal?: AbortSignal) => Promise<void>;

  /** Optional: called when refresh ultimately fails */
  onRefreshFailed?: (reason: unknown) => void;
}

export interface GlobalRequestConfig {
  toast?: {
    success?: ToastFn;
    error?: ToastFn;
  };
  baseURL?: string;
  defaultHeaders?: () => Record<string, string>;
  onUnauthorized?: () => void;

  /** Pluggable authentication behavior */
  auth?: AuthStrategy;

  /** Max retries after a successful refresh (default: 1) */
  retryAfterRefresh?: number;

  /** Status codes that should trigger a refresh attempt (default: 401) */
  shouldRefreshOnStatus?: (status: number) => boolean;
}

const globalConfig: GlobalRequestConfig = {
  retryAfterRefresh: 1,
  shouldRefreshOnStatus: (s) => s === 401,
};

export const setupRequest = (config: GlobalRequestConfig) => {
  Object.assign(globalConfig, config);
};

export const updateRequestConfig = (patch: Partial<GlobalRequestConfig>) => {
  Object.assign(globalConfig, patch);
};

export const getGlobalRequestConfig = () => globalConfig;
