import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { searchController } from '../controllers/search.controller.js';

const router = Router();

router.get('/', requireAuth, (req, res, next) => searchController(req, res).catch(next));

export default router;
