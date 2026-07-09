import { describe, it, expect } from 'vitest';
import { mutationRateLimit } from './rateLimit.js';

describe('mutationRateLimit', () => {
  it('exports an express middleware function', () => {
    expect(typeof mutationRateLimit).toBe('function');
    // express-rate-limit middleware has length 3 (req, res, next)
    expect(mutationRateLimit.length).toBeGreaterThanOrEqual(2);
  });
});
