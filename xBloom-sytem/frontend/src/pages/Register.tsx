import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type RegisterPayload } from "../lib/api";
import { Button, Card, Field, FileField, PageTitle, SelectField, TextField } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { swalError, swalToast } from "../lib/swal";
import ScanSerial from "../components/ScanSerial";
import ThaiAddressPicker from "../components/ThaiAddressPicker";
import * as v from "../lib/validate";

const MODELS = [
  "xBloom Studio Midnight Black",
  "xBloom Studio Moonlight White",
  "xBloom Studio Sage Green (Green Knob)",
  "xBloom Studio Sage Green (Gold Knob)",
  "xBloom Studio Twilight",
];

type Form = {
  serial: string;
  product: string;
  company: string;
  purchaseDate: string;
  name: string;
  phone: string;
  email: string;
  postal: string;
  houseNo: string;
  building: string;
  subdistrict: string;
  district: string;
  province: string;
  address: string;
  receiptDriveUrl: string;
};

const empty: Form = {
  serial: "",
  product: MODELS[0],
  company: "xBloom Thailand",
  purchaseDate: "",
  name: "",
  phone: "",
  email: "",
  postal: "",
  houseNo: "",
  building: "",
  subdistrict: "",
  district: "",
  province: "",
  address: "",
  receiptDriveUrl: "",
};

const STEP_KEYS = ["reg.step1", "reg.step2", "reg.step3"];

export default function Register() {
  const { t } = useI18n();
  const [step, setStep] = useState(0); // 0,1,2 = steps; 3 = review
  const [form, setForm] = useState<Form>(empty);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleReceipt(file: File | null) {
    setReceipt(file);
    setReceiptUrl("");
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadFile(file, "image");
      setReceiptUrl(res.url);
    } catch (e) {
      setReceipt(null);
      swalError(e instanceof Error ? e.message : t("msg.error"));
    } finally {
      setUploading(false);
    }
  }

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: RegisterPayload = {
        serial: form.serial.trim(),
        product: form.product,
        company: form.company.trim() || undefined,
        purchaseDate: form.purchaseDate,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
        postal: form.postal?.trim() || undefined,
        houseNo: form.houseNo?.trim() || undefined,
        building: form.building?.trim() || undefined,
        subdistrict: form.subdistrict?.trim() || undefined,
        district: form.district?.trim() || undefined,
        province: form.province?.trim() || undefined,
        receiptName: receipt?.name || undefined,
        receiptDriveUrl: receiptUrl || undefined,
      };
      return api.registerWarranty(payload);
    },
    onSuccess: () => swalToast("success", t("msg.registered")),
    onError: (e) => swalError(e instanceof Error ? e.message : t("msg.error")),
  });

  function validateStep(sIdx: number): boolean {
    const e: Record<string, string> = {};
    if (sIdx === 0) {
      e.serial = v.required(t, form.serial, t("reg.serial"));
      e.product = v.required(t, form.product, t("reg.model"));
      e.purchaseDate = v.date(t, form.purchaseDate);
    } else if (sIdx === 1) {
      e.name = v.required(t, form.name, t("reg.fullName"));
      e.phone = v.phone(t, form.phone);
      e.email = v.email(t, form.email ?? "");
    } else if (sIdx === 2) {
      e.postal = v.postal(t, form.postal ?? "");
      e.receiptDriveUrl = v.url(t, form.receiptDriveUrl ?? "");
    }
    setErrors(e);
    return v.isClean(e);
  }

  function next() {
    if (validateStep(step)) setStep((s) => s + 1);
  }

  if (mutation.isSuccess) {
    return (
      <Card className="fade-in text-center">
        <div className="text-2xl font-bold text-ink">{t("reg.successTitle")}</div>
        <p className="mt-2 text-sm text-muted">{t("reg.successSub")}</p>
        <div className="mt-5 rounded-xl2 bg-canvas p-4 text-sm">
          <Field k={t("reg.serial")} v={mutation.data.serial} />
          <Field k={t("cov.end")} v={mutation.data.expiryDate} />
        </div>
        <div className="mt-6 space-y-2">
          <Link to="/warranty">
            <Button className="w-full">{t("reg.viewWarranty")}</Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setForm(empty);
              setReceipt(null);
              setReceiptUrl("");
              setConsent(false);
              setErrors({});
              setStep(0);
              mutation.reset();
            }}
          >
            {t("reg.another")}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="fade-in">
      <PageTitle title={t("reg.title")} subtitle={t("reg.step", { n: step < 3 ? step + 1 : 3, name: t(STEP_KEYS[Math.min(step, 2)]) })} />

      <div className="mb-5 flex gap-2">
        {STEP_KEYS.map((key, i) => (
          <div key={key} className={`h-0.5 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>

      <Card>
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <TextField label={t("reg.serial")} value={form.serial} onChange={set("serial")} error={errors.serial} placeholder="J15A01BXXX" hint={t("reg.serialHint")} />
              <ScanSerial className="mt-2 w-full" onResult={(sn) => setForm((f) => ({ ...f, serial: sn }))} />
            </div>
            <SelectField label={t("reg.model")} value={form.product} onChange={set("product")} error={errors.product}>
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectField>
            <TextField label={t("reg.purchasedFrom")} value={form.company} onChange={set("company")} />
            <TextField label={t("reg.purchaseDate")} type="date" value={form.purchaseDate} onChange={set("purchaseDate")} error={errors.purchaseDate} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <TextField label={t("reg.fullName")} value={form.name} onChange={set("name")} error={errors.name} />
            <TextField label={t("reg.phone")} value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="numeric" placeholder="08xxxxxxxx" />
            <TextField label={t("reg.email")} type="email" value={form.email} onChange={set("email")} error={errors.email} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <TextField label={t("reg.houseNo")} value={form.houseNo} onChange={set("houseNo")} />
            <TextField label={t("reg.building")} value={form.building} onChange={set("building")} />
            <ThaiAddressPicker
              province={form.province}
              district={form.district}
              subdistrict={form.subdistrict}
              postal={form.postal}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />
            <FileField label={t("reg.receipt")} accept="image/*" fileName={receipt?.name} onPick={handleReceipt} hint={uploading ? t("common.loading") : t("reg.receiptHint")} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-1 text-sm">
            <h3 className="mb-2 font-medium text-ink">{t("reg.review")}</h3>
            <Field k={t("reg.serial")} v={form.serial} />
            <Field k={t("reg.model")} v={form.product} />
            <Field k={t("reg.purchasedFrom")} v={form.company} />
            <Field k={t("reg.purchaseDate")} v={form.purchaseDate} />
            <Field k={t("reg.fullName")} v={form.name} />
            <Field k={t("reg.phone")} v={form.phone} />
            <Field k={t("reg.email")} v={form.email || "—"} />
            <Field k={t("reg.step3")} v={[form.houseNo, form.building, form.subdistrict, form.district, form.province, form.postal].filter(Boolean).join(" ") || "—"} />
            <Field k={t("reg.receipt")} v={receipt?.name ?? "—"} />
            <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-line pt-3 text-[12.5px] text-ink2">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t("reg.consent")}</span>
            </label>
          </div>
        )}
      </Card>

      <div className="mt-4 flex gap-3">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={mutation.isPending}>
            {t("common.back")}
          </Button>
        )}
        {step < 3 ? (
          <Button className="flex-1" onClick={next}>
            {t("common.continue")}
          </Button>
        ) : (
          <Button
            variant="brand"
            className="flex-1"
            onClick={() => (consent ? mutation.mutate() : swalError(t("reg.consentRequired")))}
            disabled={mutation.isPending || uploading}
          >
            {mutation.isPending ? t("reg.submitting") : t("reg.submit")}
          </Button>
        )}
      </div>
    </div>
  );
}
