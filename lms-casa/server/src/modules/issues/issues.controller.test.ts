import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('./issues.service.js', () => svc);

import * as ctrl from './issues.controller.js';

function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { status, json };
}

describe('issues.controller', () => {
  beforeEach(() => {
    svc.create.mockReset();
  });

  it('creates an issue for the authenticated user', async () => {
    svc.create.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    const req = { auth: { userId: '5', roles: [], perms: [] }, body: { description: 'ปุ่มบันทึกกดไม่ได้' } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.create(req as any, res as any);

    expect(svc.create).toHaveBeenCalledWith(5n, { description: 'ปุ่มบันทึกกดไม่ได้' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 1n });
  });

  it('rejects a description shorter than 5 characters', async () => {
    const res = mockRes();
    const req = { auth: { userId: '5', roles: [], perms: [] }, body: { description: 'สั้น' } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.create(req as any, res as any)).rejects.toThrow();
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('throws unauthorized when req.auth is missing', async () => {
    const res = mockRes();
    const req = { body: { description: 'ปุ่มบันทึกกดไม่ได้' } };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.create(req as any, res as any)).rejects.toThrow();
    expect(svc.create).not.toHaveBeenCalled();
  });
});
