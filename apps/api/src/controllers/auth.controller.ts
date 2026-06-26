import type { Request, Response } from 'express';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@noteapp/shared';
import { setRefreshCookie, clearRefreshCookie } from '../lib/cookie.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  sendOtp,
  resetPassword,
} from '../services/auth.service.js';

export async function registerController(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const user = await registerUser(result.data.email, result.data.password);
  res.status(201).json(user);
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const { accessToken, refreshToken, user } = await loginUser(
    result.data.email,
    result.data.password,
  );
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ accessToken, user });
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const incomingToken = req.cookies['refreshToken'] as string | undefined;
  if (!incomingToken) {
    throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is missing');
  }
  const { accessToken, refreshToken } = await refreshTokens(incomingToken);
  setRefreshCookie(res, refreshToken);
  res.status(200).json({ accessToken });
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const token = req.cookies['refreshToken'] as string | undefined;
  if (!token) {
    res.status(204).end();
    return;
  }
  await logoutUser(token);
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  await sendOtp(result.data.email);
  res.status(200).json({ message: "If your account exists, you'll receive an OTP" });
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  await resetPassword(result.data.email, result.data.otp, result.data.newPassword);
  res.status(204).end();
}
