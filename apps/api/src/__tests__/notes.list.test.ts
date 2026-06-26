/**
 * Integration tests for GET /notes list endpoint
 *
 * Coverage:
 *   NOTE-LIST-S1      → FR-NOTE-5: first page returns 20 of 25 items + non-null nextCursor
 *   NOTE-LIST-S2      → FR-NOTE-5: second page via cursor returns remaining 5 + null nextCursor
 *   NOTE-LIST-S3      → FR-NOTE-5: limit > 50 → 400 VALIDATION_FAILED
 *   NOTE-LIST-S4      → FR-NOTE-5: invalid cursor → 400 VALIDATION_FAILED
 *   NOTE-LIST-S5      → FR-NOTE-5: soft-deleted note excluded from list
 *   NOTE-LIST-SORT-S1 → FR-NOTE-6: sort=createdAt:desc → newest first (C, B, A)
 *   NOTE-LIST-SORT-S2 → FR-NOTE-6: sort=createdAt:asc → oldest first (A, B, C)
 *   NOTE-LIST-SORT-S3 → FR-NOTE-6: sort=updatedAt:desc → most recently updated first (C)
 *   NOTE-LIST-SORT-S4 → FR-NOTE-6: sort=updatedAt:asc → least recently updated first (A)
 *   NOTE-LIST-SORT-S5 → FR-NOTE-6: invalid sort value → 400 VALIDATION_FAILED
 *   NOTE-LIST-TAG-S1  → FR-NOTE-7: tagIds=A → notes with tag A only (N1, N2)
 *   NOTE-LIST-TAG-S2  → FR-NOTE-7: tagIds=A,B → AND semantics, only N2
 *   NOTE-LIST-TAG-S3  → FR-NOTE-7: foreign tagId → 422 INVALID_TAG
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
// Test users (unique per test run to avoid collisions)
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `notes-list-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `notes-list-other-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let ownerId = '';
let ownerToken = '';
let otherId = '';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Clean up any leftover users from a previous failed run
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
  // Delete notes first (NoteTag cascade), then tags — keep users alive
  await prisma.note.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
  await prisma.tag.deleteMany({ where: { userId: { in: [ownerId, otherId] } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [OWNER_EMAIL, OTHER_EMAIL] } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// FR-NOTE-5 — Cursor-paginated list
// ---------------------------------------------------------------------------

describe('NOTE-LIST-S1: first page returns 20 of 25 items + non-null nextCursor (FR-NOTE-5)', () => {
  it('NOTE-LIST-S1: GET /notes with 25 notes → 200, items.length === 20, nextCursor non-null', async () => {
    // Create 25 notes via direct prisma insert
    const base = Date.now();
    for (let i = 0; i < 25; i++) {
      await prisma.note.create({
        data: {
          userId: ownerId,
          title: `Note ${i + 1}`,
          body: { type: 'doc', content: [] },
          createdAt: new Date(base - i * 1000),
          updatedAt: new Date(base - i * 1000),
        },
      });
    }

    const res = await request(app)
      .get('/notes')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; nextCursor: string | null };
    expect(body.items.length).toBe(20);
    expect(body.nextCursor).not.toBeNull();
    expect(typeof body.nextCursor).toBe('string');
  });
});

describe('NOTE-LIST-S2: second page via cursor returns remaining 5 + null nextCursor (FR-NOTE-5)', () => {
  it('NOTE-LIST-S2: GET /notes?cursor=<nextCursor> → 200, items.length === 5, nextCursor === null', async () => {
    const base = Date.now();
    for (let i = 0; i < 25; i++) {
      await prisma.note.create({
        data: {
          userId: ownerId,
          title: `Note ${i + 1}`,
          body: { type: 'doc', content: [] },
          createdAt: new Date(base - i * 1000),
          updatedAt: new Date(base - i * 1000),
        },
      });
    }

    // First page
    const firstRes = await request(app)
      .get('/notes')
      .set(bearer(ownerToken));

    expect(firstRes.status).toBe(200);
    const firstBody = firstRes.body as { items: unknown[]; nextCursor: string | null };
    const nextCursor = firstBody.nextCursor;
    expect(nextCursor).not.toBeNull();

    // Second page
    const secondRes = await request(app)
      .get(`/notes?cursor=${nextCursor!}`)
      .set(bearer(ownerToken));

    expect(secondRes.status).toBe(200);
    const secondBody = secondRes.body as { items: unknown[]; nextCursor: string | null };
    expect(secondBody.items.length).toBe(5);
    expect(secondBody.nextCursor).toBeNull();
  });
});

describe('NOTE-LIST-S3: limit > 50 → 400 VALIDATION_FAILED (FR-NOTE-5)', () => {
  it('NOTE-LIST-S3: GET /notes?limit=51 → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .get('/notes?limit=51')
      .set(bearer(ownerToken));

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

describe('NOTE-LIST-S4: invalid cursor → 400 VALIDATION_FAILED (FR-NOTE-5)', () => {
  it('NOTE-LIST-S4: GET /notes?cursor=not!!valid → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .get('/notes?cursor=not!!valid')
      .set(bearer(ownerToken));

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

describe('NOTE-LIST-S5: soft-deleted note excluded from list (FR-NOTE-5)', () => {
  it('NOTE-LIST-S5: 3 notes, 1 soft-deleted → GET /notes returns 2 items', async () => {
    const note1 = await prisma.note.create({
      data: { userId: ownerId, title: 'Active 1', body: { type: 'doc', content: [] } },
    });
    const note2 = await prisma.note.create({
      data: { userId: ownerId, title: 'Active 2', body: { type: 'doc', content: [] } },
    });
    const note3 = await prisma.note.create({
      data: { userId: ownerId, title: 'Deleted', body: { type: 'doc', content: [] } },
    });

    // Soft-delete note3
    await prisma.note.update({
      where: { id: note3.id },
      data: { deletedAt: new Date() },
    });

    const res = await request(app)
      .get('/notes')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const body = res.body as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(body.items.length).toBe(2);

    const returnedIds = body.items.map((n) => n.id);
    expect(returnedIds).toContain(note1.id);
    expect(returnedIds).toContain(note2.id);
    expect(returnedIds).not.toContain(note3.id);
  });
});

// ---------------------------------------------------------------------------
// FR-NOTE-6 — Sort
// ---------------------------------------------------------------------------

describe('NOTE-LIST-SORT-S1: sort=createdAt:desc → newest first C, B, A (FR-NOTE-6)', () => {
  it('NOTE-LIST-SORT-S1: GET /notes?sort=createdAt:desc → items[0]=C, items[1]=B, items[2]=A', async () => {
    const base = Date.now();

    const noteA = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note A',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 2000),
        updatedAt: new Date(base - 2000),
      },
    });
    const noteB = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note B',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 1000),
        updatedAt: new Date(base - 1000),
      },
    });
    const noteC = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note C',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base),
        updatedAt: new Date(base),
      },
    });

    const res = await request(app)
      .get('/notes?sort=createdAt:desc')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = (res.body as { items: Array<{ id: string }> }).items;
    expect(items[0]!.id).toBe(noteC.id);
    expect(items[1]!.id).toBe(noteB.id);
    expect(items[2]!.id).toBe(noteA.id);
  });
});

describe('NOTE-LIST-SORT-S2: sort=createdAt:asc → oldest first A, B, C (FR-NOTE-6)', () => {
  it('NOTE-LIST-SORT-S2: GET /notes?sort=createdAt:asc → items[0]=A, items[1]=B, items[2]=C', async () => {
    const base = Date.now();

    const noteA = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note A',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 2000),
        updatedAt: new Date(base - 2000),
      },
    });
    const noteB = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note B',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 1000),
        updatedAt: new Date(base - 1000),
      },
    });
    const noteC = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note C',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base),
        updatedAt: new Date(base),
      },
    });

    const res = await request(app)
      .get('/notes?sort=createdAt:asc')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = (res.body as { items: Array<{ id: string }> }).items;
    expect(items[0]!.id).toBe(noteA.id);
    expect(items[1]!.id).toBe(noteB.id);
    expect(items[2]!.id).toBe(noteC.id);
  });
});

describe('NOTE-LIST-SORT-S3: sort=updatedAt:desc → most recently updated first (FR-NOTE-6)', () => {
  it('NOTE-LIST-SORT-S3: GET /notes?sort=updatedAt:desc → items[0].id === noteC.id', async () => {
    const base = Date.now();

    // noteA: oldest updatedAt
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note A',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 2000),
        updatedAt: new Date(base - 2000),
      },
    });
    // noteB: middle updatedAt
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note B',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 1000),
        updatedAt: new Date(base - 1000),
      },
    });
    // noteC: newest updatedAt
    const noteC = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note C',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base),
        updatedAt: new Date(base),
      },
    });

    const res = await request(app)
      .get('/notes?sort=updatedAt:desc')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = (res.body as { items: Array<{ id: string }> }).items;
    expect(items[0]!.id).toBe(noteC.id);
  });
});

describe('NOTE-LIST-SORT-S4: sort=updatedAt:asc → least recently updated first (FR-NOTE-6)', () => {
  it('NOTE-LIST-SORT-S4: GET /notes?sort=updatedAt:asc → items[0].id === noteA.id', async () => {
    const base = Date.now();

    // noteA: oldest updatedAt — should be first in asc order
    const noteA = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note A',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 2000),
        updatedAt: new Date(base - 2000),
      },
    });
    // noteB: middle updatedAt
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note B',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base - 1000),
        updatedAt: new Date(base - 1000),
      },
    });
    // noteC: newest updatedAt
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'Note C',
        body: { type: 'doc', content: [] },
        createdAt: new Date(base),
        updatedAt: new Date(base),
      },
    });

    const res = await request(app)
      .get('/notes?sort=updatedAt:asc')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = (res.body as { items: Array<{ id: string }> }).items;
    expect(items[0]!.id).toBe(noteA.id);
  });
});

describe('NOTE-LIST-SORT-S5: invalid sort value → 400 VALIDATION_FAILED (FR-NOTE-6)', () => {
  it('NOTE-LIST-SORT-S5: GET /notes?sort=bogus:sideways → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .get('/notes?sort=bogus:sideways')
      .set(bearer(ownerToken));

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// FR-NOTE-7 — Filter by tags (AND semantics)
// ---------------------------------------------------------------------------

describe('NOTE-LIST-TAG-S1: tagIds=A → notes with tag A only (N1 and N2), N3 absent (FR-NOTE-7)', () => {
  it('NOTE-LIST-TAG-S1: GET /notes?tagIds=<tagA.id> → items.length === 2, contains N1 and N2, not N3', async () => {
    // Create tags owned by OWNER
    const tagA = await prisma.tag.create({
      data: { userId: ownerId, name: 'Tag A', color: '#ff0000' },
    });
    const tagB = await prisma.tag.create({
      data: { userId: ownerId, name: 'Tag B', color: '#00ff00' },
    });

    // N1: tagA only
    const n1 = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N1',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagA.id }] },
      },
    });
    // N2: tagA + tagB
    const n2 = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N2',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagA.id }, { tagId: tagB.id }] },
      },
    });
    // N3: tagB only
    const n3 = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N3',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagB.id }] },
      },
    });

    const res = await request(app)
      .get(`/notes?tagIds=${tagA.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const body = res.body as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(body.items.length).toBe(2);

    const returnedIds = body.items.map((n) => n.id);
    expect(returnedIds).toContain(n1.id);
    expect(returnedIds).toContain(n2.id);
    expect(returnedIds).not.toContain(n3.id);
  });
});

describe('NOTE-LIST-TAG-S2: tagIds=A,B → AND semantics, only N2 (FR-NOTE-7)', () => {
  it('NOTE-LIST-TAG-S2: GET /notes?tagIds=<tagA.id>,<tagB.id> → items.length === 1, items[0].id === N2.id', async () => {
    const tagA = await prisma.tag.create({
      data: { userId: ownerId, name: 'Tag A', color: '#ff0000' },
    });
    const tagB = await prisma.tag.create({
      data: { userId: ownerId, name: 'Tag B', color: '#00ff00' },
    });

    // N1: tagA only
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N1',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagA.id }] },
      },
    });
    // N2: tagA + tagB (only note with BOTH)
    const n2 = await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N2',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagA.id }, { tagId: tagB.id }] },
      },
    });
    // N3: tagB only
    await prisma.note.create({
      data: {
        userId: ownerId,
        title: 'N3',
        body: { type: 'doc', content: [] },
        tags: { create: [{ tagId: tagB.id }] },
      },
    });

    const res = await request(app)
      .get(`/notes?tagIds=${tagA.id},${tagB.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const body = res.body as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(body.items.length).toBe(1);
    expect(body.items[0]!.id).toBe(n2.id);
  });
});

describe('NOTE-LIST-TAG-S3: foreign tagId → 422 INVALID_TAG (FR-NOTE-7)', () => {
  it('NOTE-LIST-TAG-S3: GET /notes?tagIds=<foreignTag.id> → 422 INVALID_TAG', async () => {
    // Create a tag owned by OTHER (not OWNER)
    const foreignTag = await prisma.tag.create({
      data: { userId: otherId, name: 'Foreign Tag', color: '#0000ff' },
    });

    const res = await request(app)
      .get(`/notes?tagIds=${foreignTag.id}`)
      .set(bearer(ownerToken));

    expect(res.status).toBe(422);
    expect((res.body as { code: string }).code).toBe('INVALID_TAG');
  });
});
