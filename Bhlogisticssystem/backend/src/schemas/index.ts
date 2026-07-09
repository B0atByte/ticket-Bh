import { z } from 'zod'
import { Role, OrderStatus } from '@prisma/client'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name required'),
  role: z.nativeEnum(Role),
  branchId: z.string().optional(),
})

export const createOrderSchema = z.object({
  branchId: z.string().min(1, 'Branch required'),
  notes: z.string().optional(),
  initImageUrl: z.string().url().optional().or(z.literal('')),
  items: z
    .array(
      z.object({
        name: z.string().min(1, 'Item name required'),
        quantity: z.number().positive('Quantity must be positive'),
        unit: z.string().min(1, 'Unit required'),
      })
    )
    .min(1, 'At least one item required'),
})

export const updateOrderStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal(OrderStatus.APPROVED) }),
  z.object({ status: z.literal(OrderStatus.REJECTED) }),
  z.object({ status: z.literal(OrderStatus.ACCEPTED) }),
  z.object({
    status: z.literal(OrderStatus.IN_TRANSIT),
    pickupPhotos: z
      .array(z.string().url())
      .min(3, 'At least 3 pickup photos required'),
  }),
  z.object({
    status: z.literal(OrderStatus.DELIVERED),
    dropoffPhotos: z.array(z.string().url()).min(1, 'Dropoff photos required'),
    signatureUrl: z.string().url('Signature required'),
  }),
])

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  branchId: z.string().optional(),
  search: z.string().optional(),
})

export const createIssueSchema = z.object({
  description: z.string().min(5, 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร').max(2000),
  page: z.string().max(500).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type OrderQueryInput = z.infer<typeof orderQuerySchema>
export type CreateIssueInput = z.infer<typeof createIssueSchema>
