# Review Log — AB-1008 Sharing

## Task 1-9 Review -- 2026-06-26T00:00:00Z

---

### FR-SHARE-1: Generate public read-only link (POST /notes/:id/shares)

[OK] FR-SHARE-1: Endpoint exists -- shares router POST /:noteId/shares mounted at /notes resolves to POST /notes/:noteId/shares.

[OK] FR-SHARE-1: Auth enforced -- router.use(requireAuth) applied before all routes in shares.ts.

[OK] FR-SHARE-1: Token is exactly 32 URL-safe chars -- randomBytes(24).toString(base64url) in shares.service.ts line 51; 24 bytes x (4/3) = 32 base64url chars with no padding.

[OK] FR-SHARE-1: Zod validation in controller -- createShareSchema.safeParse(req.body); throws 400 VALIDATION_FAILED on failure.

[OK] FR-SHARE-1: Past expiresAt rejected at Zod layer -- createShareSchema uses .refine((v) => new Date(v) > new Date()) enforcing future datetime; occurs before service call as required by FRS.

[OK] FR-SHARE-1: Persists NoteShare record -- prisma.noteShare.create with data {noteId, token, expiresAt}; revokedAt and viewCount default from Prisma schema.

[OK] FR-SHARE-1: Success response 201 with {token, shareUrl, expiresAt, viewCount: 0} -- controller returns res.status(201).json(share).

[OK] FR-SHARE-1: 404 NOTE_NOT_FOUND -- assertNoteOwner throws AppError(404, NOTE_NOT_FOUND) when note not found, not owned, or soft-deleted.

[OK] FR-SHARE-1: 400 VALIDATION_FAILED -- thrown by controller when createShareSchema.safeParse fails.

[OK] FR-SHARE-1: 401 AUTH_TOKEN_INVALID -- thrown by requireAuth middleware.

[WARN] FR-SHARE-1: createShareSchema uses z.string().datetime().refine(...).optional() but delta-openapi.yaml declares expiresAt as nullable: true. Sending { expiresAt: null } explicitly fails Zod with 400 VALIDATION_FAILED because z.string() rejects null. Clients sending null instead of omitting the field receive an unexpected error. Fix: add .nullable() before .optional().

---

### FR-SHARE-2: Revoke link (DELETE /notes/:id/shares/:token)

[OK] FR-SHARE-2: Endpoint exists -- router.delete /:noteId/shares/:token in shares.ts resolves to DELETE /notes/:noteId/shares/:token.

[OK] FR-SHARE-2: Auth enforced -- router.use(requireAuth) applies.

[OK] FR-SHARE-2: Must own note -- assertNoteOwner(userId, noteId) called first in revokeShare service.

[OK] FR-SHARE-2: Sets revokedAt = now -- prisma.noteShare.update with data { revokedAt: new Date() } in service line 91.

[OK] FR-SHARE-2: Idempotent -- FRS: revoking already-revoked returns 204. Observed: service line 89 checks if (share.revokedAt !== null) return, skipping update; controller always sends 204.

[OK] FR-SHARE-2: 404 SHARE_NOT_FOUND -- thrown when prisma.noteShare.findFirst returns null (service line 87).

[OK] FR-SHARE-2: 401 AUTH_TOKEN_INVALID -- requireAuth middleware.

[OK] FR-SHARE-2: 204 No Content success -- res.status(204).end() in revokeShareController.

---

### FR-SHARE-3: Public access with atomic viewCount (GET /public/shares/:token)

[OK] FR-SHARE-3: Endpoint exists -- router.get /shares/:token in public.ts mounted at /public resolves to GET /public/shares/:token.

[OK] FR-SHARE-3: No auth required -- public.ts does not import or apply requireAuth.

[OK] FR-SHARE-3: Rate limit applied -- publicShareLimiter from createPublicShareLimiter() applied directly in public.ts route definition.

[OK] FR-SHARE-3: Rate limit 60/min per IP+token -- windowMs: 60*1000, limit: 60, keyGenerator returns ip:token (rateLimiters.ts lines 54-57).

[OK] FR-SHARE-3: Revoked -> 410 GONE_LINK_INVALID -- share.revokedAt !== null check in service line 142.

[OK] FR-SHARE-3: Expired -> 410 GONE_LINK_INVALID -- share.expiresAt !== null && share.expiresAt < now check in service line 142.

[OK] FR-SHARE-3: Both revoked and expired return identical 410 body -- same AppError(410, GONE_LINK_INVALID) for both; client cannot distinguish cause, satisfying FR-SHARE-4.

[OK] FR-SHARE-3: Atomic viewCount increment -- FRS: increment viewCount atomically (UPDATE ... SET viewCount = viewCount + 1). Observed: prisma.noteShare.update with { viewCount: { increment: 1 } } in service line 146; single SQL UPDATE; no read-then-write race.

[OK] FR-SHARE-3: Success response 200 {title, body, viewCount, sharedAt} -- correct shape; sharedAt = NoteShare.createdAt per spec.md decision 3.

[OK] FR-SHARE-3: Note must not be soft-deleted -- service line 137: if (!share || share.note.deletedAt !== null) throws 410 GONE_LINK_INVALID.

[OK] FR-SHARE-3: 429 RATE_LIMITED -- rateLimitHandler returns 429 RFC7807 body.

---

### FR-SHARE-4: Expired/revoked -> 410 (covered jointly by FR-SHARE-3)

[OK] FR-SHARE-4: FRS: expired (past expiresAt) and revoked (revokedAt set) both return identical 410 GONE_LINK_INVALID body. Observed: same AppError thrown for both paths; CODE_TITLES[GONE_LINK_INVALID] = Gone serialized identically.

---

### FR-SHARE-5: List share links for a note (GET /notes/:id/shares)

[OK] FR-SHARE-5: Endpoint exists -- router.get /:noteId/shares in shares.ts resolves to GET /notes/:noteId/shares.

[OK] FR-SHARE-5: Auth enforced -- router.use(requireAuth) applies.

[OK] FR-SHARE-5: Must own note -- assertNoteOwner(userId, noteId) called first in listShares service.

[OK] FR-SHARE-5: Returns all shares ordered createdAt DESC -- prisma.noteShare.findMany with orderBy {createdAt: desc}; no revokedAt filter; active and revoked shares both included.

[OK] FR-SHARE-5: Success response 200 [{id, token, shareUrl, expiresAt, revokedAt, viewCount, createdAt}] -- all fields present; shareUrl computed via buildShareUrl.

[OK] FR-SHARE-5: 401 AUTH_TOKEN_INVALID -- requireAuth middleware.

[OK] FR-SHARE-5: 404 NOTE_NOT_FOUND -- assertNoteOwner throws when note not owned or not found.

---

### FR-ARCH-1: Three-layer structure

[OK] FR-ARCH-1: routes/shares.ts -- only router registration and .catch(next) wiring; no business logic; no Prisma import.

[OK] FR-ARCH-1: routes/public.ts -- only router registration and .catch(next) wiring; rate limiter instantiation as middleware config is acceptable; no Prisma import.

[OK] FR-ARCH-1: controllers/shares.controller.ts -- no @prisma/client import; no direct Prisma calls; Zod validate -> service call -> res.json() only.

[OK] FR-ARCH-1: services/shares.service.ts -- no Express types (Request/Response) imported; all DB access via prisma.*; business logic here.

---

### Error Handler

[OK] errorHandler.ts: SHARE_NOT_FOUND added to CODE_TITLES with value Share not found.

[OK] errorHandler.ts: GONE_LINK_INVALID added to CODE_TITLES with value Gone.

[OK] errorHandler.ts: RFC 7807 format {type, title, status, detail, code} returned for all AppError instances.

---

### Schema (packages/shared)

[OK] FR-SHARE-1: createShareSchema exported with expiresAt optional ISO 8601 datetime and future-only refine.

[OK] FR-SHARE-1: CreateShareInput type exported.

---

### Security

[OK] SEC: SHARE_BASE_URL read from process.env in shares.service.ts; no hardcoded production URL; localhost fallback is local-dev only.

[OK] SEC: Public endpoint exposes only {title, body, viewCount, sharedAt}; no userId or other metadata leaked.

[OK] SEC: Token generated with crypto.randomBytes(24) CSPRNG; not user-controlled.

---

### NoteShare Data Model (schema.prisma)

[OK] FR-SHARE-1: NoteShare model fields correct: id (cuid), noteId, token (@unique @db.VarChar(32)), expiresAt (DateTime?), revokedAt (DateTime?), viewCount (Int @default(0)), createdAt (@default(now())).

[OK] FR-SHARE-1: @@index([noteId]) and @@index([token]) present for efficient token lookup.

[OK] FR-SHARE-1: Note.shares NoteShare[] relation with onDelete: Cascade.

---

### Test Coverage

[COVERAGE] FR-SHARE-1 SHARE-CREATE-S1: No integration test for POST /notes/:id/shares without expiry (201, token exactly 32 chars, URL-safe). No share test file exists in apps/api/src/__tests__/.

[COVERAGE] FR-SHARE-1 SHARE-CREATE-S2: No integration test for POST /notes/:id/shares with future expiresAt (201, expiresAt matches).

[COVERAGE] FR-SHARE-1 SHARE-CREATE-S3: No integration test for POST /notes/:id/shares with past expiresAt (400 VALIDATION_FAILED).

[COVERAGE] FR-SHARE-1 createShareSchema: createShareSchema absent from shared-schemas.test.ts; not imported or exercised in any describe block.

[COVERAGE] FR-SHARE-2 SHARE-REVOKE-S1: No test for DELETE on active share (204; subsequent GET /public/shares/:token returns 410).

[COVERAGE] FR-SHARE-2 SHARE-REVOKE-S2: No test for double-revoke returning 204 (idempotency).

[COVERAGE] FR-SHARE-3 SHARE-VIEW-S1: No test for GET /public/shares/:token returning 200 with {title, body, viewCount: 1, sharedAt}.

[COVERAGE] FR-SHARE-3 SHARE-VIEW-S2: No test for expired share returning 410 GONE_LINK_INVALID.

[COVERAGE] FR-SHARE-3 SHARE-VIEW-S3: No test for revoked share returning 410 GONE_LINK_INVALID.

[COVERAGE] FR-SHARE-3 SHARE-VIEW-S4: No concurrent-request test verifying atomic viewCount (10 parallel requests -> viewCount = 10 in DB).

[COVERAGE] FR-SHARE-3: No test verifying soft-deleted note share returns 410 (not 404 or 200).

[COVERAGE] FR-SHARE-5 SHARE-LIST-S1: No test for GET /notes/:id/shares returning both active and revoked shares ordered createdAt DESC.

[COVERAGE] FR-SHARE-5 SHARE-LIST-S2: No test for GET /notes/:id/shares on unowned note returning 404 NOTE_NOT_FOUND.

