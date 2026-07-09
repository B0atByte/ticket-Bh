import { describe, it, expect } from 'vitest';
import { parseId } from './id.js';
import { HttpError } from './httpError.js';

describe('parseId', () => {
  it('parses a valid decimal string', () => {
    expect(parseId('42')).toBe(42n);
  });

  it('handles large BigInt values', () => {
    expect(parseId('9007199254740993')).toBe(9007199254740993n);
  });

  it('picks first element of array param', () => {
    expect(parseId(['7', '8'])).toBe(7n);
  });

  it('throws 400 on undefined', () => {
    expect(() => parseId(undefined)).toThrow(HttpError);
    try {
      parseId(undefined);
    } catch (e) {
      expect((e as HttpError).status).toBe(400);
    }
  });

  it('throws 400 on empty string', () => {
    expect(() => parseId('')).toThrow(HttpError);
  });

  it('throws 400 on non-numeric input', () => {
    expect(() => parseId('abc')).toThrow(HttpError);
    expect(() => parseId('1.5')).toThrow(HttpError);
    expect(() => parseId('-1')).toThrow(HttpError);
  });

  it('uses custom field name in error message', () => {
    try {
      parseId('xx', 'courseId');
    } catch (e) {
      expect((e as HttpError).message).toContain('courseId');
    }
  });
});
