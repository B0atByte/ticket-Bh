import { useI18n } from '../lib/i18n'

export default function LangToggle() {
  const { lang, setLang } = useI18n()

  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-medium">
      <button
        onClick={() => setLang('th')}
        className={`rounded-md px-2 py-1 transition ${lang === 'th' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        TH
      </button>
      <button
        onClick={() => setLang('en')}
        className={`rounded-md px-2 py-1 transition ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
      >
        EN
      </button>
    </div>
  )
}
