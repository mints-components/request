# Changelog

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
