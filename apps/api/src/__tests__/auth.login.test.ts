/**
 * Tests for POST /auth/login
 *
 * Coverage:
 *   AUTH-LOGIN-S1 → FR-AUTH-2: valid credentials return 200 with accessToken + user,
 *                               refreshToken delivered via HttpOnly cookie only,
 *                               DB RefreshToken row created with revokedAt: null
 *   AUTH-LOGIN-S2 → FR-AUTH-2: wrong password returns 401 AUTH_INVALID_CREDENTIALS (no account-existence leak)
 *   AUTH-LOGIN-S3 → FR-AUTH-2: unknown email returns 401 AUTH_INVALID_CREDENTIALS,
 *                               response body shape identical to AUTH-LOGIN-S2
 *
 * Uses a minimal Express app built inline — does NOT depend on apps/api/src/index.ts.
 */

import 'dotenv/config';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

import { loginHandler } from '../routes/auth/login.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.post('/auth/login', (req, res, next) => {
  loginHandler(req, res).catch(next);
});
// Express 5 still requires a 4-arg error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Test user constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = `login-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Secur3Pass';

// ---------------------------------------------------------------------------
// DB cleanup + test user setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  // Scope to this file's email only — blanket deleteMany causes cross-file interference
  // in vitest workspace mode. ON DELETE CASCADE handles refresh token cleanup.
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 1);
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// AUTH-LOGIN-S1: happy path
// FR-AUTH-2: 200 with accessToken + user; refreshToken in HttpOnly cookie only;
//            DB RefreshToken row with revokedAt: null
// ---------------------------------------------------------------------------

describe('AUTH-LOGIN-S1: happy path (FR-AUTH-2)', () => {
  it('AUTH-LOGIN-S1: returns 200 with accessToken and user; refreshToken in HttpOnly cookie; DB row created', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

    // 1. Status
    expect(res.status).toBe(200);

    // 2. Body has accessToken (string)
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);

    // 3. Body has user: { id, email }
    expect(res.body.user).toBeDefined();
    expect(typeof res.body.user.id).toBe('string');
    expect(res.body.user.email).toBe(TEST_EMAIL);

    // 4. Body does NOT contain refreshToken (cookie-only delivery)
    expect(res.body.refreshToken).toBeUndefined();

    // 5. Set-Cookie header present with refreshToken + HttpOnly
    const setCookieHeader = res.headers['set-cookie'] as string[] | string | undefined;
    expect(setCookieHeader).toBeDefined();

    const cookieString = Array.isArray(setCookieHeader)
      ? setCookieHeader.join('; ')
      : setCookieHeader!;

    expect(cookieString).toContain('refreshToken=');
    expect(cookieString.toLowerCase()).toContain('httponly');

    // 6. DB has a RefreshToken row for this user with revokedAt: null
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user).not.toBeNull();

    const dbToken = await prisma.refreshToken.findFirst({
      where: { userId: user!.id },
    });
    expect(dbToken).not.toBeNull();
    expect(dbToken!.revokedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AUTH-LOGIN-S2: wrong password → 401 AUTH_INVALID_CREDENTIALS (no account-existence leak)
// FR-AUTH-2: 401 AUTH_INVALID_CREDENTIALS — same code whether wrong password or unknown email
// ---------------------------------------------------------------------------

describe('AUTH-LOGIN-S2: wrong password returns 401 AUTH_INVALID_CREDENTIALS (FR-AUTH-2)', () => {
  it('AUTH-LOGIN-S2: valid email with wrong password returns 401 AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: 'Wr0ngPassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

// ---------------------------------------------------------------------------
// AUTH-LOGIN-S3: unknown email → 401 AUTH_INVALID_CREDENTIALS; body shape identical to S2
// FR-AUTH-2: never leak account existence — same error code + body shape for both failure paths
// ---------------------------------------------------------------------------

describe('AUTH-LOGIN-S3: unknown email returns 401 AUTH_INVALID_CREDENTIALS with identical body shape to S2 (FR-AUTH-2)', () => {
  it('AUTH-LOGIN-S3: unknown email returns 401 AUTH_INVALID_CREDENTIALS with same body shape as wrong-password response', async () => {
    // Capture wrong-password response body (S2 shape reference)
    const wrongPasswordRes = await request(app)
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: 'Wr0ngPassword' });

    expect(wrongPasswordRes.status).toBe(401);
    const s2Body = wrongPasswordRes.body as Record<string, unknown>;

    // Now test unknown email path
    const unknownEmailRes = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@unknown-domain.example.com', password: 'Secur3Pass' });

    expect(unknownEmailRes.status).toBe(401);
    const s3Body = unknownEmailRes.body as Record<string, unknown>;

    // Assert: same error code
    expect(s3Body.code).toBe('AUTH_INVALID_CREDENTIALS');

    // Assert: response body shape is identical — same keys in same order
    expect(Object.keys(s3Body)).toEqual(Object.keys(s2Body));

    // Assert: same code value (no distinguishing between the two failure paths)
    expect(s3Body.code).toBe(s2Body.code);
    expect(s3Body.status).toBe(s2Body.status);
  });
});
