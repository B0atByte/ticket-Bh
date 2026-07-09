import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { paginated, skipTake } from '../../utils/pagination.js';
import type { AuditLogQuery } from './audit-logs.schema.js';

function whereFromQuery(query: AuditLogQuery): Prisma.AuditLogWhereInput {
  return {
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { action: { contains: query.q } },
            { entityType: { contains: query.q } },
            { entityId: { contains: query.q } },
            { ipAddress: { contains: query.q } },
            { userAgent: { contains: query.q } },
            {
              actor: {
                is: {
                  OR: [
                    { email: { contains: query.q } },
                    { firstName: { contains: query.q } },
                    { lastName: { contains: query.q } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function list(query: AuditLogQuery) {
  const where = whereFromQuery(query);
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      ...skipTake(query.page, query.pageSize),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        actorId: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        userAgent: true,
        changes: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return paginated(items, total, query.page, query.pageSize);
}

export async function buildWorkbook(query: AuditLogQuery): Promise<ExcelJS.Workbook> {
  const rows = await prisma.auditLog.findMany({
    where: whereFromQuery(query),
    take: 50_000,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      actor: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMS Casa';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Audit Logs');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'Created At', key: 'createdAt', width: 24 },
    { header: 'Actor ID', key: 'actorId', width: 14 },
    { header: 'Actor Email', key: 'actorEmail', width: 28 },
    { header: 'Actor Name', key: 'actorName', width: 28 },
    { header: 'Action', key: 'action', width: 24 },
    { header: 'Entity Type', key: 'entityType', width: 18 },
    { header: 'Entity ID', key: 'entityId', width: 18 },
    { header: 'IP Address', key: 'ipAddress', width: 18 },
    { header: 'User Agent', key: 'userAgent', width: 48 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' },
  };

  for (const row of rows) {
    sheet.addRow({
      id: row.id.toString(),
      createdAt: row.createdAt.toISOString(),
      actorId: row.actorId?.toString() ?? '',
      actorEmail: row.actor?.email ?? '',
      actorName: row.actor ? `${row.actor.firstName} ${row.actor.lastName}` : '',
      action: row.action,
      entityType: row.entityType ?? '',
      entityId: row.entityId ?? '',
      ipAddress: row.ipAddress ?? '',
      userAgent: row.userAgent ?? '',
    });
  }

  return wb;
}
