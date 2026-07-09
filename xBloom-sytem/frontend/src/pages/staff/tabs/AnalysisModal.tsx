import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../lib/api";
import Modal from "../../../components/Modal";
import { Button, Field, TextField } from "../../../components/ui";
import { SkeletonTable } from "../../../components/Skeleton";
import { Chip } from "../../../components/staff/ui";
import { useI18n } from "../../../lib/i18n";
import { STATUS_LABEL } from "../../../lib/status";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function AnalysisModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<null | {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }>(null);

  const { data, isLoading } = useQuery({ queryKey: ["tickets", "all"], queryFn: () => api.listTickets({}), enabled: open });

  function preset(kind: "month" | "3m" | "year" | "all") {
    const now = new Date();
    if (kind === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const start =
      kind === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : kind === "3m"
          ? new Date(now.getFullYear(), now.getMonth() - 2, 1)
          : new Date(now.getFullYear(), 0, 1);
    setFrom(iso(start));
    setTo(iso(now));
  }

  function analyse() {
    if (!data) return;
    const rows = data.data.filter((t) => {
      const d = t.createdAt?.slice(0, 10) ?? "";
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const t of rows) {
      const ty = t.repairType ?? "—";
      byType[ty] = (byType[ty] ?? 0) + 1;
      const st = t.status ?? "—";
      byStatus[st] = (byStatus[st] ?? 0) + 1;
    }
    setResult({ total: rows.length, byType, byStatus });
  }

  return (
    <Modal open={open} title={t("mg.analysisTitle")} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Chip active={false} onClick={() => preset("month")}>{t("mg.thisMonth")}</Chip>
          <Chip active={false} onClick={() => preset("3m")}>{t("mg.3months")}</Chip>
          <Chip active={false} onClick={() => preset("year")}>{t("mg.thisYear")}</Chip>
          <Chip active={false} onClick={() => preset("all")}>{t("common.all")}</Chip>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <TextField label={t("mg.from")} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <TextField label={t("mg.to")} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <Button className="w-full" onClick={analyse} disabled={isLoading}>
          {isLoading ? t("common.loading") : t("mg.analyse")}
        </Button>

        {isLoading && <SkeletonTable rows={4} cols={2} />}
        {result && (
          <div className="rounded-xl2 border border-line bg-card p-4 text-sm">
            <div className="mb-2 font-medium text-ink">{t("mg.totalCases", { n: result.total })}</div>
            <div className="mb-1 text-xs uppercase tracking-wide text-muted">{t("mg.byType")}</div>
            {Object.entries(result.byType).map(([k, v]) => (
              <Field key={k} k={k} v={v} />
            ))}
            <div className="mb-1 mt-3 text-xs uppercase tracking-wide text-muted">{t("mg.byStatus")}</div>
            {Object.entries(result.byStatus).map(([k, v]) => (
              <Field key={k} k={STATUS_LABEL[k] ? t(`st.${k}`) : k} v={v} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
