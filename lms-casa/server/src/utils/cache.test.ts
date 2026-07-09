import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock('../config/redis.js', () => ({ redis: m }));
vi.mock('./logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { cacheJson } from './cache.js';

describe('cacheJson (Issue #12)', () => {
  beforeEach(() => {
    m.get.mockReset();
    m.set.mockReset();
  });

  it('returns cached value on hit without calling the producer', async () => {
    m.get.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
    const producer = vi.fn();
    const out = await cacheJson('k', 30, producer);
    expect(out).toEqual({ a: 1 });
    expect(producer).not.toHaveBeenCalled();
  });

  it('runs producer and writes with TTL on miss', async () => {
    m.get.mockResolvedValueOnce(null);
    m.set.mockResolvedValueOnce('OK');
    const out = await cacheJson('k', 30, async () => ({ b: 2 }));
    expect(out).toEqual({ b: 2 });
    expect(m.set).toHaveBeenCalledWith('k', JSON.stringify({ b: 2 }), 'EX', 30);
  });

  it('fails open when Redis read throws (still returns producer result)', async () => {
    m.get.mockRejectedValueOnce(new Error('redis down'));
    m.set.mockResolvedValue('OK');
    const out = await cacheJson('k', 30, async () => ({ c: 3 }));
    expect(out).toEqual({ c: 3 });
  });
});
