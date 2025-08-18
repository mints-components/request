// operator.ts
import type { AxiosError } from 'axios';

import { getGlobalRequestConfig } from './config';

export type OperateConfig = {
  setOperating?: (success: boolean) => void;
  formatMessage?: () => string;
  formatReason?: (err: unknown) => string;
  hideToast?: boolean;
  toast?: {
    success?: (msg: string) => void;
    error?: (msg: string) => void;
  };
};

function isAxiosError(
  error: unknown,
): error is AxiosError<{ detail?: string }> {
  return typeof error === 'object' && error !== null && 'isAxiosError' in error;
}

export const operator = async <T>(
  request: () => Promise<T>,
  config?: OperateConfig,
): Promise<[boolean, T?, unknown?]> => {
  const {
    setOperating,
    formatMessage,
    formatReason,
    hideToast,
    toast: localToast,
  } = config || {};
  const globalToast = getGlobalRequestConfig().toast;

  try {
    setOperating?.(true);
    const res = await request();
    const message = formatMessage?.() ?? 'Success!';
    if (!hideToast) {
      if (localToast?.success) localToast?.success?.(message);
      else if (globalToast?.success) globalToast?.success?.(message);
    }
    return [true, res];
  } catch (err: unknown) {
    console.error('Failed!', err);

    let reason = 'Failed!';
    if (formatReason) {
      reason = formatReason(err);
    } else if (isAxiosError(err)) {
      reason = err.response?.data?.detail ?? err.message ?? reason;
    } else if (err instanceof Error) {
      reason = err.message;
    }

    if (!hideToast) {
      if (localToast?.error) localToast.error(reason);
      else if (globalToast?.error) globalToast.error(reason);
    }

    return [false, undefined, err];
  } finally {
    setOperating?.(false);
  }
};
