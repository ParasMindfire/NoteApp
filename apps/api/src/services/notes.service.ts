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

export type NoteWithTags = {
  id: string;
  title: string;
  body: Prisma.JsonValue;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  tags: { tagId: string }[];
};

export function toNoteResponse(note: NoteWithTags): NoteResponse {
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

export async function assertNoteOwner(userId: string, noteId: string): Promise<NoteWithTags> {
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

// ─── Cursor helpers ─────────────────────────────────────────────────────────

interface Cursor {
  lastId: string;
  lastValue: string; // ISO 8601 UTC timestamp of the sort field
}

function encodeCursor(lastId: string, lastValue: Date): string {
  return Buffer.from(JSON.stringify({ lastId, lastValue: lastValue.toISOString() })).toString(
    'base64url',
  );
}

function decodeCursor(raw: string): Cursor {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['lastId'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['lastValue'] !== 'string'
    ) {
      throw new Error('bad shape');
    }
    return parsed as Cursor;
  } catch {
    throw new AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor');
  }
}

// ─── listNotes ───────────────────────────────────────────────────────────────

export interface ListNotesInput {
  cursor?: string;
  limit: number;
  sortField: 'createdAt' | 'updatedAt';
  sortDir: 'asc' | 'desc';
  tagIds: string[];
}

export interface PaginatedNotes {
  items: NoteResponse[];
  nextCursor: string | null;
}

export async function listNotes(userId: string, input: ListNotesInput): Promise<PaginatedNotes> {
  const { cursor, limit, sortField, sortDir, tagIds } = input;

  // 1. Tag ownership validation
  if (tagIds.length > 0) {
    const ownedTags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, userId, deletedAt: null },
      select: { id: true },
    });
    if (ownedTags.length !== tagIds.length) {
      throw new AppError(422, 'INVALID_TAG', 'One or more tag IDs do not belong to the current user');
    }
  }

  // 2. Cursor decode → keyset OR predicate
  let cursorOr: Prisma.NoteWhereInput[] | undefined;
  if (cursor) {
    const { lastId, lastValue } = decodeCursor(cursor);
    const lastDate = new Date(lastValue);
    if (sortField === 'createdAt') {
      cursorOr =
        sortDir === 'desc'
          ? [{ createdAt: { lt: lastDate } }, { createdAt: lastDate, id: { gt: lastId } }]
          : [{ createdAt: { gt: lastDate } }, { createdAt: lastDate, id: { gt: lastId } }];
    } else {
      cursorOr =
        sortDir === 'desc'
          ? [{ updatedAt: { lt: lastDate } }, { updatedAt: lastDate, id: { gt: lastId } }]
          : [{ updatedAt: { gt: lastDate } }, { updatedAt: lastDate, id: { gt: lastId } }];
    }
  }

  // 3. Build where — AND one EXISTS per tagId (AND semantics, not OR)
  const tagFilter: Prisma.NoteWhereInput[] = tagIds.map((tagId) => ({
    tags: { some: { tagId } },
  }));

  const where: Prisma.NoteWhereInput = {
    userId,
    deletedAt: null,
    ...(tagFilter.length > 0 && { AND: tagFilter }),
    ...(cursorOr !== undefined && { OR: cursorOr }),
  };

  // 4. Build orderBy — primary sort field + id tiebreaker
  const orderBy: Prisma.NoteOrderByWithRelationInput[] =
    sortField === 'createdAt'
      ? [{ createdAt: sortDir }, { id: 'asc' }]
      : [{ updatedAt: sortDir }, { id: 'asc' }];

  // 5. Fetch limit+1 to detect whether a next page exists
  const rows = await prisma.note.findMany({
    where,
    orderBy,
    take: limit + 1,
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

  // 6. Determine nextCursor from the last item of the current page
  let nextCursor: string | null = null;
  if (rows.length === limit + 1) {
    rows.pop();
    const last = rows[rows.length - 1];
    if (last) {
      nextCursor = encodeCursor(last.id, last[sortField]);
    }
  }

  return { items: rows.map(toNoteResponse), nextCursor };
}
