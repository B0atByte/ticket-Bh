import { useState, type FormEvent } from 'react'
import LangToggle from '../components/LangToggle'
import { login, setToken } from '../lib/api'
import { useI18n } from '../lib/i18n'

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(pw: string) {
    setError(null)
    setLoading(true)
    try {
      const { token } = await login(pw)
      setToken(token)
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.fail'))
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    void submit(password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h1 className="mb-1 text-xl font-semibold text-slate-900">Issue Management</h1>
            <p className="text-sm text-slate-500">{t('app.subtitle')}</p>
          </div>
          <LangToggle />
        </div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{t('login.passwordLabel')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          autoFocus
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => void submit('admin123')}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          Quick Access — Admin
        </button>
      </form>
    </div>
  )
}
