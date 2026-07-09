import { useState } from "react";
import { api, type MachineRow } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Banner, Button, TextArea, TextField } from "../../../components/ui";
import { swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";

/** Claim replacement: create a new unit, link it, and retire the original. */
export default function ReplaceModal({
  asset,
  onClose,
  onSaved,
}: {
  asset: MachineRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState({ newSerial: "", warrantyStart: "", warrantyEnd: "", note: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  if (!asset) return null;

  async function save() {
    if (!asset) return;
    if (!f.newSerial.trim()) {
      setError(t("val.replacementSerialRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.replaceMachine(asset.serial, {
        newSerial: f.newSerial.trim(),
        warrantyStart: f.warrantyStart || undefined,
        warrantyEnd: f.warrantyEnd || undefined,
        note: f.note || undefined,
      });
      setF({ newSerial: "", warrantyStart: "", warrantyEnd: "", note: "" });
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
    <Modal open={!!asset} title={t("mg.replaceTitle")} onClose={onClose}>
      <p className="mb-3 text-sm text-muted">{t("mg.replaceDesc", { sn: asset.serial })}</p>
      <div className="space-y-3">
        <TextField label={t("mg.newSerial")} value={f.newSerial} onChange={set("newSerial")} placeholder="J15A01BXXX" />
        <div className="flex gap-2">
          <div className="flex-1">
            <TextField label={t("mg.warrantyStart")} type="date" value={f.warrantyStart} onChange={set("warrantyStart")} />
          </div>
          <div className="flex-1">
            <TextField label={t("mg.warrantyEnd")} type="date" value={f.warrantyEnd} onChange={set("warrantyEnd")} />
          </div>
        </div>
        <TextArea label={t("mg.note")} value={f.note} onChange={set("note")} />
        {error && <Banner kind="error">{error}</Banner>}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button className="flex-1" onClick={save} disabled={busy}>
            {busy ? t("mg.replacing") : t("mg.replace")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
