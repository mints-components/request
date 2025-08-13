# @mints/request

A lightweight HTTP and operation wrapper built on Axios for React/Vite projects.  
Supports global config, toast integration, request context, and clean async operation management.

## ✨ Features

- ✅ Simple Axios wrapper with unified config
- ✅ Global `toast` integration (decoupled from UI)
- ✅ `operator()` helper for async request + loading + error feedback
- ✅ Supports dynamic headers (e.g. token injection)
- ✅ Optional `onUnauthorized()` global handler for 401
- ✅ Minimal dependencies, framework agnostic

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
import { setupRequest } from '@mints/request';
import { toast } from '@mints/ui'; // your own toast system

setupRequest({
  baseURL: '/api',
  defaultHeaders: () => ({
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  }),
  toast: {
    success: toast.success,
    error: toast.error,
  },
  onUnauthorized: () => {
    window.location.href = '/login';
  },
});
```

---

## 🚀 Usage

### 🔹 Basic `request`

```ts
import { request } from '@mints/request';

const data = await request('/users');
const user = await request('/users/1', {
  method: 'put',
  data: { name: 'Tom' },
});
```

---

### 🔹 With `operator()` wrapper

```ts
import { operator, request } from '@mints/request';

const [ok, data] = await operator(() =>
  request('/users', { params: { q: 'admin' } }),
);
```

`operator()` automatically supports:

- Loading state management (via optional `setOperating`)
- Success/failure toast
- Error catching and formatting

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
};
```

---

### `request(path: string, config?: AxiosRequestConfig): Promise<any>`

An enhanced version of Axios request that auto-injects baseURL and headers.

```ts
type RequestConfig = AxiosRequestConfig & {
  /**
   * Skip triggering the global onUnauthorized handler for this request.
   */
  skipUnauthorizedHandler?: boolean;
};
```

---

### `operator(fn: () => Promise<T>, config?: OperateConfig): Promise<[boolean, T?, unknown?]>`

The best practice wrapper for async requests.

```ts
type OperateConfig = {
  setOperating?: (running: boolean) => void;
  formatMessage?: () => string;
  formatReason?: (err: unknown) => string;
  hideToast?: boolean;
  toast?: {
    success?: (msg: string) => void;
    error?: (msg: string) => void;
  };
};
```

---

## 🧩 Advanced

### 🔁 Dynamically update config

```ts
import { updateRequestConfig } from '@mints/request';

updateRequestConfig({
  defaultHeaders: () => ({
    Authorization: `Bearer ${newToken}`,
  }),
});
```

---

## 🛡️ Best Practices

- Call `setupRequest` once in your app entry (e.g. `main.tsx`, `setup.ts`).
- Integrate with your UI toast system globally (e.g. from @mints/ui).
- Wrap frequent API calls like this:

```ts
export const getUser = () => request('/user');
export const createUser = (data: any) =>
  operator(() => request('/user', { method: 'post', data }));
```

---

## 📄 License

MIT License © 2025 mints-components
