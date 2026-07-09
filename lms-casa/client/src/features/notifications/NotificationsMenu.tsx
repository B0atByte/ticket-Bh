import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing, CheckCheck, Loader2, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { alertWarning } from '../../lib/confirm';
import { logout } from '../auth/auth.api';
import { useAuthStore } from '../auth/auth.store';
import {
  createSelfTestNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  openNotificationStream,
  type NotificationItem,
  type NotificationPage,
} from './notifications.api';

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);
  const query = useQuery({ queryKey: ['notifications'], queryFn: listNotifications });
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const selfTestMutation = useMutation({
    mutationFn: createSelfTestNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    let kicked = false;
    const source = openNotificationStream(
      (item) => {
        queryClient.setQueryData<NotificationPage>(['notifications'], (current) => {
          if (!current) {
            return {
              items: [item],
              unreadCount: 1,
              meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
            };
          }
          return {
            ...current,
            items: [item, ...current.items.filter((existing) => existing.id !== item.id)].slice(0, 10),
            unreadCount: current.unreadCount + (item.readAt ? 0 : 1),
            meta: { ...current.meta, total: current.meta.total + 1 },
          };
        });
      },
      (payload) => {
        // Account signed in from another device -> end this session right now.
        if (kicked) return;
        kicked = true;
        source.close();
        void logout();
        setUser(null);
        queryClient.clear();
        void alertWarning(
          'ถูกออกจากระบบ',
          payload.message ?? 'บัญชีนี้ถูกเข้าสู่ระบบจากอุปกรณ์อื่น คุณจึงถูกออกจากระบบ',
        ).finally(() => navigate('/login', { replace: true }));
      },
    );
    return () => source.close();
  }, [queryClient, navigate, setUser]);

  const items = query.data?.items ?? [];
  const unread = query.data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((value) => !value)} aria-label="Notifications">
        {unread > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      </Button>
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-2rem))] rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <div className="font-semibold">Notifications</div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending || unread === 0}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {query.isLoading ? (
              <div className="p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onRead={() => markReadMutation.mutate(item.id)}
                />
              ))
            )}
          </div>
          {import.meta.env.DEV && (
            <div className="border-t p-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => selfTestMutation.mutate()}
                disabled={selfTestMutation.isPending}
              >
                <Send className="h-4 w-4" />
                Send test
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({ item, onRead }: { item: NotificationItem; onRead: () => void }) {
  return (
    <button
      type="button"
      onClick={onRead}
      className="block w-full rounded-md p-3 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{item.title}</div>
          {item.body && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</div>}
          <div className="mt-2 text-[11px] text-muted-foreground">
            {new Date(item.createdAt).toLocaleString()}
          </div>
        </div>
        {!item.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
      </div>
    </button>
  );
}
