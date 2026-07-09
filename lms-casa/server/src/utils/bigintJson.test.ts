import { describe, it, expect } from 'vitest';
import './bigintJson.js';

describe('bigintJson patch', () => {
  it('makes BigInt serializable via JSON.stringify', () => {
    const out = JSON.stringify({ id: 42n });
    expect(out).toBe('{"id":"42"}');
  });

  it('serializes BigInt in arrays', () => {
    expect(JSON.stringify([1n, 2n])).toBe('["1","2"]');
  });

  it('handles large BigInt safely', () => {
    const big = 9007199254740993n; // > Number.MAX_SAFE_INTEGER
    expect(JSON.stringify({ x: big })).toBe('{"x":"9007199254740993"}');
  });
});
