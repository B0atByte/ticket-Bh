import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
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
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { useAuthStore } from '../auth/auth.store';
import { getApiErrorMessage } from '../../lib/api-error';
import { toastSuccess } from '../../lib/confirm';
import { alertWarning } from '../../lib/confirm';
import { type Category, type IssueStatus, type MyIssue, type Severity } from '../../lib/issueService';
import { addIssueComment, createIssue, getMyIssues } from './issues.api';

const SEVERITY_OPTIONS: { value: Severity; label: string; hint: string }[] = [
  { value: 'critical', label: 'ด่วนที่สุด', hint: 'ระบบพังถาวร ทำงานต่อไม่ได้เลย' },
  { value: 'high', label: 'ด่วน', hint: 'ทำงานได้บางส่วน แต่กระทบงานหลัก' },
  { value: 'normal', label: 'ทั่วไป', hint: 'ปัญหาทั่วไป/ข้อเสนอแนะ' },
];

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'system_error', label: 'ระบบขัดข้อง' },
  { value: 'payment', label: 'การชำระเงินผิดพลาด' },
  { value: 'account', label: 'บัญชีผู้ใช้' },
  { value: 'feedback', label: 'ข้อเสนอแนะ' },
  { value: 'other', label: 'อื่นๆ' },
];

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → resolved). Issue Management shows its own
// admin-facing wording for the same states — these are reporter-facing.
const STATUS_STEPS: { key: IssueStatus; label: string }[] = [
  { key: 'submitted', label: 'ส่งเรื่องแล้ว' },
  { key: 'acknowledged', label: 'รับเรื่องแล้ว' },
  { key: 'resolved', label: 'แก้ไขเสร็จสิ้น' },
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

function IssueHistoryCard({ issue, onViewMore }: { issue: MyIssue; onViewMore: (issue: MyIssue) => void }) {
  const sev = SEVERITY_OPTIONS.find((s) => s.value === issue.severity);

  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex-1 line-clamp-2 text-sm font-medium text-foreground">{issue.subject || issue.description}</p>
        {sev && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sev.label}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>
      <IssueProgress status={issue.status} />
      <button
        type="button"
        onClick={() => onViewMore(issue)}
        className="mt-3 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        ดูเพิ่ม
      </button>
    </div>
  );
}

function IssueDetail({ issue, reporterId, onBack }: { issue: MyIssue; reporterId: string; onBack: () => void }) {
  const sev = SEVERITY_OPTIONS.find((s) => s.value === issue.severity);
  const cat = CATEGORY_OPTIONS.find((c) => c.value === issue.category);
  const [comments, setComments] = useState(issue.comments);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  async function sendComment() {
    if (!commentText.trim()) return;
    setSending(true);
    setCommentError(null);
    try {
      const updated = await addIssueComment(issue.id, reporterId, commentText.trim());
      setComments(updated);
      setCommentText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'ส่งข้อความไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        ย้อนกลับ
      </button>

      <div className="flex flex-wrap gap-1.5">
        {sev && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
            {sev.label}
          </span>
        )}
        {cat && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {cat.label}
          </span>
        )}
      </div>

      {issue.subject && <p className="text-sm font-semibold text-foreground">{issue.subject}</p>}
      <p className="whitespace-pre-wrap text-sm text-foreground">{issue.description}</p>

      {issue.contactInfo && <p className="text-xs text-muted-foreground">ติดต่อกลับ: {issue.contactInfo}</p>}

      <p className="text-[11px] text-muted-foreground">
        แจ้งเมื่อ {new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>

      <div className="border-t border-border pt-3">
        <div className="space-y-3">
          {issue.history.map((h, i) => (
            <div key={i} className="flex gap-2.5">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.status === 'resolved' ? 'bg-green-500' : 'bg-destructive'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{h.label}</p>
                {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {new Date(h.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold text-foreground">ความคิดเห็น</p>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">ยังไม่มีความคิดเห็น</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-accent px-3 py-2">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      c.authorType === 'admin' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c.authorType === 'admin' ? 'แอดมิน' : 'ผู้แจ้ง'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{c.message}</p>
              </div>
            ))
          )}
        </div>
        {commentError && <p className="mt-2 text-xs text-destructive">{commentError}</p>}
        <div className="mt-2 flex gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            rows={2}
          />
          <Button
            variant="default"
            onClick={sendComment}
            disabled={sending || !commentText.trim()}
            className="self-end"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            ส่ง
          </Button>
        </div>
      </div>
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
  const [view, setView] = useState<'new' | 'history' | 'detail'>('new');
  const [selectedIssue, setSelectedIssue] = useState<MyIssue | null>(null);
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [contactInfo, setContactInfo] = useState('');
  const [severity, setSeverity] = useState<Severity>('normal');
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
        category,
        subject: subject.trim(),
        contactInfo: contactInfo.trim() || undefined,
      }),
    onSuccess: async () => {
      onOpenChange(false);
      setView('new');
      setDescription('');
      setSubject('');
      setCategory('other');
      setContactInfo('');
      setSeverity('normal');
      await toastSuccess('ส่งแจ้งปัญหาเรียบร้อยแล้ว ขอบคุณครับ');
    },
    onError: async (err) => {
      await alertWarning('ส่งแจ้งปัญหาไม่สำเร็จ', getApiErrorMessage(err, 'กรุณาลองใหม่'));
    },
  });

  const submit = () => {
    if (subject.trim().length === 0) {
      void alertWarning('รายงานปัญหา', 'กรุณาใส่หัวข้อ');
      return;
    }
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
          <DialogTitle>รายงานปัญหา</DialogTitle>
        </DialogHeader>

        {view !== 'detail' && (
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-accent p-1">
            <button
              type="button"
              onClick={() => setView('new')}
              className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                view === 'new' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              แจ้งปัญหาใหม่
            </button>
            <button
              type="button"
              onClick={() => setView('history')}
              className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                view === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              ประวัติของฉัน
            </button>
          </div>
        )}

        {view === 'new' ? (
          <>
            <p className="-mb-2 text-xs font-medium text-muted-foreground">หมวดหมู่</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={mutation.isPending}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={mutation.isPending}
              placeholder="หัวข้อสั้นๆ"
              required
              maxLength={120}
            />

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
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
              placeholder="อธิบายปัญหาที่พบ..."
              rows={4}
            />

            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              disabled={mutation.isPending}
              placeholder="เบอร์โทร/อีเมล ติดต่อกลับ (ไม่บังคับ)"
            />

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
        ) : view === 'history' ? (
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
              history.map((issue) => (
                <IssueHistoryCard
                  key={issue.id}
                  issue={issue}
                  onViewMore={(i) => {
                    setSelectedIssue(i);
                    setView('detail');
                  }}
                />
              ))
            )}
          </div>
        ) : (
          selectedIssue && <IssueDetail issue={selectedIssue} reporterId={user.id} onBack={() => setView('history')} />
        )}
      </DialogContent>
    </Dialog>
  );
}
