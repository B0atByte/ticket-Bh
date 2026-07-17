import { useMutation } from '@tanstack/react-query';
import { Bug, Loader2, Paperclip } from 'lucide-react';
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
import type { Severity } from '../../lib/issueService';
import { createIssue } from './issues.api';

const SEVERITY_OPTIONS: { value: Severity; emoji: string; label: string; hint: string }[] = [
  { value: 'critical', emoji: '🔴', label: 'ด่วนที่สุด', hint: 'ระบบพังถาวร ทำงานต่อไม่ได้เลย' },
  { value: 'high', emoji: '🟡', label: 'ด่วน', hint: 'ทำงานได้บางส่วน แต่กระทบงานหลัก' },
  { value: 'normal', emoji: '🟢', label: 'ทั่วไป', hint: 'ปัญหาทั่วไป/ข้อเสนอแนะ' },
];

export function ReportIssueButton() {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [attachment, setAttachment] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createIssue({
        description: description.trim(),
        severity,
        reporterId: user!.id,
        reporterName: `${user!.firstName} ${user!.lastName}`.trim(),
        reporterRole: user!.roles.join(', '),
        page: location.pathname,
        attachment,
      }),
    onSuccess: async () => {
      setOpen(false);
      setDescription('');
      setSeverity('normal');
      setAttachment(null);
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

          <p className="-mb-2 text-xs font-medium text-muted-foreground">ระดับความเร่งด่วน</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SEVERITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSeverity(opt.value)}
                disabled={mutation.isPending}
                title={opt.hint}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  severity === opt.value
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                <div>{opt.emoji}</div>
                <div>{opt.label}</div>
              </button>
            ))}
          </div>

          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={mutation.isPending}
            placeholder="อธิบายปัญหาที่พบ..."
            rows={4}
            autoFocus
          />

          <label className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground cursor-pointer hover:bg-accent">
            <Paperclip size={14} className="shrink-0" />
            <span className="truncate">{attachment ? attachment.name : 'แนบภาพหน้าจอ (ไม่บังคับ)'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
              disabled={mutation.isPending}
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </label>

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
