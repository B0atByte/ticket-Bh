import { useState } from "react";
import { api } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Banner, Button, SelectField, TextArea, TextField } from "../../../components/ui";
import { swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";
import { GLOBAL_STATUS } from "../../../lib/status";

export default function BackdatedModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState({
    closedDate: "",
    ticketId: "",
    serial: "",
    replacementSerial: "",
    customer: "",
    issue: "",
    approver: "",
    globalClaimStatus: "accepted",
    routing: "Returned to Global",
    lot: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function save() {
    if (!f.ticketId.trim() || !f.serial.trim() || !f.closedDate) {
      setError(t("val.backdatedRequired"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.backdatedGlobalClaim({
        ticketId: f.ticketId.trim(),
        serial: f.serial.trim(),
        createdAt: f.closedDate,
        globalClaimStatus: f.globalClaimStatus,
        gcOldMachine: f.routing,
        gcNewMachine: f.replacementSerial || undefined,
        gcLot: f.lot || undefined,
        issueType: f.issue || undefined,
        globalClaimNote: [f.customer && `Customer: ${f.customer}`, f.approver && `Approved by: ${f.approver}`].filter(Boolean).join(" · ") || undefined,
      });
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
    <Modal open={open} title={t("mg.addBackdated")} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label={t("mg.closedDate")} type="date" value={f.closedDate} onChange={set("closedDate")} />
        <TextField label={t("mg.ticketId")} value={f.ticketId} onChange={set("ticketId")} placeholder="TK-2026-XXXXXX" />
        <TextField label={t("mg.origSn")} value={f.serial} onChange={set("serial")} />
        <TextField label={t("mg.replacementSn")} value={f.replacementSerial} onChange={set("replacementSerial")} />
        <TextField label={t("mg.customer")} value={f.customer} onChange={set("customer")} />
        <TextField label={t("mg.approver")} value={f.approver} onChange={set("approver")} />
        <SelectField label={t("mg.globalStatus")} value={f.globalClaimStatus} onChange={set("globalClaimStatus")}>
          {GLOBAL_STATUS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(`gs.${s.key}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("mg.machineRouting")} value={f.routing} onChange={set("routing")}>
          <option value="Returned to Global">{t("gs.returnedGlobal")}</option>
          <option value="Kept in Thailand">{t("gs.keptThailand")}</option>
        </SelectField>
        <TextField label={t("mg.lotPo")} value={f.lot} onChange={set("lot")} />
        <div className="sm:col-span-2">
          <TextArea label={t("mg.issueInfo")} value={f.issue} onChange={set("issue")} />
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Banner kind="error">{error}</Banner>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy}>
          {busy ? t("crm.saving") : t("common.save")}
        </Button>
      </div>
    </Modal>
  );
}
