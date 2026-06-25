# Review Log — AB-1002

## 2026-06-25T00:00:00Z -- Task T6

### Scope: register handler audit (FR-AUTH-1) — apps/api/src/routes/auth/register.ts

[OK] FR-AUTH-1 Endpoint — POST /auth/register: handler is exported as `registerHandler`; the function signature accepts Request/Response and is structured as an Express route handler ready to be mounted at POST /auth/register. Endpoint path and method match the FRS.

[FAIL] FR-AUTH-1 Endpoint not mounted — the handler `registerHandler` is never imported or mounted in `apps/api/src/index.ts`. The index.ts only contains a GET /health route and no auth router. The POST /auth/register endpoint therefore does not exist at runtime.
  FRS text: "Endpoint: POST /auth/register"
  Observed index.ts: `app.get('/health', (_req, res) => { res.status(200).json({ status: 'ok' }) })` — no auth routes registered at all.

[OK] FR-AUTH-1 Validation — email valid format: registerSchema in packages/shared uses `z.string().email()` which enforces valid email format. Satisfies FRS sub-bullet "email: valid format".

[OK] FR-AUTH-1 Validation — email max 255 chars: registerSchema uses `.max(255)`. Satisfies FRS sub-bullet "email: ... max 255 chars".

[OK] FR-AUTH-1 Validation — password min 8 chars: registerSchema uses `z.string().min(8)`. Satisfies FRS sub-bullet "password: min 8 chars".

[OK] FR-AUTH-1 Validation — password must contain at least 1 number: registerSchema uses `.regex(/\d/, 'password must contain at least 1 number')`. Satisfies FRS sub-bullet "must contain at least 1 number".

[OK] FR-AUTH-1 Behavior — bcrypt rounds ≥ 12: `BCRYPT_ROUNDS = 12` constant is defined and passed to `bcrypt.hash(password, BCRYPT_ROUNDS)`. Exactly meets FRS minimum.

[OK] FR-AUTH-1 Behavior — store user: `prisma.user.create({ data: { email, passwordHash } })` stores the user in the database.

[OK] FR-AUTH-1 Success response — 201 status: `res.status(201).json(user)` returns HTTP 201.

[OK] FR-AUTH-1 Success response — shape { id, email, createdAt }: Prisma select clause is `{ id: true, email: true, createdAt: true }`. Only those three fields are selected and returned. FRS requires `{ id, email, createdAt }`.

[OK] FR-AUTH-1 Security — passwordHash excluded from response: The Prisma `select` explicitly lists only `id`, `email`, `createdAt`. `passwordHash` is not in the select and therefore never appears in any response path.

[OK] FR-AUTH-1 Error — 400 VALIDATION_FAILED: `throw new AppError(400, 'VALIDATION_FAILED', detail)` is called when `registerSchema.safeParse` fails. Error code string matches FRS exactly.

[OK] FR-AUTH-1 Error — 409 USER_EXISTS: `throw new AppError(409, 'USER_EXISTS', ...)` is thrown when Prisma raises a P2002 unique constraint violation (duplicate email). Error code string matches FRS exactly.

[FAIL] FR-AUTH-1 Error — 429 RATE_LIMITED / Rate limit 3/hour per IP: No rate limiting middleware is applied anywhere in the codebase for the register endpoint. There is no import of `express-rate-limit` or any equivalent in register.ts, index.ts, or any discovered middleware file. The 429 RATE_LIMITED error path is entirely absent.
  FRS text: "429 RATE_LIMITED — exceeded 3/hour per IP" and "Rate limit: 3/hour per IP"
  Observed: no rate limit middleware exists or is wired to this route. The only middleware files found are `errorHandler.ts` and `auth.ts`; neither applies rate limiting. spec.md decision 6 confirms this was not deferred — it states "Rate limiting via express-rate-limit: /auth/register: 3/hour per IP".

[COVERAGE] FR-AUTH-1 AUTH-REGISTER-S1 (happy path): No test file exists for the register handler. The only test file found is `apps/api/src/__tests__/infra.test.ts` which covers FR-INFRA-* scenarios only. There is no test covering scenario AUTH-REGISTER-S1 (201, correct shape, passwordHash absent from response, bcrypt round-trip).

[COVERAGE] FR-AUTH-1 AUTH-REGISTER-S2 (invalid input → 400 VALIDATION_FAILED): No test file covers this scenario.

[COVERAGE] FR-AUTH-1 AUTH-REGISTER-S3 (duplicate email → 409 USER_EXISTS): No test file covers this scenario.

[COVERAGE] FR-AUTH-1 AUTH-REGISTER-S4 (4th request from same IP → 429 RATE_LIMITED): No test file covers this scenario. Additionally, the implementation itself is absent (see FAIL above), so coverage is impossible until the rate limit is wired.

## T7 -- Login handler -- 2026-06-25

### Scope: login handler audit (FR-AUTH-2) -- apps/api/src/routes/auth/login.ts

[FAIL] FR-AUTH-2 Endpoint not mounted -- loginHandler is exported from login.ts but never imported or registered in apps/api/src/index.ts. index.ts only mounts GET /health; no auth router exists. POST /auth/login does not exist at runtime.
  FRS text: Endpoint: POST /auth/login
  Observed index.ts: app.get('/health', ...) -- no auth routes at all.

[OK] FR-AUTH-2 Endpoint method -- POST: loginHandler accepts (Request, Response) and is intended for POST /auth/login, consistent with the FRS method requirement.

[OK] FR-AUTH-2 Validation -- email valid format + max 255 chars: loginSchema uses z.string().email().max(255), identical to registerSchema. Satisfies FRS sub-bullet: email: valid format, max 255 chars.

[OK] FR-AUTH-2 Validation -- password min 8 chars + at least 1 digit: loginSchema uses z.string().min(8).regex. Structurally identical to registerSchema as FRS requires (same rules as register). Satisfies FRS sub-bullet: password: min 8 chars, must contain at least 1 number.

[OK] FR-AUTH-2 Behavior -- look up user by email: prisma.user.findUnique({ where: { email } }) is called. Satisfies FRS sub-bullet: Look up user by email.

[OK] FR-AUTH-2 Behavior -- verify password with bcrypt: bcrypt.compare(password, hash) is always awaited. Satisfies FRS sub-bullet: verify password with bcrypt.

[OK] FR-AUTH-2 Behavior -- no account-existence leak: Both wrong-password (!passwordMatch) and unknown-email (!user) paths collapse into a single if (!user || !passwordMatch) branch throwing AppError(401, AUTH_INVALID_CREDENTIALS, Invalid email or password). Error code, HTTP status, and detail are identical across both paths. Satisfies FRS sub-bullet: never leak account existence.

[OK] FR-AUTH-2 Behavior -- timing-safe bcrypt even when email not found: DUMMY_HASH = bcrypt.hashSync(__sentinel__, 12) is pre-computed at module load. When user is null, hash = user?.passwordHash ?? DUMMY_HASH ensures bcrypt.compare is still awaited, equalizing timing. Satisfies FRS acceptance criterion: no account-existence leak in either error path.

[OK] FR-AUTH-2 On success -- generate JWT access token: signAccessToken(user.id) calls jwt.sign({ sub: userId }, getSecret(), { expiresIn: 15m }). JWT_SECRET is read from process.env and throws if absent; never hardcoded. Satisfies FRS sub-bullet: generate JWT access token (exp 15 min, signed with JWT_SECRET from env).

[OK] FR-AUTH-2 On success -- opaque 64-char refresh token: crypto.randomBytes(32).toString('hex') produces exactly 64 hex characters (32 bytes x 2 = 64). Constant is commented 32 bytes -> 64-char hex token. Satisfies FRS sub-bullet: opaque 64-char refresh token.

[OK] FR-AUTH-2 On success -- persist refresh token in DB with correct shape: prisma.refreshToken.create({ data: { userId, token, expiresAt } }) is called. Prisma schema declares revokedAt DateTime? (nullable), so omitting it stores NULL -- equivalent to revokedAt: null. Satisfies FRS sub-bullet: Persist refresh token in DB with { userId, token, expiresAt, revokedAt: null }.

[OK] FR-AUTH-2 On success -- expiresAt = now + 7 days: new Date(Date.now() + 7*24*60*60*1000). Satisfies FRS sub-bullet: Refresh token expires in 7 days.

[OK] FR-AUTH-2 On success -- refresh token via httpOnly cookie NOT in response body (spec amendment decision 1): setRefreshCookie() sets httpOnly:true, sameSite:strict, path:/auth, maxAge:604800000, secure only in production. refreshToken absent from JSON body. Matches spec.md decision 1 exactly.

[OK] FR-AUTH-2 Success response -- 200 status: res.status(200).json(...) returns HTTP 200. Satisfies FRS sub-bullet: Success response: 200.

[FAIL] FR-AUTH-2 FRS not updated after spec amendment -- success response body still lists refreshToken: FRS FR-AUTH-2 states Success response: 200 with { accessToken, refreshToken, user: { id, email } } but spec.md decision 1 approved removing refreshToken from body. Code correctly omits it. FRS must be amended to match the approved spec decision or future audits will incorrectly flag the code.
  FRS text: Success response: 200 with { accessToken, refreshToken, user: { id, email } }
  spec.md decision 1: FR-AUTH-2: remove refreshToken from success response body
  Observed code: res.status(200).json({ accessToken, user: { id: user.id, email: user.email } }) -- no refreshToken in body.

[OK] FR-AUTH-2 Error -- 400 VALIDATION_FAILED: AppError(400, VALIDATION_FAILED, detail) thrown on loginSchema.safeParse failure. Matches FRS error code exactly.

[OK] FR-AUTH-2 Error -- 401 AUTH_INVALID_CREDENTIALS (wrong password): if (!user || !passwordMatch) throws AppError(401, AUTH_INVALID_CREDENTIALS). Satisfies FRS sub-bullet: wrong password.

[OK] FR-AUTH-2 Error -- 401 AUTH_INVALID_CREDENTIALS (unknown email): same branch covers unknown-email path with identical response. Satisfies FRS sub-bullet: unknown email (same code; never leak account existence).

[FAIL] FR-AUTH-2 Rate limit -- 5/min per IP not implemented: No rate limiting middleware anywhere in the codebase. No express-rate-limit or equivalent imported in login.ts, index.ts, or any middleware file. 429 RATE_LIMITED error path entirely absent. spec.md decision 6 confirms not deferred: /auth/login: 5/min per IP.
  FRS text: 429 RATE_LIMITED -- exceeded 5/min per IP and Rate limit: 5/min per IP
  Observed: no rate limit middleware. Only middleware files are errorHandler.ts and auth.ts; neither applies rate limiting.

[COVERAGE] FR-AUTH-2 AUTH-LOGIN-S1 (happy path -- 200, accessToken, Set-Cookie httpOnly, DB RefreshToken row revokedAt null): No login test file exists. Only test files are infra.test.ts and auth.register.test.ts.

[COVERAGE] FR-AUTH-2 AUTH-LOGIN-S2 (wrong password -> 401 AUTH_INVALID_CREDENTIALS): No test covers this scenario.

[COVERAGE] FR-AUTH-2 AUTH-LOGIN-S3 (unknown email -> 401 AUTH_INVALID_CREDENTIALS, body shape identical to S2): No test covers this. Identical-shape no-leak guarantee cannot be machine-verified without a test asserting both paths return the same error body.

[COVERAGE] FR-AUTH-2 AUTH-LOGIN-S4 (6th request from same IP -> 429 RATE_LIMITED): No test covers this. Rate limit implementation also absent.

[COVERAGE] FR-AUTH-2 timing-attack prevention (DUMMY_HASH branch invoked when user is null, per FRS acceptance criterion no account-existence leak in either error path): No test asserts DUMMY_HASH is used when user is null or that timing is equalized across paths.

## T8 -- Refresh handler -- 2026-06-25

### Scope: refresh handler audit (FR-AUTH-3) -- apps/api/src/routes/auth/refresh.ts

[FAIL] FR-AUTH-3 Endpoint not mounted -- refreshHandler is exported from refresh.ts but never imported or registered in apps/api/src/index.ts. index.ts only mounts GET /health; no auth router exists. POST /auth/refresh does not exist at runtime.
  FRS text: "Endpoint: POST /auth/refresh"
  Observed index.ts: app.get('/health', ...) -- no auth routes at all.

[OK] FR-AUTH-3 Endpoint method -- POST: refreshHandler is structured as an Express route handler intended for POST /auth/refresh, consistent with the FRS method requirement.

[OK] FR-AUTH-3 Validation -- reads refreshToken httpOnly cookie (amended): handler reads req.cookies['refreshToken'] on line 12. The amended FRS (and spec.md decision 1/2) requires cookie-based validation with no body. Code satisfies this exactly. FRS text: "Validation: refreshToken httpOnly cookie (sent automatically by browser; no request body needed)"

[OK] FR-AUTH-3 Behavior -- look up refresh token in DB: prisma.refreshToken.findUnique({ where: { token: incomingToken } }) is called on lines 17-19. Satisfies FRS sub-bullet: "Look up refresh token in DB".

[OK] FR-AUTH-3 Behavior -- reject if expired (expiresAt < new Date()): line 21 evaluates existing.expiresAt < new Date() as part of the compound rejection guard. Satisfies FRS sub-bullet: "Reject if expired".

[OK] FR-AUTH-3 Behavior -- reject if revoked (revokedAt !== null): line 21 checks existing.revokedAt !== null. Satisfies FRS sub-bullet: "Reject if ... revoked".

[OK] FR-AUTH-3 Behavior -- reject if unknown (missing from DB): line 21 checks !existing first in the compound condition. Satisfies FRS sub-bullet: "Reject if ... unknown".

[OK] FR-AUTH-3 Atomicity -- rotation is a single Prisma transaction: lines 28-36 use prisma.$transaction([...]) containing both the update and create operations. Satisfies FRS: "Atomicity: rotation MUST be a single Prisma transaction".

[OK] FR-AUTH-3 Transaction contents -- marks old token revokedAt = now: inside the transaction on lines 29-32, prisma.refreshToken.update sets data: { revokedAt: new Date() } on the old token's id. Satisfies FRS sub-bullet: "mark old token revokedAt = now".

[OK] FR-AUTH-3 Transaction contents -- creates new token row in same transaction: inside the same prisma.$transaction call on lines 33-35, prisma.refreshToken.create is called with { userId, token: newToken, expiresAt }. Both operations are co-located in one transaction array. Satisfies FRS sub-bullet: "issue new pair" (new token DB row).

[FAIL] FR-AUTH-3 Success response body contains refreshToken: FRS states "Success response: 200 with { accessToken, refreshToken }". The code on line 40 responds with res.status(200).json({ accessToken }) -- only accessToken, no refreshToken in the body. However, the amended FRS (spec.md decision 1) requires cookie-only delivery and removal of refreshToken from body. The FRS text has NOT been updated to reflect the approved amendment; FRS and code are out of sync. The code behaviour matches the spec amendment (correct), but the FRS literal text still says refreshToken should appear in the body.
  FRS text: "Success response: 200 with { accessToken, refreshToken }"
  spec.md decision 1: "FR-AUTH-2: remove refreshToken from success response body" (by extension FR-AUTH-3 also amended per spec.md and ticket decision 2)
  Observed code: res.status(200).json({ accessToken }) -- no refreshToken in body.
  This is a documentation drift: FRS must be updated to match the approved amendment. The code is correct per spec; the FRS literal is stale.

[OK] FR-AUTH-3 Success response -- 200 status: res.status(200).json({ accessToken }) returns HTTP 200 as required.

[OK] FR-AUTH-3 New httpOnly cookie set: setRefreshCookie(res, newToken) is called on line 39, which sets httpOnly:true, sameSite:strict, path:/auth, maxAge:604800000, secure in production. Satisfies FRS amended requirement for cookie rotation.

[OK] FR-AUTH-3 Error 401 AUTH_REFRESH_INVALID -- expired path: line 21's expiresAt check feeds into AppError(401, 'AUTH_REFRESH_INVALID', ...) on line 22. Satisfies FRS: "401 AUTH_REFRESH_INVALID -- expired".

[OK] FR-AUTH-3 Error 401 AUTH_REFRESH_INVALID -- revoked path: line 21's revokedAt check feeds into AppError(401, 'AUTH_REFRESH_INVALID', ...) on line 22. Satisfies FRS: "401 AUTH_REFRESH_INVALID -- revoked".

[OK] FR-AUTH-3 Error 401 AUTH_REFRESH_INVALID -- unknown token path: line 21's !existing check feeds into AppError(401, 'AUTH_REFRESH_INVALID', ...) on line 22. All three rejection reasons produce the same error code with no distinction exposed to the caller. Satisfies FRS sub-bullet: "expired, revoked, or unknown token".

[FAIL] FR-AUTH-3 Error for missing cookie is 401, not 400 as FRS states: when the cookie is absent, line 13-15 throws AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is missing'). The current FRS text states "400 VALIDATION_FAILED -- missing refreshToken". Code uses 401 AUTH_REFRESH_INVALID. However, spec.md scenario AUTH-REFRESH-S3 ("Missing / expired / unknown cookie -- Then 401 AUTH_REFRESH_INVALID (all three paths; no distinction exposed)") makes clear that missing cookie should return 401, not 400. FRS literal contradicts the spec scenario.
  FRS text: "400 VALIDATION_FAILED -- missing refreshToken"
  spec.md AUTH-REFRESH-S3: "Given no cookie ... Then 401 AUTH_REFRESH_INVALID (all three paths; no distinction exposed)"
  Observed code: AppError(401, 'AUTH_REFRESH_INVALID', 'Refresh token is missing')
  The code matches the spec scenario. The FRS text must be amended: remove the 400 VALIDATION_FAILED bullet under FR-AUTH-3 and consolidate missing-cookie into the 401 AUTH_REFRESH_INVALID path.

[WARN] FR-AUTH-3 Rate limit deferred -- no rate limiting on POST /auth/refresh: No rate limit middleware is applied to this endpoint. FRS does not explicitly specify a rate limit for /auth/refresh (unlike /auth/login and /auth/register which have explicit limits). SDS.md also omits /auth/refresh from the rate limit table. This is acceptable as deferred to T10 per task plan, but it means unrestricted token refresh is possible in the interim. Noting for completeness; not a FAIL since FRS does not mandate a specific limit for this endpoint.

[COVERAGE] FR-AUTH-3 AUTH-REFRESH-S1 (happy path -- rotation in single transaction, old revokedAt set, new Set-Cookie, 200 { accessToken }): No test file exists for the refresh handler. apps/api/src/__tests__/ contains only infra.test.ts, auth.register.test.ts, and auth.login.test.ts. FRS acceptance: "scenarios AUTH-REFRESH-S1..S3 pass; rotation transaction confirmed in tests".

[COVERAGE] FR-AUTH-3 AUTH-REFRESH-S2 (reused/revoked token -> 401 AUTH_REFRESH_INVALID): No test covers this scenario. FRS acceptance: "reused old token returns 401".

[COVERAGE] FR-AUTH-3 AUTH-REFRESH-S3 (missing cookie / expired token / unknown token -- all return 401 AUTH_REFRESH_INVALID, no distinction): No test covers any of these three paths. FRS acceptance: "scenarios AUTH-REFRESH-S1..S3 pass".

[COVERAGE] FR-AUTH-3 Atomicity -- rotation transaction confirmed in tests: FRS acceptance explicitly requires "rotation transaction confirmed in tests". No such test exists. A unit/integration test asserting both DB writes occur within a single transaction is required.

## T9 -- Logout handler -- 2026-06-25

### Scope: logout handler audit (FR-AUTH-4) -- apps/api/src/routes/auth/logout.ts

[OK] FR-AUTH-4 sub-bullet "Endpoint: POST /auth/logout" (mounting status): logoutHandler is exported and ready to be mounted. No auth router exists yet in apps/api/src/index.ts; this is consistent with the task plan (router wiring is deferred to T10). Per audit brief instructions this is noted, not flagged as FAIL.

[OK] FR-AUTH-4 sub-bullet "Auth: requires valid access token" -- correct separation: logoutHandler contains zero auth logic. It does not inspect Authorization headers or call verifyAccessToken. The requireAuth middleware in apps/api/src/middleware/auth.ts handles Bearer-token validation and will be wired at the router level in T10. The handler correctly delegates auth enforcement to middleware; separation of concerns is intact.

[OK] FR-AUTH-4 sub-bullet "Validation: refreshToken httpOnly cookie": handler reads req.cookies['refreshToken'] on line 6. This satisfies the amended FRS sub-bullet: "Validation: refreshToken httpOnly cookie (sent automatically by browser; no request body needed)". No request body parsing is attempted.

[OK] FR-AUTH-4 sub-bullet "missing refreshToken cookie -> 204 No Content (idempotent)": lines 7-10 check `if (!token)` and immediately respond with res.status(204).send(). FRS text (post FB-2): "missing refreshToken cookie -> 204 No Content (idempotent)". Code matches exactly.

[OK] FR-AUTH-4 sub-bullet "token not found in DB -> 204 (idempotent)": lines 12-18 call prisma.refreshToken.findUnique and evaluate `if (!existing || existing.revokedAt !== null)`. The `!existing` branch covers the "token not found in DB" case and returns res.status(204).send(). Satisfies the idempotency requirement for unknown tokens.

[OK] FR-AUTH-4 sub-bullet "token already revoked (revokedAt !== null) -> 204 (idempotent)": the same compound condition on line 16 covers `existing.revokedAt !== null` and returns res.status(204).send(). FRS text: "Idempotent -- already-revoked token still returns success." and "logout of already-revoked token returns 204". Code matches exactly.

[OK] FR-AUTH-4 sub-bullet "valid unrevoked token -> sets revokedAt = now via prisma.refreshToken.update": lines 21-24 call prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }). Only reached when `existing` is non-null AND `existing.revokedAt === null`. This is the correct happy-path revocation. Satisfies FRS sub-bullet: "sets revokedAt = now on the given refresh token".

[OK] FR-AUTH-4 sub-bullet "calls clearRefreshCookie on success": line 25 calls clearRefreshCookie(res) after the prisma update and before sending 204. clearRefreshCookie in apps/api/src/lib/cookie.ts sets the cookie to empty string with maxAge:0, correctly expiring it. Satisfies FRS: "success response clears cookie (Max-Age=0)" (from spec.md AUTH-LOGOUT-S1).

[OK] FR-AUTH-4 sub-bullet "Success response: 204 No Content": line 26 sends res.status(204).send(). All exit paths (missing cookie: line 8, not found/revoked: line 17, success: line 26) return 204. No response body is ever sent. Satisfies FRS: "Success response: 204 No Content".

[OK] FR-AUTH-4 sub-bullet "Errors: 401 AUTH_TOKEN_INVALID -- handled by requireAuth middleware (not in handler itself)": logoutHandler never throws AppError(401, ...) or any auth-related error. The 401 path is entirely the responsibility of requireAuth middleware (verified in apps/api/src/middleware/auth.ts: throws AppError(401, 'AUTH_TOKEN_INVALID', ...) when Authorization header is absent or the JWT is invalid). Correct architecture -- the handler is not expected to re-implement this.

[OK] FR-AUTH-4 sub-bullet "No rate limit specified for logout in FRS": FRS FR-AUTH-4 contains no rate limit directive. No rate limit middleware is applied in the handler. Absence is expected and correct.

[WARN] FR-AUTH-4 sub-bullet "clearRefreshCookie NOT called in the idempotent early-return paths (missing cookie, not found, already revoked)": when the cookie is absent (line 8) or the token is not found/already revoked (line 17), the handler returns 204 without calling clearRefreshCookie. FRS does not explicitly require the cookie to be cleared in idempotent paths; however, spec.md AUTH-LOGOUT-S1 states "response clears cookie (Max-Age=0)" only for the happy path. If a client sends a stale but recognisable (e.g. already-revoked) cookie, it will not be cleared from the browser. This is a minor drift from defensive behaviour but not a strict FRS violation. Main Claude should consider whether clearRefreshCookie should be called on all 204 paths for belt-and-suspenders cleanup.

[COVERAGE] FR-AUTH-4 AUTH-LOGOUT-S1 (happy path -- 204, DB revokedAt set, Set-Cookie Max-Age=0): No test file for logout exists. apps/api/src/__tests__/ contains only infra.test.ts, auth.register.test.ts, auth.login.test.ts, and auth.refresh.test.ts. FRS acceptance: "scenarios AUTH-LOGOUT-S1..S2 pass".

[COVERAGE] FR-AUTH-4 AUTH-LOGOUT-S2 (already-revoked token -> 204 idempotent): No test covers this scenario. FRS acceptance: "logout of already-revoked token returns 204".

[COVERAGE] FR-AUTH-4 missing refreshToken cookie -> 204 (idempotent, per FB-2 addition to FRS): No test covers the missing-cookie path. This is now an explicit FRS requirement post FB-2: "missing refreshToken cookie -> 204 No Content (idempotent)".

[COVERAGE] FR-AUTH-4 401 AUTH_TOKEN_INVALID (no/bad access token, enforced by requireAuth middleware): No integration test exists that exercises POST /auth/logout without a Bearer token and asserts 401 AUTH_TOKEN_INVALID. This path is owned by requireAuth but must be tested end-to-end at the route level.

## T10 — Router + app wiring — 2026-06-26

### Scope: router factory + app entry-point audit (FR-AUTH-1..4) — apps/api/src/routes/auth/index.ts, apps/api/src/index.ts, apps/api/src/middleware/errorHandler.ts, apps/api/src/middleware/auth.ts

---

**Checklist item 1 — All 4 endpoints mounted**

[OK] FR-AUTH-1 sub-bullet "Endpoint: POST /auth/register" — `router.post('/register', registerLimiter, ...)` mounts registerHandler at POST /auth/register (via the `/auth` prefix in index.ts line 16). Endpoint is reachable at runtime.

[OK] FR-AUTH-2 sub-bullet "Endpoint: POST /auth/login" — `router.post('/login', loginLimiter, ...)` mounts loginHandler at POST /auth/login. Endpoint is reachable at runtime.

[OK] FR-AUTH-3 sub-bullet "Endpoint: POST /auth/refresh" — `router.post('/refresh', ...)` mounts refreshHandler at POST /auth/refresh. No rate limit middleware applied, consistent with FRS which specifies none for this endpoint.

[OK] FR-AUTH-4 sub-bullet "Endpoint: POST /auth/logout" — `router.post('/logout', requireAuth, ...)` mounts logoutHandler at POST /auth/logout. Endpoint is reachable at runtime.

---

**Checklist item 2 — cookieParser wired before /auth router**

[OK] FR-AUTH-2/3/4 sub-bullet "Validation: refreshToken httpOnly cookie" — index.ts line 10 registers `app.use(cookieParser())` before line 16 `app.use('/auth', authRouter)`. Cookie parsing is available to all auth handlers. Order is correct.

---

**Checklist item 3 — errorHandler is last middleware**

[OK] FR-AUTH-1..4 (error response shapes) — index.ts line 18 `app.use(errorHandler)` is the last `app.use(...)` call, appearing after all routes and the auth router. Express will only call this 4-arg error handler when a route calls `next(err)`. Order is correct.

---

**Checklist item 4 — Register rate limit: windowMs=3600000, limit=3**

[OK] FR-AUTH-1 sub-bullet "Rate limit: 3/hour per IP" — `registerLimiter` is configured with `windowMs: 60 * 60 * 1000` (= 3 600 000 ms = 1 hour) and `limit: 3`. Values match FRS exactly.

---

**Checklist item 5 — Login rate limit: windowMs=60000, limit=5**

[OK] FR-AUTH-2 sub-bullet "Rate limit: 5/min per IP" — `loginLimiter` is configured with `windowMs: 60 * 1000` (= 60 000 ms = 1 minute) and `limit: 5`. Values match FRS exactly.

---

**Checklist item 6 — Refresh: no rate limit**

[OK] FR-AUTH-3 (no rate limit specified) — `router.post('/refresh', ...)` has no rate limit middleware. FRS FR-AUTH-3 specifies no rate limit for this endpoint. Absence is intentional and correct.

---

**Checklist item 7 — Logout: no rate limit**

[OK] FR-AUTH-4 (no rate limit specified) — `router.post('/logout', requireAuth, ...)` has no rate limit middleware. FRS FR-AUTH-4 specifies no rate limit for this endpoint. Absence is intentional and correct.

---

**Checklist item 8 — requireAuth applied to logout ONLY**

[OK] FR-AUTH-4 sub-bullet "Auth: requires valid access token" — `requireAuth` is applied as the second argument to `router.post('/logout', requireAuth, ...)`. It is NOT applied to /register, /login, or /refresh routes. Exactly satisfies FRS: auth is required for logout only.

---

**Checklist item 9 — Rate limit handler returns 429 with RFC7807 shape `{ code: 'RATE_LIMITED', status: 429 }`**

[OK] FR-AUTH-1 sub-bullet "429 RATE_LIMITED" — Both `registerLimiter` and `loginLimiter` share a custom `handler` that calls `res.status(429).json(RFC7807_RATE_LIMITED)`. The `RFC7807_RATE_LIMITED` object contains `{ type, title, status: 429, detail, code: 'RATE_LIMITED' }`. The required fields `code: 'RATE_LIMITED'` and `status: 429` are present. This satisfies FRS error shape requirements for both FR-AUTH-1 and FR-AUTH-2.

---

**Checklist item 10 — `createAuthRouter(opts?)` factory with injectable store**

[OK] FR-AUTH-1/2 (test isolation, injectable rate-limit store) — `createAuthRouter` is exported as a named function accepting `opts?: { store?: Store }`. Both `registerLimiter` and `loginLimiter` pass `store: opts?.store` to their rate limit configs. When `opts` is omitted (or `opts.store` is undefined), express-rate-limit uses its default MemoryStore. Tests can inject a custom store to reset counters between test runs.

---

**Checklist item 11 — `authRouter` default export uses no-arg `createAuthRouter()`**

[OK] (test isolation / default wiring) — Line 62: `export const authRouter = createAuthRouter();` — no arguments, so the default MemoryStore is used. `index.ts` imports this named export and mounts it. Default production wiring is correct.

---

**Checklist item 12 — `standardHeaders: 'draft-7'`, `legacyHeaders: false`**

[OK] FR-AUTH-1/2 (standards-compliant rate limit headers) — Both `registerLimiter` (lines 24-25) and `loginLimiter` (lines 34-35) set `standardHeaders: 'draft-7'` and `legacyHeaders: false`. This emits `RateLimit-*` headers per IETF draft-7 and suppresses the deprecated `X-RateLimit-*` headers. Both settings are present and correct.

---

**Coverage audit — router wiring tests**

[COVERAGE] FR-AUTH-1 sub-bullet "429 RATE_LIMITED — exceeded 3/hour per IP" — No test exercises the register rate limit. No test file calls `createAuthRouter({ store: <testStore> })` and sends 4 successive POST /auth/register requests to assert the 4th returns 429 RATE_LIMITED. FRS acceptance: "scenarios AUTH-REGISTER-S4 pass".

[COVERAGE] FR-AUTH-2 sub-bullet "429 RATE_LIMITED — exceeded 5/min per IP" — No test exercises the login rate limit. No test file injects a test store and sends 6 successive POST /auth/login requests to assert the 6th returns 429 RATE_LIMITED. FRS acceptance: "scenarios AUTH-LOGIN-S4 pass" (implied by the rate limit bullet).

[COVERAGE] FR-AUTH-1/2 RFC7807 rate limit response shape — No test asserts that the 429 response body contains `{ code: 'RATE_LIMITED', status: 429 }`. The shape is only verified by reading the source constant; it has no automated regression protection.

[COVERAGE] FR-AUTH-1..4 integration via full app (index.ts wiring) — All existing tests build their own minimal Express apps inline rather than importing `app` from `index.ts`. No test exercises the fully-wired entry point (cookieParser + authRouter + errorHandler in order). A smoke-level integration test covering at least one happy path through the real app entry point is absent.

