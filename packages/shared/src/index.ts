import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .regex(/\d/, 'password must contain at least 1 number'),
});

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .regex(/\d/, 'password must contain at least 1 number'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().max(255),
  otp: z.string().regex(/^\d{6}$/, 'otp must be exactly 6 digits'),
  newPassword: z
    .string()
    .min(8)
    .regex(/\d/, 'newPassword must contain at least 1 number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createNoteSchema = z.object({
  title: z.string().min(1, 'title is required').max(200, 'title must be at most 200 characters'),
  body: z.record(z.unknown()),
  tagIds: z.array(z.string()).optional(),
});

export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'at least one field (title, body, or tagIds) must be provided',
  });

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const listNotesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'limit must be at least 1')
    .max(50, 'limit must be at most 50')
    .default(20),
  sort: z
    .string()
    .regex(
      /^(createdAt|updatedAt):(asc|desc)$/,
      'sort must be one of: createdAt:asc, createdAt:desc, updatedAt:asc, updatedAt:desc',
    )
    .default('createdAt:desc'),
  tagIds: z.string().optional(),
});

export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
