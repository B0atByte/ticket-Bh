import { useState } from "react";
import { api, type TicketRow } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Banner, Button, SelectField, TextArea, TextField } from "../../../components/ui";
import { swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";
import { GLOBAL_STATUS } from "../../../lib/status";

// value stays English (stored in DB); label is localized via i18n.
const OLD_ROUTING = [
  { value: "Returned to Global", labelKey: "gs.returnedGlobal" },
  { value: "Kept in Thailand", labelKey: "gs.keptThailand" },
];
const NEW_ROUTING = [
  { value: "Awaiting Lot order", labelKey: "gs.awaitingLot" },
  { value: "Received", labelKey: "gs.received" },
];

export default function GlobalClaimModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: TicketRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState(ticket?.globalClaimStatus ?? "awaiting");
  const [note, setNote] = useState(ticket?.globalClaimNote ?? "");
  const [oldMachine, setOldMachine] = useState(ticket?.gcOldMachine ?? "");
  const [newMachine, setNewMachine] = useState(ticket?.gcNewMachine ?? "");
  const [lot, setLot] = useState(ticket?.gcLot ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [seeded, setSeeded] = useState<string | null>(null);
  if (ticket && seeded !== ticket.ticketId) {
    setSeeded(ticket.ticketId);
    setStatus(ticket.globalClaimStatus ?? "awaiting");
    setNote(ticket.globalClaimNote ?? "");
    setOldMachine(ticket.gcOldMachine ?? "");
    setNewMachine(ticket.gcNewMachine ?? "");
    setLot(ticket.gcLot ?? "");
    setError("");
  }
  if (!ticket) return null;

  async function save() {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      await api.updateGlobalClaim(ticket.ticketId, {
        globalClaimStatus: status,
        globalClaimNote: note,
        gcOldMachine: oldMachine || null,
        gcNewMachine: newMachine || null,
        gcLot: lot || null,
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
    <Modal open={!!ticket} title={t("mg.updateGlobalTitle")} onClose={onClose}>
      <div className="mb-3 text-sm text-muted">{ticket.ticketId} · {ticket.serial}</div>
      <div className="space-y-3">
        <SelectField label={t("mg.statusField")} value={status} onChange={(e) => setStatus(e.target.value)}>
          {GLOBAL_STATUS.map((s) => (
            <option key={s.key} value={s.key}>
              {t(`gs.${s.key}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("mg.origMachine")} value={oldMachine} onChange={(e) => setOldMachine(e.target.value)}>
          <option value="">—</option>
          {OLD_ROUTING.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("mg.newMachineField")} value={newMachine} onChange={(e) => setNewMachine(e.target.value)}>
          <option value="">—</option>
          {NEW_ROUTING.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </SelectField>
        <TextField label={t("mg.lotPo")} value={lot} onChange={(e) => setLot(e.target.value)} />
        <TextArea label={t("mg.note")} value={note} onChange={(e) => setNote(e.target.value)} />
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
