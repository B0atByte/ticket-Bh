import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import type { AntiAfkInput, BrandingInput } from './settings.schema.js';

const BRANDING_KEY = 'system.branding';
const DEFAULT_BRANDING: BrandingInput = {
  name: 'LMS Casa',
  primaryColor: '#2563eb',
  logoUrl: null,
};

const ANTI_AFK_KEY = 'learning.anti_afk';
const DEFAULT_ANTI_AFK: AntiAfkInput = {
  enabled: true,
  minIntervalSec: 20,
  maxIntervalSec: 45,
  answerTimeoutSec: 10,
};

export async function getBranding(): Promise<BrandingInput> {
  const setting = await prisma.setting.findUnique({ where: { key: BRANDING_KEY } });
  if (!setting) return DEFAULT_BRANDING;
  return { ...DEFAULT_BRANDING, ...(setting.value as Partial<BrandingInput>) };
}

export async function updateBranding(input: BrandingInput): Promise<BrandingInput> {
  const value = {
    name: input.name,
    primaryColor: input.primaryColor,
    logoUrl: input.logoUrl ?? null,
  };
  await prisma.setting.upsert({
    where: { key: BRANDING_KEY },
    create: {
      key: BRANDING_KEY,
      value: value as Prisma.InputJsonValue,
      description: 'Branding settings',
    },
    update: { value: value as Prisma.InputJsonValue },
  });
  return value;
}

export async function getAntiAfk(): Promise<AntiAfkInput> {
  const setting = await prisma.setting.findUnique({ where: { key: ANTI_AFK_KEY } });
  if (!setting) return DEFAULT_ANTI_AFK;
  return { ...DEFAULT_ANTI_AFK, ...(setting.value as Partial<AntiAfkInput>) };
}

export async function updateAntiAfk(input: AntiAfkInput): Promise<AntiAfkInput> {
  const value: AntiAfkInput = {
    enabled: input.enabled,
    minIntervalSec: input.minIntervalSec,
    maxIntervalSec: input.maxIntervalSec,
    answerTimeoutSec: input.answerTimeoutSec,
  };
  await prisma.setting.upsert({
    where: { key: ANTI_AFK_KEY },
    create: { key: ANTI_AFK_KEY, value: value as unknown as Prisma.InputJsonValue, description: 'Anti-AFK settings' },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });
  return value;
}
