import { useEffect, useState } from 'react'
import { ArrowLeft, Bug, Loader2, Send, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  fetchMyIssues,
  postIssueComment,
  submitIssueReport,
  type Category,
  type IssueStatus,
  type MyIssue,
  type Severity,
} from '../lib/issueService'

const SEVERITY_OPTIONS: { value: Severity; label: string; hint: string }[] = [
  { value: 'critical', label: 'ด่วนที่สุด', hint: 'ระบบพังถาวร ทำงานต่อไม่ได้เลย' },
  { value: 'high', label: 'ด่วน', hint: 'ทำงานได้บางส่วน แต่กระทบงานหลัก' },
  { value: 'normal', label: 'ทั่วไป', hint: 'ปัญหาทั่วไป/ข้อเสนอแนะ' },
]

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: 'system_error', label: 'ระบบขัดข้อง' },
  { value: 'payment', label: 'การชำระเงินผิดพลาด' },
  { value: 'account', label: 'บัญชีผู้ใช้' },
  { value: 'feedback', label: 'ข้อเสนอแนะ' },
  { value: 'other', label: 'อื่นๆ' },
]

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → resolved). Issue Management shows its own
// admin-facing wording for the same states — these are reporter-facing.
const STATUS_STEPS: { key: IssueStatus; label: string }[] = [
  { key: 'submitted', label: 'ส่งเรื่องแล้ว' },
  { key: 'acknowledged', label: 'รับเรื่องแล้ว' },
  { key: 'resolved', label: 'แก้ไขเสร็จสิ้น' },
]

function IssueProgress({ status }: { status: IssueStatus }) {
  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status)
  const isResolved = status === 'resolved'
  const activeColor = isResolved ? 'bg-green-500' : 'bg-red-500'

  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, i) => {
        const reached = i <= currentIndex
        return (
          <div key={step.key} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-14 flex-col items-center gap-1 shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${reached ? activeColor : 'bg-slate-200 dark:bg-slate-700'}`} />
              <span
                className={`text-center text-[9px] leading-tight ${
                  reached ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`mt-[5px] h-0.5 flex-1 ${i < currentIndex ? activeColor : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function IssueHistoryCard({ issue, onViewMore }: { issue: MyIssue; onViewMore: (issue: MyIssue) => void }) {
  const sev = SEVERITY_OPTIONS.find((s) => s.value === issue.severity)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex-1 line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">
          {issue.subject || issue.description}
        </p>
        {sev && (
          <span className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {sev.label}
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-slate-400 dark:text-slate-500">
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
  )
}

function IssueDetail({ issue, reporterId, onBack }: { issue: MyIssue; reporterId: string; onBack: () => void }) {
  const sev = SEVERITY_OPTIONS.find((s) => s.value === issue.severity)
  const cat = CATEGORY_OPTIONS.find((c) => c.value === issue.category)
  const [comments, setComments] = useState(issue.comments)
  const [commentText, setCommentText] = useState('')
  const [sending, setSending] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  async function sendComment() {
    if (!commentText.trim()) return
    setSending(true)
    setCommentError(null)
    try {
      const updated = await postIssueComment(issue.id, reporterId, commentText.trim())
      setComments(updated)
      setCommentText('')
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'ส่งข้อความไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3.5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} />
        ย้อนกลับ
      </button>

      <div className="flex flex-wrap gap-1.5">
        {sev && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
            {sev.label}
          </span>
        )}
        {cat && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            {cat.label}
          </span>
        )}
      </div>

      {issue.subject && <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{issue.subject}</p>}
      <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{issue.description}</p>

      {issue.contactInfo && (
        <p className="text-xs text-slate-500 dark:text-slate-400">ติดต่อกลับ: {issue.contactInfo}</p>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        แจ้งเมื่อ {new Date(issue.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
      </p>

      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="space-y-3">
          {issue.history.map((h, i) => (
            <div key={i} className="flex gap-2.5">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.status === 'resolved' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{h.label}</p>
                {h.note && <p className="text-xs text-slate-500 dark:text-slate-400">{h.note}</p>}
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {new Date(h.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">ความคิดเห็น</p>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">ยังไม่มีความคิดเห็น</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      c.authorType === 'admin'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {c.authorType === 'admin' ? 'แอดมิน' : 'ผู้แจ้ง'}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(c.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{c.message}</p>
              </div>
            ))
          )}
        </div>
        {commentError && <p className="mt-2 text-xs text-red-500">{commentError}</p>}
        <div className="mt-2 flex gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 text-sm outline-none focus:border-red-500/50"
          />
          <button
            type="button"
            onClick={sendComment}
            disabled={sending || !commentText.trim()}
            className="flex items-center gap-1 self-end rounded-lg bg-slate-900 dark:bg-slate-100 px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 disabled:opacity-50"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            ส่ง
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReportButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'new' | 'history' | 'detail'>('new')
  const [selectedIssue, setSelectedIssue] = useState<MyIssue | null>(null)
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<Category>('other')
  const [contactInfo, setContactInfo] = useState('')
  const [severity, setSeverity] = useState<Severity>('normal')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<MyIssue[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open || view !== 'history' || !user) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    fetchMyIssues(user.id)
      .then((data) => {
        if (!cancelled) setHistory(data)
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'โหลดประวัติการแจ้งปัญหาไม่สำเร็จ')
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, view, user])

  if (!user) return null

  const close = () => {
    if (submitting) return
    setOpen(false)
    setView('new')
    setSelectedIssue(null)
    setDescription('')
    setSubject('')
    setCategory('other')
    setContactInfo('')
    setSeverity('normal')
  }

  const submit = async () => {
    if (subject.trim().length === 0) {
      toast.error('กรุณาใส่หัวข้อ')
      return
    }
    if (description.trim().length < 5) {
      toast.error('กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร')
      return
    }

    setSubmitting(true)
    try {
      await submitIssueReport({
        description: description.trim(),
        severity,
        reporterId: user.id,
        reporterName: user.name,
        reporterRole: user.role,
        page: window.location.pathname,
        category,
        subject: subject.trim(),
        contactInfo: contactInfo.trim() || undefined,
      })
      toast.success('ส่งแจ้งปัญหาเรียบร้อยแล้ว ขอบคุณครับ')
      close()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors group relative"
      >
        <Bug size={20} className="shrink-0" />
        <span className="hidden md:block text-sm font-medium">รายงานปัญหา</span>
        <div className="md:hidden absolute left-full ml-2 px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          รายงานปัญหา
        </div>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">รายงานปัญหา</p>
              <button onClick={close} disabled={submitting} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            {view !== 'detail' && (
              <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setView('new')}
                  className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    view === 'new'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  แจ้งปัญหาใหม่
                </button>
                <button
                  type="button"
                  onClick={() => setView('history')}
                  className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    view === 'history'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  ประวัติของฉัน
                </button>
              </div>
            )}

            {view === 'new' ? (
              <>
                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">หมวดหมู่</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  disabled={submitting}
                  className="mb-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={submitting}
                  placeholder="หัวข้อสั้นๆ"
                  required
                  maxLength={120}
                  className="mb-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />

                <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">ระดับความเร่งด่วน</p>
                <div className="mb-4 grid grid-cols-3 gap-1.5">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeverity(opt.value)}
                      disabled={submitting}
                      title={opt.hint}
                      className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                        severity === opt.value
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  placeholder="อธิบายปัญหาที่พบ..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />

                <input
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  disabled={submitting}
                  placeholder="เบอร์โทร/อีเมล ติดต่อกลับ (ไม่บังคับ)"
                  className="mb-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
                />

                <div className="flex gap-2">
                  <button onClick={close} disabled={submitting}
                    className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors">
                    ยกเลิก
                  </button>
                  <button onClick={submit} disabled={submitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors shadow-sm shadow-red-600/20">
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    ส่งแจ้งปัญหา
                  </button>
                </div>
              </>
            ) : view === 'history' ? (
              <div className="space-y-2.5">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : historyError ? (
                  <p className="py-6 text-center text-sm text-red-600 dark:text-red-400">{historyError}</p>
                ) : history.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">ยังไม่มีประวัติการแจ้งปัญหา</p>
                ) : (
                  history.map((issue) => (
                    <IssueHistoryCard
                      key={issue.id}
                      issue={issue}
                      onViewMore={(i) => {
                        setSelectedIssue(i)
                        setView('detail')
                      }}
                    />
                  ))
                )}
              </div>
            ) : (
              selectedIssue && (
                <IssueDetail issue={selectedIssue} reporterId={user.id} onBack={() => setView('history')} />
              )
            )}
          </div>
        </div>
      )}
    </>
  )
}
