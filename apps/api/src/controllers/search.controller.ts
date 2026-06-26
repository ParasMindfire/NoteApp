import type { Request, Response } from 'express';
import { searchQuerySchema } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import { searchNotes } from '../services/search.service.js';

export async function searchController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const result = searchQuerySchema.safeParse(req.query);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const page = await searchNotes(userId, result.data);
  res.status(200).json(page);
}
