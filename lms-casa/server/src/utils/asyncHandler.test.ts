import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from './asyncHandler.js';

describe('asyncHandler', () => {
  it('passes resolved values through', async () => {
    const next = vi.fn();
    const handler = asyncHandler(async (_req, _res, _next) => {
      return 'done';
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler({} as any, {} as any, next);
    await new Promise((r) => setImmediate(r));
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards thrown errors to next()', async () => {
    const next = vi.fn();
    const err = new Error('boom');
    const handler = asyncHandler(async () => {
      throw err;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler({} as any, {} as any, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(err);
  });

  it('forwards rejected promises to next()', async () => {
    const next = vi.fn();
    const err = new Error('rejected');
    const handler = asyncHandler(() => Promise.reject(err));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler({} as any, {} as any, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(err);
  });
});
