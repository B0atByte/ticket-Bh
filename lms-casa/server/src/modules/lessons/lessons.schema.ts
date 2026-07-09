import { z } from 'zod';

export const CreateLessonSchema = z.object({
  title: z.string().trim().min(1).max(255),
  summary: z.string().trim().max(500).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  isRequired: z.boolean().optional(),
});

export const UpdateLessonSchema = CreateLessonSchema.partial();

export const ReorderLessonsSchema = z.object({
  orderedIds: z.array(z.coerce.bigint()).min(1),
});

const ContentTypeEnum = z.enum(['TEXT', 'HTML', 'VIDEO', 'PDF', 'SLIDES', 'AUDIO', 'LINK', 'SCORM']);

export const UpsertLessonContentSchema = z.object({
  type: ContentTypeEnum,
  title: z.string().trim().max(255).optional(),
  body: z.string().max(50_000).optional(),
  // Accept an absolute http(s) URL OR an uploaded file path like /uploads/materials/xyz.pdf
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^https?:\/\//.test(v) || v.startsWith('/uploads/'), {
      message: 'URL ต้องเป็น http(s):// หรือไฟล์ที่อัปโหลดในระบบ',
    })
    .optional(),
  fileId: z.coerce.bigint().optional(),
  meta: z.record(z.unknown()).optional(),
});

export type CreateLessonInput = z.infer<typeof CreateLessonSchema>;
export type UpdateLessonInput = z.infer<typeof UpdateLessonSchema>;
export type UpsertLessonContentInput = z.infer<typeof UpsertLessonContentSchema>;
