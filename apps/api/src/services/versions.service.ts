import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  assertNoteOwner,
  toNoteResponse,
} from './notes.service.js';
import type { NoteResponse } from './notes.service.js';

export interface VersionListItem {
  id: string;
  version: number;
  savedAt: Date;
  title: string;
}

export interface VersionDetail extends VersionListItem {
  body: Prisma.JsonValue;
}

export async function listVersions(userId: string, noteId: string): Promise<VersionListItem[]> {
  const note = await assertNoteOwner(userId, noteId);
  return prisma.noteVersion.findMany({
    where: { noteId: note.id },
    select: { id: true, version: true, savedAt: true, title: true },
    orderBy: { version: 'desc' },
  });
}

export async function getVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<VersionDetail> {
  const note = await assertNoteOwner(userId, noteId);
  const ver = await prisma.noteVersion.findFirst({
    where: { id: versionId, noteId: note.id },
    select: { id: true, version: true, savedAt: true, title: true, body: true },
  });
  if (!ver) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');
  return ver;
}

export async function restoreVersion(
  userId: string,
  noteId: string,
  versionId: string,
): Promise<NoteResponse> {
  const note = await assertNoteOwner(userId, noteId);

  const ver = await prisma.noteVersion.findFirst({
    where: { id: versionId, noteId: note.id },
    select: { title: true, body: true },
  });
  if (!ver) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found');

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Pre-restore snapshot — records the state being left behind
    await tx.noteVersion.create({
      data: {
        noteId: note.id,
        version: note.version,
        title: note.title,
        body: note.body as Prisma.InputJsonValue,
      },
    });

    // 2. Apply restored content, increment version
    const updatedNote = await tx.note.update({
      where: { id: note.id },
      data: {
        title: ver.title,
        body: ver.body as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
      select: {
        id: true,
        title: true,
        body: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        tags: { select: { tagId: true } },
      },
    });

    // 3. Post-restore record — marks the restoration event in history
    await tx.noteVersion.create({
      data: {
        noteId: note.id,
        version: updatedNote.version,
        title: updatedNote.title,
        body: updatedNote.body as Prisma.InputJsonValue,
      },
    });

    return updatedNote;
  });

  return toNoteResponse(updated);
}
