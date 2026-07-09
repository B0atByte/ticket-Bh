import { describe, it, expect } from 'vitest';
import { HttpError } from './httpError.js';

describe('HttpError', () => {
  it('creates instance with correct properties', () => {
    const err = new HttpError(400, 'BAD_REQUEST', 'Bad input', { field: 'email' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Bad input');
    expect(err.details).toEqual({ field: 'email' });
    expect(err.name).toBe('HttpError');
  });

  describe('static factories', () => {
    it('badRequest returns 400', () => {
      const err = HttpError.badRequest('Invalid data');
      expect(err.status).toBe(400);
      expect(err.code).toBe('BAD_REQUEST');
      expect(err.message).toBe('Invalid data');
    });

    it('badRequest uses default message', () => {
      const err = HttpError.badRequest();
      expect(err.message).toBe('Bad request');
    });

    it('unauthorized returns 401', () => {
      const err = HttpError.unauthorized();
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('forbidden returns 403', () => {
      const err = HttpError.forbidden('No access');
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('No access');
    });

    it('notFound returns 404', () => {
      const err = HttpError.notFound('Resource missing');
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('conflict returns 409', () => {
      const err = HttpError.conflict('Duplicate entry');
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('internal returns 500', () => {
      const err = HttpError.internal();
      expect(err.status).toBe(500);
      expect(err.code).toBe('INTERNAL');
    });
  });

  it('is catchable as Error', () => {
    expect(() => {
      throw HttpError.notFound('Not found');
    }).toThrow(Error);
  });

  it('is catchable as HttpError', () => {
    expect(() => {
      throw HttpError.unauthorized();
    }).toThrow(HttpError);
  });
});
