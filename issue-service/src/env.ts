export function validateEnv(): void {
  const required = ['DASHBOARD_API_KEY', 'ALLOWED_ORIGINS']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variable(s): ${missing.join(', ')}`)
    process.exit(1)
  }
}

// Comma-separated list in .env, e.g. "http://localhost:5173,http://localhost:8083"
// — every system's frontend origin that will POST/fetch directly from the browser.
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
