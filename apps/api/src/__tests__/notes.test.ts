/**
 * Integration tests for /notes endpoints
 *
 * Coverage:
 *   NOTE-CREATE-S1 → FR-NOTE-1: POST /notes happy path → 201 + note shape
 *   NOTE-CREATE-S2 → FR-NOTE-1: POST /notes with owned tagId → 201, tagIds populated
 *   NOTE-CREATE-S3 → FR-NOTE-1: POST /notes with foreign tagId → 422 INVALID_TAG
 *   NOTE-READ-S1   → FR-NOTE-2: GET /notes/:id owned note → 200 + note body
 *   NOTE-READ-S2   → FR-NOTE-2: GET /notes/:id cross-user → 404 NOTE_NOT_FOUND (not 403)
 *   NOTE-READ-S3   → FR-NOTE-2: GET /notes/:id soft-deleted → 404 NOTE_NOT_FOUND
 *   NOTE-UPDATE-S1 → FR-NOTE-3: PATCH /notes/:id increments version to 2
 *   NOTE-UPDATE-S2 → FR-NOTE-3: PATCH creates NoteVersion snapshot with original values
 *   NOTE-UPDATE-S3 → FR-NOTE-3: PATCH empty body → 400 VALIDATION_FAILED
 *   NOTE-DELETE-S1 → FR-NOTE-4: DELETE /notes/:id → 204, deletedAt set, row still exists
 *   NOTE-DELETE-S2 → FR-NOTE-4: GET after DELETE → 404 NOTE_NOT_FOUND
 */

import 'dotenv/config';

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { prisma } from '../lib/prisma.js';
import notesRouter from '../routes/notes.js';
import { createAuthRouter } from '../routes/auth/index.js';
import { errorHandler } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Minimal test app — mirrors index.ts mount order
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', createAuthRouter());
app.use('/notes', notesRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `notes-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `notes-other-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let ownerId = '';
let ownerToken = '';
let otherId = '';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });

  const ownerReg = await request(app)
    .post('/auth/register')
    .send({ email: OWNER_EMAIL, password: PASSWORD });
  ownerId = (ownerReg.body as { id: string }).id;

  const ownerLogin = await request(app)
    .post('/auth/login')
    .send({ email: OWNER_EMAIL, password: PASSWORD });
  ownerToken = (ownerLogin.body as { accessToken: string }).accessToken;

  const otherReg = await request(app)
    .post('/auth/register')
    .send({ email: OTHER_EMAIL, password: PASSWORD });
  otherId = (otherReg.body as { id: string }).id;
});

beforeEach(async () => {
  await prisma.note.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  await prisma.tag.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// Unauthenticated access guard
// ---------------------------------------------------------------------------

describe('Unauthenticated access → 401 (requireAuth guard)', () => {
  it('POST /notes without token → 401 AUTH_TOKEN_INVALID', async () => {
    const res = await request(app)
      .post('/notes')
      .send({ title: 'x', body: {} });
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe('AUTH_TOKEN_INVALID');
  });
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S1: happy path
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S1: POST /notes happy path (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S1: valid body → 201 with { id, title, body, tagIds: [], version: 1, createdAt, updatedAt }', async () => {
    const res = await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Hello World', body: { type: 'doc', content: [] } });

    expect(res.status).toBe(201);
    const note = res.body as Record<string, unknown>;
    expect(typeof note['id']).toBe('string');
    expect(note['title']).toBe('Hello World');
    expect(note['tagIds']).toEqual([]);
    expect(note['version']).toBe(1);
    expect(note['createdAt']).toBeDefined();
    expect(note['updatedAt']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S2: owned tagId included
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S2: POST /notes with owned tagId (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S2: tagId owned by user → 201, tagIds contains the tag', async () => {
    const tag = await prisma.tag.create({
      data: { userId: ownerId, name: 'mytag', color: '#ff0000' },
    });

    const res = await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Tagged Note', body: { type: 'doc', content: [] }, tagIds: [tag.id] });

    expect(res.status).toBe(201);
    expect((res.body as { tagIds: string[] }).tagIds).toContain(tag.id);
  });
});

// ---------------------------------------------------------------------------
// NOTE-CREATE-S3: foreign tagId → 422
// ---------------------------------------------------------------------------

describe('NOTE-CREATE-S3: POST /notes with foreign tagId → 422 (FR-NOTE-1)', () => {
  it('NOTE-CREATE-S3: tagId owned by another user → 422 INVALID_TAG', async () => {
    const foreignTag = await prisma.tag.create({
      data: { userId: otherId, name: 'othertag', color: '#00ff00' },
    });

    const res = await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Bad Tag', body: { type: 'doc', content: [] }, tagIds: [foreignTag.id] });

    expect(res.status).toBe(422);
    expect((res.body as { code: string }).code).toBe('INVALID_TAG');
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S1: happy path
// ---------------------------------------------------------------------------

describe('NOTE-READ-S1: GET /notes/:id owned note (FR-NOTE-2)', () => {
  it('NOTE-READ-S1: returns 200 with note body', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'My Note', body: { type: 'doc', content: [] } },
    });

    const res = await request(app)
      .get(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    expect((res.body as { id: string }).id).toBe(note.id);
    expect((res.body as { title: string }).title).toBe('My Note');
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S2: cross-user → 404 (not 403)
// ---------------------------------------------------------------------------

describe('NOTE-READ-S2: GET /notes/:id cross-user → 404 (FR-NOTE-2)', () => {
  it('NOTE-READ-S2: note owned by another user returns 404 NOTE_NOT_FOUND', async () => {
    const note = await prisma.note.create({
      data: { userId: otherId, title: 'Other Note', body: { type: 'doc', content: [] } },
    });

    const res = await request(app)
      .get(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// NOTE-READ-S3: soft-deleted → 404
// ---------------------------------------------------------------------------

describe('NOTE-READ-S3: GET /notes/:id soft-deleted → 404 (FR-NOTE-2)', () => {
  it('NOTE-READ-S3: soft-deleted note returns 404 NOTE_NOT_FOUND', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'Deleted Note', body: { type: 'doc', content: [] } },
    });
    await prisma.note.update({ where: { id: note.id }, data: { deletedAt: new Date() } });

    const res = await request(app)
      .get(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S1: version increments to 2
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S1: PATCH /notes/:id increments version (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S1: PATCH with title → 200, version is 2', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'Original', body: { type: 'doc', content: [] } },
    });

    const res = await request(app)
      .patch(`/notes/${note.id}`)
      .set(bearer(ownerToken))
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect((res.body as { version: number }).version).toBe(2);
    expect((res.body as { title: string }).title).toBe('Updated');
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S2: snapshot created with original values
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S2: PATCH creates NoteVersion snapshot (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S2: snapshot row has version=1 and original title', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'Snapshot Me', body: { type: 'doc', content: [] } },
    });

    await request(app)
      .patch(`/notes/${note.id}`)
      .set(bearer(ownerToken))
      .send({ title: 'New Title' });

    const snapshot = await prisma.noteVersion.findFirst({ where: { noteId: note.id } });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.version).toBe(1);
    expect(snapshot!.title).toBe('Snapshot Me');
  });
});

// ---------------------------------------------------------------------------
// NOTE-UPDATE-S3: empty body → 400 VALIDATION_FAILED
// ---------------------------------------------------------------------------

describe('NOTE-UPDATE-S3: PATCH empty body → 400 (FR-NOTE-3)', () => {
  it('NOTE-UPDATE-S3: empty body fails updateNoteSchema refine → 400 VALIDATION_FAILED', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'Some Note', body: { type: 'doc', content: [] } },
    });

    const res = await request(app)
      .patch(`/notes/${note.id}`)
      .set(bearer(ownerToken))
      .send({});

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// NOTE-DELETE-S1: soft delete — row persists with deletedAt set
// ---------------------------------------------------------------------------

describe('NOTE-DELETE-S1: DELETE /notes/:id → 204 + deletedAt set (FR-NOTE-4)', () => {
  it('NOTE-DELETE-S1: returns 204; DB row still exists with deletedAt not null', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'To Delete', body: { type: 'doc', content: [] } },
    });

    const res = await request(app)
      .delete(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(204);

    const dbNote = await prisma.note.findUnique({ where: { id: note.id } });
    expect(dbNote).not.toBeNull();
    expect(dbNote!.deletedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NOTE-DELETE-S2: GET after DELETE → 404
// ---------------------------------------------------------------------------

describe('NOTE-DELETE-S2: GET after DELETE → 404 (FR-NOTE-4)', () => {
  it('NOTE-DELETE-S2: GET after soft-delete returns 404 NOTE_NOT_FOUND', async () => {
    const note = await prisma.note.create({
      data: { userId: ownerId, title: 'Delete Then Get', body: { type: 'doc', content: [] } },
    });

    await request(app)
      .delete(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    const res = await request(app)
      .get(`/notes/${note.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND');
  });
});
