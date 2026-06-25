import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { registerSchema } from '@noteapp/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';

const BCRYPT_ROUNDS = 12;

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const { email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'USER_EXISTS', 'An account with this email already exists');

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
      throw new AppError(409, 'USER_EXISTS', 'An account with this email already exists');
    }
    throw err;
  }
}
