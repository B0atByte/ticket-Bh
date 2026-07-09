import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type WarrantyRow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useI18n } from "../../../lib/i18n";
import { Icon } from "../../../components/Icon";
import { Chip, Empty, IconAction, MiniButton, Pager, RowActions, SearchBox, TableWrap, Toolbar } from "../../../components/staff/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { safeHref } from "../../../lib/validate";
import { usePaged } from "../../../lib/usePaged";
import { useSort } from "../../../lib/useSort";
import ProductsModal from "./ProductsModal";
import WarrantyDetailModal from "./WarrantyDetailModal";

const TYPES = [
  { key: "", labelKey: "common.all" },
  { key: "normal", labelKey: "mg.normal" },
  { key: "replacement", labelKey: "mg.replacement" },
];

export default function Warranties() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [showProducts, setShowProducts] = useState(false);
  const [viewing, setViewing] = useState<WarrantyRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["warranties", type, q],
    queryFn: () => api.listWarranties({ type: type || undefined, q: q || undefined }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["warranties"] });
  const rows = data?.data ?? [];
  const addr = (w: WarrantyRow) =>
    [w.houseNo, w.building, w.subdistrict, w.district, w.province, w.postal].filter(Boolean).join(" ");

  // A registration is "NEW" if it arrived within the last 24 hours — so staff
  // can spot freshly-registered warranties at a glance.
  const isNew = (s: string | null) => {
    if (!s) return false;
    const ms = new Date(s.replace(" ", "T") + "Z").getTime();
    return !Number.isNaN(ms) && Date.now() - ms < 24 * 60 * 60 * 1000;
  };

  // Click a column header to sort; clicking again flips the direction.
  const { sort, toggleSort, sorted } = useSort(rows, (w: WarrantyRow, key) =>
    key === "address" ? addr(w) : (w as unknown as Record<string, unknown>)[key],
  );
  const pg = usePaged(sorted);

  async function clearAll() {
    const pin = await confirmAdminPin(t("msg.adminConfirm"), t("msg.confirmClearWarranties"));
    if (!pin) return;
    try {
      await api.clearWarranties(pin);
      swalToast("success", t("msg.cleared"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  async function deleteRow(id: string) {
    const pin = await confirmAdminPin(t("msg.adminConfirm"), t("msg.confirmDeleteWarranty"));
    if (!pin) return;
    try {
      await api.deleteWarranty(id, pin);
      swalToast("success", t("msg.deleted"));
      refresh();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-2xl font-bold text-ink">{t("tab.warranties")}</h2>

      <Toolbar>
        {TYPES.map((f) => (
          <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)}>
            {t(f.labelKey)}
          </Chip>
        ))}
        <SearchBox value={q} onChange={setQ} placeholder={t("mg.searchWarranty")} />
        <div className="ml-auto flex gap-2">
          <MiniButton onClick={() => setShowProducts(true)}>{t("mg.products")}</MiniButton>
          <MiniButton onClick={() => api.downloadCsv("warranties")}>{t("common.exportCsv")}</MiniButton>
          {isAdmin && (
            <MiniButton tone="danger" onClick={clearAll}>
              {t("mg.clearAll")}
            </MiniButton>
          )}
        </div>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={8} cols={10} />
      ) : rows.length === 0 ? (
        <Empty>{t("mg.noWarranties")}</Empty>
      ) : (
        <>
        <TableWrap
          minWidth="min-w-[860px]"
          sort={sort}
          onSort={toggleSort}
          cols={[
            { label: t("mg.registered"), w: "8%", sortKey: "registeredAt" },
            { label: t("mg.snStatus"), w: "12%", sortKey: "serial" },
            { label: t("crm.product"), w: "12%", sortKey: "product" },
            { label: t("mg.company"), w: "8%", sortKey: "company" },
            { label: t("mg.purchased"), w: "8%", sortKey: "purchaseDate" },
            { label: t("crm.customer"), w: "11%", sortKey: "name" },
            { label: t("crm.phone"), w: "9%", sortKey: "phone" },
            { label: t("crm.email"), w: "12%", sortKey: "email" },
            { label: t("mg.address"), w: "11%", sortKey: "address" },
            { label: t("mg.receipt"), w: "4%" },
            { label: isAdmin ? "" : "·", w: "5%", className: "text-right" },
          ]}
        >
          {pg.pageItems.map((w) => {
            const fresh = isNew(w.registeredAt);
            return (
            <tr key={w.id} onClick={() => setViewing(w)} className={`cursor-pointer border-b border-line/70 align-middle hover:bg-card ${fresh ? "bg-green-tint/40" : ""}`}>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted">{w.registeredAt?.slice(0, 10) ?? "—"}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-ink">{w.serial}</span>
                  {fresh && <span className="shrink-0 rounded-full bg-green-tint px-1.5 py-0.5 text-[10px] font-bold uppercase text-green">{t("mg.new")}</span>}
                </div>
                <div className="truncate text-xs text-muted">
                  {w.status}
                  {w.type === "replacement" && <span className="ml-1 text-brown">· {t("mg.replacement")}</span>}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="truncate" title={w.product ?? ""}>{w.product ?? "—"}</div>
              </td>
              <td className="px-3 py-2.5">
                <div className="truncate" title={w.company ?? ""}>{w.company ?? "—"}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted">{w.purchaseDate ?? "—"}</td>
              <td className="px-3 py-2.5">
                <div className="truncate" title={w.name ?? ""}>{w.name ?? "—"}</div>
              </td>
              <td className="truncate whitespace-nowrap px-3 py-2.5">{w.phone ?? "—"}</td>
              <td className="px-3 py-2.5">
                <div className="truncate" title={w.email ?? ""}>{w.email ?? "—"}</div>
              </td>
              <td className="px-3 py-2.5 text-muted">
                <div className="truncate" title={addr(w)}>{addr(w) || "—"}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5">
                {safeHref(w.receiptDriveUrl) ? (
                  <a
                    href={safeHref(w.receiptDriveUrl)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={t("mg.view")}
                    aria-label={t("mg.view")}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-muted transition hover:bg-card2 hover:text-brand"
                  >
                    <Icon name="file" size={16} />
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <RowActions>
                  {isAdmin && <IconAction name="trash" tone="danger" label={t("mg.delete")} onClick={() => deleteRow(w.id)} />}
                </RowActions>
              </td>
            </tr>
            );
          })}
        </TableWrap>
        <Pager page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} count={pg.pageItems.length} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}

      <ProductsModal open={showProducts} onClose={() => setShowProducts(false)} />
      <WarrantyDetailModal warranty={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
