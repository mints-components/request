import axios, { type AxiosRequestConfig, AxiosHeaders } from 'axios';

import { getGlobalRequestConfig } from './config';

export type RequestConfig = AxiosRequestConfig;

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

instance.interceptors.response.use(
  (r) => r,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      getGlobalRequestConfig().onUnauthorized?.();
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
