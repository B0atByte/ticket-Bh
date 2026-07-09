import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, AuthResponse } from '../types'
import {
  api,
  setAccessToken,
  saveRefreshToken,
  getRefreshToken,
  clearTokens,
} from '../lib/api'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken })
      }
    } catch {
      // ignore
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      setIsLoading(false)
      return
    }

    api
      .post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken })
      .then(async (data) => {
        setAccessToken(data.accessToken)
        saveRefreshToken(data.refreshToken)
        const me = await api.get<User>('/auth/me')
        setUser(me)
      })
      .catch(() => {
        clearTokens()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { email, password })
    setAccessToken(data.accessToken)
    saveRefreshToken(data.refreshToken)
    setUser(data.user)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
