import { useMutation } from '@tanstack/react-query';
import { Bug, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { useAuthStore } from '../auth/auth.store';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
import { alertWarning } from '../../lib/confirm';
import { createIssue } from './issues.api';

export function ReportIssueButton() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: () => createIssue({ description: description.trim(), page: location.pathname }),
    onSuccess: async () => {
      setOpen(false);
      setDescription('');
      await toastSuccess('ส่งแจ้งปัญหาเรียบร้อยแล้ว ขอบคุณครับ');
    },
    onError: async (err) => {
      await alertWarning('ส่งแจ้งปัญหาไม่สำเร็จ', getApiErrorMessage(err, 'กรุณาลองใหม่'));
    },
  });

  const submit = () => {
    if (description.trim().length < 5) {
      void alertWarning('แจ้งปัญหา', 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร');
      return;
    }
    mutation.mutate();
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-destructive px-4 py-2.5 pl-3 text-sm font-semibold text-destructive-foreground shadow-warm transition-colors hover:bg-destructive/90"
      >
        <Bug size={18} />
        แจ้งปัญหา
      </button>

      <Dialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug size={18} className="text-destructive" />
              แจ้งปัญหา
            </DialogTitle>
          </DialogHeader>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={mutation.isPending}
            placeholder="อธิบายปัญหาที่พบ..."
            rows={4}
            autoFocus
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
              ส่งแจ้งปัญหา
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
