import type { ReactNode } from "react";
import { type WarrantyRow } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Button } from "../../../components/ui";
import { Icon } from "../../../components/Icon";
import { safeHref } from "../../../lib/validate";
import { useI18n } from "../../../lib/i18n";

/** Read-only detail view for a warranty registration (opened by clicking a row). */
function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line/60 py-2 last:border-0">
      <dt className="w-36 shrink-0 text-sm text-muted">{k}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm text-ink">{v ? v : <span className="text-muted">—</span>}</dd>
    </div>
  );
}

export default function WarrantyDetailModal({ warranty, onClose }: { warranty: WarrantyRow | null; onClose: () => void }) {
  const { t } = useI18n();
  if (!warranty) return null;
  const w = warranty;
  const addr = [w.houseNo, w.building, w.subdistrict, w.district, w.province, w.postal].filter(Boolean).join(" ");
  const active = w.expiryDate ? w.expiryDate >= new Date().toISOString().slice(0, 10) : false;

  return (
    <Modal open={!!warranty} title={t("mg.warrantyDetail")} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-bold text-ink">{w.serial}</span>
        {w.type === "replacement" && <span className="rounded-full bg-brown-tint px-2 py-0.5 text-xs text-brown">{t("mg.replacement")}</span>}
        {w.expiryDate &&
          (active ? (
            <span className="rounded-full bg-green-tint px-2 py-0.5 text-xs text-green">{t("cov.active")}</span>
          ) : (
            <span className="rounded-full bg-red-tint px-2 py-0.5 text-xs text-red">{t("cov.expired")}</span>
          ))}
      </div>

      <dl>
        <Row k={t("crm.product")} v={w.product} />
        <Row k={t("mg.company")} v={w.company} />
        <Row k={t("mg.purchased")} v={w.purchaseDate} />
        <Row k={t("cov.end")} v={w.expiryDate} />
        <Row k={t("crm.customer")} v={w.name} />
        <Row k={t("crm.phone")} v={w.phone} />
        <Row k={t("crm.email")} v={w.email} />
        <Row k={t("mg.address")} v={addr} />
        <Row k={t("mg.status")} v={w.status} />
        <Row k={t("mg.registered")} v={w.registeredAt?.slice(0, 16)} />
        {w.type === "replacement" && <Row k={t("mg.replacement")} v={w.replacementOf} />}
        <Row
          k={t("mg.receipt")}
          v={
            safeHref(w.receiptDriveUrl) ? (
              <a href={safeHref(w.receiptDriveUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand hover:underline">
                <Icon name="file" size={15} />
                {t("mg.view")}
              </a>
            ) : null
          }
        />
      </dl>

      <div className="mt-5">
        <Button variant="secondary" className="w-full" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </Modal>
  );
}
