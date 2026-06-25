import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { signAccessToken } from '../../lib/jwt.js';
import { setRefreshCookie } from '../../lib/cookie.js';
import { AppError } from '../../middleware/errorHandler.js';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const incomingToken = req.cookies['refreshToken'] as string | undefined;
  if (!incomingToken) {
    throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is missing');
  }

  const existing = await prisma.refreshToken.findUnique({
    where: { token: incomingToken },
  });

  if (!existing || existing.revokedAt !== null || existing.expiresAt < new Date()) {
    throw new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is expired or has been revoked');
  }

  const newToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { userId: existing.userId, token: newToken, expiresAt },
    }),
  ]);

  const accessToken = signAccessToken(existing.userId);
  setRefreshCookie(res, newToken);
  res.status(200).json({ accessToken });
}
