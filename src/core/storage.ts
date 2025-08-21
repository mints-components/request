export interface TokenStorage {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  getRefreshToken?(): string | null;
  setRefreshToken?(token: string | null): void;
}

export const memoryStorage: TokenStorage = (() => {
  let access: string | null = null;
  let refresh: string | null = null;
  return {
    getAccessToken: () => access,
    setAccessToken: (t) => (access = t),
    getRefreshToken: () => refresh,
    setRefreshToken: (t) => (refresh = t),
  };
})();

const safeLocal = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const localStorageStorage: TokenStorage = {
  getAccessToken: () => safeLocal()?.getItem('access_token') ?? null,
  setAccessToken: (t) => {
    const ls = safeLocal();
    if (!ls) return;
    if (t) {
      ls.setItem('access_token', t);
    } else {
      ls.removeItem('access_token');
    }
  },
  getRefreshToken: () => safeLocal()?.getItem('refresh_token') ?? null,
  setRefreshToken: (t) => {
    const ls = safeLocal();
    if (!ls) return;
    if (t) {
      ls.setItem('refresh_token', t);
    } else {
      ls.removeItem('refresh_token');
    }
  },
};
