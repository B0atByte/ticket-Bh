import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useI18n } from "../lib/i18n";

export function Logo({ label = "After-Sales", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src="/xbloom-logo.png" alt="xBloom" className="h-9 w-9 flex-none rounded-xl2" />
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-[0.06em] text-muted">Brewing Happiness</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-ink">xBloom</span>
          <span className="h-[5px] w-[5px] bg-accent" />
          <span className="text-[12.5px] font-semibold text-ink2">{label}</span>
          <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">DEMO</span>
        </div>
      </div>
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-3xl font-light leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl2 border border-line bg-card p-5 ${className}`}>{children}</div>;
}

const dotColor: Record<string, string> = {
  brown: "bg-brown",
  green: "bg-green2",
  red: "bg-red",
  grey: "bg-grey",
};
export function StatusDot({ color = "grey" }: { color?: "brown" | "green" | "red" | "grey" }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${dotColor[color]}`} />;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: { variant?: "primary" | "brand" | "secondary" | "ghost" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
  }) {
  const styles = {
    primary: "bg-ink text-white hover:opacity-90 disabled:opacity-40",
    brand: "bg-brand text-white hover:opacity-90 disabled:opacity-40",
    secondary: "border border-line bg-card text-ink hover:bg-canvas disabled:opacity-40",
    ghost: "text-brand hover:bg-brown-tint",
    danger: "border border-red text-red hover:bg-red-tint disabled:opacity-40",
  }[variant];
  return (
    <button
      className={`rounded-xl2 px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Label({ label, error }: { label: string; error?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between">
      <span className="text-sm text-ink">{label}</span>
      {error && <span className="text-xs text-red">{error}</span>}
    </div>
  );
}

const fieldClass = (error?: string) =>
  `w-full rounded-xl2 border bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brown ${
    error ? "border-red" : "border-line"
  }`;

export function TextField({
  label,
  error,
  hint,
  ...props
}: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <Label label={label} error={error} />
      <input className={fieldClass(error)} {...props} />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </label>
  );
}

export function TextArea({
  label,
  error,
  ...props
}: { label: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <Label label={label} error={error} />
      <textarea rows={4} className={fieldClass(error)} {...props} />
    </label>
  );
}

export function SelectField({
  label,
  error,
  children,
  ...props
}: { label: string; error?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <Label label={label} error={error} />
      <select className={fieldClass(error)} {...props}>
        {children}
      </select>
    </label>
  );
}

export function FileField({
  label,
  accept,
  error,
  fileName,
  onPick,
  hint,
}: {
  label: string;
  accept: string;
  error?: string;
  fileName?: string;
  hint?: string;
  onPick: (file: File | null) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      <Label label={label} error={error} />
      <label className="flex cursor-pointer items-center justify-between rounded-xl2 border border-dashed border-line bg-white px-3 py-3 text-sm hover:border-brown">
        <span className={fileName ? "text-ink" : "text-muted"}>{fileName ?? t("common.chooseFile")}</span>
        <span className="text-brown">{t("common.choose")}</span>
        <input type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Banner({ kind, children }: { kind: "success" | "error" | "info"; children: ReactNode }) {
  const styles = {
    success: "bg-green-tint text-green border border-line",
    error: "bg-red-tint text-red border border-line",
    info: "bg-brown-tint text-brown border border-line",
  }[kind];
  return <div className={`rounded-xl2 px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

export function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v ?? "—"}</span>
    </div>
  );
}
