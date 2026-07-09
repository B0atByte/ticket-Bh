import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const UserListQuerySchema = PaginationQuerySchema.extend({
  role: z.string().trim().optional(),
  departmentId: z.coerce.bigint().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'DISABLED']).optional(),
});

export const CreateUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  employeeId: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
  departmentId: z.coerce.bigint().optional(),
  positionId: z.coerce.bigint().optional(),
  managerId: z.preprocess(
    (v) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      if (typeof v === 'string' || typeof v === 'number') {
        try { return BigInt(v); } catch { return v; }
      }
      return v;
    },
    z.bigint().nullable().optional(),
  ),
  roleKeys: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'DISABLED']).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export const ChangeUserPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
