/**
 * Tests for POST /auth/logout
 *
 * Coverage:
 *   AUTH-LOGOUT-S1 → FR-AUTH-4: valid Bearer + valid refresh cookie → 204;
 *                               DB refreshToken.revokedAt set; Set-Cookie clears cookie
 *   AUTH-LOGOUT-S2 → FR-AUTH-4 (idempotency sub-cases):
 *     S2-A: no refreshToken cookie → 204; no Set-Cookie header
 *     S2-B: already-revoked token in cookie → 204; Set-Cookie clears cookie (idempotent)
 *     S2-C: token not in DB in cookie → 204; Set-Cookie clears cookie (idempotent)
 *     S2-D: missing Bearer token → 401 AUTH_TOKEN_INVALID (requireAuth guard)
 *     S2-E: bad/expired Bearer token → 401 AUTH_TOKEN_INVALID (requireAuth guard)
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

import { logoutHandler } from '../routes/auth/logout.js';
import { requireAuth } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { signAccessToken } from '../lib/jwt.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(cookieParser());
app.post('/auth/logout', requireAuth, (req, res, next) => {
  logoutHandler(req, res).catch(next);
});
// Express 5 still requires a 4-arg error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = `logout-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Secur3Pass';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper to check that a Set-Cookie header clears the refreshToken cookie
 *  (maxAge=0 or empty value). */
function assertCookieCleared(setCookieHeader: string[] | string | undefined): void {
  expect(setCookieHeader).toBeDefined();

  const cookieString = Array.isArray(setCookieHeader)
    ? setCookieHeader.join('; ')
    : setCookieHeader!;

  // The clear is achieved by setting the value to '' AND maxAge=0
  const hasEmptyValue = cookieString.includes('refreshToken=;') || cookieString.includes('refreshToken=; ');
  const hasMaxAgeZero = cookieString.toLowerCase().includes('max-age=0');

  expect(hasEmptyValue || hasMaxAgeZero).toBe(true);
}

/** Seeds a test user with a known password. Returns userId and a signed access token. */
async function seedUser(): Promise<{ userId: string; accessToken: string }> {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 1);
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, passwordHash },
  });
  const accessToken = signAccessToken(user.id);
  return { userId: user.id, accessToken };
}

/** Seeds an active (un-revoked, un-expired) refresh token in DB for the given user. */
async function seedActiveRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { userId, token: rawToken, expiresAt },
  });
  return rawToken;
}

/** Seeds a refresh token that is already revoked in DB. */
async function seedRevokedRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await prisma.refreshToken.create({
    data: { userId, token: rawToken, expiresAt, revokedAt: new Date() },
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
// AUTH-LOGOUT-S1: happy path
// FR-AUTH-4: 204; DB refreshToken.revokedAt set; Set-Cookie clears cookie
// ---------------------------------------------------------------------------

describe('AUTH-LOGOUT-S1: happy path (FR-AUTH-4)', () => {
  it('AUTH-LOGOUT-S1: valid Bearer + valid refresh cookie → 204, revokedAt set in DB, cookie cleared', async () => {
    const { userId, accessToken } = await seedUser();
    const refreshToken = await seedActiveRefreshToken(userId);

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${refreshToken}`);

    // 1. Status 204 No Content
    expect(res.status).toBe(204);

    // 2. DB: refreshToken row now has revokedAt set (not null)
    const dbToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.revokedAt).not.toBeNull();

    // 3. Set-Cookie header clears the refreshToken cookie (maxAge=0 or empty value)
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    assertCookieCleared(setCookieHeader);
  });
});

// ---------------------------------------------------------------------------
// AUTH-LOGOUT-S2: idempotency sub-cases
// FR-AUTH-4: various "already done or no-op" paths all return 204
// ---------------------------------------------------------------------------

describe('AUTH-LOGOUT-S2: idempotency sub-cases (FR-AUTH-4)', () => {
  it('AUTH-LOGOUT-S2-A: no refreshToken cookie → 204, no Set-Cookie header', async () => {
    const { accessToken } = await seedUser();

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    // No cookie header sent at all

    // 204 — idempotent, no error
    expect(res.status).toBe(204);

    // No Set-Cookie header — there is no cookie to clear
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    expect(setCookieHeader).toBeUndefined();
  });

  it('AUTH-LOGOUT-S2-B: already-revoked token in cookie → 204, cookie cleared (idempotent)', async () => {
    const { userId, accessToken } = await seedUser();
    const revokedToken = await seedRevokedRefreshToken(userId);

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${revokedToken}`);

    // 204 — idempotent, no error
    expect(res.status).toBe(204);

    // DB row's revokedAt is still set (unchanged by this call)
    const dbToken = await prisma.refreshToken.findUnique({ where: { token: revokedToken } });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.revokedAt).not.toBeNull();

    // Set-Cookie header IS present clearing the cookie
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    assertCookieCleared(setCookieHeader);
  });

  it('AUTH-LOGOUT-S2-C: token not in DB in cookie → 204, cookie cleared (idempotent)', async () => {
    const { accessToken } = await seedUser();
    const unknownToken = crypto.randomBytes(32).toString('hex'); // valid format, never persisted

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', `refreshToken=${unknownToken}`);

    // 204 — idempotent, no error
    expect(res.status).toBe(204);

    // No DB row created for this unknown token
    const dbToken = await prisma.refreshToken.findUnique({ where: { token: unknownToken } });
    expect(dbToken).toBeNull();

    // Set-Cookie header IS present clearing the cookie
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    assertCookieCleared(setCookieHeader);
  });

  it('AUTH-LOGOUT-S2-D: missing Bearer token → 401 AUTH_TOKEN_INVALID (requireAuth guard)', async () => {
    const { userId } = await seedUser();
    const refreshToken = await seedActiveRefreshToken(userId);

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', `refreshToken=${refreshToken}`);
    // No Authorization header

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('AUTH-LOGOUT-S2-E: bad Bearer token → 401 AUTH_TOKEN_INVALID (requireAuth guard)', async () => {
    const { userId } = await seedUser();
    const refreshToken = await seedActiveRefreshToken(userId);

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});
