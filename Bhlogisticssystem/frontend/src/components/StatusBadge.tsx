import type { OrderStatus } from '../types'

const CONFIG: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING:    { label: 'รอการอนุมัติ', cls: 'bg-amber-50   text-amber-700   ring-amber-200   dark:bg-amber-900/20  dark:text-amber-400  dark:ring-amber-800/60'  },
  APPROVED:   { label: 'อนุมัติแล้ว',  cls: 'bg-blue-50    text-blue-700    ring-blue-200    dark:bg-blue-900/20   dark:text-blue-400   dark:ring-blue-800/60'   },
  ACCEPTED:   { label: 'รับงานแล้ว',   cls: 'bg-violet-50  text-violet-700  ring-violet-200  dark:bg-violet-900/20 dark:text-violet-400 dark:ring-violet-800/60' },
  IN_TRANSIT: { label: 'กำลังส่ง',     cls: 'bg-indigo-50  text-indigo-700  ring-indigo-200  dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-800/60' },
  DELIVERED:  { label: 'ส่งแล้ว',      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800/60' },
  REJECTED:   { label: 'ถูกปฏิเสธ',   cls: 'bg-red-50     text-red-700     ring-red-200     dark:bg-red-900/20    dark:text-red-400    dark:ring-red-800/60'    },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { label, cls } = CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}
