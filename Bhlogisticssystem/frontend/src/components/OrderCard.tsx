import type { ReactNode } from 'react'
import { ChevronRight, Clock, MapPin, Package, StickyNote, Truck, User } from 'lucide-react'
import type { Order } from '../types'
import { StatusBadge } from './StatusBadge'

interface Props {
  order: Order
  actions?: ReactNode
  expanded?: boolean
  onClick?: () => void
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getItemSummary(order: Order) {
  if (!order.items.length) return 'ไม่มีรายการสินค้า'
  const [first, second] = order.items
  if (order.items.length === 1) return `${first.name} · ${first.quantity} ${first.unit}`
  return `${first.name}, ${second.name}${order.items.length > 2 ? ` +${order.items.length - 2}` : ''}`
}

export function OrderCard({ order, actions, expanded, onClick }: Props) {
  return (
    <div
      className={`group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 ${
        onClick ? 'cursor-pointer hover:border-blue-200 hover:shadow-md dark:hover:border-blue-900' : ''
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-slate-950 dark:text-slate-50">
                {order.orderNo}
              </p>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {getItemSummary(order)}
            </p>
          </div>

          {onClick && (
            <ChevronRight
              size={18}
              className={`mt-1 shrink-0 text-slate-300 transition-transform group-hover:text-blue-500 ${
                expanded ? 'rotate-90 text-blue-500' : ''
              }`}
            />
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
              <MapPin size={12} />
              <span>ปลายทาง</span>
            </div>
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{order.branchId}</p>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
              <Package size={12} />
              <span>สินค้า</span>
            </div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{order.items.length} รายการ</p>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
              <User size={12} />
              <span>ผู้สร้าง</span>
            </div>
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{order.createdBy.name}</p>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
            <div className="mb-1 flex items-center gap-1.5 text-slate-400">
              <Clock size={12} />
              <span>เวลา</span>
            </div>
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Package size={13} />
              รายการสินค้า
            </div>

            <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 bg-white px-3 py-2.5 text-sm dark:bg-slate-900">
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-950 dark:text-slate-50">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                <StickyNote size={14} className="mt-0.5 shrink-0" />
                <span>{order.notes}</span>
              </div>
            )}

            {order.driver && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Truck size={14} className="text-slate-400" />
                <span>คนขับ: </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{order.driver.name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {actions && (
        <div
          className="flex gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/30"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
