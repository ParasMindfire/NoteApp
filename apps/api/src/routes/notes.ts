import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createNoteController,
  getNoteController,
  updateNoteController,
  deleteNoteController,
  listNotesController,
} from '../controllers/notes.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', (req, res, next) => {
  createNoteController(req, res).catch(next);
});

router.get('/', (req, res, next) => {
  listNotesController(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  getNoteController(req, res).catch(next);
});

router.patch('/:id', (req, res, next) => {
  updateNoteController(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  deleteNoteController(req, res).catch(next);
});

export default router;
