import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type TicketPayload } from "../lib/api";
import { Banner, Button, Card, FileField, PageTitle, SelectField, TextArea, TextField } from "../components/ui";
import { Icon } from "../components/Icon";
import ScanSerial from "../components/ScanSerial";
import { useI18n } from "../lib/i18n";
import { swalError, swalToast } from "../lib/swal";
import * as v from "../lib/validate";

// Localized labels via i18n; the stored value stays a stable English string
// so existing tickets and staff-side display remain consistent.
const ISSUE_TYPES = [
  { value: "Machine won't turn on", labelKey: "issue.power" },
  { value: "Grinding problem", labelKey: "issue.grind" },
  { value: "Screen issue", labelKey: "issue.screen" },
  { value: "Water leak", labelKey: "issue.leak" },
  { value: "Unusual noise", labelKey: "issue.noise" },
  { value: "Water not heating", labelKey: "issue.noHeat" },
  { value: "Water not flowing", labelKey: "issue.noFlow" },
  { value: "App won't connect", labelKey: "issue.app" },
  { value: "Missing / damaged parts", labelKey: "issue.parts" },
  { value: "Other", labelKey: "issue.other" },
];

const REPAIR_TYPES = [
  { value: "warranty" as const, labelKey: "rep.rtWarranty", helperKey: "rep.rtWarrantyHelp" },
  { value: "standard" as const, labelKey: "rep.rtStandard", helperKey: "rep.rtStandardHelp" },
];

const MAX_VIDEO = 50 * 1024 * 1024;

type Form = {
  serial: string;
  repairType: "warranty" | "standard";
  name: string;
  phone: string;
  email: string;
  lineId: string;
  issueType: string;
  description: string;
  logUrl: string;
};
const empty: Form = {
  serial: "",
  repairType: "warranty",
  name: "",
  phone: "",
  email: "",
  lineId: "",
  issueType: ISSUE_TYPES[0].value,
  description: "",
  logUrl: "",
};

export default function Report() {
  const { t } = useI18n();
  const [form, setForm] = useState<Form>(empty);
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [serialStatus, setSerialStatus] = useState<string>("");
  // Owner found for this serial → ask for last-4 phone before releasing details.
  const [prefillHint, setPrefillHint] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: TicketPayload = {
        serial: form.serial.trim(),
        repairType: form.repairType,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        lineId: form.lineId.trim() || undefined,
        issueType: form.issueType,
        description: form.description.trim() || undefined,
        logUrl: form.logUrl.trim() || undefined,
        videoFilename: video?.name || undefined,
        videoUrl: videoUrl || undefined,
      };
      return api.createTicket(payload);
    },
    onSuccess: () => swalToast("success", t("msg.caseReceived")),
    onError: (e) => swalError(e instanceof Error ? e.message : t("msg.error")),
  });

  async function checkSerial(value?: string) {
    const s = (value ?? form.serial).trim();
    if (!s) return;
    setSerialStatus("checking");
    try {
      const c = await api.coverage(s);
      setSerialStatus(c.noWarranty ? "no-warranty" : c.active ? "active" : "expired");
    } catch (e) {
      setSerialStatus(e instanceof ApiError && e.status === 404 ? "not-found" : "");
    }
    // If a registered owner exists, offer to autofill after last-4 verification.
    setPrefillHint(null);
    setVerifyCode("");
    try {
      const p = await api.reportPrefill(s);
      if (p.found && p.needsVerify && p.phoneHint) setPrefillHint(p.phoneHint);
    } catch {
      /* prefill lookup is optional — ignore failures */
    }
  }

  async function verifyAndFill() {
    const s = form.serial.trim();
    const code = verifyCode.replace(/\D/g, "");
    if (!s || code.length < 4) return;
    setVerifying(true);
    try {
      const p = await api.reportPrefill(s, code);
      if (!p.verified) {
        swalError(t("rep.verifyFailTitle"), t("rep.verifyFailMsg"));
        return;
      }
      const patch: Partial<Form> = {};
      if (!form.name.trim() && p.name) patch.name = p.name;
      if (!form.phone.trim() && p.phone) patch.phone = p.phone;
      if (!form.email.trim() && p.email) patch.email = p.email;
      if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }));
      setPrefillHint(null);
      setVerifyCode("");
      swalToast("success", t("rep.prefilled"));
    } catch (e) {
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setVerifying(false);
    }
  }

  async function pickVideo(f: File | null) {
    if (f && f.size > MAX_VIDEO) {
      setErrors((e) => ({ ...e, video: t("rep.videoHint") }));
      return;
    }
    setErrors((e) => ({ ...e, video: "" }));
    setVideo(f);
    setVideoUrl("");
    if (!f) return;
    setUploading(true);
    try {
      const res = await api.uploadFile(f, "video");
      setVideoUrl(res.url);
    } catch (e) {
      setVideo(null);
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const e: Record<string, string> = {
      serial: v.required(t, form.serial, t("reg.serial")),
      name: v.required(t, form.name, t("rep.yourName")),
      phone: v.phone(t, form.phone),
      email: v.email(t, form.email),
      logUrl: v.url(t, form.logUrl),
    };
    setErrors((prev) => ({ ...prev, ...e }));
    if (v.isClean(e)) mutation.mutate();
  }

  if (mutation.isSuccess) {
    const id = mutation.data.ticketId;
    return (
      <Card className="fade-in text-center">
        <div className="text-2xl font-bold text-ink">{t("rep.receivedTitle")}</div>
        <p className="mt-2 text-sm text-muted">{t("rep.subtitle")}</p>
        <div className="mt-5 rounded-xl2 bg-canvas p-4">
          <div className="text-xs text-muted">{t("rep.caseId")}</div>
          <div className="mono text-lg font-medium tracking-wide text-ink">{id}</div>
        </div>
        <div className="mt-5 space-y-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              navigator.clipboard?.writeText(id);
              setCopied(true);
            }}
          >
            {copied ? t("rep.copied") : t("rep.copy")}
          </Button>
          <Link to={`/track?q=${encodeURIComponent(id)}`}>
            <Button className="w-full">{t("rep.trackThis")}</Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setForm(empty);
              setVideo(null);
              setVideoUrl("");
              setErrors({});
              setCopied(false);
              setSerialStatus("");
              setPrefillHint(null);
              setVerifyCode("");
              mutation.reset();
            }}
          >
            {t("rep.another")}
          </Button>
        </div>
      </Card>
    );
  }

  const helperKey = REPAIR_TYPES.find((r) => r.value === form.repairType)?.helperKey;

  return (
    <div className="fade-in">
      <PageTitle title={t("rep.title")} subtitle={t("rep.subtitle")} />
      <Card>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm text-ink">{t("cov.serial")}</span>
              {errors.serial && <span className="text-xs text-red">{errors.serial}</span>}
            </div>
            <div className="flex gap-2">
              <input
                value={form.serial}
                onChange={set("serial")}
                placeholder="J15A01BXXX"
                className={`min-w-0 flex-1 rounded-xl2 border bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand ${
                  errors.serial ? "border-red" : "border-line"
                }`}
              />
              <button
                type="button"
                onClick={() => checkSerial()}
                className="shrink-0 rounded-xl2 border border-line bg-card px-4 text-sm font-medium text-ink transition hover:bg-canvas"
              >
                {t("cov.check")}
              </button>
              <ScanSerial
                onResult={(sn) => {
                  setForm((f) => ({ ...f, serial: sn }));
                  checkSerial(sn);
                }}
              />
            </div>
            {serialStatus && (
              <p className="mt-1 flex items-center gap-1.5 text-xs">
                {serialStatus === "checking" && <span className="text-muted">{t("common.loading")}</span>}
                {serialStatus === "active" && (
                  <span className="flex items-center gap-1 text-green">
                    <Icon name="check" size={13} /> {t("rep.snActive")}
                  </span>
                )}
                {serialStatus === "expired" && (
                  <span className="flex items-center gap-1 text-red">
                    <Icon name="alert" size={13} /> {t("rep.snExpired")}
                  </span>
                )}
                {serialStatus === "no-warranty" && <span className="text-muted">{t("rep.snNoWarranty")}</span>}
                {serialStatus === "not-found" && <span className="text-muted">{t("rep.snNotFound")}</span>}
              </p>
            )}

            {prefillHint && (
              <div className="mt-2 rounded-xl2 border border-line bg-canvas p-3">
                <p className="text-xs text-muted">{t("rep.verifyPrompt", { hint: prefillHint })}</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => e.key === "Enter" && verifyAndFill()}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="1234"
                    className="w-24 rounded-xl2 border border-line bg-white px-3 py-2 text-sm tracking-widest text-ink outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={verifyAndFill}
                    disabled={verifying || verifyCode.length < 4}
                    className="shrink-0 rounded-xl2 border border-line bg-card px-4 text-sm font-medium text-ink transition hover:bg-canvas disabled:opacity-50"
                  >
                    {verifying ? t("common.loading") : t("rep.verifyBtn")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <SelectField label={t("rep.repairType")} value={form.repairType} onChange={set("repairType")}>
            {REPAIR_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {t(r.labelKey)}
              </option>
            ))}
          </SelectField>
          {helperKey && <Banner kind="info">{t(helperKey)}</Banner>}

          <TextField label={t("rep.yourName")} value={form.name} onChange={set("name")} error={errors.name} />
          <TextField label={t("reg.phone")} value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="numeric" placeholder="08xxxxxxxx" />
          <TextField label={t("reg.email")} type="email" value={form.email} onChange={set("email")} error={errors.email} />
          <TextField label="LINE ID" value={form.lineId} onChange={set("lineId")} />

          <SelectField label={t("rep.issueType")} value={form.issueType} onChange={set("issueType")}>
            {ISSUE_TYPES.map((it) => (
              <option key={it.value} value={it.value}>
                {t(it.labelKey)}
              </option>
            ))}
          </SelectField>

          <TextArea label={t("rep.describe")} value={form.description} onChange={set("description")} placeholder={t("rep.describeHint")} />
          <TextField label={t("rep.logUrl")} value={form.logUrl} onChange={set("logUrl")} error={errors.logUrl} placeholder="xBloom app → Settings → Send Log → Copy Link" />
          <FileField label={t("rep.video")} accept="video/mp4,video/quicktime" fileName={video?.name} onPick={pickVideo} error={errors.video} hint={uploading ? t("common.loading") : t("rep.videoHint")} />

          <Button variant="brand" className="w-full" onClick={submit} disabled={mutation.isPending || uploading}>
            {mutation.isPending ? t("rep.submitting") : t("rep.submit")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
