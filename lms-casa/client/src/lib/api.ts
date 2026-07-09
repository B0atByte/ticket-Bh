import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

// Default baseURL = '/api/v1' (same-origin via Vite proxy in dev / nginx in prod).
// Override with VITE_API_URL only when explicitly hitting a different host.
const apiHost = import.meta.env.VITE_API_URL ?? '';
const apiPrefix = import.meta.env.VITE_API_PREFIX ?? '/api/v1';
const baseURL = `${apiHost}${apiPrefix}`;

// Auth is handled entirely via httpOnly cookies (set by the server on
// login/refresh/oidc-exchange) — withCredentials makes the browser send and
// store them automatically, so no token ever touches JS-accessible storage.
export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 90_000,
});

// The refresh-token flow is wired from the auth module (see main.tsx) via these
// setters to avoid a circular import between this file and features/auth/auth.api.
type RefreshHandler = () => Promise<void>;
let refreshHandler: RefreshHandler | null = null;
let onAuthFailure: (() => void) | null = null;

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

function shouldSkipRefresh(config: RetriableConfig): boolean {
  if (config._retry || !refreshHandler) return true;
  const url = config.url ?? '';
  // Never try to refresh the auth endpoints themselves (prevents loops).
  return url.includes('/auth/refresh') || url.includes('/auth/login');
}

// Single-flight: concurrent 401s share one /auth/refresh call instead of
// stampeding the endpoint and rotating the refresh token multiple times.
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err?.config as RetriableConfig | undefined;
    if (err?.response?.status !== 401 || !config || shouldSkipRefresh(config)) {
      return Promise.reject(err);
    }
    config._retry = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshHandler!().finally(() => {
          refreshPromise = null;
        });
      }
      await refreshPromise;
      // The server rotated the auth cookies via Set-Cookie — just retry.
      return api(config);
    } catch (refreshErr) {
      onAuthFailure?.();
      return Promise.reject(refreshErr);
    }
  },
);
