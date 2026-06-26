/**
 * Integration tests for Tags CRUD endpoints
 *
 * Coverage:
 *   TAG-S1            → FR-TAG-2: create tag happy path → 201 with { id, name, color, createdAt }
 *   TAG-S2            → FR-TAG-2: duplicate name within user → 409 TAG_NAME_DUPLICATE
 *   TAG-S3            → FR-TAG-2: same name across different users → 201
 *   TAG-S4            → FR-TAG-1: PATCH another user's tag → 404 TAG_NOT_FOUND
 *   TAG-S5            → FR-TAG-2: delete own tag → 204; absent from subsequent GET /tags
 *   TAG-VALIDATION-S1 → FR-TAG-2: invalid color format → 400 VALIDATION_FAILED
 *   TAG-VALIDATION-S2 → FR-TAG-2: name exceeds 50 chars → 400 VALIDATION_FAILED
 *   TAG-LIST-S1       → FR-TAG-3: noteCount reflects non-deleted note associations
 *   TAG-LIST-S2       → FR-TAG-3: noteCount excludes soft-deleted notes
 */

import 'dotenv/config';

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { prisma } from '../lib/prisma.js';
import tagsRouter from '../routes/tags.js';
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
app.use('/tags', tagsRouter);
app.use('/notes', notesRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test users (unique per test run to avoid collisions)
// ---------------------------------------------------------------------------

const OWNER_EMAIL = `tags-owner-${Date.now()}@example.com`;
const OTHER_EMAIL = `tags-other-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let ownerId = '';
let ownerToken = '';
let otherId = '';
let otherToken = '';

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

  const otherLogin = await request(app)
    .post('/auth/login')
    .send({ email: OTHER_EMAIL, password: PASSWORD });
  otherToken = (otherLogin.body as { accessToken: string }).accessToken;
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
// FR-TAG-2 — Create / Uniqueness
// ---------------------------------------------------------------------------

describe('TAG-S1: create tag happy path (FR-TAG-2)', () => {
  it('TAG-S1: POST /tags with valid body → 201 with { id, name, color, createdAt }', async () => {
    const res = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Work', color: '#FF5733' });

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string; color: string; createdAt: string };
    expect(body.id).toBeTruthy();
    expect(body.name).toBe('Work');
    expect(body.color).toBe('#FF5733');
    expect(body.createdAt).toBeTruthy();
  });
});

describe('TAG-S2: duplicate name within user → 409 (FR-TAG-2)', () => {
  it('TAG-S2: POST /tags with existing name → 409 TAG_NAME_DUPLICATE', async () => {
    // Create the tag first
    await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Work', color: '#FF5733' });

    // Attempt duplicate
    const res = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Work', color: '#000000' });

    expect(res.status).toBe(409);
    expect((res.body as { code: string }).code).toBe('TAG_NAME_DUPLICATE');
  });
});

describe('TAG-S3: same name across different users → 201 (FR-TAG-2)', () => {
  it('TAG-S3: owner creates Work, other creates Work → 201 for other user', async () => {
    // Owner creates tag named 'Work'
    await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Work', color: '#FF5733' });

    // Other user creates tag with same name — should succeed
    const res = await request(app)
      .post('/tags')
      .set(bearer(otherToken))
      .send({ name: 'Work', color: '#AABBCC' });

    expect(res.status).toBe(201);
    const body = res.body as { id: string; name: string; color: string; createdAt: string };
    expect(body.name).toBe('Work');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-1 — Cross-user scoping
// ---------------------------------------------------------------------------

describe('TAG-S4: PATCH another user\'s tag → 404 (FR-TAG-1)', () => {
  it('TAG-S4: other user PATCH /tags/:ownerTagId → 404 TAG_NOT_FOUND', async () => {
    // Owner creates a tag
    const createRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Private Tag', color: '#123456' });

    const tagId = (createRes.body as { id: string }).id;

    // Other user tries to PATCH owner's tag
    const res = await request(app)
      .patch(`/tags/${tagId}`)
      .set(bearer(otherToken))
      .send({ name: 'Renamed' });

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('TAG_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Delete
// ---------------------------------------------------------------------------

describe('TAG-S5: delete own tag → 204; absent from subsequent list (FR-TAG-2)', () => {
  it('TAG-S5: DELETE /tags/:id → 204; GET /tags does not contain deleted tag', async () => {
    // Create a tag
    const createRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'ToDelete', color: '#ABCDEF' });

    expect(createRes.status).toBe(201);
    const tagId = (createRes.body as { id: string }).id;

    // Delete it
    const deleteRes = await request(app)
      .delete(`/tags/${tagId}`)
      .set(bearer(ownerToken));

    expect(deleteRes.status).toBe(204);

    // Verify it's gone from the list
    const listRes = await request(app)
      .get('/tags')
      .set(bearer(ownerToken));

    expect(listRes.status).toBe(200);
    const items = listRes.body as Array<{ id: string }>;
    const ids = items.map((t) => t.id);
    expect(ids).not.toContain(tagId);
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Input Validation
// ---------------------------------------------------------------------------

describe('TAG-VALIDATION-S1: invalid color format → 400 (FR-TAG-2)', () => {
  it('TAG-VALIDATION-S1: POST /tags with color "red" → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'X', color: 'red' });

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

describe('TAG-VALIDATION-S2: name exceeds 50 chars → 400 (FR-TAG-2)', () => {
  it('TAG-VALIDATION-S2: POST /tags with 51-char name → 400 VALIDATION_FAILED', async () => {
    const longName = 'A'.repeat(51);

    const res = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: longName, color: '#FF5733' });

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-3 — List with noteCount
// ---------------------------------------------------------------------------

describe('TAG-LIST-S1: noteCount reflects non-deleted note associations (FR-TAG-3)', () => {
  it('TAG-LIST-S1: tagA has 3 notes, tagB has 1 note → GET /tags returns correct noteCounts', async () => {
    // Create tag A and tag B
    const tagARes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Tag A', color: '#FF0000' });
    const tagAId = (tagARes.body as { id: string }).id;

    const tagBRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Tag B', color: '#00FF00' });
    const tagBId = (tagBRes.body as { id: string }).id;

    // Create 3 notes associated with tag A
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 1', body: { type: 'doc', content: [] }, tagIds: [tagAId] });
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 2', body: { type: 'doc', content: [] }, tagIds: [tagAId] });
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 3', body: { type: 'doc', content: [] }, tagIds: [tagAId] });

    // Create 1 note associated with tag B
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 4', body: { type: 'doc', content: [] }, tagIds: [tagBId] });

    // N+1 check: verified by code review — single _count query in tags.service.ts
    const res = await request(app)
      .get('/tags')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = res.body as Array<{ id: string; name: string; color: string; noteCount: number }>;

    const tagA = items.find((t) => t.id === tagAId);
    const tagB = items.find((t) => t.id === tagBId);

    expect(tagA).toBeDefined();
    expect(tagA!.noteCount).toBe(3);
    expect(tagB).toBeDefined();
    expect(tagB!.noteCount).toBe(1);
  });
});

describe('TAG-LIST-S2: noteCount excludes soft-deleted notes (FR-TAG-3)', () => {
  it('TAG-LIST-S2: tagA with 3 notes, 1 soft-deleted → GET /tags returns tagA noteCount: 2', async () => {
    // Create tag A
    const tagARes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Tag A', color: '#FF0000' });
    const tagAId = (tagARes.body as { id: string }).id;

    // Create 3 notes associated with tag A
    const note1Res = await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 1', body: { type: 'doc', content: [] }, tagIds: [tagAId] });
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 2', body: { type: 'doc', content: [] }, tagIds: [tagAId] });
    await request(app)
      .post('/notes')
      .set(bearer(ownerToken))
      .send({ title: 'Note 3', body: { type: 'doc', content: [] }, tagIds: [tagAId] });

    const note1Id = (note1Res.body as { id: string }).id;

    // Soft-delete note 1 via DELETE /notes/:id
    const deleteRes = await request(app)
      .delete(`/notes/${note1Id}`)
      .set(bearer(ownerToken));

    expect(deleteRes.status).toBe(204);

    // GET /tags → tagA should have noteCount: 2
    const res = await request(app)
      .get('/tags')
      .set(bearer(ownerToken));

    expect(res.status).toBe(200);
    const items = res.body as Array<{ id: string; noteCount: number }>;

    const tagA = items.find((t) => t.id === tagAId);
    expect(tagA).toBeDefined();
    expect(tagA!.noteCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-AUTH — Auth guard
// ---------------------------------------------------------------------------

describe('TAG-AUTH-S1: POST /tags with no auth header → 401 (FR-TAG-AUTH)', () => {
  it('TAG-AUTH-S1: POST /tags with no auth header → 401 AUTH_TOKEN_INVALID', async () => {
    const res = await request(app)
      .post('/tags')
      .send({ name: 'NoAuth', color: '#123456' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Update no-op
// ---------------------------------------------------------------------------

describe('TAG-UPDATE-NOOP-S1: PATCH /tags/:id with empty body → 200 unchanged (FR-TAG-2)', () => {
  it('TAG-UPDATE-NOOP-S1: PATCH /tags/:id with empty body → 200, unchanged tag', async () => {
    // create a tag first
    const createRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'NoopTag', color: '#AABBCC' });
    expect(createRes.status).toBe(201);
    const tagId = createRes.body.id as string;

    // PATCH with empty body — spec decision 5: no-op, returns unchanged tag
    const patchRes = await request(app)
      .patch(`/tags/${tagId}`)
      .set(bearer(ownerToken))
      .send({});
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.id).toBe(tagId);
    expect(patchRes.body.name).toBe('NoopTag');
    expect(patchRes.body.color).toBe('#AABBCC');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Update happy path
// ---------------------------------------------------------------------------

describe('TAG-UPDATE-S1: PATCH /tags/:id with name update → 200 with updated name (FR-TAG-2)', () => {
  it('TAG-UPDATE-S1: PATCH /tags/:id with name update → 200 with updated name', async () => {
    const createRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Original', color: '#112233' });
    expect(createRes.status).toBe(201);
    const tagId = createRes.body.id as string;

    const patchRes = await request(app)
      .patch(`/tags/${tagId}`)
      .set(bearer(ownerToken))
      .send({ name: 'Renamed' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.id).toBe(tagId);
    expect(patchRes.body.name).toBe('Renamed');
    expect(patchRes.body.color).toBe('#112233');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Update duplicate name
// ---------------------------------------------------------------------------

describe('TAG-UPDATE-DUPLICATE-S1: PATCH /tags/:id rename to existing name → 409 TAG_NAME_DUPLICATE (FR-TAG-2)', () => {
  it('TAG-UPDATE-DUPLICATE-S1: PATCH /tags/:id rename to existing name → 409 TAG_NAME_DUPLICATE', async () => {
    const firstRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'First', color: '#AAAAAA' });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'Second', color: '#BBBBBB' });
    expect(secondRes.status).toBe(201);
    const secondId = secondRes.body.id as string;

    const patchRes = await request(app)
      .patch(`/tags/${secondId}`)
      .set(bearer(ownerToken))
      .send({ name: 'First' });
    expect(patchRes.status).toBe(409);
    expect(patchRes.body.code).toBe('TAG_NAME_DUPLICATE');
  });
});

// ---------------------------------------------------------------------------
// FR-TAG-2 — Update validation
// ---------------------------------------------------------------------------

describe('TAG-PATCH-VALIDATION-S1: PATCH /tags/:id with invalid color → 400 VALIDATION_FAILED (FR-TAG-2)', () => {
  it('TAG-PATCH-VALIDATION-S1: PATCH /tags/:id with invalid color → 400 VALIDATION_FAILED', async () => {
    const createRes = await request(app)
      .post('/tags')
      .set(bearer(ownerToken))
      .send({ name: 'PatchValidation', color: '#123456' });
    expect(createRes.status).toBe(201);
    const tagId = createRes.body.id as string;

    const patchRes = await request(app)
      .patch(`/tags/${tagId}`)
      .set(bearer(ownerToken))
      .send({ color: 'bad' });
    expect(patchRes.status).toBe(400);
    expect(patchRes.body.code).toBe('VALIDATION_FAILED');
  });
});
