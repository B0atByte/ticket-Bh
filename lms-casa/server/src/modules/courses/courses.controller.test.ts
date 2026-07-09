import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  archive: vi.fn(),
  softDelete: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./courses.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './courses.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqBase = {
  auth: { userId: '5', roles: [], perms: [] },
  ip: '127.0.0.1',
  get: () => undefined,
};

describe('courses.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
  });

  it('list', async () => {
    svc.list.mockResolvedValueOnce({ items: [] });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.list({ query: {} } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('get', async () => {
    svc.getById.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.get({ params: { id: '1' } } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('create requires auth', async () => {
    const res = mockRes();
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.create({ body: { title: 't', slug: 's' } } as any, res as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { body: { title: 't', slug: 's' }, ...reqBase } as any,
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
      { params: { id: '1' }, body: { title: 'x' }, ...reqBase } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('publish', async () => {
    svc.publish.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.publish(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, ...reqBase } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('archive', async () => {
    svc.archive.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.archive(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, ...reqBase } as any,
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
      { params: { id: '1' }, ...reqBase } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
