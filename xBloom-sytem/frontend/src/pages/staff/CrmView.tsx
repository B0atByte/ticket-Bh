import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api, type CrmResult, type InteractionRow, type TicketRow } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import Modal from "../../components/Modal";
import { Icon } from "../../components/Icon";
import { SkeletonCrm } from "../../components/Skeleton";
import { swalError, swalToast } from "../../lib/swal";
import { safeHref } from "../../lib/validate";
import { Banner, Button, TextArea } from "../../components/ui";

const todayStr = () => new Date().toISOString().slice(0, 10);

const STATUS_CLS: Record<string, string> = {
  ok: "bg-green-tint text-green",
  wait: "bg-wait-tint text-wait",
  open: "bg-red-tint text-red",
};
const CHANNEL_KEY: Record<string, string> = { line: "crm.chLine", phone: "crm.chPhone", store: "crm.chStore", other: "common.none" };
const DECISIONS = [
  { key: "in", labelKey: "crm.dIn" },
  { key: "out", labelKey: "crm.dOut" },
  { key: "misuse", labelKey: "crm.dMisuse" },
  { key: "none", labelKey: "crm.dNone" },
] as const;

export default function CrmView({ query }: { query: string }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["crm", query],
    queryFn: () => api.crmLookup(query),
    enabled: !!query,
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm", query] });

  if (!query)
    return (
      <div className="mx-auto mt-24 max-w-md text-center text-muted">
        <Icon name="search" size={40} className="mx-auto mb-3 text-line" />
        <p className="text-sm">{t("crm.searchHint")}</p>
      </div>
    );
  if (isLoading)
    return (
      <div className="fade-in">
        <div className="mb-4 h-4 w-40 animate-pulse rounded-xl2 bg-card2" />
        <SkeletonCrm />
      </div>
    );
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto mt-20 max-w-md">
        <Banner kind={notFound ? "info" : "error"}>{notFound ? t("crm.notFound", { q: query }) : (error as Error).message}</Banner>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-muted">
        {t("crm.resultFor")} <span className="mono text-ink2">{data.serial}</span> · {t("crm.oneResult")}
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-5">
          <CustomerPanel data={data} />
          <ClaimPanel ticket={data.tickets[0] ?? null} onChanged={refresh} />
        </div>
        <InteractionPanel data={data} onChanged={refresh} />
      </div>
    </div>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`mono inline-block rounded-xl2 border border-line bg-canvas px-2 py-0.5 text-xs text-ink2 ${className}`}>{children}</span>;
}

function CustomerPanel({ data }: { data: CrmResult }) {
  const { t } = useI18n();
  const name = data.warranty?.name ?? data.machine?.customerName ?? t("crm.customer");
  const product = data.warranty?.product ?? data.machine?.product ?? "—";
  const expiry = data.warranty?.expiryDate ?? data.machine?.warrantyEnd ?? null;
  const noWarranty = data.machine?.noWarranty === 1;
  const active = !noWarranty && !!expiry && expiry >= todayStr();
  const latestVideo = data.tickets.find((tk) => tk.videoUrl)?.videoUrl ?? null;

  return (
    <section className="rounded-xl2 border border-line bg-card">
      <div className="flex items-start gap-3.5 p-5">
        <div className="flex flex-none items-center justify-center rounded-xl2 border border-line bg-brown-tint text-lg font-bold text-brand" style={{ width: 52, height: 52 }}>
          {name.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tracking-tight">{name}</div>
          <Chip className="mt-1">{data.serial}</Chip>
        </div>
      </div>

      <div className={`mx-5 flex items-center gap-3 rounded-xl2 border border-line border-l-[3px] p-3 ${active ? "border-l-green bg-green-tint" : "border-l-grey bg-canvas"}`}>
        <span className={`text-xl font-bold leading-none ${active ? "text-green" : "text-muted"}`}>{noWarranty ? "—" : active ? t("crm.years2") : "×"}</span>
        <div>
          <b className={`block text-[12.5px] ${active ? "text-green" : "text-ink2"}`}>{noWarranty ? t("crm.noWarranty") : active ? t("crm.warrantyActive") : t("crm.warrantyExpired")}</b>
          <small className="text-[11px] text-muted">{expiry ? t("crm.until", { date: expiry }) : t("crm.noExpiry")}</small>
        </div>
      </div>

      <div className="px-5 pb-1 pt-4">
        <MetaRow label={t("crm.purchaseDate")} value={data.warranty?.purchaseDate ?? data.machine?.warrantyStart ?? "—"} />
        <MetaRow label={t("crm.channel")} value={data.warranty?.company ?? data.machine?.source ?? "—"} />
        <MetaRow label={t("crm.product")} value={product} />
        <MetaRow label={t("crm.phone")} value={data.warranty?.phone ?? data.tickets[0]?.phone ?? "—"} />
        <MetaRow label={t("crm.email")} value={data.warranty?.email ?? data.tickets[0]?.email ?? "—"} last />
      </div>

      <div className="grid gap-2.5 px-5 pb-5 pt-3.5">
        <EvidenceBtn
          icon="file"
          title={t("crm.receipt")}
          sub={safeHref(data.warranty?.receiptDriveUrl) ? t("crm.receiptOpen") : t("crm.noFile")}
          disabled={!safeHref(data.warranty?.receiptDriveUrl)}
          onClick={() => {
            const u = safeHref(data.warranty?.receiptDriveUrl);
            if (u) window.open(u, "_blank", "noopener,noreferrer");
          }}
        />
        <EvidenceBtn
          dark
          icon="video"
          title={t("crm.videoTitle")}
          sub={safeHref(latestVideo) ? t("crm.videoOpen") : t("crm.noVideo")}
          disabled={!safeHref(latestVideo)}
          onClick={() => {
            const u = safeHref(latestVideo);
            if (u) window.open(u, "_blank", "noopener,noreferrer");
          }}
        />
      </div>
    </section>
  );
}

function MetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${last ? "" : "border-b border-line2"}`}>
      <small className="text-[11px] text-muted">{label}</small>
      <b className="text-right text-[13.5px] font-semibold">{value}</b>
    </div>
  );
}

function EvidenceBtn({ title, sub, icon, dark, disabled, onClick }: { title: string; sub: string; icon: "file" | "video"; dark?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 rounded-xl2 border px-3.5 py-3 text-left transition disabled:opacity-50 ${
        dark ? "border-ink bg-ink text-white hover:opacity-90" : "border-line bg-card hover:border-ink"
      }`}
    >
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl2 border ${dark ? "border-transparent bg-white/10" : "border-line bg-canvas"}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="flex-1">
        <b className="block text-[13px] font-semibold">{title}</b>
        <small className={`text-[10.5px] ${dark ? "text-white/55" : "text-muted"}`}>{sub}</small>
      </span>
      <Icon name="chevronRight" size={16} className={dark ? "text-white/50" : "text-muted"} />
    </button>
  );
}

function ClaimPanel({ ticket, onChanged }: { ticket: TicketRow | null; onChanged: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState("");
  const [routeNote, setRouteNote] = useState("");

  if (!ticket)
    return (
      <section className="rounded-xl2 border border-line bg-card">
        <PanelHead title={t("crm.claimTitle")} />
        <div className="p-5 text-sm text-muted">{t("crm.noTicket")}</div>
      </section>
    );

  async function decide(d: "in" | "out" | "misuse" | "none") {
    if (!ticket) return;
    setBusy(d);
    try {
      const res = await api.ticketDecision(ticket.ticketId, d);
      setRouteNote(res.note);
      swalToast("success", t("msg.decisionSaved"));
      onChanged();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="rounded-xl2 border border-line bg-card">
      <PanelHead title={t("crm.claimTitle")} right={ticket.status ? t(`st.${ticket.status}`) : ""} />
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <Chip>{ticket.ticketId}</Chip>
          <span className="rounded-xl2 border border-line bg-wait-tint px-2.5 py-1 text-[11px] font-semibold text-wait">{ticket.repairType ?? "—"}</span>
        </div>
        <p className="mb-4 text-[13px] text-ink2">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">{t("crm.symptom")}</span>
          {ticket.issueType}
          {ticket.description ? ` — ${ticket.description}` : ""}
        </p>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{t("crm.decision")}</div>
        <div className="grid grid-cols-2 gap-2">
          {DECISIONS.map((d) => (
            <button
              key={d.key}
              onClick={() => decide(d.key)}
              disabled={!!busy}
              className="rounded-xl2 border border-line bg-card px-3 py-2.5 text-left text-[12.5px] font-semibold text-ink2 transition hover:border-ink disabled:opacity-50"
            >
              {busy === d.key ? "…" : t(d.labelKey)}
            </button>
          ))}
        </div>
        {routeNote && (
          <div className="mt-4 rounded-xl2 border border-line border-l-[3px] border-l-brand bg-canvas p-3.5 text-[12.5px] text-ink2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand">{t("crm.routing")}</div>
            {routeNote}
          </div>
        )}
      </div>
    </section>
  );
}

function PanelHead({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line2 px-5 py-4">
      <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
      {right && <span className="text-[11.5px] text-muted">{right}</span>}
    </div>
  );
}

function InteractionPanel({ data, onChanged }: { data: CrmResult; onChanged: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl2 border border-line bg-card">
      <PanelHead title={t("crm.logTitle")} right={t("crm.logCount", { n: data.interactions.length })} />
      <div className="px-5 pt-5">
        {data.interactions.length === 0 ? (
          <p className="pb-2 text-sm text-muted">{t("crm.noLog")}</p>
        ) : (
          <ol>
            {data.interactions.map((it, i) => (
              <LogItem key={it.id} it={it} n={data.interactions.length - i} />
            ))}
          </ol>
        )}
      </div>
      <div className="px-5 pb-5 pt-1">
        <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl2 border border-dashed border-line py-3 text-[13.5px] font-semibold text-ink2 transition hover:border-ink">
          <Icon name="plus" size={16} />
          {t("crm.addLog")}
        </button>
      </div>
      {open && <AddInteraction serial={data.serial} onClose={() => setOpen(false)} onSaved={onChanged} />}
    </section>
  );
}

function LogItem({ it, n }: { it: InteractionRow; n: number }) {
  const { t } = useI18n();
  const cls = STATUS_CLS[it.status] ?? STATUS_CLS.wait;
  const border = it.status === "ok" ? "border-l-green" : it.status === "open" ? "border-l-red" : "border-l-wait";
  const statusLabel = it.status === "ok" ? t("crm.sOk") : it.status === "open" ? t("crm.sOpen") : t("crm.sWait");
  return (
    <li className="relative pb-5 pl-9">
      <span className="absolute left-0 top-0.5 flex h-6 w-6 items-center justify-center rounded-xl2 border border-line bg-card text-[11px] font-bold text-muted">{n}</span>
      <span className="absolute bottom-0 left-[11px] top-7 w-px bg-line" />
      <div className={`rounded-xl2 border border-line border-l-[3px] ${border} p-3.5`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <b className="text-[13.5px] font-semibold">{it.staffName ?? "staff"}</b>
          <div className="flex items-center gap-2">
            <span className="rounded-xl2 border border-line bg-canvas px-2 py-0.5 text-[10.5px] font-semibold text-ink2">{t(CHANNEL_KEY[it.channel])}</span>
            <span className="text-[11px] text-muted">{it.createdAt?.slice(0, 16) ?? ""}</span>
          </div>
        </div>
        <p className="mb-2.5 text-[13px] text-ink2">{it.topic}</p>
        <span className={`inline-flex rounded-xl2 px-2.5 py-1 text-[11.5px] font-semibold ${cls}`}>{statusLabel}</span>
      </div>
    </li>
  );
}

function AddInteraction({ serial, onClose, onSaved }: { serial: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [channel, setChannel] = useState("line");
  const [status, setStatus] = useState("wait");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!topic.trim()) {
      swalError(t("crm.enterTopic"));
      return;
    }
    setBusy(true);
    try {
      await api.addInteraction({ serial, channel, status, topic: topic.trim(), staffName: user?.name });
      swalToast("success", t("msg.logSaved"));
      onSaved();
      onClose();
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setBusy(false);
    }
  }

  const Seg = ({ value, set, options }: { value: string; set: (v: string) => void; options: [string, string][] }) => (
    <div className="grid grid-cols-3 gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={`rounded-xl2 border px-2 py-2.5 text-[12.5px] font-semibold transition ${value === v ? "border-ink bg-canvas text-ink" : "border-line text-ink2 hover:border-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Modal open title={t("crm.addLogTitle")} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink2">{t("crm.channelLabel")}</label>
          <Seg value={channel} set={setChannel} options={[["line", t("crm.chLine")], ["phone", t("crm.chPhone")], ["store", t("crm.chStore")]]} />
        </div>
        <TextArea label={t("crm.topicReq")} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("crm.topicHint")} />
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink2">{t("crm.statusLabel")}</label>
          <Seg value={status} set={setStatus} options={[["ok", t("crm.sOk")], ["wait", t("crm.sWait")], ["open", t("crm.sOpen")]]} />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="brand" className="flex-1" onClick={save} disabled={busy}>
            {busy ? t("crm.saving") : t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
