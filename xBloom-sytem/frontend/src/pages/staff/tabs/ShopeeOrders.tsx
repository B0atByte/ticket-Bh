import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ShopeeOrderRow } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useI18n } from "../../../lib/i18n";
import { downloadCsvRows } from "../../../lib/csv";
import { confirmAdminPin, swalError, swalToast } from "../../../lib/swal";
import { Empty, IconAction, MiniButton, Pager, RowActions, SearchBox, TableWrap, Toolbar } from "../../../components/staff/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { Icon } from "../../../components/Icon";
import { usePaged } from "../../../lib/usePaged";
import { useSort } from "../../../lib/useSort";

const money = (v: string | null) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ShopeeOrders() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const [showSetup, setShowSetup] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ["shopee-orders"], queryFn: () => api.listShopeeOrders() });
  const { data: status } = useQuery({ queryKey: ["shopee-status"], queryFn: () => api.shopeeStatus() });

  // The exact URL to paste into the extension popup — derived from the page the
  // staff is actually using, so LAN users get their own host (no IP guessing).
  const backendUrl = `${window.location.origin}/api`;
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(backendUrl);
      swalToast("success", t("shopee.copied"));
    } catch {
      swalError(t("common.error"), backendUrl);
    }
  }

  const all = data?.data ?? [];
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? all.filter((o) =>
        [o.orderNo, o.buyerName, o.trackingNo, o.productName, o.courier]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle)),
      )
    : all;
  const { sort, toggleSort, sorted } = useSort(filtered);
  const pg = usePaged(sorted, 25);

  async function remove(o: ShopeeOrderRow) {
    const pin = await confirmAdminPin(t("shopee.deleteTitle"), t("shopee.deleteText"));
    if (!pin) return;
    try {
      await api.deleteShopeeOrder(o.id, pin);
      swalToast("success", t("shopee.deleted"));
      qc.invalidateQueries({ queryKey: ["shopee-orders"] });
    } catch (e) {
      swalError(t("common.error"), e instanceof Error ? e.message : "");
    }
  }

  function exportCsv() {
    if (sorted.length === 0) return;
    const rows = sorted.map((o) => ({
      "Order No": o.orderNo,
      "Order Date": o.orderDate ?? "",
      Buyer: o.buyerName ?? "",
      "Tracking No": o.trackingNo ?? "",
      Courier: o.courier ?? "",
      Product: o.productName ?? "",
      Qty: o.qty ?? "",
      "Sale Price": o.salePrice ?? "",
      "Net Income": o.netIncome ?? "",
      Address: o.address ?? "",
      Screenshot: o.screenshotUrl ?? "",
      "Saved At": o.savedAt ?? "",
    }));
    downloadCsvRows(`shopee-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="fade-in">
      <h2 className="mb-1 text-2xl font-bold text-ink">{t("shopee.title")}</h2>
      <p className="mb-4 text-sm text-muted">{t("shopee.subtitle")}</p>

      {/* status panel: Google Sheet link state + how data arrives */}
      <div className="mb-5 rounded-xl2 border border-line bg-card p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status?.sheetEnabled ? "bg-green2" : "bg-grey"}`} />
            {status?.sheetEnabled ? t("shopee.sheetOn") : t("shopee.sheetOff")}
          </span>
          {status?.sheetEnabled && status.sheetUrl && (
            <a href={status.sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand hover:underline">
              <Icon name="external" size={15} />
              {t("shopee.openSheet")}
            </a>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">{t("shopee.howto")}</p>
        <button onClick={() => setShowSetup((v) => !v)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          <Icon name={showSetup ? "chevronLeft" : "chevronRight"} size={14} />
          {t("shopee.setupToggle")}
        </button>

        {showSetup && (
          <div className="mt-3 border-t border-line pt-3 text-sm">
            <p className="mb-2 text-xs text-muted">{t("shopee.setupIntro")}</p>
            <label className="mb-1 block text-xs font-medium text-ink2">{t("shopee.backendUrl")}</label>
            <div className="mb-3 flex items-center gap-2">
              <code className="flex-1 truncate rounded-xl2 border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">{backendUrl}</code>
              <button onClick={copyUrl} className="inline-flex items-center gap-1.5 rounded-xl2 border border-line bg-white px-3 py-2 text-xs text-ink hover:bg-card" title={t("shopee.copy")}>
                <Icon name="copy" size={14} />
                {t("shopee.copy")}
              </button>
            </div>
            <ol className="list-decimal space-y-1.5 pl-5 text-xs text-ink2">
              <li>{t("shopee.step1")}</li>
              <li>{t("shopee.step2")}</li>
              <li>{t("shopee.step3")}</li>
              <li>{t("shopee.step4")}</li>
            </ol>
          </div>
        )}
      </div>

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder={t("shopee.search")} />
        <div className="ml-auto flex items-center gap-2">
          <MiniButton onClick={exportCsv}>{t("common.exportCsv")}</MiniButton>
          <MiniButton onClick={() => qc.invalidateQueries({ queryKey: ["shopee-orders"] })}>{t("common.refresh")}</MiniButton>
        </div>
      </Toolbar>

      {isLoading ? (
        <SkeletonTable rows={10} cols={7} />
      ) : sorted.length === 0 ? (
        <Empty>{t("shopee.empty")}</Empty>
      ) : (
        <>
          <TableWrap
            minWidth="min-w-[1000px]"
            sort={sort}
            onSort={toggleSort}
            cols={[
              { label: t("shopee.colOrderNo"), w: "13%", sortKey: "orderNo" },
              { label: t("shopee.colDate"), w: "11%", sortKey: "orderDate" },
              { label: t("shopee.colBuyer"), w: "12%", sortKey: "buyerName" },
              { label: t("shopee.colTracking"), w: "12%", sortKey: "trackingNo" },
              { label: t("shopee.colProduct"), w: "20%", sortKey: "productName" },
              { label: t("shopee.colQty"), w: "5%", sortKey: "qty", className: "text-right" },
              { label: t("shopee.colSale"), w: "9%", sortKey: "salePrice", className: "text-right" },
              { label: t("shopee.colNet"), w: "9%", sortKey: "netIncome", className: "text-right" },
              { label: "", w: "9%", className: "text-right" },
            ]}
          >
            {pg.pageItems.map((o) => (
              <tr key={o.id} className="border-b border-line/70 align-top hover:bg-card">
                <td className="truncate px-3 py-2 font-mono text-xs" title={o.orderNo}>{o.orderNo}</td>
                <td className="truncate whitespace-nowrap px-3 py-2 text-muted">{o.orderDate ?? "—"}</td>
                <td className="truncate px-3 py-2" title={o.buyerName ?? ""}>{o.buyerName ?? "—"}</td>
                <td className="truncate px-3 py-2 font-mono text-xs" title={o.trackingNo ?? ""}>{o.trackingNo ?? "—"}</td>
                <td className="truncate px-3 py-2" title={o.productName ?? ""}>{o.productName ?? "—"}</td>
                <td className="px-3 py-2 text-right text-muted">{o.qty ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{money(o.salePrice)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{money(o.netIncome)}</td>
                <td className="px-3 py-2">
                  <RowActions>
                    {o.screenshotUrl && (
                      <a href={o.screenshotUrl} target="_blank" rel="noreferrer" title={t("shopee.screenshot")} aria-label={t("shopee.screenshot")} className="inline-flex items-center justify-center rounded-md p-1.5 text-muted transition hover:bg-card2 hover:text-ink">
                        <Icon name="camera" size={16} />
                      </a>
                    )}
                    {o.pageUrl && (
                      <a href={o.pageUrl} target="_blank" rel="noreferrer" title={t("shopee.openOrder")} aria-label={t("shopee.openOrder")} className="inline-flex items-center justify-center rounded-md p-1.5 text-muted transition hover:bg-card2 hover:text-ink">
                        <Icon name="external" size={16} />
                      </a>
                    )}
                    {user?.role === "admin" && <IconAction name="trash" label={t("common.delete")} tone="danger" onClick={() => remove(o)} />}
                  </RowActions>
                </td>
              </tr>
            ))}
          </TableWrap>
          <Pager page={pg.page} pageCount={pg.pageCount} pageSize={pg.pageSize} total={pg.total} start={pg.start} count={pg.pageItems.length} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
    </div>
  );
}
