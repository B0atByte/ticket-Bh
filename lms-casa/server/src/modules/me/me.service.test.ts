import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  enrollmentFindMany: vi.fn(),
  lpFindMany: vi.fn(),
  noteFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  qFindMany: vi.fn(),
  aFindMany: vi.fn(),
  notifFindMany: vi.fn(),
  fileFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  refreshUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  txn: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    enrollment: { findMany: mocks.enrollmentFindMany },
    lessonProgress: { findMany: mocks.lpFindMany },
    lessonNote: { findMany: mocks.noteFindMany },
    examAttempt: { findMany: mocks.attemptFindMany },
    courseQuestion: { findMany: mocks.qFindMany },
    courseAnswer: { findMany: mocks.aFindMany },
    notification: { findMany: mocks.notifFindMany },
    file: { findMany: mocks.fileFindMany },
    auditLog: { findMany: mocks.auditFindMany },
    refreshToken: { updateMany: mocks.refreshUpdateMany },
    $transaction: mocks.txn,
  },
}));

vi.mock('../auth/tokens.js', () => ({
  hashPassword: mocks.hashPassword,
}));

import { exportMyData, anonymizeMe } from './me.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('me.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
    mocks.hashPassword.mockResolvedValue('hash');
  });

  it('exportMyData throws 404 when user missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(exportMyData(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('exportMyData produces a ZIP buffer with all sections', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 1n, email: 'a@b.com' });
    mocks.enrollmentFindMany.mockResolvedValueOnce([]);
    mocks.lpFindMany.mockResolvedValueOnce([]);
    mocks.noteFindMany.mockResolvedValueOnce([]);
    mocks.attemptFindMany.mockResolvedValueOnce([]);
    mocks.qFindMany.mockResolvedValueOnce([]);
    mocks.aFindMany.mockResolvedValueOnce([]);
    mocks.notifFindMany.mockResolvedValueOnce([]);
    mocks.fileFindMany.mockResolvedValueOnce([]);
    mocks.auditFindMany.mockResolvedValueOnce([]);
    const buf = await exportMyData(1n);
    expect(Buffer.isBuffer(buf)).toBe(true);
    // PK magic bytes for ZIP
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('exportMyData serializes BigInt to strings (no throw)', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 5n, email: 'a@b.com', someBig: 99n });
    mocks.enrollmentFindMany.mockResolvedValueOnce([{ id: 1n }]);
    mocks.lpFindMany.mockResolvedValueOnce([]);
    mocks.noteFindMany.mockResolvedValueOnce([]);
    mocks.attemptFindMany.mockResolvedValueOnce([]);
    mocks.qFindMany.mockResolvedValueOnce([]);
    mocks.aFindMany.mockResolvedValueOnce([]);
    mocks.notifFindMany.mockResolvedValueOnce([]);
    mocks.fileFindMany.mockResolvedValueOnce([]);
    mocks.auditFindMany.mockResolvedValueOnce([]);
    const buf = await exportMyData(5n);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('anonymizeMe throws 404 when user missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(anonymizeMe(1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('anonymizeMe transacts refresh-revoke + user-update', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.refreshUpdateMany.mockReturnValueOnce('p1');
    mocks.userUpdate.mockReturnValueOnce('p2');
    mocks.txn.mockResolvedValueOnce([{}, {}]);
    const out = await anonymizeMe(5n);
    expect(out.id).toBe('5');
    expect(out.deletedAt).toBeInstanceOf(Date);
    expect(mocks.txn).toHaveBeenCalledTimes(1);
    expect(mocks.hashPassword).toHaveBeenCalled();
  });
});
