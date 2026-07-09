import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./questions.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './questions.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('questions.controller', () => {
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
    await expect(
      ctrl.create(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { body: { type: 'SINGLE_CHOICE', text: 'q', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: false }] } } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockRes() as any,
      ),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      {
        body: {
          type: 'SINGLE_CHOICE',
          text: 'q',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: false },
          ],
        },
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
      { params: { id: '1' }, body: { text: 'x' }, ...reqAuth } as any,
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
});
