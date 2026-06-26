import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createShareController,
  revokeShareController,
  listSharesController,
} from '../controllers/shares.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.post('/:noteId/shares', (req, res, next) => {
  createShareController(req, res).catch(next);
});

router.get('/:noteId/shares', (req, res, next) => {
  listSharesController(req, res).catch(next);
});

router.delete('/:noteId/shares/:token', (req, res, next) => {
  revokeShareController(req, res).catch(next);
});

export default router;
