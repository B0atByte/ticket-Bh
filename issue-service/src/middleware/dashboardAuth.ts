import type { Context, Next } from 'hono'

// Same contract every system's own GET /issues already uses today, so
// issues-dashboard's source config (sources.ts) needs no shape changes —
// only the base URL/key it points at.
export async function requireDashboardKey(c: Context, next: Next) {
  const configured = process.env.DASHBOARD_API_KEY
  if (!configured) {
    return c.json({ error: 'Dashboard API not configured' }, 503)
  }
  if (c.req.header('X-Dashboard-Key') !== configured) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}
