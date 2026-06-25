import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { clearRefreshCookie } from '../../lib/cookie.js';

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token = req.cookies['refreshToken'] as string | undefined;
  if (!token) {
    res.status(204).send();
    return;
  }

  const existing = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!existing || existing.revokedAt !== null) {
    clearRefreshCookie(res);
    res.status(204).send();
    return;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
  clearRefreshCookie(res);
  res.status(204).send();
}
