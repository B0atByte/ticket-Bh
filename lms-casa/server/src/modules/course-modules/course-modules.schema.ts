import { z } from 'zod';

export const CreateModuleSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(5000).optional(),
});

export const UpdateModuleSchema = CreateModuleSchema.partial();

export const ReorderModulesSchema = z.object({
  // ids in desired order
  orderedIds: z.array(z.coerce.bigint()).min(1),
});

export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;
