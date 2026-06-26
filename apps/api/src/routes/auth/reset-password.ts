import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { resetPasswordSchema } from '@noteapp/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;

export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const { email, otp, newPassword } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');

  const now = new Date();
  const activeOtp = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      invalidatedAt: null,
      expiresAt: { gt: now },
      attemptsLeft: { gt: 0 },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeOtp) throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');

  if (activeOtp.otp !== otp) {
    const newAttemptsLeft = activeOtp.attemptsLeft - 1;
    await prisma.passwordResetOtp.update({
      where: { id: activeOtp.id },
      data: {
        attemptsLeft: newAttemptsLeft,
        invalidatedAt: newAttemptsLeft === 0 ? now : null,
      },
    });
    throw new AppError(401, 'AUTH_OTP_INVALID', 'Invalid or expired OTP');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.passwordResetOtp.update({
      where: { id: activeOtp.id },
      data: { invalidatedAt: now },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);

  res.status(204).end();
}
