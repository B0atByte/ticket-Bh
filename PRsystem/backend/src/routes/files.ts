import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { writeFile, readFile } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const router = new Hono()

const UPLOAD_DIR = path.resolve('./uploads')
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.xlsx', '.xls', '.docx', '.doc'])

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
}

// POST /api/files — อัปโหลดไฟล์
router.post('/', authMiddleware, async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'ไม่พบไฟล์' }, 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: `ไฟล์ขนาดใหญ่เกินไป (สูงสุด ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, 400)
  }

  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: `ประเภทไฟล์ไม่รองรับ (รองรับ: ${[...ALLOWED_EXTENSIONS].join(', ')})` }, 400)
  }

  const baseName = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  let buffer: Buffer = Buffer.from(await file.arrayBuffer())
  let savedExt = ext

  // compress รูปภาพเป็น WebP (ยกเว้น GIF)
  if (IMAGE_EXTENSIONS.has(ext) && ext !== '.gif') {
    try {
      buffer = Buffer.from(await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer())
      savedExt = '.webp'
    } catch {
      return c.json({ error: 'ไฟล์รูปภาพไม่ถูกต้องหรือเสียหาย' }, 400)
    }
  }

  const safeName = `${baseName}${savedExt}`
  await writeFile(path.join(UPLOAD_DIR, safeName), buffer)

  return c.json({ url: `/api/files/${safeName}`, name: file.name })
})

// GET /api/files/:filename — เสิร์ฟไฟล์
router.get('/:filename', async (c) => {
  const { filename } = c.req.param()

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || path.isAbsolute(filename)) {
    return c.json({ error: 'Invalid filename' }, 400)
  }

  const ext = path.extname(filename).toLowerCase()
  const allowedWithWebp = new Set([...ALLOWED_EXTENSIONS, '.webp'])
  if (!allowedWithWebp.has(ext)) {
    return c.json({ error: 'Invalid filename' }, 400)
  }

  const filePath = path.join(UPLOAD_DIR, filename)
  try {
    const data = await readFile(filePath)
    const mime = MIME[ext] || 'application/octet-stream'
    return new Response(data, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return c.json({ error: 'File not found' }, 404)
  }
})

export default router
