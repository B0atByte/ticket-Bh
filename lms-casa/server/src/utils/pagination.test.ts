import { describe, it, expect } from 'vitest';
import { PaginationQuerySchema, paginated, skipTake } from './pagination.js';

describe('PaginationQuerySchema', () => {
  it('uses defaults when empty', () => {
    const parsed = PaginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.q).toBeUndefined();
  });

  it('coerces string numbers', () => {
    const parsed = PaginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
  });

  it('trims whitespace in q', () => {
    expect(PaginationQuerySchema.parse({ q: '  hello  ' }).q).toBe('hello');
  });

  it('rejects pageSize > 100', () => {
    expect(() => PaginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('rejects page < 1', () => {
    expect(() => PaginationQuerySchema.parse({ page: 0 })).toThrow();
  });
});

describe('paginated()', () => {
  it('wraps items with correct meta', () => {
    const out = paginated([1, 2, 3], 23, 2, 10);
    expect(out.items).toEqual([1, 2, 3]);
    expect(out.meta).toEqual({ page: 2, pageSize: 10, total: 23, totalPages: 3 });
  });

  it('returns totalPages >= 1 even when total is 0', () => {
    const out = paginated([], 0, 1, 20);
    expect(out.meta.totalPages).toBe(1);
  });

  it('rounds totalPages up', () => {
    expect(paginated([], 21, 1, 20).meta.totalPages).toBe(2);
    expect(paginated([], 40, 1, 20).meta.totalPages).toBe(2);
    expect(paginated([], 41, 1, 20).meta.totalPages).toBe(3);
  });
});

describe('skipTake()', () => {
  it('returns 0 skip for page 1', () => {
    expect(skipTake(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it('multiplies (page-1) * pageSize', () => {
    expect(skipTake(3, 25)).toEqual({ skip: 50, take: 25 });
  });
});
