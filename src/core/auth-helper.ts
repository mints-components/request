import { getGlobalRequestConfig } from './config';

export async function login(
  perform: () => Promise<{ accessToken?: string; refreshToken?: string }>,
) {
  const auth = getGlobalRequestConfig().auth;
  const json = await perform();
  auth?.setToken?.(json);
  return json;
}

export async function logout<T>(perform?: () => Promise<T>) {
  const auth = getGlobalRequestConfig().auth;
  try {
    if (perform) await perform();
  } finally {
    auth?.clearToken?.();
  }
}
