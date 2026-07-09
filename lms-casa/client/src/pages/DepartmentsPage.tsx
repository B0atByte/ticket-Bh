import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { alertWarning, confirmDanger, toastSuccess } from '../lib/confirm';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
  type Department,
} from '../features/users/users.api';

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    return err.response?.data?.error?.message ?? err.message ?? fallback;
  }
  return fallback;
}

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['departments'], queryFn: listDepartments });

  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 10;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createMutation = useMutation({
    mutationFn: () => createDepartment({ name: newName.trim(), code: newCode.trim() || undefined }),
    onSuccess: () => {
      setNewName('');
      setNewCode('');
      invalidate();
      void toastSuccess('เพิ่มสาขาแล้ว');
    },
    onError: (err) => alertWarning('เพิ่มสาขาไม่สำเร็จ', errorMessage(err, 'เกิดข้อผิดพลาด')),
  });

  const updateMutation = useMutation({
    mutationFn: () => updateDepartment(editId!, { name: editName.trim(), code: editCode.trim() || undefined }),
    onSuccess: () => {
      setEditId(null);
      invalidate();
      void toastSuccess('บันทึกสาขาแล้ว');
    },
    onError: (err) => alertWarning('บันทึกไม่สำเร็จ', errorMessage(err, 'เกิดข้อผิดพลาด')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: () => {
      invalidate();
      void toastSuccess('ลบสาขาแล้ว');
    },
    onError: (err) => alertWarning('ลบไม่สำเร็จ', errorMessage(err, 'เกิดข้อผิดพลาด')),
  });

  function startEdit(d: Department) {
    setEditId(d.id);
    setEditName(d.name);
    setEditCode(d.code ?? '');
  }

  async function onDelete(d: Department) {
    const ok = await confirmDanger('ลบสาขา', `ต้องการลบสาขา "${d.name}" ใช่หรือไม่?`);
    if (ok) deleteMutation.mutate(d.id);
  }

  const allItems = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (d) => d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q),
    );
  }, [allItems, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Keep the current page within range when the filtered set shrinks.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Building2 className="h-6 w-6 text-primary" />
          จัดการสาขา / แผนก
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          เพิ่ม แก้ไข หรือลบสาขา — ใช้กำหนดสังกัดของพนักงานในหน้าจัดการผู้ใช้
        </p>
      </div>

      {/* Add new */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim()) createMutation.mutate();
        }}
        className="border bg-card p-4"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="new-name">ชื่อสาขา *</Label>
            <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น สาขากรุงเทพ" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-code">รหัส (ไม่บังคับ)</Label>
            <Input id="new-code" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="เช่น BKK" />
          </div>
          <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            เพิ่มสาขา
          </Button>
        </div>
      </form>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาสาขา (ชื่อ หรือ รหัส)"
          className="pl-9"
          aria-label="ค้นหาสาขา"
        />
      </div>

      {/* List */}
      <div className="border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">ชื่อสาขา</th>
              <th className="px-4 py-3 font-medium">รหัส</th>
              <th className="px-4 py-3 font-medium text-center">พนักงาน</th>
              <th className="px-4 py-3 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={4} className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">
                {search.trim() ? 'ไม่พบสาขาที่ตรงกับคำค้นหา' : 'ยังไม่มีสาขา'}
              </td></tr>
            ) : (
              pageItems.map((d) => {
                const editing = editId === d.id;
                return (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      {editing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9" />
                      ) : (
                        <span className="font-medium">{d.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editing ? (
                        <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="h-9 w-32" />
                      ) : (
                        <span className="text-muted-foreground">{d.code ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center text-muted-foreground">{d.userCount ?? 0}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="บันทึก"
                              disabled={!editName.trim() || updateMutation.isPending}
                              onClick={() => updateMutation.mutate()}
                            >
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="ยกเลิก" onClick={() => setEditId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" aria-label="แก้ไข" onClick={() => startEdit(d)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="ลบ"
                              disabled={deleteMutation.isPending}
                              onClick={() => onDelete(d)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {rangeStart}-{rangeEnd} จาก {filtered.length} สาขา
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                aria-label="หน้าก่อนหน้า"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="หน้าถัดไป"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
