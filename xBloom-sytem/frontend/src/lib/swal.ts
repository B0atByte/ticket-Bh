import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// Bilingual labels (read live so the dialog matches the current language).
const lang = (): "th" | "en" => (localStorage.getItem("xbloom.lang") === "en" ? "en" : "th");
const L = {
  ok: { th: "ตกลง", en: "OK" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  confirm: { th: "ยืนยัน", en: "Confirm" },
  pinRequired: { th: "กรอกรหัสผ่านแอดมิน", en: "Enter admin PIN" },
};
const tr = (k: keyof typeof L) => L[k][lang()];

// Branded look via Tailwind classes (buttonsStyling off). Sharp corners, IBM Plex.
const customClass = {
  popup: "rounded-xl2 font-sans border border-line",
  title: "text-ink",
  htmlContainer: "text-ink2",
  confirmButton: "rounded-xl2 bg-brand px-4 py-2.5 text-sm font-semibold text-white mx-1",
  cancelButton: "rounded-xl2 border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink2 mx-1",
  denyButton: "rounded-xl2 border border-red px-4 py-2.5 text-sm font-semibold text-red mx-1",
  input: "rounded-xl2 border border-line",
};

const base = { buttonsStyling: false, customClass, confirmButtonText: tr("ok") };

export function swalSuccess(title: string, text?: string) {
  return Swal.fire({ icon: "success", title, text, ...base, confirmButtonText: tr("ok") });
}

export function swalError(title: string, text?: string) {
  return Swal.fire({ icon: "error", title, text, ...base, confirmButtonText: tr("ok") });
}

export function swalToast(icon: "success" | "error" | "info" | "warning", title: string) {
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon,
    title,
    showConfirmButton: false,
    timer: 2400,
    timerProgressBar: true,
    customClass: { popup: "rounded-xl2 font-sans border border-line" },
  });
}

/** Yes/no confirmation. Resolves true when confirmed. */
export async function swalConfirm(title: string, text?: string, danger = false) {
  const res = await Swal.fire({
    icon: "warning",
    title,
    text,
    showCancelButton: true,
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: danger ? customClass.denyButton : customClass.confirmButton },
    confirmButtonText: tr("confirm"),
    cancelButtonText: tr("cancel"),
  });
  return res.isConfirmed;
}

/** Admin re-auth prompt. Resolves the entered PIN, or null if cancelled. */
export async function confirmAdminPin(title: string, text?: string): Promise<string | null> {
  const res = await Swal.fire({
    title,
    text,
    icon: "warning",
    input: "password",
    inputAttributes: { autocapitalize: "off", autocomplete: "off" },
    showCancelButton: true,
    buttonsStyling: false,
    customClass: { ...customClass, confirmButton: customClass.denyButton },
    confirmButtonText: tr("confirm"),
    cancelButtonText: tr("cancel"),
    inputValidator: (v) => (!v ? tr("pinRequired") : undefined),
  });
  return res.isConfirmed ? (res.value as string) : null;
}
