import { redis } from '../config/redis.js';
import { logger } from './logger.js';

/**
 * Cache the JSON result of `producer` in Redis for `ttlSec` seconds.
 *
 * Fails OPEN: any Redis error (miss read or write) falls back to running the
 * producer directly, so a Redis hiccup degrades performance but never breaks
 * the request. Intended for hot, expensive read paths (admin dashboard stats).
 *
 * NOTE: values are JSON-serialized; BigInt is stringified (global toJSON patch),
 * which matches how the API serializes ids anyway — safe for read-only stats.
 */
export async function cacheJson<T>(
  key: string,
  ttlSec: number,
  producer: () => Promise<T>,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn(`cache read failed (${key}): ${(err as Error).message}`);
  }

  const value = await producer();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    logger.warn(`cache write failed (${key}): ${(err as Error).message}`);
  }
  return value;
}

/** Best-effort cache invalidation (fails open). */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn(`cache del failed: ${(err as Error).message}`);
  }
}
