import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import { publishNotification } from './notifications.hub.js';
import type { CreateNotificationInput, NotificationQuery } from './notifications.schema.js';

export async function listMine(userId: bigint, query: NotificationQuery) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unreadOnly ? { readAt: null } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q } },
            { body: { contains: query.q } },
            { type: { contains: query.q } },
          ],
        }
      : {}),
  };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { ...paginated(items, total, query.page, query.pageSize), unreadCount };
}

export async function create(input: CreateNotificationInput) {
  const user = await prisma.user.findFirst({ where: { id: input.userId, deletedAt: null } });
  if (!user) throw HttpError.notFound('User not found');
  const pref = await prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
  if (pref?.inAppEnabled === false) throw HttpError.badRequest('In-app notifications are disabled');
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data as Prisma.InputJsonValue | undefined,
    },
  });
  publishNotification(notification);
  return notification;
}

export async function createSelfTest(userId: bigint) {
  return create({
    userId,
    type: 'DEV_TEST',
    title: 'Test notification',
    body: 'This notification was sent from the current session.',
    data: { source: 'self-test' },
  });
}

export async function markRead(userId: bigint, id: bigint) {
  const target = await prisma.notification.findFirst({ where: { id, userId } });
  if (!target) throw HttpError.notFound('Notification not found');
  return prisma.notification.update({
    where: { id },
    data: { readAt: target.readAt ?? new Date() },
  });
}

export async function markAllRead(userId: bigint): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
