import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError, api, type TrackResult } from "../lib/api";
import { Banner, Button, Card, Field, PageTitle, TextField } from "../components/ui";
import { SkeletonCard } from "../components/Skeleton";
import ScanSerial from "../components/ScanSerial";
import { safeHref } from "../lib/validate";
import { useI18n } from "../lib/i18n";

export default function Track() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  async function find(query: string) {
    if (!query.trim()) {
      setError(t("trk.enter"));
      return;
    }
    setError("");
    setResult(null);
    setNotFound(false);
    setLoading(true);
    try {
      setResult(await api.track(query.trim()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initial = params.get("q");
    if (initial) find(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fade-in">
      <PageTitle title={t("trk.title")} subtitle={t("trk.subtitle")} />

      <Card>
        <div className="space-y-3">
          <TextField
            label={t("trk.field")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && find(q)}
            placeholder="TK-2026-XXXXXX"
            error={error}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => find(q)} disabled={loading}>
              {loading ? t("trk.finding") : t("trk.find")}
            </Button>
            <ScanSerial onResult={(sn) => { setQ(sn); find(sn); }} />
          </div>
        </div>
      </Card>

      <div className="mt-4 space-y-3">
        {loading && <SkeletonCard lines={4} />}

        {result && (
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{result.ticket.ticketId}</span>
              <span className="rounded-full bg-brown-tint px-2.5 py-0.5 text-xs text-brown">
                {result.ticket.status ? t(`st.${result.ticket.status}`) : "—"}
              </span>
            </div>
            <dl className="mt-3 text-sm">
              <Field k={t("trk.machine")} v={result.ticket.serial} />
              <Field k={t("trk.issue")} v={result.ticket.issueType} />
              <Field k={t("trk.reported")} v={result.ticket.createdAt} />
            </dl>
            {safeHref(result.ticket.trackingLink) && (
              <a href={safeHref(result.ticket.trackingLink)} target="_blank" rel="noreferrer" className="mt-3 block text-sm text-brown underline">
                {t("trk.shipment")}
              </a>
            )}

            <div className="mt-5">
              <h3 className="mb-3 text-sm font-medium text-ink">{t("trk.activity")}</h3>
              {result.timeline.length === 0 ? (
                <p className="text-sm text-muted">{t("trk.noActivity")}</p>
              ) : (
                <ol className="space-y-3 border-l border-line pl-4">
                  {result.timeline.map((ev, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[17px] top-1.5 h-1.5 w-1.5 rounded-full bg-brown" />
                      <div className="text-sm text-ink">{ev.action ? t(`act.${ev.action}`) : "—"}</div>
                      <div className="text-xs text-muted">{ev.timestamp}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        )}

        {notFound && (
          <Card>
            <Banner kind="info">{t("trk.notFound")}</Banner>
            <Link to="/support" className="mt-3 block">
              <Button className="w-full">{t("trk.reportNew")}</Button>
            </Link>
          </Card>
        )}

        {error && !notFound && <Banner kind="error">{error}</Banner>}
      </div>
    </div>
  );
}
