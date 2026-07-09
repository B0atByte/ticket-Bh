import { useEffect, useState } from "react";
import { SelectField, TextField } from "./ui";
import { useI18n } from "../lib/i18n";

// Compact Thai address dataset (จังหวัด → อำเภอ → ตำบล + รหัสไปรษณีย์),
// served as a static asset and fetched once when this picker mounts.
type Sub = { t: string; z: string };
type Amp = { d: string; s: Sub[] };
type Prov = { p: string; a: Amp[] };

let cache: Prov[] | null = null;

export type AddressPatch = Partial<{ province: string; district: string; subdistrict: string; postal: string }>;

export default function ThaiAddressPicker({
  province,
  district,
  subdistrict,
  postal,
  onChange,
}: {
  province: string;
  district: string;
  subdistrict: string;
  postal: string;
  onChange: (patch: AddressPatch) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<Prov[] | null>(cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    fetch("/thaiAddress.json")
      .then((r) => r.json())
      .then((d: Prov[]) => {
        cache = d;
        if (alive) setData(d);
      })
      .catch(() => {
        /* offline / asset missing — selects just stay empty */
      });
    return () => {
      alive = false;
    };
  }, []);

  const prov = data?.find((p) => p.p === province);
  const amp = prov?.a.find((a) => a.d === district);

  if (!data) return <p className="py-2 text-sm text-muted">{t("common.loading")}</p>;

  return (
    <>
      <SelectField
        label={t("reg.province")}
        value={province}
        onChange={(e) => onChange({ province: e.target.value, district: "", subdistrict: "", postal: "" })}
      >
        <option value="">{t("reg.selectProvince")}</option>
        {data.map((p) => (
          <option key={p.p} value={p.p}>
            {p.p}
          </option>
        ))}
      </SelectField>

      <SelectField
        label={t("reg.district")}
        value={district}
        disabled={!prov}
        onChange={(e) => onChange({ district: e.target.value, subdistrict: "", postal: "" })}
      >
        <option value="">{t("reg.selectDistrict")}</option>
        {prov?.a.map((a) => (
          <option key={a.d} value={a.d}>
            {a.d}
          </option>
        ))}
      </SelectField>

      <SelectField
        label={t("reg.subdistrict")}
        value={subdistrict}
        disabled={!amp}
        onChange={(e) => {
          const s = amp?.s.find((x) => x.t === e.target.value);
          onChange({ subdistrict: e.target.value, postal: s?.z ?? "" });
        }}
      >
        <option value="">{t("reg.selectSubdistrict")}</option>
        {amp?.s.map((s) => (
          <option key={s.t} value={s.t}>
            {s.t}
          </option>
        ))}
      </SelectField>

      <TextField label={t("reg.postcode")} value={postal} readOnly inputMode="numeric" hint={t("reg.postalAuto")} />
    </>
  );
}
