/**
 * Integration tests for Note Version History endpoints
 *
 * Coverage:
 *   VER-SAVE-S1   → FR-VER-1: Create + update twice → note.version=3; list returns 2 records
 *   VER-SAVE-S2   → FR-VER-1: Create + update 3 times → list returns array length 3
 *   VER-LIST-S1   → FR-VER-2: List returns newest version first; no `body` field in items
 *   VER-LIST-S2   → FR-VER-2: List for unowned note returns 404 NOTE_NOT_FOUND
 *   VER-VIEW-S1   → FR-VER-3: View version includes body; matches original content
 *   VER-VIEW-S2   → FR-VER-3: View with nonexistent versionId returns 404 VERSION_NOT_FOUND
 *   VER-RESTORE-S1 → FR-VER-4: Restore increments total version count by 2; response has correct shape
 *   VER-RESTORE-S2 → FR-VER-4: Restore with nonexistent versionId returns 404 VERSION_NOT_FOUND
 *   VER-AUTH-S1   → FR-VER-2: Unauthenticated request returns 401 AUTH_TOKEN_INVALID
 */

import 'dotenv/config';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { prisma } from '../lib/prisma.js';
import { createAuthRouter } from '../routes/auth/index.js';
import notesRouter from '../routes/notes.js';
import versionsRouter from '../routes/versions.js';
import { errorHandler } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Minimal test app — mirrors index.ts mount order (no cron/purge)
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', createAuthRouter());
app.use('/notes', notesRouter);
app.use('/notes', versionsRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test users (unique per test run to avoid collisions)
// ---------------------------------------------------------------------------

const USER_EMAIL = `ver-user-${Date.now()}@example.com`;
const USER_B_EMAIL = `ver-user-b-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let accessToken = '';
let userBAccessToken = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Minimal TipTap JSON body factory */
const tipTapBody = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
});

/** Create a note as the primary user and return its id */
async function createNote(title: string, body: object): Promise<string> {
  const res = await request(app)
    .post('/notes')
    .set(bearer(accessToken))
    .send({ title, body });
  expect(res.status).toBe(201);
  return (res.body as { id: string }).id;
}

/** Update a note as the primary user */
async function updateNote(id: string, title: string, body: object): Promise<void> {
  const res = await request(app)
    .patch(`/notes/${id}`)
    .set(bearer(accessToken))
    .send({ title, body });
  expect(res.status).toBe(200);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Clean up any leftover users from previous failed runs
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
  await prisma.user.deleteMany({ where: { email: USER_B_EMAIL } });

  // Register and login primary user
  await request(app)
    .post('/auth/register')
    .send({ email: USER_EMAIL, password: PASSWORD });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: USER_EMAIL, password: PASSWORD });
  accessToken = (loginRes.body as { accessToken: string }).accessToken;

  // Register and login user B (for VER-LIST-S2)
  await request(app)
    .post('/auth/register')
    .send({ email: USER_B_EMAIL, password: PASSWORD });

  const loginResB = await request(app)
    .post('/auth/login')
    .send({ email: USER_B_EMAIL, password: PASSWORD });
  userBAccessToken = (loginResB.body as { accessToken: string }).accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
  await prisma.user.deleteMany({ where: { email: USER_B_EMAIL } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// VER-SAVE-S1 — Each update increments version count
// ---------------------------------------------------------------------------

describe('VER-SAVE-S1: Create + update twice → note.version=3; list returns 2 version records (FR-VER-1)', () => {
  it('VER-SAVE-S1: note.version=3 after 2 updates; GET /versions returns exactly 2 records', async () => {
    const noteId = await createNote('Initial Title S1', tipTapBody('initial body'));

    // First update
    const patch1 = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(accessToken))
      .send({ title: 'Updated Title S1 v2', body: tipTapBody('body v2') });
    expect(patch1.status).toBe(200);

    // Second update
    const patch2 = await request(app)
      .patch(`/notes/${noteId}`)
      .set(bearer(accessToken))
      .send({ title: 'Updated Title S1 v3', body: tipTapBody('body v3') });
    expect(patch2.status).toBe(200);

    const updatedNote = patch2.body as { version: number };
    // After 2 updates, version should be 3 (started at 1)
    expect(updatedNote.version).toBe(3);

    // GET /notes/:id/versions should return exactly 2 NoteVersion records
    const listRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));

    expect(listRes.status).toBe(200);
    const versions = listRes.body as unknown[];
    expect(versions).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// VER-SAVE-S2 — Version count equals update count
// ---------------------------------------------------------------------------

describe('VER-SAVE-S2: Create + update 3 times → list returns array length 3 (FR-VER-1)', () => {
  it('VER-SAVE-S2: GET /versions returns 3 records after 3 updates', async () => {
    const noteId = await createNote('Initial Title S2', tipTapBody('initial body s2'));

    await updateNote(noteId, 'Title S2 v2', tipTapBody('body s2 v2'));
    await updateNote(noteId, 'Title S2 v3', tipTapBody('body s2 v3'));
    await updateNote(noteId, 'Title S2 v4', tipTapBody('body s2 v4'));

    const listRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));

    expect(listRes.status).toBe(200);
    const versions = listRes.body as unknown[];
    expect(versions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// VER-LIST-S1 — List returns newest version first, no body field
// ---------------------------------------------------------------------------

describe('VER-LIST-S1: GET /notes/:id/versions → 200; newest version first; no body property in items (FR-VER-2)', () => {
  it('VER-LIST-S1: array[0].version > array[1].version; no item has a body property', async () => {
    const noteId = await createNote('List Note S1', tipTapBody('list body s1'));

    await updateNote(noteId, 'List Note S1 v2', tipTapBody('list body s1 v2'));
    await updateNote(noteId, 'List Note S1 v3', tipTapBody('list body s1 v3'));

    const listRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));

    expect(listRes.status).toBe(200);

    const versions = listRes.body as Array<{
      id: string;
      version: number;
      savedAt: string;
      title: string;
      body?: unknown;
    }>;

    // Must have at least 2 records
    expect(versions.length).toBeGreaterThanOrEqual(2);

    // Ordered newest first: array[0].version > array[1].version
    expect(versions[0]!.version).toBeGreaterThan(versions[1]!.version);

    // No item should have a body property (list view omits body)
    for (const item of versions) {
      expect(item).not.toHaveProperty('body');
    }

    // Each item has expected shape fields
    for (const item of versions) {
      expect(item.id).toBeTruthy();
      expect(typeof item.version).toBe('number');
      expect(item.savedAt).toBeTruthy();
      expect(item.title).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// VER-LIST-S2 — List for unowned note returns 404
// ---------------------------------------------------------------------------

describe('VER-LIST-S2: GET /notes/:id/versions for note owned by user B as user A → 404 NOTE_NOT_FOUND (FR-VER-2)', () => {
  it('VER-LIST-S2: returns 404 NOTE_NOT_FOUND when requesting versions of another user\'s note', async () => {
    // Create a note as user B
    const noteBRes = await request(app)
      .post('/notes')
      .set(bearer(userBAccessToken))
      .send({ title: 'User B Note', body: tipTapBody('user b content') });
    expect(noteBRes.status).toBe(201);
    const noteBId = (noteBRes.body as { id: string }).id;

    // Try to list versions as user A
    const res = await request(app)
      .get(`/notes/${noteBId}/versions`)
      .set(bearer(accessToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND');
    expect((res.body as { type: string }).type).toContain('NOTE_NOT_FOUND');
    expect((res.body as { title: string }).title).toBeTruthy();
    expect((res.body as { status: number }).status).toBe(404);
    expect((res.body as { detail: string }).detail).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// VER-VIEW-S1 — View version includes body
// ---------------------------------------------------------------------------

describe('VER-VIEW-S1: GET /notes/:id/versions/:versionId → 200; includes body; body matches original (FR-VER-3)', () => {
  it('VER-VIEW-S1: response has id, version, savedAt, title, body; body matches original note body', async () => {
    const originalTitle = 'Original Title VER-VIEW-S1';
    const originalBodyText = 'original body text for view test';
    const originalBody = tipTapBody(originalBodyText);

    const noteId = await createNote(originalTitle, originalBody);

    // Update with new title — creates NoteVersion for the original state
    await updateNote(noteId, 'Updated Title VER-VIEW-S1', tipTapBody('updated body text'));

    // List versions to get the versionId
    const listRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));
    expect(listRes.status).toBe(200);

    const versions = listRes.body as Array<{ id: string; version: number; title: string }>;
    expect(versions.length).toBeGreaterThanOrEqual(1);

    // The oldest version (last in the DESC-ordered array) is the original snapshot
    const originalVersionItem = versions[versions.length - 1]!;
    const versionId = originalVersionItem.id;

    // Fetch the full version detail
    const detailRes = await request(app)
      .get(`/notes/${noteId}/versions/${versionId}`)
      .set(bearer(accessToken));

    expect(detailRes.status).toBe(200);

    const detail = detailRes.body as {
      id: string;
      version: number;
      savedAt: string;
      title: string;
      body: unknown;
    };

    // Must have all required fields
    expect(detail.id).toBeTruthy();
    expect(typeof detail.version).toBe('number');
    expect(detail.savedAt).toBeTruthy();
    expect(detail.title).toBeTruthy();
    expect(detail.body).toBeDefined();

    // Body should match the original (snapshot taken before first update)
    expect(detail.body).toEqual(originalBody);

    // Title should be the original title
    expect(detail.title).toBe(originalTitle);
  });
});

// ---------------------------------------------------------------------------
// VER-VIEW-S2 — View version with nonexistent versionId returns 404
// ---------------------------------------------------------------------------

describe('VER-VIEW-S2: GET /notes/:id/versions/:versionId with nonexistent versionId → 404 VERSION_NOT_FOUND (FR-VER-3)', () => {
  it('VER-VIEW-S2: returns 404 VERSION_NOT_FOUND for nonexistent versionId', async () => {
    const noteId = await createNote('Note For Bad Version', tipTapBody('body'));

    // Use a non-existent version ID
    const res = await request(app)
      .get(`/notes/${noteId}/versions/nonexistent-version-id-00000000000`)
      .set(bearer(accessToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('VERSION_NOT_FOUND');
    expect((res.body as { type: string }).type).toContain('VERSION_NOT_FOUND');
    expect((res.body as { title: string }).title).toBeTruthy();
    expect((res.body as { status: number }).status).toBe(404);
    expect((res.body as { detail: string }).detail).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// VER-RESTORE-S1 — Restore increments total version count by 2
// ---------------------------------------------------------------------------

describe('VER-RESTORE-S1: Restore increments total version count by 2; response has correct shape (FR-VER-4)', () => {
  it('VER-RESTORE-S1: after 2 updates + restore: note.version=4; list returns 4 records; restored content matches', async () => {
    const noteId = await createNote('Restore Note S1', tipTapBody('restore body s1'));

    // Update twice to create 2 NoteVersion records
    await updateNote(noteId, 'Restore Note S1 v2', tipTapBody('restore body s1 v2'));
    await updateNote(noteId, 'Restore Note S1 v3', tipTapBody('restore body s1 v3'));

    // Verify we have version=3 and 2 NoteVersion records
    const beforeListRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));
    expect(beforeListRes.status).toBe(200);
    const beforeVersions = beforeListRes.body as Array<{
      id: string;
      version: number;
      title: string;
    }>;
    expect(beforeVersions).toHaveLength(2);

    // The earliest version (last in DESC order) is from the first update
    const earliestVersion = beforeVersions[beforeVersions.length - 1]!;
    const versionId = earliestVersion.id;

    // Get the full detail of the version we'll restore (to check its content)
    const versionDetailRes = await request(app)
      .get(`/notes/${noteId}/versions/${versionId}`)
      .set(bearer(accessToken));
    expect(versionDetailRes.status).toBe(200);
    const versionDetail = versionDetailRes.body as {
      title: string;
      body: unknown;
    };

    // Restore to the earliest version
    const restoreRes = await request(app)
      .post(`/notes/${noteId}/versions/${versionId}/restore`)
      .set(bearer(accessToken));

    expect(restoreRes.status).toBe(200);

    const restoredNote = restoreRes.body as {
      id: string;
      title: string;
      body: unknown;
      tagIds: string[];
      createdAt: string;
      updatedAt: string;
      version: number;
    };

    // Response shape: same as PATCH /notes/:id
    expect(restoredNote.id).toBeTruthy();
    expect(restoredNote.title).toBeTruthy();
    expect(restoredNote.body).toBeDefined();
    expect(Array.isArray(restoredNote.tagIds)).toBe(true);
    expect(restoredNote.createdAt).toBeTruthy();
    expect(restoredNote.updatedAt).toBeTruthy();

    // Version should now be 4 (started at 3, incremented by 1 during restore)
    expect(restoredNote.version).toBe(4);

    // Restored title and body match the selected version
    expect(restoredNote.title).toBe(versionDetail.title);
    expect(restoredNote.body).toEqual(versionDetail.body);

    // List should now return 4 records (2 pre-restore + pre-restore snapshot + post-restore snapshot)
    const afterListRes = await request(app)
      .get(`/notes/${noteId}/versions`)
      .set(bearer(accessToken));
    expect(afterListRes.status).toBe(200);
    const afterVersions = afterListRes.body as unknown[];
    expect(afterVersions).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// VER-RESTORE-S2 — Restore with nonexistent versionId returns 404
// ---------------------------------------------------------------------------

describe('VER-RESTORE-S2: POST /notes/:id/versions/:versionId/restore with nonexistent versionId → 404 VERSION_NOT_FOUND (FR-VER-4)', () => {
  it('VER-RESTORE-S2: returns 404 VERSION_NOT_FOUND for nonexistent versionId', async () => {
    const noteId = await createNote('Note For Bad Restore', tipTapBody('body'));

    const res = await request(app)
      .post(`/notes/${noteId}/versions/nonexistent-version-id-00000000000/restore`)
      .set(bearer(accessToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('VERSION_NOT_FOUND');
    expect((res.body as { type: string }).type).toContain('VERSION_NOT_FOUND');
    expect((res.body as { title: string }).title).toBeTruthy();
    expect((res.body as { status: number }).status).toBe(404);
    expect((res.body as { detail: string }).detail).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// VER-AUTH-S1 — Unauthenticated request returns 401
// ---------------------------------------------------------------------------

describe('VER-AUTH-S1: GET /notes/anything/versions with no auth header → 401 AUTH_TOKEN_INVALID (FR-VER-2)', () => {
  it('VER-AUTH-S1: returns 401 AUTH_TOKEN_INVALID with no Authorization header', async () => {
    const res = await request(app).get('/notes/anything/versions');

    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe('AUTH_TOKEN_INVALID');
    expect((res.body as { type: string }).type).toContain('AUTH_TOKEN_INVALID');
    expect((res.body as { title: string }).title).toBeTruthy();
    expect((res.body as { status: number }).status).toBe(401);
    expect((res.body as { detail: string }).detail).toBeTruthy();
  });
});
