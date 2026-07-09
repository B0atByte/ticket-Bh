import { api } from '../../lib/api';
import type { Paginated } from '../learning/learning.api';

export interface AuditLogItem {
  id: string;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  changes?: unknown;
  metadata?: unknown;
  createdAt: string;
  actor?: {
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface Branding {
  name: string;
  primaryColor: string;
  logoUrl?: string | null;
}

export async function listAuditLogs(filters: AuditLogFilters): Promise<Paginated<AuditLogItem>> {
  const { data } = await api.get<Paginated<AuditLogItem>>('/audit-logs', { params: filters });
  return data;
}

export async function downloadAuditLogs(filters: AuditLogFilters): Promise<Blob> {
  const { data } = await api.get<Blob>('/audit-logs/export.xlsx', {
    params: filters,
    responseType: 'blob',
  });
  return data;
}

export interface AntiAfkConfig {
  enabled: boolean;
  minIntervalSec: number;
  maxIntervalSec: number;
  answerTimeoutSec: number;
}

export async function getAntiAfk(): Promise<AntiAfkConfig> {
  const { data } = await api.get<{ antiAfk: AntiAfkConfig }>('/settings/anti-afk');
  return data.antiAfk;
}

export async function updateAntiAfk(input: AntiAfkConfig): Promise<AntiAfkConfig> {
  const { data } = await api.put<{ antiAfk: AntiAfkConfig }>('/settings/anti-afk', input);
  return data.antiAfk;
}

export async function getBranding(): Promise<Branding> {
  const { data } = await api.get<{ branding: Branding }>('/settings/branding');
  return data.branding;
}

export async function updateBranding(input: Branding): Promise<Branding> {
  const { data } = await api.put<{ branding: Branding }>('/settings/branding', input);
  return data.branding;
}

export async function uploadLogo(file: File): Promise<Branding> {
  const form = new FormData();
  form.append('logo', file);
  const { data } = await api.post<{ branding: Branding }>('/settings/branding/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.branding;
}

export function applyBranding(branding: Branding): void {
  document.documentElement.style.setProperty('--primary', hexToHsl(branding.primaryColor));
  document.title = branding.name;
}

function hexToHsl(hex: string): string {
  const raw = hex.replace('#', '');
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
