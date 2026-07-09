import { describe, it, expect } from 'vitest';
import { sanitizeRichHtml } from './sanitizeHtml.js';

describe('sanitizeRichHtml', () => {
  it('returns null for null input', () => {
    expect(sanitizeRichHtml(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(sanitizeRichHtml(undefined)).toBeNull();
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeRichHtml('')).toBe('');
    expect(sanitizeRichHtml('   ')).toBe('');
  });

  it('preserves allowed tags', () => {
    const out = sanitizeRichHtml('<p>Hello <strong>world</strong></p>');
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>world</strong>');
  });

  it('strips <script> tags', () => {
    const out = sanitizeRichHtml('<p>Safe</p><script>alert(1)</script>');
    expect(out).toContain('<p>Safe</p>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips on* event handlers from img', () => {
    const out = sanitizeRichHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('strips javascript: URLs from anchors', () => {
    // eslint-disable-next-line no-script-url
    const out = sanitizeRichHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('allows http/https/mailto links', () => {
    const httpOut = sanitizeRichHtml('<a href="https://example.com">x</a>');
    expect(httpOut).toContain('href="https://example.com"');
    const mailto = sanitizeRichHtml('<a href="mailto:a@b.com">x</a>');
    expect(mailto).toContain('mailto:a@b.com');
  });

  it('preserves list structure', () => {
    const out = sanitizeRichHtml('<ul><li>A</li><li>B</li></ul>');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>A</li>');
  });
});
