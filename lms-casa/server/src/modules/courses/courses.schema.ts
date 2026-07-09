import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const CourseListQuerySchema = PaginationQuerySchema.extend({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  categoryId: z.coerce.bigint().optional(),
  authorId: z.coerce.bigint().optional(),
  visibility: z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE']).optional(),
});

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const CreateCourseSchema = z.object({
  title: z.string().trim().min(1).max(255),
  // Optional: the server auto-generates a unique slug from the title when omitted.
  slug: z.string().trim().min(1).max(255).regex(slugRegex, 'lowercase, digits and dashes only').optional(),
  summary: z.string().trim().max(500).optional(),
  description: z.string().max(10_000).optional(),
  // Accepts an absolute URL or an uploaded path like /uploads/courses/xyz.png
  coverImageUrl: z.string().trim().max(500).optional(),
  visibility: z.enum(['PUBLIC', 'INTERNAL', 'PRIVATE']).optional(),
  estimatedMinutes: z.number().int().nonnegative().optional(),
  recurringMonths: z.number().int().positive().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  antiAfkEnabled: z.boolean().optional(),
  // Next course unlocked by a code when this course's exam is passed (null = none).
  unlockNextCourseId: z.coerce.bigint().nullable().optional(),
  categoryId: z.coerce.bigint().optional(),
  tagIds: z.array(z.coerce.bigint()).optional(),
});

export const UpdateCourseSchema = CreateCourseSchema.partial();

export type CourseListQuery = z.infer<typeof CourseListQuerySchema>;
export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type UpdateCourseInput = z.infer<typeof UpdateCourseSchema>;
