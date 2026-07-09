import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const AuditLogQuerySchema = PaginationQuerySchema.extend({
  actorId: z.coerce.bigint().optional(),
  action: z.string().trim().max(120).optional(),
  entityType: z.string().trim().max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
