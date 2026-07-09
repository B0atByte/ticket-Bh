import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const AttemptListQuerySchema = PaginationQuerySchema.extend({
  examId: z.coerce.bigint().optional(),
});

export const SaveResponseSchema = z.object({
  questionId: z.coerce.bigint(),
  selectedOptionIds: z.array(z.coerce.bigint()).max(50).optional(),
  textAnswer: z.string().max(20_000).optional(),
  meta: z.unknown().optional(),
});

/** Anti-cheat / proctoring event types */
const ANTI_CHEAT_EVENT_TYPES = [
  'TAB_BLUR',
  'TAB_FOCUS',
  'FULLSCREEN_EXIT',
  'FULLSCREEN_ENTER',
  'PASTE_DETECTED',
  'COPY_DETECTED',
  'VISIBILITY_HIDDEN',
  'VISIBILITY_VISIBLE',
  'WINDOW_BLUR',
  'WINDOW_FOCUS',
  'DEVTOOLS_OPEN',
  'RIGHT_CLICK',
  'CUSTOM',
] as const;

export const LogEventSchema = z.object({
  type: z.enum(ANTI_CHEAT_EVENT_TYPES),
  payload: z.record(z.unknown()).optional(),
});

export type AttemptListQuery = z.infer<typeof AttemptListQuerySchema>;
export type SaveResponseInput = z.infer<typeof SaveResponseSchema>;
export type LogEventInput = z.infer<typeof LogEventSchema>;
