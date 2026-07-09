import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  listByModule: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  reorder: vi.fn(),
  addContent: vi.fn(),
  removeContent: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./lessons.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './lessons.controller.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('lessons.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
  });

  it('listByModule', async () => {
    svc.listByModule.mockResolvedValueOnce([]);
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.listByModule({ params: { moduleId: '1' } } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('get', async () => {
    svc.getById.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.get({ params: { id: '1' } } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { moduleId: '1' }, body: { title: 'L' }, ...reqAuth } as any,
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
      { params: { moduleId: '1' }, body: { orderedIds: [1, 2] }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('addContent returns 201', async () => {
    svc.addContent.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.addContent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, body: { type: 'TEXT' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('removeContent returns 204', async () => {
    svc.removeContent.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.removeContent(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { contentId: '1' } } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
