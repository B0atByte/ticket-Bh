import { z } from 'zod';

export const CreateIssueSchema = z.object({
  description: z.string().trim().min(5, 'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร').max(2000),
  page: z.string().trim().max(500).optional(),
});

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>;
