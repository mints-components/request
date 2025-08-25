export { request } from './request';
export {
  setupRequest,
  updateRequestConfig,
  getGlobalRequestConfig,
  type AuthStrategy,
  type GlobalRequestConfig,
} from './config';
export { operator, type OperateConfig } from './operator';
export { createCookieStrategy, createTokenStrategy } from './auth';
export { memoryStorage, localStorageStorage } from './storage';
