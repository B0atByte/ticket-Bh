import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import crypto from 'crypto'
import { authenticate } from '../middleware/auth.js'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

const router = new Hono()
router.use('*', authenticate)

router.post('/', async (c) => {
  const formData = await c.req.formData().catch(() => null)
  if (!formData) throw new HTTPException(400, { message: 'Invalid form data' })

  const file = formData.get('file') as File | null
  if (!file) throw new HTTPException(400, { message: 'No file provided' })

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new HTTPException(400, { message: 'Only JPEG, PNG, and WebP images are allowed' })
  }

  if (file.size > MAX_SIZE) {
    throw new HTTPException(400, { message: 'File size must be less than 10MB' })
  }

  const uploadDir = process.env.UPLOAD_DIR ?? './uploads'
  await mkdir(uploadDir, { recursive: true })

  const ext = extname(file.name) || '.jpg'
  const fileName = `${crypto.randomBytes(16).toString('hex')}${ext}`
  const filePath = join(uploadDir, fileName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filePath, buffer)

  const baseUrl = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
  return c.json({ url: `${baseUrl}/uploads/${fileName}` }, 201)
})

export default router
