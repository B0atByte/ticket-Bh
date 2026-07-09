import { z } from 'zod';

export const UpsertCriterionSchema = z.object({
  title: z.string().trim().min(1, 'จำเป็น').max(255),
});

export const ReorderCriteriaSchema = z.object({
  orderedIds: z.array(z.coerce.bigint()).min(1),
});

export const PracticalEvalResultSchema = z.enum(['PENDING', 'PASSED', 'FAILED']);

export const SubmitEvaluationSchema = z.object({
  result: PracticalEvalResultSchema,
  starRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  comment: z.string().max(2000).optional().or(z.literal('')),
  items: z.array(
    z.object({
      criterionId: z.coerce.bigint(),
      checked: z.boolean(),
    }),
  ),
});

export type UpsertCriterionInput = z.infer<typeof UpsertCriterionSchema>;
export type ReorderCriteriaInput = z.infer<typeof ReorderCriteriaSchema>;
export type SubmitEvaluationInput = z.infer<typeof SubmitEvaluationSchema>;
