# @mints/request

A lightweight HTTP and operation wrapper built on Axios for React/Vite projects.
Supports pluggable authentication strategies, global config, toast integration, request retry after refresh, and clean async operation management.

## ✨ Features

- ✅ Simple Axios wrapper with unified config
- ✅ **Pluggable `AuthStrategy`** (cookie-based / token-based)
- ✅ Built-in **token storage** (`memory` / `localStorage`)
- ✅ Automatic **refresh + retry** on expired access tokens
- ✅ Global `toast` integration (decoupled from UI)
- ✅ `operator()` helper for async request + loading + error feedback
- ✅ Fine-grained per-request toggles (`skipAuth`, `skipRefresh`, `skipUnauthorizedHandler`)
- ✅ **React hook `useRequest`** for automatic requests with cancellation
- ✅ Helper functions `login` / `logout` for auto token management
- ✅ Minimal dependencies, framework agnostic (core) + optional React add-on

---

## 📦 Installation

```bash
npm install @mints/request axios
```

> `axios` is a peer dependency — please install it in your project.

---

## 🔧 Setup

Call `setupRequest()` once before using `request` or `operator` (e.g. in `src/setup.ts` or `main.tsx`):

```ts
// setup.ts
import { setupRequest, createCookieStrategy } from '@mints/request';
import { toast } from '@mints/ui'; // your own toast system

setupRequest({
  baseURL: '/api',
  toast: {
    success: toast.success,
    error: toast.error,
  },
  auth: createCookieStrategy({
    refreshPath: '/auth/refresh',
    tokenField: 'jwt', // default: "access_token"
  }),
  onUnauthorized: () => {
    window.location.href = '/login';
  },
});
```

- By default `createCookieStrategy` stores `token` in memory (`memoryStorage`).
- You can pass a custom `storage` (e.g. `localStorageStorage`) if persistence is needed.
- Default refresh status codes: `401, 419, 440`.

---

## 🚀 Usage (Core)

### 🔹 Basic `request`

```ts
import { request } from '@mints/request';

// Defaults to request.public
const users = await request('/users');
// or
const users = await request.public('/users');

// Authenticated API
const me = await request.auth('/me');
```

- `request.public(url, config)` → no auth, no refresh, safe for public endpoints.
- `request.auth(url, config)` → includes auth, retries after refresh if needed.
- `request.init(url, { soft?: boolean })` → probe request, optional `soft=true` skips refresh.
- `request.reset(url)` → reset probe state.

---

### 🔹 With `operator()` wrapper

```ts
import { operator, request } from '@mints/request';

const [ok, data, err] = await operator(() =>
  request.auth('/users', { params: { q: 'admin' } }),
);
```

---

### 🔹 Token management helpers

```ts
import { login, logout } from '@mints/request/auth';

await login(() => API.auth.login(form));
await logout(() => API.auth.logout());
```

---

## 🚀 Usage (React Add-on)

### 🔹 `useRequest`

```tsx
import { useRequest } from '@mints/request/react';
import { request } from '@mints/request';

function Example() {
  const { loading, data, error } = useRequest(
    (signal) => request.auth('/users', { signal }),
    [], // deps
    { name: 'fallback' }, // optional initial value
  );

  if (loading) return <span>Loading...</span>;
  if (error) return <span>Failed: {String(error)}</span>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

---

## 🔧 API Reference

### `setupRequest(config: GlobalRequestConfig)`

Set global request behavior.

```ts
type GlobalRequestConfig = {
  baseURL?: string;
  defaultHeaders?: () => Record<string, string>;
  toast?: {
    success?: (msg: string) => void;
    error?: (msg: string) => void;
  };
  onUnauthorized?: () => void;

  // Authentication
  auth?: AuthStrategy;
  retryAfterRefresh?: number; // default 1
  shouldRefreshOnStatus?: (status: number) => boolean; // default: 401, 419, 440
};
```

---

### `request`

```ts
// Callable
const data = await request('/path');

// With modes
await request.public('/path', { credentials: 'never' });
await request.auth('/secure', { noRefresh: true });
```

- `skipAuth`, `skipRefresh`, `skipUnauthorizedHandler` available in `config.meta`.

---

### `operator<T,E>(fn, config)`

```ts
const [ok, data, err] = await operator(() => request.auth('/api'), {
  setOperating: setLoading,
});
```

---

### `AuthStrategy`

Two built-in strategies:

```ts
import { createCookieStrategy, createTokenStrategy } from '@mints/request';

// Cookie-based (refresh via httpOnly cookie)
createCookieStrategy({ ... });

// Token-exchange (refresh via refresh_token in JS, stored in localStorage by default)
createTokenStrategy({ ... });
```

Both accept an optional `storage` parameter (`memoryStorage`, `localStorageStorage`, or custom).

---

### `useRequest`

```ts
function useRequest<T, E>(
  request: (signal: AbortSignal) => Promise<T>,
  deps?: React.DependencyList,
  initialValue?: T,
): {
  loading: boolean;
  data?: T;
  error: E | null;
  run: () => Promise<T>;
  abort: () => void;
};
```

---

## 🛡️ Best Practices

- Use `request.init` for probe token
- Use `request.public` for endpoints that don't require auth.
- Use `request.auth` for APIs with tokens; retries are automatic.
- For cookie-based sessions: set `credentials: 'always'` if your backend requires `withCredentials`.
- Handle `onUnauthorized` globally (redirect, logout).
- Keep refresh handling inside the provided strategies (don't duplicate in your app code).

---

## 📄 License

MIT License © 2025 mints-components
