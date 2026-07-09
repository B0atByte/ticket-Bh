import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  listByCourse: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  reorder: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./course-modules.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './course-modules.controller.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('course-modules.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
  });

  it('listByCourse', async () => {
    svc.listByCourse.mockResolvedValueOnce([]);
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.listByCourse({ params: { courseId: '1' } } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { courseId: '1' }, body: { title: 'M' }, ...reqAuth } as any,
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
      { params: { id: '1' }, body: { title: 'x' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
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

  it('reorder returns 204', async () => {
    svc.reorder.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.reorder(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { courseId: '1' }, body: { orderedIds: [1, 2] }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
