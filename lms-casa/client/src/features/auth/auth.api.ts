import { api } from '../../lib/api';
import type { AuthSession, AuthUser } from '../../types/auth';

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface OidcStatus {
  enabled: boolean;
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/auth/login', input);
  return data;
}

export async function getOidcStatus(): Promise<OidcStatus> {
  const { data } = await api.get<OidcStatus>('/auth/oidc/status');
  return data;
}

// Exchanges a one-time OIDC code for session cookies (set by the server).
export async function exchangeOidcCode(code: string): Promise<void> {
  await api.post('/auth/oidc/exchange', { code });
}

export async function me(): Promise<AuthUser> {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me');
  return data.user;
}

// Rotates the session cookies (server reads the refresh-token cookie).
export async function refresh(): Promise<void> {
  await api.post('/auth/refresh');
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // best-effort: the server clears the auth cookies regardless
  }
}
