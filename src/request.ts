import axios, { type AxiosRequestConfig, AxiosHeaders } from 'axios';

import { getGlobalRequestConfig } from './config';

export type RequestConfig = AxiosRequestConfig & {
  skipUnauthorizedHandler?: boolean;
};

const instance = axios.create();

instance.interceptors.request.use((config) => {
  const global = getGlobalRequestConfig();

  const merged = {
    ...(global.defaultHeaders?.() || {}),
    ...(config.headers || {}),
  };

  config.headers = AxiosHeaders.from(merged);
  config.baseURL = config.baseURL || global.baseURL || '/api';

  return config;
});

let lastUnauthorizedAt = 0;
const BATCH_WINDOW_MS = 1000;

instance.interceptors.response.use(
  (r) => r,
  (err) => {
    if (!axios.isAxiosError(err)) {
      return Promise.reject(err);
    }

    const status = err.response?.status;
    const cfg = err.config as RequestConfig | undefined;

    if (status === 401 && !cfg?.skipUnauthorizedHandler) {
      const now = Date.now();
      if (now - lastUnauthorizedAt > BATCH_WINDOW_MS) {
        getGlobalRequestConfig().onUnauthorized?.();
        lastUnauthorizedAt = now;
      }
    }

    return Promise.reject(err);
  },
);

export const request = async <T = unknown>(
  path: string,
  config?: RequestConfig,
): Promise<T> => {
  return instance
    .request<T>({
      url: path,
      ...config,
    })
    .then((res) => res.data);
};
