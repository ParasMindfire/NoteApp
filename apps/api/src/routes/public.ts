import { Router } from 'express';
import { createPublicShareLimiter } from '../middleware/rateLimiters.js';
import { viewPublicShareController } from '../controllers/shares.controller.js';

const router = Router();

const publicShareLimiter = createPublicShareLimiter();

router.get('/shares/:token', publicShareLimiter, (req, res, next) => {
  viewPublicShareController(req, res).catch(next);
});

export default router;
