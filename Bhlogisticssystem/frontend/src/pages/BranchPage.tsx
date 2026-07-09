import { useState, useEffect, useCallback } from 'react'
import { Store, RefreshCw, ArrowLeft, Package, User, Clock, ImageIcon, Loader2, ClipboardList, Truck, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { Order, OrdersResponse, OrderStatus } from '../types'
import { OrderCard } from '../components/OrderCard'
import { OrderListSkeleton } from '../components/OrderCardSkeleton'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { StatusBadge } from '../components/StatusBadge'
import { AppLayout, ContentHeader } from '../components/AppLayout'

const BRANCHES = [
  { id: 'BRANCH-001', name: 'สาขา 1' },
  { id: 'BRANCH-002', name: 'สาขา 2' },
  { id: 'BRANCH-003', name: 'สาขา 3' },
  { id: 'BRANCH-004', name: 'สาขา 4' },
]

const LIMIT = 10

function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 ${className}`}>
        <div className="flex flex-col items-center gap-1">
          <ImageIcon size={18} className="opacity-40" />
          <span className="text-xs opacity-60">โหลดไม่ได้</span>
        </div>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />
}

export function BranchPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('all')

  const [orders, setOrders] = useState<Order[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')

  const branchId = user?.branchId ?? BRANCHES[0].id
  const branchName = BRANCHES.find((b) => b.id === branchId)?.name ?? branchId

  // Map tab → status filter
  const tabToStatus: Record<string, OrderStatus | ''> = {
    all:         '',
    inprogress:  'IN_TRANSIT',
    delivered:   'DELIVERED',
  }

  const loadOrders = useCallback(async (p = page, q = search) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      const status = tabToStatus[tab]
      if (status) params.set('status', status)
      if (q) params.set('search', q)
      const data = await api.get<OrdersResponse>(`/orders?${params}`)
      setOrders(data.orders)
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [tab, page, search, toast])

  useEffect(() => {
    setPage(1); loadOrders(1, search)
  }, [tab])

  useEffect(() => {
    loadOrders(page, search)
  }, [page])

  const handleSearch = useCallback((val: string) => {
    setSearch(val); setPage(1); loadOrders(1, val)
  }, [loadOrders])

  async function openDetail(order: Order) {
    setSelectedOrder(order); setDetailLoading(true)
    try {
      const fresh = await api.get<Order>(`/orders/${order.id}`)
      setSelectedOrder(fresh)
    } catch { /* keep cached */ }
    finally { setDetailLoading(false) }
  }

  const NAV = [
    { id: 'all',        label: 'ทั้งหมด',  icon: ClipboardList, badge: undefined },
    { id: 'inprogress', label: 'กำลังมา',  icon: Truck },
    { id: 'delivered',  label: 'ส่งแล้ว',  icon: CheckCircle2 },
  ]

  // ─── Order Detail View ───
  if (selectedOrder) {
    const hasPickup   = Array.isArray(selectedOrder.pickupPhotos)  && selectedOrder.pickupPhotos.length > 0
    const hasDropoff  = Array.isArray(selectedOrder.dropoffPhotos) && selectedOrder.dropoffPhotos.length > 0
    const hasSig      = !!selectedOrder.signatureUrl

    return (
      <AppLayout navItems={NAV} activeTab={tab} onTabChange={setTab} roleIcon={Store} roleColor="bg-teal-600">
        <div className="flex-1">
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10 flex items-center gap-2">
            <button onClick={() => setSelectedOrder(null)}
              className="p-1.5 -ml-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedOrder.orderNo}</p>
              <div className="mt-0.5"><StatusBadge status={selectedOrder.status} /></div>
            </div>
            {detailLoading && <Loader2 size={15} className="text-blue-600 animate-spin shrink-0" />}
          </div>

          <div className="p-4 md:p-6 max-w-lg mx-auto space-y-3">
            {/* Info */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">รายการสินค้า</p>
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>
              {selectedOrder.notes && (
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-medium">หมายเหตุ:</span> {selectedOrder.notes}
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5"><User size={12} className="shrink-0" />{selectedOrder.createdBy.name}</div>
                <div className="flex items-center gap-1.5"><Clock size={12} className="shrink-0" />{new Date(selectedOrder.createdAt).toLocaleDateString('th-TH', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</div>
                {selectedOrder.driver && <div>คนขับ: <span className="font-medium text-slate-700 dark:text-slate-300">{selectedOrder.driver.name}</span></div>}
                {selectedOrder.deliveredAt && <div>ส่งเมื่อ: {new Date(selectedOrder.deliveredAt).toLocaleString('th-TH')}</div>}
              </div>
            </div>

            {selectedOrder.initImageUrl && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">รูปภาพ Order</p>
                <SafeImage src={selectedOrder.initImageUrl} alt="order" className="w-full rounded-lg object-cover max-h-48" />
              </div>
            )}

            {hasPickup && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">รูปถ่ายรับสินค้า ({selectedOrder.pickupPhotos.length} รูป)</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedOrder.pickupPhotos.map((url, i) => <SafeImage key={i} src={url} alt={`pickup-${i+1}`} className="aspect-square rounded object-cover w-full" />)}
                </div>
              </div>
            )}

            {hasDropoff && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">รูปถ่ายส่งสินค้า ({selectedOrder.dropoffPhotos.length} รูป)</p>
                <div className="grid grid-cols-2 gap-2">
                  {selectedOrder.dropoffPhotos.map((url, i) => <SafeImage key={i} src={url} alt={`dropoff-${i+1}`} className="aspect-square rounded object-cover w-full" />)}
                </div>
              </div>
            )}

            {hasSig && (
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">ลายเซ็นผู้รับ</p>
                <div className="border border-slate-200 dark:border-slate-700 rounded bg-white p-2">
                  <SafeImage src={selectedOrder.signatureUrl!} alt="signature" className="w-full h-20 object-contain" />
                </div>
              </div>
            )}

            {['PENDING','APPROVED'].includes(selectedOrder.status) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-400">
                {selectedOrder.status === 'PENDING' ? 'รอการอนุมัติจากแอดมิน' : 'อนุมัติแล้ว รอคนขับรับงาน'}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  // ─── Main List ───
  return (
    <AppLayout navItems={NAV} activeTab={tab} onTabChange={(t) => { setTab(t); setExpandedId(null); setSelectedOrder(null) }} roleIcon={Store} roleColor="bg-teal-600">
      <ContentHeader
        title={tab === 'all' ? `Orders · ${branchName}` : tab === 'inprogress' ? 'กำลังมา' : 'ส่งแล้ว'}
        subtitle={pagination.total > 0 ? `${pagination.total} รายการ` : undefined}
        action={
          <button onClick={() => loadOrders(page, search)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'ทั้งหมด', value: pagination.total, bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
              { label: 'กำลังมา', value: orders.filter((o) => !['DELIVERED','REJECTED','PENDING'].includes(o.status)).length, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
              { label: 'รับแล้ว', value: orders.filter((o) => o.status === 'DELIVERED').length, bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                <p className={`text-lg font-bold tabular-nums ${s.text}`}>{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Search + Filter */}
          {tab === 'all' && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <SearchInput placeholder="ค้นหา order..." onSearch={handleSearch} />
            </div>
          )}

          {/* List */}
          {loading ? <OrderListSkeleton count={4} /> :
           orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
              <Package size={28} className="opacity-40" />
              <p className="text-sm">{tab === 'inprogress' ? 'ไม่มีงานที่กำลังส่ง' : tab === 'delivered' ? 'ยังไม่มี order ที่ส่งแล้ว' : 'ยังไม่มี order'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">กดที่ order เพื่อดูรายละเอียด</p>
              {orders.map((order) => (
                <OrderCard key={order.id} order={order}
                  expanded={expandedId === order.id}
                  onClick={() => openDetail(order)}
                />
              ))}
              <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={LIMIT}
                onChange={(p) => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
