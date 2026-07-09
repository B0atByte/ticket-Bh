const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Module-level token, set by the auth provider; attached to every request.
let authToken: string | null = null;
export const setAuthToken = (t: string | null) => {
  authToken = t;
};

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  if (authToken) h.Authorization = `Bearer ${authToken}`;
  return h;
}

async function req<T>(path: string, opts?: RequestInit, extraHeaders?: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...opts, headers: headers({ ...(opts?.headers as object), ...extraHeaders }) });
  } catch {
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ / Cannot reach server");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Expired/invalid token on a protected call → tell the app to sign out.
    if (res.status === 401 && authToken) window.dispatchEvent(new Event("auth:401"));
    // Always surface a string (never a raw object → "[object Object]").
    const msg = typeof data?.error === "string" ? data.error : "เกิดข้อผิดพลาด / Something went wrong";
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

// ── public shapes ───────────────────────────────────────
export interface Coverage {
  found: boolean;
  serial: string;
  product: string | null;
  warrantyStart: string | null;
  expiryDate: string | null;
  active: boolean;
  noWarranty: boolean;
}
export interface PrefillContact {
  found: boolean;
  hasContact?: boolean;
  needsVerify?: boolean;
  verified?: boolean;
  phoneHint?: string | null;
  serial?: string;
  product?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}
export interface RegisterPayload {
  serial: string;
  product: string;
  company?: string;
  purchaseDate: string;
  name: string;
  phone: string;
  email?: string;
  postal?: string;
  houseNo?: string;
  building?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  address?: string;
  receiptName?: string;
  receiptDriveUrl?: string;
}
export interface TicketPayload {
  serial: string;
  name: string;
  phone: string;
  email?: string;
  lineId?: string;
  issueType: string;
  description?: string;
  repairType: "warranty" | "standard" | "repair_claim";
  logUrl?: string;
  videoUrl?: string;
  videoFilename?: string;
}
export interface TimelineEntry {
  timestamp: string | null;
  action: string | null;
  detail: string | null;
  by: string | null;
}
export interface TrackResult {
  ticket: TicketRow;
  timeline: TimelineEntry[];
}

// ── staff shapes ────────────────────────────────────────
export interface StaffUser {
  name: string;
  role: "admin" | "staff" | "tech" | "customer";
}
export interface WarrantyRow {
  id: string;
  registeredAt: string | null;
  serial: string;
  product: string | null;
  company: string | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  postal: string | null;
  houseNo: string | null;
  building: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  address: string | null;
  status: string | null;
  receiptDriveUrl: string | null;
  type: "normal" | "replacement";
  replacementOf: string | null;
}
export interface TicketRow {
  ticketId: string;
  createdAt: string | null;
  updatedAt: string | null;
  serial: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lineId: string | null;
  issueType: string | null;
  description: string | null;
  logUrl: string | null;
  videoUrl: string | null;
  repairType: string | null;
  status: string | null;
  assignedTo: string | null;
  staffNote: string | null;
  techNote: string | null;
  trackingLink: string | null;
  warrantyCase: number;
  globalClaimStatus: string | null;
  gcOldMachine: string | null;
  gcNewMachine: string | null;
  gcLot: string | null;
  globalClaimNote: string | null;
  claimedBy: string | null;
  techAcceptedAt: string | null;
}
export interface MachineRow {
  id: number;
  serial: string;
  newSerial: string | null;
  product: string | null;
  customerName: string | null;
  status: string | null;
  notes: string | null;
  updatedAt: string | null;
  source: string | null;
  globalStatus: string | null;
  assetType: "store" | "claim_fixed" | "subscription" | null;
  subscriptionSource: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  location: string | null;
  noWarranty: number;
}
export interface ProductRow {
  id: number;
  name: string;
  code: string | null;
  active: number;
}
export interface LogRow {
  id: number;
  timestamp: string | null;
  userName: string | null;
  userRole: string | null;
  action: string | null;
  target: string | null;
  detail: string | null;
}
export interface DashboardSummary {
  needsAction: number;
  inProgress: number;
  closedToday: number;
  totalOpen: number;
  expiringSoon: number;
}
export interface ExpiringWarranty {
  serial: string;
  product: string | null;
  name: string | null;
  phone: string | null;
  expiryDate: string | null;
}
export interface ReportData {
  slaDays: number;
  resolution: { closedCount: number; avgHours: number | null; avgDays: number | null };
  sla: { closedCount: number; onTime: number; breached: number; onTimeRate: number | null };
  open: { total: number; fresh: number; week: number; twoWeek: number; stale: number };
  byStatus: { status: string; n: number }[];
  byType: { type: string; n: number }[];
  monthly: { ym: string; created: number; closed: number }[];
  expiring: { d30: number; d60: number; d90: number };
}

export interface InteractionRow {
  id: number;
  serial: string;
  staffName: string | null;
  channel: "line" | "phone" | "store" | "other";
  topic: string | null;
  status: "ok" | "wait" | "open";
  createdAt: string | null;
}
export interface CrmResult {
  found: boolean;
  serial: string;
  machine: MachineRow | null;
  warranty: WarrantyRow | null;
  tickets: TicketRow[];
  interactions: InteractionRow[];
}

export interface ShopeeOrderRow {
  id: number;
  orderNo: string;
  orderDate: string | null;
  buyerName: string | null;
  trackingNo: string | null;
  courier: string | null;
  productName: string | null;
  qty: number | null;
  salePrice: string | null;
  netIncome: string | null;
  address: string | null;
  screenshotUrl: string | null;
  sheetUrl: string | null;
  pageUrl: string | null;
  savedAt: string | null;
}
export interface ShopeeStatus {
  sheetEnabled: boolean;
  sheetTab: string;
  driveEnabled: boolean;
  apiKeyRequired: boolean;
  sheetUrl: string | null;
  header: string[];
}

type List<T> = { data: T[]; count: number };

export const api = {
  // public
  registerWarranty: (b: RegisterPayload) => req<{ id: string; serial: string; expiryDate: string }>("/register", { method: "POST", body: JSON.stringify(b) }),
  coverage: (serial: string) => req<Coverage>(`/coverage/${encodeURIComponent(serial)}`),
  reportPrefill: (serial: string, verify?: string) =>
    req<PrefillContact>(`/coverage/${encodeURIComponent(serial)}/contact${verify ? `?verify=${encodeURIComponent(verify)}` : ""}`),
  createTicket: (b: TicketPayload) => req<{ ticketId: string; status: string }>("/tickets", { method: "POST", body: JSON.stringify(b) }),
  track: (q: string) => req<TrackResult>(`/tickets/track/${encodeURIComponent(q)}`),

  // file upload (public) — returns a fully-qualified URL to the stored file
  async uploadFile(file: File, kind: "image" | "video") {
    const fd = new FormData();
    fd.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${BASE}/uploads?kind=${kind}`, { method: "POST", body: fd });
    } catch {
      throw new ApiError(0, "อัปโหลดไม่สำเร็จ / Upload failed");
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "อัปโหลดไม่สำเร็จ / Upload failed");
    return { url: `${BASE}${data.url}` as string, filename: data.filename as string };
  },

  // auth
  login: (name: string, pin: string) => req<{ token: string; user: StaffUser }>("/auth/login", { method: "POST", body: JSON.stringify({ name, pin }) }),

  // dashboard
  dashboard: () => req<DashboardSummary>("/dashboard/summary"),
  todayActivity: () => req<List<LogRow>>("/dashboard/activity"),
  expiring: (days = 30) => req<List<ExpiringWarranty>>(`/dashboard/expiring?days=${days}`),
  reports: (slaDays = 7) => req<ReportData>(`/dashboard/reports?slaDays=${slaDays}`),

  // warranties
  listWarranties: (f: { type?: string; status?: string; q?: string }) => req<List<WarrantyRow>>(`/warranties${qs(f)}`),
  deleteWarranty: (id: string, adminPin: string) => req<unknown>(`/warranties/${encodeURIComponent(id)}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),
  clearWarranties: (adminPin: string) => req<unknown>("/warranties", { method: "DELETE" }, { "x-admin-pin": adminPin }),

  // tickets
  listTickets: (f: { type?: string; status?: string; q?: string; mine?: string }) => req<List<TicketRow>>(`/tickets${qs(f)}`),
  getTicket: (id: string) => req<{ ticket: TicketRow; timeline: TimelineEntry[] }>(`/tickets/${encodeURIComponent(id)}`),
  setTicketStatus: (id: string, status: string, note?: string) => req<unknown>(`/tickets/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
  updateTicket: (id: string, patch: Record<string, unknown>) => req<unknown>(`/tickets/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTicket: (id: string, adminPin: string) => req<unknown>(`/tickets/${encodeURIComponent(id)}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),
  sendTicketMessage: (id: string, b: { subject: string; body: string }) =>
    req<{ sent: boolean }>(`/tickets/${encodeURIComponent(id)}/message`, { method: "POST", body: JSON.stringify(b) }),
  claimTicket: (id: string) =>
    req<{ ticketId: string; claimedBy: string; status: string | null }>(`/tickets/${encodeURIComponent(id)}/claim`, { method: "POST" }),
  acceptTicket: (id: string) =>
    req<{ ticketId: string; accepted: boolean }>(`/tickets/${encodeURIComponent(id)}/accept`, { method: "POST" }),

  // AI assist (DeepSeek) — drafts a bilingual customer reply from non-PII case context
  aiDraftReply: (b: { intent: string; issueType?: string; repairType?: string; status?: string; note?: string }) =>
    req<{ th: string; en: string }>("/ai/draft-reply", { method: "POST", body: JSON.stringify(b) }),

  // machines / assets
  listMachines: (f: { assetType?: string; status?: string; q?: string }) => req<List<MachineRow>>(`/machines${qs(f)}`),
  createMachine: (b: Record<string, unknown>) => req<unknown>("/machines", { method: "POST", body: JSON.stringify(b) }),
  updateMachine: (serial: string, patch: Record<string, unknown>) => req<unknown>(`/machines/${encodeURIComponent(serial)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteMachine: (serial: string, adminPin: string) => req<unknown>(`/machines/${encodeURIComponent(serial)}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),
  replaceMachine: (serial: string, body: Record<string, unknown>) => req<{ oldSerial: string; newSerial: string }>(`/machines/${encodeURIComponent(serial)}/replace`, { method: "POST", body: JSON.stringify(body) }),

  // global claims
  listGlobalClaims: (f: { month?: string; status?: string }) => req<List<TicketRow>>(`/global-claims${qs(f)}`),
  updateGlobalClaim: (ticketId: string, patch: Record<string, unknown>) => req<unknown>(`/global-claims/${encodeURIComponent(ticketId)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  backdatedGlobalClaim: (b: Record<string, unknown>) => req<unknown>("/global-claims/backdated", { method: "POST", body: JSON.stringify(b) }),

  // products
  listProducts: () => req<List<ProductRow>>("/products"),
  createProduct: (b: { name: string; code?: string }) => req<unknown>("/products", { method: "POST", body: JSON.stringify(b) }),
  deleteProduct: (id: number, adminPin: string) => req<unknown>(`/products/${id}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),

  // logs
  listLogs: (f: { q?: string; action?: string; limit?: number }) =>
    req<List<LogRow>>(`/logs${qs({ q: f.q, action: f.action, limit: f.limit ? String(f.limit) : undefined })}`),

  // shopee export
  listShopeeOrders: () => req<List<ShopeeOrderRow>>("/shopee/orders"),
  shopeeStatus: () => req<ShopeeStatus>("/shopee/status"),
  deleteShopeeOrder: (id: number, adminPin: string) => req<unknown>(`/shopee/orders/${id}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),

  // staff directory
  listUsers: () => req<List<StaffUser>>("/users"),
  createUser: (b: { name: string; pin: string; role: string }) =>
    req<{ name: string; role: string }>("/users", { method: "POST", body: JSON.stringify(b) }),
  updateUser: (name: string, patch: { role?: string; pin?: string }, adminPin: string) =>
    req<unknown>(`/users/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify(patch) }, { "x-admin-pin": adminPin }),
  deleteUser: (name: string, adminPin: string) =>
    req<unknown>(`/users/${encodeURIComponent(name)}`, { method: "DELETE" }, { "x-admin-pin": adminPin }),

  // CRM
  crmLookup: (q: string) => req<CrmResult>(`/crm/lookup?q=${encodeURIComponent(q)}`),
  addInteraction: (b: { serial: string; channel: string; topic: string; status: string; staffName?: string }) =>
    req<unknown>("/crm/interaction", { method: "POST", body: JSON.stringify(b) }),
  ticketDecision: (id: string, decision: "in" | "out" | "misuse" | "none") =>
    req<{ note: string }>(`/crm/ticket/${encodeURIComponent(id)}/decision`, { method: "PATCH", body: JSON.stringify({ decision }) }),

  // csv download (authenticated)
  async downloadCsv(type: "warranties" | "tickets" | "assets") {
    const res = await fetch(`${BASE}/export/csv?type=${type}`, { headers: headers() });
    if (!res.ok) throw new ApiError(res.status, "Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
