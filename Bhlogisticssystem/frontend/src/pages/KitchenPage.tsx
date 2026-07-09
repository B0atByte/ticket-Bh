import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, PlusCircle, ClipboardList, ImagePlus, X, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api } from '../lib/api'
import type { Order, OrdersResponse } from '../types'
import { OrderCard } from '../components/OrderCard'
import { Pagination } from '../components/Pagination'
import { OrderListSkeleton } from '../components/OrderCardSkeleton'
import { AppLayout, ContentHeader } from '../components/AppLayout'

const BRANCHES = [
  { id: 'BRANCH-001', name: 'สาขา 1' },
  { id: 'BRANCH-002', name: 'สาขา 2' },
  { id: 'BRANCH-003', name: 'สาขา 3' },
  { id: 'BRANCH-004', name: 'สาขา 4' },
]

const LIMIT = 10
const NAV = [
  { id: 'create',  label: 'สร้าง Order', icon: PlusCircle },
  { id: 'history', label: 'ประวัติ',      icon: ClipboardList },
]

interface Item { name: string; quantity: string; unit: string }
const inputCls = 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export function KitchenPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('create')

  // Form state
  const [submitting, setSubmitting] = useState(false)
  const [branchId, setBranchId] = useState(BRANCHES[0].id)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>([{ name: '', quantity: '', unit: 'กก.' }])
  const [initImageUrl, setInitImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  // History state
  const [orders, setOrders] = useState<Order[]>([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadOrders = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
      const data = await api.get<OrdersResponse>(`/orders?${params}`)
      setOrders(data.orders)
      setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [page, toast])

  useEffect(() => {
    if (tab === 'history') loadOrders(page)
  }, [tab, page])

  async function handleImageChange(file: File) {
    setUploadingImage(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.upload<{ url: string }>('/uploads', form)
      setInitImageUrl(res.url)
    } catch { toast.error('อัปโหลดรูปภาพไม่สำเร็จ') }
    finally { setUploadingImage(false) }
  }

  function addItem() { setItems([...items, { name: '', quantity: '', unit: 'กก.' }]) }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, f: keyof Item, v: string) {
    const u = [...items]; u[i] = { ...u[i], [f]: v }; setItems(u)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validItems = items.filter((it) => it.name.trim() && it.quantity && it.unit)
    if (!validItems.length) { toast.error('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ'); return }
    setSubmitting(true)
    try {
      await api.post('/orders', {
        branchId,
        notes: notes.trim() || undefined,
        initImageUrl: initImageUrl || undefined,
        items: validItems.map((it) => ({ name: it.name.trim(), quantity: Number(it.quantity), unit: it.unit })),
      })
      toast.success('สร้าง order เรียบร้อย')
      setItems([{ name: '', quantity: '', unit: 'กก.' }])
      setNotes(''); setInitImageUrl('')
      setTab('history')
      setPage(1); loadOrders(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'สร้าง order ไม่สำเร็จ')
    } finally { setSubmitting(false) }
  }

  const navWithBadge = NAV.map((n) =>
    n.id === 'history' && pagination.total > 0
      ? { ...n, badge: undefined }
      : n
  )

  return (
    <AppLayout
      navItems={navWithBadge}
      activeTab={tab}
      onTabChange={setTab}
      roleIcon={PlusCircle}
      roleColor="bg-blue-600"
    >
      {tab === 'create' && (
        <>
          <ContentHeader title="สร้าง Order ใหม่" subtitle={`ครัวกลาง · ${user?.name}`} />
          <div className="flex-1 p-4 md:p-6">
            <div className="max-w-xl mx-auto">
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Branch */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">สาขาปลายทาง</label>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={`${inputCls} w-full px-3 py-2`}>
                      {BRANCHES.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>

                  {/* Items */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">รายการสินค้า</label>
                      <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">
                        <Plus size={14} /> เพิ่ม
                      </button>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex flex-col sm:flex-row gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <input type="text" placeholder="ชื่อสินค้า" value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} className={`${inputCls} flex-1 px-3 py-2`} />
                          <div className="flex gap-2">
                            <input type="number" placeholder="จำนวน" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} min="0" step="0.01" className={`${inputCls} w-24 px-2 py-2 text-center`} />
                            <input type="text" placeholder="หน่วย" value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className={`${inputCls} w-20 px-2 py-2 text-center`} />
                            {items.length > 1 && (
                              <button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">หมายเหตุ (ถ้ามี)</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ระบุหมายเหตุ..." className={`${inputCls} w-full px-3 py-2 resize-none`} />
                  </div>

                  {/* Image */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">รูปภาพประกอบ</label>
                    {initImageUrl ? (
                      <div className="relative h-32 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={initImageUrl} alt="init" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setInitImageUrl('')} className="absolute top-1 right-1 w-6 h-6 bg-slate-900/60 hover:bg-red-600 text-white rounded flex items-center justify-center"><X size={14} /></button>
                      </div>
                    ) : (
                      <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingImage ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'}`}>
                        {uploadingImage ? <Loader2 size={20} className="text-blue-600 animate-spin" /> : <><ImagePlus size={20} className="text-slate-400" /><span className="text-xs text-slate-400 mt-1">คลิกอัปโหลด</span></>}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageChange(f) }} />
                      </label>
                    )}
                  </div>

                  <button type="submit" disabled={submitting || uploadingImage}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                    {submitting && <Loader2 size={15} className="animate-spin" />}
                    {submitting ? 'กำลังสร้าง...' : 'สร้าง Order'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <ContentHeader
            title="ประวัติ Order"
            subtitle={pagination.total > 0 ? `${pagination.total} รายการทั้งหมด` : undefined}
            action={
              <button onClick={() => loadOrders(page)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            }
          />
          <div className="flex-1 p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-3">
              {loading ? <OrderListSkeleton count={5} /> :
               orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-slate-500">
                  <ClipboardList size={32} className="opacity-40" />
                  <p className="text-sm">ยังไม่มี order</p>
                  <button onClick={() => setTab('create')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1">+ สร้าง order แรก</button>
                </div>
              ) : (
                <>
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order}
                      expanded={expandedId === order.id}
                      onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    />
                  ))}
                  <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} limit={LIMIT}
                    onChange={(p) => { setPage(p); setExpandedId(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}
