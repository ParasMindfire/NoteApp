import type { Request, Response } from 'express';
import {
  listVersions,
  getVersion,
  restoreVersion,
} from '../services/versions.service.js';

export async function listVersionsController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;

  const versions = await listVersions(userId, noteId);
  res.status(200).json(versions);
}

export async function getVersionController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;
  const versionId = req.params['versionId'] as string;

  const version = await getVersion(userId, noteId, versionId);
  res.status(200).json(version);
}

export async function restoreVersionController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const noteId = req.params['noteId'] as string;
  const versionId = req.params['versionId'] as string;

  const note = await restoreVersion(userId, noteId, versionId);
  res.status(200).json(note);
}
