// Shared SweetAlert2 confirmation helpers — dynamic import so it doesn't block initial bundle
import DOMPurify from 'dompurify';

// SweetAlert2 v11 renders `html` as raw HTML with no built-in sanitizer, so any
// caller-interpolated value (course/exam/user names) is a stored-XSS sink. Every
// helper below routes `html` through DOMPurify before handing it to Swal.
function safe(html: string): string {
  return DOMPurify.sanitize(html);
}

export async function confirmDanger(title: string, html: string, confirmText = 'ลบ'): Promise<boolean> {
  const { default: Swal } = await import('sweetalert2');
  const result = await Swal.fire({
    title,
    html: safe(html),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export async function confirmAction(title: string, html: string, confirmText = 'ยืนยัน'): Promise<boolean> {
  const { default: Swal } = await import('sweetalert2');
  const result = await Swal.fire({
    title,
    html: safe(html),
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#2563eb',
    cancelButtonColor: '#94a3b8',
    confirmButtonText: confirmText,
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
  });
  return result.isConfirmed;
}

export async function alertWarning(title: string, html: string): Promise<void> {
  const { default: Swal } = await import('sweetalert2');
  await Swal.fire({ title, html: safe(html), icon: 'warning', confirmButtonColor: '#2563eb' });
}

/** Non-blocking success toast (top-right, auto-dismiss). Use after save/create/update/delete. */
export async function toastSuccess(title = 'บันทึกสำเร็จ'): Promise<void> {
  const { default: Swal } = await import('sweetalert2');
  await Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
  });
}
