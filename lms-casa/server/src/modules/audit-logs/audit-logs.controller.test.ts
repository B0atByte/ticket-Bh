import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  buildWorkbook: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));

vi.mock('./audit-logs.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './audit-logs.controller.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const setHeader = vi.fn();
  return { json, end, setHeader };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('audit-logs.controller', () => {
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

  it('exportXlsx', async () => {
    const xlsxWrite = vi.fn().mockResolvedValue(undefined);
    svc.buildWorkbook.mockResolvedValueOnce({ xlsx: { write: xlsxWrite } });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.exportXlsx({ query: {}, ...reqAuth } as any, res as any);
    expect(res.setHeader).toHaveBeenCalled();
    expect(xlsxWrite).toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });
});
