---
status: ARCHIVED
ticket: AB-1002
completed: 2026-06-26
fix_bundles: FB-1, FB-2
---

# AB-1002 — Auth: Register, Login, Refresh, Logout

## Overview
AB-1002 implements the core authentication layer: account creation, login, token
refresh, and logout. JWT access tokens (15-min expiry) are returned in the
response body; the opaque 64-char refresh token is delivered exclusively via an
HttpOnly cookie to prevent XSS theft. All four endpoints live under /auth/*.
This ticket establishes the User and RefreshToken Prisma models consumed by
every subsequent backend ticket.

## Goals
- POST /auth/register — create account, bcrypt-hash password (rounds=12)
- POST /auth/login — issue JWT access token + set HttpOnly refresh cookie
- POST /auth/refresh — rotate refresh cookie, return new access token
- POST /auth/logout — revoke refresh cookie (Bearer-protected, idempotent)

## Non-Goals
- Forgot-password / OTP flow (AB-1003)
- OAuth / social sign-in
- Account lockout after N failed attempts (deferred)

## FRs Covered
- FR-AUTH-1 — Register
- FR-AUTH-2 — Login (amended: refreshToken via httpOnly cookie, not response body)
- FR-AUTH-3 — Refresh token rotation (amended: reads cookie, no request body)
- FR-AUTH-4 — Logout revokes cookie (amended: reads cookie, no request body)

## API Contract

| Method | Path           | Auth   | Summary                 |
|--------|----------------|--------|-------------------------|
| POST   | /auth/register | None   | Create account          |
| POST   | /auth/login    | None   | Login, get access token |
| POST   | /auth/refresh  | Cookie | Rotate refresh token    |
| POST   | /auth/logout   | Bearer | Revoke refresh cookie   |

Full schema in delta-openapi.yaml.

## Data Model

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique @db.VarChar(255)
  passwordHash  String
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  token     String    @unique @db.VarChar(64)
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Ticket-Specific Decisions

1. **Refresh token via httpOnly cookie (FR-AUTH-2/3/4 amended).**
   FRS FR-AUTH-2 originally returned refreshToken in body; FR-UI-AUTH-2 requires
   cookie-only delivery. This ticket aligns the backend:
   `Set-Cookie: refreshToken=<value>; HttpOnly; SameSite=Strict; Path=/auth; Max-Age=604800`
   `Secure` flag added in production, omitted in development.
   FRS amendments required:
   - FR-AUTH-2: remove `refreshToken` from success response body
   - FR-AUTH-3: remove body `{ refreshToken: string }` validation
   - FR-AUTH-4: remove body `{ refreshToken: string }` validation

2. **No request body for /auth/refresh and /auth/logout re: token.**
   Browser auto-sends the cookie; server reads it. POST /auth/logout still
   requires a valid Bearer access token.

3. **Cookie scope: `Path=/auth`** — limits cookie to /auth/* routes only.

4. **bcrypt rounds = 12** (FRS minimum).

5. **Account lockout deferred** — wrong-password failures return 401 immediately.

6. **Rate limiting via `express-rate-limit`:**
   - /auth/register: 3/hour per IP
   - /auth/login: 5/min per IP

7. **Shared Zod schemas in packages/shared:** `registerSchema`, `loginSchema`.

## Scenarios

**AUTH-REGISTER-S1 — Happy path**
Given email `user@example.com`, password `Password1`,
When POST /auth/register,
Then 201 `{ id, email, createdAt }`; password absent from response;
DB `passwordHash` round-trips `bcrypt.compare` successfully.
*Validates: FR-AUTH-1*

**AUTH-REGISTER-S2 — Invalid input**
Given email missing `@`, OR password < 8 chars, OR password with no digit,
When POST /auth/register,
Then 400 VALIDATION_FAILED.
*Validates: FR-AUTH-1*

**AUTH-REGISTER-S3 — Duplicate email**
Given email already registered,
When POST /auth/register with same email,
Then 409 USER_EXISTS.
*Validates: FR-AUTH-1*

**AUTH-REGISTER-S4 — Rate limit**
Given 3 requests from same IP within 1 hour,
When 4th POST /auth/register,
Then 429 RATE_LIMITED.
*Validates: FR-AUTH-1*

**AUTH-LOGIN-S1 — Happy path**
Given registered user with valid credentials,
When POST /auth/login `{ email, password }`,
Then 200 `{ accessToken, user: { id, email } }`;
`Set-Cookie` header present with HttpOnly refreshToken cookie;
DB has `RefreshToken` row with `revokedAt: null`.
*Validates: FR-AUTH-2*

**AUTH-LOGIN-S2 — Wrong password (no account-existence leak)**
Given valid email, wrong password,
When POST /auth/login,
Then 401 AUTH_INVALID_CREDENTIALS; response body shape identical to S3.
*Validates: FR-AUTH-2*

**AUTH-LOGIN-S3 — Unknown email (no account-existence leak)**
Given email not in DB,
When POST /auth/login,
Then 401 AUTH_INVALID_CREDENTIALS; response body shape identical to S2.
*Validates: FR-AUTH-2*

**AUTH-LOGIN-S4 — Rate limit**
Given 5 requests from same IP within 1 minute,
When 6th POST /auth/login,
Then 429 RATE_LIMITED.
*Validates: FR-AUTH-2*

**AUTH-REFRESH-S1 — Happy path (rotation)**
Given valid refresh token cookie (`revokedAt: null`, `expiresAt > now`),
When POST /auth/refresh (no body),
Then 200 `{ accessToken }`; new `Set-Cookie` with rotated token;
old token has `revokedAt` set; all within single Prisma transaction.
*Validates: FR-AUTH-3*

**AUTH-REFRESH-S2 — Reused token rejected**
Given cookie containing a token already rotated (`revokedAt` set),
When POST /auth/refresh,
Then 401 AUTH_REFRESH_INVALID.
*Validates: FR-AUTH-3*

**AUTH-REFRESH-S3 — Missing / expired / unknown cookie**
Given no cookie, OR expired token, OR token not in DB,
When POST /auth/refresh,
Then 401 AUTH_REFRESH_INVALID (all three paths; no distinction exposed).
*Validates: FR-AUTH-3*

**AUTH-LOGOUT-S1 — Happy path**
Given valid Bearer access token + valid refresh cookie,
When POST /auth/logout,
Then 204; DB `refreshToken.revokedAt` set; response clears cookie (Max-Age=0).
*Validates: FR-AUTH-4*

**AUTH-LOGOUT-S2 — Already-revoked token**
Given valid Bearer token + already-revoked refresh cookie,
When POST /auth/logout,
Then 204 (idempotent; no error).
*Validates: FR-AUTH-4*

## Dependencies
- AB-1001 merged (pnpm workspace, Prisma + PostgreSQL 16, packages/shared,
  Express app skeleton)

## Open Questions
None.
