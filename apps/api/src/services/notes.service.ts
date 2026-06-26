import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { CreateNoteInput, UpdateNoteInput } from '@noteapp/shared';

export interface NoteResponse {
  id: string;
  title: string;
  body: Prisma.JsonValue;
  tagIds: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

type NoteWithTags = {
  id: string;
  title: string;
  body: Prisma.JsonValue;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  tags: { tagId: string }[];
};

function toNoteResponse(note: NoteWithTags): NoteResponse {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    tagIds: note.tags.map((t) => t.tagId),
    version: note.version,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function assertNoteOwner(userId: string, noteId: string): Promise<NoteWithTags> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId, deletedAt: null },
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
  if (!note) throw new AppError(404, 'NOTE_NOT_FOUND', 'Note not found');
  return note;
}

export async function createNote(
  userId: string,
  data: CreateNoteInput,
): Promise<NoteResponse> {
  const tagIds = data.tagIds ?? [];

  if (tagIds.length > 0) {
    const ownedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, userId, deletedAt: null },
      select: { id: true },
    });
    if (ownedTags.length !== tagIds.length) {
      throw new AppError(422, 'INVALID_TAG', 'One or more tag IDs do not belong to the current user');
    }
  }

  const note = await prisma.note.create({
    data: {
      userId,
      title: data.title,
      body: data.body as Prisma.InputJsonValue,
      tags: tagIds.length > 0
        ? { create: tagIds.map((tagId) => ({ tagId })) }
        : undefined,
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

  return toNoteResponse(note);
}

export async function getNoteById(
  userId: string,
  noteId: string,
): Promise<NoteResponse> {
  const note = await assertNoteOwner(userId, noteId);
  return toNoteResponse(note);
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: UpdateNoteInput,
): Promise<NoteResponse> {
  const existing = await assertNoteOwner(userId, noteId);

  if (data.tagIds !== undefined && data.tagIds.length > 0) {
    const ownedTags = await prisma.tag.findMany({
      where: { id: { in: data.tagIds }, userId, deletedAt: null },
      select: { id: true },
    });
    if (ownedTags.length !== data.tagIds.length) {
      throw new AppError(422, 'INVALID_TAG', 'One or more tag IDs do not belong to the current user');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.noteVersion.create({
      data: {
        noteId: existing.id,
        version: existing.version,
        title: existing.title,
        body: existing.body as Prisma.InputJsonValue,
      },
    });

    return tx.note.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.body !== undefined && { body: data.body as Prisma.InputJsonValue }),
        version: { increment: 1 },
        ...(data.tagIds !== undefined && {
          tags: {
            deleteMany: {},
            create: data.tagIds.map((tagId) => ({ tagId })),
          },
        }),
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
  });

  return toNoteResponse(updated);
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await assertNoteOwner(userId, noteId);
  await prisma.note.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });
}
