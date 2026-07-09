import { z } from 'zod'
import type { Context } from 'hono'

export async function parseBody<T>(c: Context, schema: z.ZodSchema<T>): Promise<{ data: T } | Response> {
  try {
    const raw = await c.req.json()
    const data = schema.parse(raw)
    return { data }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      return c.json({ error: `ข้อมูลไม่ถูกต้อง: ${messages}` }, 400) as unknown as Response
    }
    throw err
  }
}
