import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// issue-service/data/uploads/ — sibling of data/issues.sqlite, same gitignore
// coverage (issue-service/data/ in root .gitignore).
const UPLOAD_DIR = fileURLToPath(new URL('../../data/uploads/', import.meta.url))

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB — generous for a screenshot, not for video

const ALLOWED_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

export interface StoredAttachment {
  storedName: string // random filename on disk — never trust the original name for the path
  originalName: string
  mime: string
}

export type SaveAttachmentResult = { ok: true; value: StoredAttachment } | { ok: false; error: string }

export async function saveAttachment(file: File): Promise<SaveAttachmentResult> {
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: 'ไฟล์แนบต้องไม่เกิน 10MB' }
  }
  const ext = ALLOWED_MIME[file.type]
  if (!ext) {
    return { ok: false, error: 'รองรับเฉพาะไฟล์ภาพ (PNG/JPEG/GIF/WEBP) หรือ PDF เท่านั้น' }
  }

  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
  const storedName = `${randomUUID()}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  writeFileSync(`${UPLOAD_DIR}${storedName}`, buffer)

  return { ok: true, value: { storedName, originalName: file.name || storedName, mime: file.type } }
}

export function readAttachment(storedName: string): Buffer {
  return readFileSync(`${UPLOAD_DIR}${storedName}`)
}
