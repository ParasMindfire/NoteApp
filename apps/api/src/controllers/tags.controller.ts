import type { Request, Response } from 'express';
import { createTagSchema, updateTagSchema } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import { createTag, listTags, updateTag, deleteTag } from '../services/tags.service.js';

export async function createTagController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const result = createTagSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const tag = await createTag(userId, result.data);
  res.status(201).json(tag);
}

export async function listTagsController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const tags = await listTags(userId);
  res.status(200).json(tags);
}

export async function updateTagController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const tagId = req.params['id'] as string;
  const result = updateTagSchema.safeParse(req.body);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const tag = await updateTag(userId, tagId, result.data);
  res.status(200).json(tag);
}

export async function deleteTagController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const tagId = req.params['id'] as string;
  await deleteTag(userId, tagId);
  res.status(204).end();
}
