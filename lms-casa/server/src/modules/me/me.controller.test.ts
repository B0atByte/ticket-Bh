import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  exportMyData: vi.fn(),
  anonymizeMe: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./me.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './me.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const send = vi.fn();
  const end = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn(() => ({ end }));
  return { send, end, setHeader, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('me.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
  });

  it('exportData requires auth', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.exportData({} as any, mockRes() as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('exportData sends ZIP', async () => {
    svc.exportMyData.mockResolvedValueOnce(Buffer.from('ZIP'));
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.exportData(reqAuth as any, res as any);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(res.send).toHaveBeenCalled();
  });

  it('anonymize returns 204', async () => {
    svc.anonymizeMe.mockResolvedValueOnce({ id: '5', deletedAt: new Date() });
    const res = mockRes();
    await ctrl.anonymize(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { body: {}, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
