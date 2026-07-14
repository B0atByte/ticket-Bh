import { z } from 'zod';

export const GenerateReportSchema = z.object({
  kind: z.enum(['exam-results', 'course-completion']),
  examId: z.coerce.bigint().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
