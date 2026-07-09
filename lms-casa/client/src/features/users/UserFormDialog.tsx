import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Combobox } from '../../components/ui/Combobox';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  ALL_ROLES,
  changeUserPassword,
  createUser,
  listDepartments,
  updateUser,
  type CreateUserInput,
  type UserRow,
} from './users.api';

const FormSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128).optional().or(z.literal('')),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  employeeId: z.string().trim().max(64).optional().or(z.literal('')),
  phone: z.string().trim().max(32).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'DISABLED']),
  roleKeys: z.array(z.string()).default([]),
  departmentId: z.string().default(''),
});

type FormValues = z.input<typeof FormSchema>;

interface Props {
  mode: 'create' | 'edit';
  user?: UserRow;
  trigger?: React.ReactNode;
}

export function UserFormDialog({ mode, user, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: user?.email ?? '',
      password: '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      employeeId: user?.employeeId ?? '',
      phone: user?.phone ?? '',
      status: user?.status ?? 'ACTIVE',
      roleKeys: user?.roles ?? ['EMPLOYEE'],
      departmentId: user?.departmentId ?? '',
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: listDepartments,
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const base = {
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        employeeId: values.employeeId || undefined,
        phone: values.phone || undefined,
        status: values.status,
        roleKeys: values.roleKeys,
        departmentId: values.departmentId ? values.departmentId : undefined,
      };
      if (mode === 'create') {
        if (!values.password) throw new Error('ต้องกำหนดรหัสผ่านเมื่อสร้างผู้ใช้ใหม่');
        const created = await createUser({ ...base, password: values.password } as CreateUserInput);
        return created;
      }
      if (!user) throw new Error('ไม่พบผู้ใช้ที่ต้องการแก้ไข');
      const updated = await updateUser(user.id, base);
      if (values.password) {
        await changeUserPassword(user.id, values.password);
      }
      return updated;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      form.reset();
      void toastSuccess(mode === 'create' ? 'สร้างผู้ใช้แล้ว' : 'บันทึกผู้ใช้แล้ว');
    },
  });

  const toggleRole = (key: string) => {
    const current = form.getValues('roleKeys') ?? [];
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    form.setValue('roleKeys', next, { shouldDirty: true });
  };

  const currentRoles = form.watch('roleKeys');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> สร้างผู้ใช้
        </Button>
      )}
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'สร้างผู้ใช้ใหม่' : `แก้ไข ${user?.firstName ?? 'ผู้ใช้'}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'ผู้ใช้ใหม่จะได้บทบาท EMPLOYEE ตามค่าเริ่มต้น เว้นแต่ติ๊กบทบาทอื่น'
              : 'รหัสผ่านจะถูกเปลี่ยนเมื่อกรอกค่าใหม่เท่านั้น'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="u-email">อีเมล *</Label>
              <Input id="u-email" type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-employee">รหัสพนักงาน</Label>
              <Input id="u-employee" {...form.register('employeeId')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-fn">ชื่อ *</Label>
              <Input id="u-fn" {...form.register('firstName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-ln">นามสกุล *</Label>
              <Input id="u-ln" {...form.register('lastName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-phone">เบอร์โทรศัพท์</Label>
              <Input id="u-phone" {...form.register('phone')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-department">สาขา / แผนก</Label>
              <Combobox
                id="u-department"
                value={form.watch('departmentId') ?? ''}
                onChange={(v) => form.setValue('departmentId', v, { shouldDirty: true })}
                options={(departmentsQuery.data ?? []).map((d) => ({
                  value: d.id,
                  label: d.code ? `${d.name} (${d.code})` : d.name,
                }))}
                placeholder="พิมพ์ค้นหา หรือ เลือกสาขา"
                clearLabel="— ไม่ระบุ —"
                emptyText="ไม่พบสาขา"
                disabled={departmentsQuery.isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-status">สถานะ</Label>
              <select
                id="u-status"
                {...form.register('status')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="ACTIVE">ใช้งาน</option>
                <option value="INVITED">รอเข้าร่วม</option>
                <option value="SUSPENDED">ระงับ</option>
                <option value="DISABLED">ปิดใช้งาน</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="u-password">
              รหัสผ่าน {mode === 'create' ? '*' : '(เว้นว่างเพื่อคงค่าเดิม)'}
            </Label>
            <Input
              id="u-password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>บทบาท</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_ROLES.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={(currentRoles ?? []).includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4"
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          {mutation.isError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {getApiErrorMessage(mutation.error, 'บันทึกไม่สำเร็จ')}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'สร้าง' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
