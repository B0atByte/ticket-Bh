import { Link, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import Footer from "../components/Footer";
import { useI18n } from "../lib/i18n";

const tiles: { to: string; icon: IconName; titleKey: string; subKey: string; primary?: boolean }[] = [
  { to: "/warranty/register", icon: "shield", titleKey: "home.register.title", subKey: "home.register.sub", primary: true },
  { to: "/warranty", icon: "clock", titleKey: "home.check.title", subKey: "home.check.sub" },
  { to: "/support", icon: "tool", titleKey: "home.report.title", subKey: "home.report.sub" },
  { to: "/track", icon: "search", titleKey: "home.track.title", subKey: "home.track.sub" },
];

export default function Home() {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <div className="fade-in">
      <div className="px-1 pb-2 pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t("home.eyebrow")}</div>
        <h1 className="text-2xl font-bold tracking-tight">{t("home.title")}</h1>
        <p className="mt-1.5 text-sm text-ink2">{t("home.subtitle")}</p>
      </div>

      <div className="mt-5 h-px bg-line" />

      <div className="mt-5 space-y-3">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="flex items-center gap-4 rounded-xl2 border border-line bg-card p-4 transition hover:border-ink"
          >
            <span
              className={`flex h-12 w-12 flex-none items-center justify-center rounded-xl2 ${
                tile.primary ? "bg-ink text-white" : "border border-line bg-brown-tint text-brand"
              }`}
            >
              <Icon name={tile.icon} size={24} />
            </span>
            <span className="flex-1">
              <b className="block text-[16px] font-bold tracking-tight">{t(tile.titleKey)}</b>
              <small className="text-[12.5px] text-muted">{t(tile.subKey)}</small>
            </span>
            <Icon name="chevronRight" size={18} className="text-muted" />
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl2 border border-line border-l-[3px] border-l-brand bg-card p-3.5 text-[12px] text-ink2">
        <Icon name="info" size={16} className="mt-0.5 flex-none text-brand" />
        {t("home.note")}
      </div>

      <button onClick={() => nav("/staff")} className="mt-9 w-full text-center text-xs text-grey underline-offset-4 hover:underline">
        {t("common.staffLogin")}
      </button>
      <Footer className="mt-4" />
    </div>
  );
}
