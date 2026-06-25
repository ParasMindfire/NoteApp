/**
 * Tests for POST /auth/register
 *
 * Coverage:
 *   AUTH-REGISTER-S1 → FR-AUTH-1: valid registration returns 201 with id, email, createdAt
 *   AUTH-REGISTER-S2 → FR-AUTH-1: invalid input (password missing digit) returns 400 VALIDATION_FAILED
 *   AUTH-REGISTER-S3 → FR-AUTH-1: duplicate email returns 409 USER_EXISTS
 *
 * Uses a minimal Express app built inline — does NOT depend on apps/api/src/index.ts.
 */

import 'dotenv/config';

import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';

import { registerHandler } from '../routes/auth/register.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Minimal test app
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.post('/auth/register', (req, res, next) => {
  registerHandler(req, res).catch(next);
});
// Express 5 still requires a 4-arg error handler
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

const createdEmails: string[] = [];

afterEach(async () => {
  if (createdEmails.length > 0) {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    createdEmails.length = 0;
  }
});

// ---------------------------------------------------------------------------
// AUTH-REGISTER-S1: valid registration → 201
// FR-AUTH-1: success response 201 with { id, email, createdAt }
// ---------------------------------------------------------------------------

describe('AUTH-REGISTER-S1: valid registration (FR-AUTH-1)', () => {
  it('AUTH-REGISTER-S1: returns 201 with id, email, createdAt for valid input', async () => {
    const email = `register-s1-${Date.now()}@example.com`;
    createdEmails.push(email);

    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'Secur3Pass' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email,
    });
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');
    // No passwordHash in response
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('AUTH-REGISTER-S1: stored password is bcrypt-hashed with ≥12 rounds', async () => {
    const email = `register-s1-hash-${Date.now()}@example.com`;
    createdEmails.push(email);
    const plainPassword = 'Secur3Pass';

    await request(app)
      .post('/auth/register')
      .send({ email, password: plainPassword });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    // bcrypt hash must verify correctly
    const matches = await bcrypt.compare(plainPassword, user!.passwordHash);
    expect(matches).toBe(true);
    // bcrypt cost factor must be ≥ 12
    const rounds = parseInt(user!.passwordHash.split('$')[2]!, 10);
    expect(rounds).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// AUTH-REGISTER-S2: invalid input → 400 VALIDATION_FAILED
// FR-AUTH-1: password must contain at least 1 number
// ---------------------------------------------------------------------------

describe('AUTH-REGISTER-S2: invalid input returns 400 VALIDATION_FAILED (FR-AUTH-1)', () => {
  it('AUTH-REGISTER-S2: password without digit returns 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'valid@example.com', password: 'NoDigitsHere' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-REGISTER-S2: password shorter than 8 chars returns 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'valid@example.com', password: 'sh0rt' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-REGISTER-S2: invalid email format returns 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'Valid1Pass' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-REGISTER-S2: missing email returns 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'Valid1Pass' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('AUTH-REGISTER-S2: missing password returns 400 VALIDATION_FAILED', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'valid@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

// ---------------------------------------------------------------------------
// AUTH-REGISTER-S3: duplicate email → 409 USER_EXISTS
// FR-AUTH-1: 409 USER_EXISTS — email already registered
// ---------------------------------------------------------------------------

describe('AUTH-REGISTER-S3: duplicate email returns 409 USER_EXISTS (FR-AUTH-1)', () => {
  it('AUTH-REGISTER-S3: registering same email twice returns 409 USER_EXISTS', async () => {
    const email = `register-s3-${Date.now()}@example.com`;
    createdEmails.push(email);

    // First registration — must succeed
    const first = await request(app)
      .post('/auth/register')
      .send({ email, password: 'Secur3Pass' });
    expect(first.status).toBe(201);

    // Second registration with same email — must fail
    const second = await request(app)
      .post('/auth/register')
      .send({ email, password: 'Different1Pass' });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('USER_EXISTS');
  });
});
