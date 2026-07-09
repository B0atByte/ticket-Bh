import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('./lesson-notes.service.js', () => svc);

import * as ctrl from './lesson-notes.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] } };

describe('lesson-notes.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
  });

  it('list requires auth', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.list({ params: { lessonId: '1' }, query: {} } as any, mockRes() as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('list', async () => {
    svc.list.mockResolvedValueOnce({ items: [] });
    const res = mockRes();
    await ctrl.list(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { lessonId: '1' }, query: {}, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      {
        params: { lessonId: '1' },
        body: { type: 'NOTE', content: 'c' },
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
      { params: { noteId: '1' }, body: { content: 'x' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('remove returns 204', async () => {
    svc.remove.mockResolvedValueOnce(undefined);
    const res = mockRes();
    await ctrl.remove(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { noteId: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
