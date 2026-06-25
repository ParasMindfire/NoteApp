import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { AppError } from './errorHandler.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Access token is missing or invalid');
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    res.locals['userId'] = payload.sub;
    next();
  } catch {
    throw new AppError(401, 'AUTH_TOKEN_INVALID', 'Access token is missing or invalid');
  }
}
