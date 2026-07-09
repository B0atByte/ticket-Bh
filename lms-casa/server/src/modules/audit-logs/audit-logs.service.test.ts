import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('../../config/db.js', () => ({
  prisma: {
    auditLog: { findMany: mocks.findMany, count: mocks.count },
  },
}));

import { list, buildWorkbook } from './audit-logs.service.js';

describe('audit-logs.service', () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.count.mockReset();
  });

  it('list builds where with all filters', async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: 1n }]);
    mocks.count.mockResolvedValueOnce(1);
    const from = new Date('2026-01-01');
    const to = new Date('2026-12-31');
    await list({
      page: 1,
      pageSize: 10,
      actorId: 42n,
      action: 'login',
      entityType: 'User',
      from,
      to,
      q: 'searchterm',
    });
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.actorId).toBe(42n);
    expect(where.action.contains).toBe('login');
    expect(where.entityType).toBe('User');
    expect(where.createdAt.gte).toBe(from);
    expect(where.createdAt.lte).toBe(to);
    expect(where.OR).toBeDefined();
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { ipAddress: { contains: 'searchterm' } },
        { userAgent: { contains: 'searchterm' } },
      ]),
    );
    expect(where.OR.some((item: { actor?: unknown }) => item.actor)).toBe(true);
  });

  it('list returns paginated items', async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: 1n }, { id: 2n }]);
    mocks.count.mockResolvedValueOnce(2);
    const out = await list({ page: 1, pageSize: 20 });
    expect(out.items).toHaveLength(2);
    expect(out.meta.total).toBe(2);
  });

  it('buildWorkbook produces an ExcelJS workbook with rows', async () => {
    mocks.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        actorId: 5n,
        action: 'login',
        entityType: 'User',
        entityId: '5',
        ipAddress: '10.0.0.1',
        userAgent: 'agent',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        actor: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      },
    ]);
    const wb = await buildWorkbook({ page: 1, pageSize: 20 });
    expect(mocks.findMany.mock.calls[0][0].take).toBe(50_000);
    expect(wb.worksheets.length).toBe(1);
    const sheet = wb.getWorksheet('Audit Logs');
    expect(sheet).toBeDefined();
    // header row + 1 data row
    expect(sheet!.rowCount).toBe(2);
    const dataRow = sheet!.getRow(2);
    expect(dataRow.getCell('action').value).toBe('login');
    expect(dataRow.getCell('actorEmail').value).toBe('a@b.com');
    expect(dataRow.getCell('actorName').value).toBe('A B');
  });

  it('buildWorkbook handles missing actor gracefully', async () => {
    mocks.findMany.mockResolvedValueOnce([
      {
        id: 1n,
        actorId: null,
        action: 'system',
        entityType: null,
        entityId: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        actor: null,
      },
    ]);
    const wb = await buildWorkbook({ page: 1, pageSize: 20 });
    const sheet = wb.getWorksheet('Audit Logs')!;
    const row = sheet.getRow(2);
    expect(row.getCell('actorId').value).toBe('');
    expect(row.getCell('actorEmail').value).toBe('');
    expect(row.getCell('actorName').value).toBe('');
  });
});
