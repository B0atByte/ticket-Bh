import { z } from 'zod';

export const CreateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : undefined)),
  parentId: z.coerce.bigint().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentSchema>;
