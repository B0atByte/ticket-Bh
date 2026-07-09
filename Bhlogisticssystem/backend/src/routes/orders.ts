import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize, type JWTPayload } from '../middleware/auth.js'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
} from '../schemas/index.js'

type Variables = { user: JWTPayload }

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.APPROVED, OrderStatus.REJECTED],
  APPROVED: [OrderStatus.ACCEPTED],
  ACCEPTED: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.DELIVERED],
  DELIVERED: [],
  REJECTED: [],
}

function generateOrderNo(): string {
  const date = new Date()
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORD-${datePart}-${randomPart}`
}

const router = new Hono<{ Variables: Variables }>()
router.use('*', authenticate)

router.get('/', async (c) => {
  const user = c.get('user')
  const queryResult = orderQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!queryResult.success) {
    throw new HTTPException(400, { message: queryResult.error.errors[0].message })
  }

  const { page, limit, status, branchId, search } = queryResult.data
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (status) where.status = status
  if (branchId) where.branchId = branchId
  if (search) {
    where.OR = [
      { orderNo: { contains: search } },
      { notes: { contains: search } },
    ]
  }

  if (user.role === 'DRIVER') {
    where.OR = [
      { status: OrderStatus.APPROVED },
      { driverId: user.sub },
    ]
  } else if (user.role === 'BRANCH') {
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub } })
    where.branchId = dbUser?.branchId
  } else if (user.role === 'KITCHEN') {
    where.createdById = user.sub
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        createdBy: { select: { id: true, name: true, email: true } },
        driver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ])

  return c.json({
    orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

router.post('/', authorize('KITCHEN'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = createOrderSchema.safeParse(body)
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.errors[0].message })
  }

  const user = c.get('user')
  const { branchId, notes, initImageUrl, items } = result.data

  let orderNo = generateOrderNo()
  let attempts = 0
  while (attempts < 5) {
    const existing = await prisma.order.findUnique({ where: { orderNo } })
    if (!existing) break
    orderNo = generateOrderNo()
    attempts++
  }

  const order = await prisma.order.create({
    data: {
      orderNo,
      branchId,
      notes,
      initImageUrl: initImageUrl || null,
      createdById: user.sub,
      items: { create: items },
    },
    include: {
      items: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })

  return c.json(order, 201)
})

router.get('/:id', async (c) => {
  const user = c.get('user')
  const orderId = c.req.param('id')

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      createdBy: { select: { id: true, name: true, email: true } },
      driver: { select: { id: true, name: true, email: true } },
    },
  })

  if (!order) throw new HTTPException(404, { message: 'Order not found' })

  // Role-based access check
  if (user.role === 'BRANCH') {
    const dbUser = await prisma.user.findUnique({ where: { id: user.sub } })
    if (order.branchId !== dbUser?.branchId) {
      throw new HTTPException(403, { message: 'Access denied' })
    }
  } else if (user.role === 'KITCHEN' && order.createdById !== user.sub) {
    throw new HTTPException(403, { message: 'Access denied' })
  } else if (user.role === 'DRIVER') {
    const canAccess = order.driverId === user.sub || order.status === OrderStatus.APPROVED
    if (!canAccess) throw new HTTPException(403, { message: 'Access denied' })
  }

  return c.json(order)
})

router.patch('/:id/status', async (c) => {
  const user = c.get('user')
  const orderId = c.req.param('id')

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new HTTPException(404, { message: 'Order not found' })

  const body = await c.req.json().catch(() => ({}))
  const result = updateOrderStatusSchema.safeParse(body)
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.errors[0].message })
  }

  const update = result.data
  const { status: newStatus } = update

  const allowedTransitions = VALID_TRANSITIONS[order.status]
  if (!allowedTransitions.includes(newStatus)) {
    throw new HTTPException(400, {
      message: `Cannot transition from ${order.status} to ${newStatus}`,
    })
  }

  const rolePermissions: Partial<Record<OrderStatus, string[]>> = {
    [OrderStatus.APPROVED]: ['ADMIN'],
    [OrderStatus.REJECTED]: ['ADMIN'],
    [OrderStatus.ACCEPTED]: ['DRIVER'],
    [OrderStatus.IN_TRANSIT]: ['DRIVER'],
    [OrderStatus.DELIVERED]: ['DRIVER'],
  }

  const allowedRoles = rolePermissions[newStatus] ?? []
  if (!allowedRoles.includes(user.role)) {
    throw new HTTPException(403, { message: 'You do not have permission to set this status' })
  }

  if (newStatus === OrderStatus.ACCEPTED && order.driverId && order.driverId !== user.sub) {
    throw new HTTPException(403, { message: 'Order already assigned to another driver' })
  }

  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === OrderStatus.ACCEPTED) {
    updateData.driverId = user.sub
  }

  if (newStatus === OrderStatus.IN_TRANSIT && 'pickupPhotos' in update) {
    if (order.driverId !== user.sub) {
      throw new HTTPException(403, { message: 'Not your order' })
    }
    updateData.pickupPhotos = update.pickupPhotos
  }

  if (newStatus === OrderStatus.DELIVERED && 'dropoffPhotos' in update && 'signatureUrl' in update) {
    if (order.driverId !== user.sub) {
      throw new HTTPException(403, { message: 'Not your order' })
    }
    updateData.dropoffPhotos = update.dropoffPhotos
    updateData.signatureUrl = update.signatureUrl
    updateData.deliveredAt = new Date()
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      items: true,
      createdBy: { select: { id: true, name: true, email: true } },
      driver: { select: { id: true, name: true, email: true } },
    },
  })

  return c.json(updated)
})

export default router
