export type ToastFn = (msg: string) => void;

export interface GlobalRequestConfig {
  toast?: {
    success?: ToastFn;
    error?: ToastFn;
  };
  baseURL?: string;
  defaultHeaders?: () => Record<string, string>;
  onUnauthorized?: () => void;
}

const globalConfig: GlobalRequestConfig = {};

export const setupRequest = (config: GlobalRequestConfig) => {
  Object.assign(globalConfig, config);
};

export const updateRequestConfig = (patch: Partial<GlobalRequestConfig>) => {
  Object.assign(globalConfig, patch);
};

export const getGlobalRequestConfig = () => globalConfig;
