import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, setAuthFailureHandler, setRefreshHandler } from './api';

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Unauthorized', '401', config, null, {
    status: 401,
    data: {},
    statusText: 'Unauthorized',
    headers: {},
    config,
  } as AxiosResponse);
}

function ok(config: InternalAxiosRequestConfig): AxiosResponse {
  return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
}

const originalAdapter = api.defaults.adapter;

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  setRefreshHandler(null);
  setAuthFailureHandler(null);
  vi.restoreAllMocks();
});

describe('api refresh-token interceptor', () => {
  it('sends requests with credentials so the session cookies are included', async () => {
    let seen: boolean | undefined;
    api.defaults.adapter = async (config) => {
      seen = config.withCredentials;
      return ok(config);
    };
    await api.get('/courses');
    expect(seen).toBe(true);
  });

  it('refreshes once on 401 then retries the original request', async () => {
    const refresh = vi.fn(async () => {});
    setRefreshHandler(refresh);

    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls += 1;
      if (calls === 1) throw unauthorized(config);
      return ok(config);
    };

    const res = await api.get('/settings/branding');
    expect(res.status).toBe(200);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it('shares a single refresh call across concurrent 401s (single-flight)', async () => {
    const refresh = vi.fn(async () => {});
    setRefreshHandler(refresh);

    api.defaults.adapter = async (config) => {
      const retried = (config as InternalAxiosRequestConfig & { _retry?: boolean })._retry;
      if (!retried) throw unauthorized(config);
      return ok(config);
    };

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not attempt refresh for a 401 from the refresh endpoint itself', async () => {
    const refresh = vi.fn(async () => {});
    setRefreshHandler(refresh);
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.post('/auth/refresh', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('invokes the auth-failure handler and rejects when refresh fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('refresh expired');
    });
    const onFailure = vi.fn();
    setRefreshHandler(refresh);
    setAuthFailureHandler(onFailure);

    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get('/settings/branding')).rejects.toBeInstanceOf(Error);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });
});
