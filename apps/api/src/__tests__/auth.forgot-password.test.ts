/**
 * Tests for POST /auth/forgot-password
 *
 * Coverage:
 *   AUTH-FORGOT-S1 → FR-AUTH-5: known email → 200, OTP created in DB, console.log '[OTP] xxxxxx'
 *   AUTH-FORGOT-S2 → FR-AUTH-5: unknown email → 200 identical body, no OTP row created
 *   AUTH-FORGOT-S3 → FR-AUTH-5: invalid email format → 400 VALIDATION_FAILED
 */

import 'dotenv/config';

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

import { forgotPasswordHandler } from '../routes/auth/forgot-password.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.post('/auth/forgot-password', (req, res, next) => {
  forgotPasswordHandler(req, res).catch(next);
});
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const TEST_EMAIL = `forgot-test-${Date.now()}@example.com`;
const TEST_PASSWORD_HASH = await bcrypt.hash('Password1', 12);

async function seedUser() {
  return prisma.user.create({
    data: { email: TEST_EMAIL, passwordHash: TEST_PASSWORD_HASH },
  });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

// Cascade-safe cleanup: deleting the User cascades to PasswordResetOtp
// via onDelete: Cascade, avoiding cross-file parallel test interference.
beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

// ---------------------------------------------------------------------------
// AUTH-FORGOT-S1: known email → 200, OTP created, console logged
// Validates: FR-AUTH-5
// ---------------------------------------------------------------------------

describe('AUTH-FORGOT-S1: known email → OTP created and logged (FR-AUTH-5)', () => {
  it('AUTH-FORGOT-S1: returns 200 with silent message, DB row created, [OTP] logged to console', async () => {
    await seedUser();
    const spy = vi.spyOn(console, 'log');

    const before = new Date();
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: TEST_EMAIL });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "If your account exists, you'll receive an OTP" });

    // OTP row created
    const otp = await prisma.passwordResetOtp.findFirst({
      where: { user: { email: TEST_EMAIL } },
      include: { user: true },
    });
    expect(otp).not.toBeNull();
    expect(otp!.attemptsLeft).toBe(5);
    expect(otp!.invalidatedAt).toBeNull();

    // expiresAt within 10 minutes (+/- 5s tolerance)
    const expectedExpiry = new Date(before.getTime() + 10 * 60 * 1000);
    const diff = Math.abs(otp!.expiresAt.getTime() - expectedExpiry.getTime());
    expect(diff).toBeLessThan(5000);

    // console.log called with [OTP] prefix + 6 digits
    const otpLogCall = spy.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0] === '[OTP]' && /^\d{6}$/.test(String(args[1])),
    );
    expect(otpLogCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AUTH-FORGOT-S2: unknown email → 200 identical body, no OTP row
// Validates: FR-AUTH-5 (no account-existence leak)
// ---------------------------------------------------------------------------

describe('AUTH-FORGOT-S2: unknown email → silent success, no OTP created (FR-AUTH-5)', () => {
  it('AUTH-FORGOT-S2: returns 200 with identical body and creates no PasswordResetOtp row', async () => {
    const unknownEmail = `unknown-${Date.now()}@example.com`;

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: unknownEmail });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "If your account exists, you'll receive an OTP" });

    // Scope count to the unknown email to avoid parallel-worker interference
    const count = await prisma.passwordResetOtp.count({
      where: { user: { email: unknownEmail } },
    });
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AUTH-FORGOT-S3: invalid email format → 400 VALIDATION_FAILED
// Validates: FR-AUTH-5
// ---------------------------------------------------------------------------

describe('AUTH-FORGOT-S3: invalid email format → 400 VALIDATION_FAILED (FR-AUTH-5)', () => {
  it('AUTH-FORGOT-S3: returns 400 VALIDATION_FAILED for non-email string', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});
