import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const ExamTypeSchema = z.enum([
  'QUIZ',
  'ASSESSMENT',
  'PRE_TEST',
  'POST_TEST',
  'CERTIFICATION',
  'SURVEY',
]);

export const ExamStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const ShowResultModeSchema = z.enum(['NEVER', 'AFTER_SUBMIT', 'AFTER_CLOSE_DATE']);

export const ExamListQuerySchema = PaginationQuerySchema.extend({
  status: ExamStatusSchema.optional(),
  type: ExamTypeSchema.optional(),
  courseId: z.coerce.bigint().optional(),
});

export const CreateExamSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20_000).optional(),
  courseId: z.coerce.bigint().optional(),
  type: ExamTypeSchema.optional(),
  // Tolerant: null/empty from a disabled/blank field becomes undefined (server falls back).
  timeLimitMinutes: z.preprocess(
    (v) => (v == null || v === '' || v === 0 ? undefined : v),
    z.number().int().positive().max(7 * 24 * 60).optional(),
  ),
  secondsPerQuestion: z.preprocess(
    (v) => (v == null || v === '' || v === 0 ? undefined : v),
    z.number().int().min(5).max(3600).optional(),
  ),
  passingScore: z.preprocess(
    (v) => (v == null || v === '' || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().int().min(0).max(100).optional(),
  ),
  maxAttempts: z.preprocess(
    (v) => (v == null || v === '' || v === 0 ? undefined : v),
    z.number().int().positive().max(100).optional(),
  ),
  cooldownMinutes: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z.number().int().nonnegative().max(365 * 24 * 60).optional(),
  ),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showResultMode: ShowResultModeSchema.optional(),
  antiCheat: z.unknown().optional(),
  randomFromBankId: z.coerce.bigint().optional(),
  randomCount: z.number().int().positive().max(500).optional(),
});

export const UpdateExamSchema = CreateExamSchema.partial();

export const AssignQuestionSchema = z.object({
  questionId: z.coerce.bigint(),
  points: z.number().int().positive().max(1_000),
  orderIndex: z.number().int().min(0).optional(),
});

export type ExamListQuery = z.infer<typeof ExamListQuerySchema>;
export type CreateExamInput = z.infer<typeof CreateExamSchema>;
export type UpdateExamInput = z.infer<typeof UpdateExamSchema>;
export type AssignQuestionInput = z.infer<typeof AssignQuestionSchema>;
