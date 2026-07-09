import { HttpError } from './httpError.js';

/**
 * Parse a path param into BigInt. Throws 400 if invalid.
 * Accepts decimal string like "1", "42".
 */
export function parseId(raw: string | string[] | undefined, field = 'id'): bigint {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) {
    throw HttpError.badRequest(`Invalid ${field}`);
  }
  try {
    return BigInt(value);
  } catch {
    throw HttpError.badRequest(`Invalid ${field}`);
  }
}
