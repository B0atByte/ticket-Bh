import { useI18n, type Lang } from "../lib/i18n";

/** TH / EN switch. */
export default function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const opt = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      className={`px-2 py-0.5 text-xs font-semibold transition ${lang === l ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );
  return (
    <div className={`inline-flex overflow-hidden rounded-xl2 border border-line ${className}`}>
      {opt("th", "ไทย")}
      {opt("en", "EN")}
    </div>
  );
}
