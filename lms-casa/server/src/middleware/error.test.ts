import { describe, it, expect, vi } from 'vitest';
import { ZodError, z } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler } from './error.js';
import { HttpError } from '../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json };
}

describe('errorHandler', () => {
  it('returns 400 VALIDATION_ERROR for ZodError', () => {
    const res = mockRes();
    let zerr: ZodError | undefined;
    try {
      z.object({ x: z.string() }).parse({});
    } catch (e) {
      zerr = e as ZodError;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(zerr, {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toBeDefined();
  });

  it('returns 409 for Prisma P2002 unique violation', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'x',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(err, {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error.code).toBe('UNIQUE_VIOLATION');
  });

  it('returns 404 for Prisma P2025 record-not-found', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'x',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(err, {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe('NOT_FOUND');
  });

  it('returns 500 INTERNAL for other Prisma error codes', () => {
    const res = mockRes();
    const err = new Prisma.PrismaClientKnownRequestError('other', {
      code: 'P9999',
      clientVersion: 'x',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(err, {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns HttpError status + body', () => {
    const res = mockRes();
    const err = HttpError.forbidden('nope');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(err, {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('nope');
  });

  it('falls back to 500 INTERNAL for unknown error', () => {
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    errorHandler(new Error('boom'), {} as any, res as any, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL');
  });
});
