import { z } from 'zod';
import { PaginationQuerySchema } from '../../utils/pagination.js';

export const NotificationQuerySchema = PaginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});

export const CreateNotificationSchema = z.object({
  userId: z.coerce.bigint(),
  type: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(255),
  body: z.string().trim().max(5_000).optional(),
  data: z.unknown().optional(),
});

export type NotificationQuery = z.infer<typeof NotificationQuerySchema>;
export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
