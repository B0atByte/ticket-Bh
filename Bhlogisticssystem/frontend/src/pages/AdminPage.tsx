import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, Check, X, ChevronDown, Users, Plus, LayoutDashboard, Clock, RefreshCw, ShieldCheck, Settings, Save, RotateCcw, ImagePlus, Trash2, ArrowLeft, ImageIcon, Truck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { Order, OrdersResponse, OrderStatus } from '../types'
import { OrderCard } from '../components/OrderCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { OrderListSkeleton } from '../components/OrderCardSkeleton'
import { AppLayout, ContentHeader } from '../components/AppLayout'
import { StatusBadge } from '../components/StatusBadge'
import { DEFAULT_SETTINGS, loadSettings, saveSystemSettings, type SystemSettings } from '../lib/settings'

const STATUS_OPTS: { value: OrderStatus | ''; label: string }[] = [
  { value: '',           label: 'ทุกสถานะ'    },
  { value: 'PENDING',    label: 'รอการอนุมัติ' },
  { value: 'APPROVED',   label: 'อนุมัติแล้ว'  },
  { value: 'ACCEPTED',   label: 'รับงานแล้ว'   },
  { value: 'IN_TRANSIT', label: 'กำลังส่ง'     },
  { value: 'DELIVERED',  label: 'ส่งแล้ว'      },
  { value: 'REJECTED',   label: 'ถูกปฏิเสธ'   },
]

const LIMIT = 10
interface RegisterForm { email: string; password: string; name: string; role: string; branchId: string }
const inputCls = 'w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false)
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${className}`}>
        <div className="flex flex-col items-center gap-1">
          <ImageIcon size={18} className="opacity-40" />
          <span className="text-xs opacity-60">โหลดไม่ได้</span>
        </div>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />
}

export function AdminPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('orders')

  const [orders, setOrders] = useState<Order[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<OrderStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirm, setConfirm] = useState<{ orderId: string; action: 'APPROVED' | 'REJECTED' } | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const [showRegForm, setShowRegForm] = useState(false)
  const [regForm, setRegForm] = useState<RegisterForm>({ email: '', password: '', name: '', role: 'KITCHEN', branchId: '' })
  const [regLoading, setRegLoading] = useState(false)
  const [settings, setSettings] = useState<SystemSettings>(loadSettings)

  const searchRef = useRef(search)
  searchRef.current = search

  const loadOrders = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      if (tab === 'pending') {
        params.set('status', 'PENDING')
      } else if (filter) {
        params.set('status', filter)
      }
      if (searchRef.current) params.set('search', searchRef.current)
      const data = await api.get<OrdersResponse>(`/orders?${params}`)
      setOrders(data.orders)
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [filter, tab, page, toast])

  const loadPendingCount = useCallback(async () => {
    try {
      const data = await api.get<OrdersResponse>('/orders?status=PENDING&limit=1')
      setPendingCount(data.pagination.total)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (tab === 'orders' || tab === 'pending') loadOrders(page)
    loadPendingCount()
  }, [tab, page, filter])

  const handleSearch = useCallback((val: string) => {
    setSearch(val); setPage(1)
    searchRef.current = val
    loadOrders(1)
  }, [loadOrders])

  async function doUpdateStatus(orderId: string, status: 'APPROVED' | 'REJECTED') {
    setActionLoading(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status })
      toast.success(status === 'APPROVED' ? 'อนุมัติ order เรียบร้อย' : 'ปฏิเสธ order เรียบร้อย')
      await loadOrders(page)
      loadPendingCount()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setActionLoading(null); setConfirm(null)
    }
  }

  async function openDetail(order: Order) {
    setSelectedOrder(order)
    setDetailLoading(true)
    try {
      const fresh = await api.get<Order>(`/orders/${order.id}`)
      setSelectedOrder(fresh)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โหลดรายละเอียด order ไม่สำเร็จ')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setRegLoading(true)
    try {
      await api.post('/auth/register', { ...regForm, branchId: regForm.branchId || undefined })
      toast.success(`สร้างผู้ใช้ ${regForm.name} เรียบร้อย`)
      setShowRegForm(false)
      setRegForm({ email: '', password: '', name: '', role: 'KITCHEN', branchId: '' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally { setRegLoading(false) }
  }

  function updateSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function saveSettings() {
    saveSystemSettings(settings)
    toast.success('บันทึกการตั้งค่าระบบเรียบร้อย')
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS)
    saveSystemSettings(DEFAULT_SETTINGS)
    toast.info('คืนค่าการตั้งค่าเริ่มต้นแล้ว')
  }

  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }
    if (file.size > 500 * 1024) {
      toast.error('โลโก้ต้องมีขนาดไม่เกิน 500KB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => updateSetting('logoDataUrl', String(reader.result || ''))
    reader.onerror = () => toast.error('อ่านไฟล์โลโก้ไม่สำเร็จ')
    reader.readAsDataURL(file)
  }

  const NAV = [
    { id: 'orders',  label: 'Orders ทั้งหมด', icon: LayoutDashboard },
    { id: 'pending', label: 'รออนุมัติ',       icon: Clock,          badge: pendingCount },
    { id: 'users',   label: 'ผู้ใช้งาน',       icon: Users },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
  ]

  if (selectedOrder) {
    const hasPickup = Array.isArray(selectedOrder.pickupPhotos) && selectedOrder.pickupPhotos.length > 0
    const hasDropoff = Array.isArray(selectedOrder.dropoffPhotos) && selectedOrder.dropoffPhotos.length > 0
    const hasSig = !!selectedOrder.signatureUrl

    return (
      <AppLayout
        navItems={NAV}
        activeTab={tab}
        onTabChange={(t) => { setTab(t); setSelectedOrder(null); setPage(1); setExpandedId(null) }}
        roleIcon={ShieldCheck}
        roleColor="bg-slate-700"
      >
        <div className="flex-1">
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => setSelectedOrder(null)}
              className="-ml-1 rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.orderNo}</p>
              <div className="mt-0.5"><StatusBadge status={selectedOrder.status} /></div>
            </div>
            {detailLoading && <Loader2 size={15} className="shrink-0 animate-spin text-blue-600" />}
          </div>

          <div className="mx-auto max-w-3xl space-y-3 p-4 md:p-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">รายละเอียด Order</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ปลายทาง {selectedOrder.branchId}</p>
                </div>
                {selectedOrder.driver && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Truck size={13} />
                    <span className="font-medium">{selectedOrder.driver.name}</span>
                  </div>
                )}
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">{item.name}</span>
                    <span className="shrink-0 font-semibold text-slate-950 dark:text-slate-50">{item.quantity} {item.unit}</span>
                  </div>
                ))}
              </div>

              {selectedOrder.notes && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <span className="font-medium">หมายเหตุ:</span> {selectedOrder.notes}
                </div>
              )}

              <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
                <div>ผู้สร้าง: <span className="font-medium text-slate-700 dark:text-slate-200">{selectedOrder.createdBy.name}</span></div>
                <div>สร้างเมื่อ: {new Date(selectedOrder.createdAt).toLocaleString('th-TH')}</div>
                {selectedOrder.deliveredAt && <div>ส่งสำเร็จ: {new Date(selectedOrder.deliveredAt).toLocaleString('th-TH')}</div>}
              </div>
            </div>

            {selectedOrder.initImageUrl && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">รูป Order</p>
                <SafeImage src={selectedOrder.initImageUrl} alt="order" className="max-h-64 w-full rounded-lg object-cover" />
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  หลักฐานรับสินค้า {hasPickup ? `(${selectedOrder.pickupPhotos.length} รูป)` : ''}
                </p>
                {hasPickup ? (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedOrder.pickupPhotos.map((url, i) => (
                      <SafeImage key={i} src={url} alt={`pickup-${i + 1}`} className="aspect-square w-full rounded object-cover" />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">ยังไม่มีรูปตอนรับสินค้า</p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  หลักฐานส่งสินค้า {hasDropoff ? `(${selectedOrder.dropoffPhotos.length} รูป)` : ''}
                </p>
                {hasDropoff ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOrder.dropoffPhotos.map((url, i) => (
                      <SafeImage key={i} src={url} alt={`dropoff-${i + 1}`} className="aspect-square w-full rounded object-cover" />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400 dark:bg-slate-800 dark:text-slate-500">ยังไม่มีรูปตอนส่งสินค้า</p>
                )}
              </div>
            </div>

            {hasSig && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">ลายเซ็นผู้รับ</p>
                <div className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700">
                  <SafeImage src={selectedOrder.signatureUrl!} alt="signature" className="h-24 w-full object-contain" />
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
      <AppLayout
        navItems={NAV}
        activeTab={tab}
        onTabChange={(t) => { setTab(t); setPage(1); setExpandedId(null); setSelectedOrder(null) }}
        roleIcon={ShieldCheck}
        roleColor="bg-slate-700"
      >
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.action === 'APPROVED' ? 'อนุมัติ Order' : 'ปฏิเสธ Order'}
        message={confirm?.action === 'APPROVED' ? 'ยืนยันการอนุมัติ order นี้?' : 'ยืนยันการปฏิเสธ order นี้? ไม่สามารถย้อนกลับได้'}
        confirmLabel={confirm?.action === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ'}
        variant={confirm?.action === 'REJECTED' ? 'danger' : 'default'}
        loading={!!actionLoading}
        onConfirm={() => confirm && doUpdateStatus(confirm.orderId, confirm.action)}
        onCancel={() => setConfirm(null)}
      />

      <ContentHeader
        title={tab === 'orders' ? 'Orders ทั้งหมด' : tab === 'pending' ? 'รออนุมัติ' : tab === 'users' ? 'ผู้ใช้งาน' : 'ตั้งค่าระบบ'}
        subtitle={(tab === 'orders' || tab === 'pending') && pagination.total > 0 ? `${pagination.total} รายการ` : tab === 'settings' ? 'กำหนดค่าการทำงานพื้นฐานของระบบ' : undefined}
        action={
          tab === 'users' ? (
            <button onClick={() => setShowRegForm(!showRegForm)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 px-3 py-1.5 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors">
              <Plus size={13} /> เพิ่มผู้ใช้
            </button>
          ) : tab === 'settings' ? (
            <button onClick={saveSettings}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
              <Save size={13} /> บันทึก
            </button>
          ) : (
            <button onClick={() => loadOrders(page)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )
        }
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-4">

          {/* Stats */}
          {(tab === 'orders' || tab === 'pending') && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'ทั้งหมด', value: pagination.total, bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
                { label: 'รอ', value: pendingCount, bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
                { label: 'ส่งเขา', value: orders.filter((o) => ['IN_TRANSIT','ACCEPTED'].includes(o.status)).length, bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
                { label: 'ส่งแล้ว', value: orders.filter((o) => o.status === 'DELIVERED').length, bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-lg p-3 text-center`}>
                  <p className={`text-lg font-bold tabular-nums ${s.text}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Orders / Pending */}
          {(tab === 'orders' || tab === 'pending') && (
            <>
              {tab === 'orders' && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                  <SearchInput placeholder="ค้นหา order..." onSearch={handleSearch} />
                  <div className="relative">
                    <select value={filter} onChange={(e) => { setFilter(e.target.value as OrderStatus | ''); setPage(1) }}
                      className="appearance-none w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {loading ? <OrderListSkeleton count={5} /> :
               orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-2">
                  <LayoutDashboard size={28} className="opacity-40" />
                  <p className="text-sm">{tab === 'pending' ? 'ไม่มี order ที่รอการอนุมัติ ✓' : 'ไม่พบ order'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order}
                      expanded={expandedId === order.id}
                      onClick={() => openDetail(order)}
                      actions={(tab === 'pending' || order.status === 'PENDING') ? (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setConfirm({ orderId: order.id, action: 'APPROVED' })} disabled={!!actionLoading}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors">
                            <Check size={12} /> อนุมัติ
                          </button>
                          <button onClick={() => setConfirm({ orderId: order.id, action: 'REJECTED' })} disabled={!!actionLoading}
                            className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors">
                            <X size={12} /> ปฏิเสธ
                          </button>
                        </div>
                      ) : undefined}
                    />
                  ))}
                  <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={LIMIT}
                    onChange={(p) => { setPage(p); setExpandedId(null) }} />
                </div>
              )}
            </>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="space-y-4">
              {showRegForm && (
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">เพิ่มผู้ใช้ใหม่</p>
                  <form onSubmit={handleRegister} className="space-y-3">
                    {[
                      { label: 'ชื่อ', field: 'name', type: 'text', placeholder: 'ชื่อผู้ใช้' },
                      { label: 'อีเมล', field: 'email', type: 'email', placeholder: 'email@company.com' },
                      { label: 'รหัสผ่าน', field: 'password', type: 'password', placeholder: 'อย่างน้อย 8 ตัวอักษร' },
                    ].map(({ label, field, type, placeholder }) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
                        <input type={type} placeholder={placeholder} required value={regForm[field as keyof RegisterForm]}
                          onChange={(e) => setRegForm({ ...regForm, [field]: e.target.value })} className={inputCls} />
                      </div>
                    ))}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
                      <select value={regForm.role} onChange={(e) => setRegForm({ ...regForm, role: e.target.value })} className={inputCls}>
                        <option value="KITCHEN">ครัวกลาง</option>
                        <option value="DRIVER">คนขับ</option>
                        <option value="BRANCH">สาขา</option>
                        <option value="ADMIN">แอดมิน</option>
                      </select>
                    </div>
                    {regForm.role === 'BRANCH' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Branch ID</label>
                        <input type="text" placeholder="BRANCH-001" value={regForm.branchId}
                          onChange={(e) => setRegForm({ ...regForm, branchId: e.target.value })} className={inputCls} />
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button type="submit" disabled={regLoading}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded flex items-center justify-center gap-1 transition-colors">
                        {regLoading && <Loader2 size={14} className="animate-spin" />} สร้าง
                      </button>
                      <button type="button" onClick={() => setShowRegForm(false)}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        ยกเลิก
                      </button>
                    </div>
                  </form>
                </div>
              )}
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user?.email}</p>
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">ADMIN</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">ข้อมูลระบบ</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ค่าพื้นฐานที่แสดงและใช้ในขั้นตอนทำงาน</p>
                  </div>
                  <button onClick={resetSettings}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                    <RotateCcw size={13} /> ค่าเริ่มต้น
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อระบบ</label>
                    <input value={settings.systemName} onChange={(e) => updateSetting('systemName', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Prefix เลข Order</label>
                    <input value={settings.orderPrefix} onChange={(e) => updateSetting('orderPrefix', e.target.value.toUpperCase())} className={inputCls} />
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700">
                        {settings.logoDataUrl
                          ? <img src={settings.logoDataUrl} alt="logo" className="h-full w-full object-contain p-1" />
                          : <ImagePlus size={22} className="text-slate-400" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">โลโก้หน้าเว็บ</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ใช้แสดงที่ sidebar และ favicon หัวแท็บ browser</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20">
                        <ImagePlus size={13} /> เลือกรูป
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoFile(file); e.currentTarget.value = '' }} />
                      </label>
                      {settings.logoDataUrl && (
                        <button onClick={() => updateSetting('logoDataUrl', '')}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20">
                          <Trash2 size={13} /> ลบ
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">การจัดส่ง</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">รูปตอนรับสินค้า</label>
                    <input type="number" min={1} max={10} value={settings.pickupPhotoCount}
                      onChange={(e) => updateSetting('pickupPhotoCount', Number(e.target.value))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">รูปตอนส่งสินค้า</label>
                    <input type="number" min={1} max={10} value={settings.dropoffPhotoCount}
                      onChange={(e) => updateSetting('dropoffPhotoCount', Number(e.target.value))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">รีเฟรชคนขับ (วินาที)</label>
                    <input type="number" min={10} max={300} step={5} value={settings.driverRefreshSeconds}
                      onChange={(e) => updateSetting('driverRefreshSeconds', Number(e.target.value))}
                      className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">เงื่อนไขระบบ</p>
                <div className="mt-4 space-y-3">
                  {[
                    { key: 'requireSignature' as const, title: 'บังคับลายเซ็นตอนส่งของ', desc: 'คนขับต้องมีลายเซ็นผู้รับก่อนปิดงาน' },
                    { key: 'testMode' as const, title: 'โหมดทดสอบ', desc: 'แสดงสถานะว่าเป็นระบบสำหรับทดสอบภายใน' },
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <span>
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                      </span>
                      <input type="checkbox" checked={settings[item.key]}
                        onChange={(e) => updateSetting(item.key, e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                ตอนนี้ค่าหน้านี้ถูกบันทึกไว้ในเครื่องนี้ก่อน หากต้องการให้ทุกเครื่องใช้ค่าเดียวกัน ต้องเพิ่ม API และตารางตั้งค่าในฐานข้อมูล
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
