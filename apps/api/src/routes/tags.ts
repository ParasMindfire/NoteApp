import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createTagController,
  listTagsController,
  updateTagController,
  deleteTagController,
} from '../controllers/tags.controller.js';

const router = Router();

router.post('/', requireAuth, (req, res, next) => createTagController(req, res).catch(next));
router.get('/', requireAuth, (req, res, next) => listTagsController(req, res).catch(next));
router.patch('/:id', requireAuth, (req, res, next) => updateTagController(req, res).catch(next));
router.delete('/:id', requireAuth, (req, res, next) =>
  deleteTagController(req, res).catch(next),
);

export default router;
