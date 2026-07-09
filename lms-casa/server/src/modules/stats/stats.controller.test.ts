import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  personalStats: vi.fn(),
  managerStats: vi.fn(),
  adminStats: vi.fn(),
}));

vi.mock('./stats.service.js', () => svc);

import * as ctrl from './stats.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  return { json };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] } };

describe('stats.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
  });

  it('me requires auth', async () => {
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.me({} as any, res as any)).rejects.toBeInstanceOf(HttpError);
  });

  it('me returns stats', async () => {
    svc.personalStats.mockResolvedValueOnce({ x: 1 });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.me(reqAuth as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('manager requires auth', async () => {
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.manager({} as any, res as any)).rejects.toBeInstanceOf(HttpError);
  });

  it('manager returns reports', async () => {
    svc.managerStats.mockResolvedValueOnce([]);
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.manager(reqAuth as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ reports: [] });
  });

  it('admin returns stats', async () => {
    svc.adminStats.mockResolvedValueOnce({ totals: {} });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.admin({} as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });
});
