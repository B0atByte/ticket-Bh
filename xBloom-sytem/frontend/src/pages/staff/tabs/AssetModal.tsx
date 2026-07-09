import { useState } from "react";
import { api, type MachineRow } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Banner, Button, SelectField, TextArea, TextField } from "../../../components/ui";
import { swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";

const ASSET_TYPES = [
  { value: "store", labelKey: "mg.store" },
  { value: "claim_fixed", labelKey: "mg.claimFixed" },
  { value: "subscription", labelKey: "mg.subscription" },
];
const SOURCES = [
  { value: "new", labelKey: "mg.srcNew" },
  { value: "from_claim", labelKey: "mg.srcFromClaim" },
  { value: "other", labelKey: "mg.srcOther" },
];
// xBloom Studio product line (asset registry dropdown).
const PRODUCTS = [
  "xBloom Studio Midnight Black",
  "xBloom Studio Moonlight White",
  "xBloom Studio Sage Green (Green Knob)",
  "xBloom Studio Sage Green (Gold Knob)",
  "xBloom Studio Twilight",
];

export default function AssetModal({
  asset,
  open,
  onClose,
  onSaved,
}: {
  asset: MachineRow | null; // null = create
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const isEdit = !!asset;
  const [f, setF] = useState({
    serial: asset?.serial ?? "",
    product: asset?.product ?? "",
    assetType: asset?.assetType ?? "store",
    source: asset?.source ?? "new",
    warrantyStart: asset?.warrantyStart ?? "",
    warrantyEnd: asset?.warrantyEnd ?? "",
    noWarranty: asset?.noWarranty === 1,
    location: asset?.location ?? "",
    notes: asset?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    if (!f.serial.trim()) {
      setError(t("val.serialRequired"));
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      product: f.product || undefined,
      assetType: f.assetType,
      source: f.source,
      warrantyStart: f.noWarranty ? undefined : f.warrantyStart || undefined,
      warrantyEnd: f.noWarranty ? undefined : f.warrantyEnd || undefined,
      noWarranty: f.noWarranty ? 1 : 0,
      location: f.location || undefined,
      notes: f.notes || undefined,
    };
    try {
      if (isEdit) await api.updateMachine(f.serial, body);
      else await api.createMachine({ serial: f.serial.trim(), ...body });
      swalToast("success", t("msg.saved"));
      onSaved();
      onClose();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={isEdit ? t("mg.editAsset", { sn: asset?.serial ?? "" }) : t("mg.addAsset")} onClose={onClose}>
      <div className="space-y-3">
        <TextField label={t("mg.sn")} value={f.serial} onChange={set("serial")} disabled={isEdit} />
        <SelectField label={t("crm.product")} value={f.product} onChange={set("product")}>
          <option value="">—</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {/* preserve any existing custom value not in the standard list */}
          {f.product && !PRODUCTS.includes(f.product) && <option value={f.product}>{f.product}</option>}
        </SelectField>
        <SelectField label={t("mg.assetType")} value={f.assetType} onChange={set("assetType")}>
          {ASSET_TYPES.map((a) => (
            <option key={a.value} value={a.value}>
              {t(a.labelKey)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("mg.machineSource")} value={f.source} onChange={set("source")}>
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {t(s.labelKey)}
            </option>
          ))}
        </SelectField>
        {!f.noWarranty && (
          <div className="flex gap-2">
            <div className="flex-1">
              <TextField label={t("mg.warrantyStart")} type="date" value={f.warrantyStart} onChange={set("warrantyStart")} />
            </div>
            <div className="flex-1">
              <TextField label={t("mg.warrantyEnd")} type="date" value={f.warrantyEnd} onChange={set("warrantyEnd")} />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={f.noWarranty} onChange={(e) => setF((s) => ({ ...s, noWarranty: e.target.checked }))} />
          {t("mg.noWarrantyUnit")}
        </label>
        <TextField label={t("mg.locationCustomer")} value={f.location} onChange={set("location")} />
        <TextArea label={t("mg.note")} value={f.notes} onChange={set("notes")} />
        {error && <Banner kind="error">{error}</Banner>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy ? t("crm.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
