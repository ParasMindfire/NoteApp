/**
 * Tests for POST /auth/reset-password
 *
 * Coverage:
 *   AUTH-OTP-S1 → FR-AUTH-6: valid OTP → 204, password updated, OTP invalidated, tokens revoked
 *   AUTH-OTP-S2 → FR-AUTH-6: wrong OTP → 401, attemptsLeft decremented
 *   AUTH-OTP-S3 → FR-AUTH-6: expired OTP → 401
 *   AUTH-OTP-S4 → FR-AUTH-6: last wrong attempt → attemptsLeft=0, OTP dead; correct OTP after → 401
 *   AUTH-OTP-S5 → FR-AUTH-6: bad input shape → 400 VALIDATION_FAILED
 */

import 'dotenv/config';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

import { resetPasswordHandler } from '../routes/auth/reset-password.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.post('/auth/reset-password', (req, res, next) => {
  resetPasswordHandler(req, res).catch(next);
});
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL = `reset-test-${Date.now()}@example.com`;
const ORIGINAL_PASSWORD = 'OriginalPass1';
let testUserId = '';
let originalHash = '';

async function seedUser() {
  originalHash = await bcrypt.hash(ORIGINAL_PASSWORD, 12);
  const user = await prisma.user.create({
    data: { email: TEST_EMAIL, passwordHash: originalHash },
  });
  testUserId = user.id;
  return user;
}

async function seedOtp(overrides: Partial<{
  otp: string;
  expiresAt: Date;
  attemptsLeft: number;
  invalidatedAt: Date | null;
}> = {}) {
  return prisma.passwordResetOtp.create({
    data: {
      userId: testUserId,
      otp: overrides.otp ?? '123456',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
      attemptsLeft: overrides.attemptsLeft ?? 5,
      invalidatedAt: overrides.invalidatedAt ?? null,
    },
  });
}

async function seedRefreshTokens(count = 2) {
  const tokens = [];
  for (let i = 0; i < count; i++) {
    tokens.push(
      prisma.refreshToken.create({
        data: {
          userId: testUserId,
          token: `token-${Date.now()}-${i}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    );
  }
  return Promise.all(tokens);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

// Cascade-safe cleanup: deleting the User cascades to PasswordResetOtp and
// RefreshToken via onDelete: Cascade, avoiding cross-file parallel test interference.
beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await seedUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

// ---------------------------------------------------------------------------
// AUTH-OTP-S1: valid OTP → 204, password updated, OTP invalidated, tokens revoked
// Validates: FR-AUTH-6
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S1: valid OTP → 204, all sessions revoked (FR-AUTH-6)', () => {
  it('AUTH-OTP-S1: returns 204; passwordHash updated; OTP invalidated; all refresh tokens revoked', async () => {
    const otpSeed = await seedOtp({ otp: '123456' });
    const [t1, t2] = await seedRefreshTokens(2);

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '123456', newPassword: 'NewPass1' });

    expect(res.status).toBe(204);

    // Password updated
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user).not.toBeNull();
    const passwordMatch = await bcrypt.compare('NewPass1', user!.passwordHash);
    expect(passwordMatch).toBe(true);
    // Original password no longer works
    const oldMatch = await bcrypt.compare(ORIGINAL_PASSWORD, user!.passwordHash);
    expect(oldMatch).toBe(false);

    // OTP invalidated — query by id to avoid parallel-worker cleanup interference
    const otp = await prisma.passwordResetOtp.findUnique({ where: { id: otpSeed.id } });
    expect(otp!.invalidatedAt).not.toBeNull();

    // Both refresh tokens revoked
    const tokens = await prisma.refreshToken.findMany({
      where: { id: { in: [t1.id, t2.id] } },
    });
    expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AUTH-OTP-S2: wrong OTP → 401, attemptsLeft decremented
// Validates: FR-AUTH-6 (attempt counting)
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S2: wrong OTP → 401, attemptsLeft decremented (FR-AUTH-6)', () => {
  it('AUTH-OTP-S2: returns 401 AUTH_OTP_INVALID; attemptsLeft=4 in DB; password unchanged', async () => {
    const otpRow = await seedOtp({ otp: '123456', attemptsLeft: 5 });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '000000', newPassword: 'NewPass1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_OTP_INVALID');

    const updated = await prisma.passwordResetOtp.findUnique({ where: { id: otpRow.id } });
    expect(updated!.attemptsLeft).toBe(4);

    // Password unchanged
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const unchanged = await bcrypt.compare(ORIGINAL_PASSWORD, user!.passwordHash);
    expect(unchanged).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AUTH-OTP-S3: expired OTP → 401
// Validates: FR-AUTH-6 (expiry enforcement)
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S3: expired OTP → 401 (FR-AUTH-6)', () => {
  it('AUTH-OTP-S3: OTP past expiresAt returns 401 AUTH_OTP_INVALID', async () => {
    await seedOtp({ otp: '123456', expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '123456', newPassword: 'NewPass1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_OTP_INVALID');
  });
});

// ---------------------------------------------------------------------------
// AUTH-OTP-S4: 5th wrong attempt exhausts OTP; correct OTP after also fails
// Validates: FR-AUTH-6 (max 5 attempts enforced)
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S4: 5th wrong attempt marks OTP dead; correct OTP then → 401 (FR-AUTH-6)', () => {
  it('AUTH-OTP-S4: attemptsLeft=1, wrong OTP → 401, attemptsLeft=0 + invalidatedAt set; correct OTP → 401', async () => {
    const otpRow = await seedOtp({ otp: '123456', attemptsLeft: 1 });

    // Wrong OTP on last attempt
    const wrongRes = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '000000', newPassword: 'NewPass1' });

    expect(wrongRes.status).toBe(401);
    expect(wrongRes.body.code).toBe('AUTH_OTP_INVALID');

    const dead = await prisma.passwordResetOtp.findUnique({ where: { id: otpRow.id } });
    expect(dead!.attemptsLeft).toBe(0);
    expect(dead!.invalidatedAt).not.toBeNull();

    // Correct OTP now also rejected — OTP is dead
    const correctRes = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '123456', newPassword: 'NewPass1' });

    expect(correctRes.status).toBe(401);
    expect(correctRes.body.code).toBe('AUTH_OTP_INVALID');
  });
});

// ---------------------------------------------------------------------------
// AUTH-OTP-S5: invalid input shape → 400 VALIDATION_FAILED
// Validates: FR-AUTH-6
// ---------------------------------------------------------------------------

describe('AUTH-OTP-S5: malformed input → 400 VALIDATION_FAILED (FR-AUTH-6)', () => {
  it('AUTH-OTP-S5: otp too short (2 digits) → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '12', newPassword: 'NewPass1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-OTP-S5: missing newPassword → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: TEST_EMAIL, otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-OTP-S5: invalid email → 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ email: 'not-an-email', otp: '123456', newPassword: 'NewPass1' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});
