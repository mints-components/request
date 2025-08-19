import axios, { type AxiosError } from 'axios';

import { getGlobalRequestConfig, type ToastFn } from './config';

export type OperateConfig<E> = {
  setOperating?: (loading: boolean) => void;
  formatMessage?: () => string;
  formatReason?: (err: E) => string;
  hideToast?: boolean;
  toast?: {
    success?: ToastFn;
    error?: ToastFn;
  };
};

type ApiErrorBody = {
  message?: string;
  error?: string;
  detail?: string;
  errors?: string | string[];
};

function extractAxiosMessage(err: AxiosError<ApiErrorBody>): string {
  const data = err.response?.data;

  if (typeof data === 'string') return data;

  if (data && typeof data === 'object') {
    const { message, error, detail, errors } = data;
    const merged =
      message ??
      error ??
      detail ??
      (Array.isArray(errors) ? errors.join(', ') : errors);
    if (merged) return merged;
  }

  return err.message || 'Unknown error';
}

export async function operator<T, E = unknown>(
  request: () => Promise<T>,
  config: OperateConfig<E> = {},
): Promise<[boolean, T?, E?]> {
  const global = getGlobalRequestConfig();
  const {
    setOperating,
    formatMessage,
    formatReason = (err: E) => {
      if (axios.isAxiosError<ApiErrorBody>(err)) {
        return extractAxiosMessage(err);
      }
      if (err instanceof Error) return err.message;
      return String(err ?? 'Unknown error');
    },
    hideToast,
    toast: localToast,
  } = config;

  const toast = localToast ?? global.toast;

  try {
    setOperating?.(true);
    const res = await request();
    if (!hideToast) toast?.success?.(formatMessage?.() ?? 'Success');
    return [true, res];
  } catch (err) {
    const typed = err as E;
    if (!hideToast) toast?.error?.(formatReason(typed));
    return [false, undefined, typed];
  } finally {
    setOperating?.(false);
  }
}
