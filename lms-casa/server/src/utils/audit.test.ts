import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('../config/db.js', () => ({
  prisma: { auditLog: { create: mocks.createMock } },
}));
vi.mock('./logger.js', () => ({
  logger: { error: mocks.errorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { audit } from './audit.js';

describe('audit()', () => {
  beforeEach(() => {
    mocks.createMock.mockReset();
    mocks.errorMock.mockReset();
  });

  it('writes a row with action + actorId', async () => {
    mocks.createMock.mockResolvedValueOnce({});
    await audit({ actorId: 5n, action: 'user.create' });
    expect(mocks.createMock).toHaveBeenCalledTimes(1);
    expect(mocks.createMock.mock.calls[0][0].data.actorId).toBe(5n);
    expect(mocks.createMock.mock.calls[0][0].data.action).toBe('user.create');
  });

  it('coerces entityId to string', async () => {
    mocks.createMock.mockResolvedValueOnce({});
    await audit({ action: 'x', entityId: 99n });
    expect(mocks.createMock.mock.calls[0][0].data.entityId).toBe('99');
    await audit({ action: 'x', entityId: 7 });
    expect(mocks.createMock.mock.calls[1][0].data.entityId).toBe('7');
  });

  it('extracts ip and user-agent from req', async () => {
    mocks.createMock.mockResolvedValueOnce({});
    const req = {
      ip: '10.0.0.1',
      get: (h: string) => (h.toLowerCase() === 'user-agent' ? 'jest-agent' : undefined),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await audit({ action: 'login', req: req as any });
    expect(mocks.createMock.mock.calls[0][0].data.ipAddress).toBe('10.0.0.1');
    expect(mocks.createMock.mock.calls[0][0].data.userAgent).toBe('jest-agent');
  });

  it('null entityId becomes null', async () => {
    mocks.createMock.mockResolvedValueOnce({});
    await audit({ action: 'x' });
    expect(mocks.createMock.mock.calls[0][0].data.entityId).toBeNull();
  });

  it('swallows prisma errors and logs them', async () => {
    mocks.createMock.mockRejectedValueOnce(new Error('db down'));
    await expect(audit({ action: 'safe' })).resolves.toBeUndefined();
    expect(mocks.errorMock).toHaveBeenCalled();
  });
});
