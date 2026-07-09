import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TicketRow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { Chip, Empty, IconAction, MiniButton, Pager, RowActions, SearchBox, TableWrap, Toolbar } from "../../../components/staff/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";
import { usePaged } from "../../../lib/usePaged";
import { useSort } from "../../../lib/useSort";
import { STATUS_BUCKET, STATUS_LABEL } from "../../../lib/status";
import UpdateTicketModal from "./UpdateTicketModal";
import AnalysisModal from "./AnalysisModal";

const TYPES = [
  { key: "", labelKey: "mg.allTypes" },
  { key: "warranty", labelKey: "mg.tWarranty" },
  { key: "standard", labelKey: "mg.tStandard" },
  { key: "repair_claim", labelKey: "mg.tClaim" },
];
const BUCKETS = [
  { key: "", labelKey: "common.all" },
  { key: "incoming", labelKey: "mg.incoming" },
  { key: "ongoing", labelKey: "mg.ongoing" },
  { key: "closed", labelKey: "mg.closed" },
];

export default function AllCases({ scope = "all", readOnly = false }: { scope?: "all" | "mine"; readOnly?: boolean }) {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const isTech = user?.role === "tech";
  const { t: tr } = useI18n();
  const [type, setType] = useState("");
  const [bucket, setBucket] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<TicketRow | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", scope, type, q],
    queryFn: () => api.listTickets({ type: type || undefined, q: q || undefined, mine: scope === "mine" ? "1" : undefined }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tickets"] });

  async function deleteTicket(id: string) {
    const pin = await confirmAdminPin(tr("msg.adminConfirm"), tr("msg.confirmDeleteTicket"));
    if (!pin) return;
    try {
      await api.deleteTicket(id, pin);
      swalToast("success", tr("msg.deleted"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : tr("msg.error"));
    }
  }

  const rows = (data?.data ?? []).filter((t) => !bucket || STATUS_BUCKET[t.status ?? ""] === bucket);
  const { sort, toggleSort, sorted } = useSort(rows);
  const pg = usePaged(sorted);

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-2xl font-bold text-ink">{tr(scope === "mine" ? "tab.myCases" : "tab.cases")}</h2>

      <Toolbar>
        {TYPES.map((f) => (
          <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)}>
            {tr(f.labelKey)}
          </Chip>
        ))}
      </Toolbar>
      <Toolbar>
        {BUCKETS.map((b) => (
          <Chip key={b.key} active={bucket === b.key} onClick={() => setBucket(b.key)}>
            {tr(b.labelKey)}
          </Chip>
        ))}
        <SearchBox value={q} onChange={setQ} placeholder={tr("mg.searchCase")} />
        <div className="ml-auto flex gap-2">
          {!isTech && !readOnly && <MiniButton onClick={() => setShowAnalysis(true)}>{tr("mg.analysis")}</MiniButton>}
          {!isTech && !readOnly && <MiniButton onClick={() => api.downloadCsv("tickets")}>{tr("common.exportCsv")}</MiniButton>}
          <MiniButton onClick={refresh}>{tr("common.refresh")}</MiniButton>
        </div>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={8} cols={9} />
      ) : rows.length === 0 ? (
        <Empty>{tr("mg.noCases")}</Empty>
      ) : (
        <>
        <TableWrap
          minWidth="min-w-[840px]"
          sort={sort}
          onSort={toggleSort}
          cols={[
            { label: tr("mg.caseId"), w: "12%", sortKey: "ticketId" },
            { label: tr("mg.created"), w: "9%", sortKey: "createdAt" },
            { label: tr("cov.serial"), w: "13%", sortKey: "serial" },
            { label: tr("crm.customer"), w: "13%", sortKey: "name" },
            { label: tr("trk.issue"), w: "15%", sortKey: "issueType" },
            { label: tr("mg.type"), w: "9%", sortKey: "repairType" },
            { label: tr("mg.status"), w: "13%", sortKey: "status" },
            { label: tr("mg.assigned"), w: "8%", sortKey: "assignedTo" },
            { label: "", w: "8%", className: "text-right" },
          ]}
        >
          {pg.pageItems.map((row) => (
            <tr key={row.ticketId} className="border-b border-line/70 hover:bg-card">
              <td className="truncate whitespace-nowrap px-3 py-2 font-medium text-ink">{row.ticketId}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{row.createdAt?.slice(0, 10) ?? "—"}</td>
              <td className="truncate px-3 py-2" title={row.serial}>{row.serial}</td>
              <td className="truncate px-3 py-2" title={row.name ?? ""}>{row.name ?? "—"}</td>
              <td className="truncate px-3 py-2" title={row.issueType ?? ""}>{row.issueType ?? "—"}</td>
              <td className="truncate px-3 py-2 text-muted">{row.repairType ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">
                <span className="rounded-full bg-brown-tint px-2 py-0.5 text-xs text-brown">
                  {row.status && STATUS_LABEL[row.status] ? tr(`st.${row.status}`) : (row.status ?? "—")}
                </span>
              </td>
              <td className="truncate px-3 py-2 text-muted" title={row.assignedTo ?? ""}>{row.assignedTo ?? "—"}</td>
              <td className="px-3 py-2">
                {!readOnly && (
                  <RowActions>
                    <IconAction name="edit" label={tr("mg.update")} onClick={() => setEditing(row)} />
                    {isAdmin && <IconAction name="trash" tone="danger" label={tr("mg.delete")} onClick={() => deleteTicket(row.ticketId)} />}
                  </RowActions>
                )}
              </td>
            </tr>
          ))}
        </TableWrap>
        <Pager page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} count={pg.pageItems.length} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}

      <UpdateTicketModal ticket={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <AnalysisModal open={showAnalysis} onClose={() => setShowAnalysis(false)} />
    </div>
  );
}
