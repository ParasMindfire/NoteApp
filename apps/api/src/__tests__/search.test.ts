/**
 * Integration tests for Full-Text Search endpoint
 *
 * Coverage:
 *   SEARCH-S1            → FR-SEARCH-1: keyword match in body → 200 with items; note shape; no bodyText
 *   SEARCH-S2            → FR-SEARCH-1: no matching notes → 200 with items=[]; nextCursor=null
 *   SEARCH-S3            → FR-SEARCH-1: empty q → 400 VALIDATION_FAILED
 *   SEARCH-S4            → FR-SEARCH-1: no auth header → 401 AUTH_TOKEN_INVALID
 *   SEARCH-HIGHLIGHT-S1  → FR-SEARCH-2: headline contains <mark> tags around matched term
 *   SEARCH-HIGHLIGHT-S2  → FR-SEARCH-2: multiple matched terms each wrapped in <mark> tags
 *   SEARCH-PAGE-S1       → FR-SEARCH-3: nextCursor present when results exceed limit
 *   SEARCH-PAGE-S2       → FR-SEARCH-3: second page using nextCursor returns remaining items; nextCursor=null
 *   SEARCH-PAGE-S3       → FR-SEARCH-3: malformed cursor → 400 VALIDATION_FAILED
 */

import 'dotenv/config';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { prisma } from '../lib/prisma.js';
import searchRouter from '../routes/search.js';
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
app.use('/search', searchRouter);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test user (unique per test run to avoid collisions)
// ---------------------------------------------------------------------------

const USER_EMAIL = `search-user-${Date.now()}@example.com`;
const PASSWORD = 'Secur3Pass';

let userId = '';
let accessToken = '';

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

/** Create a note with the given title + body text and wait for DB commit */
async function createNote(title: string, bodyText: string) {
  const res = await request(app)
    .post('/notes')
    .set(bearer(accessToken))
    .send({ title, body: tipTapBody(bodyText) });
  expect(res.status).toBe(201);
  // Brief pause so PostgreSQL FTS index is queryable
  await new Promise((r) => setTimeout(r, 100));
  return res.body as { id: string };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Clean up any leftover user from a previous failed run
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });

  const regRes = await request(app)
    .post('/auth/register')
    .send({ email: USER_EMAIL, password: PASSWORD });
  userId = (regRes.body as { id: string }).id;

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: USER_EMAIL, password: PASSWORD });
  accessToken = (loginRes.body as { accessToken: string }).accessToken;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: USER_EMAIL } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// SEARCH-S1 — Match found in note body
// ---------------------------------------------------------------------------

describe('SEARCH-S1: returns matching note for keyword in body (FR-SEARCH-1)', () => {
  it('SEARCH-S1: returns matching note for keyword in body', async () => {
    // Clean existing notes for this user
    await prisma.note.deleteMany({ where: { userId } });

    await createNote('Meeting Notes', 'quarterly review discussion');

    const res = await request(app)
      .get('/search?q=review')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);

    const body = res.body as {
      items: Array<{
        note: {
          id: string;
          title: string;
          body: unknown;
          tagIds: string[];
          version: number;
          createdAt: string;
          updatedAt: string;
          bodyText?: unknown;
        };
        headline: string;
      }>;
      nextCursor: string | null;
    };

    expect(body.items.length).toBeGreaterThan(0);

    const item = body.items[0];
    expect(item).toBeDefined();

    // Note shape assertions
    expect(item!.note.id).toBeTruthy();
    expect(item!.note.title).toBeTruthy();
    expect(item!.note.body).toBeDefined();
    expect(Array.isArray(item!.note.tagIds)).toBe(true);
    expect(typeof item!.note.version).toBe('number');
    expect(item!.note.createdAt).toBeTruthy();
    expect(item!.note.updatedAt).toBeTruthy();

    // headline must be a string
    expect(typeof item!.headline).toBe('string');

    // bodyText must NOT be exposed in the note response (internal field)
    expect(item!.note).not.toHaveProperty('bodyText');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-S2 — No match
// ---------------------------------------------------------------------------

describe('SEARCH-S2: returns empty items when no notes match (FR-SEARCH-1)', () => {
  it('SEARCH-S2: returns empty items when no notes match', async () => {
    await prisma.note.deleteMany({ where: { userId } });

    await createNote('General Notes', 'quarterly review discussion');

    const res = await request(app)
      .get('/search?q=zzznomatch')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; nextCursor: string | null };
    expect(body.items).toEqual([]);
    expect(body.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SEARCH-S3 — Empty q → 400 VALIDATION_FAILED
// ---------------------------------------------------------------------------

describe('SEARCH-S3: rejects empty q with 400 VALIDATION_FAILED (FR-SEARCH-1)', () => {
  it('SEARCH-S3: rejects empty q with 400 VALIDATION_FAILED', async () => {
    // GET /search with no q param at all
    const res = await request(app)
      .get('/search')
      .set(bearer(accessToken));

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-S4 — Unauthenticated → 401
// ---------------------------------------------------------------------------

describe('SEARCH-S4: rejects unauthenticated request with 401 (FR-SEARCH-1)', () => {
  it('SEARCH-S4: rejects unauthenticated request with 401 AUTH_TOKEN_INVALID', async () => {
    const res = await request(app).get('/search?q=test');

    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe('AUTH_TOKEN_INVALID');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-HIGHLIGHT-S1 — <mark> appears in headline
// ---------------------------------------------------------------------------

describe('SEARCH-HIGHLIGHT-S1: headline contains mark tags around matched term (FR-SEARCH-2)', () => {
  it('SEARCH-HIGHLIGHT-S1: headline contains mark tags around matched term', async () => {
    await prisma.note.deleteMany({ where: { userId } });

    await createNote('Tech Notes', 'typescript is great');

    const res = await request(app)
      .get('/search?q=typescript')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as {
      items: Array<{ note: { id: string }; headline: string }>;
    };

    expect(body.items.length).toBeGreaterThan(0);
    const headline = body.items[0]!.headline;
    expect(headline).toContain('<mark>');
    expect(headline).toContain('</mark>');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-HIGHLIGHT-S2 — Multiple matched terms in mark tags
// ---------------------------------------------------------------------------

describe('SEARCH-HIGHLIGHT-S2: headline wraps multiple matched terms in mark tags (FR-SEARCH-2)', () => {
  it('SEARCH-HIGHLIGHT-S2: headline wraps multiple matched terms in mark tags', async () => {
    await prisma.note.deleteMany({ where: { userId } });

    await createNote('Framework Notes', 'typescript and javascript frameworks');

    const res = await request(app)
      .get('/search?q=typescript javascript')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as {
      items: Array<{ note: { id: string }; headline: string }>;
    };

    expect(body.items.length).toBeGreaterThan(0);
    const headline = body.items[0]!.headline;

    // Count <mark> occurrences — should be at least 2 (one per matched term)
    const markCount = (headline.match(/<mark>/g) ?? []).length;
    expect(markCount).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// SEARCH-PAGE-S1 — nextCursor present when results exceed limit
// ---------------------------------------------------------------------------

describe('SEARCH-PAGE-S1: returns nextCursor when results exceed limit (FR-SEARCH-3)', () => {
  it('SEARCH-PAGE-S1: returns nextCursor when results exceed limit', async () => {
    await prisma.note.deleteMany({ where: { userId } });

    // Create 4 notes all matching "paginate"
    for (let i = 1; i <= 4; i++) {
      await createNote(`Paginate Note ${i}`, `paginate keyword content number ${i}`);
    }

    const res = await request(app)
      .get('/search?q=paginate&limit=3')
      .set(bearer(accessToken));

    expect(res.status).toBe(200);
    const body = res.body as {
      items: Array<{ note: { id: string }; headline: string }>;
      nextCursor: string | null;
    };

    expect(body.items.length).toBe(3);
    expect(body.nextCursor).not.toBeNull();
    expect(typeof body.nextCursor).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// SEARCH-PAGE-S2 — Second page using cursor returns remaining items; nextCursor=null
// ---------------------------------------------------------------------------

describe('SEARCH-PAGE-S2: second page using nextCursor returns remaining items with null nextCursor (FR-SEARCH-3)', () => {
  it('SEARCH-PAGE-S2: second page using nextCursor returns remaining items with null nextCursor', async () => {
    await prisma.note.deleteMany({ where: { userId } });

    // Create 4 notes matching "cursor"
    for (let i = 1; i <= 4; i++) {
      await createNote(`Cursor Note ${i}`, `cursor keyword content number ${i}`);
    }

    // First page
    const page1Res = await request(app)
      .get('/search?q=cursor&limit=3')
      .set(bearer(accessToken));

    expect(page1Res.status).toBe(200);
    const page1 = page1Res.body as {
      items: Array<{ note: { id: string }; headline: string }>;
      nextCursor: string | null;
    };

    expect(page1.nextCursor).not.toBeNull();

    // Second page using cursor
    const page2Res = await request(app)
      .get(`/search?q=cursor&limit=3&cursor=${page1.nextCursor!}`)
      .set(bearer(accessToken));

    expect(page2Res.status).toBe(200);
    const page2 = page2Res.body as {
      items: Array<{ note: { id: string }; headline: string }>;
      nextCursor: string | null;
    };

    expect(page2.items.length).toBeGreaterThan(0);
    expect(page2.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SEARCH-PAGE-S3 — Malformed cursor → 400 VALIDATION_FAILED
// ---------------------------------------------------------------------------

describe('SEARCH-PAGE-S3: rejects malformed cursor with 400 VALIDATION_FAILED (FR-SEARCH-3)', () => {
  it('SEARCH-PAGE-S3: rejects malformed cursor with 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .get('/search?q=test&cursor=NOTVALIDBASE64!!!')
      .set(bearer(accessToken));

    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});
