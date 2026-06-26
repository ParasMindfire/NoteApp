---
status: ARCHIVED
ticket: AB-1003
completed: 2026-06-26
---

# AB-1003 — Auth: Forgot Password + OTP Reset

## Overview
AB-1003 extends the auth layer with a self-service password reset flow.
Users request a 6-digit OTP via POST /auth/forgot-password; the OTP is
logged to the console (no actual email sending in v1). Users then submit
the OTP alongside a new password via POST /auth/reset-password, which
bcrypt-hashes the new password, invalidates the OTP, and revokes all
existing refresh tokens for the account (forcing re-login on all devices).

## Goals
- POST /auth/forgot-password — generate + log OTP; silent success for unknown emails
- POST /auth/reset-password — verify OTP (max 5 attempts, 10-min TTL), update password, revoke all sessions
- New `PasswordResetOtp` Prisma model
- New Zod schemas in `packages/shared` for both endpoints

## Non-Goals
- Actual email delivery (deferred — OTP is console-only in v1)
- Account lockout / IP banning after OTP exhaustion
- OTP resend / cooldown UI (frontend AB-1010 handles UX)

## FRs Covered
- FR-AUTH-5 — Forgot password sends 6-digit OTP
- FR-AUTH-6 — OTP verification + password reset

## API Contract

| Method | Path                    | Auth | Summary                            |
|--------|-------------------------|------|------------------------------------|
| POST   | /auth/forgot-password   | None | Request OTP (silent for unknown email) |
| POST   | /auth/reset-password    | None | Verify OTP + set new password      |

Full schema in delta-openapi.yaml.

## Data Model

New model added to `apps/api/prisma/schema.prisma`:

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

`User` model gains relation field:
```prisma
passwordResetOtps PasswordResetOtp[]
```

## Ticket-Specific Decisions

1. **OTP stored as plain string (not hashed):** FRS names the field `otp` (not
   `otpHash`). A 6-digit code with a 10-min TTL and 5-attempt cap provides
   sufficient brute-force protection without the bcrypt overhead that would slow
   each reset-password request.

2. **Multiple OTP requests invalidate previous:** When a new OTP is issued for a
   user, any existing non-invalidated OTPs for that userId are marked
   `invalidatedAt = now`. This prevents parallel OTP attacks. Not stated
   explicitly in FRS but required by the "find active OTP" (singular) language
   in FR-AUTH-6.

3. **No IP-based rate limit on /auth/reset-password:** The 5-attempt OTP counter
   is the primary brute-force guard. Adding a separate IP rate limit was
   considered but not required by FRS and would complicate tests behind NAT.

4. **Rate limit on /auth/forgot-password is per email (not per IP):** FR-AUTH-5
   specifies "3/hour per email". Uses the same `express-rate-limit` + custom
   key generator pattern established in AB-1002 (`keyGenerator: (req) => req.body.email`).
   Unknown emails still consume the rate limit slot (checked before the
   silent-success branch) to prevent enumeration via rate-limit probing.

5. **New route files follow AB-1002 convention:** `forgot-password.ts` and
   `reset-password.ts` are added to `apps/api/src/routes/auth/` and registered
   in `createAuthRouter` in `index.ts`.

## Scenarios

### AUTH-FORGOT-S1: Known email → OTP logged (FR-AUTH-5)
**Given** a registered user with email `user@example.com`  
**When** POST /auth/forgot-password `{ email: "user@example.com" }`  
**Then** response is 200 `{ message: "If your account exists, you'll receive an OTP" }`  
**And** a `PasswordResetOtp` row is created in DB with `attemptsLeft=5` and `expiresAt ≈ now+10min`  
**And** console output contains a line matching `/\[OTP\] \d{6}/`  
**Validates:** FR-AUTH-5

### AUTH-FORGOT-S2: Unknown email → silent success (FR-AUTH-5, no-leak clause)
**Given** no user with email `unknown@example.com` exists  
**When** POST /auth/forgot-password `{ email: "unknown@example.com" }`  
**Then** response is 200 `{ message: "If your account exists, you'll receive an OTP" }` — identical body to S1  
**And** no `PasswordResetOtp` row is created  
**Validates:** FR-AUTH-5 (no account-existence leak)

### AUTH-FORGOT-S3: Invalid email format → 400 (FR-AUTH-5)
**Given** any state  
**When** POST /auth/forgot-password `{ email: "not-an-email" }`  
**Then** response is 400 `{ code: "VALIDATION_FAILED" }`  
**Validates:** FR-AUTH-5

### AUTH-OTP-S1: Valid OTP → 204, password updated, sessions revoked (FR-AUTH-6)
**Given** a `PasswordResetOtp` row exists for `user@example.com` with a valid OTP `"123456"`, `expiresAt` in future, `attemptsLeft=5`  
**And** the user has 2 active refresh tokens in DB  
**When** POST /auth/reset-password `{ email: "user@example.com", otp: "123456", newPassword: "NewPass1" }`  
**Then** response is 204 No Content  
**And** user's `passwordHash` in DB matches bcrypt of `"NewPass1"` with rounds ≥ 12  
**And** the OTP row has `invalidatedAt` set  
**And** all refresh tokens for the user have `revokedAt` set  
**Validates:** FR-AUTH-6

### AUTH-OTP-S2: Wrong OTP → 401, attemptsLeft decremented (FR-AUTH-6)
**Given** a `PasswordResetOtp` row for `user@example.com` with `otp: "123456"`, `attemptsLeft=5`  
**When** POST /auth/reset-password `{ email: "user@example.com", otp: "000000", newPassword: "NewPass1" }`  
**Then** response is 401 `{ code: "AUTH_OTP_INVALID" }`  
**And** `attemptsLeft` in DB is now 4  
**And** password is unchanged  
**Validates:** FR-AUTH-6 (attempt decrement)

### AUTH-OTP-S3: Expired OTP → 401 (FR-AUTH-6)
**Given** a `PasswordResetOtp` row with `expiresAt` in the past, `attemptsLeft=5`  
**When** POST /auth/reset-password `{ email: "user@example.com", otp: "123456", newPassword: "NewPass1" }`  
**Then** response is 401 `{ code: "AUTH_OTP_INVALID" }`  
**Validates:** FR-AUTH-6 (expiry enforcement)

### AUTH-OTP-S4: 5th wrong attempt exhausts OTP (FR-AUTH-6)
**Given** a `PasswordResetOtp` row with `otp: "123456"`, `attemptsLeft=1`  
**When** POST /auth/reset-password `{ email: "user@example.com", otp: "000000", newPassword: "NewPass1" }`  
**Then** response is 401 `{ code: "AUTH_OTP_INVALID" }`  
**And** `attemptsLeft` is now 0 and `invalidatedAt` is set  
**And** a subsequent correct OTP attempt also returns 401 (OTP is dead)  
**Validates:** FR-AUTH-6 (max 5 attempts enforced)

### AUTH-OTP-S5: Invalid input shape → 400 (FR-AUTH-6)
**Given** any state  
**When** POST /auth/reset-password with missing or malformed fields (e.g. otp `"12"`, missing newPassword, invalid email)  
**Then** response is 400 `{ code: "VALIDATION_FAILED" }`  
**Validates:** FR-AUTH-6

## Dependencies
- AB-1002 merged (User + RefreshToken models, AppError, requireAuth, cookie/jwt lib)
- No new npm packages required (bcrypt, express-rate-limit already installed)
