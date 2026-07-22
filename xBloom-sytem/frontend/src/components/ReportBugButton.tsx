import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import Modal from "./Modal";
import { Button, FileField, TextArea } from "./ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  fetchMyIssues,
  submitIssueReport,
  type IssueStatus,
  type MyIssue,
  type Severity,
} from "../lib/issueService";
import { useI18n } from "../lib/i18n";
import { swalToast } from "../lib/swal";

const SEVERITIES: Severity[] = ["critical", "high", "normal"];
const SEVERITY_EMOJI: Record<Severity, string> = { critical: "🔴", high: "🟡", normal: "🟢" };

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → pending_user → resolved).
const STATUS_STEPS: IssueStatus[] = ["submitted", "acknowledged", "pending_user", "resolved"];

function IssueProgress({ status, t }: { status: IssueStatus; t: (key: string) => string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  const isResolved = status === "resolved";
  const activeColor = isResolved ? "bg-green-500" : "bg-red";

  return (
    <div className="flex items-start">
      {STATUS_STEPS.map((step, i) => {
        const reached = i <= currentIndex;
        return (
          <div key={step} className="flex flex-1 items-start last:flex-none">
            <div className="flex w-14 flex-col items-center gap-1 shrink-0">
              <div className={`h-2.5 w-2.5 rounded-full ${reached ? activeColor : "bg-line"}`} />
              <span className={`text-center text-[9px] leading-tight ${reached ? "font-medium text-ink" : "text-muted"}`}>
                {t(`bugReport.status.${step}`)}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`mt-[5px] h-0.5 flex-1 ${i < currentIndex ? activeColor : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function IssueHistoryCard({ issue, lang, t }: { issue: MyIssue; lang: string; t: (key: string) => string }) {
  return (
    <div className="rounded-xl2 border border-line p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex-1 line-clamp-2 text-sm text-ink">{issue.description}</p>
        <span className="shrink-0 text-sm">{SEVERITY_EMOJI[issue.severity]}</span>
      </div>
      <p className="mb-3 text-[11px] text-muted">
        {new Date(issue.createdAt).toLocaleString(lang === "th" ? "th-TH" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <IssueProgress status={issue.status} t={t} />
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportBugDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const location = useLocation();
  const [view, setView] = useState<"new" | "history">("new");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<MyIssue[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || view !== "history" || !user) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    fetchMyIssues(user.name)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : t("bugReport.history.fail"));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, view, user, t]);

  if (!user) return null;

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
    setView("new");
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
      <Modal open={open} title={t("bugReport.title")} onClose={close}>
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl2 bg-canvas p-1">
          <button
            type="button"
            onClick={() => setView("new")}
            className={`flex items-center justify-center gap-1.5 rounded-xl2 py-1.5 text-xs font-medium transition-colors ${
              view === "new" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon name="tool" size={13} />
            {t("bugReport.tab.new")}
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={`flex items-center justify-center gap-1.5 rounded-xl2 py-1.5 text-xs font-medium transition-colors ${
              view === "history" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Icon name="clock" size={13} />
            {t("bugReport.tab.history")}
          </button>
        </div>

        {view === "new" ? (
          <>
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
          </>
        ) : (
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10 text-muted">
                <Icon name="clock" size={20} />
              </div>
            ) : historyError ? (
              <p className="py-6 text-center text-sm text-red">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t("bugReport.history.empty")}</p>
            ) : (
              history.map((issue) => <IssueHistoryCard key={issue.id} issue={issue} lang={lang} t={t} />)
            )}
          </div>
        )}
      </Modal>
  );
}
