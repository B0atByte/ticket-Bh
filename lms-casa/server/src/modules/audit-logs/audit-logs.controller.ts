import type { Request, Response } from 'express';
import { audit } from '../../utils/audit.js';
import { AuditLogQuerySchema } from './audit-logs.schema.js';
import * as service from './audit-logs.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = AuditLogQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function exportXlsx(req: Request, res: Response): Promise<void> {
  const query = AuditLogQuerySchema.parse(req.query);
  const wb = await service.buildWorkbook(query);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.xlsx"`,
  );
  await wb.xlsx.write(res);
  res.end();
  await audit({
    actorId: req.auth ? BigInt(req.auth.userId) : undefined,
    action: 'audit.export',
    entityType: 'audit_log',
    req,
    metadata: {
      action: query.action,
      entityType: query.entityType,
      from: query.from?.toISOString(),
      to: query.to?.toISOString(),
    },
  });
}
