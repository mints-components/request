# Changelog

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
