---
status: ARCHIVED
ticket: AB-1003
completed: 2026-06-26
---

# AB-1003 — Tasks: Forgot Password + OTP Reset

## Checklist

- [x] **T1 — Prisma schema + migration** (15 min)
  - Add `passwordResetOtps PasswordResetOtp[]` relation to `User` model
  - Add `PasswordResetOtp` model (id, userId, otp, expiresAt, attemptsLeft, invalidatedAt, createdAt)
  - Run `pnpm --filter @noteapp/api prisma migrate dev --name add_password_reset_otp`
  - Regenerate Prisma client
  - **Files:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`
  - **Scenarios:** prerequisite for AUTH-FORGOT-S1, AUTH-OTP-S1..S5

- [x] **T2 — Shared Zod schemas** [PARALLEL with T1] (10 min)
  - Add `forgotPasswordSchema`: `{ email: z.string().email().max(255) }`
  - Add `resetPasswordSchema`: `{ email, otp: z.string().length(6).regex(/^\d{6}$/), newPassword: min 8 + digit }`
  - Export `ForgotPasswordInput` and `ResetPasswordInput` types
  - Rebuild shared: `pnpm --filter @noteapp/shared build`
  - **Files:** `packages/shared/src/index.ts`
  - **Scenarios:** prerequisite for AUTH-FORGOT-S3, AUTH-OTP-S5

- [x] **T3 — `forgot-password.ts` handler** [PARALLEL with T4] (20 min)
  _Requires T1 + T2 complete_
  - Import `forgotPasswordSchema` from `@noteapp/shared`
  - Zod-validate → 400 VALIDATION_FAILED on failure
  - Look up user by email
  - If found: invalidate existing active OTPs (updateMany where userId + invalidatedAt IS NULL)
  - Generate 6-digit OTP via `Math.floor(100000 + Math.random() * 900000).toString()`
  - Insert `PasswordResetOtp` row with `expiresAt = now + 10min`, `attemptsLeft = 5`
  - `console.log('[OTP]', otp)`
  - Always return 200 `{ message: "If your account exists, you'll receive an OTP" }`
  - **Files:** `apps/api/src/routes/auth/forgot-password.ts`
  - **Scenarios:** AUTH-FORGOT-S1, AUTH-FORGOT-S2

- [x] **T4 — `reset-password.ts` handler** [PARALLEL with T3] (25 min)
  _Requires T1 + T2 complete_
  - Import `resetPasswordSchema` from `@noteapp/shared`
  - Zod-validate → 400 VALIDATION_FAILED on failure
  - Look up user by email → 401 AUTH_OTP_INVALID if not found
  - Find active OTP: `userId` matches, `invalidatedAt IS NULL`, `expiresAt > now`, `attemptsLeft > 0`
  - If not found → 401 AUTH_OTP_INVALID
  - On OTP mismatch:
    - Decrement `attemptsLeft`; if now 0, also set `invalidatedAt = now` (single update)
    - Throw 401 AUTH_OTP_INVALID
  - On OTP match — single `prisma.$transaction`:
    1. `passwordResetOtp.update` → set `invalidatedAt = now`
    2. `user.update` → set `passwordHash = await bcrypt.hash(newPassword, 12)`
    3. `refreshToken.updateMany` where `userId` → set `revokedAt = now`
  - Return 204 No Content
  - **Files:** `apps/api/src/routes/auth/reset-password.ts`
  - **Scenarios:** AUTH-OTP-S1, AUTH-OTP-S2, AUTH-OTP-S3, AUTH-OTP-S4, AUTH-OTP-S5

- [x] **T5 — Wire routes in `auth/index.ts`** (10 min)
  _Requires T3 + T4 complete_
  - Import `forgotPasswordHandler`, `resetPasswordHandler`
  - Add `forgotPasswordLimiter`: `windowMs: 3600000, limit: 3, keyGenerator: (req) => req.body?.email ?? req.ip ?? 'unknown'`
  - Register: `router.post('/forgot-password', forgotPasswordLimiter, handler)`
  - Register: `router.post('/reset-password', handler)` (no extra rate limit — OTP counter guards it)
  - **Files:** `apps/api/src/routes/auth/index.ts`
  - **Scenarios:** AUTH-FORGOT-S1..S3, AUTH-OTP-S1..S5 (routing prerequisite)

- [x] **T6 — Tests: `auth.forgot-password.test.ts`** [PARALLEL with T7] (20 min)
  _Requires T5 complete_
  - `beforeEach`: clean `PasswordResetOtp` + `User` tables; seed one registered user
  - `afterAll`: clean up
  - **AUTH-FORGOT-S1:** POST known email → 200 correct body; DB row created with `attemptsLeft=5`,
    `expiresAt` within 10min±5s; `console.log` spy asserts line matching `/\[OTP\] \d{6}/`
  - **AUTH-FORGOT-S2:** POST unknown email → 200 identical body; no `PasswordResetOtp` row in DB
  - **AUTH-FORGOT-S3:** POST `{ email: "not-an-email" }` → 400 `{ code: "VALIDATION_FAILED" }`
  - Use `vi.spyOn(console, 'log')` in S1; restore in `afterEach`
  - **Files:** `apps/api/src/__tests__/auth.forgot-password.test.ts`
  - **Scenarios:** AUTH-FORGOT-S1, AUTH-FORGOT-S2, AUTH-FORGOT-S3

- [x] **T7 — Tests: `auth.reset-password.test.ts`** [PARALLEL with T6] (30 min)
  _Requires T5 complete_
  - `seedUser` helper: create user with known passwordHash
  - `seedOtp` helper: `prisma.passwordResetOtp.create(...)` with configurable fields
  - `beforeEach`: clean `PasswordResetOtp`, `RefreshToken`, `User`; seed user
  - **AUTH-OTP-S1:** Seed valid OTP + 2 active refresh tokens → POST correct OTP →
    204; DB: passwordHash changed, OTP `invalidatedAt` set, both tokens `revokedAt` set
  - **AUTH-OTP-S2:** Seed OTP with `attemptsLeft=5` → POST wrong OTP → 401
    `AUTH_OTP_INVALID`; DB: `attemptsLeft=4`, password unchanged
  - **AUTH-OTP-S3:** Seed OTP with `expiresAt = new Date(Date.now() - 1)` → POST correct OTP →
    401 `AUTH_OTP_INVALID`
  - **AUTH-OTP-S4:** Seed OTP with `attemptsLeft=1` → POST wrong OTP → 401; DB:
    `attemptsLeft=0`, `invalidatedAt` set; POST correct OTP again → 401 (OTP dead)
  - **AUTH-OTP-S5:** POST with `{ otp: "12" }` (too short) → 400 VALIDATION_FAILED;
    POST with missing `newPassword` → 400; POST with invalid email → 400
  - **Files:** `apps/api/src/__tests__/auth.reset-password.test.ts`
  - **Scenarios:** AUTH-OTP-S1, AUTH-OTP-S2, AUTH-OTP-S3, AUTH-OTP-S4, AUTH-OTP-S5

- [x] **T8 — Extend `auth.wiring.test.ts`** (15 min)
  _Requires T5 complete_
  - Add `seedOtp` helper (same pattern as other seed helpers in the file)
  - **WIRING-S10:** POST /auth/forgot-password with valid email → 200 (not 404)
  - **WIRING-S11:** POST /auth/reset-password with empty body → 400 VALIDATION_FAILED (not 404)
  - **WIRING-S12:** 4th POST /auth/forgot-password with same email in same window →
    429 RATE_LIMITED (uses isolated app + MemoryStore)
  - **Files:** `apps/api/src/__tests__/auth.wiring.test.ts`
  - **Scenarios:** WIRING-S10, WIRING-S11, WIRING-S12
