import { z } from 'zod';

export const LeaderboardQuerySchema = z.object({
  scope: z.enum(['org', 'department']).default('org'),
  departmentId: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => BigInt(v))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type LeaderboardQueryInput = z.infer<typeof LeaderboardQuerySchema>;
