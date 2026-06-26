import type { Request, Response } from 'express';
import { createNoteSchema, updateNoteSchema } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import {
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from '../services/notes.service.js';

export async function createNoteController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const result = createNoteSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const note = await createNote(userId, result.data);
  res.status(201).json(note);
}

export async function getNoteController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['id'] as string;
  const note = await getNoteById(userId, noteId);
  res.status(200).json(note);
}

export async function updateNoteController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['id'] as string;
  const result = updateNoteSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const note = await updateNote(userId, noteId, result.data);
  res.status(200).json(note);
}

export async function deleteNoteController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['id'] as string;
  await deleteNote(userId, noteId);
  res.status(204).end();
}
