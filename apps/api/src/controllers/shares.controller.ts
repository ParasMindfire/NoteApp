import type { Request, Response } from 'express';
import { createShareSchema } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import {
  createShare,
  revokeShare,
  listShares,
  viewPublicShare,
} from '../services/shares.service.js';

export async function createShareController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;

  const result = createShareSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const share = await createShare(userId, noteId, result.data);
  res.status(201).json(share);
}

export async function revokeShareController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;
  const token = req.params['token'] as string;

  await revokeShare(userId, noteId, token);
  res.status(204).end();
}

export async function listSharesController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;

  const shares = await listShares(userId, noteId);
  res.status(200).json(shares);
}

export async function viewPublicShareController(req: Request, res: Response): Promise<void> {
  const token = req.params['token'] as string;

  const result = await viewPublicShare(token);
  res.status(200).json(result);
}
