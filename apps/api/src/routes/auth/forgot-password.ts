import type { Request, Response } from 'express';
import { forgotPasswordSchema } from '@noteapp/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

const OTP_TTL_MS = 10 * 60 * 1000;

export async function forgotPasswordHandler(req: Request, res: Response): Promise<void> {
  const result = forgotPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const { email } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.passwordResetOtp.updateMany({
      where: { userId: user.id, invalidatedAt: null },
      data: { invalidatedAt: new Date() },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.passwordResetOtp.create({
      data: { userId: user.id, otp, expiresAt, attemptsLeft: 5 },
    });

    console.log('[OTP]', otp);
  }

  res.status(200).json({ message: "If your account exists, you'll receive an OTP" });
}
