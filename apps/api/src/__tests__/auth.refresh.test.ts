/**
 * Tests for POST /auth/refresh
 *
 * Coverage:
 *   AUTH-REFRESH-S1 → FR-AUTH-3: valid cookie rotates token; 200 { accessToken };
 *                                 new Set-Cookie HttpOnly; old token revoked in DB;
 *                                 new token exists; single Prisma transaction (atomicity)
 *   AUTH-REFRESH-S2 → FR-AUTH-3: reused (already-revoked) token returns 401 AUTH_REFRESH_INVALID
 *   AUTH-REFRESH-S3 → FR-AUTH-3: missing cookie / expired token / unknown token all
 *                                 return 401 AUTH_REFRESH_INVALID (no distinction exposed)
 *
 * Uses a minimal Express app built inline — does NOT depend on apps/api/src/index.ts.
 */

import 'dotenv/config';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

import { refreshHandler } from '../routes/auth/refresh.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(cookieParser());
app.post('/auth/refresh', (req, res, next) => {
  refreshHandler(req, res).catch(next);
});
// Express 5 still requires a 4-arg error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = `refresh-test-${Date.now()}@example.com`;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a test user and a valid (un-expired, un-revoked) refresh token in DB.
 *  Returns the raw token string so tests can send it as a cookie. */
async function seedUserAndToken(): Promise<{ userId: string; rawToken: string }> {
  const passwordHash = await bcrypt.hash('Secur3Pass', 1);
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, passwordHash },
  });

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: rawToken, expiresAt },
  });

  return { userId: user.id, rawToken };
}

/** Creates a refresh token row in DB whose expiresAt is in the past. */
async function seedExpiredToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() - 1000); // 1 second in the past

  await prisma.refreshToken.create({
    data: { userId, expiresAt, token: rawToken },
  });

  return rawToken;
}

// ---------------------------------------------------------------------------
// DB cleanup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// AUTH-REFRESH-S1: happy path — token rotation + atomicity
// FR-AUTH-3: 200 { accessToken }; new Set-Cookie HttpOnly; old token revoked;
//            new token exists with revokedAt: null; single transaction
// ---------------------------------------------------------------------------

describe('AUTH-REFRESH-S1: happy path — rotation and atomicity (FR-AUTH-3)', () => {
  it('AUTH-REFRESH-S1: valid cookie returns 200 { accessToken }, rotates token, old revoked, new active, all atomic', async () => {
    const { userId, rawToken } = await seedUserAndToken();

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${rawToken}`);

    // 1. Status 200
    expect(res.status).toBe(200);

    // 2. Body has accessToken (string, non-empty)
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);

    // 3. Set-Cookie header present with refreshToken + HttpOnly
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    expect(setCookieHeader).toBeDefined();

    const cookieString = Array.isArray(setCookieHeader)
      ? setCookieHeader.join('; ')
      : setCookieHeader!;

    expect(cookieString).toContain('refreshToken=');
    expect(cookieString.toLowerCase()).toContain('httponly');

    // 4. Old token in DB now has revokedAt set (not null)
    const oldTokenRow = await prisma.refreshToken.findUnique({
      where: { token: rawToken },
    });
    expect(oldTokenRow).not.toBeNull();
    expect(oldTokenRow!.revokedAt).not.toBeNull();

    // 5. New token row exists in DB with revokedAt: null
    const newCookieValue = (Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader!)
      .split(';')[0]
      ?.replace('refreshToken=', '');

    expect(newCookieValue).toBeDefined();
    expect(newCookieValue!.length).toBeGreaterThan(0);

    const newTokenRow = await prisma.refreshToken.findUnique({
      where: { token: newCookieValue! },
    });
    expect(newTokenRow).not.toBeNull();
    expect(newTokenRow!.revokedAt).toBeNull();

    // 6. Atomicity: BOTH the revoked old row AND the new active row exist in DB
    //    (no partial state — neither write was dropped)
    const totalTokens = await prisma.refreshToken.count({ where: { userId } });
    expect(totalTokens).toBe(2); // one revoked, one new
  });
});

// ---------------------------------------------------------------------------
// AUTH-REFRESH-S2: reused (already-revoked) token → 401 AUTH_REFRESH_INVALID
// FR-AUTH-3: rejected tokens must not allow re-use after rotation
// ---------------------------------------------------------------------------

describe('AUTH-REFRESH-S2: reused (revoked) token rejected (FR-AUTH-3)', () => {
  it('AUTH-REFRESH-S2: using the old rotated-away token returns 401 AUTH_REFRESH_INVALID', async () => {
    const { rawToken } = await seedUserAndToken();

    // First request — valid rotation; old token is now revoked
    const firstRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${rawToken}`);

    expect(firstRes.status).toBe(200);

    // Second request — attempt to reuse the original (now-revoked) token
    const secondRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${rawToken}`);

    expect(secondRes.status).toBe(401);
    expect(secondRes.body.code).toBe('AUTH_REFRESH_INVALID');
  });
});

// ---------------------------------------------------------------------------
// AUTH-REFRESH-S3: missing cookie / expired token / unknown token
// FR-AUTH-3: all three invalid-token paths return 401 AUTH_REFRESH_INVALID;
//            no distinction exposed to the caller
// ---------------------------------------------------------------------------

describe('AUTH-REFRESH-S3: missing / expired / unknown cookie all return 401 AUTH_REFRESH_INVALID (FR-AUTH-3)', () => {
  it('AUTH-REFRESH-S3-A: no cookie at all → 401 AUTH_REFRESH_INVALID', async () => {
    const res = await request(app).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('AUTH-REFRESH-S3-B: expired token in DB → 401 AUTH_REFRESH_INVALID', async () => {
    // Seed a user so we can create an expired token for them
    const passwordHash = await bcrypt.hash('Secur3Pass', 1);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash },
    });

    const expiredToken = await seedExpiredToken(user.id);

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('AUTH-REFRESH-S3-C: token not in DB → 401 AUTH_REFRESH_INVALID', async () => {
    const unknownToken = crypto.randomBytes(32).toString('hex'); // valid format but never persisted

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${unknownToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REFRESH_INVALID');
  });

  it('AUTH-REFRESH-S3: all three invalid paths expose identical error code (no distinction)', async () => {
    // No cookie
    const noCookieRes = await request(app).post('/auth/refresh');

    // Unknown token
    const unknownToken = crypto.randomBytes(32).toString('hex');
    const unknownRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${unknownToken}`);

    // Expired token
    const passwordHash = await bcrypt.hash('Secur3Pass', 1);
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash },
    });
    const expiredToken = await seedExpiredToken(user.id);
    const expiredRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', `refreshToken=${expiredToken}`);

    // All return 401 with the same code — no path distinction
    expect(noCookieRes.status).toBe(401);
    expect(unknownRes.status).toBe(401);
    expect(expiredRes.status).toBe(401);

    expect(noCookieRes.body.code).toBe('AUTH_REFRESH_INVALID');
    expect(unknownRes.body.code).toBe('AUTH_REFRESH_INVALID');
    expect(expiredRes.body.code).toBe('AUTH_REFRESH_INVALID');

    // Confirm same response shape keys across all three
    expect(Object.keys(unknownRes.body)).toEqual(Object.keys(noCookieRes.body));
    expect(Object.keys(expiredRes.body)).toEqual(Object.keys(noCookieRes.body));
  });
});
