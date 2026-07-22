import { useMutation } from '@tanstack/react-query';
import { Bug, History, Loader2, Paperclip } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import type { IssueStatus, MyIssue, Severity } from '../../lib/issueService';
import { createIssue, getMyIssues } from './issues.api';

const SEVERITY_OPTIONS: { value: Severity; emoji: string; label: string; hint: string }[] = [
  { value: 'critical', emoji: '🔴', label: 'ด่วนที่สุด', hint: 'ระบบพังถาวร ทำงานต่อไม่ได้เลย' },
  { value: 'high', emoji: '🟡', label: 'ด่วน', hint: 'ทำงานได้บางส่วน แต่กระทบงานหลัก' },
  { value: 'normal', emoji: '🟢', label: 'ทั่วไป', hint: 'ปัญหาทั่วไป/ข้อเสนอแนะ' },
];

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → pending_user → resolved) — labels match what
// admins see elsewhere (dashboard) so the reporter isn't shown different
// wording for the same state.
const STATUS_STEPS: { key: IssueStatus; label: string }[] = [
  { key: 'submitted', label: 'ส่งเรื่องแล้ว' },
  { key: 'acknowledged', label: 'รับเรื่องแล้ว' },
  { key: 'pending_user', label: 'รอข้อมูลเพิ่มเติม' },
  { key: 'resolved', label: 'แก้ไขเรียบร้อย' },
];

function IssueProgress({ status }: { status: IssueStatus }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status);
  const isResolved = status === 'resolved';
  const activeColor = isResolved ? 'bg-green-500' : 'bg-destructive';

  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, i) => {
        const reached = i <= currentIndex;
        return (
          <div key={step.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-14 flex-col items-center gap-1 shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${reached ? activeColor : 'bg-muted'}`} />
              <span
                className={`text-center text-[9px] leading-tight ${
                  reached ? 'font-medium text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`mt-[5px] h-0.5 flex-1 ${i < currentIndex ? activeColor : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function IssueHistoryCard({ issue }: { issue: MyIssue }) {
  const sev = SEVERITY_OPTIONS.find((s) => s.value === issue.severity);

  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex-1 line-clamp-2 text-sm text-foreground">{issue.description}</p>
        {sev && (
          <span className="shrink-0 text-sm" title={sev.label}>
            {sev.emoji}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
      <IssueProgress status={issue.status} />
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportIssueDialog({ open, onOpenChange }: Props) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const [view, setView] = useState<'new' | 'history'>('new');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [history, setHistory] = useState<MyIssue[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || view !== 'history' || !user) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    getMyIssues(user.id)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'โหลดประวัติการแจ้งปัญหาไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, view, user]);

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
      onOpenChange(false);
      setView('new');
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
      void alertWarning('รายงานปัญหา', 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร');
      return;
    }
    mutation.mutate();
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !mutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug size={18} className="text-destructive" />
            รายงานปัญหา
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-accent p-1">
          <button
            type="button"
            onClick={() => setView('new')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              view === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bug size={13} />
            แจ้งปัญหาใหม่
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              view === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <History size={13} />
            ประวัติของฉัน
          </button>
        </div>

        {view === 'new' ? (
          <>
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
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setView('new');
                }}
                disabled={mutation.isPending}
              >
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={submit} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
                ส่งแจ้งปัญหา
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : historyError ? (
              <p className="py-6 text-center text-sm text-destructive">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการแจ้งปัญหา</p>
            ) : (
              history.map((issue) => <IssueHistoryCard key={issue.id} issue={issue} />)
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
