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
