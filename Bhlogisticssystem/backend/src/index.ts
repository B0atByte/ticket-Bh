import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import authRouter from './routes/auth.js'
import ordersRouter from './routes/orders.js'
import uploadsRouter from './routes/uploads.js'
import issuesRouter from './routes/issues.js'

function validateEnv() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL']
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
  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    console.error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters')
    process.exit(1)
  }
}

validateEnv()

const app = new Hono()

app.use('*', secureHeaders({
  crossOriginResourcePolicy: false, // Handled per-route below
}))
app.use(
  '*',
  cors({
    origin: process.env.FRONTEND_URL!,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)
app.use('*', logger())

// Allow any origin to load uploaded files (images viewed in browser across ports)
app.use('/uploads/*', async (c, next) => {
  c.header('Cross-Origin-Resource-Policy', 'cross-origin')
  c.header('Access-Control-Allow-Origin', '*')
  await next()
})
app.use('/uploads/*', serveStatic({ root: './' }))

app.route('/api/auth', authRouter)
app.route('/api/orders', ordersRouter)
app.route('/api/uploads', uploadsRouter)
app.route('/api/issues', issuesRouter)

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

const port = Number(process.env.PORT ?? 3000)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
