import { useState } from 'react'
import { Bug, Loader2, Paperclip, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { submitIssueReport, type Severity } from '../lib/issueService'

const SEVERITY_OPTIONS: { value: Severity; emoji: string; label: string; hint: string }[] = [
  { value: 'critical', emoji: '🔴', label: 'ด่วนที่สุด', hint: 'ระบบพังถาวร ทำงานต่อไม่ได้เลย' },
  { value: 'high', emoji: '🟡', label: 'ด่วน', hint: 'ทำงานได้บางส่วน แต่กระทบงานหลัก' },
  { value: 'normal', emoji: '🟢', label: 'ทั่วไป', hint: 'ปัญหาทั่วไป/ข้อเสนอแนะ' },
]

export function ReportButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('normal')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  if (!user) return null

  const close = () => {
    if (submitting) return
    setOpen(false)
    setDescription('')
    setSeverity('normal')
    setAttachment(null)
  }

  const submit = async () => {
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
        attachment,
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
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold pl-3 pr-4 py-2.5 rounded-full shadow-lg shadow-red-600/30 transition-colors"
      >
        <Bug size={18} />
        แจ้งปัญหา
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={close} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                  <Bug size={18} className="text-red-500" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">แจ้งปัญหา</p>
              </div>
              <button onClick={close} disabled={submitting} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

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
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div>{opt.emoji}</div>
                  <div>{opt.label}</div>
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="อธิบายปัญหาที่พบ..."
              rows={4}
              autoFocus
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
            />

            <label className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <Paperclip size={14} className="shrink-0" />
              <span className="truncate">{attachment ? attachment.name : 'แนบภาพหน้าจอ (ไม่บังคับ)'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                disabled={submitting}
                onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>

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
          </div>
        </div>
      )}
    </>
  )
}
