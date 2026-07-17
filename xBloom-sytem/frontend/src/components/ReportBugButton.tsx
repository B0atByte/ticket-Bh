import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import Modal from "./Modal";
import { Button, FileField, TextArea } from "./ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { submitIssueReport, type Severity } from "../lib/issueService";
import { useI18n } from "../lib/i18n";
import { swalToast } from "../lib/swal";

const SEVERITIES: Severity[] = ["critical", "high", "normal"];
const SEVERITY_EMOJI: Record<Severity, string> = { critical: "🔴", high: "🟡", normal: "🟢" };

export default function ReportBugButton() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setDescription("");
    setSeverity("normal");
    setAttachment(null);
  };

  const submit = async () => {
    if (description.trim().length < 5) {
      void swalToast("warning", t("bugReport.tooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await submitIssueReport({
        description: description.trim(),
        severity,
        reporterId: user.name,
        reporterName: user.name,
        reporterRole: user.role,
        page: location.pathname,
        attachment,
      });
      swalToast("success", t("bugReport.success"));
      close();
    } catch (err) {
      swalToast("error", err instanceof ApiError || err instanceof Error ? err.message : t("bugReport.fail"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-full bg-red px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 sm:bottom-4"
      >
        <Icon name="alert" size={18} />
        {t("bugReport.button")}
      </button>

      <Modal open={open} title={t("bugReport.title")} onClose={close}>
        <p className="mb-1.5 text-xs font-medium text-muted">{t("bugReport.severity")}</p>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              disabled={submitting}
              title={t(`bugReport.severity.${s}Hint`)}
              className={`rounded-xl2 border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                severity === s ? "border-red bg-red-tint text-red" : "border-line text-muted hover:bg-canvas"
              }`}
            >
              <div>{SEVERITY_EMOJI[s]}</div>
              <div>{t(`bugReport.severity.${s}`)}</div>
            </button>
          ))}
        </div>

        <TextArea
          label=""
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          placeholder={t("bugReport.placeholder")}
          rows={4}
          autoFocus
        />

        <div className="mt-3">
          <FileField
            label=""
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
            fileName={attachment?.name}
            hint={t("bugReport.attachment")}
            onPick={setAttachment}
          />
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={close} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" className="flex-1" onClick={submit} disabled={submitting}>
            {t("bugReport.send")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
