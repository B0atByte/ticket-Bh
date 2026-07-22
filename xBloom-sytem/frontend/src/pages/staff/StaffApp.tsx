import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { swalError, swalToast } from "../../lib/swal";
import { Button, Logo, TextField } from "../../components/ui";
import { Icon } from "../../components/Icon";
import LangToggle from "../../components/LangToggle";
import ReportBugDialog from "../../components/ReportBugButton";
import Footer from "../../components/Footer";
import CrmView from "./CrmView";
import Today from "./tabs/Today";
import AllCases from "./tabs/AllCases";
import Warranties from "./tabs/Warranties";
import Assets from "./tabs/Assets";
import GlobalClaims from "./tabs/GlobalClaims";
import Reports from "./tabs/Reports";
import ShopeeOrders from "./tabs/ShopeeOrders";
import Log from "./tabs/Log";
import Users from "./tabs/Users";
import type { IconName } from "../../components/Icon";

const NAV: { key: string; labelKey: string; icon: IconName }[] = [
  { key: "crm", labelKey: "staff.crmNav", icon: "search" },
  { key: "today", labelKey: "tab.today", icon: "dashboard" },
  { key: "cases", labelKey: "tab.cases", icon: "file" },
  { key: "warranties", labelKey: "tab.warranties", icon: "shield" },
  { key: "assets", labelKey: "tab.assets", icon: "box" },
  { key: "global", labelKey: "tab.global", icon: "globe" },
  { key: "reports", labelKey: "tab.reports", icon: "chart" },
  { key: "shopee", labelKey: "tab.shopee", icon: "cart" },
  { key: "log", labelKey: "tab.log", icon: "list" },
  { key: "users", labelKey: "tab.users", icon: "users" },
];

const PANEL: Record<string, React.ReactNode> = {
  today: <Today />,
  cases: <AllCases />,
  warranties: <Warranties />,
  assets: <Assets />,
  global: <GlobalClaims />,
  reports: <Reports />,
  shopee: <ShopeeOrders />,
  log: <Log />,
  users: <Users />,
};

export default function StaffApp() {
  const { user, login, logout } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("crm");
  const [reportOpen, setReportOpen] = useState(false);
  // Techs have no CRM search; land them on their own cases instead.
  useEffect(() => {
    if (user?.role === "tech" && view === "crm") setView("cases");
  }, [user, view]);

  if (!user) return <StaffLogin onSignIn={login} onCancel={() => nav("/")} t={t} />;

  const initials = user.name.slice(0, 2);

  // Field technicians are scoped to their own assigned cases only — no CRM,
  // no warranties/assets/global/reports/shopee/log. Backend enforces this too.
  const isTech = user.role === "tech";
  const navItems = isTech
    ? [
        { key: "cases", labelKey: "tab.myCases", icon: "file" as IconName },
        { key: "allcases", labelKey: "tab.cases", icon: "list" as IconName },
      ]
    : NAV.filter((i) => i.key !== "users" || user.role === "admin");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setView("crm");
    setQuery(term.trim());
  }

  const NavItem = ({ item, side }: { item: (typeof NAV)[number]; side?: boolean }) => (
    <button
      onClick={() => setView(item.key)}
      className={
        side
          ? `flex w-full items-center gap-3 rounded-xl2 px-3 py-2.5 text-sm transition ${view === item.key ? "bg-ink text-white" : "text-ink2 hover:bg-canvas"}`
          : `flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${view === item.key ? "border-ink text-ink" : "border-transparent text-muted"}`
      }
    >
      <Icon name={item.icon} size={side ? 18 : 16} />
      {t(item.labelKey)}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* left sidebar (md+) */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-col border-r border-line bg-card md:flex">
        <div className="flex h-[60px] items-center gap-3 border-b border-line px-4">
          <img src="/xbloom-logo.png" alt="xBloom" className="h-9 w-9 flex-none rounded-xl2" />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-ink">xBloom</span>
              <span className="h-[5px] w-[5px] bg-accent" />
              <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">DEMO</span>
            </div>
            <div className="text-[11px] text-muted">{t("brand.supportCrm")}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <NavItem key={item.key} item={item} side />
          ))}
          <button
            onClick={() => setReportOpen(true)}
            className="flex w-full items-center gap-3 rounded-xl2 px-3 py-2.5 text-sm text-ink2 transition hover:bg-canvas"
          >
            <Icon name="alert" size={18} />
            {t("bugReport.button")}
          </button>
        </nav>
        <Footer className="border-t border-line p-3" />
      </aside>

      {/* main column */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-card">
          <div className="flex h-[60px] items-center gap-4 px-4 sm:px-6">
            <Logo label={t("brand.supportCrm")} className="md:hidden" />
            <form className={isTech ? "hidden" : "hidden flex-1 sm:block"} onSubmit={submitSearch}>
              <div className="flex max-w-xl items-center gap-2.5 rounded-xl2 border border-line bg-canvas px-4 py-1.5 focus-within:border-ink">
                <Icon name="search" size={18} className="text-muted" />
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("staff.searchPlaceholder")} className="flex-1 bg-transparent py-1.5 text-sm outline-none" />
              </div>
            </form>
            <div className="ml-auto flex items-center gap-3">
              <LangToggle />
              <div className="hidden items-center gap-2 lg:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl2 border border-line bg-brown-tint text-xs font-bold text-brand">{initials}</span>
                <span className="text-[12.5px] font-semibold leading-tight">
                  {user.name}
                  <small className="block font-normal text-muted">{user.role}</small>
                </span>
              </div>
              <button onClick={() => nav("/")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                <Icon name="chevronLeft" size={15} />
                {t("staff.exit")}
              </button>
              <button onClick={logout} className="text-sm text-red hover:underline">
                {t("staff.signOut")}
              </button>
            </div>
          </div>

          {/* mobile search + horizontal nav (below md) */}
          <form className={isTech ? "hidden" : "px-4 pb-2.5 sm:hidden"} onSubmit={submitSearch}>
            <div className="flex items-center gap-2.5 rounded-xl2 border border-line bg-canvas px-4 py-1.5">
              <Icon name="search" size={18} className="text-muted" />
              <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("staff.searchPlaceholder")} className="flex-1 bg-transparent py-1.5 text-sm outline-none" />
            </div>
          </form>
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-2 md:hidden">
            {navItems.map((item) => (
              <NavItem key={item.key} item={item} />
            ))}
            <button
              onClick={() => setReportOpen(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm text-muted transition"
            >
              <Icon name="alert" size={16} />
              {t("bugReport.button")}
            </button>
          </nav>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 xl:px-8">
          {isTech ? (
            view === "allcases" ? <AllCases scope="all" readOnly /> : <AllCases scope="mine" />
          ) : view === "crm" ? (
            <CrmView query={query} />
          ) : (
            PANEL[view]
          )}
        </main>
        <Footer className="pb-6 md:hidden" />
      </div>

      <ReportBugDialog open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}

const DEV_ACCOUNTS = [
  { label: "Admin", name: "Admin", pin: "0001" },
  { label: "Staff", name: "Staff", pin: "0002" },
  { label: "Tech", name: "Tech", pin: "0003" },
];

function StaffLogin({ onSignIn, onCancel, t }: { onSignIn: (n: string, p: string) => Promise<void>; onCancel: () => void; t: (k: string) => string }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(n = name, p = pin) {
    if (!n || !p) {
      swalError(t("staff.signInFailed"), t("staff.enterNamePin"));
      return;
    }
    setBusy(true);
    try {
      await onSignIn(n, p);
      swalToast("success", `${t("staff.signIn")} · ${n}`);
    } catch (e) {
      swalError(t("staff.signInFailed"), e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Logo label={t("brand.supportCrm")} className="justify-center" />
          <LangToggle />
        </div>
        <div className="rounded-xl2 border border-line bg-card p-6">
          <h1 className="mb-4 text-xl font-bold">{t("staff.signInTitle")}</h1>
          <div className="space-y-3">
            <TextField label={t("staff.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <TextField label={t("staff.pin")} type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={onCancel}>
                {t("common.cancel")}
              </Button>
              <Button variant="brand" className="flex-1" onClick={() => submit()} disabled={busy}>
                {busy ? t("staff.signingIn") : t("staff.signIn")}
              </Button>
            </div>
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-4 rounded-xl2 border border-dashed border-amber-400/60 bg-amber-50/40 p-3 dark:bg-amber-950/20">
            <p className="mb-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200">DEV — Quick Access</p>
            <div className="flex gap-1.5">
              {DEV_ACCOUNTS.map((account) => (
                <button
                  key={account.name}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(account.name, account.pin)}
                  className="flex-1 rounded-lg border border-line bg-card px-2 py-1.5 text-xs font-medium transition-colors hover:border-brand hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Footer className="mt-6" />
      </div>
    </div>
  );
}
