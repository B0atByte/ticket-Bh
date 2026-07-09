import { z } from 'zod';

export const UpsertProgressSchema = z.object({
  lastPositionSec: z.number().int().min(0).max(86400),
  secondsWatched: z.number().int().min(0).max(86400),
  completed: z.boolean().optional(),
});

export type UpsertProgressInput = z.infer<typeof UpsertProgressSchema>;
