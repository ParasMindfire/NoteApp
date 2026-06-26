import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listVersionsController,
  getVersionController,
  restoreVersionController,
} from '../controllers/versions.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/:noteId/versions', (req, res, next) => {
  listVersionsController(req, res).catch(next);
});

router.get('/:noteId/versions/:versionId', (req, res, next) => {
  getVersionController(req, res).catch(next);
});

router.post('/:noteId/versions/:versionId/restore', (req, res, next) => {
  restoreVersionController(req, res).catch(next);
});

export default router;
