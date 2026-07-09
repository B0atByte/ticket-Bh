import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  getProgress: vi.fn(),
  upsertProgress: vi.fn(),
}));

vi.mock('./lesson-progress.service.js', () => svc);

import * as ctrl from './lesson-progress.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  return { json };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] } };

describe('lesson-progress.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
  });

  it('get requires auth', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.get({ params: { lessonId: '1' } } as any, mockRes() as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('get returns progress', async () => {
    svc.getProgress.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.get({ params: { lessonId: '1' }, ...reqAuth } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('get returns null when none', async () => {
    svc.getProgress.mockResolvedValueOnce(null);
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.get({ params: { lessonId: '1' }, ...reqAuth } as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ progress: null });
  });

  it('upsert', async () => {
    svc.upsertProgress.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.upsert(
      {
        params: { lessonId: '1' },
        body: { secondsWatched: 10, lastPositionSec: 10 },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });
});
