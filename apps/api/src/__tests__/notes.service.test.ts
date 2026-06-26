/**
 * Integration tests for notes.service.ts
 *
 * Coverage:
 *   NOTE-CREATE-S1 → FR-NOTE-1: createNote happy path, no tags
 *   NOTE-CREATE-S2 → FR-NOTE-1: createNote with valid owned tagId
 *   NOTE-CREATE-S3 → FR-NOTE-1: createNote with foreign tagId → AppError 422 INVALID_TAG
 *   NOTE-READ-S1   → FR-NOTE-2: getNoteById happy path
 *   NOTE-READ-S2   → FR-NOTE-2: getNoteById cross-user → AppError 404 NOTE_NOT_FOUND (not 403)
 *   NOTE-READ-S3   → FR-NOTE-2: getNoteById soft-deleted → AppError 404 NOTE_NOT_FOUND
 *   NOTE-UPDATE-S1 → FR-NOTE-3: updateNote increments version 1 → 2
 *   NOTE-UPDATE-S2 → FR-NOTE-3: updateNote creates NoteVersion snapshot with original data
 *   NOTE-UPDATE-S3 → FR-NOTE-3: updateNote is atomic — transaction failure rolls back both snapshot and update
 *   NOTE-DELETE-S1 → FR-NOTE-4: deleteNote sets deletedAt, no physical delete
 *   NOTE-DELETE-S2 → FR-NOTE-4: deleteNote then getNoteById → AppError 404 NOTE_NOT_FOUND
 *
 * Calls service functions directly against the real DB — no HTTP layer.
 */

import 'dotenv/config';

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import bcrypt from 'bcrypt';

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from '../services/notes.service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `notes-service-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `notes-service-other-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Secur3Pass';

const SAMPLE_BODY = { type: 'doc', content: [] };

// ---------------------------------------------------------------------------
// User IDs (populated in beforeAll)
// ---------------------------------------------------------------------------

let ownerId: string;
let otherId: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedNote(userId: string, overrides: Partial<{ title: string; deletedAt: Date | null }> = {}) {
  return prisma.note.create({
    data: {
      userId,
      title: overrides.title ?? 'Seed Note',
      body: SAMPLE_BODY,
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

async function seedTag(userId: string, name = 'test-tag') {
  return prisma.tag.create({
    data: {
      userId,
      name,
      color: '#AABBCC',
    },
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 1);

  // Create primary test user
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: { email: OWNER_EMAIL, passwordHash },
    update: {},
  });
  ownerId = owner.id;

  // Create secondary test user (for cross-user scenarios)
  const other = await prisma.user.upsert({
    where: { email: OTHER_EMAIL },
    create: { email: OTHER_EMAIL, passwordHash },
    update: {},
  });
  otherId = other.id;
});

beforeEach(async () => {
  // Clean in correct FK order: NoteTag + NoteVersion first, then Note, then Tag
  await prisma.noteTag.deleteMany({ where: { note: { userId: { in: [ownerId, otherId] } } } });
  await prisma.noteVersion.deleteMany({ where: { note: { userId: { in: [ownerId, otherId] } } } });
  await prisma.note.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  await prisma.tag.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
});

afterAll(async () => {
  // Clean up users (cascade deletes all related rows)
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S1: happy path, no tags
// FR-NOTE-1: 201 with { id, title, body, tagIds: [], createdAt, updatedAt, version: 1 }
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S1: createNote happy path, no tags (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S1: creates note and returns shape with tagIds: [] and version: 1', async () => {
    const result = await createNote(ownerId, {
      title: 'My Note',
      body: SAMPLE_BODY,
    });

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.title).toBe('My Note');
    expect(result.body).toEqual(SAMPLE_BODY);
    expect(result.tagIds).toEqual([]);
    expect(result.version).toBe(1);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S2: with valid owned tagId
// FR-NOTE-1: tagIds validation — owned tag accepted, returned in response
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S2: createNote with owned tagId (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S2: creates note with owned tag; tagIds in response contains the tag id', async () => {
    const tag = await seedTag(ownerId, 'my-tag');

    const result = await createNote(ownerId, {
      title: 'Tagged Note',
      body: SAMPLE_BODY,
      tagIds: [tag.id],
    });

    expect(result.tagIds).toContain(tag.id);
    expect(result.tagIds).toHaveLength(1);
    expect(result.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S3: foreign tagId rejected
// FR-NOTE-1: 422 INVALID_TAG — tagId not owned by user
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S3: createNote with foreign tagId → 422 INVALID_TAG (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S3: throws AppError 422 INVALID_TAG when tagId belongs to another user', async () => {
    const foreignTag = await seedTag(otherId, 'other-tag');

    await expect(
      createNote(ownerId, {
        title: 'Note With Foreign Tag',
        body: SAMPLE_BODY,
        tagIds: [foreignTag.id],
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'INVALID_TAG',
    } satisfies Partial<AppError>);
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S1: happy path
// FR-NOTE-2: returns note owned by user
// ---------------------------------------------------------------------------

describe('NOTE-READ-S1: getNoteById happy path (FR-NOTE-2)', () => {
  it('NOTE-READ-S1: returns full note when owned by the requesting user', async () => {
    const seeded = await seedNote(ownerId, { title: 'Read Me' });

    const result = await getNoteById(ownerId, seeded.id);

    expect(result.id).toBe(seeded.id);
    expect(result.title).toBe('Read Me');
    expect(result.tagIds).toEqual([]);
    expect(result.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S2: cross-user access → 404 NOTE_NOT_FOUND (not 403)
// FR-NOTE-2: never 403 — don't leak existence
// ---------------------------------------------------------------------------

describe('NOTE-READ-S2: getNoteById cross-user returns 404 NOTE_NOT_FOUND (FR-NOTE-2)', () => {
  it('NOTE-READ-S2: throws AppError 404 NOTE_NOT_FOUND when note belongs to another user', async () => {
    const otherNote = await seedNote(otherId, { title: "Other's Note" });

    await expect(
      getNoteById(ownerId, otherNote.id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTE_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S3: soft-deleted note → 404 NOTE_NOT_FOUND
// FR-NOTE-2: soft-deleted = 404
// ---------------------------------------------------------------------------

describe('NOTE-READ-S3: getNoteById soft-deleted note returns 404 NOTE_NOT_FOUND (FR-NOTE-2)', () => {
  it('NOTE-READ-S3: throws AppError 404 NOTE_NOT_FOUND when note is soft-deleted', async () => {
    const deletedNote = await seedNote(ownerId, { deletedAt: new Date() });

    await expect(
      getNoteById(ownerId, deletedNote.id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTE_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S1: version increments 1 → 2
// FR-NOTE-3: every save increments version by exactly 1
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S1: updateNote increments version (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S1: returns note with version 2 and updated title after PATCH', async () => {
    const seeded = await seedNote(ownerId, { title: 'Original Title' });
    expect(seeded.version).toBe(1);

    const result = await updateNote(ownerId, seeded.id, { title: 'Updated Title' });

    expect(result.version).toBe(2);
    expect(result.title).toBe('Updated Title');
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S2: snapshot precedes update
// FR-NOTE-3: NoteVersion row with version=1 and original title exists after update
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S2: updateNote creates NoteVersion snapshot (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S2: NoteVersion row with version=1 and original title exists after update; note has new title and version=2', async () => {
    const seeded = await seedNote(ownerId, { title: 'Original' });

    await updateNote(ownerId, seeded.id, { title: 'New Title' });

    // Check NoteVersion row
    const snapshot = await prisma.noteVersion.findFirst({
      where: { noteId: seeded.id },
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot!.version).toBe(1);
    expect(snapshot!.title).toBe('Original');

    // Check note itself
    const updatedNote = await prisma.note.findUnique({ where: { id: seeded.id } });
    expect(updatedNote!.title).toBe('New Title');
    expect(updatedNote!.version).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S3: atomicity — transaction failure rolls back snapshot and update
// FR-NOTE-3: snapshot + update MUST be one transaction
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S3: updateNote is atomic (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S3: neither snapshot nor note update persists when transaction is rejected', async () => {
    const seeded = await seedNote(ownerId, { title: 'Before Failure' });

    // Spy on prisma.$transaction and force it to reject
    const txSpy = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Error('Simulated DB transaction failure'),
    );

    await expect(
      updateNote(ownerId, seeded.id, { title: 'Should Not Be Saved' }),
    ).rejects.toThrow('Simulated DB transaction failure');

    txSpy.mockRestore();

    // Snapshot must NOT exist
    const snapshot = await prisma.noteVersion.findFirst({ where: { noteId: seeded.id } });
    expect(snapshot).toBeNull();

    // Note must still have original title and version
    const noteAfter = await prisma.note.findUnique({ where: { id: seeded.id } });
    expect(noteAfter!.title).toBe('Before Failure');
    expect(noteAfter!.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NOTE-DELETE-S1: sets deletedAt, no physical delete
// FR-NOTE-4: MUST NOT physically delete; deletedAt is set
// ---------------------------------------------------------------------------

describe('NOTE-DELETE-S1: deleteNote sets deletedAt (FR-NOTE-4)', () => {
  it('NOTE-DELETE-S1: deletedAt is not null after deleteNote; row still exists in DB', async () => {
    const seeded = await seedNote(ownerId);

    await deleteNote(ownerId, seeded.id);

    const row = await prisma.note.findUnique({ where: { id: seeded.id } });

    // Row must still exist (no physical delete)
    expect(row).not.toBeNull();
    // deletedAt must be set to a timestamp
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.deletedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// NOTE-DELETE-S2: deleted note → 404 on subsequent read
// FR-NOTE-4: deleted note absent from read endpoints
// ---------------------------------------------------------------------------

describe('NOTE-DELETE-S2: getNoteById after deleteNote returns 404 NOTE_NOT_FOUND (FR-NOTE-4)', () => {
  it('NOTE-DELETE-S2: throws AppError 404 NOTE_NOT_FOUND when reading a soft-deleted note', async () => {
    const seeded = await seedNote(ownerId);

    await deleteNote(ownerId, seeded.id);

    await expect(
      getNoteById(ownerId, seeded.id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOTE_NOT_FOUND',
    } satisfies Partial<AppError>);
  });
});

// ---------------------------------------------------------------------------
// bodyText middleware: Prisma $extends hook populates bodyText from TipTap JSON
// FR-SEARCH-1: bodyText is plain-text extraction of TipTap JSON, populated
// by a Prisma middleware on note save
// ---------------------------------------------------------------------------

describe('bodyText middleware', () => {
  it('populates bodyText from body JSON on note create', async () => {
    const richBody = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'quarterly review' }],
        },
      ],
    };

    const created = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Search Test Note',
        body: richBody,
      },
    });

    const row = await prisma.note.findFirst({
      where: { id: created.id },
      select: { bodyText: true },
    });

    expect(row).not.toBeNull();
    expect(row!.bodyText).toBe('quarterly review');
  });

  it('updates bodyText when note body is updated (FR-SEARCH-1)', async () => {
    // Create with initial body
    const created = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Update Body Test',
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'original text' }] },
          ],
        },
      },
    });

    const before = await prisma.note.findFirst({
      where: { id: created.id },
      select: { bodyText: true },
    });
    expect(before!.bodyText).toBe('original text');

    // Update with new body
    await prisma.note.update({
      where: { id: created.id },
      data: {
        body: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'updated text after edit' }] },
          ],
        },
      },
    });

    const after = await prisma.note.findFirst({
      where: { id: created.id },
      select: { bodyText: true },
    });
    expect(after!.bodyText).toBe('updated text after edit');
  });
});
