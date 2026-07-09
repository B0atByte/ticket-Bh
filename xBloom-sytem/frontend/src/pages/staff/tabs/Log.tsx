import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n";
import { Empty, MiniButton, Pager, SearchBox, TableWrap, Toolbar } from "../../../components/staff/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { usePaged } from "../../../lib/usePaged";
import { useSort } from "../../../lib/useSort";

export default function Log() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["logs", q], queryFn: () => api.listLogs({ q: q || undefined, limit: 500 }) });

  const all = data?.data ?? [];
  const actions = Array.from(new Set(all.map((l) => l.action).filter(Boolean))) as string[];
  const filtered = action ? all.filter((l) => l.action === action) : all;
  const { sort, toggleSort, sorted } = useSort(filtered);
  const pg = usePaged(sorted, 50);

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-2xl font-bold text-ink">{t("mg.activityLog")}</h2>
      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={t("mg.searchLog")} />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-xl2 border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brown"
        >
          <option value="">{t("mg.allActions")}</option>
          {actions.sort().map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          <MiniButton onClick={() => qc.invalidateQueries({ queryKey: ["logs"] })}>{t("common.refresh")}</MiniButton>
        </div>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={10} cols={6} />
      ) : sorted.length === 0 ? (
        <Empty>{t("mg.noActivity")}</Empty>
      ) : (
        <>
          <TableWrap
            minWidth="min-w-[820px]"
            sort={sort}
            onSort={toggleSort}
            cols={[
              { label: t("mg.time"), w: "16%", sortKey: "timestamp" },
              { label: t("mg.user"), w: "11%", sortKey: "userName" },
              { label: t("mg.role"), w: "8%", sortKey: "userRole" },
              { label: t("mg.action"), w: "15%", sortKey: "action" },
              { label: t("mg.target"), w: "16%", sortKey: "target" },
              { label: t("mg.detail"), w: "34%" },
            ]}
          >
            {pg.pageItems.map((l) => (
              <tr key={l.id} className="border-b border-line/70 align-top hover:bg-card">
                <td className="truncate whitespace-nowrap px-3 py-2 text-muted">{l.timestamp ?? "—"}</td>
                <td className="truncate px-3 py-2" title={l.userName ?? ""}>{l.userName ?? "—"}</td>
                <td className="truncate px-3 py-2 text-muted">{l.userRole ?? "—"}</td>
                <td className="truncate px-3 py-2" title={l.action ?? ""}>{l.action ?? "—"}</td>
                <td className="truncate px-3 py-2" title={l.target ?? ""}>{l.target ?? "—"}</td>
                <td className="whitespace-normal break-words px-3 py-2 text-muted">{l.detail ?? "—"}</td>
              </tr>
            ))}
          </TableWrap>
          <Pager page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} count={pg.pageItems.length} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
    </div>
  );
}
