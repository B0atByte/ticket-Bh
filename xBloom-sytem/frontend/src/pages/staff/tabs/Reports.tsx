import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ReportData } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { Empty } from "../../../components/staff/ui";
import { SkeletonCards } from "../../../components/Skeleton";

type Tone = "brand" | "green" | "accent" | "red" | "grey";
const DOT: Record<Tone, string> = {
  brand: "bg-brand",
  green: "bg-green2",
  accent: "bg-accent",
  red: "bg-red",
  grey: "bg-grey",
};
const BAR: Record<Tone, string> = {
  brand: "bg-brand",
  green: "bg-green2",
  accent: "bg-accent",
  red: "bg-red",
  grey: "bg-grey",
};

// A metric card that allows a string value + unit + sub-label (StatCard is number-only).
function Metric({ label, value, unit, sub, tone = "grey" }: { label: string; value: string; unit?: string; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-xl2 border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-4xl font-light text-ink">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function BarList({ rows }: { rows: { label: string; n: number; tone: Tone }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-ink">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card2">
            <div className={`h-full rounded-full ${BAR[r.tone]}`} style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-medium text-ink">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function Trend({ data }: { data: ReportData["monthly"] }) {
  const { t } = useI18n();
  const max = Math.max(1, ...data.flatMap((m) => [m.created, m.closed]));
  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
        {data.map((m) => (
          <div key={m.ym} className="flex flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div className="w-1/3 rounded-t bg-brand" style={{ height: `${(m.created / max) * 100}%` }} title={`${m.created}`} />
              <div className="w-1/3 rounded-t bg-accent" style={{ height: `${(m.closed / max) * 100}%` }} title={`${m.closed}`} />
            </div>
            <span className="text-[10px] text-muted">{m.ym.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> {t("rep.created")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> {t("rep.closed")}
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl2 border border-line bg-card p-5">
      <h3 className="mb-4 text-sm font-medium text-ink">{title}</h3>
      {children}
    </div>
  );
}

export default function Reports() {
  const { t } = useI18n();
  const [slaDays, setSlaDays] = useState(7);
  const { data, isLoading, isError } = useQuery({ queryKey: ["reports", slaDays], queryFn: () => api.reports(slaDays) });

  if (isLoading)
    return (
      <div className="fade-in space-y-8">
        <SkeletonCards count={4} />
        <SkeletonCards count={2} />
      </div>
    );
  if (isError || !data) return <p className="text-sm text-red">{t("rep.failed")}</p>;

  const statusTone: Record<string, Tone> = {
    new: "red",
    diagnose: "accent",
    quote: "accent",
    approved: "brand",
    repairing: "brand",
    repair_done: "brand",
    returned: "green",
    closed: "grey",
    guide_customer: "brand",
    awaiting_global: "accent",
    receive_machine: "brand",
  };
  const statusRows = data.byStatus
    .filter((r) => r.n > 0)
    .map((r) => ({ label: t(`st.${r.status}`) === `st.${r.status}` ? r.status : t(`st.${r.status}`), n: r.n, tone: statusTone[r.status] ?? "grey" }));
  const typeRows = data.byType
    .filter((r) => r.n > 0)
    .map((r) => ({ label: t(`ty.${r.type}`) === `ty.${r.type}` ? r.type : t(`ty.${r.type}`), n: r.n, tone: "brand" as Tone }));

  return (
    <div className="fade-in space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-ink">{t("tab.reports")}</h2>
          <p className="mt-0.5 text-sm text-muted">{t("rep.opsTitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          {t("rep.slaTarget")}
          <select
            value={slaDays}
            onChange={(e) => setSlaDays(Number(e.target.value))}
            className="rounded-xl2 border border-line bg-white px-2 py-1.5 text-ink outline-none focus:border-brown"
          >
            {[3, 7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {t("rep.slaDays", { n })}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* headline SLA metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t("rep.avgResolution")}
          value={data.resolution.avgDays == null ? "—" : String(data.resolution.avgDays)}
          unit={data.resolution.avgDays == null ? undefined : t("rep.days")}
          sub={t("rep.fromClosed", { n: data.resolution.closedCount })}
          tone="brand"
        />
        <Metric
          label={t("rep.onTimeRate")}
          value={data.sla.onTimeRate == null ? "—" : `${data.sla.onTimeRate}%`}
          sub={t("rep.onTimeSub", { onTime: data.sla.onTime, total: data.sla.closedCount })}
          tone="green"
        />
        <Metric
          label={t("rep.breached")}
          value={String(data.sla.breached)}
          sub={t("rep.breachedSub", { n: data.slaDays })}
          tone={data.sla.breached > 0 ? "red" : "grey"}
        />
        <Metric label={t("rep.openTotal")} value={String(data.open.total)} tone="grey" />
      </div>

      {/* aging */}
      <Section title={t("rep.aging")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["rep.fresh", data.open.fresh, "green"],
            ["rep.week", data.open.week, "brand"],
            ["rep.twoWeek", data.open.twoWeek, "accent"],
            ["rep.stale", data.open.stale, "red"],
          ] as [string, number, Tone][]).map(([k, n, tone]) => (
            <div key={k} className="rounded-xl2 border border-line bg-canvas p-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
                <span className="text-xs text-muted">{t(k)}</span>
              </div>
              <div className="mt-1 text-2xl font-light text-ink">{n}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("rep.byStatus")}>{statusRows.length ? <BarList rows={statusRows} /> : <Empty>{t("rep.none")}</Empty>}</Section>
        <Section title={t("rep.byType")}>{typeRows.length ? <BarList rows={typeRows} /> : <Empty>{t("rep.none")}</Empty>}</Section>
      </div>

      {/* trend + expiring */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t("rep.trend")}>
          <Trend data={data.monthly} />
        </Section>
        <Section title={t("rep.expiring")}>
          <div className="grid grid-cols-3 gap-3">
            {([
              [30, data.expiring.d30, "green"],
              [60, data.expiring.d60, "brand"],
              [90, data.expiring.d90, "accent"],
            ] as [number, number, Tone][]).map(([days, n, tone]) => (
              <div key={days} className="rounded-xl2 border border-line bg-canvas p-3 text-center">
                <div className="text-2xl font-light text-ink">{n}</div>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted">
                  <span className={`h-2 w-2 rounded-full ${DOT[tone]}`} />
                  {t("rep.within", { n: days })}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
