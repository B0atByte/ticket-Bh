import { createMiddleware } from "hono/factory";
import { fail } from "../lib/http.js";

// Simple in-memory fixed-window limiter. Sufficient for a single API instance;
// swap for Redis if the API is ever horizontally scaled.
type Hit = { count: number; resetAt: number };
const store = new Map<string, Hit>();

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  // Prefer X-Real-IP — our nginx sets it to the true socket peer and overwrites
  // any client-supplied value, so it can't be spoofed. Never trust the FIRST
  // X-Forwarded-For entry (attacker-controlled); only the LAST hop is appended
  // by our trusted proxy.
  const real = c.req.header("x-real-ip");
  if (real?.trim()) return real.trim();
  const fwd = c.req.header("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return "local";
}

export function rateLimit(opts: { max: number; windowMs: number; keyPrefix?: string }) {
  return createMiddleware(async (c, next) => {
    const key = `${opts.keyPrefix ?? "rl"}:${clientIp(c)}`;
    const now = Date.now();
    const hit = store.get(key);

    if (!hit || hit.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else {
      hit.count += 1;
      if (hit.count > opts.max) {
        const secs = Math.ceil((hit.resetAt - now) / 1000);
        c.header("Retry-After", String(secs));
        fail(429, `พยายามมากเกินไป ลองใหม่ใน ${secs} วินาที / Too many attempts, retry in ${secs}s`);
      }
    }

    // Opportunistic cleanup so the map can't grow unbounded.
    if (store.size > 5000) {
      for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
    }
    await next();
  });
}

// ── Failure lockout (for secret-guessing: PIN re-auth, last-4-phone verify) ──
// Keyed on a stable identity (serial / username), NOT the request IP — so it
// can't be sidestepped by rotating source IPs/headers.
type Lock = { fails: number; until: number };
const locks = new Map<string, Lock>();

/** Seconds remaining on an active lock for `key`, or 0 if not locked. */
export function lockRemaining(key: string): number {
  const l = locks.get(key);
  const now = Date.now();
  return l && l.until > now ? Math.ceil((l.until - now) / 1000) : 0;
}

/** Record a failed attempt; after `max` fails the key locks for `windowMs`. */
export function recordFailure(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  let l = locks.get(key) ?? { fails: 0, until: 0 };
  // Only reset the counter when a PREVIOUS lock has fully expired (until>0 and
  // past). until===0 means "no lock yet, still counting" — don't wipe it.
  if (l.until > 0 && l.until <= now) l = { fails: 0, until: 0 };
  l.fails += 1;
  if (l.fails >= max) l.until = now + windowMs;
  locks.set(key, l);
  if (locks.size > 5000) for (const [k, v] of locks) if (v.until > 0 && v.until <= now) locks.delete(k);
}

/** Clear the failure counter on a successful attempt. */
export function clearFailures(key: string): void {
  locks.delete(key);
}
