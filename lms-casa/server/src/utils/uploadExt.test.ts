import { describe, it, expect } from 'vitest';
import { extForMime } from './uploadExt.js';

describe('extForMime (Issue #6 — safe upload extension)', () => {
  it('maps validated image/pdf mimes to a fixed safe extension', () => {
    expect(extForMime('image/png')).toBe('.png');
    expect(extForMime('image/jpeg')).toBe('.jpg');
    expect(extForMime('image/webp')).toBe('.webp');
    expect(extForMime('application/pdf')).toBe('.pdf');
  });

  it('never returns an executable extension for HTML/script mimes', () => {
    expect(extForMime('text/html')).toBe('');
    expect(extForMime('application/javascript')).toBe('');
    expect(extForMime('image/svg+xml')).toBe('');
    expect(extForMime('')).toBe('');
  });
});
