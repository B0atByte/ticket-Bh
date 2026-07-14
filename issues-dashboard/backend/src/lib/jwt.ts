import jwt from 'jsonwebtoken'

function secret(): string {
  return process.env.JWT_SECRET!
}

export function signDashboardToken(): string {
  return jwt.sign({ role: 'dashboard-admin' }, secret(), { expiresIn: '12h' })
}

export function verifyDashboardToken(token: string): boolean {
  try {
    jwt.verify(token, secret())
    return true
  } catch {
    return false
  }
}
