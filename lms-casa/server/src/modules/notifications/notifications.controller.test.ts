import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  listMine: vi.fn(),
  create: vi.fn(),
  createSelfTest: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));
const hub = vi.hoisted(() => ({ addClient: vi.fn() }));

vi.mock('./notifications.service.js', () => svc);
vi.mock('./notifications.hub.js', () => hub);
vi.mock('../../utils/audit.js', () => audit);

import * as ctrl from './notifications.controller.js';
import { HttpError } from '../../utils/httpError.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  const writeHead = vi.fn();
  const write = vi.fn();
  return { json, end, status, writeHead, write };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('notifications.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
    hub.addClient.mockReset().mockReturnValue(() => undefined);
  });

  it('listMine requires auth', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.listMine({ query: {} } as any, mockRes() as any),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('listMine', async () => {
    svc.listMine.mockResolvedValueOnce({ items: [], unreadCount: 0 });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.listMine({ query: {}, ...reqAuth } as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('create returns 201', async () => {
    svc.create.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    await ctrl.create(
      {
        body: { userId: 5, type: 'X', title: 't', body: 'b' },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('createSelfTest returns 201', async () => {
    svc.createSelfTest.mockResolvedValueOnce({ id: 99n });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.createSelfTest({ ...reqAuth } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('markRead', async () => {
    svc.markRead.mockResolvedValueOnce({ id: 1n });
    const res = mockRes();
    await ctrl.markRead(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { params: { id: '1' }, ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('markAllRead', async () => {
    svc.markAllRead.mockResolvedValueOnce(3);
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.markAllRead({ ...reqAuth } as any, res as any);
    expect(res.json).toHaveBeenCalledWith({ count: 3 });
  });

  it('stream requires auth', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ctrl.stream({} as any, mockRes() as any),
    ).toThrow(HttpError);
  });

  it('stream sets SSE headers + writes ready event', () => {
    const res = mockRes();
    let closeHandler: (() => void) | undefined;
    const req = {
      ...reqAuth,
      on: (event: string, fn: () => void) => {
        if (event === 'close') closeHandler = fn;
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctrl.stream(req as any, res as any);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.write).toHaveBeenCalled();
    expect(hub.addClient).toHaveBeenCalled();
    closeHandler?.();
    expect(res.end).toHaveBeenCalled();
  });
});
