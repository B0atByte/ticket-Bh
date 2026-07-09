import { describe, it, expect, vi } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from './tokens.js';

// Mock env module — env.ts parses process.env at import time (frozen object),
// so we mock the module directly to control individual values per test.
vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-secret-at-least-32-chars-long!!',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
    BCRYPT_ROUNDS: 10,
  },
}));

describe('signAccessToken / verifyAccessToken', () => {
  it('signs and verifies a valid token', () => {
    const payload = { sub: '42', roles: ['EMPLOYEE'], perms: ['course.read'], sid: '7' };
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT format

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('42');
    expect(decoded.roles).toEqual(['EMPLOYEE']);
    expect(decoded.perms).toEqual(['course.read']);
    expect(decoded.sid).toBe('7');
  });

  it('throws on tampered token', () => {
    const token = signAccessToken({ sub: '1', roles: [], perms: [], sid: '1' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('includes all payload fields', () => {
    const payload = { sub: '99', roles: ['ADMIN', 'EMPLOYEE'], perms: ['user.update', 'audit.read'], sid: '3' };
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded.roles).toEqual(['ADMIN', 'EMPLOYEE']);
    expect(decoded.perms).toContain('audit.read');
  });
});

describe('generateRefreshToken', () => {
  it('returns a token and its hash', () => {
    const { token, hash } = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  it('generates unique tokens each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('hashRefreshToken', () => {
  it('produces consistent hash for same input', () => {
    const h1 = hashRefreshToken('my-token');
    const h2 = hashRefreshToken('my-token');
    expect(h1).toBe(h2);
  });

  it('produces different hash for different input', () => {
    expect(hashRefreshToken('token-a')).not.toBe(hashRefreshToken('token-b'));
  });

  it('hash matches the one from generateRefreshToken', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });
});

// refreshExpiry reads env.JWT_REFRESH_TTL which is mocked as '7d' above.
// We test the parsing logic directly by calling the exported function with
// the mocked env value, and also test edge cases via the internal logic.
describe('refreshExpiry', () => {
  it('returns a future date (7d from mock env)', () => {
    const expiry = refreshExpiry();
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
    // Should be ~7 days ahead
    const diff = expiry.getTime() - Date.now();
    expect(diff).toBeGreaterThan(6 * 86400 * 1000);
    expect(diff).toBeLessThan(8 * 86400 * 1000);
  });

  it('returns a Date instance', () => {
    expect(refreshExpiry()).toBeInstanceOf(Date);
  });
});
