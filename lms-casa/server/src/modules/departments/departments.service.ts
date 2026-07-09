import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db.js';
import { HttpError } from '../../utils/httpError.js';
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.schema.js';

const SELECT = { id: true, name: true, code: true, parentId: true } satisfies Prisma.DepartmentSelect;

function rethrowDuplicateCode(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw HttpError.conflict('รหัสสาขานี้ถูกใช้แล้ว');
  }
  throw err;
}

async function assertParentUsable(parentId: bigint): Promise<void> {
  const parent = await prisma.department.findFirst({ where: { id: parentId, deletedAt: null } });
  if (!parent) throw HttpError.badRequest('ไม่พบสาขาที่เลือกเป็นสาขาแม่');
}

/** Walk up the parent chain from `parentId`; if we reach `id` the move would create a cycle. */
async function assertNoCycle(id: bigint, parentId: bigint): Promise<void> {
  let cursor: bigint | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === id) throw HttpError.badRequest('ตั้งสาขาแม่เป็นสาขาลูกของตัวเองไม่ได้');
    if (seen.has(cursor.toString())) break; // pre-existing cycle guard
    seen.add(cursor.toString());
    const node: { parentId: bigint | null } | null = await prisma.department.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = node?.parentId ?? null;
  }
}

export async function listDepartments() {
  const items = await prisma.department.findMany({
    where: { deletedAt: null },
    select: {
      ...SELECT,
      _count: { select: { users: { where: { deletedAt: null } } } },
    },
    orderBy: { name: 'asc' },
  });
  return items.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    parentId: d.parentId,
    userCount: d._count.users,
  }));
}

export async function createDepartment(input: CreateDepartmentInput) {
  if (input.parentId) await assertParentUsable(input.parentId);
  try {
    return await prisma.department.create({
      data: { name: input.name, code: input.code, parentId: input.parentId },
      select: SELECT,
    });
  } catch (err) {
    rethrowDuplicateCode(err);
  }
}

export async function updateDepartment(id: bigint, input: UpdateDepartmentInput) {
  const target = await prisma.department.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบสาขา');

  if (input.parentId !== undefined && input.parentId !== null) {
    if (input.parentId === id) throw HttpError.badRequest('สาขาเป็นสาขาแม่ของตัวเองไม่ได้');
    await assertParentUsable(input.parentId);
    await assertNoCycle(id, input.parentId);
  }

  try {
    return await prisma.department.update({
      where: { id },
      data: { name: input.name, code: input.code, parentId: input.parentId },
      select: SELECT,
    });
  } catch (err) {
    rethrowDuplicateCode(err);
  }
}

export async function deleteDepartment(id: bigint): Promise<void> {
  const target = await prisma.department.findFirst({ where: { id, deletedAt: null } });
  if (!target) throw HttpError.notFound('ไม่พบสาขา');

  const activeUsers = await prisma.user.count({ where: { departmentId: id, deletedAt: null } });
  if (activeUsers > 0) {
    throw HttpError.conflict(`ลบไม่ได้ ยังมีพนักงาน ${activeUsers} คนสังกัดสาขานี้ — ย้ายพนักงานออกก่อน`);
  }
  const children = await prisma.department.count({ where: { parentId: id, deletedAt: null } });
  if (children > 0) {
    throw HttpError.conflict('ลบไม่ได้ ยังมีสาขาย่อยอยู่ภายใต้สาขานี้');
  }

  await prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
}
