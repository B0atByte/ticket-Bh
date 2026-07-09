import { describe, it, expect, vi } from 'vitest';
import { notFoundHandler } from './notFound.js';
import { HttpError } from '../utils/httpError.js';

describe('notFoundHandler', () => {
  it('calls next with HttpError 404 carrying method + url', () => {
    const next = vi.fn();
    const req = { method: 'GET', originalUrl: '/missing' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notFoundHandler(req as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(404);
    expect(err.message).toContain('GET');
    expect(err.message).toContain('/missing');
  });
});
