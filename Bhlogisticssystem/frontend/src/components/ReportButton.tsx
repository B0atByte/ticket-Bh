import { useState } from 'react'
import { Bug, Loader2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export function ReportButton() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  if (!user) return null

  const close = () => {
    if (submitting) return
    setOpen(false)
    setDescription('')
  }

  const submit = async () => {
    if (description.trim().length < 5) {
      toast.error('กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/issues', {
        description: description.trim(),
        page: window.location.pathname,
      })
      toast.success('ส่งแจ้งปัญหาเรียบร้อยแล้ว ขอบคุณครับ')
      setOpen(false)
      setDescription('')
    } catch {
      toast.error('ส่งแจ้งปัญหาไม่สำเร็จ กรุณาลองใหม่')
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
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl w-full max-w-md p-5">
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

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="อธิบายปัญหาที่พบ..."
              rows={4}
              autoFocus
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm px-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50"
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
          </div>
        </div>
      )}
    </>
  )
}
