import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Pencil, Search, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../features/auth/auth.store';
import { confirmDanger, toastSuccess } from '../lib/confirm';
import { UserFormDialog } from '../features/users/UserFormDialog';
import { deleteUser, listUsers, type UserRow } from '../features/users/users.api';

function statusLabel(status: string): string {
  if (status === 'ACTIVE') return 'ใช้งาน';
  if (status === 'SUSPENDED') return 'ระงับ';
  if (status === 'INVITED') return 'รอเข้าร่วม';
  if (status === 'DISABLED') return 'ปิดใช้งาน';
  return status;
}

export function UsersPage() {
  const canCreate = useAuthStore((s) => s.hasPermission('user.create'));
  const canUpdate = useAuthStore((s) => s.hasPermission('user.update'));
  const canDelete = useAuthStore((s) => s.hasPermission('user.delete'));
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['users', { q, page }],
    queryFn: () => listUsers({ q: q || undefined, page, pageSize: 20 }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void toastSuccess('ลบผู้ใช้แล้ว');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center border bg-card">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">ผู้ใช้</h1>
            <p className="text-sm text-muted-foreground">ทั้งหมด {query.data?.meta.total ?? 0} คน</p>
          </div>
        </div>
        {canCreate && <UserFormDialog mode="create" />}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหาด้วยชื่อ อีเมล หรือรหัสพนักงาน…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-x-auto border bg-card">
        {query.isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลด…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">ชื่อ</th>
                <th className="px-4 py-3">อีเมล</th>
                <th className="px-4 py-3">รหัสพนักงาน</th>
                <th className="px-4 py-3">บทบาท</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(query.data?.items ?? []).map((u) => (
                <UserRowItem
                  key={u.id}
                  user={u}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onDelete={async (id) => {
                    if (await confirmDanger('ลบผู้ใช้?', `ลบ <b>${u.firstName} ${u.lastName}</b> ออกจากระบบ?<br><small>ข้อมูลจะยังถูกเก็บไว้ในระบบ (soft delete)</small>`)) {
                      deleteMut.mutate(id);
                    }
                  }}
                />
              ))}
              {(query.data?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    ไม่พบผู้ใช้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {query.data && query.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            หน้า {query.data.meta.page} จาก {query.data.meta.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ก่อนหน้า
            </Button>
            <Button
              variant="secondary"
              disabled={page >= query.data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRowItem({
  user,
  canUpdate,
  canDelete,
  onDelete,
}: {
  user: UserRow;
  canUpdate: boolean;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">
          {user.firstName} {user.lastName}
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3 text-muted-foreground">{user.employeeId ?? '—'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-muted-foreground">ไม่มีบทบาท</span>
          ) : (
            user.roles.map((r) => (
              <span
                key={r}
                className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {r}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`border px-2 py-0.5 text-[10px] font-medium ${
            user.status === 'ACTIVE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : user.status === 'DISABLED'
              ? 'border-destructive/20 bg-destructive/10 text-destructive'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {statusLabel(user.status)}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <Link
            to={`/users/${user.id}/record`}
            aria-label={`ดูประวัติ ${user.firstName}`}
            title="ดูประวัติ"
            className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
          </Link>
          {canUpdate && (
            <UserFormDialog
              mode="edit"
              user={user}
              trigger={
                <Button variant="ghost" className="h-8 w-8 px-0" aria-label={`แก้ไข ${user.firstName}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          )}
          {canDelete && (
            <Button
              variant="ghost"
              className="h-8 w-8 px-0 text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(user.id)}
              aria-label={`ลบ ${user.firstName}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
