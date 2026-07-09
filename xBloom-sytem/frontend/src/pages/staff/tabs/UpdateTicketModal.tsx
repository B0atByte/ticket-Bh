import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type TicketRow } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Banner, Button, SelectField, TextArea } from "../../../components/ui";
import { Icon } from "../../../components/Icon";
import { swalError, swalToast } from "../../../lib/swal";
import { useI18n } from "../../../lib/i18n";
import { useAuth } from "../../../lib/auth";
import { TICKET_FLOW } from "../../../lib/status";

const INTENTS = ["status_update", "request_info", "quote", "ready", "closing"] as const;

export default function UpdateTicketModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: TicketRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isTech = user?.role === "tech";
  // Techs can't assign cases, so don't fetch the staff directory for them.
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: api.listUsers, enabled: !!ticket && !isTech });
  const qc = useQueryClient();
  // Case history (status changes, claim/accept, staff messages) — read by all staff incl. techs.
  const { data: detail } = useQuery({ queryKey: ["ticket", ticket?.ticketId], queryFn: () => api.getTicket(ticket!.ticketId), enabled: !!ticket });
  const [claimed, setClaimed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState(ticket?.status ?? "new");
  const [assignedTo, setAssignedTo] = useState(ticket?.assignedTo ?? "");
  const [staffNote, setStaffNote] = useState(ticket?.staffNote ?? "");
  const [techNote, setTechNote] = useState(ticket?.techNote ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // AI reply drafter
  const [aiIntent, setAiIntent] = useState<string>("status_update");
  const [aiNote, setAiNote] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftTh, setDraftTh] = useState("");
  const [draftEn, setDraftEn] = useState("");
  const [sending, setSending] = useState(false);

  // Re-seed local state when a different ticket opens.
  const [seeded, setSeeded] = useState<string | null>(null);
  if (ticket && seeded !== ticket.ticketId) {
    setSeeded(ticket.ticketId);
    setStatus(ticket.status ?? "new");
    setAssignedTo(ticket.assignedTo ?? "");
    setStaffNote(ticket.staffNote ?? "");
    setTechNote(ticket.techNote ?? "");
    setError("");
    setAiNote("");
    setDraftTh("");
    setDraftEn("");
    setClaimed(false);
    setAccepted(false);
  }

  if (!ticket) return null;

  async function draft() {
    if (!ticket) return;
    setDrafting(true);
    try {
      const r = await api.aiDraftReply({
        intent: aiIntent,
        issueType: ticket.issueType ?? undefined,
        repairType: ticket.repairType ?? undefined,
        status,
        note: aiNote.trim() || undefined,
      });
      setDraftTh(r.th);
      setDraftEn(r.en);
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("ai.failed"));
    } finally {
      setDrafting(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      swalToast("success", t("ai.copied"));
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  async function sendMsg(text: string) {
    if (!ticket || !text.trim()) return;
    setSending(true);
    try {
      await api.sendTicketMessage(ticket.ticketId, { subject: `xBloom · ${ticket.ticketId}`, body: text });
      swalToast("success", t("ai.sent"));
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setSending(false);
    }
  }

  async function save() {
    if (!ticket) return;
    setBusy(true);
    setError("");
    try {
      // Techs may only edit the technician note; staff/admin edit assignment + notes.
      await api.updateTicket(ticket.ticketId, isTech ? { techNote } : { assignedTo: assignedTo || null, staffNote, techNote });
      if (status !== ticket.status) await api.setTicketStatus(ticket.ticketId, status);
      swalToast("success", t("msg.saved"));
      onSaved();
      onClose();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    if (!ticket) return;
    try {
      const r = await api.claimTicket(ticket.ticketId);
      setClaimed(true);
      if (r.status) setStatus(r.status);
      swalToast("success", t("mg.claimed"));
      onSaved();
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketId] });
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  async function accept() {
    if (!ticket) return;
    try {
      await api.acceptTicket(ticket.ticketId);
      setAccepted(true);
      swalToast("success", t("mg.accepted"));
      onSaved();
      qc.invalidateQueries({ queryKey: ["ticket", ticket.ticketId] });
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    }
  }

  return (
    <Modal open={!!ticket} title={t("mg.updateTitle", { id: ticket.ticketId })} onClose={onClose} wide>
      <div className="mb-3 text-sm text-muted">
        {ticket.serial} · {ticket.issueType} · {ticket.repairType}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!isTech && !ticket.claimedBy && !claimed && (
          <Button variant="secondary" onClick={claim}>{t("mg.claimCase")}</Button>
        )}
        {(ticket.claimedBy || claimed) && (
          <span className="text-xs text-muted">{t("mg.claimedBy", { name: claimed ? user?.name ?? "" : ticket.claimedBy ?? "" })}</span>
        )}
        {isTech && ticket.assignedTo === user?.name && !ticket.techAcceptedAt && !accepted && (
          <Button variant="secondary" onClick={accept}>{t("mg.acceptCase")}</Button>
        )}
        {isTech && (ticket.techAcceptedAt || accepted) && <span className="text-xs text-green">{t("mg.accepted")}</span>}
      </div>
      <div className="space-y-3">
        <SelectField label={t("mg.statusField")} value={status} onChange={(e) => setStatus(e.target.value)}>
          {TICKET_FLOW.map((s) => (
            <option key={s.key} value={s.key}>
              {t(`st.${s.key}`)}
            </option>
          ))}
        </SelectField>
        {!isTech && (
          <>
            <SelectField label={t("mg.assignTo")} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">{t("mg.unassigned")}</option>
              {users?.data.map((u) => (
                <option key={u.name} value={u.name}>
                  {u.name} ({u.role})
                </option>
              ))}
            </SelectField>
            <TextArea label={t("mg.staffNote")} value={staffNote} onChange={(e) => setStaffNote(e.target.value)} />
          </>
        )}
        {isTech && ticket.staffNote && (
          <div>
            <div className="mb-1 text-sm text-ink">{t("mg.staffNote")}</div>
            <div className="whitespace-pre-wrap rounded-xl2 border border-line bg-canvas p-2.5 text-sm text-ink2">{ticket.staffNote}</div>
          </div>
        )}
        <TextArea label={t("mg.techNote")} value={techNote} onChange={(e) => setTechNote(e.target.value)} />

        {/* AI reply drafter — staff/admin only; sends only non-PII case context to the model */}
        {!isTech && (
        <div className="rounded-xl2 border border-line bg-canvas p-3">
          <div className="mb-2 flex items-center gap-2">
            <Icon name="chart" size={15} className="text-brand" />
            <span className="text-sm font-medium text-ink">{t("ai.draftTitle")}</span>
          </div>
          <div className="space-y-2">
            <SelectField label={t("ai.intent")} value={aiIntent} onChange={(e) => setAiIntent(e.target.value)}>
              {INTENTS.map((k) => (
                <option key={k} value={k}>
                  {t(`ai.intent.${k}`)}
                </option>
              ))}
            </SelectField>
            <TextArea label={t("ai.note")} value={aiNote} onChange={(e) => setAiNote(e.target.value)} rows={2} />
            <Button variant="secondary" onClick={draft} disabled={drafting}>
              {drafting ? t("ai.drafting") : t("ai.draftBtn")}
            </Button>

            {(draftTh || draftEn) && (
              <div className="space-y-3 pt-1">
                {([
                  ["th", draftTh, setDraftTh, t("ai.draftTh")],
                  ["en", draftEn, setDraftEn, t("ai.draftEn")],
                ] as const).map(([lang, val, setter, label]) => (
                  <div key={lang}>
                    <TextArea label={label} value={val} onChange={(e) => setter(e.target.value)} rows={4} />
                    <div className="mt-1 flex gap-4">
                      <button type="button" onClick={() => copyText(val)} className="text-xs text-brown hover:underline">
                        {t("ai.copy")}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendMsg(val)}
                        disabled={sending || !ticket.email}
                        className="text-xs text-brand hover:underline disabled:opacity-40"
                      >
                        {t("ai.sendEmail")}
                      </button>
                    </div>
                  </div>
                ))}
                {!ticket.email && <p className="text-xs text-muted">{t("ai.noEmail")}</p>}
              </div>
            )}
          </div>
        </div>
        )}

        {detail?.timeline && detail.timeline.length > 0 && (
          <div className="rounded-xl2 border border-line bg-canvas p-3">
            <div className="mb-2 text-sm font-medium text-ink">{t("trk.activity")}</div>
            <ol className="space-y-1.5 text-xs">
              {detail.timeline.map((ev, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-ink2">
                    {ev.detail ?? (ev.action ? t(`act.${ev.action}`) : "—")}
                    {ev.by ? ` · ${ev.by}` : ""}
                  </span>
                  <span className="shrink-0 text-muted">{ev.timestamp?.slice(0, 16) ?? ""}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
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
