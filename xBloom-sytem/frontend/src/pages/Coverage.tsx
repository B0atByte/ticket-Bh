import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type Coverage } from "../lib/api";
import { Banner, Button, Card, Field, PageTitle, TextField } from "../components/ui";
import { Icon } from "../components/Icon";
import { SkeletonCard } from "../components/Skeleton";
import ScanSerial from "../components/ScanSerial";
import { useI18n } from "../lib/i18n";

const pad2 = (n: number) => String(n).padStart(2, "0");
const DAY = 86_400_000;

/** Live remaining time down to the end of the expiry day. */
function remainingTo(expiryEndMs: number, nowMs: number) {
  const diff = expiryEndMs - nowMs;
  if (diff <= 0) return { expired: true, days: 0, hours: 0, mins: 0, secs: 0, diff };
  return {
    expired: false,
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
    diff,
  };
}

/** Calendar years / months / days between now and expiry (for a human summary). */
function calRemaining(now: Date, expiry: Date) {
  let y = expiry.getFullYear() - now.getFullYear();
  let mo = expiry.getMonth() - now.getMonth();
  let d = expiry.getDate() - now.getDate();
  if (d < 0) {
    mo -= 1;
    d += new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }
  if (mo < 0) {
    y -= 1;
    mo += 12;
  }
  return { y: Math.max(0, y), mo: Math.max(0, mo), d: Math.max(0, d) };
}

type Tone = "green" | "amber" | "red";
// Note: the theme's `brown` is aliased to the brand green, so the caution tier
// uses the orange `accent` instead — clearly distinct from the green/red tiers.
const TONE: Record<Tone, { panel: string; text: string; bar: string }> = {
  green: { panel: "bg-green-tint", text: "text-green", bar: "bg-green2" },
  amber: { panel: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
  red: { panel: "bg-red-tint", text: "text-red", bar: "bg-red" },
};

export default function CoveragePage() {
  const { t } = useI18n();
  const [serial, setSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Coverage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  // Ticking clock so the countdown updates every second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function check(value?: string) {
    const s = (value ?? serial).trim();
    if (!s) {
      setError(t("cov.enterSerial"));
      return;
    }
    setError("");
    setResult(null);
    setNotFound(false);
    setLoading(true);
    try {
      setResult(await api.coverage(s));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <PageTitle title={t("cov.title")} subtitle={t("cov.subtitle")} />

      <Card>
        <div className="space-y-3">
          <TextField
            label={t("cov.serial")}
            value={serial}
            placeholder="J15A01BXXX"
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            error={error}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => check()} disabled={loading}>
              {loading ? t("common.loading") : t("cov.check")}
            </Button>
            <ScanSerial onResult={(sn) => { setSerial(sn); check(sn); }} />
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {loading && <SkeletonCard lines={4} />}
        {result && <CoverageResult c={result} now={now} t={t} />}

        {notFound && (
          <Card>
            <Banner kind="info">{t("cov.notFound")}</Banner>
            <Link to="/warranty/register" className="mt-3 block">
              <Button className="w-full">{t("cov.registerNow")}</Button>
            </Link>
          </Card>
        )}

        {error && !notFound && <Banner kind="error">{error}</Banner>}
      </div>
    </div>
  );
}

function CoverageResult({ c, now, t }: { c: Coverage; now: number; t: (k: string, v?: Record<string, string | number>) => string }) {
  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 font-mono text-sm font-medium text-ink">
        <Icon name="shield" size={18} className="shrink-0 text-brand" />
        {c.serial}
      </span>
      {c.noWarranty ? (
        <Badge tone="grey">{t("cov.noWarranty")}</Badge>
      ) : c.active ? (
        <Badge tone="green">{t("cov.active")}</Badge>
      ) : (
        <Badge tone="red">{t("cov.expired")}</Badge>
      )}
    </div>
  );

  // ── No-warranty unit ──────────────────────────────────
  if (c.noWarranty) {
    return (
      <Card>
        {header}
        <div className="mt-4 rounded-xl2 bg-card2 p-5 text-center">
          <Icon name="info" size={26} className="mx-auto text-muted" />
          <p className="mt-2 text-sm font-medium text-ink">{t("cov.noWarrantyTitle")}</p>
          <p className="mt-1 text-xs text-muted">{t("cov.noWarrantyDesc")}</p>
        </div>
        <dl className="mt-3 text-sm">
          <Field k={t("cov.model")} v={c.product} />
        </dl>
      </Card>
    );
  }

  const expiry = c.expiryDate ? new Date(`${c.expiryDate}T23:59:59`) : null;
  const start = c.warrantyStart ? new Date(`${c.warrantyStart}T00:00:00`) : null;

  // ── Expired ───────────────────────────────────────────
  if (!c.active || !expiry || expiry.getTime() <= now) {
    const ago = expiry ? Math.max(0, Math.floor((now - expiry.getTime()) / DAY)) : 0;
    return (
      <Card>
        {header}
        {c.product && <p className="mt-1 text-xs text-muted">{c.product}</p>}
        <div className="mt-4 rounded-xl2 bg-red-tint p-5 text-center">
          <Icon name="alert" size={26} className="mx-auto text-red" />
          <p className="mt-2 text-sm font-medium text-red">{t("cov.expiredTitle")}</p>
          <p className="mt-1 text-xs text-red/80">{t("cov.expiredAgo", { date: c.expiryDate ?? "—", n: ago })}</p>
        </div>
        <dl className="mt-3 text-sm">
          <Field k={t("cov.model")} v={c.product} />
          <Field k={t("cov.start")} v={c.warrantyStart} />
          <Field k={t("cov.end")} v={c.expiryDate} />
        </dl>
        <Link to="/support" className="mt-3 block">
          <Button variant="secondary" className="w-full">{t("cov.reportIssue")}</Button>
        </Link>
      </Card>
    );
  }

  // ── Active: live countdown ────────────────────────────
  const rem = remainingTo(expiry.getTime(), now);
  const tone: Tone = rem.days > 90 ? "green" : rem.days >= 30 ? "amber" : "red";
  const T = TONE[tone];
  const cal = calRemaining(new Date(now), expiry);

  // Warranty-period progress (elapsed share of start→expiry).
  let usedPct = 0;
  if (start) {
    const total = expiry.getTime() - start.getTime();
    usedPct = total > 0 ? Math.min(100, Math.max(0, Math.round(((now - start.getTime()) / total) * 100))) : 0;
  }

  const cells: [number, string][] = [
    [rem.days, t("cov.days")],
    [rem.hours, t("cov.hours")],
    [rem.mins, t("cov.mins")],
    [rem.secs, t("cov.secs")],
  ];

  return (
    <Card>
      {header}
      {c.product && <p className="mt-1 text-xs text-muted">{c.product}</p>}

      {/* HERO live countdown */}
      <div className={`mt-4 rounded-xl2 ${T.panel} p-5`}>
        <div className={`flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wide ${T.text}`}>
          <Icon name="clock" size={14} />
          {t("cov.remainingTitle")}
        </div>
        <div className="mt-3 flex items-stretch justify-center gap-2 sm:gap-3">
          {cells.map(([n, label], i) => (
            <div key={label} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && <span className={`font-serif text-2xl font-light ${T.text} opacity-40`}>:</span>}
              <div className="flex w-12 flex-col items-center sm:w-14">
                <span className={`font-serif text-4xl font-light tabular-nums ${T.text} sm:text-5xl`}>
                  {i === 0 ? n : pad2(n)}
                </span>
                <span className={`text-[10px] uppercase tracking-wide ${T.text} opacity-70`}>{label}</span>
              </div>
            </div>
          ))}
        </div>
        {/* calendar summary */}
        <p className={`mt-3 text-center text-xs ${T.text} opacity-80`}>
          {t("cov.calSummary", { y: cal.y, mo: cal.mo, d: cal.d })}
        </p>
      </div>

      {/* warranty-period progress */}
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>{t("cov.usedPct", { pct: usedPct })}</span>
          <span>{t("cov.leftPct", { pct: 100 - usedPct })}</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-card2">
          <div className={`h-full rounded-full ${T.bar}`} style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      {/* detail */}
      <dl className="mt-4 text-sm">
        <Field k={t("cov.model")} v={c.product} />
        <Field k={t("cov.start")} v={c.warrantyStart} />
        <Field k={t("cov.end")} v={c.expiryDate} />
        <Field k={t("cov.remainingDays")} v={t("cov.daysValue", { n: rem.days })} />
      </dl>
    </Card>
  );
}

function Badge({ tone, children }: { tone: "green" | "red" | "grey"; children: React.ReactNode }) {
  const cls = {
    green: "bg-green-tint text-green",
    red: "bg-red-tint text-red",
    grey: "bg-card2 text-muted",
  }[tone];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${cls}`}>{children}</span>;
}
