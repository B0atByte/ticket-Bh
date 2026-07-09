import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type MachineRow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useI18n } from "../../../lib/i18n";
import { Empty, IconAction, MiniButton, Pager, RowActions, SearchBox, TableWrap, Toolbar } from "../../../components/staff/ui";
import { Icon, type IconName } from "../../../components/Icon";
import { SkeletonTable } from "../../../components/Skeleton";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { downloadCsvRows } from "../../../lib/csv";
import { usePaged } from "../../../lib/usePaged";
import { useSort } from "../../../lib/useSort";
import AssetModal from "./AssetModal";
import ReplaceModal from "./ReplaceModal";

// Asset-type → icon + full label (SVG icon, never emoji — per design rules).
const ASSET_META: Record<string, { icon: IconName; key: string }> = {
  store: { icon: "store", key: "at.store" },
  claim_fixed: { icon: "tool", key: "at.claim_fixed" },
  subscription: { icon: "recycle", key: "at.subscription" },
};

const CARD_KEYS = ["", "store", "claim_fixed", "subscription"] as const;

/** Format a YYYY-MM-DD(…) string as a Thai Buddhist-era date, e.g. 25/6/2569. */
function fmtBE(s?: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  if (!y || !m || !d) return s;
  return `${Number(d)}/${Number(m)}/${Number(y) + 543}`;
}

export default function Assets() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [assetType, setAssetType] = useState<string>("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MachineRow | null>(null);
  const [replacing, setReplacing] = useState<MachineRow | null>(null);
  const [adding, setAdding] = useState(false);

  // Fetch the full registry once; filter + count on the client for the cards.
  const { data, isLoading } = useQuery({ queryKey: ["machines"], queryFn: () => api.listMachines({}) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["machines"] });

  const all = data?.data ?? [];
  const count = (key: string) => (key ? all.filter((m) => m.assetType === key).length : all.length);

  const needle = q.trim().toLowerCase();
  const rows = all.filter((m) => {
    if (assetType && m.assetType !== assetType) return false;
    if (!needle) return true;
    return [m.serial, m.customerName, m.location, m.product].some((v) => v && String(v).toLowerCase().includes(needle));
  });

  const { sort, toggleSort, sorted } = useSort(rows, (m: MachineRow, key) => {
    if (key === "custLocation") return m.customerName ?? m.location ?? "";
    if (key === "warranty") return m.warrantyEnd ?? m.warrantyStart ?? "";
    return (m as unknown as Record<string, unknown>)[key];
  });
  const pg = usePaged(sorted);

  const warranty = (m: MachineRow) =>
    m.noWarranty === 1 ? t("cov.noWarranty") : [m.warrantyStart, m.warrantyEnd].filter(Boolean).map(fmtBE).join(" → ") || "—";

  async function del(m: MachineRow) {
    const pin = await confirmAdminPin(t("msg.adminConfirm"), t("mg.confirmDeleteAsset"));
    if (!pin) return;
    try {
      await api.deleteMachine(m.serial, pin);
      swalToast("success", t("mg.assetDeleted"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  // Export the rows currently shown (after filter + search).
  function exportCsv() {
    if (sorted.length === 0) return;
    const csvRows = sorted.map((m, i) => ({
      "#": i + 1,
      "S/N": m.serial,
      Product: m.product ?? "",
      "Asset Type": m.assetType ?? "",
      "Customer / Location": m.customerName ?? m.location ?? "",
      "Warranty Start": m.warrantyStart ?? "",
      "Warranty End": m.warrantyEnd ?? "",
      "No Warranty": m.noWarranty === 1 ? "yes" : "",
      Note: m.notes ?? "",
      Updated: fmtBE(m.updatedAt),
    }));
    downloadCsvRows(`assets-${new Date().toISOString().slice(0, 10)}.csv`, csvRows);
  }

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">{t("tab.assets")}</h2>
        <div className="flex gap-2">
          <MiniButton onClick={() => setAdding(true)}>{t("mg.addAsset")}</MiniButton>
          <MiniButton onClick={exportCsv}>{t("common.exportCsv")}</MiniButton>
          <MiniButton onClick={refresh}>{t("common.refresh")}</MiniButton>
        </div>
      </div>

      {/* Filter cards with live counts */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARD_KEYS.map((key) => {
          const active = assetType === key;
          const label = key === "" ? t("common.all") : t(`mg.${key === "claim_fixed" ? "claimFixed" : key}`);
          return (
            <button
              key={key || "all"}
              onClick={() => setAssetType(key)}
              className={`rounded-xl2 border p-4 text-left transition ${
                active ? "border-ink bg-ink text-white" : "border-line bg-card hover:bg-canvas"
              }`}
            >
              <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wide ${active ? "text-white/70" : "text-muted"}`}>
                {key && <Icon name={ASSET_META[key].icon} size={14} />}
                {label}
              </div>
              <div className="mt-1 font-serif text-3xl font-light">{count(key)}</div>
            </button>
          );
        })}
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={t("mg.searchAssetPh")} />
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={8} cols={9} />
      ) : rows.length === 0 ? (
        <Empty>{t("mg.noAssets")}</Empty>
      ) : (
        <>
          <TableWrap
            minWidth="min-w-[900px]"
            sort={sort}
            onSort={toggleSort}
            cols={[
              { label: "#", w: "4%" },
              { label: t("mg.sn"), w: "13%", sortKey: "serial" },
              { label: t("crm.product"), w: "15%", sortKey: "product" },
              { label: t("mg.assetType"), w: "13%", sortKey: "assetType" },
              { label: t("mg.custLocation"), w: "13%", sortKey: "custLocation" },
              { label: t("mg.warranty"), w: "14%", sortKey: "warranty" },
              { label: t("mg.note"), w: "12%", sortKey: "notes" },
              { label: t("mg.updated"), w: "8%", sortKey: "updatedAt" },
              { label: "", w: "8%", className: "text-right" },
            ]}
          >
            {pg.pageItems.map((m, idx) => {
              const meta = m.assetType ? ASSET_META[m.assetType] : null;
              return (
                <tr key={m.serial} className="border-b border-line/70 hover:bg-card">
                  <td className="px-3 py-2 text-muted">{pg.start + idx + 1}</td>
                  <td className="truncate px-3 py-2 font-mono text-xs font-medium text-ink" title={m.serial}>{m.serial}</td>
                  <td className="truncate px-3 py-2" title={m.product ?? ""}>{m.product ?? "—"}</td>
                  <td className="truncate px-3 py-2">
                    {meta ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-muted">
                        <Icon name={meta.icon} size={15} />
                        {t(meta.key)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="truncate px-3 py-2" title={m.customerName ?? m.location ?? ""}>{m.customerName ?? m.location ?? "—"}</td>
                  <td className="truncate px-3 py-2" title={warranty(m)}>{warranty(m)}</td>
                  <td className="truncate px-3 py-2 text-muted" title={m.notes ?? ""}>{m.notes ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtBE(m.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <RowActions>
                      <IconAction name="edit" label={t("mg.edit")} onClick={() => setEditing(m)} />
                      {m.noWarranty !== 1 && <IconAction name="swap" label={t("mg.replace")} onClick={() => setReplacing(m)} />}
                      {isAdmin && <IconAction name="trash" tone="danger" label={t("mg.delete")} onClick={() => del(m)} />}
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </TableWrap>
          <Pager page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} count={pg.pageItems.length} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}

      {adding && <AssetModal asset={null} open={adding} onClose={() => setAdding(false)} onSaved={refresh} />}
      {editing && <AssetModal asset={editing} open={!!editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <ReplaceModal asset={replacing} onClose={() => setReplacing(null)} onSaved={refresh} />
    </div>
  );
}
