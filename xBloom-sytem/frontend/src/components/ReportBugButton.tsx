import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import Modal from "./Modal";
import { Button, SelectField, TextArea, TextField } from "./ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  fetchMyIssues,
  postIssueComment,
  submitIssueReport,
  type Category,
  type IssueStatus,
  type MyIssue,
  type Severity,
} from "../lib/issueService";
import { useI18n } from "../lib/i18n";
import { swalToast } from "../lib/swal";

const SEVERITIES: Severity[] = ["critical", "high", "normal"];
const CATEGORIES: Category[] = ["system_error", "payment", "account", "feedback", "other"];

// Positional 1:1 mapping of issue-service's real status lifecycle
// (submitted → acknowledged → resolved).
const STATUS_STEPS: IssueStatus[] = ["submitted", "acknowledged", "resolved"];

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

function IssueHistoryCard({
  issue,
  lang,
  t,
  onViewMore,
}: {
  issue: MyIssue;
  lang: string;
  t: (key: string) => string;
  onViewMore: (issue: MyIssue) => void;
}) {
  return (
    <div className="rounded-xl2 border border-line p-3.5">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="flex-1 line-clamp-2 text-sm font-medium text-ink">{issue.subject || issue.description}</p>
        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-muted">
          {t(`bugReport.severity.${issue.severity}`)}
        </span>
      </div>
      <p className="mb-3 text-[11px] text-muted">
        {new Date(issue.createdAt).toLocaleString(lang === "th" ? "th-TH" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <IssueProgress status={issue.status} t={t} />
      <button
        type="button"
        onClick={() => onViewMore(issue)}
        className="mt-3 text-xs font-medium text-blue-600 hover:underline"
      >
        {t("bugReport.viewMore")}
      </button>
    </div>
  );
}

function IssueDetail({
  issue,
  reporterId,
  lang,
  t,
  onBack,
}: {
  issue: MyIssue;
  reporterId: string;
  lang: string;
  t: (key: string) => string;
  onBack: () => void;
}) {
  const [comments, setComments] = useState(issue.comments);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(lang === "th" ? "th-TH" : "en-US", { dateStyle: "medium", timeStyle: "short" });

  const sendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    setCommentError(null);
    try {
      const updated = await postIssueComment(issue.id, reporterId, commentText.trim());
      setComments(updated);
      setCommentText("");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : t("bugReport.commentFail"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3.5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
        <Icon name="chevronLeft" size={14} />
        {t("common.back")}
      </button>

      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink">
          {t(`bugReport.severity.${issue.severity}`)}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">
          {t(`bugReport.category.${issue.category}`)}
        </span>
      </div>

      {issue.subject && <p className="text-sm font-semibold text-ink">{issue.subject}</p>}
      <p className="whitespace-pre-wrap text-sm text-ink">{issue.description}</p>

      {issue.contactInfo && (
        <p className="text-xs text-muted">
          {t("bugReport.contactPrefix")}
          {issue.contactInfo}
        </p>
      )}

      <p className="text-[11px] text-muted">
        {t("bugReport.reportedAt")} {fmt(issue.createdAt)}
      </p>


      <div className="border-t border-line pt-3">
        <div className="space-y-3">
          {issue.history.map((h, i) => (
            <div key={i} className="flex gap-2.5">
              <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${h.status === "resolved" ? "bg-green-500" : "bg-red"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t(`bugReport.status.${h.status}`)}</p>
                {h.note && <p className="text-xs text-muted">{h.note}</p>}
                <p className="text-[11px] text-muted">{fmt(h.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold text-ink">{t("bugReport.comments")}</p>
        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-muted">{t("bugReport.noComments")}</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-canvas px-3 py-2">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      c.authorType === "admin" ? "bg-ink text-white" : "bg-line text-muted"
                    }`}
                  >
                    {c.authorType === "admin" ? t("bugReport.authorAdmin") : t("bugReport.authorReporter")}
                  </span>
                  <span className="text-[11px] text-muted">{fmt(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{c.message}</p>
              </div>
            ))
          )}
        </div>
        {commentError && <p className="mt-2 text-xs text-red">{commentError}</p>}
        <div className="mt-2 flex gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t("bugReport.commentPlaceholder")}
            rows={2}
            className="flex-1 resize-none rounded-xl2 border border-line bg-white px-2.5 py-2 text-sm text-ink outline-none"
          />
          <Button variant="danger" onClick={sendComment} disabled={sending || !commentText.trim()} className="self-end">
            <Icon name="send" size={12} />
            {t("bugReport.commentSend")}
          </Button>
        </div>
      </div>
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
  const [view, setView] = useState<"new" | "history" | "detail">("new");
  const [selectedIssue, setSelectedIssue] = useState<MyIssue | null>(null);
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [contactInfo, setContactInfo] = useState("");
  const [severity, setSeverity] = useState<Severity>("normal");
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
    setSubject("");
    setCategory("other");
    setContactInfo("");
    setSeverity("normal");
  };

  const submit = async () => {
    if (subject.trim().length === 0) {
      void swalToast("warning", t("bugReport.subjectRequired"));
      return;
    }
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
        category,
        subject: subject.trim(),
        contactInfo: contactInfo.trim() || undefined,
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
        {view !== "detail" && (
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
        )}

        {view === "new" ? (
          <>
            <SelectField
              label={t("bugReport.category")}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              disabled={submitting}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`bugReport.category.${c}`)}
                </option>
              ))}
            </SelectField>

            <div className="mt-3">
              <TextField
                label=""
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting}
                placeholder={t("bugReport.subject")}
                required
                maxLength={120}
              />
            </div>

            <p className="mb-1.5 mt-3 text-xs font-medium text-muted">{t("bugReport.severity")}</p>
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  disabled={submitting}
                  title={t(`bugReport.severity.${s}Hint`)}
                  className={`rounded-xl2 border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                    severity === s ? "border-ink bg-ink text-white" : "border-line text-muted hover:bg-canvas"
                  }`}
                >
                  {t(`bugReport.severity.${s}`)}
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
            />

            <div className="mt-3">
              <TextField
                label=""
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                disabled={submitting}
                placeholder={t("bugReport.contactInfo")}
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
        ) : view === "history" ? (
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
              history.map((issue) => (
                <IssueHistoryCard
                  key={issue.id}
                  issue={issue}
                  lang={lang}
                  t={t}
                  onViewMore={(i) => {
                    setSelectedIssue(i);
                    setView("detail");
                  }}
                />
              ))
            )}
          </div>
        ) : (
          selectedIssue && (
            <IssueDetail
              issue={selectedIssue}
              reporterId={user.name}
              lang={lang}
              t={t}
              onBack={() => setView("history")}
            />
          )
        )}
      </Modal>
  );
}
