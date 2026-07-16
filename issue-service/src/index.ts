import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { initDb } from './db/client.js'
import { allowedOrigins, validateEnv } from './env.js'
import issuesRouter from './routes/issues.js'

validateEnv()
initDb()

const app = new Hono()

app.use('*', logger())

// Frontends of all 5 systems POST here directly from the browser (see
// README "Frontend wiring checklist"), so every one of their origins must be
// allow-listed. issues-dashboard's GET pull is server-to-server and doesn't
// go through CORS at all.
app.use(
  '/api/issues/*',
  cors({
    origin: allowedOrigins(),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Dashboard-Key'],
  })
)

app.route('/api/issues', issuesRouter)

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT) || 4003
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`issue-service listening on http://localhost:${info.port}`)
})
