# Review Log — AB-1003

## T1+T2 Review — 2026-06-26

Auditing T1 (Prisma schema — PasswordResetOtp model) and T2 (packages/shared — forgotPasswordSchema, resetPasswordSchema, types) against FRS.md FR-AUTH-5 and FR-AUTH-6.

Files reviewed:
- apps/api/prisma/schema.prisma
- packages/shared/src/index.ts

---

### FR-AUTH-5 — Forgot password sends 6-digit OTP

[OK] FR-AUTH-5 field `userId` — present on PasswordResetOtp model as `userId String` with FK relation to User.

[OK] FR-AUTH-5 field `otp` — present as `otp String @db.VarChar(6)`, typed correctly for a 6-character code.

[OK] FR-AUTH-5 field `expiresAt` — present as `expiresAt DateTime`; runtime value (now+10min) is a behavior concern for T3/route layer, not schema.

[OK] FR-AUTH-5 field `attemptsLeft: 5` — present as `attemptsLeft Int @default(5)`; default matches the FRS-required initial value of 5.

[OK] FR-AUTH-5 validation — `forgotPasswordSchema` validates `email: z.string().email().max(255)`, which is identical to the register/login email rules as required ("same rules as register").

[OK] FR-AUTH-5 silent-success shape — schema carries no field that would force a non-silent response; response shape is a route-layer concern (T3), not auditable here.

### FR-AUTH-6 — OTP verification + password reset

[OK] FR-AUTH-6 body validation `email` — `resetPasswordSchema` has `email: z.string().email().max(255)`, identical to register/login schemas.

[OK] FR-AUTH-6 body validation `otp: 6-digit string` — `otp: z.string().regex(/^\d{6}$/, ...)` is anchored with `^` and `$`, enforcing exactly 6 numeric digits. Satisfies "6-digit string" requirement.

[OK] FR-AUTH-6 body validation `newPassword` min 8 chars — `newPassword: z.string().min(8)` present.

[OK] FR-AUTH-6 body validation `newPassword` must contain at least 1 number — `.regex(/\d/, 'newPassword must contain at least 1 number')` present; identical pattern to `registerSchema`.

### Security / Structural Checks

[OK] Cascade delete on PasswordResetOtp — `onDelete: Cascade` present on the User relation; orphaned OTP rows cannot accumulate after a User is deleted.

[OK] `@@index([userId])` — present on PasswordResetOtp model; satisfies query-performance requirement for lookups by userId.

[OK] User model relation — `passwordResetOtps PasswordResetOtp[]` added to the User model as required by spec.md data model section.

### Coverage

[COVERAGE] FR-AUTH-5 scenario AUTH-FORGOT-S1 (OTP stored with attemptsLeft=5 and expiresAt≈now+10min verified in DB) — no test covers this sub-bullet yet; T1+T2 are schema/validation only; test coverage is expected in T3 (route implementation) test suite.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S1..S5 — all five OTP scenarios require route-layer tests; none are in scope for T1+T2; expected in T3 tester pass.

---

## T3+T4 Review -- 2026-06-26

Auditing T3 (forgot-password.ts handler) and T4 (reset-password.ts handler) against FRS.md FR-AUTH-5 and FR-AUTH-6.

Files reviewed:
- apps/api/src/routes/auth/forgot-password.ts
- apps/api/src/routes/auth/reset-password.ts
- apps/api/src/routes/auth/index.ts (routing context)
- packages/shared/src/index.ts (Zod schemas)
- apps/api/src/middleware/errorHandler.ts (SDS conventions)

---

### FR-AUTH-5 -- Forgot password sends 6-digit OTP

[OK] FR-AUTH-5 validation -- forgotPasswordSchema.safeParse(req.body) used; schema validates email: z.string().email().max(255); satisfies Validation sub-bullet with proper email format enforcement.

[OK] FR-AUTH-5 error 400 VALIDATION_FAILED -- throw new AppError(400, VALIDATION_FAILED, detail) on schema parse failure; satisfies 400 VALIDATION_FAILED -- invalid email format.

[OK] FR-AUTH-5 behavior email-exists OTP generation and storage -- OTP generated as Math.floor(100000 + Math.random() * 900000).toString() producing exactly 6 digits; stored with { userId, otp, expiresAt: new Date(Date.now() + OTP_TTL_MS), attemptsLeft: 5 } where OTP_TTL_MS = 10 * 60 * 1000; satisfies generate 6-digit OTP, store with { userId, otp, expiresAt: now+10min, attemptsLeft: 5 }.

[OK] FR-AUTH-5 console log prefix -- console.log('[OTP]', otp) called on the email-exists path; satisfies Log the OTP to console with prefix [OTP].

[OK] FR-AUTH-5 silent success no-leak -- both branches (user found and user not found) fall through to res.status(200).json({ message: ... }); satisfies If email does not exist: silent success (same response as success; never leak account existence).

[OK] FR-AUTH-5 success response shape -- res.status(200).json({ message: "If your account exists, you'll receive an OTP" }); satisfies 200 with that exact message.

[WARN] FR-AUTH-5 rate limit 3/hour per email -- FRS states Rate limit: 3/hour per email. The forgot-password.ts handler contains no rate-limit middleware. The audit brief marks this as a T5 (routing) concern; flagging for T5 verification.

[FAIL] FR-AUTH-5 routing not wired -- FRS states Endpoint: POST /auth/forgot-password. apps/api/src/routes/auth/index.ts does not import forgotPasswordHandler and does not register any route for /forgot-password. Observed: index.ts imports only registerHandler, loginHandler, refreshHandler, logoutHandler. FRS text: Endpoint: POST /auth/forgot-password. Handler is unreachable until T5 resolves this; flagged here so T5 is not skipped.

---

### FR-AUTH-6 -- OTP verification + password reset

[OK] FR-AUTH-6 validation -- resetPasswordSchema.safeParse(req.body) used; schema enforces email, otp exactly 6 digits, newPassword min 8 chars with number; satisfies Validation: body { email, otp: 6-digit string, newPassword }.

[OK] FR-AUTH-6 error 400 VALIDATION_FAILED -- throw new AppError(400, VALIDATION_FAILED, detail) on parse failure; satisfies 400 VALIDATION_FAILED -- bad input.

[OK] FR-AUTH-6 find active OTP -- prisma.passwordResetOtp.findFirst with where: { userId, invalidatedAt: null, expiresAt: { gt: now }, attemptsLeft: { gt: 0 } }; satisfies Find active OTP for this email (invalidatedAt IS NULL, expiresAt > now, attemptsLeft > 0).

[OK] FR-AUTH-6 not-found/expired/no-attempts to 401 -- if (!activeOtp) throw new AppError(401, AUTH_OTP_INVALID) covers all three cases because the query filters all three simultaneously; satisfies If not found / expired / no attempts left -> 401.

[OK] FR-AUTH-6 OTP mismatch decrement -- if (activeOtp.otp !== otp) block decrements attemptsLeft by 1 and throws 401; satisfies If OTP mismatches: decrement attemptsLeft.

[OK] FR-AUTH-6 exhausted attempts mark invalid -- invalidatedAt: newAttemptsLeft === 0 ? now : null; when attemptsLeft reaches 0, invalidatedAt is set; satisfies If now 0, mark OTP invalid (invalidatedAt set).

[OK] FR-AUTH-6 error 401 AUTH_OTP_INVALID -- both the not-found path and the mismatch path throw AppError(401, AUTH_OTP_INVALID); satisfies 401 AUTH_OTP_INVALID -- wrong OTP / expired / out of attempts.

[OK] FR-AUTH-6 success response 204 -- res.status(204).end() on the happy path; satisfies Success response: 204 No Content.

[OK] FR-AUTH-6 bcrypt hash rounds >= 12 -- BCRYPT_ROUNDS = 12 and bcrypt.hash(newPassword, BCRYPT_ROUNDS) present; satisfies bcrypt-hash newPassword requirement.

[OK] FR-AUTH-6 atomicity -- prisma.([...]) wraps OTP invalidation (passwordResetOtp.update), password update (user.update), and refresh token revocation (refreshToken.updateMany) in a single call; satisfies rotation MUST be a single Prisma transaction covering all three operations.

[OK] FR-AUTH-6 revoke ALL refresh tokens -- prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }) inside the transaction; satisfies revoke ALL refresh tokens for this user.

[FAIL] FR-AUTH-6 routing not wired -- FRS states Endpoint: POST /auth/reset-password. apps/api/src/routes/auth/index.ts does not import resetPasswordHandler and does not register any route for /reset-password. Observed: index.ts imports only registerHandler, loginHandler, refreshHandler, logoutHandler. FRS text: Endpoint: POST /auth/reset-password. Flagged so T5 resolves this.

[WARN] FR-AUTH-6 user-not-found narrows FR-AUTH-5 no-leak guarantee -- when prisma.user.findUnique returns null (unknown email), reset-password.ts line 19 throws AppError(401, AUTH_OTP_INVALID) immediately. A caller who probes /auth/forgot-password (always 200) then /auth/reset-password can enumerate account existence via this 401. FR-AUTH-6 carries no explicit no-leak clause so this is WARN not FAIL; recommend spec.md clarification.

---

### SDS.md Conventions

[OK] RFC 7807 error format -- AppError produces { type, title, status, detail, code } via errorHandler; both handlers throw AppError correctly so all error responses conform to SDS RFC 7807 shape.

[WARN] SDS CODE_TITLES missing AUTH_OTP_INVALID -- apps/api/src/middleware/errorHandler.ts CODE_TITLES map does not include AUTH_OTP_INVALID. When this error is thrown, title falls back to An error occurred instead of a descriptive title. The code field remains correct; this is a minor RFC 7807 title-quality degradation.

---

### Coverage

[COVERAGE] FR-AUTH-5 scenario AUTH-FORGOT-S1 -- No test file exists for forgot-password (no auth.forgot*.test.ts found under apps/api/src/__tests__/). Scenario: known email -> OTP logged, DB row created with attemptsLeft=5 and expiresAt~=now+10min.

[COVERAGE] FR-AUTH-5 scenario AUTH-FORGOT-S2 -- No test covers unknown-email silent-success path (same 200 response, no DB row created).

[COVERAGE] FR-AUTH-5 scenario AUTH-FORGOT-S3 -- No test covers invalid email format -> 400 VALIDATION_FAILED.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S1 -- No test covers valid OTP -> 204, password hash updated, all refresh tokens revoked, OTP invalidatedAt set.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S2 -- No test covers wrong OTP -> 401 with attemptsLeft decremented.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S3 -- No test covers expired OTP -> 401.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S4 -- No test covers 5th wrong attempt exhausting OTP (attemptsLeft=0, invalidatedAt set) and confirming subsequent correct attempt also returns 401.

[COVERAGE] FR-AUTH-6 scenario AUTH-OTP-S5 -- No test covers invalid input shape -> 400 VALIDATION_FAILED.

---

## T5 Review — 2026-06-26

Auditing T5 (routing wiring) against FRS.md FR-AUTH-5 and FR-AUTH-6.

Files reviewed:
- apps/api/src/routes/auth/index.ts
- apps/api/src/middleware/errorHandler.ts

---

### FR-AUTH-5 — POST /auth/forgot-password registered

[OK] FR-AUTH-5 endpoint registered — `router.post('/forgot-password', forgotPasswordLimiter, (req, res, next) => { forgotPasswordHandler(req, res).catch(next); })` present at line 74; satisfies FRS "Endpoint: POST /auth/forgot-password". Resolves the [FAIL] raised in T3+T4 review.

[OK] FR-AUTH-5 rate limit applied on route — `forgotPasswordLimiter` is passed as middleware to the `/forgot-password` route registration at line 74; satisfies FRS "Rate limit: 3/hour per email".

[OK] FR-AUTH-5 rate limit windowMs — `windowMs: 60 * 60 * 1000` (3 600 000 ms = 1 hour) in `forgotPasswordLimiter`; satisfies FRS "3/hour" window.

[OK] FR-AUTH-5 rate limit limit value — `limit: 3` in `forgotPasswordLimiter`; satisfies FRS "3/hour per email".

[OK] FR-AUTH-5 keyGenerator uses req.body?.email — `keyGenerator: (req: Request) => (req.body?.email as string | undefined) ?? req.ip ?? 'unknown'`; primary key is `req.body?.email` with optional-chaining guard, fallback to `req.ip`; satisfies FRS "3/hour per email" key and spec.md decision 4 pattern ("keyGenerator: (req) => req.body.email").

[OK] FR-AUTH-5 standardHeaders: 'draft-7' — present on `forgotPasswordLimiter` at the equivalent position; satisfies audit brief sub-bullet.

[OK] FR-AUTH-5 legacyHeaders: false — present on `forgotPasswordLimiter`; satisfies audit brief sub-bullet.

[OK] FR-AUTH-5 rate limit handler returns 429 RATE_LIMITED — `handler: (_req, res) => { res.status(429).json(RFC7807_RATE_LIMITED); }` where `RFC7807_RATE_LIMITED` contains `{ code: 'RATE_LIMITED', status: 429, ... }`; satisfies FRS "429 RATE_LIMITED — exceeded 3/hour per email" and RFC 7807 shape.

---

### FR-AUTH-6 — POST /auth/reset-password registered

[OK] FR-AUTH-6 endpoint registered — `router.post('/reset-password', (req, res, next) => { resetPasswordHandler(req, res).catch(next); })` present at line 78; satisfies FRS "Endpoint: POST /auth/reset-password". Resolves the [FAIL] raised in T3+T4 review.

[OK] FR-AUTH-6 no extra rate limit — no rate-limit middleware is passed to the `/reset-password` route; only the `.catch(next)` wrapper is present; satisfies spec.md decision 3 ("No IP-based rate limit on /auth/reset-password: The 5-attempt OTP counter is the primary brute-force guard").

---

### errorHandler.ts — CODE_TITLES map

[OK] AUTH_OTP_INVALID in CODE_TITLES — `AUTH_OTP_INVALID: 'Invalid or expired OTP'` is present at line 20 of errorHandler.ts; satisfies audit brief sub-bullet and resolves the [WARN] raised in T3+T4 review ("SDS CODE_TITLES missing AUTH_OTP_INVALID").

---

### SDS.md Conventions — .catch(next) pattern

[OK] SDS .catch(next) pattern — all six routes follow the `(req, res, next) => { handler(req, res).catch(next); }` pattern: /register (line 58), /login (line 62), /refresh (line 66), /logout (line 70), /forgot-password (line 74), /reset-password (line 78); satisfies SDS endpoint conventions.

---
