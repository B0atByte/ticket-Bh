import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TicketRow } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { Empty, IconAction, MiniButton, RowActions, TableWrap, Toolbar } from "../../../components/staff/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { downloadCsvRows } from "../../../lib/csv";
import { sortRows, useSortState } from "../../../lib/useSort";
import GlobalClaimModal from "./GlobalClaimModal";
import BackdatedModal from "./BackdatedModal";

const SECTIONS = [
  { key: "awaiting", titleKey: "mg.gPending" },
  { key: "accepted", titleKey: "mg.gConfirmed" },
  { key: "rejected", titleKey: "mg.gClosed" },
];

export default function GlobalClaims() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [month, setMonth] = useState("");
  const [editing, setEditing] = useState<TicketRow | null>(null);
  const [adding, setAdding] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["global-claims", month],
    queryFn: () => api.listGlobalClaims({ month: month || undefined }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["global-claims"] });

  const rows = data?.data ?? [];
  const { sort, toggleSort } = useSortState();
  const group = (key: string) => sortRows(rows.filter((r) => (r.globalClaimStatus ?? "") === key), sort);

  function exportMonthly() {
    downloadCsvRows(
      `global-claims-${month || "all"}.csv`,
      rows.map((r) => ({
        ticketId: r.ticketId,
        serial: r.serial,
        status: r.globalClaimStatus,
        oldMachine: r.gcOldMachine,
        newMachine: r.gcNewMachine,
        lot: r.gcLot,
        note: r.globalClaimNote,
        createdAt: r.createdAt,
      })),
    );
  }

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-2xl font-bold text-ink">{t("tab.global")}</h2>

      <Toolbar>
        <label className="text-sm text-muted">{t("mg.monthOpened")}</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl2 border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brown"
        />
        <div className="ml-auto flex gap-2">
          <MiniButton onClick={() => setAdding(true)}>{t("mg.addBackdated")}</MiniButton>
          <MiniButton onClick={exportMonthly}>{t("mg.exportMonthly")}</MiniButton>
          <MiniButton onClick={refresh}>{t("common.refresh")}</MiniButton>
        </div>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((sec) => {
            const list = group(sec.key);
            return (
              <div key={sec.key}>
                <h3 className="mb-2 text-sm font-medium text-ink">
                  {t(sec.titleKey)} <span className="text-muted">· {list.length}</span>
                </h3>
                {list.length === 0 ? (
                  <Empty>{t("mg.noneSection")}</Empty>
                ) : (
                  <TableWrap
                    minWidth="min-w-[760px]"
                    sort={sort}
                    onSort={toggleSort}
                    cols={[
                      { label: t("mg.caseId"), w: "16%", sortKey: "ticketId" },
                      { label: t("cov.serial"), w: "16%", sortKey: "serial" },
                      { label: t("mg.oldMachine"), w: "16%", sortKey: "gcOldMachine" },
                      { label: t("mg.newMachine"), w: "16%", sortKey: "gcNewMachine" },
                      { label: t("mg.lotPo"), w: "16%", sortKey: "gcLot" },
                      { label: t("mg.opened"), w: "12%", sortKey: "createdAt" },
                      { label: "", w: "8%", className: "text-right" },
                    ]}
                  >
                    {list.map((row) => (
                      <tr key={row.ticketId} className="border-b border-line/70 hover:bg-card">
                        <td className="truncate whitespace-nowrap px-3 py-2 font-medium text-ink">{row.ticketId}</td>
                        <td className="truncate px-3 py-2" title={row.serial}>{row.serial}</td>
                        <td className="truncate px-3 py-2 text-muted" title={row.gcOldMachine ?? ""}>{row.gcOldMachine ?? "—"}</td>
                        <td className="truncate px-3 py-2 text-muted" title={row.gcNewMachine ?? ""}>{row.gcNewMachine ?? "—"}</td>
                        <td className="truncate px-3 py-2" title={row.gcLot ?? ""}>{row.gcLot ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted">{row.createdAt?.slice(0, 10) ?? "—"}</td>
                        <td className="px-3 py-2">
                          <RowActions>
                            <IconAction name="edit" label={t("mg.update")} onClick={() => setEditing(row)} />
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </TableWrap>
                )}
              </div>
            );
          })}
        </div>
      )}

      <GlobalClaimModal ticket={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <BackdatedModal open={adding} onClose={() => setAdding(false)} onSaved={refresh} />
    </div>
  );
}
