export type Role = 'KITCHEN' | 'ADMIN' | 'DRIVER' | 'BRANCH'

export type OrderStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACCEPTED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'REJECTED'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  branchId?: string | null
}

export interface OrderItem {
  id: string
  orderId: string
  name: string
  quantity: number
  unit: string
}

export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  branchId: string
  createdById: string
  driverId?: string | null
  notes?: string | null
  initImageUrl?: string | null
  pickupPhotos: string[]
  dropoffPhotos: string[]
  signatureUrl?: string | null
  deliveredAt?: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  createdBy: { id: string; name: string; email: string }
  driver?: { id: string; name: string; email: string } | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface OrdersResponse {
  orders: Order[]
  pagination: Pagination
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

export type Page = 'login' | 'kitchen' | 'admin' | 'driver' | 'branch'

export interface Issue {
  id: string
  systemName: string
  description: string
  page?: string | null
  reporterName?: string | null
  reporterRole?: string | null
  createdAt: string
}
