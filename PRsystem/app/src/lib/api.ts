// BASE_URL ว่างเพื่อให้ Vite proxy จัดการใน dev, Nginx จัดการใน production
const BASE_URL = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('token') || ''
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({ error: 'Network error' }))
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data as T
}

export const api = {
  auth: {
    login: (username: string, password: string, rememberMe = false) =>
      req<{ token: string; user: any }>('POST', '/api/auth/login', { username, password, rememberMe }),
    me: () => req<any>('GET', '/api/auth/me'),
    logout: () => req<{ ok: boolean }>('POST', '/api/auth/logout', {}),
    getLockedIps: () => req<any[]>('GET', '/api/auth/locked-ips'),
    unlockIp: (ip: string) => req<{ ok: boolean }>('DELETE', `/api/auth/locked-ips/${encodeURIComponent(ip)}`),
  },
  requests: {
    list: () => req<any[]>('GET', '/api/requests'),
    listAll: () => req<any[]>('GET', '/api/requests/all'),
    create: (data: unknown) => req<any>('POST', '/api/requests', data),
    update: (id: string, data: unknown) => req<any>('PUT', `/api/requests/${id}`, data),
    updateStatus: (id: string, data: unknown) =>
      req<any>('PATCH', `/api/requests/${id}/status`, data),
    exportExcel: async (status?: string) => {
      const url = `${BASE_URL}/api/requests/export${status ? `?status=${status}` : ''}`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
      if (!res.ok) throw new Error('Export ไม่สำเร็จ')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `purchase-report-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
    },
  },
  users: {
    list: () => req<any[]>('GET', '/api/users'),
    create: (data: unknown) => req<any>('POST', '/api/users', data),
    update: (id: string, data: unknown) => req<any>('PUT', `/api/users/${id}`, data),
    delete: (id: string) => req<{ ok: boolean }>('DELETE', `/api/users/${id}`),
    resetPassword: (id: string) =>
      req<{ ok: boolean; newPassword: string }>('POST', `/api/users/${id}/reset-password`, {}),
  },
  audit: {
    list: () => req<any[]>('GET', '/api/audit'),
    log: (data: { action: string; module: string; detail: string }) =>
      req<any>('POST', '/api/audit', data),
  },
  settings: {
    get: () => req<any>('GET', '/api/settings'),
    getSecure: () => req<any>('GET', '/api/settings/secure'),
    update: (data: object) => req<any>('PUT', '/api/settings', data),
    testEmail: () => req<{ ok: boolean; sentTo: string }>('POST', '/api/settings/test-email', {}),
    testDiscord: (webhook?: string) => req<{ ok: boolean }>('POST', '/api/settings/test-discord', { webhook }),
    sendReport: () => req<{ ok: boolean }>('POST', '/api/settings/discord-report', {}),
    botStatus: () => req<{ online: boolean }>('GET', '/api/settings/bot-status'),
    botStart: () => req<{ ok: boolean }>('POST', '/api/settings/bot-start', {}),
    botStop: () => req<{ ok: boolean }>('POST', '/api/settings/bot-stop', {}),
    botReport: () => req<{ ok: boolean }>('POST', '/api/settings/bot-report', {}),
  },
  files: {
    upload: async (file: File): Promise<{ url: string; name: string }> => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE_URL}/api/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json().catch(() => ({ error: 'Network error' }))
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      return data
    },
    open: (url: string) => {
      window.open(`${BASE_URL}${url}`, '_blank')
    },
  },
  issues: {
    create: (data: { description: string; page?: string }) => req<any>('POST', '/api/issues', data),
  },
}
