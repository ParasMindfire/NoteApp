# Review Log — AB-1004


## T1+T2 Review — 2026-06-26

### T1 — Prisma Schema (apps/api/prisma/schema.prisma)

#### Note model

[OK] FR-NOTE-1/spec.md Data Model — Note.id is `@id @default(cuid())` (cuid-based primary key)
[OK] FR-NOTE-1/spec.md Data Model — Note.userId `String` field present
[OK] FR-NOTE-1/spec.md Data Model — Note.title is `String @db.VarChar(200)` (matches spec "VarChar 200")
[OK] FR-NOTE-1/spec.md Data Model — Note.body is `Json` (matches spec "body: TipTap JSON object")
[OK] FR-NOTE-1/spec.md Data Model — Note.version is `Int @default(1)` (matches spec default 1)
[OK] FR-NOTE-1/spec.md Data Model — Note.createdAt `DateTime @default(now())` present
[OK] FR-NOTE-1/spec.md Data Model — Note.updatedAt `DateTime @updatedAt` present
[OK] FR-NOTE-1/spec.md Data Model — Note.deletedAt `DateTime?` (nullable) present
[OK] FR-NOTE-4 — Note.user FK references User with onDelete: Cascade (User->Note referential integrity enforced)
[WARN] spec.md Data Model drift — spec shows `user User @relation(fields: [userId], references: [id])` with no `onDelete` clause; implementation adds `onDelete: Cascade`. Cascade-on-user-delete is reasonable but was not specified. Minor behavioural addition not mandated by FRS.

#### NoteVersion model

[OK] spec.md Data Model — NoteVersion.id is `@id @default(cuid())` present
[OK] FR-NOTE-3/spec.md Data Model — NoteVersion.noteId `String` FK to Note with `onDelete: Cascade` present
[OK] FR-NOTE-3/spec.md Data Model — NoteVersion.version `Int` present
[OK] FR-NOTE-3/spec.md Data Model — NoteVersion.title `String @db.VarChar(200)` present
[OK] FR-NOTE-3/spec.md Data Model — NoteVersion.body `Json` present
[OK] FR-NOTE-3/spec.md Data Model — NoteVersion.savedAt `DateTime @default(now())` present
[WARN] spec.md Data Model drift — spec shows NoteVersion.note FK with no `onDelete` clause; implementation adds `onDelete: Cascade`. Same reasoning as Note model above — additive, not mandated.

#### Tag model

[OK] spec.md Data Model — Tag.id is `@id @default(cuid())` present
[OK] FR-TAG-1/spec.md Data Model — Tag.userId `String` FK to User with `onDelete: Cascade` present
[OK] FR-TAG-2/spec.md Data Model — Tag.name `String @db.VarChar(50)` present (matches FR-TAG-2 "1-50 chars")
[OK] FR-TAG-2/spec.md Data Model — Tag.color `String @db.VarChar(7)` present (hex e.g. #FF5733)
[OK] spec.md Data Model — Tag.createdAt `DateTime @default(now())` present
[OK] spec.md Data Model — Tag.deletedAt `DateTime?` (nullable) present
[OK] FR-TAG-2 — @@unique([userId, name]) constraint present (matches FR-TAG-2 "unique on (userId, name)")

#### NoteTag join table

[OK] spec.md Data Model — NoteTag.noteId `String` FK to Note with `onDelete: Cascade` present
[OK] spec.md Data Model — NoteTag.tagId `String` FK to Tag with `onDelete: Cascade` present
[OK] spec.md Data Model — Composite PK `@@id([noteId, tagId])` present
[WARN] spec.md Data Model drift — spec shows NoteTag FKs with no `onDelete` clauses; implementation adds `onDelete: Cascade` on both. Additive, not mandated by FRS.

#### User back-references

[OK] spec.md Data Model — User model has `notes Note[]` back-reference (line 18 of schema)
[OK] spec.md Data Model — User model has `tags Tag[]` back-reference (line 19 of schema)

#### SDS Data Conventions

[FAIL] SDS.md "IDs: cuid2" — SDS.md states "IDs: cuid2" but all models use `@default(cuid())` which is cuid (v1), not cuid2. Observed: `id String @id @default(cuid())` in Note, NoteVersion, Tag, NoteTag. FRS-referenced SDS text: "IDs: cuid2". Note: existing models (User, RefreshToken, PasswordResetOtp) also use cuid v1, so this is a pre-existing project-wide inconsistency — the SDS may need correction to say "cuid" rather than "cuid2", but as written the SDS is violated.

[OK] SDS.md "Timestamps: ISO 8601 UTC" — All DateTime fields use Prisma's native DateTime which serialises as ISO 8601 UTC strings. Satisfied.

### T2 — Shared Zod Schemas (packages/shared/src/index.ts)

#### createNoteSchema

[OK] FR-NOTE-1 "title: string (1-200 chars)" — `z.string().min(1, ...).max(200, ...)` satisfies both lower and upper bounds
[OK] FR-NOTE-1 "body: TipTap JSON object" — `z.record(z.unknown())` enforces an object with string keys; rejects primitives and arrays; appropriate for TipTap JSON
[OK] FR-NOTE-1 "tagIds?: string[]" — `z.array(z.string()).optional()` present; optional array of strings

#### updateNoteSchema

[OK] FR-NOTE-3 "body { title?, body?, tagIds? }" — `createNoteSchema.partial()` makes all three fields optional
[OK] FR-NOTE-3 partial update semantics (spec.md decision 5) — `.refine((obj) => Object.keys(obj).length > 0, ...)` enforces at least one field must be present; empty object is rejected

#### TypeScript types

[OK] FR-NOTE-1 — `CreateNoteInput` exported as `z.infer<typeof createNoteSchema>`
[OK] FR-NOTE-3 — `UpdateNoteInput` exported as `z.infer<typeof updateNoteSchema>`

### Coverage Gaps

[COVERAGE] FR-NOTE-1 createNoteSchema — no test in packages/shared or apps/api validates: title min 1 (empty string rejected), title max 200 (201-char string rejected), body must be object (string/array rejected), tagIds optional (omit accepted), tagIds as array of strings (non-string element rejected)
[COVERAGE] FR-NOTE-3 updateNoteSchema — no test validates: empty body rejected by .refine, partial update (title-only, body-only, tagIds-only each accepted), all-fields update accepted
[COVERAGE] T1 Prisma schema — no migration integration test verifies: @@unique([userId, name]) constraint on Tag raises unique-violation on duplicate, NoteTag composite PK rejects duplicate (noteId, tagId), NoteVersion Cascade on Note delete removes versions, Note Cascade on User delete removes notes

## T3 Review -- 2026-06-26

### Audit: apps/api/src/services/auth.service.ts

#### 1. ARCH-REFACTOR-S2 -- No Express imports in service file

[OK] ARCH-REFACTOR-S2 / FR-ARCH-1 - service layer constraint: grep for express, Request, Response, NextFunction returns zero matches. The file imports only bcrypt, node:crypto, ../lib/prisma.js, ../lib/jwt.js, and ../middleware/errorHandler.js.

#### 2. Function signatures use only plain types (no Express objects)

[OK] FR-ARCH-1 service layer constraint: Every exported function accepts only plain TypeScript types -- registerUser(email: string, password: string), loginUser(email: string, password: string), refreshTokens(incomingToken: string), logoutUser(tokenValue: string), sendOtp(email: string), resetPassword(email: string, otp: string, newPassword: string). No Express objects appear in any signature.

#### 3. registerUser

[OK] FR-AUTH-1 bcrypt rounds >= 12: BCRYPT_ROUNDS = 12 constant used in bcrypt.hash(password, BCRYPT_ROUNDS) and bcrypt.hashSync. Satisfies the minimum requirement.

[OK] FR-AUTH-1 P2002 race condition handled: try/catch at lines 29-34 catches Prisma code P2002 and re-throws as AppError(409, USER_EXISTS). Handles TOCTOU race between findUnique and create.

[OK] FR-AUTH-1 success response shape { id, email, createdAt }: prisma.user.create uses select: { id: true, email: true, createdAt: true } and return type is Promise<{ id: string; email: string; createdAt: Date }>. No sensitive fields returned.

#### 4. loginUser

[OK] FR-AUTH-2 DUMMY_HASH timing normalisation: const DUMMY_HASH = bcrypt.hashSync at module level. When user not found, hash = user?.passwordHash ?? DUMMY_HASH ensures bcrypt.compare always runs. Satisfies timing-normalisation requirement.

[OK] FR-AUTH-2 returns both tokens + user: return type Promise<{ accessToken: string; refreshToken: string; user: { id: string; email: string } }> satisfies contract. Controller is responsible for setting httpOnly cookie per FR-AUTH-2 spec decision 1.

[OK] FR-AUTH-2 no sensitive Prisma fields returned: passwordHash is selected only for internal bcrypt.compare; the returned user object contains only { id, email }.

[OK] FR-AUTH-2 no account-existence leak: check if (!user || !passwordMatch) consolidates both failure cases into a single AppError(401, AUTH_INVALID_CREDENTIALS). FRS: same code; never leak account existence.

#### 5. refreshTokens

[OK] FR-AUTH-3 single transaction for revoke + create: prisma.([...]) at lines 78-86 wraps both the update (revokedAt = now) and the create (new token) atomically. FRS: rotation MUST be a single Prisma transaction.

[OK] FR-AUTH-3 checks revokedAt AND expiresAt: line 71: if (!existing || existing.revokedAt !== null || existing.expiresAt < new Date()). All three rejection conditions (unknown, revoked, expired) are covered.

#### 6. logoutUser

[OK] FR-AUTH-4 idempotent -- already-revoked token does not throw: lines 95-97: if (!existing || existing.revokedAt !== null) { return; } exits silently. FRS: Idempotent -- already-revoked token still returns success.

#### 7. sendOtp

[OK] FR-AUTH-5 OTP logged with [OTP] prefix: line 121: console.log('[OTP]', otp). FRS: Log the OTP to console with prefix [OTP] -- NO actual email sending.

[OK] FR-AUTH-5 invalidates previous OTPs first: lines 109-112: prisma.passwordResetOtp.updateMany({ where: { userId: user.id, invalidatedAt: null }, data: { invalidatedAt: new Date() } }) runs before creating the new OTP.

[OK] FR-AUTH-5 silent on unknown email: entire OTP block is inside if (user) { ... }. Unknown email returns void with no error. FRS: If email does not exist: silent success; never leak account existence.

[SEC] FR-AUTH-5 OTP generated with Math.random() (not CSPRNG): line 114: const otp = Math.floor(100000 + Math.random() * 900000).toString(). Math.random() is not cryptographically secure. For a password-reset OTP an attacker with timing information can reduce the search space. The file already imports node:crypto and uses crypto.randomBytes for refresh tokens. Observed: Math.floor(100000 + Math.random() * 900000).toString() -- should use crypto.randomInt(100000, 1000000).toString().

#### 8. resetPassword

[OK] FR-AUTH-6 decrements attemptsLeft on wrong OTP: lines 147-155: newAttemptsLeft = activeOtp.attemptsLeft - 1 then prisma.passwordResetOtp.update with attemptsLeft: newAttemptsLeft. FRS: decrement attemptsLeft.

[OK] FR-AUTH-6 marks OTP invalid when attemptsLeft reaches 0: line 153: invalidatedAt: newAttemptsLeft === 0 ? now : null. FRS: If now 0, mark OTP invalid.

[OK] FR-AUTH-6 invalidates OTP on match: first operation in  (line 161-163): prisma.passwordResetOtp.update({ data: { invalidatedAt: now } }). FRS: On match: ... invalidate OTP.

[OK] FR-AUTH-6 revokes ALL refresh tokens:  operation at lines 169-172: prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }). FRS: revoke ALL refresh tokens for this user.

[OK] FR-AUTH-6 uses  for final three operations: prisma.([...]) at lines 160-173 wraps (1) invalidate OTP, (2) update passwordHash, (3) revoke all refresh tokens atomically. FRS: bcrypt-hash newPassword, update user, invalidate OTP, revoke ALL refresh tokens -- all three DB writes in one transaction.

[OK] FR-AUTH-6 bcrypt rounds >= 12 for newPassword: line 158: bcrypt.hash(newPassword, BCRYPT_ROUNDS) with BCRYPT_ROUNDS = 12. Satisfies the minimum.

#### Coverage Gaps

[COVERAGE] FR-AUTH-5 sendOtp -- no test verifies that a second sendOtp call for the same email invalidates the previous OTP record before issuing a new one.
[COVERAGE] FR-AUTH-6 resetPassword -- no test verifies atomicity: a simulated mid-transaction failure must leave user.passwordHash, OTP.invalidatedAt, and all refreshToken.revokedAt values unchanged (full rollback).
[COVERAGE] FR-AUTH-6 resetPassword -- no test verifies that ALL active refresh tokens (not just the most recent) are revoked when a user has multiple concurrent sessions at the time of password reset.

## T4 Review — 2026-06-26

### Audit: apps/api/src/controllers/auth.controller.ts

#### 1. ARCH-REFACTOR-S3 — No @prisma/client import in controller file

[OK] ARCH-REFACTOR-S3 / FR-ARCH-1 controller layer constraint: The file imports only `express`, `@noteapp/shared`, `../lib/cookie.js`, `../middleware/errorHandler.js`, and `../services/auth.service.js`. No `@prisma/client` import is present. FRS: "Controller file calls prisma.* directly or imports @prisma/client" is a [FAIL] trigger — not triggered here.

#### 2. Zod validate → AppError(400, 'VALIDATION_FAILED') on failure

[OK] FR-AUTH-1 VALIDATION_FAILED on bad input — registerController: `registerSchema.safeParse(req.body)`; on failure throws `new AppError(400, 'VALIDATION_FAILED', detail)` (lines 15-19). Satisfies FR-AUTH-1 "400 VALIDATION_FAILED — invalid email or password format".

[OK] FR-AUTH-2 VALIDATION_FAILED on bad input — loginController: `loginSchema.safeParse(req.body)`; on failure throws `new AppError(400, 'VALIDATION_FAILED', detail)` (lines 25-29). Satisfies FR-AUTH-2 "400 VALIDATION_FAILED — invalid input shape".

[OK] FR-AUTH-5 VALIDATION_FAILED on bad input — forgotPasswordController: `forgotPasswordSchema.safeParse(req.body)`; on failure throws `new AppError(400, 'VALIDATION_FAILED', detail)` (lines 60-64). Satisfies FR-AUTH-5 "400 VALIDATION_FAILED — invalid email format".

[OK] FR-AUTH-6 VALIDATION_FAILED on bad input — resetPasswordController: `resetPasswordSchema.safeParse(req.body)`; on failure throws `new AppError(400, 'VALIDATION_FAILED', detail)` (lines 70-74). Satisfies FR-AUTH-6 "400 VALIDATION_FAILED — bad input".

[OK] FR-AUTH-3 / FR-AUTH-4 — refreshController and logoutController have no body to validate (cookie-based); no safeParse needed. Correct omission.

#### 3. registerController: calls registerUser, res.status(201).json

[OK] FR-AUTH-1 success response 201 — registerController calls `registerUser(result.data.email, result.data.password)` (line 20) and returns `res.status(201).json(user)` (line 21). Satisfies FR-AUTH-1 "Success response: 201 with { id, email, createdAt }". The shape is delegated to the service (verified in T3 review as selecting { id, email, createdAt } only).

#### 4. loginController: setRefreshCookie called; refreshToken NOT in body

[OK] FR-AUTH-2 success response 200 with { accessToken, user } only — loginController calls `setRefreshCookie(res, refreshToken)` (line 34) then `res.status(200).json({ accessToken, user })` (line 35). `refreshToken` is destructured from the service result but is NOT included in the JSON body. Satisfies FR-AUTH-2: "200 with { accessToken, user: { id, email } } (refreshToken set via httpOnly cookie)".

[OK] FR-AUTH-2 cookie set in controller not service — `setRefreshCookie` is imported from `../lib/cookie.js` and called in the controller. The service returns `{ accessToken, refreshToken, user }` as plain values. Satisfies the plan decision (spec.md decision 1) that cookie ops are controller-layer responsibilities.

#### 5. refreshController: reads cookie, 401 if missing, rotates, setRefreshCookie, { accessToken }

[OK] FR-AUTH-3 reads refreshToken httpOnly cookie — `req.cookies['refreshToken']` (line 39). Satisfies FR-AUTH-3 "Validation: refreshToken httpOnly cookie".

[OK] FR-AUTH-3 401 AUTH_REFRESH_INVALID when missing — if `!incomingToken`, throws `new AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is missing')` (lines 40-42). Satisfies FR-AUTH-3 "401 AUTH_REFRESH_INVALID — missing, expired, revoked, or unknown token".

[OK] FR-AUTH-3 rotation via service + new cookie set — calls `refreshTokens(incomingToken)` (line 43), calls `setRefreshCookie(res, refreshToken)` (line 44), returns `res.status(200).json({ accessToken })` (line 45). Satisfies FR-AUTH-3 "Success response: 200 with { accessToken } (refreshToken set via httpOnly cookie)".

#### 6. logoutController: idempotent on missing cookie, calls logoutUser, clearRefreshCookie, 204

[OK] FR-AUTH-4 idempotent — missing refreshToken cookie → 204 immediately — if `!token`, `res.status(204).end(); return;` (lines 50-53). Satisfies FR-AUTH-4 "missing refreshToken cookie → 204 No Content (idempotent)".

[OK] FR-AUTH-4 calls logoutUser then clearRefreshCookie when cookie present — lines 54-56: `await logoutUser(token); clearRefreshCookie(res); res.status(204).end()`. Satisfies FR-AUTH-4 "Success response: 204 No Content" and the plan requirement that cookie clearing is controller-layer.

[OK] FR-AUTH-4 already-revoked token remains idempotent — when cookie is present but token is already revoked, `logoutUser` silently returns (confirmed T3 review), `clearRefreshCookie` is still called, and `res.status(204).end()` follows. Satisfies FR-AUTH-4 "Idempotent — already-revoked token still returns success".

#### 7. forgotPasswordController: calls sendOtp, exact message string per FR-AUTH-5

[OK] FR-AUTH-5 success response message — forgotPasswordController calls `sendOtp(result.data.email)` (line 65) and returns `res.status(200).json({ message: "If your account exists, you'll receive an OTP" })` (line 66). FR-AUTH-5 specifies exactly: `{ message: "If your account exists, you'll receive an OTP" }`. Strings match character-for-character.

#### 8. resetPasswordController: calls resetPassword, res.status(204).end()

[OK] FR-AUTH-6 success response 204 — resetPasswordController calls `resetPassword(result.data.email, result.data.otp, result.data.newPassword)` (line 75) and returns `res.status(204).end()` (line 76). Satisfies FR-AUTH-6 "Success response: 204 No Content".

#### 9. Cookie ops in controller, NOT in service

[OK] FR-ARCH-1 / spec.md decision 1 — `setRefreshCookie` and `clearRefreshCookie` are imported from `../lib/cookie.js` (line 3) and used exclusively in the controller layer (loginController line 34, refreshController line 44, logoutController line 55). The auth service exports only plain token strings and never touches `res`. Per the plan: "Cookie ops (setRefreshCookie/clearRefreshCookie) are in controller, NOT in service". Satisfied.

#### Coverage Gaps

[COVERAGE] FR-AUTH-1 registerController — no test for the controller layer independently: e.g., a mock-service unit test verifying that when registerUser throws AppError(409, USER_EXISTS) the controller propagates it without swallowing, and that res.status(201) is set (not 200) on success.

[COVERAGE] FR-AUTH-2 loginController — no unit test verifying that the response body never contains a `refreshToken` key when the service returns one (integration tests verify this at the HTTP level, but a controller-layer unit test would catch regressions earlier).

[COVERAGE] FR-AUTH-3 refreshController — no test for the 401 branch specifically at the controller boundary (i.e., empty `req.cookies` object → controller throws before calling service). The integration test AUTH-REFRESH-S3-A covers the end-to-end path, but the controller-level guard has no isolated test.

[COVERAGE] FR-AUTH-4 logoutController — no test verifying that `clearRefreshCookie` is NOT called when no cookie is present (only the 204 status is asserted in AUTH-LOGOUT-S2-A; the absence of Set-Cookie is asserted in the integration test, but the controller unit path is not isolated).

## T5 Review — 2026-06-26

### Audit: routes/auth/ individual files + index.ts (FR-ARCH-1 / ARCH-REFACTOR-S4)

#### 1. ARCH-REFACTOR-S4 — Each of the 6 individual route files contains ONLY a re-export

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `register.ts` (1 line): `export { registerController as registerHandler } from '../../controllers/auth.controller.js'`. Zero business logic, zero Prisma calls, zero Zod validation, no `res.json`.

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `login.ts` (1 line): `export { loginController as loginHandler } from '../../controllers/auth.controller.js'`. Pure re-export, no logic.

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `refresh.ts` (1 line): `export { refreshController as refreshHandler } from '../../controllers/auth.controller.js'`. Pure re-export, no logic.

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `logout.ts` (1 line): `export { logoutController as logoutHandler } from '../../controllers/auth.controller.js'`. Pure re-export, no logic.

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `forgot-password.ts` (1 line): `export { forgotPasswordController as forgotPasswordHandler } from '../../controllers/auth.controller.js'`. Pure re-export, no logic.

[OK] ARCH-REFACTOR-S4 / FR-ARCH-1 route layer constraint — `reset-password.ts` (1 line): `export { resetPasswordController as resetPasswordHandler } from '../../controllers/auth.controller.js'`. Pure re-export, no logic.

#### 2. index.ts — Imports from controllers/auth.controller.js (not from individual handler files)

[OK] FR-ARCH-1 / ARCH-REFACTOR-S4 — `index.ts` lines 4-11 import `registerController`, `loginController`, `refreshController`, `logoutController`, `forgotPasswordController`, `resetPasswordController` directly from `../../controllers/auth.controller.js`. No import from the individual route files (`register.ts`, `login.ts`, etc.).

#### 3. index.ts — Route file logic beyond router registration and .catch(next) wiring

[FAIL] FR-ARCH-1 "Route file contains any logic beyond router registration and .catch(next) wiring" — `index.ts` defines an inline constant `RFC7807_RATE_LIMITED` (lines 14-20) and contains `handler` callback lambdas inside each `rateLimit(...)` configuration that call `res.status(429).json(RFC7807_RATE_LIMITED)`. This is response shaping logic embedded in a route file. FRS text: "routes/: Express router registration + .catch(next) only. No business logic, no Prisma." and "[FAIL] trigger: Route file contains any logic beyond router registration and .catch(next) wiring." Observed in `index.ts`: `handler: (_req: Request, res: Response) => { res.status(429).json(RFC7807_RATE_LIMITED); }` appears three times (registerLimiter lines 31-33, loginLimiter lines 42-44, forgotPasswordLimiter lines 55-57).

[FAIL] FR-ARCH-1 "Route file contains any logic beyond router registration and .catch(next) wiring" — `index.ts` `forgotPasswordLimiter` contains a `keyGenerator` function (lines 50-52): `keyGenerator: (req: Request) => (req.body?.email as string | undefined) ?? req.ip ?? 'unknown'`. This is request-body-reading logic in a route file. FRS text: "routes/: Express router registration + .catch(next) only. No business logic, no Prisma." Observed: inline lambda reading `req.body?.email` in route file.

#### 4. Rate limiters applied at correct endpoints with correct windows and limits

[OK] FR-AUTH-1 "Rate limit: 3/hour per IP" — `registerLimiter`: `windowMs: 60 * 60 * 1000` (3,600,000 ms = 1 hour), `limit: 3`. Applied on `router.post('/register', registerLimiter, ...)` (line 60). Matches FR-AUTH-1 exactly.

[OK] FR-AUTH-2 "Rate limit: 5/min per IP" — `loginLimiter`: `windowMs: 60 * 1000` (60,000 ms = 1 minute), `limit: 5`. Applied on `router.post('/login', loginLimiter, ...)` (line 64). Matches FR-AUTH-2 exactly.

[OK] FR-AUTH-5 "Rate limit: 3/hour per email" — `forgotPasswordLimiter`: `windowMs: 60 * 60 * 1000` (1 hour), `limit: 3`, `keyGenerator` uses `req.body?.email`. Applied on `router.post('/forgot-password', forgotPasswordLimiter, ...)` (line 76). Matches FR-AUTH-5 exactly.

#### 5. requireAuth middleware on logout

[OK] FR-AUTH-4 "Auth: requires valid access token" — `router.post('/logout', requireAuth, ...)` (line 72). `requireAuth` imported from `../../middleware/auth.js` (line 12). Middleware is correctly positioned as the second argument before the handler lambda.

#### 6. Dead exports — individual route files are never consumed by index.ts

[WARN] ARCH-REFACTOR-S4 structural drift — The 6 individual route files export renamed aliases (`registerController as registerHandler`, `loginController as loginHandler`, etc.), but `index.ts` does not import from any of them. The re-exports are dead code: nothing in the codebase consumes `registerHandler`, `loginHandler`, etc. The individual files exist but serve no functional purpose since `index.ts` imports directly from the controller. This is not a FR-ARCH-1 violation (the files contain no logic), but the pattern is misleading and the aliased exports are unused.

#### Coverage Gaps

[COVERAGE] ARCH-REFACTOR-S4 — No test statically or dynamically verifies that `index.ts` route file itself contains no response logic beyond `.catch(next)` wiring. The scenario description says "each file is reviewed" implying a static check, but there is no automated lint rule or test asserting the absence of `res.json` / `res.status` calls in route files.

[COVERAGE] FR-AUTH-5 — No test verifies the `forgotPasswordLimiter` key generator correctly uses `req.body.email` as the rate-limit key (i.e., that two requests from different IPs but the same email are counted together toward the 3/hour limit, and two requests from the same IP but different emails are counted separately).

## T7 Review -- 2026-06-26

### Audit: apps/api/src/services/notes.service.ts

#### 1. FR-ARCH-1 -- No Express types imported in service file

[OK] FR-ARCH-1 service layer constraint -- No Request, Response, NextFunction, or express import found in the file. Imports are: Prisma from @prisma/client, prisma from ../lib/prisma.js, AppError from ../middleware/errorHandler.js, typed inputs from @noteapp/shared. FRS: Services/: Business logic + all DB access via Prisma. No Express types (Request/Response). Satisfied.

#### 2. FR-NOTE-1 -- tagIds ownership validated via single findMany (no N+1)

[OK] FR-NOTE-1 if tagIds given, validates they belong to current user -- createNote issues a single prisma.tag.findMany with where: id in tagIds, userId, deletedAt null (lines 62-65). One DB round-trip validates all tagIds simultaneously. No N+1 loop. Satisfied.

#### 3. FR-NOTE-1 -- Success response shape: id, title, body, tagIds[], version (must be 1), createdAt, updatedAt

[OK] FR-NOTE-1 Success response: 201 with full note { id, title, body, tagIds, createdAt, updatedAt, version: 1 } -- NoteResponse interface (lines 6-14) declares exactly these fields. toNoteResponse maps note.tags to tagIds array. prisma.note.create selects version; model default is Int @default(1) so returned value is always 1 for a new note. All seven required fields present.

#### 4. FR-NOTE-1 -- Foreign tagId throws 422 INVALID_TAG

[OK] FR-NOTE-1 422 INVALID_TAG -- tagId not owned by user -- when ownedTags.length !== tagIds.length (line 66), AppError(422, INVALID_TAG) is thrown (line 67). Error code matches FRS exactly.

#### 5. FR-NOTE-2 -- Filter is id = noteId AND userId = userId AND deletedAt IS NULL

[OK] FR-NOTE-2 returns note only if note.userId === currentUserId AND note.deletedAt IS NULL -- assertNoteOwner (lines 39-40): prisma.note.findFirst with where id=noteId, userId, deletedAt=null. All three conditions enforced in a single WHERE clause. Satisfied.

#### 6. FR-NOTE-2 -- Non-owner or soft-deleted both throw 404 NOTE_NOT_FOUND (not 403)

[OK] FR-NOTE-2 404 NOTE_NOT_FOUND -- note does not exist, belongs to another user, OR is soft-deleted -- assertNoteOwner throws AppError(404, NOTE_NOT_FOUND) (line 51) when findFirst returns null. WHERE clause includes userId so a note owned by another user returns null, giving 404, never 403. FRS: never 403 -- do not leak existence. Satisfied.

#### 7. FR-NOTE-3 -- Uses prisma.$transaction for snapshot + update

[OK] FR-NOTE-3 In a single Prisma transaction / Atomicity: snapshot + update MUST be one transaction -- updateNote wraps both operations in prisma.$transaction(async (tx) => { ... }) (line 119). Both tx.noteVersion.create (line 120) and tx.note.update (line 129) use the tx client, not the global prisma. Atomicity guaranteed.

#### 8. FR-NOTE-3 -- Snapshot captures PRE-update values (version, title, body)

[OK] FR-NOTE-3 Snapshot current state into NoteVersion table (preserves old title, body, version number, savedAt) -- snapshot (lines 120-127) reads from existing -- result of assertNoteOwner called before the transaction begins (line 107). Values are existing.version, existing.title, existing.body -- all pre-mutation. tx.note.update runs second (line 129), so snapshot always reflects pre-change state. Satisfied.

#### 9. FR-NOTE-3 -- Note version increments by 1 ({ increment: 1 })

[OK] FR-NOTE-3 increment version number / every save increments version by exactly 1 -- tx.note.update data contains version: { increment: 1 } (line 134). Prisma generates a single atomic SET version = version + 1. Satisfied.

#### 10. FR-NOTE-3 -- tagIds replace semantics: deleteMany: {} + create: [...] within same transaction

[OK] FR-NOTE-3 / spec.md decision 6 tagIds replaces entire tag set on PATCH within the same transaction -- when data.tagIds !== undefined, tags nested operation (lines 135-139) applies deleteMany: {} (removes all existing NoteTag rows) then create: data.tagIds.map(...) inside tx.note.update inside prisma.$transaction. Satisfied.

#### 11. FR-NOTE-3 -- Missing title/body fields (undefined) are not written to DB

[OK] FR-NOTE-3 / spec.md decision 5 Only fields present in the request body are updated -- conditional spread on data.title and data.body (lines 132-133). When undefined, spread evaluates to false and adds nothing. Prisma does not write absent fields. Satisfied.

#### 12. FR-NOTE-4 -- Sets deletedAt = new Date() only; does NOT physically delete

[OK] FR-NOTE-4 sets deletedAt = now. MUST NOT physically delete -- deleteNote calls prisma.note.update with data: { deletedAt: new Date() } (lines 159-162). This is an UPDATE statement, never a DELETE. Row remains in DB with deletedAt set.

#### 13. FR-NOTE-4 -- No prisma.note.delete() call possible

[OK] FR-NOTE-4 no DELETE FROM SQL is ever generated by Prisma for notes within recovery window -- grep for prisma.note.delete returns zero matches. Only note-model mutations are prisma.note.update (in deleteNote) and prisma.note.create (in createNote). Physical deletion not reachable.

#### 14. spec.md decision 7 -- assertNoteOwner uses WHERE userId = userId (never leaks existence via 403)

[OK] spec.md decision 7 The service layer must apply WHERE userId = currentUserId before returning any error -- assertNoteOwner uses { id: noteId, userId, deletedAt: null } in a single findFirst call. No prior lookup by id alone exists. Wrong-owner and non-existent both return null giving 404 NOTE_NOT_FOUND. No 403 possible. Satisfied.

#### Coverage Gaps

[COVERAGE] FR-NOTE-1 createNote -- no test for NOTE-CREATE-S1 (happy path no tags): verify 201, version: 1, all seven fields, userId = authenticated user.

[COVERAGE] FR-NOTE-1 createNote -- no test for NOTE-CREATE-S2 (valid owned tagIds): verify returned tagIds contains the given tag ID.

[COVERAGE] FR-NOTE-1 createNote -- no test for NOTE-CREATE-S3 (foreign tagId): verify 422 INVALID_TAG when tagId belongs to another user.

[COVERAGE] FR-NOTE-2 getNoteById -- no test for NOTE-READ-S1 (happy path): verify 200 with full note shape.

[COVERAGE] FR-NOTE-2 getNoteById -- no test for NOTE-READ-S2 (cross-user access): verify 404 NOTE_NOT_FOUND (not 403) when note owned by a different user.

[COVERAGE] FR-NOTE-2 getNoteById -- no test for NOTE-READ-S3 (soft-deleted note): verify 404 NOTE_NOT_FOUND when deletedAt is set.

[COVERAGE] FR-NOTE-3 updateNote -- no test for NOTE-UPDATE-S1 (version increment): verify version goes 1 to 2 and updated fields reflected.

[COVERAGE] FR-NOTE-3 updateNote -- no test for NOTE-UPDATE-S2 (snapshot precedes update): verify NoteVersion row has pre-update version: 1 and original title.

[COVERAGE] FR-NOTE-3 updateNote -- no test for NOTE-UPDATE-S3 (atomicity): verify full rollback on mid-transaction failure.

[COVERAGE] FR-NOTE-3 updateNote -- no test for partial-update semantics (spec.md decision 5): verify PATCH with only title leaves body and tagIds unchanged.

[COVERAGE] FR-NOTE-3 updateNote -- no test for tagIds: [] replace semantics: verify all existing NoteTag rows deleted and none created.

[COVERAGE] FR-NOTE-4 deleteNote -- no test for NOTE-DELETE-S1: verify 204 and deletedAt set to a non-null timestamp.

[COVERAGE] FR-NOTE-4 deleteNote -- no test for NOTE-DELETE-S2: verify subsequent GET /notes/:id returns 404 after soft delete.

## T8 Review — 2026-06-26

### Audit: apps/api/src/controllers/notes.controller.ts

#### FR-ARCH-1 — Controller constraints

[OK] FR-ARCH-1 "Controller file calls prisma.* directly or imports @prisma/client" — No `@prisma/client` import is present. Line 2 imports from `@noteapp/shared`; line 3 from `../middleware/errorHandler.js`; lines 4-9 from `../services/notes.service.js`. Zero Prisma imports in the controller file.

[OK] FR-ARCH-1 "No service-layer logic (no Prisma calls, no business rules) in controller" — The file contains no Prisma calls and no business rules. Every function body follows exactly: Zod parse → call service function → res.json. All business logic (tag ownership check, soft-delete guard, snapshot, etc.) lives in the service layer.

[OK] FR-ARCH-1 "Pattern is: Zod validate → call service → res.json() only" — All four handlers follow this exact pattern. `createNoteController` (lines 11-20), `updateNoteController` (lines 29-39) Zod-validate first. `getNoteController` (lines 22-27) and `deleteNoteController` (lines 41-46) have no body to validate and go straight to service call + res.

#### FR-NOTE-1 — createNoteController

[OK] FR-NOTE-1 "Uses createNoteSchema.safeParse" — Line 13: `createNoteSchema.safeParse(req.body)`. Schema imported from `@noteapp/shared` (line 2). Satisfies FR-NOTE-1 "Validation: body { title: string (1-200 chars), body: TipTap JSON object, tagIds?: string[] }".

[OK] FR-NOTE-1 "On validation failure throws AppError(400, 'VALIDATION_FAILED', ...)" — Lines 14-17: `if (!result.success) { const detail = result.error.issues[0]?.message ?? 'Invalid input'; throw new AppError(400, 'VALIDATION_FAILED', detail); }`. Satisfies FR-NOTE-1 "400 VALIDATION_FAILED — bad shape".

[OK] FR-NOTE-1 "On success returns status 201 with note body" — Line 19: `res.status(201).json(note)`. Satisfies FR-NOTE-1 "Success response: 201 with full note { id, title, body, tagIds, createdAt, updatedAt, version: 1 }". Shape delegated to service (verified in T7 review).

[OK] FR-NOTE-1 "userId sourced from res.locals['userId'] (not req.body or req.params)" — Line 12: `const userId = res.locals['userId'] as string;`. Not read from req.body or req.params. Satisfies FR-NOTE-1 "creates note with userId = current user".

#### FR-NOTE-2 — getNoteController

[OK] FR-NOTE-2 "Gets noteId from req.params['id']" — Line 24: `const noteId = req.params['id'] as string;`. Correct path parameter extraction.

[OK] FR-NOTE-2 "Returns status 200 with note body" — Line 26: `res.status(200).json(note)`. Satisfies FR-NOTE-2 "Success response: 200 with note".

[OK] FR-NOTE-2 "userId passed to service to enforce ownership" — Line 25: `getNoteById(userId, noteId)` passes both userId (from res.locals) and noteId to the service. The service (verified T7 review) enforces `WHERE userId = currentUserId AND deletedAt IS NULL`, ensuring cross-user reads return 404 and not 403.

#### FR-NOTE-3 — updateNoteController

[OK] FR-NOTE-3 "Uses updateNoteSchema.safeParse" — Line 32: `updateNoteSchema.safeParse(req.body)`. Schema imported from `@noteapp/shared` (line 2). Satisfies FR-NOTE-3 "Validation: body { title?, body?, tagIds? }".

[OK] FR-NOTE-3 "On validation failure throws AppError(400, 'VALIDATION_FAILED', ...)" — Lines 33-36: same pattern as createNoteController. Satisfies FR-NOTE-3 "400 VALIDATION_FAILED".

[OK] FR-NOTE-3 "Returns status 200 with updated note" — Line 38: `res.status(200).json(note)`. Satisfies FR-NOTE-3 "Success response: 200 with updated note (new version)".

#### FR-NOTE-4 — deleteNoteController

[OK] FR-NOTE-4 "Returns status 204 with no body (res.status(204).end())" — Line 45: `res.status(204).end()`. Satisfies FR-NOTE-4 "Success response: 204 No Content".

[OK] FR-NOTE-4 "No response body on delete" — `res.status(204).end()` is used (not `res.json()`), so no body is set. Satisfies the 204 No Content contract.

#### delta-openapi.yaml contract — Status codes

[OK] delta-openapi.yaml contract — POST /notes → 201: controller returns `res.status(201)`. Matches `"201": description: Note created` in delta-openapi.yaml.

[OK] delta-openapi.yaml contract — GET /notes/:id → 200: controller returns `res.status(200)`. Matches `"200": description: Note found` in delta-openapi.yaml.

[OK] delta-openapi.yaml contract — PATCH /notes/:id → 200: controller returns `res.status(200)`. Matches `"200": description: Note updated` in delta-openapi.yaml.

[OK] delta-openapi.yaml contract — DELETE /notes/:id → 204: controller returns `res.status(204)`. Matches `"204": description: Note soft-deleted` in delta-openapi.yaml.

#### Coverage Gaps

[COVERAGE] FR-NOTE-1 createNoteController — no controller-layer unit test verifying that when `createNoteSchema.safeParse` fails the controller throws AppError(400, 'VALIDATION_FAILED') before calling the service (service should not be called on invalid input).

[COVERAGE] FR-NOTE-3 updateNoteController — no controller-layer unit test verifying that when `updateNoteSchema.safeParse` fails (including empty body rejected by .refine) the controller throws AppError(400, 'VALIDATION_FAILED') and the service is not invoked.

[COVERAGE] FR-NOTE-2 getNoteController — no unit test verifying that `userId` is read from `res.locals['userId']` and NOT from `req.body` or `req.params` (regression guard for accidental userId source drift).

[COVERAGE] FR-NOTE-4 deleteNoteController — no test verifying the response has no body (Content-Length: 0 or no JSON payload) when 204 is returned.

## T9 Review — 2026-06-26

### Audit: apps/api/src/routes/notes.ts + apps/api/src/index.ts (FR-ARCH-1, FR-NOTE-1..4)

#### FR-ARCH-1 — Route file constraints (notes.ts)

[OK] FR-ARCH-1 "routes/: Express router registration + .catch(next) only. No business logic, no Prisma." — No Zod validation logic in routes/notes.ts. The file imports only Router, requireAuth, and four controllers. No Zod schema, no safeParse call, no validation code of any kind.

[OK] FR-ARCH-1 "[FAIL] trigger: Route file contains any logic beyond router registration and .catch(next) wiring" — No response shaping in routes/notes.ts. No res.json, no res.status call appears anywhere in the file. The only invocations of req/res/next are in the arrow-function wrapper `(req, res, next) => { controller(req, res).catch(next); }`.

[OK] FR-ARCH-1 "[FAIL] trigger: Route file contains any logic beyond router registration and .catch(next) wiring" — No business logic and no Prisma calls in routes/notes.ts. No prisma import, no DB access, no conditional logic, no data transformation.

[OK] FR-ARCH-1 "routes/: Express router registration + .catch(next) only" — All four handlers use the .catch(next) pattern. Line 14-16: `router.post('/', (req, res, next) => { createNoteController(req, res).catch(next); })`. Lines 18-28 follow the same pattern for get, patch, delete. Every registered handler propagates async errors to next.

[OK] FR-ARCH-1 / FR-NOTE-1..4 "Auth: requires access token" — `router.use(requireAuth)` at line 12 is applied to the entire router before any route is registered. All four endpoints (POST /, GET /:id, PATCH /:id, DELETE /:id) inherit the requireAuth guard. No unauthenticated endpoint is exposed.

#### Route paths vs delta-openapi.yaml

[OK] delta-openapi.yaml `POST /notes` → `createNoteController` — `router.post('/')` at line 14 maps to POST /notes (relative to router mount). Handler calls createNoteController. Matches delta-openapi.yaml `paths: /notes: post:`.

[OK] delta-openapi.yaml `GET /notes/{id}` → `getNoteController` — `router.get('/:id')` at line 18 maps to GET /notes/:id. Handler calls getNoteController. Matches delta-openapi.yaml `paths: /notes/{id}: get:`.

[OK] delta-openapi.yaml `PATCH /notes/{id}` → `updateNoteController` — `router.patch('/:id')` at line 22 maps to PATCH /notes/:id. Handler calls updateNoteController. Matches delta-openapi.yaml `paths: /notes/{id}: patch:`.

[OK] delta-openapi.yaml `DELETE /notes/{id}` → `deleteNoteController` — `router.delete('/:id')` at line 26 maps to DELETE /notes/:id. Handler calls deleteNoteController. Matches delta-openapi.yaml `paths: /notes/{id}: delete:`.

#### app mount: apps/api/src/index.ts

[OK] index.ts — notesRouter mounted at /notes: Line 18: `app.use('/notes', notesRouter)`. Import at line 5: `import notesRouter from './routes/notes.js'`. Mount path matches all four delta-openapi.yaml paths and FR-NOTE-1..4 endpoint definitions.

[OK] index.ts — errorHandler is the last middleware: Line 20: `app.use(errorHandler)` appears after `app.use('/notes', notesRouter)` (line 18) and `app.use('/auth', authRouter)` (line 17). errorHandler is registered last in the middleware chain as required.

#### Coverage Gaps

[COVERAGE] FR-NOTE-1..4 routes/notes.ts — No test verifies that all four routes are guarded by requireAuth (e.g., a request with no Authorization header to any of POST /, GET /:id, PATCH /:id, DELETE /:id returns 401 AUTH_TOKEN_INVALID). The router.use(requireAuth) guard is correct but has no automated integration-level regression test at the routing layer.

[COVERAGE] FR-ARCH-1 ARCH-REFACTOR-S4 — No static or lint check verifies that routes/notes.ts contains no res.json or res.status calls. A future change adding response logic to the route file would not be caught automatically.
