import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const CreateQuestionSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(20_000),
});

export const CreateAnswerSchema = z.object({
  body: z.string().min(1).max(20_000),
});

export const QAListQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().max(255).optional(),
});

export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type CreateAnswerInput = z.infer<typeof CreateAnswerSchema>;
export type QAListQuery = z.infer<typeof QAListQuerySchema>;
