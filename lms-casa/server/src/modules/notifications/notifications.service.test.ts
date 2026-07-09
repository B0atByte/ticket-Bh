import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifFindMany: vi.fn(),
  notifCount: vi.fn(),
  notifCreate: vi.fn(),
  notifFindFirst: vi.fn(),
  notifUpdate: vi.fn(),
  notifUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  prefFindUnique: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    notification: {
      findMany: mocks.notifFindMany,
      count: mocks.notifCount,
      create: mocks.notifCreate,
      findFirst: mocks.notifFindFirst,
      update: mocks.notifUpdate,
      updateMany: mocks.notifUpdateMany,
    },
    user: { findFirst: mocks.userFindFirst },
    notificationPreference: { findUnique: mocks.prefFindUnique },
  },
}));

vi.mock('./notifications.hub.js', () => ({
  publishNotification: mocks.publish,
}));

import {
  listMine,
  create,
  createSelfTest,
  markRead,
  markAllRead,
} from './notifications.service.js';
import { HttpError } from '../../utils/httpError.js';

describe('notifications.service', () => {
  beforeEach(() => {
    for (const m of Object.values(mocks)) m.mockReset();
  });

  it('listMine returns paginated + unreadCount', async () => {
    mocks.notifFindMany.mockResolvedValueOnce([{ id: 1n }]);
    mocks.notifCount.mockResolvedValueOnce(1);
    mocks.notifCount.mockResolvedValueOnce(3); // unread
    const out = await listMine(5n, { page: 1, pageSize: 20 });
    expect(out.items).toHaveLength(1);
    expect(out.unreadCount).toBe(3);
  });

  it('listMine applies unreadOnly + q filters', async () => {
    mocks.notifFindMany.mockResolvedValueOnce([]);
    mocks.notifCount.mockResolvedValueOnce(0);
    mocks.notifCount.mockResolvedValueOnce(0);
    await listMine(5n, { page: 1, pageSize: 20, unreadOnly: true, q: 'hello' });
    const where = mocks.notifFindMany.mock.calls[0][0].where;
    expect(where.readAt).toBeNull();
    expect(where.OR).toBeDefined();
  });

  it('create throws 404 when user missing', async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(
      create({ userId: 5n, type: 'X', title: 't', body: 'b' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create rejects when user has in-app disabled', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.prefFindUnique.mockResolvedValueOnce({ inAppEnabled: false });
    await expect(
      create({ userId: 5n, type: 'X', title: 't', body: 'b' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('create persists + publishes', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.prefFindUnique.mockResolvedValueOnce(null);
    const notif = { id: 99n, userId: 5n };
    mocks.notifCreate.mockResolvedValueOnce(notif);
    const out = await create({ userId: 5n, type: 'X', title: 't', body: 'b' });
    expect(out).toBe(notif);
    expect(mocks.publish).toHaveBeenCalledWith(notif);
  });

  it('createSelfTest hits create() with DEV_TEST type', async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: 5n });
    mocks.prefFindUnique.mockResolvedValueOnce(null);
    mocks.notifCreate.mockResolvedValueOnce({ id: 1n });
    await createSelfTest(5n);
    expect(mocks.notifCreate.mock.calls[0][0].data.type).toBe('DEV_TEST');
  });

  it('markRead throws when not found', async () => {
    mocks.notifFindFirst.mockResolvedValueOnce(null);
    await expect(markRead(5n, 1n)).rejects.toBeInstanceOf(HttpError);
  });

  it('markRead preserves existing readAt if already read', async () => {
    const existing = new Date('2026-01-01');
    mocks.notifFindFirst.mockResolvedValueOnce({ readAt: existing });
    mocks.notifUpdate.mockResolvedValueOnce({});
    await markRead(5n, 1n);
    expect(mocks.notifUpdate.mock.calls[0][0].data.readAt).toBe(existing);
  });

  it('markRead sets readAt now if not yet read', async () => {
    mocks.notifFindFirst.mockResolvedValueOnce({ readAt: null });
    mocks.notifUpdate.mockResolvedValueOnce({});
    await markRead(5n, 1n);
    expect(mocks.notifUpdate.mock.calls[0][0].data.readAt).toBeInstanceOf(Date);
  });

  it('markAllRead returns count', async () => {
    mocks.notifUpdateMany.mockResolvedValueOnce({ count: 7 });
    const n = await markAllRead(5n);
    expect(n).toBe(7);
  });
});
