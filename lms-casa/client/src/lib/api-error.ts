import { AxiosError } from 'axios';

/**
 * Extract the human-readable message the API sent (our errors are
 * `{ error: { message } }`, usually Thai) instead of axios's generic
 * "Request failed with status code 409". Falls back when none is present.
 */
export function getApiErrorMessage(error: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่'): string {
  if (error instanceof AxiosError) {
    const serverMessage = error.response?.data?.error?.message;
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
    if (error.code === 'ERR_NETWORK') return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่';
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
