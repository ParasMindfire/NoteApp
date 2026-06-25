/**
 * Integration tests for T10 — router + app wiring.
 *
 * Coverage:
 *   WIRING-S1..S4  → all 4 auth endpoints reachable via full app (not 404)
 *   WIRING-S5..S6  → cookieParser wired: login sets cookie; refresh reads it
 *   WIRING-S7      → requireAuth on logout: no Bearer → 401 AUTH_TOKEN_INVALID
 *   WIRING-S8      → FR-AUTH-1 rate limit: 4th register → 429 RATE_LIMITED
 *   WIRING-S9      → FR-AUTH-2 rate limit: 6th login → 429 RATE_LIMITED
 */

import 'dotenv/config';

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { MemoryStore } from 'express-rate-limit';
import bcrypt from 'bcrypt';

import app from '../index.js';
import { createAuthRouter } from '../routes/auth/index.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createdEmails: string[] = [];

async function seedUser(email: string, password = 'Secur3Pass') {
  const passwordHash = await bcrypt.hash(password, 1);
  await prisma.user.create({ data: { email, passwordHash } });
}

beforeEach(async () => {
  await prisma.user.deleteMany({
    where: { OR: [{ email: { startsWith: 'wiring-' } }, { email: { startsWith: 'rl-reg-' } }] },
  });
  createdEmails.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// WIRING-S1..S4: all 4 endpoints reachable (not 404)
// ---------------------------------------------------------------------------

describe('WIRING-S1..S4: all 4 auth endpoints are mounted', () => {
  it('WIRING-S1: POST /auth/register returns 201, not 404', async () => {
    const email = `wiring-s1-${Date.now()}@example.com`;
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'Secur3Pass' });
    expect(res.status).toBe(201);
  });

  it('WIRING-S2: POST /auth/login returns 200, not 404', async () => {
    const email = `wiring-s2-${Date.now()}@example.com`;
    await seedUser(email);
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'Secur3Pass' });
    expect(res.status).toBe(200);
  });

  it('WIRING-S3: POST /auth/refresh returns 401 (not 404) when no cookie', async () => {
    const res = await request(app).post('/auth/refresh');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });

  it('WIRING-S4: POST /auth/logout returns 401 (not 404) when no Bearer', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).not.toBe(404);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// WIRING-S5..S6: cookieParser wired
// ---------------------------------------------------------------------------

describe('WIRING-S5..S6: cookieParser is wired before auth router', () => {
  it('WIRING-S5: POST /auth/login response sets refreshToken in Set-Cookie', async () => {
    const email = `wiring-s5-${Date.now()}@example.com`;
    await seedUser(email);
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'Secur3Pass' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('WIRING-S6: POST /auth/refresh reads cookie from login and returns 200', async () => {
    const email = `wiring-s6-${Date.now()}@example.com`;
    await seedUser(email);
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email, password: 'Secur3Pass' });
    expect(loginRes.status).toBe(200);

    const setCookie = loginRes.headers['set-cookie'] as string[] | string;
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const cookieHeader = cookies.find((c) => c.startsWith('refreshToken=')) ?? '';
    const tokenValue = cookieHeader.split(';')[0] ?? '';

    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', tokenValue);
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.body.accessToken).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// WIRING-S7: requireAuth on POST /auth/logout
// ---------------------------------------------------------------------------

describe('WIRING-S7: requireAuth guards POST /auth/logout', () => {
  it('WIRING-S7: POST /auth/logout without Bearer token returns 401 AUTH_TOKEN_INVALID', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});

// ---------------------------------------------------------------------------
// WIRING-S8..S9: rate limits via isolated createAuthRouter + injectable store
// FR-AUTH-1: register 3/hour; FR-AUTH-2: login 5/min
// ---------------------------------------------------------------------------

function buildIsolatedApp() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use(cookieParser());
  testApp.use('/auth', createAuthRouter({ storeFactory: () => new MemoryStore() }));
  testApp.use(errorHandler);
  return testApp;
}

describe('WIRING-S8: FR-AUTH-1 register rate limit 3/hour', () => {
  it('WIRING-S8: 4th POST /auth/register in same window returns 429 RATE_LIMITED', async () => {
    const isolated = buildIsolatedApp();
    for (let i = 1; i <= 3; i++) {
      const res = await request(isolated)
        .post('/auth/register')
        .send({ email: `rl-reg-${i}-${Date.now()}@example.com`, password: 'Secur3Pass' });
      expect(res.status).toBe(201);
    }
    const res = await request(isolated)
      .post('/auth/register')
      .send({ email: `rl-reg-4-${Date.now()}@example.com`, password: 'Secur3Pass' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.status).toBe(429);
  });
});

describe('WIRING-S9: FR-AUTH-2 login rate limit 5/min', () => {
  it('WIRING-S9: 6th POST /auth/login in same window returns 429 RATE_LIMITED', async () => {
    const isolated = buildIsolatedApp();
    for (let i = 1; i <= 6; i++) {
      await request(isolated)
        .post('/auth/login')
        .send({});
    }
    const res = await request(isolated)
      .post('/auth/login')
      .send({ email: 'any@example.com', password: 'Secur3Pass' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.body.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// errorHandler fallback: non-AppError → 500 INTERNAL_ERROR
// ---------------------------------------------------------------------------

describe('errorHandler: fallback 500 branch', () => {
  it('non-AppError thrown in handler returns 500 INTERNAL_ERROR', async () => {
    const crashApp = express();
    crashApp.get('/crash', () => { throw new Error('unexpected!'); });
    crashApp.use(errorHandler);
    const res = await request(crashApp).get('/crash');
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
