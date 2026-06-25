import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { loginSchema } from '@noteapp/shared';
import { prisma } from '../../lib/prisma.js';
import { signAccessToken } from '../../lib/jwt.js';
import { setRefreshCookie } from '../../lib/cookie.js';
import { AppError } from '../../middleware/errorHandler.js';

// Pre-computed hash used to normalize timing when email is not found,
// preventing user enumeration via response time difference.
const DUMMY_HASH = bcrypt.hashSync('__sentinel__', 12);

const REFRESH_TOKEN_BYTES = 32; // 32 bytes → 64-char hex token
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  // Always run bcrypt.compare to equalize timing across found/not-found paths
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(password, hash);

  if (!user || !passwordMatch) {
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const accessToken = signAccessToken(user.id);
  const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt },
  });

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    accessToken,
    user: { id: user.id, email: user.email },
  });
}
