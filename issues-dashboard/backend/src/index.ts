import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { initStatusDb } from './lib/statusDb.js'
import authRouter from './routes/auth.js'
import issuesRouter from './routes/issues.js'

function validateEnv() {
  const required = ['JWT_SECRET', 'FRONTEND_URL']
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`FATAL: Missing required environment variable: ${key}`)
      process.exit(1)
    }
  }
  if (process.env.JWT_SECRET!.length < 32) {
    console.error('FATAL: JWT_SECRET must be at least 32 characters')
    process.exit(1)
  }
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.warn('WARNING: ADMIN_PASSWORD_HASH is not set — login will fail (503) until configured')
  }
}

validateEnv()
initStatusDb()

const app = new Hono()

app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL!,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use('*', logger())

app.route('/api/auth', authRouter)
app.route('/api/issues', issuesRouter)

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT) || 4002
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`issues-dashboard backend listening on http://localhost:${info.port}`)
})
