import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { Empty, StatCard, TableWrap } from "../../../components/staff/ui";
import { SkeletonCards, SkeletonTable } from "../../../components/Skeleton";
import { useSort } from "../../../lib/useSort";

export default function Today() {
  const { t } = useI18n();
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const { data: expiring } = useQuery({ queryKey: ["expiring"], queryFn: () => api.expiring(30) });
  const { data: activity } = useQuery({ queryKey: ["today-activity"], queryFn: api.todayActivity });
  const { sort, toggleSort, sorted } = useSort(expiring?.data ?? []);

  // Readable label for an action code; falls back to the prettified raw code.
  const actionLabel = (a: string) => {
    const l = t(`act.${a}`);
    return l.startsWith("act.") ? a.replace(/[._]/g, " ") : l;
  };

  if (isLoading)
    return (
      <div className="fade-in space-y-8">
        <SkeletonCards count={4} />
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  if (isError || !data) return <p className="text-sm text-red">{t("today.failed")}</p>;

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-2xl font-bold text-ink">{t("tab.today")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("today.needsAction")} value={data.needsAction} tone="red" />
        <StatCard label={t("today.inProgress")} value={data.inProgress} tone="brown" />
        <StatCard label={t("today.closedToday")} value={data.closedToday} tone="green" />
        <StatCard label={t("today.totalOpen")} value={data.totalOpen} tone="grey" />
      </div>

      {/* Today's activity feed — what happened in the system today */}
      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium text-ink">{t("today.activityTitle")}</h3>
        {!activity || activity.data.length === 0 ? (
          <Empty>{t("today.noActivity")}</Empty>
        ) : (
          <div className="overflow-hidden rounded-xl2 border border-line">
            {activity.data.map((a) => (
              <div key={a.id} className="flex items-start gap-3 border-b border-line/70 px-4 py-2.5 text-sm last:border-0 hover:bg-card">
                <span className="w-10 shrink-0 whitespace-nowrap font-mono text-xs text-muted">{a.timestamp?.slice(11, 16) ?? ""}</span>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-brown-tint px-2 py-0.5 text-xs text-brown">{actionLabel(a.action ?? "")}</span>
                <span className="min-w-0 flex-1 truncate text-ink" title={`${a.target ?? ""}${a.detail ? " · " + a.detail : ""}`}>
                  {a.target ?? "—"}
                  {a.detail && <span className="text-muted"> · {a.detail}</span>}
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted">{t("today.byUser")} {a.userName ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-medium text-ink">
          {t("today.expiringTitle")} <span className="text-muted">· {t("today.next30")}</span>
        </h3>
        {!expiring || expiring.data.length === 0 ? (
          <Empty>{t("today.noExpiring")}</Empty>
        ) : (
          <TableWrap
            minWidth="min-w-[600px]"
            sort={sort}
            onSort={toggleSort}
            cols={[
              { label: t("cov.serial"), w: "22%", sortKey: "serial" },
              { label: t("crm.product"), w: "26%", sortKey: "product" },
              { label: t("crm.customer"), w: "22%", sortKey: "name" },
              { label: t("crm.phone"), w: "16%", sortKey: "phone" },
              { label: t("cov.end"), w: "14%", sortKey: "expiryDate" },
            ]}
          >
            {sorted.map((w) => (
              <tr key={w.serial} className="border-b border-line/70 hover:bg-card">
                <td className="truncate px-3 py-2 font-medium text-ink" title={w.serial}>{w.serial}</td>
                <td className="truncate px-3 py-2" title={w.product ?? ""}>{w.product ?? "—"}</td>
                <td className="truncate px-3 py-2" title={w.name ?? ""}>{w.name ?? "—"}</td>
                <td className="truncate whitespace-nowrap px-3 py-2">{w.phone ?? "—"}</td>
                <td className="truncate whitespace-nowrap px-3 py-2 text-brown">{w.expiryDate ?? "—"}</td>
              </tr>
            ))}
          </TableWrap>
        )}
      </div>
    </div>
  );
}
