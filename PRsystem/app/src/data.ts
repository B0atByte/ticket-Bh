export type Role = 'owner' | 'employee' | 'purchasing' | 'accounting' | 'itsupport';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface PurchaseItem {
  code: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  itemNote: string;
  externalLink?: string;
}

export interface PurchaseRequest {
  id: string;
  reqNo: string;
  title: string;
  branch?: string;
  items?: PurchaseItem[];
  totalAmount: number;
  vatAmount?: number;
  reason: string;
  category: string;
  categories: string[];
  supplierName: string;
  supplierName2?: string;
  paymentMethod: 'bank' | 'cash' | 'transfer' | '';
  paymentTiming: 'before' | 'after' | '';
  orderDate: string;
  deliveryDate: string;
  dueDate: string;
  contactName: string;
  signedDate: string;
  status: 'pending' | 'purchasing' | 'accounting' | 'transferred' | 'received' | 'rejected';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  prNo?: string;
  poNo?: string;
  requestFile?: string;
  prFile?: string;
  poFile?: string;
  transferRef?: string;
  transferDate?: string;
  transferFile?: string;
  deliveryNote?: string;
  taxInvoice?: string;
  receivedAt?: string;
  requestPhotos?: string;
  productPhotos?: string;
  notes?: string;
}

export const BRANCHES = ['HQ', 'สาขา 1', 'สาขา 2', 'สาขา 3', 'สาขา 4', 'อื่นๆ'];

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  detail: string;
  timestamp: string;
  ip: string;
}

export const USERS: User[] = [
  { id: 'u1', username: 'owner', password: '1234', name: 'คุณสมชาย วงศ์ใหญ่', email: 'owner@company.com', role: 'owner', active: true, createdAt: '2024-01-01' },
  { id: 'u2', username: 'employee', password: '1234', name: 'นางสาวสมหญิง ใจดี', email: 'employee@company.com', role: 'employee', active: true, createdAt: '2024-01-05' },
  { id: 'u3', username: 'purchasing', password: '1234', name: 'นายวิชัย จัดซื้อดี', email: 'purchasing@company.com', role: 'purchasing', active: true, createdAt: '2024-01-05' },
  { id: 'u4', username: 'accounting', password: '1234', name: 'นางสาวบัญชี ตัวเลขดี', email: 'accounting@company.com', role: 'accounting', active: true, createdAt: '2024-01-05' },
  { id: 'u5', username: 'itsupport', password: '1234', name: 'นายไอที ซัพพอร์ต', email: 'it@company.com', role: 'itsupport', active: true, createdAt: '2024-01-03' },
  { id: 'u6', username: 'emp2', password: '1234', name: 'นายประสิทธิ์ มานะ', email: 'emp2@company.com', role: 'employee', active: true, createdAt: '2024-02-10' },
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'ผู้ประกอบการ',
  employee: 'พนักงาน',
  purchasing: 'ฝ่ายจัดซื้อ',
  accounting: 'บัญชี',
  itsupport: 'IT Support',
};

export const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-purple-50 text-purple-700 border border-purple-200/70',
  employee: 'bg-blue-50 text-blue-700 border border-blue-200/70',
  purchasing: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  accounting: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
  itsupport: 'bg-slate-100 text-slate-600 border border-slate-200/70',
};

export const STATUS_LABELS: Record<string, string> = {
  pending: 'รอฝ่ายจัดซื้อ',
  purchasing: 'รอฝ่ายบัญชี',
  accounting: 'รอโอนเงิน',
  transferred: 'รอรับสินค้า',
  received: 'รับสินค้าแล้ว',
  rejected: 'ปฏิเสธ',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  purchasing: 'bg-blue-50 text-blue-700 border border-blue-200/70',
  accounting: 'bg-violet-50 text-violet-700 border border-violet-200/70',
  transferred: 'bg-orange-50 text-orange-700 border border-orange-200/70',
  received: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
  rejected: 'bg-red-50 text-red-600 border border-red-200/70',
};

export const CATEGORIES = ['ผัก', 'เนื้อ หมู ไก่', 'ซอส', 'เครื่องดื่ม', 'อื่นๆ'];


export const INITIAL_REQUESTS: PurchaseRequest[] = [
  { id: 'r1', reqNo: 'PR-2025-001', title: 'สั่งซื้อผักสดประจำสัปดาห์', items: [{ code: 'V001', name: 'ผักกาดขาว', qty: 10, unit: 'กก.', price: 25, itemNote: '' }, { code: 'V002', name: 'ผักบุ้ง', qty: 5, unit: 'กก.', price: 30, itemNote: '' }], totalAmount: 400, reason: '', category: 'ผัก', categories: ['ผัก'], supplierName: 'บริษัท ผักสดดี จำกัด', supplierName2: '', paymentMethod: 'cash', paymentTiming: 'after', orderDate: '2025-01-10', deliveryDate: '2025-01-11', dueDate: '2025-01-15', contactName: 'สมหญิง', signedDate: '2025-01-10', status: 'transferred', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-01-10', updatedAt: '2025-01-20', prNo: 'PR-001', poNo: 'PO-001', transferRef: 'TRF-001', transferDate: '2025-01-20' },
  { id: 'r2', reqNo: 'PR-2025-002', title: 'สั่งซื้อเนื้อหมูและไก่', items: [{ code: 'M001', name: 'เนื้อหมูสามชั้น', qty: 20, unit: 'กก.', price: 120, itemNote: '' }, { code: 'M002', name: 'ไก่ทั้งตัว', qty: 15, unit: 'กก.', price: 75, itemNote: '' }], totalAmount: 3525, reason: '', category: 'หมู', categories: ['หมู', 'ไก่'], supplierName: 'ร้านเนื้อสด อ.ตลาด', supplierName2: '', paymentMethod: 'bank', paymentTiming: 'after', orderDate: '2025-01-15', deliveryDate: '2025-01-16', dueDate: '2025-01-20', contactName: 'สมหญิง', signedDate: '2025-01-15', status: 'transferred', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-01-15', updatedAt: '2025-01-25', prNo: 'PR-002', poNo: 'PO-002', transferRef: 'TRF-002', transferDate: '2025-01-25' },
  { id: 'r3', reqNo: 'PR-2025-003', title: 'สั่งซื้อซอสและเครื่องปรุง', items: [{ code: 'S001', name: 'ซอสปรุงรส', qty: 24, unit: 'ขวด', price: 45, itemNote: '' }, { code: 'S002', name: 'น้ำปลา', qty: 12, unit: 'ขวด', price: 35, itemNote: '' }], totalAmount: 1500, reason: '', category: 'ซอส', categories: ['ซอส'], supplierName: 'บริษัท เครื่องปรุงไทย จำกัด', supplierName2: '', paymentMethod: 'bank', paymentTiming: 'after', orderDate: '2025-02-01', deliveryDate: '2025-02-03', dueDate: '2025-02-10', contactName: 'ประสิทธิ์', signedDate: '2025-02-01', status: 'accounting', createdBy: 'u6', createdByName: 'นายประสิทธิ์ มานะ', createdAt: '2025-02-01', updatedAt: '2025-02-05', prNo: 'PR-003', poNo: 'PO-003' },
  { id: 'r4', reqNo: 'PR-2025-004', title: 'สั่งซื้อเครื่องดื่มและน้ำแข็ง', items: [{ code: 'D001', name: 'น้ำอัดลม 1.5L', qty: 48, unit: 'ขวด', price: 22, itemNote: '' }, { code: 'D002', name: 'น้ำดื่มบรรจุขวด', qty: 60, unit: 'ขวด', price: 8, itemNote: '' }], totalAmount: 1536, reason: '', category: 'เครื่องดื่ม', categories: ['เครื่องดื่ม'], supplierName: 'ร้านเครื่องดื่มส่ง', supplierName2: '', paymentMethod: 'cash', paymentTiming: 'before', orderDate: '2025-02-10', deliveryDate: '2025-02-11', dueDate: '2025-02-11', contactName: 'สมหญิง', signedDate: '2025-02-10', status: 'purchasing', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-02-10', updatedAt: '2025-02-10', prNo: 'PR-004' },
  { id: 'r5', reqNo: 'PR-2025-005', title: 'สั่งซื้อเนื้อวัวและเครื่องเทศ', items: [{ code: 'B001', name: 'เนื้อวัวสันนอก', qty: 10, unit: 'กก.', price: 280, itemNote: '' }, { code: 'H001', name: 'พริกแห้ง', qty: 3, unit: 'กก.', price: 120, itemNote: '' }], totalAmount: 3160, reason: '', category: 'เนื้อ', categories: ['เนื้อ', 'เครื่องเทศ'], supplierName: 'ฟาร์มเนื้อคุณภาพ', supplierName2: 'ร้านเครื่องเทศแม่กิมเฮง', paymentMethod: 'transfer', paymentTiming: 'after', orderDate: '2025-02-15', deliveryDate: '2025-02-17', dueDate: '2025-02-25', contactName: 'ประสิทธิ์', signedDate: '2025-02-15', status: 'pending', createdBy: 'u6', createdByName: 'นายประสิทธิ์ มานะ', createdAt: '2025-02-15', updatedAt: '2025-02-15' },
  { id: 'r6', reqNo: 'PR-2025-006', title: 'สั่งซื้อผักออร์แกนิค', items: [{ code: 'V010', name: 'ผักสลัดออร์แกนิค', qty: 8, unit: 'กก.', price: 180, itemNote: 'เกรด A' }], totalAmount: 1440, reason: '', category: 'ผัก', categories: ['ผัก'], supplierName: 'ฟาร์มผักออร์แกนิค', supplierName2: '', paymentMethod: 'bank', paymentTiming: 'after', orderDate: '2025-02-18', deliveryDate: '2025-02-20', dueDate: '2025-02-28', contactName: 'สมหญิง', signedDate: '2025-02-18', status: 'rejected', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-02-18', updatedAt: '2025-02-19', notes: 'ราคาเกินงบประมาณที่กำหนด' },
  { id: 'r7', reqNo: 'PR-2025-007', title: 'สั่งซื้อไก่สดประจำสัปดาห์', items: [{ code: 'C001', name: 'ไก่ชำแหละ', qty: 30, unit: 'กก.', price: 68, itemNote: '' }, { code: 'C002', name: 'ปีกไก่', qty: 10, unit: 'กก.', price: 55, itemNote: '' }], totalAmount: 2590, reason: '', category: 'ไก่', categories: ['ไก่'], supplierName: 'โรงงานไก่สด จำกัด', supplierName2: '', paymentMethod: 'bank', paymentTiming: 'after', orderDate: '2025-03-01', deliveryDate: '2025-03-02', dueDate: '2025-03-10', contactName: 'ประสิทธิ์', signedDate: '2025-03-01', status: 'transferred', createdBy: 'u6', createdByName: 'นายประสิทธิ์ มานะ', createdAt: '2025-03-01', updatedAt: '2025-03-10', prNo: 'PR-005', poNo: 'PO-004', transferRef: 'TRF-003', transferDate: '2025-03-10' },
  { id: 'r8', reqNo: 'PR-2025-008', title: 'สั่งซื้อหมูและผักรวม', items: [{ code: 'M010', name: 'หมูบด', qty: 15, unit: 'กก.', price: 95, itemNote: '' }, { code: 'V020', name: 'กะหล่ำปลี', qty: 20, unit: 'กก.', price: 18, itemNote: '' }], totalAmount: 1785, reason: '', category: 'หมู', categories: ['หมู', 'ผัก'], supplierName: 'ตลาดสดเช้า', supplierName2: '', paymentMethod: 'cash', paymentTiming: 'before', orderDate: '2025-03-15', deliveryDate: '2025-03-16', dueDate: '2025-03-16', contactName: 'สมหญิง', signedDate: '2025-03-15', status: 'pending', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-03-15', updatedAt: '2025-03-15' },
  { id: 'r9', reqNo: 'PR-2025-009', title: 'สั่งซื้อเครื่องเทศและซอสนำเข้า', items: [{ code: 'H010', name: 'กระเทียมโทน', qty: 10, unit: 'กก.', price: 85, itemNote: '' }, { code: 'S010', name: 'ซอสหอยนางรม', qty: 24, unit: 'ขวด', price: 55, itemNote: '' }], totalAmount: 2170, reason: '', category: 'เครื่องเทศ', categories: ['เครื่องเทศ', 'ซอส'], supplierName: 'บ.นำเข้าเครื่องเทศ จำกัด', supplierName2: '', paymentMethod: 'bank', paymentTiming: 'after', orderDate: '2025-03-20', deliveryDate: '2025-03-22', dueDate: '2025-03-30', contactName: 'ประสิทธิ์', signedDate: '2025-03-20', status: 'accounting', createdBy: 'u6', createdByName: 'นายประสิทธิ์ มานะ', createdAt: '2025-03-20', updatedAt: '2025-03-25', prNo: 'PR-006', poNo: 'PO-005' },
  { id: 'r10', reqNo: 'PR-2025-010', title: 'สั่งซื้อวัตถุดิบประจำสัปดาห์', items: [{ code: 'V030', name: 'มะเขือเทศ', qty: 15, unit: 'กก.', price: 35, itemNote: '' }, { code: 'M020', name: 'หมูสับ', qty: 10, unit: 'กก.', price: 100, itemNote: '' }], totalAmount: 1525, reason: '', category: 'ผัก', categories: ['ผัก', 'หมู'], supplierName: 'ตลาดสดกลาง', supplierName2: '', paymentMethod: 'cash', paymentTiming: 'before', orderDate: '2025-04-01', deliveryDate: '2025-04-02', dueDate: '2025-04-02', contactName: 'สมหญิง', signedDate: '2025-04-01', status: 'pending', createdBy: 'u2', createdByName: 'นางสาวสมหญิง ใจดี', createdAt: '2025-04-01', updatedAt: '2025-04-01' },
];

export const INITIAL_AUDIT: AuditLog[] = [
  { id: 'a1', userId: 'u1', userName: 'คุณสมชาย วงศ์ใหญ่', action: 'LOGIN', module: 'Auth', detail: 'เข้าสู่ระบบสำเร็จ', timestamp: '2025-04-20 08:30:00', ip: '192.168.1.10' },
  { id: 'a2', userId: 'u2', userName: 'นางสาวสมหญิง ใจดี', action: 'CREATE', module: 'Purchase Request', detail: 'สร้างใบขอซื้อ PR-2025-010', timestamp: '2025-04-20 09:15:22', ip: '192.168.1.11' },
  { id: 'a3', userId: 'u3', userName: 'นายวิชัย จัดซื้อดี', action: 'UPDATE', module: 'Purchase Request', detail: 'ออก PR/PO สำหรับ PR-2025-008', timestamp: '2025-04-20 10:00:05', ip: '192.168.1.12' },
  { id: 'a4', userId: 'u4', userName: 'นางสาวบัญชี ตัวเลขดี', action: 'UPDATE', module: 'Payment', detail: 'บันทึกการโอนเงิน TRF-003', timestamp: '2025-04-19 14:30:00', ip: '192.168.1.13' },
  { id: 'a5', userId: 'u5', userName: 'นายไอที ซัพพอร์ต', action: 'CREATE', module: 'User Management', detail: 'เพิ่มผู้ใช้ emp2', timestamp: '2025-04-18 11:00:00', ip: '192.168.1.14' },
  { id: 'a6', userId: 'u2', userName: 'นางสาวสมหญิง ใจดี', action: 'LOGIN', module: 'Auth', detail: 'เข้าสู่ระบบสำเร็จ', timestamp: '2025-04-18 08:45:00', ip: '192.168.1.11' },
  { id: 'a7', userId: 'u3', userName: 'นายวิชัย จัดซื้อดี', action: 'REJECT', module: 'Purchase Request', detail: 'ปฏิเสธคำขอ PR-2025-006', timestamp: '2025-04-17 16:00:00', ip: '192.168.1.12' },
];
