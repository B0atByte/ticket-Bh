import { useState, useEffect, useCallback, useRef } from 'react'
import { Truck, Loader2, Package, MapPin, CheckCircle2, ArrowRight, RefreshCw, ClipboardCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { Order, OrdersResponse } from '../types'
import { OrderCard } from '../components/OrderCard'
import { OrderListSkeleton } from '../components/OrderCardSkeleton'
import { PhotoSlots } from '../components/PhotoSlots'
import { SignatureCanvas } from '../components/SignatureCanvas'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { AppLayout, ContentHeader } from '../components/AppLayout'

type DeliveryStep = 'pickup' | 'transit' | 'dropoff'

const STEPS = [
  { key: 'pickup',  label: 'รับสินค้า', icon: Package },
  { key: 'transit', label: 'เดินทาง',   icon: Truck },
  { key: 'dropoff', label: 'ส่งมอบ',   icon: CheckCircle2 },
]

const AUTO_REFRESH_MS = 30_000

export function DriverPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('available')

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Active delivery flow
  const [deliveryStep, setDeliveryStep] = useState<DeliveryStep | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [pickupPhotos, setPickupPhotos] = useState<string[]>([])
  const [dropoffPhotos, setDropoffPhotos] = useState<string[]>([])
  const [signatureUrl, setSignatureUrl] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmAccept, setConfirmAccept] = useState<Order | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await api.get<OrdersResponse>('/orders?limit=50')
      setOrders(data.orders)
      setLastRefresh(new Date())
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadOrders()
    intervalRef.current = setInterval(() => loadOrders(true), AUTO_REFRESH_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loadOrders])

  async function acceptOrder(order: Order) {
    setActionLoading(true)
    try {
      const updated = await api.patch<Order>(`/orders/${order.id}/status`, { status: 'ACCEPTED' })
      setActiveOrder(updated); setConfirmAccept(null)
      setDeliveryStep('pickup'); setTab('mine')
      toast.success('รับงานเรียบร้อย')
      await loadOrders(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด') }
    finally { setActionLoading(false) }
  }

  async function confirmPickup() {
    if (pickupPhotos.length < 3) { toast.error('กรุณาถ่ายรูปให้ครบ 3 รูป'); return }
    setActionLoading(true)
    try {
      const updated = await api.patch<Order>(`/orders/${activeOrder!.id}/status`, { status: 'IN_TRANSIT', pickupPhotos })
      setActiveOrder(updated); setDeliveryStep('transit')
      toast.success('บันทึกการรับสินค้าเรียบร้อย')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด') }
    finally { setActionLoading(false) }
  }

  async function confirmDelivery() {
    if (!dropoffPhotos.length) { toast.error('กรุณาถ่ายรูปการส่งมอบ'); return }
    if (!signatureUrl) { toast.error('กรุณาขอลายเซ็นผู้รับ'); return }
    setActionLoading(true)
    try {
      await api.patch(`/orders/${activeOrder!.id}/status`, { status: 'DELIVERED', dropoffPhotos, signatureUrl })
      toast.success('ส่งมอบสินค้าเรียบร้อย!')
      setDeliveryStep(null); setActiveOrder(null)
      setPickupPhotos([]); setDropoffPhotos([]); setSignatureUrl('')
      setTab('available'); await loadOrders()
    } catch (err) { toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด') }
    finally { setActionLoading(false) }
  }

  async function uploadSignature(dataUrl: string) {
    if (!dataUrl) { setSignatureUrl(''); return }
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], 'signature.png', { type: 'image/png' })
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<{ url: string }>('/uploads', form)
      setSignatureUrl(res.url)
    } catch { setSignatureUrl('') }
  }

  function StepBar({ current }: { current: DeliveryStep }) {
    const idx = STEPS.findIndex((s) => s.key === current)
    return (
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = i < idx; const active = i === idx
          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                </div>
                <span className={`text-xs ${active ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-10 mx-2 mb-4 rounded-full ${done ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const available = orders.filter((o) => o.status === 'APPROVED')
  const myOrders  = orders.filter((o) => o.driverId === user?.id && !['DELIVERED','REJECTED'].includes(o.status))
  const history   = orders.filter((o) => o.driverId === user?.id && o.status === 'DELIVERED')

  const NAV = [
    { id: 'available', label: 'งานที่รอรับ', icon: Truck,          badge: available.length },
    { id: 'mine',      label: 'งานของฉัน',   icon: Package,        badge: myOrders.length > 0 ? myOrders.length : undefined },
    { id: 'history',   label: 'ประวัติ',      icon: ClipboardCheck },
  ]

  // ─── Active delivery flow overlay ───
  if (deliveryStep && activeOrder) {
    return (
      <AppLayout navItems={NAV} activeTab={tab} onTabChange={() => {}} roleIcon={Truck} roleColor="bg-indigo-600">
        <div className="flex-1">
          {/* Step header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 sticky top-0 z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${deliveryStep === 'dropoff' ? 'bg-emerald-600' : deliveryStep === 'transit' ? 'bg-blue-600' : 'bg-blue-600'}`}>
                {deliveryStep === 'pickup' && <Package size={16} className="text-white" />}
                {deliveryStep === 'transit' && <Truck size={16} className="text-white" />}
                {deliveryStep === 'dropoff' && <CheckCircle2 size={16} className="text-white" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {deliveryStep === 'pickup' ? 'รับสินค้า' : deliveryStep === 'transit' ? 'เดินทาง' : 'ส่งมอบ'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{activeOrder.orderNo} → {activeOrder.branchId}</p>
              </div>
            </div>
            <div className="flex justify-center"><StepBar current={deliveryStep} /></div>
          </div>

          <div className="p-4 space-y-3 max-w-lg mx-auto">
            {deliveryStep === 'pickup' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">รายการสินค้า</p>
                  {activeOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                  {activeOrder.notes && <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">หมายเหตุ: {activeOrder.notes}</p>}
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <PhotoSlots count={3} label="รูปถ่ายรับสินค้า (ต้องครบ 3 รูป)" onComplete={setPickupPhotos} />
                </div>
                <button onClick={confirmPickup} disabled={actionLoading || pickupPhotos.length < 3}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  ยืนยัน
                </button>
              </>
            )}

            {deliveryStep === 'transit' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <Truck size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">ส่งไปยัง {activeOrder.branchId}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{activeOrder.items.length} รายการ</p>
                    </div>
                  </div>
                  <div className="relative h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-3/5 bg-blue-500 rounded-full" />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <span>เริ่ม</span>
                    <span>ปลายทาง</span>
                  </div>
                </div>
                <button onClick={() => setDeliveryStep('dropoff')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  <MapPin size={16} /> ถึงแล้ว
                </button>
              </>
            )}

            {deliveryStep === 'dropoff' && (
              <>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <PhotoSlots count={2} label="รูปถ่ายส่งสินค้า" onComplete={setDropoffPhotos} />
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <SignatureCanvas onSave={uploadSignature} disabled={actionLoading} />
                </div>
                <button onClick={confirmDelivery} disabled={actionLoading || !dropoffPhotos.length || !signatureUrl}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors">
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  ยืนยัน
                </button>
              </>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  // ─── Normal list view ───
  return (
    <AppLayout navItems={NAV} activeTab={tab} onTabChange={setTab} roleIcon={Truck} roleColor="bg-indigo-600">
      <ConfirmDialog
        open={!!confirmAccept}
        title="รับงาน"
        message={`ยืนยันรับงาน ${confirmAccept?.orderNo}?`}
        confirmLabel="รับงาน"
        loading={actionLoading}
        onConfirm={() => confirmAccept && acceptOrder(confirmAccept)}
        onCancel={() => setConfirmAccept(null)}
      />

      <ContentHeader
        title={tab === 'available' ? 'งานที่รอรับ' : tab === 'mine' ? 'งานของฉัน' : 'ประวัติการส่ง'}
        subtitle={`อัปเดต ${lastRefresh.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · รีเฟรชทุก 30 วิ`}
        action={
          <button onClick={() => loadOrders()} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {loading ? <OrderListSkeleton count={3} /> : (
            <>
              {tab === 'available' && (
                available.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
                    <Truck size={28} className="opacity-40" />
                    <p className="text-sm">ไม่มีงานที่รอรับ</p>
                    <p className="text-xs opacity-70">รีเฟรชทุก 30 วิ</p>
                  </div>
                ) : available.map((order) => (
                  <OrderCard key={order.id} order={order}
                    expanded={expandedId === order.id}
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    actions={
                      <button onClick={() => setConfirmAccept(order)}
                        className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors">
                        <Truck size={12} /> รับ
                      </button>
                    }
                  />
                ))
              )}

              {tab === 'mine' && (
                myOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
                    <Package size={28} className="opacity-40" />
                    <p className="text-sm">ไม่มีงานที่กำลังดำเนินการ</p>
                  </div>
                ) : myOrders.map((order) => (
                  <OrderCard key={order.id} order={order}
                    expanded={expandedId === order.id}
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    actions={
                      order.status === 'ACCEPTED' ? (
                        <button onClick={() => { setActiveOrder(order); setDeliveryStep('pickup') }}
                          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors">
                          <Package size={12} /> เริ่ม
                        </button>
                      ) : order.status === 'IN_TRANSIT' ? (
                        <button onClick={() => { setActiveOrder(order); setDeliveryStep('transit') }}
                          className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded flex items-center justify-center gap-1 transition-colors">
                          <Truck size={12} /> ต่อ
                        </button>
                      ) : null
                    }
                  />
                ))
              )}

              {tab === 'history' && (
                history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
                    <ClipboardCheck size={28} className="opacity-40" />
                    <p className="text-sm">ยังไม่มีประวัติการส่ง</p>
                  </div>
                ) : history.map((order) => (
                  <OrderCard key={order.id} order={order}
                    expanded={expandedId === order.id}
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
