import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import Modal from "./Modal";
import { Button, TextArea } from "./ui";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { swalToast } from "../lib/swal";

export default function ReportBugButton() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) return null;

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setDescription("");
  };

  const submit = async () => {
    if (description.trim().length < 5) {
      void swalToast("warning", t("bugReport.tooShort"));
      return;
    }
    setSubmitting(true);
    try {
      await api.reportIssue({ description: description.trim(), page: location.pathname });
      swalToast("success", t("bugReport.success"));
      setOpen(false);
      setDescription("");
    } catch (err) {
      swalToast("error", err instanceof ApiError ? err.message : t("bugReport.fail"));
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
        <TextArea
          label=""
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={submitting}
          placeholder={t("bugReport.placeholder")}
          rows={4}
          autoFocus
        />
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
