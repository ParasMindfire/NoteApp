---
status: APPROVED
ticket: AB-1002
---

# AB-1002 — Tasks

## Legend
- [PARALLEL] — safe to run concurrently with sibling tasks in a separate worktree
- Estimate in (minutes)

---

- [x] **T1 — Prisma models + migration** (20 min)
  Files: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`
  - Add User model and RefreshToken model to schema.prisma
  - Run `pnpm exec prisma migrate dev --name add-user-refresh-token` from apps/api/
  - Verify `prisma validate` exits 0
  Scenarios: AUTH-REGISTER-S1 (User table), AUTH-LOGIN-S1 (RefreshToken table)

- [x] **T2 — Shared Zod schemas** (10 min) [PARALLEL]
  Files: `packages/shared/src/index.ts`
  - Export `registerSchema` (email max 255, password min 8 + ≥1 digit)
  - Export `loginSchema` (same rules as registerSchema)
  - Run `pnpm --filter @noteapp/shared build` to regenerate dist
  Scenarios: AUTH-REGISTER-S2, AUTH-LOGIN-S2 (validation rules)

- [x] **T3 — Add cookie-parser package** (5 min) [PARALLEL]
  Files: `apps/api/package.json`, `pnpm-lock.yaml`
  - Add `cookie-parser@1.4.7` to dependencies
  - Add `@types/cookie-parser@1.4.8` to devDependencies
  - Run `pnpm install` from repo root to update lockfile
  Scenarios: AUTH-REFRESH-S1, AUTH-LOGOUT-S1 (cookie parsing)

- [x] **T4 — Lib files** (20 min)
  Files: `apps/api/src/lib/prisma.ts`, `apps/api/src/lib/jwt.ts`, `apps/api/src/lib/cookie.ts`
  Depends: T1, T3
  - `prisma.ts`: PrismaClient singleton (lazy, single global instance)
  - `jwt.ts`: `signAccessToken(userId)` → JWT exp 15min signed with JWT_SECRET from env;
             `verifyAccessToken(token)` → decoded payload or throws
  - `cookie.ts`: `setRefreshCookie(res, token)` — HttpOnly, SameSite=Strict,
                 Path=/auth, Max-Age=604800, Secure when NODE_ENV=production;
                 `clearRefreshCookie(res)` — same attrs with Max-Age=0
  Scenarios: AUTH-LOGIN-S1 (cookie set), AUTH-REFRESH-S1 (token signed + cookie rotated)

- [x] **T5 — Middleware** (20 min)
  Files: `apps/api/src/middleware/auth.ts`, `apps/api/src/middleware/errorHandler.ts`
  Depends: T4
  - `auth.ts`: extracts Bearer token from Authorization header, calls `verifyAccessToken`,
               attaches `req.userId`; returns RFC 7807 401 AUTH_TOKEN_INVALID on failure
  - `errorHandler.ts`: Express 5 error handler; emits `{ type, title, status, detail, code }`;
                       maps known AppError codes to HTTP status; fallback 500
  Scenarios: AUTH-LOGOUT-S1 (requireAuth guard), all error-path scenarios

- [x] **T6 — Register handler** (15 min) [PARALLEL with T7, T8, T9]
  Files: `apps/api/src/routes/auth/register.ts`
  Depends: T2, T4, T5
  - Parse + validate body with `registerSchema` → 400 VALIDATION_FAILED on failure
  - Check for existing email → 409 USER_EXISTS
  - `bcrypt.hash(password, 12)`; `prisma.user.create`
  - Return 201 `{ id, email, createdAt }`; never include passwordHash in response
  Scenarios: AUTH-REGISTER-S1, AUTH-REGISTER-S2, AUTH-REGISTER-S3
  Note: AUTH-REGISTER-S4 (rate limit) is tested at T10 after the router wires the limiter

- [x] **T7 — Login handler** (20 min) [PARALLEL with T6, T8, T9]
  Files: `apps/api/src/routes/auth/login.ts`
  Depends: T2, T4, T5
  - Parse + validate body with `loginSchema` → 400 VALIDATION_FAILED on failure
  - Look up user by email; if not found → run `bcrypt.compare(password, DUMMY_HASH)`
    (constant pre-hashed sentinel) then 401 AUTH_INVALID_CREDENTIALS (timing-safe; see plan R1)
  - If found but `bcrypt.compare` fails → 401 AUTH_INVALID_CREDENTIALS (same code + shape as above)
  - On success: `signAccessToken`; generate `crypto.randomBytes(32).toString('hex')` (64-char);
    `prisma.refreshToken.create` with expiresAt = now + 7d; `setRefreshCookie`;
    return 200 `{ accessToken, user: { id, email } }`
  Scenarios: AUTH-LOGIN-S1, AUTH-LOGIN-S2, AUTH-LOGIN-S3
  Note: AUTH-LOGIN-S4 (rate limit) is tested at T10

- [x] **T8 — Refresh handler** (20 min) [PARALLEL with T6, T7, T9]
  Files: `apps/api/src/routes/auth/refresh.ts`
  Depends: T4, T5
  - Read `req.cookies.refreshToken`; if absent → 401 AUTH_REFRESH_INVALID
  - `prisma.refreshToken.findUnique`; if not found, expired (expiresAt < now),
    or revokedAt is set → 401 AUTH_REFRESH_INVALID
  - `prisma.$transaction([update revokedAt=now, create new token row])` (atomic)
  - `signAccessToken`; `setRefreshCookie(res, newToken)`; return 200 `{ accessToken }`
  Scenarios: AUTH-REFRESH-S1, AUTH-REFRESH-S2, AUTH-REFRESH-S3

- [x] **T9 — Logout handler** (15 min) [PARALLEL with T6, T7, T8]
  Files: `apps/api/src/routes/auth/logout.ts`
  Depends: T4, T5
  - Protected by `requireAuth` middleware (valid Bearer JWT required → 401 on failure)
  - Read `req.cookies.refreshToken`; if absent → return 204 (idempotent)
  - `prisma.refreshToken.findUnique`; if not found → return 204 (idempotent)
  - If `revokedAt` already set → return 204 (idempotent)
  - Otherwise: `prisma.refreshToken.update({ revokedAt: new Date() })`;
    `clearRefreshCookie(res)`; return 204
  Scenarios: AUTH-LOGOUT-S1, AUTH-LOGOUT-S2

- [x] **T10 — Router + app wiring** (15 min)
  Files: `apps/api/src/routes/auth/index.ts`, `apps/api/src/index.ts`
  Depends: T6, T7, T8, T9
  - `auth/index.ts`: Express Router; rate limiters accept injected `Store` option for
    test isolation (see plan R4); register limiter 3/hour per IP; login limiter 5/min per IP;
    mount T6–T9 handlers on POST /register, /login, /refresh, /logout
  - `index.ts`: `app.use(cookieParser())`; `app.use('/auth', authRouter)`;
    `app.use(errorHandler)` as final middleware (after all routes)
  Scenarios: AUTH-REGISTER-S4, AUTH-LOGIN-S4 (rate limits now active end-to-end)
