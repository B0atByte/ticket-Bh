import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: { setting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { getBranding, updateBranding } from './settings.service.js';

describe('settings.service', () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.upsert.mockReset();
  });

  it('getBranding returns defaults when no row', async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    const out = await getBranding();
    expect(out.name).toBe('LMS Casa');
    expect(out.primaryColor).toBe('#2563eb');
    expect(out.logoUrl).toBeNull();
  });

  it('getBranding merges stored value over defaults', async () => {
    mocks.findUnique.mockResolvedValueOnce({
      value: { name: 'Acme', primaryColor: '#ff0000', logoUrl: '/u/logo.png' },
    });
    const out = await getBranding();
    expect(out.name).toBe('Acme');
    expect(out.primaryColor).toBe('#ff0000');
    expect(out.logoUrl).toBe('/u/logo.png');
  });

  it('updateBranding upserts and returns normalized value', async () => {
    mocks.upsert.mockResolvedValueOnce({});
    const out = await updateBranding({
      name: 'New',
      primaryColor: '#000000',
      logoUrl: '/logo.png',
    });
    expect(out).toEqual({ name: 'New', primaryColor: '#000000', logoUrl: '/logo.png' });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0].where.key).toBe('system.branding');
  });

  it('updateBranding null logoUrl', async () => {
    mocks.upsert.mockResolvedValueOnce({});
    const out = await updateBranding({ name: 'X', primaryColor: '#fff', logoUrl: null });
    expect(out.logoUrl).toBeNull();
  });
});
