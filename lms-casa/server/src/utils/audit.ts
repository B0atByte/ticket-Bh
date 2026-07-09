import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { logger } from './logger.js';

interface AuditPayload {
  actorId?: bigint | null;
  action: string;
  entityType?: string;
  entityId?: string | number | bigint;
  req?: Request;
  changes?: unknown;
  metadata?: Record<string, unknown>;
}

export async function audit(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId:
          payload.entityId !== undefined && payload.entityId !== null
            ? String(payload.entityId)
            : null,
        ipAddress: payload.req?.ip,
        userAgent: payload.req?.get('user-agent') ?? undefined,
        changes:
          payload.changes !== undefined
            ? (payload.changes as Prisma.InputJsonValue)
            : undefined,
        metadata:
          payload.metadata !== undefined
            ? (payload.metadata as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch (err) {
    // Never let audit failure break the main flow
    logger.error('audit log failed', err, { action: payload.action });
  }
}
