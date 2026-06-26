---
status: ARCHIVED
ticket: AB-1003
completed: 2026-06-26
---

# AB-1003 — Implementation Plan: Forgot Password + OTP Reset

## Dependencies on Prior Tickets
- **AB-1002 merged** — requires `User`, `RefreshToken` Prisma models; `AppError`,
  `errorHandler`, `requireAuth`; `prisma` client lib; `bcrypt`, `express-rate-limit`,
  `zod` already installed in `apps/api` and `packages/shared`.

## New Packages
None. All required packages already installed and pinned.

## Prisma Schema Changes

### `apps/api/prisma/schema.prisma`

Add relation field to `User`:
```prisma
passwordResetOtps PasswordResetOtp[]
```

Add new model:
```prisma
model PasswordResetOtp {
  id            String    @id @default(cuid())
  userId        String
  otp           String    @db.VarChar(6)
  expiresAt     DateTime
  attemptsLeft  Int       @default(5)
  invalidatedAt DateTime?
  createdAt     DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Run after schema change:
```
pnpm --filter @noteapp/api prisma migrate dev --name add_password_reset_otp
```

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/routes/auth/forgot-password.ts` | `forgotPasswordHandler` — validate, rate limit by email, generate OTP, store, log |
| `apps/api/src/routes/auth/reset-password.ts` | `resetPasswordHandler` — validate OTP, decrement attempts, update password, revoke tokens |
| `apps/api/src/__tests__/auth.forgot-password.test.ts` | Integration tests: AUTH-FORGOT-S1..S3 |
| `apps/api/src/__tests__/auth.reset-password.test.ts` | Integration tests: AUTH-OTP-S1..S5 |

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `PasswordResetOtp` model + `User` relation field |
| `apps/api/src/routes/auth/index.ts` | Import + register `forgotPasswordHandler`, `resetPasswordHandler`; add `forgotPasswordLimiter` (3/hr per email) |
| `packages/shared/src/index.ts` | Add `forgotPasswordSchema`, `resetPasswordSchema`, exported types |
| `apps/api/src/__tests__/auth.wiring.test.ts` | Add WIRING-S10..S12: new routes reachable + forgot-password rate limit |

## Implementation Order

1. **Schema** — add `PasswordResetOtp` to `schema.prisma` → run migration
2. **Shared schemas** — add `forgotPasswordSchema` + `resetPasswordSchema` to `packages/shared` → rebuild shared
3. **`forgot-password.ts`** — handler logic
4. **`reset-password.ts`** — handler logic (Prisma transaction: update user + invalidate OTP + revoke tokens)
5. **`auth/index.ts`** — wire both routes + `forgotPasswordLimiter`
6. **Tests** — `auth.forgot-password.test.ts` + `auth.reset-password.test.ts`
7. **Wiring tests** — extend `auth.wiring.test.ts` with WIRING-S10..S12

## Handler Design Notes

### `forgotPasswordHandler`
```
1. Zod-validate body → 400 VALIDATION_FAILED if invalid
2. Look up user by email
3. If user found:
   a. Invalidate any existing active OTPs for userId (set invalidatedAt = now)
   b. Generate 6-digit OTP: Math.floor(100000 + Math.random() * 900000).toString()
   c. Insert PasswordResetOtp row { userId, otp, expiresAt: now+10min, attemptsLeft: 5 }
   d. console.log(`[OTP] ${otp}`)
4. Always return 200 { message: "If your account exists, you'll receive an OTP" }
```

### `resetPasswordHandler`
```
1. Zod-validate body → 400 VALIDATION_FAILED if invalid
2. Look up user by email → if not found, throw 401 AUTH_OTP_INVALID (no leak distinction needed here since we need email to find the OTP)
3. Find active OTP: userId matches, invalidatedAt IS NULL, expiresAt > now, attemptsLeft > 0
4. If not found → throw 401 AUTH_OTP_INVALID
5. If OTP mismatch:
   a. Decrement attemptsLeft
   b. If attemptsLeft reaches 0, set invalidatedAt = now
   c. Save → throw 401 AUTH_OTP_INVALID
6. On match — single Prisma transaction:
   a. Set OTP invalidatedAt = now
   b. bcrypt.hash(newPassword, 12) → update user.passwordHash
   c. updateMany RefreshToken where userId = user.id → set revokedAt = now
7. Return 204 No Content
```

### `forgotPasswordLimiter` (in `auth/index.ts`)
```ts
rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  limit: 3,
  keyGenerator: (req) => (req.body?.email as string | undefined) ?? req.ip ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: opts?.storeFactory?.(),
  handler: (_req, res) => res.status(429).json(RFC7807_RATE_LIMITED),
})
```
> Rate limit runs BEFORE Zod validation. The keyGenerator falls back to IP when
> `req.body.email` is absent/invalid, preventing a bypass via malformed body.
> This matches the spec decision: unknown emails consume the slot.

## Test Strategy

### `auth.forgot-password.test.ts`
| Scenario | What it tests |
|----------|---------------|
| AUTH-FORGOT-S1 | Known email → 200, OTP row in DB, console log matches `/\[OTP\] \d{6}/` |
| AUTH-FORGOT-S2 | Unknown email → 200, identical body, no OTP row created |
| AUTH-FORGOT-S3 | Invalid email format → 400 VALIDATION_FAILED |

Spy on `console.log` in S1 to assert `[OTP]` prefix without capturing the value.

### `auth.reset-password.test.ts`
| Scenario | What it tests |
|----------|---------------|
| AUTH-OTP-S1 | Valid OTP → 204, passwordHash updated, OTP invalidated, all refresh tokens revoked |
| AUTH-OTP-S2 | Wrong OTP (first) → 401, attemptsLeft=4, password unchanged |
| AUTH-OTP-S3 | Expired OTP (expiresAt in past) → 401 |
| AUTH-OTP-S4 | attemptsLeft=1 + wrong OTP → 401, attemptsLeft=0, invalidatedAt set; subsequent correct OTP → 401 |
| AUTH-OTP-S5 | Missing/malformed fields (otp="12", no newPassword) → 400 VALIDATION_FAILED |

Each test seeds a `PasswordResetOtp` row directly via `prisma.passwordResetOtp.create()`.
Use `beforeEach` to clean up `PasswordResetOtp` and `User` tables.

### `auth.wiring.test.ts` additions
| Scenario | What it tests |
|----------|---------------|
| WIRING-S10 | POST /auth/forgot-password reachable (returns 200, not 404) |
| WIRING-S11 | POST /auth/reset-password reachable (returns 400 VALIDATION_FAILED, not 404) |
| WIRING-S12 | 4th POST /auth/forgot-password for same email in window → 429 RATE_LIMITED |

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| Rate limit keyGenerator uses `req.body.email` which may not exist | Fallback to `req.ip ?? 'unknown'` in keyGenerator |
| Prisma transaction in reset-password: 3 writes must be atomic | Use `prisma.$transaction([...])` with all three operations |
| `console.log` spy in test may interfere with other log output | Use `vi.spyOn(console, 'log')` scoped to S1 test, restore in `afterEach` |
| `attemptsLeft=0` + `invalidatedAt` set in same update | Single `prisma.passwordResetOtp.update()` call sets both fields together |
| Wiring test needs to seed PasswordResetOtp rows | Extend existing `seedUser` helper; add `seedOtp` helper in the test file |
| Migration on existing DB with test data | Migration is additive only (new table); no destructive changes |
