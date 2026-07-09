import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  getBranding: vi.fn(),
  updateBranding: vi.fn(),
}));
const audit = vi.hoisted(() => ({ audit: vi.fn() }));
const fileSignature = vi.hoisted(() => ({
  readHeader: vi.fn(() => Buffer.alloc(0)),
  matchesSignature: vi.fn(() => true),
}));
const fsMock = vi.hoisted(() => ({ unlinkSync: vi.fn() }));

vi.mock('./settings.service.js', () => svc);
vi.mock('../../utils/audit.js', () => audit);
vi.mock('../../utils/fileSignature.js', () => fileSignature);
vi.mock('node:fs', () => ({ default: fsMock, ...fsMock }));

import * as ctrl from './settings.controller.js';

function mockRes() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  return { json, end, status };
}

const reqAuth = { auth: { userId: '5', roles: [], perms: [] }, ip: '127.0.0.1', get: () => undefined };

describe('settings.controller', () => {
  beforeEach(() => {
    for (const m of Object.values(svc)) m.mockReset();
    audit.audit.mockReset().mockResolvedValue(undefined);
    fileSignature.readHeader.mockReset().mockReturnValue(Buffer.alloc(0));
    fileSignature.matchesSignature.mockReset().mockReturnValue(true);
    fsMock.unlinkSync.mockReset();
  });

  it('getBranding', async () => {
    svc.getBranding.mockResolvedValueOnce({ name: 'X' });
    const res = mockRes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctrl.getBranding({} as any, res as any);
    expect(res.json).toHaveBeenCalled();
  });

  it('updateBranding', async () => {
    svc.updateBranding.mockResolvedValueOnce({ name: 'X', primaryColor: '#000000', logoUrl: null });
    const res = mockRes();
    await ctrl.updateBranding(
      {
        body: { name: 'X', primaryColor: '#000000', logoUrl: null },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.json).toHaveBeenCalled();
    expect(audit.audit).toHaveBeenCalled();
  });

  it('uploadLogo returns 400 when no file', async () => {
    const res = mockRes();
    await ctrl.uploadLogo(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...reqAuth } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uploadLogo returns 201 with file', async () => {
    svc.getBranding.mockResolvedValueOnce({ name: 'X', primaryColor: '#000000', logoUrl: null });
    svc.updateBranding.mockResolvedValueOnce({
      name: 'X',
      primaryColor: '#000000',
      logoUrl: '/uploads/branding/x.png',
    });
    const res = mockRes();
    await ctrl.uploadLogo(
      {
        file: { filename: 'x.png', path: '/tmp/x.png', mimetype: 'image/png', size: 1024 },
        ...reqAuth,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res as any,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('uploadLogo rejects file whose magic bytes do not match an allowed image type', async () => {
    fileSignature.matchesSignature.mockReturnValueOnce(false);
    const res = mockRes();
    await expect(
      ctrl.uploadLogo(
        {
          file: { filename: 'x.png', path: '/tmp/x.png', mimetype: 'image/png', size: 1024 },
          ...reqAuth,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res as any,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(fsMock.unlinkSync).toHaveBeenCalledWith('/tmp/x.png');
  });
});
