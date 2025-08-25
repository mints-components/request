# Changelog

## [2.1.0] - 2025-08-25

⚠️ **Note:** version `2.0.0` was essentially broken due to severe bugs.  
Upgrade to `2.1.0` immediately.

### ✨ Features

- Added `login()` and `logout()` helpers to manage tokens automatically.
- Added `init()` and `reset()` methods to `request` for probe/reset flows.
- Added `tokenField` option in `createCookieStrategy` and `createTokenStrategy`.
- Added default handling for HTTP `419` / `440`.

### 🐛 Fixes

- Fixed missing `storage` export.
- Fixed infinite loop in `ensureRefreshed` (refresh never exited).
- Fixed `mountedRef.current` not reset (broke `useRequest` under React Strict Mode).

### 🛠 Refactors

- Removed `isAccessTokenValid` param from `AuthStrategy` (backend decides validity).
- Removed `useRequest` throwing on cancellation errors (`AbortError`, `ERR_CANCELED`, `CanceledError`).
- Internally refactored `useRequest` to rely on `status` instead of `loading`.

## [2.0.0] - 2025-08-22

### ✨ Features

- Added **pluggable `AuthStrategy`** with cookie-based and token-based strategies
- Added **default token storage** (`memoryStorage`, `localStorageStorage`)
- Added **default token validation function**
- Added `lazy` option for `useRequest` hook
- Added `initialValue` for `useRequest`
- Added default error type handling in `useRequest`
- Added error type definition support in `operator`

### 🛠 Refactors

- Improved error filtering and mounted state tracking in `useRequest`
- Remove `undefined` from `operator` return

## [1.2.0] - 2025-08-18

### ✨ New

- Added React Hook: `useRequest` (import from `@mints/request/react`)
  - Accepts a function `(signal: AbortSignal) => Promise<T>`
  - Automatically runs on mount and whenever dependencies change
  - Built-in `AbortController` cancels the previous request when a new one starts
  - Returns a simple state object: `{ loading, data?, error? }`

### 🛠 Build

- Exposed `./react` subpath in `package.json#exports` with proper ESM/CJS and type declarations to fix “Missing './react' specifier” issues.

## [1.1.0] - 2025-08-13

### ✨ Enhancements

- Added `skipUnauthorizedHandler` request config option to bypass the global `onUnauthorized` handler for specific requests.
- Batched `onUnauthorized` calls — multiple `401` responses within 1 second now trigger the handler only once.

### 🐛 Fixes

- Fixed an issue where `onUnauthorized` was not called in `401` response cases.

## [1.0.0] - 2025-07-28

### 🎉 Initial Release

- `request(path, config)` — enhanced Axios wrapper with global `baseURL` and `headers` support.
- `operator()` — handles:
  - loading state (setOperating)
  - success and error toast (UI-agnostic)
  - error formatting (Axios / unknown / Error instance)
- Global `setupRequest()`:
  - define default `toast`, `baseURL`, `headers`, and `onUnauthorized()` handler
- Tree-shakable ESM/CJS build via `tsup`
- Type-safe, no `any` by default
