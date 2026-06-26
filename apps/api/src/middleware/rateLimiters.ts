import type { Request, Response } from 'express';
import rateLimit, { type Store } from 'express-rate-limit';

const RFC7807_RATE_LIMITED = {
  type: 'https://api.example.com/errors/RATE_LIMITED',
  title: 'Too many requests',
  status: 429,
  detail: 'Too many requests, please try again later',
  code: 'RATE_LIMITED',
};

function rateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json(RFC7807_RATE_LIMITED);
}

export function createRegisterLimiter(storeFactory?: () => Store) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: storeFactory?.(),
    handler: rateLimitHandler,
  });
}

export function createLoginLimiter(storeFactory?: () => Store) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: storeFactory?.(),
    handler: rateLimitHandler,
  });
}

function forgotPasswordKeyGenerator(req: Request): string {
  return (req.body?.email as string | undefined) ?? req.ip ?? 'unknown';
}

export function createForgotPasswordLimiter(storeFactory?: () => Store) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    keyGenerator: forgotPasswordKeyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: storeFactory?.(),
    handler: rateLimitHandler,
  });
}
