import { api } from '../../lib/api';
import type { Paginated } from '../learning/learning.api';

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: unknown;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPage extends Paginated<NotificationItem> {
  unreadCount: number;
}

export async function listNotifications(): Promise<NotificationPage> {
  const { data } = await api.get<NotificationPage>('/notifications', {
    params: { pageSize: 10 },
  });
  return data;
}

export async function createSelfTestNotification(): Promise<NotificationItem> {
  const { data } = await api.post<{ notification: NotificationItem }>('/notifications/self-test');
  return data.notification;
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { data } = await api.post<{ notification: NotificationItem }>(`/notifications/${id}/read`);
  return data.notification;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await api.post<{ count: number }>('/notifications/read-all');
  return data.count;
}

export interface SessionRevokedPayload {
  reason?: string;
  message?: string;
  at?: string;
}

export function openNotificationStream(
  onNotification: (item: NotificationItem) => void,
  onSessionRevoked?: (payload: SessionRevokedPayload) => void,
): EventSource {
  const base = import.meta.env.VITE_API_URL ?? '';
  const prefix = import.meta.env.VITE_API_PREFIX ?? '/api/v1';
  const source = new EventSource(`${base}${prefix}/notifications/stream`, {
    withCredentials: true,
  });
  source.addEventListener('notification', (event) => {
    onNotification(JSON.parse((event as MessageEvent).data) as NotificationItem);
  });
  if (onSessionRevoked) {
    source.addEventListener('session-revoked', (event) => {
      let payload: SessionRevokedPayload = {};
      try {
        payload = JSON.parse((event as MessageEvent).data) as SessionRevokedPayload;
      } catch {
        /* tolerate malformed payload */
      }
      onSessionRevoked(payload);
    });
  }
  return source;
}
