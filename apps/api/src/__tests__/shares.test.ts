/**
 * Integration tests for Note Sharing endpoints
 *
 * Coverage:
 *   SHARE-CREATE-S1  → FR-SHARE-1: POST /notes/:id/shares with {} → 201; 32-char URL-safe token; shareUrl contains token
 *   SHARE-CREATE-S2  → FR-SHARE-1: POST with future expiresAt → 201; expiresAt matches
 *   SHARE-CREATE-S3  → FR-SHARE-1: POST with past expiresAt → 400 VALIDATION_FAILED
 *   SHARE-REVOKE-S1  → FR-SHARE-2: DELETE active share → 204; GET /public → 410 GONE_LINK_INVALID
 *   SHARE-REVOKE-S2  → FR-SHARE-2: DELETE already-revoked → 204 (idempotent)
 *   SHARE-VIEW-S1    → FR-SHARE-3: GET /public valid → 200 { title, body, viewCount: 1, sharedAt }
 *   SHARE-VIEW-S2    → FR-SHARE-3, FR-SHARE-4: GET /public expired → 410 GONE_LINK_INVALID
 *   SHARE-VIEW-S3    → FR-SHARE-3, FR-SHARE-4: GET /public revoked → 410 GONE_LINK_INVALID (identical shape)
 *   SHARE-VIEW-S4    → FR-SHARE-3: 10 concurrent GETs → viewCount in DB = 10 (atomic)
 *   SHARE-LIST-S1    → FR-SHARE-5: GET /notes/:id/shares → 200 array len 2; revokedAt set; ordered createdAt DESC
 *   SHARE-LIST-S2    → FR-SHARE-5: GET /notes/:id/shares for note owned by user B as user A → 404 NOTE_NOT_FOUND
 */

// Set env var BEFORE any import that reads it
process.env['SHARE_BASE_URL'] = 'http://localhost:3000';

import 'dotenv/config';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { prisma } from '../lib/prisma.js';
import { createAuthRouter } from '../routes/auth/index.js';
import notesRouter from '../routes/notes.js';
import sharesRouter from '../routes/shares.js';
import publicRouter from '../routes/public.js';
import { errorHandler } from '../middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Minimal test app — mirrors index.ts mount order
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/auth', createAuthRouter());
app.use('/notes', notesRouter);
app.use('/notes', sharesRouter);
app.use('/public', publicRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test users (unique per test run to avoid collisions)
// ---------------------------------------------------------------------------

const USER_EMAIL = `share-user-${Date.now()}@example.com`;
const USER_B_EMAIL = `share-user-b-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let accessToken = '';
let userBAccessToken = '';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** TipTap JSON body factory */
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
async function createNote(title: string, bodyText: string): Promise<string> {
  const res = await request(app)
    .post('/notes')
    .set(bearer(accessToken))
    .send({ title, body: tipTapBody(bodyText) });
  expect(res.status).toBe(201);
  return (res.body as { id: string }).id;
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

  // Register and login user B (for SHARE-LIST-S2)
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
// SHARE-CREATE-S1 — Create share without expiry
// ---------------------------------------------------------------------------

describe('SHARE-CREATE-S1: POST /notes/:id/shares with empty body → 201 with 32-char URL-safe token (FR-SHARE-1)', () => {
  it('SHARE-CREATE-S1: returns 201; token is exactly 32 chars and URL-safe; shareUrl contains token', async () => {
    const noteId = await createNote('Share Test Note', 'content for sharing');

    const res = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});

    expect(res.status).toBe(201);

    const body = res.body as {
      token: string;
      shareUrl: string;
      expiresAt: string | null;
      viewCount: number;
    };

    // token is exactly 32 chars
    expect(body.token).toHaveLength(32);

    // token matches URL-safe base64 pattern
    expect(body.token).toMatch(/^[A-Za-z0-9\-_]+$/);

    // shareUrl contains the token
    expect(body.shareUrl).toContain(body.token);

    // expiresAt is null (no expiry specified)
    expect(body.expiresAt).toBeNull();

    // viewCount starts at 0
    expect(body.viewCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SHARE-CREATE-S2 — Create share with future expiresAt
// ---------------------------------------------------------------------------

describe('SHARE-CREATE-S2: POST with future expiresAt → 201; response expiresAt matches (FR-SHARE-1)', () => {
  it('SHARE-CREATE-S2: returns 201; response expiresAt matches submitted value', async () => {
    const noteId = await createNote('Share With Expiry', 'content with expiry');

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({ expiresAt: tomorrow });

    expect(res.status).toBe(201);

    const body = res.body as {
      token: string;
      shareUrl: string;
      expiresAt: string | null;
      viewCount: number;
    };

    expect(body.expiresAt).not.toBeNull();

    // Response expiresAt must match the submitted value (compare as timestamps)
    expect(new Date(body.expiresAt!).getTime()).toBe(new Date(tomorrow).getTime());
  });
});

// ---------------------------------------------------------------------------
// SHARE-CREATE-S3 — Past expiresAt rejected → 400 VALIDATION_FAILED
// ---------------------------------------------------------------------------

describe('SHARE-CREATE-S3: POST with past expiresAt → 400 VALIDATION_FAILED (FR-SHARE-1)', () => {
  it('SHARE-CREATE-S3: returns 400 VALIDATION_FAILED for past expiresAt', async () => {
    const noteId = await createNote('Share Past Expiry', 'content');

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({ expiresAt: yesterday });

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// SHARE-REVOKE-S1 — Revoke active share → 204; subsequent GET → 410
// ---------------------------------------------------------------------------

describe('SHARE-REVOKE-S1: DELETE active share → 204; GET /public/shares/:token → 410 GONE_LINK_INVALID (FR-SHARE-2)', () => {
  it('SHARE-REVOKE-S1: revoke returns 204; public view returns 410 after revoke', async () => {
    const noteId = await createNote('Revoke Test Note', 'content to revoke');

    // Create a share
    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    // Revoke the share
    const deleteRes = await request(app)
      .delete(`/notes/${noteId}/shares/${token}`)
      .set(bearer(accessToken));
    expect(deleteRes.status).toBe(204);

    // Public access should now return 410
    const publicRes = await request(app).get(`/public/shares/${token}`);
    expect(publicRes.status).toBe(410);
    expect((publicRes.body as { code: string }).code).toBe('GONE_LINK_INVALID');
  });
});

// ---------------------------------------------------------------------------
// SHARE-REVOKE-S2 — Revoke already-revoked share → 204 (idempotent)
// ---------------------------------------------------------------------------

describe('SHARE-REVOKE-S2: DELETE already-revoked share → 204 (idempotent) (FR-SHARE-2)', () => {
  it('SHARE-REVOKE-S2: double-revoke returns 204 with no error', async () => {
    const noteId = await createNote('Idempotent Revoke Note', 'content');

    // Create a share
    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    // First revoke
    const firstDelete = await request(app)
      .delete(`/notes/${noteId}/shares/${token}`)
      .set(bearer(accessToken));
    expect(firstDelete.status).toBe(204);

    // Second revoke (idempotent — must also return 204)
    const secondDelete = await request(app)
      .delete(`/notes/${noteId}/shares/${token}`)
      .set(bearer(accessToken));
    expect(secondDelete.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// SHARE-VIEW-S1 — Valid share returns note content and increments viewCount
// ---------------------------------------------------------------------------

describe('SHARE-VIEW-S1: GET /public/shares/:token active → 200 { title, body, viewCount: 1, sharedAt } (FR-SHARE-3)', () => {
  it('SHARE-VIEW-S1: returns 200 with correct note content and viewCount=1', async () => {
    const noteTitle = 'Public View Note';
    const noteBodyText = 'public note content';
    const noteId = await createNote(noteTitle, noteBodyText);

    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    const publicRes = await request(app).get(`/public/shares/${token}`);

    expect(publicRes.status).toBe(200);

    const body = publicRes.body as {
      title: string;
      body: unknown;
      viewCount: number;
      sharedAt: string;
    };

    // title and body match the note
    expect(body.title).toBe(noteTitle);
    expect(body.body).toBeDefined();

    // viewCount incremented to 1
    expect(body.viewCount).toBe(1);

    // sharedAt is a valid date string
    expect(body.sharedAt).toBeTruthy();
    expect(new Date(body.sharedAt).getTime()).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// SHARE-VIEW-S2 — Expired share returns 410
// ---------------------------------------------------------------------------

describe('SHARE-VIEW-S2: GET /public/shares/:token with expired token → 410 GONE_LINK_INVALID (FR-SHARE-3, FR-SHARE-4)', () => {
  it('SHARE-VIEW-S2: returns 410 GONE_LINK_INVALID for expired token', async () => {
    const noteId = await createNote('Expired Share Note', 'content');

    // Create share via API
    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    // Set expiresAt in the past via Prisma
    await prisma.noteShare.update({
      where: { token },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const publicRes = await request(app).get(`/public/shares/${token}`);

    expect(publicRes.status).toBe(410);
    expect((publicRes.body as { code: string }).code).toBe('GONE_LINK_INVALID');
  });
});

// ---------------------------------------------------------------------------
// SHARE-VIEW-S3 — Revoked share returns 410 (identical response shape to S2)
// ---------------------------------------------------------------------------

describe('SHARE-VIEW-S3: GET /public/shares/:token with revoked token → 410 GONE_LINK_INVALID (FR-SHARE-3, FR-SHARE-4)', () => {
  it('SHARE-VIEW-S3: returns 410 GONE_LINK_INVALID for revoked token; identical shape to SHARE-VIEW-S2', async () => {
    const noteId = await createNote('Revoked Share Note', 'content');

    // Create share
    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    // Revoke via API
    const revokeRes = await request(app)
      .delete(`/notes/${noteId}/shares/${token}`)
      .set(bearer(accessToken));
    expect(revokeRes.status).toBe(204);

    const publicRes = await request(app).get(`/public/shares/${token}`);

    expect(publicRes.status).toBe(410);
    expect((publicRes.body as { code: string }).code).toBe('GONE_LINK_INVALID');
  });
});

// ---------------------------------------------------------------------------
// SHARE-VIEW-S4 — 10 concurrent GET requests → viewCount in DB = 10
// ---------------------------------------------------------------------------

describe('SHARE-VIEW-S4: 10 concurrent GETs → viewCount in DB = 10 (atomic increment) (FR-SHARE-3)', () => {
  it('SHARE-VIEW-S4: all 10 concurrent requests succeed; DB viewCount equals 10', async () => {
    const noteId = await createNote('Concurrent View Note', 'concurrent content');

    // Create share
    const shareRes = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(shareRes.status).toBe(201);
    const token = (shareRes.body as { token: string }).token;

    // Fire 10 concurrent requests
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get(`/public/shares/${token}`)),
    );

    // All must return 200
    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    // Query DB to verify viewCount = 10 (no increments lost)
    const share = await prisma.noteShare.findUnique({ where: { token } });
    expect(share).not.toBeNull();
    expect(share!.viewCount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// SHARE-LIST-S1 — List shares: 2 total (1 active, 1 revoked); ordered createdAt DESC
// ---------------------------------------------------------------------------

describe('SHARE-LIST-S1: GET /notes/:id/shares → 200 array len 2; revokedAt set on revoked; ordered createdAt DESC (FR-SHARE-5)', () => {
  it('SHARE-LIST-S1: returns both active and revoked shares; ordering is newest first; revoked has revokedAt', async () => {
    const noteId = await createNote('List Shares Note', 'content for listing');

    // Create first share (will be revoked)
    const share1Res = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(share1Res.status).toBe(201);
    const token1 = (share1Res.body as { token: string }).token;

    // Small delay to ensure distinct createdAt timestamps
    await new Promise((r) => setTimeout(r, 50));

    // Create second share (active)
    const share2Res = await request(app)
      .post(`/notes/${noteId}/shares`)
      .set(bearer(accessToken))
      .send({});
    expect(share2Res.status).toBe(201);

    // Revoke first share
    const revokeRes = await request(app)
      .delete(`/notes/${noteId}/shares/${token1}`)
      .set(bearer(accessToken));
    expect(revokeRes.status).toBe(204);

    // List all shares
    const listRes = await request(app)
      .get(`/notes/${noteId}/shares`)
      .set(bearer(accessToken));

    expect(listRes.status).toBe(200);

    const shares = listRes.body as Array<{
      id: string;
      token: string;
      shareUrl: string;
      expiresAt: string | null;
      revokedAt: string | null;
      viewCount: number;
      createdAt: string;
    }>;

    // Must have exactly 2 shares
    expect(shares).toHaveLength(2);

    // Ordered createdAt DESC: newest (share2) first
    const dates = shares.map((s) => new Date(s.createdAt).getTime());
    expect(dates[0]).toBeGreaterThanOrEqual(dates[1]!);

    // One item must have revokedAt set (the revoked one)
    const revokedItems = shares.filter((s) => s.revokedAt !== null);
    expect(revokedItems).toHaveLength(1);
    expect(revokedItems[0]!.token).toBe(token1);

    // One item must have revokedAt null (the active one)
    const activeItems = shares.filter((s) => s.revokedAt === null);
    expect(activeItems).toHaveLength(1);

    // Each item must have expected shape fields
    for (const share of shares) {
      expect(share.id).toBeTruthy();
      expect(share.token).toBeTruthy();
      expect(share.shareUrl).toContain(share.token);
      expect(typeof share.viewCount).toBe('number');
      expect(share.createdAt).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// SHARE-LIST-S2 — List shares for note owned by user B → 404 NOTE_NOT_FOUND
// ---------------------------------------------------------------------------

describe('SHARE-LIST-S2: GET /notes/:id/shares for note owned by user B as user A → 404 NOTE_NOT_FOUND (FR-SHARE-5)', () => {
  it('SHARE-LIST-S2: returns 404 NOTE_NOT_FOUND when note not owned by requester', async () => {
    // Create a note as user B
    const noteBRes = await request(app)
      .post('/notes')
      .set(bearer(userBAccessToken))
      .send({ title: 'User B Note', body: tipTapBody('user b content') });
    expect(noteBRes.status).toBe(201);
    const noteBId = (noteBRes.body as { id: string }).id;

    // Try to list shares as user A (owns a different note)
    const res = await request(app)
      .get(`/notes/${noteBId}/shares`)
      .set(bearer(accessToken));

    expect(res.status).toBe(404);
    expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND');
  });
});
