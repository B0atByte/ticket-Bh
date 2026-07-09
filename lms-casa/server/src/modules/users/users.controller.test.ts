import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  changePassword: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./users.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './users.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('users.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
  });

  it('list', async () => {
    svc.list.mockResolvedValueOnce({ items: [] });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.list({ query: {}, ...reqAuth } as any, res as any);
    expect(svc.list).toHaveBeenCalled();
  });

  it('list requires auth', async () => {
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(ctrl.list({ query: {} } as any, res as any)).rejects.toBeInstanceOf(HttpError);
  });

  it('get', async () => {
    svc.getById.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.get({ params: { id: '1' }, ...reqAuth } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      {
        body: { email: 'a@b.com', password: 'Pass@1234', firstName: 'A', lastName: 'B' },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('update', async () => {
    svc.update.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.update(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, body: { firstName: 'X' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('remove requires auth', async () => {
    const res = mockRes();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.remove({ params: { id: '1' } } as any, res as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('remove returns 204', async () => {
    svc.softDelete.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.remove(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('changePassword returns 204', async () => {
    svc.changePassword.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.changePassword(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, body: { password: 'NewPass@1234' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
