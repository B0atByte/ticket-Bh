import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain digit'),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  employeeId: z.string().trim().max(64).optional(),
  phone: z.string().trim().max(32).optional(),
});

export const LoginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    password: z.string().min(1).max(128),
  })
  .refine((value) => value.identifier || value.email, {
    message: 'Email or username is required',
    path: ['identifier'],
  })
  .transform((value) => ({
    identifier: (value.identifier ?? value.email ?? '').trim().toLowerCase(),
    password: value.password,
  }));

// refreshToken is normally read from the httpOnly cookie; the body field is kept
// as a fallback for non-browser clients that can't send cookies.
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
