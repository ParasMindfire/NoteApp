import { Router } from 'express';
import type { Store } from 'express-rate-limit';
import {
  registerController,
  loginController,
  refreshController,
  logoutController,
  forgotPasswordController,
  resetPasswordController,
} from '../../controllers/auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createRegisterLimiter,
  createLoginLimiter,
  createForgotPasswordLimiter,
} from '../../middleware/rateLimiters.js';

export function createAuthRouter(opts?: { storeFactory?: () => Store }): Router {
  const router = Router();

  const registerLimiter = createRegisterLimiter(opts?.storeFactory);
  const loginLimiter = createLoginLimiter(opts?.storeFactory);
  const forgotPasswordLimiter = createForgotPasswordLimiter(opts?.storeFactory);

  router.post('/register', registerLimiter, (req, res, next) => {
    registerController(req, res).catch(next);
  });

  router.post('/login', loginLimiter, (req, res, next) => {
    loginController(req, res).catch(next);
  });

  router.post('/refresh', (req, res, next) => {
    refreshController(req, res).catch(next);
  });

  router.post('/logout', requireAuth, (req, res, next) => {
    logoutController(req, res).catch(next);
  });

  router.post('/forgot-password', forgotPasswordLimiter, (req, res, next) => {
    forgotPasswordController(req, res).catch(next);
  });

  router.post('/reset-password', (req, res, next) => {
    resetPasswordController(req, res).catch(next);
  });

  return router;
}

export const authRouter = createAuthRouter();
