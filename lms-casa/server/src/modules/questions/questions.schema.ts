import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const QuestionTypeSchema = z.enum([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'MATCHING',
  'ORDERING',
  'DRAG_DROP',
  'HOTSPOT',
  'SHORT_ANSWER',
  'ESSAY',
  'FILE_UPLOAD',
  'LIKERT',
]);

export const DifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

export const QuestionListQuerySchema = PaginationQuerySchema.extend({
  bankId: z.coerce.bigint().optional(),
  type: QuestionTypeSchema.optional(),
  difficulty: DifficultySchema.optional(),
  categoryId: z.coerce.bigint().optional(),
});

export const QuestionOptionInputSchema = z.object({
  text: z.string().trim().min(1).max(5_000),
  imageUrl: z.string().url().max(500).optional(),
  isCorrect: z.boolean().default(false),
  orderIndex: z.number().int().min(0).optional(),
  meta: z.unknown().optional(),
});

export const CreateQuestionSchema = z.object({
  bankId: z.coerce.bigint().optional(),
  type: QuestionTypeSchema,
  difficulty: DifficultySchema.optional(),
  text: z.string().trim().min(1).max(20_000),
  explanation: z.string().max(20_000).optional(),
  defaultPoints: z.number().int().positive().max(1_000).optional(),
  categoryId: z.coerce.bigint().optional(),
  meta: z.unknown().optional(),
  options: z.array(QuestionOptionInputSchema).max(20).optional(),
});

export const UpdateQuestionSchema = CreateQuestionSchema.partial();

export const BulkQuestionImportSchema = z.object({
  bankId: z.coerce.bigint(),
  questions: z.array(CreateQuestionSchema).min(1).max(500),
});

export const GenerateQuestionDraftsSchema = z.object({
  sourceText: z.string().trim().min(10).max(30_000),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: DifficultySchema.default('MEDIUM'),
});

export const ParseQuestionTextSchema = z.object({
  rawText: z.string().trim().min(10).max(50_000),
});

export const GenerateFromCourseSchema = z.object({
  courseId: z.coerce.bigint(),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: DifficultySchema.default('MEDIUM'),
});

export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;
export type CreateQuestionInput = z.infer<typeof CreateQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof UpdateQuestionSchema>;
export type BulkQuestionImportInput = z.infer<typeof BulkQuestionImportSchema>;
export type GenerateQuestionDraftsInput = z.infer<typeof GenerateQuestionDraftsSchema>;
export type ParseQuestionTextInput = z.infer<typeof ParseQuestionTextSchema>;
