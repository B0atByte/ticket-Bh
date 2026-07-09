import { z } from 'zod';

export const BrandingSchema = z.object({
  name: z.string().trim().min(1).max(120),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB format'),
  logoUrl: z.string().trim().max(500).nullable().optional(),
});

export type BrandingInput = z.infer<typeof BrandingSchema>;

export const AntiAfkSchema = z
  .object({
    enabled: z.coerce.boolean(),
    minIntervalSec: z.coerce.number().int().min(5).max(3600),
    maxIntervalSec: z.coerce.number().int().min(5).max(3600),
    answerTimeoutSec: z.coerce.number().int().min(3).max(120),
  })
  .refine((v) => v.maxIntervalSec >= v.minIntervalSec, {
    message: 'ช่วงเวลาสูงสุดต้องไม่น้อยกว่าช่วงเวลาต่ำสุด',
    path: ['maxIntervalSec'],
  });

export type AntiAfkInput = z.infer<typeof AntiAfkSchema>;
