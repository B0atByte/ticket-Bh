import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Download, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../lib/api-error';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { logout } from '../features/auth/auth.api';
import { useAuthStore } from '../features/auth/auth.store';
import { anonymizeMyAccount, downloadMyDataExport } from '../features/pdpa/pdpa.api';

const CONFIRM_PHRASE = 'delete-my-account';

export function PrivacyPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const exportMut = useMutation({
    mutationFn: () => downloadMyDataExport(),
  });

  const deleteMut = useMutation({
    mutationFn: () => anonymizeMyAccount(),
    onSuccess: async () => {
      // Clear session cookies + redirect to login. Account is now anonymized server-side.
      await logout();
      setUser(null);
      navigate('/login', { replace: true });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-card">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Privacy & Data Rights</h1>
          <p className="text-sm text-muted-foreground">
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณมีสิทธิ์เข้าถึงและขอลบข้อมูลส่วนบุคคล
          </p>
        </div>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">ดาวน์โหลดข้อมูลของฉัน (Right to Data Portability)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ดาวน์โหลดข้อมูลทั้งหมดที่ระบบเก็บไว้เกี่ยวกับคุณเป็นไฟล์ ZIP ประกอบด้วยโปรไฟล์,
              ประวัติการเรียน, ผลสอบ, บันทึก, การถาม-ตอบ, ไฟล์อัปโหลด, และบันทึกกิจกรรม
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              PDPA Section 30 — ข้อมูลที่ได้จะอยู่ในรูปแบบ JSON อ่านได้ทุกเครื่อง
            </p>
          </div>
          <Button
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="shrink-0"
          >
            {exportMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export ZIP
          </Button>
        </div>
        {exportMut.isError && (
          <p className="mt-3 text-sm text-destructive">
            Export failed: {getApiErrorMessage(exportMut.error, 'Unknown error')}
          </p>
        )}
        {exportMut.isSuccess && (
          <p className="mt-3 text-sm text-emerald-700">Download started.</p>
        )}
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-destructive">
              ลบบัญชีของฉัน (Right to Erasure)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ระบบจะทำการ <strong>anonymize</strong> ข้อมูลส่วนตัวของคุณ (อีเมล, ชื่อ-นามสกุล,
              เบอร์โทร, รหัสพนักงาน) ออกจากระบบ บัญชีจะถูกปิดใช้งานถาวร
              <br />
              <strong>หมายเหตุ:</strong> บันทึกกิจกรรม (audit logs) จะถูกเก็บไว้ตามข้อกำหนดของกฏหมาย
              เพื่อตรวจสอบความถูกต้องของระบบ (PDPA Section 33 + retention period)
            </p>
            <p className="mt-3 text-sm font-medium text-destructive">
              การกระทำนี้ไม่สามารถยกเลิกได้
            </p>
            <Button
              variant="ghost"
              className="mt-3 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setConfirmText('');
                setConfirmOpen(true);
              }}
            >
              <AlertTriangle className="h-4 w-4" />
              Delete my account
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-destructive">ยืนยันการลบบัญชี</DialogTitle>
            <DialogDescription>
              บัญชี <strong>{user?.email}</strong> จะถูกปิดใช้งานและข้อมูลส่วนตัวจะถูก anonymize
              ทันที คุณจะถูก log out หลังจากกดยืนยัน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pdpa-confirm">
              พิมพ์ <code className="text-xs">{CONFIRM_PHRASE}</code> เพื่อยืนยัน
            </Label>
            <Input
              id="pdpa-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          {deleteMut.isError && (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(deleteMut.error, 'Delete failed')}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={deleteMut.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmText !== CONFIRM_PHRASE || deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
