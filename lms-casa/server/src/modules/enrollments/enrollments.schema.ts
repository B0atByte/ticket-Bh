import { z } from 'zod';

export const AssignEnrollmentSchema = z.object({
  userId: z.coerce.bigint().positive(),
  dueAt: z.coerce.date().optional(),
});

export const UpdateEnrollmentStatusSchema = z.object({
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'WITHDRAWN']),
});

export const EnrollmentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AssignEnrollmentInput = z.infer<typeof AssignEnrollmentSchema>;
export type UpdateEnrollmentStatusInput = z.infer<typeof UpdateEnrollmentStatusSchema>;
export type EnrollmentListQuery = z.infer<typeof EnrollmentListQuerySchema>;
