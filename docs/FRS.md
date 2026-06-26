# Functional Requirements Specification

> LIVING DOCUMENT. During /implement, watcher agents may discover gaps.
> Main Claude proposes FRS edits as part of fix bundles for your approval.
> Always track which AB ticket introduced or modified each FR.
>
> **FRS is the PRIMARY audit document.** Each FR contains its own:
>   - Endpoint(s), validation rules, behavior
>   - Success response shape, error codes
>   - Rate limits, atomicity guarantees, security constraints
>   - Acceptance line stating which scenarios validate it
> The reviewer agent audits code DIRECTLY against FRs (not against
> spec.md's acceptance criteria — that section no longer exists).
> spec.md focuses on ticket-specific decisions: API delta, data model
> changes, scenarios, dependencies.
>
> Three FR namespaces:
> - FR-INFRA-N      → infrastructure / tooling (AB-1001 only)
> - FR-{DOMAIN}-N   → backend behavior (API, data, business rules)
> - FR-UI-{DOMAIN}-N → frontend behavior (UX, forms, navigation, autosave)
> Plus FR-E2E-* for end-to-end coverage (AB-1016 only).
> Each FR is tagged with [AB-xxxx] indicating which ticket(s) implement it.
> The same FR may be tagged with multiple tickets if backend + frontend +
> E2E all participate (e.g., FR-AUTH-2 is implemented by AB-1002 BE and
> exercised by AB-1010 FE and AB-1016 E2E).

## Infrastructure (AB-1001)

- FR-INFRA-1: pnpm workspace with apps/web, apps/api, packages/shared [AB-1001]
- FR-INFRA-2: TypeScript strict mode enabled in every package [AB-1001]
- FR-INFRA-3: Prisma initialized with PostgreSQL 16 connection (DATABASE_URL from env) [AB-1001]
- FR-INFRA-4: Vitest configured at root with workspace overrides for apps/api and apps/web [AB-1001]
- FR-INFRA-5: Playwright configured in apps/web/e2e with a baseline smoke test [AB-1001]
- FR-INFRA-6: Husky pre-commit hook runs `pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run` [AB-1001]
- FR-INFRA-7: commitlint enforces conventional commits; feat/fix commits require AB# reference; chore/docs/build/ci exempt [AB-1001]
- FR-INFRA-8: ESLint + Prettier configured at root, shared across all packages [AB-1001]
- FR-INFRA-9: OpenSpec initialized at .openspec/ with changes/ and archive/ folders [AB-1001]
- FR-INFRA-10: .env.example committed; .env in .gitignore; never commit secrets [AB-1001]
- FR-INFRA-11: All tool versions pinned in package.json (no ^, ~, or @latest) [AB-1001]
- FR-INFRA-12: Root README.md documents setup steps (install, db, env, dev, test) [AB-1001]
- FR-INFRA-13: docker-compose.yml provides local PostgreSQL 16 instance (optional but recommended) [AB-1001]
- FR-INFRA-14: packages/shared exports tsup-built CJS + ESM with type declarations [AB-1001]
- FR-INFRA-15: pnpm scripts: build, dev, test, lint, typecheck — work from root and recurse [AB-1001]
- FR-INFRA-16: `.claude/agents/` contains reviewer.md and tester.md with correct tool restrictions (reviewer read-only; tester restricted to test paths) [AB-1001]
- FR-INFRA-17: `.claude/skills/` contains starter skills: prisma-migration, zod-schema, express-route, react-component, tanstack-query, playwright-spec [AB-1001]
- FR-INFRA-18: `.claude/settings.json` configures three MCPs: Context7 (live docs), GitHub (PR ops via GITHUB_TOKEN), Postgres (dev DB via DATABASE_URL). Tokens read from env, never committed. [AB-1001]

## Backend — Auth (AB-1002, AB-1003)

### FR-AUTH-1: Register with email + password [AB-1002]
- **Endpoint:** POST /auth/register
- **Validation (Zod schema in packages/shared):**
  - email: valid format, max 255 chars
  - password: min 8 chars, must contain at least 1 number
- **Behavior:** bcrypt-hash password with rounds ≥ 12; store user
- **Success response:** 201 with `{ id, email, createdAt }`
- **Errors:**
  - 400 VALIDATION_FAILED — invalid email or password format
  - 409 USER_EXISTS — email already registered
  - 429 RATE_LIMITED — exceeded 3/hour per IP
- **Rate limit:** 3/hour per IP
- **Acceptance:** scenarios AUTH-REGISTER-S1..S4 pass; coverage ≥80%

### FR-AUTH-2: Login returns access + refresh token [AB-1002]
- **Endpoint:** POST /auth/login
- **Validation:** email + password (same rules as register)
- **Behavior:**
  - Look up user by email; verify password with bcrypt
  - On success: generate JWT access token (exp 15 min, signed with JWT_SECRET from env) AND opaque 64-char refresh token
  - Persist refresh token in DB with `{ userId, token, expiresAt, revokedAt: null }`
  - Refresh token expires in 7 days
- **Success response:** 200 with `{ accessToken, user: { id, email } }` (refreshToken set via httpOnly cookie — see AB-1002 spec.md decision 1)
- **Errors:**
  - 400 VALIDATION_FAILED — invalid input shape
  - 401 AUTH_INVALID_CREDENTIALS — wrong password OR unknown email (same code; never leak account existence)
  - 429 RATE_LIMITED — exceeded 5/min per IP
- **Rate limit:** 5/min per IP
- **Acceptance:** scenarios AUTH-LOGIN-S1..S4 pass; bcrypt rounds ≥ 12; JWT_SECRET from env only; no account-existence leak in either error path

### FR-AUTH-3: Refresh token rotates on use [AB-1002]
- **Endpoint:** POST /auth/refresh
- **Validation:** `refreshToken` httpOnly cookie (sent automatically by browser; no request body needed)
- **Behavior:**
  - Look up refresh token in DB
  - Reject if expired, revoked, or unknown
  - In a single DB transaction: mark old token `revokedAt = now`, issue new pair
- **Success response:** 200 with `{ accessToken }` (refreshToken set via httpOnly cookie — see AB-1002 spec.md decision 1)
- **Errors:**
  - 401 AUTH_REFRESH_INVALID — missing, expired, revoked, or unknown token
- **Atomicity:** rotation MUST be a single Prisma transaction
- **Acceptance:** scenarios AUTH-REFRESH-S1..S3 pass; rotation transaction confirmed in tests; reused old token returns 401

### FR-AUTH-4: Logout revokes refresh token [AB-1002]
- **Endpoint:** POST /auth/logout
- **Auth:** requires valid access token
- **Validation:** `refreshToken` httpOnly cookie (sent automatically by browser; no request body needed)
- **Behavior:** sets `revokedAt = now` on the given refresh token. Idempotent — already-revoked token still returns success.
- **Success response:** 204 No Content
- **Errors:**
  - 401 AUTH_TOKEN_INVALID — no/bad access token
  - missing refreshToken cookie → 204 No Content (idempotent)
- **Acceptance:** scenarios AUTH-LOGOUT-S1..S2 pass; logout of already-revoked token returns 204

### FR-AUTH-5: Forgot password sends 6-digit OTP [AB-1003]
- **Endpoint:** POST /auth/forgot-password
- **Validation:** body `{ email: string }`
- **Behavior:**
  - If email exists: generate 6-digit OTP, store with `{ userId, otp, expiresAt: now+10min, attemptsLeft: 5 }`
  - **Log the OTP to console with prefix `[OTP]` — NO actual email sending**
  - If email does not exist: silent success (same response as success; never leak account existence)
- **Success response:** 200 with `{ message: "If your account exists, you'll receive an OTP" }`
- **Errors:**
  - 400 VALIDATION_FAILED — invalid email format
  - 429 RATE_LIMITED — 3/hour per email
- **Rate limit:** 3/hour per email
- **Acceptance:** scenarios AUTH-FORGOT-S1..S3 pass; same response for known and unknown emails; OTP appears in console log only

### FR-AUTH-6: OTP verification + password reset [AB-1003]
- **Endpoint:** POST /auth/reset-password
- **Validation:** body `{ email, otp: 6-digit string, newPassword }`
- **Behavior:**
  - Find active OTP for this email
  - If not found / expired / no attempts left → 401
  - If OTP mismatches: decrement attemptsLeft. If now 0, mark OTP invalid.
  - On match: bcrypt-hash newPassword, update user, invalidate OTP, revoke ALL refresh tokens for this user
- **Success response:** 204 No Content
- **Errors:**
  - 400 VALIDATION_FAILED — bad input
  - 401 AUTH_OTP_INVALID — wrong OTP / expired / out of attempts
- **Acceptance:** scenarios AUTH-OTP-S1..S5 pass; max 5 attempts enforced; expiry 10min enforced; all sessions invalidated on successful reset

## Backend — Architecture Convention

### FR-ARCH-1: Three-layer backend structure [AB-1004]
All backend feature endpoints from AB-1004 onwards MUST follow a three-layer structure:

- **routes/**: Express router registration + `.catch(next)` only. No business logic, no Prisma.
- **controllers/**: Zod validate → call service → `res.json()`. No `@prisma/client` imports.
- **services/**: Business logic + all DB access via Prisma. No Express types (`Request`/`Response`).

**Target folder layout:**
```
apps/api/src/
  routes/       ← notes.router.ts, tags.router.ts, search.router.ts …
  controllers/  ← notes.controller.ts, tags.controller.ts, search.controller.ts …
  services/     ← notes.service.ts, tags.service.ts, search.service.ts …
  middleware/   ← auth.ts, errorHandler.ts  (unchanged)
  lib/          ← prisma.ts, jwt.ts, cookie.ts  (unchanged)
```

**Reviewer [FAIL] triggers:**
- Service file imports `Request` or `Response` from express
- Controller file calls `prisma.*` directly or imports `@prisma/client`
- Route file contains any logic beyond router registration and `.catch(next)` wiring

**Auth routes (AB-1002/1003):** grandfathered in fat-handler pattern under `routes/auth/`. Must be
retrofitted to the three-layer structure in a dedicated refactor ticket **before AB-1010** (frontend
auth integration). The refactor creates `services/auth.service.ts` and `controllers/auth.controller.ts`
and slims `routes/auth/*.ts` to pure wiring.

**Acceptance:** every new endpoint in AB-1004+ passes reviewer cross-layer import check; no business logic in routes/; no Prisma in controllers/.

## Backend — Notes (AB-1004, AB-1005)

### FR-NOTE-1: Create note [AB-1004]
- **Endpoint:** POST /notes
- **Auth:** requires access token
- **Validation:** body `{ title: string (1-200 chars), body: TipTap JSON object, tagIds?: string[] }`
- **Behavior:** creates note with `userId = current user`; if tagIds given, validates they belong to current user
- **Success response:** 201 with full note `{ id, title, body, tagIds, createdAt, updatedAt, version: 1 }`
- **Errors:**
  - 400 VALIDATION_FAILED — bad shape
  - 401 AUTH_TOKEN_INVALID
  - 422 INVALID_TAG — tagId not owned by user
- **Acceptance:** scenarios NOTE-CREATE-S1..S3 pass; note's userId always = current user; foreign tagIds rejected

### FR-NOTE-2: Read own notes only [AB-1004]
- **Endpoint:** GET /notes/:id
- **Auth:** requires access token
- **Behavior:** returns note only if `note.userId === currentUserId AND note.deletedAt IS NULL`. Otherwise 404 (never 403 — don't leak existence).
- **Success response:** 200 with note
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND — note doesn't exist, belongs to another user, OR is soft-deleted
- **Acceptance:** scenarios NOTE-READ-S1..S3 pass; cross-user read returns 404 (not 403); soft-deleted note returns 404

### FR-NOTE-3: Update note + create version snapshot [AB-1004]
- **Endpoint:** PATCH /notes/:id
- **Auth:** requires access token; must own note
- **Validation:** body `{ title?, body?, tagIds? }`
- **Behavior:**
  - In a single Prisma transaction:
    1. Snapshot current state into NoteVersion table (preserves old title, body, version number, savedAt)
    2. Update note with new fields; increment version number; update updatedAt
- **Success response:** 200 with updated note (new version)
- **Errors:**
  - 400 VALIDATION_FAILED
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND
- **Atomicity:** snapshot + update MUST be one transaction
- **Acceptance:** scenarios NOTE-UPDATE-S1..S3 pass; every save increments version by exactly 1; snapshot precedes update

### FR-NOTE-4: Soft delete [AB-1004]
- **Endpoint:** DELETE /notes/:id
- **Auth:** requires access token; must own note
- **Behavior:** sets `deletedAt = now`. **MUST NOT physically delete** for 30 days.
- **Success response:** 204 No Content
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND
- **Acceptance:** scenarios NOTE-DELETE-S1..S2 pass; no `DELETE FROM` SQL is ever generated by Prisma for notes within recovery window; deleted note absent from list endpoints

### FR-NOTE-5: Cursor-paginated list [AB-1005]
- **Endpoint:** GET /notes
- **Auth:** requires access token
- **Query:** `?cursor=<opaque>&limit=20` (limit max 50, default 20)
- **Behavior:** returns own non-deleted notes, ordered per FR-NOTE-6. Cursor is opaque base64 of `{ lastId, lastValue }`.
- **Success response:** 200 with `{ items: Note[], nextCursor: string | null }`
- **Errors:**
  - 400 VALIDATION_FAILED — limit > 50 or invalid cursor
  - 401 AUTH_TOKEN_INVALID
- **Acceptance:** scenarios NOTE-LIST-S1..S3 pass; limit > 50 → 400; nextCursor null when no more results

### FR-NOTE-6: Sort list [AB-1005]
- **Query:** `?sort=createdAt:desc` (default), accepts `createdAt|updatedAt` × `asc|desc`
- **Behavior:** appends to FR-NOTE-5 query
- **Errors:** 400 VALIDATION_FAILED — invalid sort field or direction
- **Acceptance:** scenarios NOTE-LIST-SORT-S1..S4 pass (one per combination)

### FR-NOTE-7: Filter by tags (AND semantics) [AB-1005]
- **Query:** `?tagIds=t1,t2,t3` — note must have ALL listed tags (AND, not OR)
- **Behavior:** appends to FR-NOTE-5 query; combinable with sort
- **Errors:**
  - 400 VALIDATION_FAILED — malformed tagIds
  - 422 INVALID_TAG — any tagId not owned by user
- **Acceptance:** scenarios NOTE-LIST-TAG-S1..S3 pass; AND semantics confirmed (not OR); foreign tagIds rejected

## Backend — Tags (AB-1006)

### FR-TAG-1: User-scoped tags [AB-1006]
- **Data:** Tag has `userId` (FK). All endpoints scope by current user.
- **No global tags** — each user has their own namespace.
- **Acceptance:** cross-user tag access returns 404

### FR-TAG-2: Tag has name (unique per user) + color [AB-1006]
- **Endpoints:** POST /tags, PATCH /tags/:id, DELETE /tags/:id, GET /tags
- **Validation:**
  - name: 1-50 chars
  - color: hex string matching `^#[0-9a-fA-F]{6}$`
- **DB constraint:** unique on `(userId, name)`
- **Behavior on POST:**
  - 201 with full tag on success
  - 409 TAG_NAME_DUPLICATE on unique constraint violation
- **Errors:**
  - 400 VALIDATION_FAILED — bad name or color format
  - 401 AUTH_TOKEN_INVALID
  - 404 TAG_NOT_FOUND (for PATCH/DELETE)
  - 409 TAG_NAME_DUPLICATE
- **Acceptance:** scenarios TAG-S1..S5 pass; duplicate name within user → 409; same name allowed across different users

### FR-TAG-3: Tag list includes noteCount [AB-1006]
- **Endpoint:** GET /tags
- **Behavior:** for each tag, count non-deleted notes that include it. Use a single SQL query (no N+1).
- **Success response:** 200 with `[{ id, name, color, noteCount }]`
- **Acceptance:** scenarios TAG-LIST-S1..S2 pass; noteCount accurate; no N+1 (verified by test query count)

## Backend — Search (AB-1007)

### FR-SEARCH-1: Full-text search across title + body [AB-1007]
- **Endpoint:** GET /search?q=<query>
- **Auth:** requires access token
- **Behavior:**
  - Uses PostgreSQL `to_tsvector('english', title || ' ' || body_text)` indexed column
  - `body_text` is plain-text extraction of TipTap JSON, populated by a Prisma middleware on note save
  - Query uses `plainto_tsquery` for safe input handling
  - Only own non-deleted notes
- **Errors:**
  - 400 VALIDATION_FAILED — empty query
  - 401 AUTH_TOKEN_INVALID
- **Acceptance:** scenarios SEARCH-S1..S3 pass; tsvector index exists in migration; empty query → 400

### FR-SEARCH-2: Highlights via ts_headline [AB-1007]
- **Behavior:** results include `headline` field generated by `ts_headline` with `<mark>...</mark>` wrappers around matches
- **Success response:** `[{ note: {...}, headline: "...<mark>match</mark>..." }]`
- **Acceptance:** scenarios SEARCH-HIGHLIGHT-S1..S2 pass; <mark> tags appear in results

### FR-SEARCH-3: Cursor-paginated [AB-1007]
- **Query:** same as FR-NOTE-5 (cursor + limit)
- **Acceptance:** scenarios SEARCH-PAGE-S1..S2 pass

## Backend — Sharing (AB-1008)

### FR-SHARE-1: Generate public read-only link [AB-1008]
- **Endpoint:** POST /notes/:id/shares
- **Auth:** requires access token; must own note
- **Validation:** body `{ expiresAt?: ISO 8601 datetime }` (optional)
- **Behavior:**
  - Generates 32-char URL-safe token
  - Persists `{ noteId, token, expiresAt, revokedAt: null, viewCount: 0, createdAt }`
- **Success response:** 201 with `{ token, shareUrl, expiresAt, viewCount: 0 }`
- **Errors:**
  - 400 VALIDATION_FAILED — expiresAt in the past
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND
- **Acceptance:** scenarios SHARE-CREATE-S1..S3 pass; token URL-safe; past expiresAt rejected

### FR-SHARE-2: Revoke link (idempotent) [AB-1008]
- **Endpoint:** DELETE /notes/:id/shares/:token
- **Auth:** requires access token; must own note
- **Behavior:** sets `revokedAt = now`. Idempotent — revoking already-revoked returns 204.
- **Success response:** 204 No Content
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 SHARE_NOT_FOUND — token doesn't exist or belongs to another user's note
- **Acceptance:** scenarios SHARE-REVOKE-S1..S2 pass; double-revoke returns 204

### FR-SHARE-3: Public access with atomic viewCount [AB-1008]
- **Endpoint:** GET /public/shares/:token
- **Auth:** none (public)
- **Behavior:**
  - Look up share by token
  - If revoked or expired → 410 GONE_LINK_INVALID
  - Else: increment viewCount atomically (`UPDATE ... SET viewCount = viewCount + 1`), return note (read-only view: title, body, no metadata)
- **Atomicity:** viewCount increment uses a single SQL UPDATE statement (no read-then-write race)
- **Success response:** 200 with `{ title, body, viewCount, sharedAt }`
- **Errors:**
  - 410 GONE_LINK_INVALID — revoked or expired
  - 429 RATE_LIMITED — 60/min per IP
- **Rate limit:** 60/min per IP per token
- **Acceptance:** scenarios SHARE-VIEW-S1..S4 pass; concurrent requests do not lose increments (verified by load test in scenario S4)

### FR-SHARE-4: Expired/revoked → 410 [AB-1008]
- **Covered jointly by FR-SHARE-3 above**
- **Distinction:** expired (past expiresAt) and revoked (revokedAt set) both return identical 410 GONE_LINK_INVALID body (don't distinguish causes to client)
- **Acceptance:** scenarios SHARE-VIEW-S2, S3 pass with identical response shape

### FR-SHARE-5: List share links for a note [AB-1008]
- **Endpoint:** GET /notes/:id/shares
- **Auth:** requires access token; must own note
- **Behavior:** returns all shares (active and revoked) for the note, ordered `createdAt DESC`
- **Success response:** 200 with `[{ id, token, shareUrl, expiresAt, revokedAt, viewCount, createdAt }]`
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND — note doesn't exist or not owned by requester
- **Acceptance:** scenarios SHARE-LIST-S1..S2 pass; revoked items included with `revokedAt` set; ordering verified

## Backend — Version History (AB-1009)

### FR-VER-1: Save creates snapshot [AB-1009]
- **Covered by FR-NOTE-3** (every PATCH /notes/:id snapshots into NoteVersion table inside the same transaction)
- **Data model:** NoteVersion `{ id, noteId, version: int, title, body, savedAt }`
- **Acceptance:** scenarios VER-SAVE-S1..S2 pass; version count = update count

### FR-VER-2: List versions [AB-1009]
- **Endpoint:** GET /notes/:id/versions
- **Auth:** requires access token; must own note
- **Behavior:** returns versions ordered by version DESC (newest first)
- **Success response:** 200 with `[{ id, version, savedAt, title }]` (no body in list view)
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 NOTE_NOT_FOUND
- **Acceptance:** scenarios VER-LIST-S1..S2 pass; ordering verified

### FR-VER-3: View specific version [AB-1009]
- **Endpoint:** GET /notes/:id/versions/:versionId
- **Auth:** requires access token; must own note
- **Success response:** 200 with full version including body
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 VERSION_NOT_FOUND
- **Acceptance:** scenario VER-VIEW-S1 passes

### FR-VER-4: Restore creates new version (non-destructive) [AB-1009]
- **Endpoint:** POST /notes/:id/versions/:versionId/restore
- **Auth:** requires access token; must own note
- **Behavior:**
  - In a single transaction:
    1. Snapshot current state (preserving current as a new "pre-restore" version)
    2. Apply selected version's title + body to the note
    3. Increment note version number
  - **The selected old version is NEVER overwritten or deleted.**
- **Success response:** 200 with updated note
- **Errors:**
  - 401 AUTH_TOKEN_INVALID
  - 404 VERSION_NOT_FOUND
- **Acceptance:** scenarios VER-RESTORE-S1..S2 pass; total version count after restore = previous count + 2 (one snapshot of pre-restore state, one for the restored content)

### FR-VER-5: Auto-purge versions >90 days [AB-1009]
- **Behavior:** scheduled job (cron) deletes NoteVersion rows where `savedAt < now - 90 days`. Daily at 03:00 UTC.
- **Implementation:** Express scheduled task or node-cron; logs purged count
- **Acceptance:** scenarios VER-PURGE-S1..S2 pass; cron schedule verified; logs include count

## Frontend — Auth Pages (AB-1010)

### FR-UI-AUTH-1: Login form [AB-1010]
- **Route:** /login
- **Components:** `<LoginForm />` with shadcn/ui Input + Button
- **Validation:** Zod schema imported from packages/shared (same as FR-AUTH-2 backend)
- **Behavior:**
  - Validate on blur, not per keystroke
  - Submit button disabled until valid
  - On failed validation: inline error below field, red border on input
- **Acceptance:** scenarios UI-AUTH-LOGIN-S1..S3 pass; keyboard-reachable; aria-labels present

### FR-UI-AUTH-2: Login success behavior [AB-1010]
- **Behavior:**
  - On 200 response, store accessToken in Zustand auth slice (in-memory only — never localStorage)
  - Refresh token comes from backend in httpOnly cookie (frontend never reads it directly)
  - Redirect to URL from `?next=` query param if present, else `/notes`
- **Acceptance:** scenario UI-AUTH-LOGIN-S1 passes; localStorage never set with token (verified by test); redirect honors `?next=`

### FR-UI-AUTH-3: Login failure UX [AB-1010]
- **Behavior:**
  - On 401 AUTH_INVALID_CREDENTIALS, show inline error "Invalid email or password" (via errorMessages.ts map)
  - Email field stays populated; password field clears; focus returns to password
- **Acceptance:** scenario UI-AUTH-LOGIN-S2 passes; specific text shown matches errorMessages.ts; email retained, password cleared

### FR-UI-AUTH-4: Register form [AB-1010]
- **Route:** /register
- **Behavior:**
  - Same validation as login
  - On 201 success, auto-call login endpoint with same creds, then follow FR-UI-AUTH-2 redirect logic
  - On 409 USER_EXISTS: inline error "Account already exists. Try logging in." with link to /login
- **Acceptance:** scenarios UI-AUTH-REGISTER-S1..S3 pass

### FR-UI-AUTH-5: Forgot password flow [AB-1010]
- **Route:** /forgot-password
- **3 stateful steps within one page:**
  1. Email entry → POST /auth/forgot-password → advance to step 2 regardless of response (don't leak account existence)
  2. OTP entry (6 digits, auto-advance between inputs) + new password
  3. Success screen → redirect to /login
- **State held in component-local Zustand store (cleared on page leave)**
- **On 401 AUTH_OTP_INVALID:** show inline "Invalid or expired code. Please try again."
- **Acceptance:** scenarios UI-AUTH-FORGOT-S1..S4 pass; step 2 always shown after step 1; state cleared on navigation away

### FR-UI-AUTH-6: Logout button [AB-1010]
- **Component:** in app header
- **Behavior:**
  - POST /auth/logout with current refresh token
  - Clear access token from Zustand
  - Clear all TanStack Query cache (`queryClient.clear()`)
  - Redirect to /login
- **Acceptance:** scenario UI-AUTH-LOGOUT-S1 passes; query cache empty after logout; no stale data visible

### FR-UI-AUTH-7: Loading states on submits [AB-1010]
- **Per docs/UX.md "Loading States" section**
- **Pattern:**
  - Button label replaced with shadcn/ui Spinner during request
  - Button width preserved (no layout shift)
  - Minimum display 200ms (anti-flicker timer)
- **Acceptance:** every submit in AB-1010 follows this pattern; scenario UI-AUTH-LOADING-S1 passes

## Frontend — Notes List (AB-1011)

### FR-UI-NOTES-1: Paginated list [AB-1011]
- **Route:** /notes
- **Components:** `<NotesList />` with `<NoteCard />` per item
- **State:** TanStack Query `useInfiniteQuery` keyed by `['notes', sort, tagFilter]`
- **Behavior:**
  - Loads first page on mount (limit 20)
  - "Load more" button at bottom calls next page using `nextCursor`
  - Skeleton screen (shadcn/ui Skeleton) while loading
- **Acceptance:** scenarios UI-NOTES-LIST-S1..S3 pass; query key updates on sort/filter changes (verified by test)

### FR-UI-NOTES-2: Sort dropdown [AB-1011]
- **Component:** shadcn/ui Select
- **Options:** Newest, Oldest, Recently Updated, Least Recently Updated
- **Maps to:** `createdAt:desc | createdAt:asc | updatedAt:desc | updatedAt:asc`
- **Persistence:** Zustand `notesViewStore` (survives navigation, NOT page reload)
- **Acceptance:** scenarios UI-NOTES-SORT-S1..S2 pass; state survives navigation away and back

### FR-UI-NOTES-3: Tag filter chips [AB-1011]
- **Component:** horizontal scroll of `<TagChip />` (shadcn/ui Badge variant)
- **Behavior:**
  - Click chip → toggle in URL query `?tags=t1,t2`
  - URL is source of truth; reading URL restores filter state
  - AND semantics (matches FR-NOTE-7)
- **Acceptance:** scenarios UI-NOTES-FILTER-S1..S3 pass; URL ↔ UI in sync; AND semantics verified

### FR-UI-NOTES-4: Empty state [AB-1011]
- **Per docs/UX.md "Empty States" section**
- **Content:** lucide-react `<FileText />` icon + heading "No notes yet" + subtext + "Create your first note" button → /notes/new
- **Shown when:** API returns empty AND no filters applied. If filters applied: show "No notes match these filters" instead.
- **Acceptance:** scenarios UI-NOTES-EMPTY-S1..S2 pass

### FR-UI-NOTES-5: Soft-deleted notes hidden [AB-1011]
- **Behavior:** list never shows notes with `deletedAt != null` (backend already filters; frontend defensive check)
- **Trash view:** placeholder in nav menu marked "Coming Soon" — out of scope for v1
- **Acceptance:** scenario UI-NOTES-TRASH-S1 passes (placeholder visible but disabled)

## Frontend — Note Editor (AB-1012)

### FR-UI-EDITOR-1: TipTap rich editor [AB-1012]
- **Route:** /notes/:id and /notes/new
- **Component:** `<NoteEditor />` wrapping TipTap with StarterKit extensions
- **Toolbar:** bold, italic, headings (h1/h2/h3), bullet list, ordered list, code block
- **Output format:** TipTap JSON (matches FR-NOTE-1 body shape)
- **Acceptance:** scenarios UI-EDITOR-S1..S2 pass; toolbar buttons keyboard-reachable

### FR-UI-EDITOR-2: Title input [AB-1012]
- **Component:** shadcn/ui Input above editor
- **Validation:** 1-200 chars (matches FR-NOTE-1)
- **Behavior:** focus moves to editor on Enter
- **Acceptance:** scenarios UI-EDITOR-TITLE-S1..S2 pass

### FR-UI-EDITOR-3: Autosave with status indicator [AB-1012]
- **Behavior:**
  - Debounce 2s after last keystroke (title OR body changes)
  - Indicator in editor header: "Saving…" (during request) → "Saved" (3s after success) → blank
  - On failure: "Save failed — retry" with click-to-retry behavior
- **Status state in Zustand `editorStatusStore`**
- **Per docs/UX.md "Loading States" — but autosave has its own indicator pattern, not a button spinner**
- **Acceptance:** scenarios UI-EDITOR-AUTOSAVE-S1..S3 pass; debounce verified at exactly 2s; status transitions correct

### FR-UI-EDITOR-4: Autosave failure recovery [AB-1012]
- **Behavior:**
  - On PATCH failure, retry once after 5s
  - If retry fails: show toast "Couldn't save your changes" (per docs/UX.md toast pattern) AND persist current draft in Zustand `draftStore` keyed by noteId
  - On successful save (or note open), clear draft from store
- **Acceptance:** scenario UI-EDITOR-RETRY-S1..S2 pass; draft survives one failure cycle; cleared on next success

### FR-UI-EDITOR-5: Inline tag selector [AB-1012]
- **Component:** Combobox below title
- **Behavior:**
  - Type to filter existing user tags
  - If typed text doesn't match a tag and user presses Enter → POST /tags to create on-the-fly (color: random from palette), then add to note
  - Selected tags shown as chips with X to remove
- **Acceptance:** scenarios UI-EDITOR-TAGS-S1..S3 pass; create-on-the-fly verified

## Frontend — Search UI (AB-1013)

### FR-UI-SEARCH-1: Debounced search input [AB-1013]
- **Route:** /search
- **Component:** shadcn/ui Input with lucide `<Search />` icon
- **Debounce:** 300ms after last keystroke before triggering query
- **Empty query:** clears results; no API call
- **Acceptance:** scenarios UI-SEARCH-INPUT-S1..S2 pass; debounce verified

### FR-UI-SEARCH-2: Highlighted results [AB-1013]
- **Behavior:**
  - Render `headline` field with `<mark>` preserved
  - Use DOMPurify to sanitize before injecting (only allow `<mark>` tag)
  - **NEVER use dangerouslySetInnerHTML without sanitization**
- **Security:** XSS prevention is a hard requirement -- reviewer agent will flag this as [SEC] if missing
- **Acceptance:** scenario UI-SEARCH-HIGHLIGHT-S1 passes; XSS test (attempting `<script>` in note body) blocked

### FR-UI-SEARCH-3: No-results state [AB-1013]
- **Per docs/UX.md "Empty States"**
- **Content:** lucide `<SearchX />` + "No matches for '<query>'" + "Try different keywords"
- **Acceptance:** scenario UI-SEARCH-EMPTY-S1 passes

### FR-UI-SEARCH-4: Paginated load more [AB-1013]
- **Same pattern as FR-UI-NOTES-1** (cursor-based, "Load more" button)
- **Acceptance:** scenario UI-SEARCH-PAGE-S1 passes

## Frontend — Share Modal (AB-1014)

### FR-UI-SHARE-1: Share button opens modal [AB-1014]
- **Component:** lucide `<Share2 />` icon button on each `<NoteCard />` and in note editor header
- **Modal:** shadcn/ui Dialog
- **Acceptance:** scenario UI-SHARE-OPEN-S1 passes; keyboard-reachable; ESC closes modal

### FR-UI-SHARE-2: Active links list [AB-1014]
- **Display:** GET /notes/:id/shares → list of cards with token (last 6 chars shown), expiry, viewCount, "Revoke" button
- **Empty state:** "No active share links" + "Generate one below"
- **Acceptance:** scenarios UI-SHARE-LIST-S1..S2 pass

### FR-UI-SHARE-3: Generate new link [AB-1014]
- **Form:** optional date picker for expiry
- **On generate:**
  - POST /notes/:id/shares
  - On 201: copy `shareUrl` to clipboard via `navigator.clipboard.writeText()`
  - Show toast "Link copied to clipboard" (per docs/UX.md success toast)
  - Refresh active links list
- **Acceptance:** scenarios UI-SHARE-CREATE-S1..S2 pass

### FR-UI-SHARE-4: Revoke with confirmation [AB-1014]
- **Per docs/UX.md "Confirm-Before-Destructive"**
- **Behavior:**
  - Click "Revoke" → confirm modal "Revoke this share link? Anyone with the link will no longer be able to view this note."
  - On confirm: DELETE /notes/:id/shares/:token; refresh list
  - Revoked links visually distinguished (greyed out, "Revoked" badge)
- **Acceptance:** scenarios UI-SHARE-REVOKE-S1..S2 pass; confirm modal blocks accidental revoke

## Frontend — Version History (AB-1015)

### FR-UI-VER-1: History drawer [AB-1015]
- **Component:** shadcn/ui Sheet, slides in from right
- **Trigger:** "History" button in note editor toolbar
- **Acceptance:** scenario UI-VER-OPEN-S1 passes; ESC closes drawer

### FR-UI-VER-2: Version list [AB-1015]
- **Display:** GET /notes/:id/versions → list newest-first
- **Each item:** version number, savedAt (relative time via date-fns "2 hours ago"), title preview, first 80 chars of body
- **Acceptance:** scenarios UI-VER-LIST-S1..S2 pass

### FR-UI-VER-3: Version preview [AB-1015]
- **Behavior:** click version → split view: current note on left, selected version on right (read-only TipTap render)
- **Acceptance:** scenario UI-VER-PREVIEW-S1 passes; preview is read-only (no edits possible)

### FR-UI-VER-4: Restore creates new version [AB-1015]
- **Behavior:**
  - "Restore this version" button → confirm modal (per docs/UX.md and FR-UI-VER-5)
  - On confirm: POST /notes/:id/versions/:versionId/restore
  - On 200: reload editor with restored content; close drawer; show toast "Restored version N"
- **Acceptance:** scenario UI-VER-RESTORE-S1 passes; editor updates with restored content

### FR-UI-VER-5: Confirm modal before restore [AB-1015]
- **Per docs/UX.md "Confirm-Before-Destructive"**
- **Content:** "Restore this version? This will create a new version — your current work won't be lost."
- **Buttons:** "Restore" (primary) + "Cancel"
- **Acceptance:** scenario UI-VER-CONFIRM-S1 passes; cancel does not call API

## E2E (AB-1016)

### FR-E2E-1: Full user journey [AB-1016]
- **Single Playwright spec covering the complete flow:**
  1. Register new user → automatic login → land on /notes
  2. Empty state → click "Create your first note" → /notes/new
  3. Type title and body in editor → wait for autosave indicator
  4. Add a new tag inline → verify chip appears
  5. Navigate to /notes → see the new note with tag
  6. Use search → find the new note → click result
  7. Open share modal → generate link with expiry → verify clipboard copy
  8. Revoke link → confirm → verify link greyed out
  9. Edit note → save again (creates version 2)
  10. Open history drawer → click version 1 → restore → verify restored content
  11. Logout → verify redirect to /login
- **Acceptance:** spec runs green end-to-end against local dev server

### FR-E2E-2: Coverage assertion [AB-1016]
- **Behavior:** at end of journey, run a script that parses `apps/web/e2e/journey.spec.ts` and verifies every backend FR-* and frontend FR-UI-* has at least one assertion (matched by scenario ID in comments or test names)
- **Output:** report listing FRs with no E2E coverage
- **Acceptance:** report shows 0 uncovered FRs