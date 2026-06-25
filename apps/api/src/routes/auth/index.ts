import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Store } from 'express-rate-limit';
import { registerHandler } from './register.js';
import { loginHandler } from './login.js';
import { refreshHandler } from './refresh.js';
import { logoutHandler } from './logout.js';
import { requireAuth } from '../../middleware/auth.js';

const RFC7807_RATE_LIMITED = {
  type: 'https://api.example.com/errors/RATE_LIMITED',
  title: 'Too many requests',
  status: 429,
  detail: 'Too many requests, please try again later',
  code: 'RATE_LIMITED',
};

export function createAuthRouter(opts?: { storeFactory?: () => Store }): Router {
  const router = Router();

  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: opts?.storeFactory?.(),
    handler: (_req: Request, res: Response) => {
      res.status(429).json(RFC7807_RATE_LIMITED);
    },
  });

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: opts?.storeFactory?.(),
    handler: (_req: Request, res: Response) => {
      res.status(429).json(RFC7807_RATE_LIMITED);
    },
  });

  router.post('/register', registerLimiter, (req, res, next) => {
    registerHandler(req, res).catch(next);
  });

  router.post('/login', loginLimiter, (req, res, next) => {
    loginHandler(req, res).catch(next);
  });

  router.post('/refresh', (req, res, next) => {
    refreshHandler(req, res).catch(next);
  });

  router.post('/logout', requireAuth, (req, res, next) => {
    logoutHandler(req, res).catch(next);
  });

  return router;
}

export const authRouter = createAuthRouter();
