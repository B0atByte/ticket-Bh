import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const CreateNoteSchema = z.object({
  type: z.enum(['NOTE', 'BOOKMARK']).default('NOTE'),
  content: z.string().min(1).max(10_000),
  timestampSec: z.number().int().min(0).max(86400).optional(),
});

export const UpdateNoteSchema = z.object({
  content: z.string().min(1).max(10_000),
});

export const NoteListQuerySchema = PaginationQuerySchema.extend({
  type: z.enum(['NOTE', 'BOOKMARK']).optional(),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;
export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;
export type NoteListQuery = z.infer<typeof NoteListQuerySchema>;
