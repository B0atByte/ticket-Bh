import { ExternalLink, Loader2, Send, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchIssueDetail, postComment, updateIssueStatus, type IssueDetail, type IssueStatusValue } from '../lib/api'
import {
  ALL_STATUSES,
  SEVERITY_COLORS,
  SEVERITY_KEYS,
  STATUS_KEYS,
  badgeClass,
  categoryKey,
  formatTime,
  systemLink,
} from '../lib/issueDisplay'
import { useI18n } from '../lib/i18n'

export default function IssueDetailPanel({
  issueId,
  onClose,
  onChanged,
  onLoggedOut,
}: {
  issueId: string
  onClose: () => void
  onChanged: () => void
  onLoggedOut: () => void
}) {
  const { t, lang } = useI18n()
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<IssueStatusValue>('submitted')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIssueDetail(issueId)
      setDetail(data)
      setStatus(data.status)
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setError(err instanceof Error ? err.message : t('detail.loadFail'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId])

  async function saveStatus() {
    if (!detail) return
    setSaving(true)
    try {
      await updateIssueStatus(detail.system, detail.id, status, note.trim() || undefined)
      setNote('')
      await load()
      onChanged()
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setError(err instanceof Error ? err.message : t('detail.statusUpdateFail'))
    } finally {
      setSaving(false)
    }
  }

  async function sendComment() {
    if (!detail || !commentText.trim()) return
    setCommentSending(true)
    setCommentError(null)
    try {
      await postComment(detail.id, commentText.trim())
      setCommentText('')
      await load()
    } catch (err) {
      if (err instanceof Error && err.message === 'Unauthorized') {
        onLoggedOut()
        return
      }
      setCommentError(err instanceof Error ? err.message : t('detail.commentFail'))
    } finally {
      setCommentSending(false)
    }
  }

  const link = detail ? systemLink(detail) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900">{t('maintab.issues')}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">{t('list.loading')}</p>
          ) : !detail ? (
            <p className="text-sm text-red-600">{error ?? t('detail.loadFail')}</p>
          ) : (
            <div className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-wrap items-center gap-2">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium hover:opacity-80 ${badgeClass(detail.system)}`}
                  >
                    {detail.system}
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass(detail.system)}`}>{detail.system}</span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[detail.severity]}`}>
                  {t(SEVERITY_KEYS[detail.severity])}
                </span>
                <span className="text-xs font-medium text-slate-500">#{t(categoryKey(detail.category))}</span>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">{detail.subject || detail.description}</p>
                {detail.subject && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{detail.description}</p>}
              </div>

              <dl className="grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  <dt className="font-medium text-slate-400">{t('card.reporter')}</dt>
                  <dd className="text-slate-700">
                    {detail.reporterName ?? t('card.unknown')}
                    {detail.reporterRole ? ` (${detail.reporterRole})` : ''}
                  </dd>
                </div>
                {detail.page && (
                  <div className="sm:col-span-2">
                    <dd className="text-slate-700">{t('card.page', { page: detail.page })}</dd>
                  </div>
                )}
                {detail.contactInfo && (
                  <div>
                    <dt className="font-medium text-slate-400">{t('detail.contact')}</dt>
                    <dd className="text-slate-700">{detail.contactInfo}</dd>
                  </div>
                )}
                {detail.appVersion && (
                  <div>
                    <dt className="font-medium text-slate-400">{t('detail.appVersion')}</dt>
                    <dd className="text-slate-700">{detail.appVersion}</dd>
                  </div>
                )}
                {detail.deviceInfo && (
                  <div className="sm:col-span-2">
                    <dt className="font-medium text-slate-400">{t('detail.device')}</dt>
                    <dd className="break-words font-mono text-[11px] text-slate-600">{detail.deviceInfo}</dd>
                  </div>
                )}
              </dl>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">{t('detail.updateStatus')}</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as IssueStatusValue)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-500"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(STATUS_KEYS[s])}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('detail.notePlaceholder')}
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-slate-500"
                />
                <button
                  onClick={saveStatus}
                  disabled={saving}
                  className="mt-2 flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  {saving ? t('detail.saving') : t('detail.save')}
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">{t('detail.timeline')}</p>
                <div className="space-y-2.5">
                  {detail.history.map((h, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.status === 'resolved' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700">{t(STATUS_KEYS[h.status])}</p>
                        {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                        <p className="text-[11px] text-slate-400">{formatTime(h.createdAt, lang)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">{t('detail.comments')}</p>
                <div className="space-y-2">
                  {detail.comments.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('detail.noComments')}</p>
                  ) : (
                    detail.comments.map((c) => (
                      <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              c.authorType === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c.authorType === 'admin' ? t('detail.authorAdmin') : t('detail.authorReporter')}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatTime(c.createdAt, lang)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-slate-800">{c.message}</p>
                      </div>
                    ))
                  )}
                </div>
                {commentError && <p className="mt-2 text-xs text-red-600">{commentError}</p>}
                <div className="mt-2 flex gap-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t('detail.commentPlaceholder')}
                    rows={2}
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  <button
                    onClick={sendComment}
                    disabled={commentSending || !commentText.trim()}
                    className="flex items-center gap-1 self-end rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {commentSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {t('detail.send')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
