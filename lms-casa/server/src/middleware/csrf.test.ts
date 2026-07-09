import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { CORS_ORIGIN: 'http://localhost:5173,https://lms.example.com' },
}));

import { csrfOriginGuard } from './csrf.js';
import { HttpError } from '../utils/httpError.js';

function req(method: string, headers: Record<string, string> = {}) {
  return {
    method,
    header: (name: string) => headers[name.toLowerCase()],
  };
}

describe('csrfOriginGuard (Issue #8)', () => {
  it('blocks a cross-origin POST from evil.com', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csrfOriginGuard(req('POST', { origin: 'http://evil.com' }) as any, {} as any, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(HttpError);
    expect(next.mock.calls[0][0].status).toBe(403);
  });

  it('allows a POST from an allowed origin', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csrfOriginGuard(req('POST', { origin: 'http://localhost:5173' }) as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows safe methods (GET) regardless of origin', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csrfOriginGuard(req('GET', { origin: 'http://evil.com' }) as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows requests with no Origin/Referer (curl / server-to-server — not a CSRF vector)', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csrfOriginGuard(req('POST') as any, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks a cross-origin Referer when Origin is absent', () => {
    const next = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    csrfOriginGuard(req('DELETE', { referer: 'http://evil.com/x' }) as any, {} as any, next);
    expect(next.mock.calls[0][0].status).toBe(403);
  });
});
