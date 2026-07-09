import { NavLink } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { useI18n } from "../lib/i18n";

const items: { to: string; key: string; icon: IconName }[] = [
  { to: "/", key: "nav.home", icon: "home" },
  { to: "/warranty", key: "nav.warranty", icon: "shield" },
  { to: "/support", key: "nav.support", icon: "tool" },
  { to: "/track", key: "nav.track", icon: "search" },
];

export default function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-portal border-t border-line bg-card">
      <div className="grid grid-cols-4">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] tracking-wide transition ${
                isActive ? "text-ink" : "text-grey"
              }`
            }
          >
            <Icon name={it.icon} size={20} />
            <span>{t(it.key)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
