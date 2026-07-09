import type { TokenResponse } from '../types'

const BASE_URL = '/api'
const REFRESH_TOKEN_KEY = 'bhlogistics_refresh_token'

let accessToken: string | null = null
let isRefreshing = false
let refreshSubscribers: Array<(token: string | null) => void> = []

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export function saveRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearTokens() {
  accessToken = null
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      return null
    }

    const data: TokenResponse = await res.json()
    setAccessToken(data.accessToken)
    saveRefreshToken(data.refreshToken)
    return data.accessToken
  } catch {
    clearTokens()
    return null
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retry) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshSubscribers.push(async (newToken) => {
          if (!newToken) {
            reject(new Error('Session expired'))
            return
          }
          try {
            const result = await apiFetch<T>(path, options, false)
            resolve(result)
          } catch (e) {
            reject(e)
          }
        })
      })
    }

    isRefreshing = true
    const newToken = await refreshAccessToken()
    isRefreshing = false
    onRefreshed(newToken)

    if (!newToken) {
      throw new Error('Session expired')
    }

    return apiFetch<T>(path, options, false)
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(errorData.error ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData) =>
    apiFetch<T>(path, { method: 'POST', body: formData }),
}
