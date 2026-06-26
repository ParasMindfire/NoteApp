# Review Log — AB-1006 Tags CRUD

## 2026-06-26T00:00:00Z -- Tasks 1–3 Review

### Task 1 — Zod schemas in `packages/shared/src/index.ts`

[OK] FR-TAG-2 name validation — `createTagSchema` enforces `z.string().min(1).max(50)`, matching FRS "name: 1-50 chars" exactly.

[OK] FR-TAG-2 color validation — `createTagSchema` enforces `z.string().regex(/^#[0-9a-fA-F]{6}$/)`, matching FRS "color: hex string matching `^#[0-9a-fA-F]{6}$`" exactly.

[OK] FR-TAG-2 `updateTagSchema` — both `name` and `color` are optional (`.optional()`), same constraints as `createTagSchema`, satisfying FRS "both fields optional, same constraints".

[OK] FR-TAG-2 types — `CreateTagInput` and `UpdateTagInput` are exported as `z.infer<typeof createTagSchema>` / `z.infer<typeof updateTagSchema>` and imported correctly in the service.

### Task 2 — Error codes in `apps/api/src/middleware/errorHandler.ts`

[OK] FR-TAG-2 TAG_NOT_FOUND — `CODE_TITLES` contains `TAG_NOT_FOUND: 'Tag not found'`, satisfying FRS "404 TAG_NOT_FOUND (for PATCH/DELETE)".

[OK] FR-TAG-2 TAG_NAME_DUPLICATE — `CODE_TITLES` contains `TAG_NAME_DUPLICATE: 'Tag name already exists'`, satisfying FRS "409 TAG_NAME_DUPLICATE".

### Task 3 — `apps/api/src/services/tags.service.ts`

[OK] FR-TAG-1 `assertTagOwner` userId scope — `where: { id: tagId, userId, deletedAt: null }` includes both `userId` AND `deletedAt: null` as required.

[OK] FR-TAG-1 cross-user access returns 404 — `assertTagOwner` throws `AppError(404, 'TAG_NOT_FOUND', ...)` on any predicate failure; never 403. Satisfies FRS "cross-user tag access returns 404".

[OK] FR-TAG-2 P2002 → 409 in `createTag` — catches `PrismaClientKnownRequestError` with `e.code === 'P2002'` and maps to `AppError(409, 'TAG_NAME_DUPLICATE', ...)`.

[OK] FR-TAG-2 P2002 → 409 in `updateTag` — same P2002 catch block present in `updateTag`, satisfying FRS "409 TAG_NAME_DUPLICATE on unique constraint violation" for PATCH.

[OK] FR-TAG-2 empty-body PATCH is 200 no-op — `updateTag` checks `hasUpdates = data.name !== undefined || data.color !== undefined`; returns the tag fetched by `assertTagOwner` without any DB write when false. Satisfies FRS/spec decision 5: "PATCH with {} performs no DB write and returns the unchanged tag with 200".

[OK] FR-TAG-3 single `_count` query — `listTags` issues exactly one `prisma.tag.findMany` with `_count: { select: { notes: { where: { note: { deletedAt: null } } } } }`. No secondary query or loop. Satisfies FRS "Use a single SQL query (no N+1)".

[OK] FR-TAG-3 noteCount filter — the `_count` where clause is `{ note: { deletedAt: null } }`, satisfying FRS "count non-deleted notes that include it".

[OK] FR-ARCH-1 no Express types in service — `tags.service.ts` imports only `Prisma` from `@prisma/client`, `prisma` from `../lib/prisma.js`, `AppError` from `../middleware/errorHandler.js`, and types from `@noteapp/shared`. No `Request` or `Response` from express is present. Satisfies FRS-ARCH-1: "services/: Business logic + all DB access via Prisma. No Express types (Request/Response)."

[COVERAGE] FR-TAG-2 has no test for the PATCH empty-body no-op sub-bullet (spec decision 5: "PATCH with {} performs no DB write and returns the unchanged tag with 200"). No `tags*.test.ts` file found in the repository. The scenario requires verification that no DB write occurs and 200 is returned.

[COVERAGE] FR-TAG-1 has no test for cross-user 404 sub-bullet (scenario TAG-S4: "PATCH another user's tag → 404 TAG_NOT_FOUND, not 403"). No `tags*.test.ts` file found.

[COVERAGE] FR-TAG-3 has no test verifying query count = 1 (no N+1). Spec scenario TAG-LIST-S1 explicitly states "the DB query count is exactly 1 (no N+1)" must be verified by test. No `tags*.test.ts` file found.

## 2026-06-26T10:00:00Z -- Task 4 Review

### Task 4 — `apps/api/src/controllers/tags.controller.ts`

**FR-ARCH-1 — Controller layer constraints**

[OK] FR-ARCH-1 no `@prisma/client` import — `tags.controller.ts` imports only `express`, `@noteapp/shared`, `../middleware/errorHandler.js`, and `../services/tags.service.js`. No `@prisma/client` import is present. Satisfies FRS-ARCH-1: "Controller file calls `prisma.*` directly or imports `@prisma/client`" is a [FAIL] trigger — this trigger is NOT hit.

[OK] FR-ARCH-1 no direct `prisma.*` calls — no Prisma client is used anywhere in the controller body. All DB work is delegated to the service layer. Satisfies FRS-ARCH-1: "No `@prisma/client` imports" in controllers.

[OK] FR-ARCH-1 `userId` read from `res.locals['userId']` — all four controller functions read `const userId = res.locals['userId'] as string;` as the first statement. Satisfies the auth middleware contract: "auth middleware sets it".

**FR-TAG-2 — Status codes match SDS contract**

[OK] FR-TAG-2 `createTagController` returns 201 on success — `res.status(201).json(tag)` at line 14. Satisfies FRS: "201 with full tag on success".

[OK] FR-TAG-2 `listTagsController` returns 200 on success — `res.status(200).json(tags)` at line 20. Satisfies FRS spec table: "200 TagListItem[]".

[OK] FR-TAG-2 `updateTagController` returns 200 on success — `res.status(200).json(tag)` at line 32. Satisfies FRS spec table: "200 Tag".

[OK] FR-TAG-2 `deleteTagController` returns 204 with no body — `res.status(204).end()` at line 39 (uses `.end()`, not `.json()`). Satisfies FRS: "204 No Content".

[OK] FR-TAG-2 validation failures → 400 VALIDATION_FAILED before hitting the service — `createTagController` (lines 8–12) and `updateTagController` (lines 26–30) both call `schema.safeParse(req.body)` and throw `AppError(400, 'VALIDATION_FAILED', ...)` before any service call if parsing fails. Satisfies FRS: "400 VALIDATION_FAILED — bad name or color format".

**FR-TAG-2 — Error propagation**

[OK] FR-TAG-2 service AppErrors propagate naturally — none of the four controller functions wrap service calls in try/catch blocks. `createTag`, `listTags`, `updateTag`, and `deleteTag` are awaited without a surrounding catch. Any `AppError` thrown by the service (404 TAG_NOT_FOUND, 409 TAG_NAME_DUPLICATE) is allowed to propagate up to the Express 5 async error handler via the route's `.catch(next)` wiring. Satisfies the intent of FR-ARCH-1 and FR-TAG-2 error code requirements.


## 2026-06-26T10:30:00Z -- Task 5 Review

### Task 5 — `apps/api/src/routes/tags.ts`

**FR-ARCH-1 — Route layer constraints**

[OK] FR-ARCH-1 no validation logic in route file — `tags.ts` contains no Zod `.parse()`, `.safeParse()`, manual field checks, or any conditional business logic. File body is exclusively `Router()` construction, `router.X()` registrations, and the default export. Satisfies FRS: "Route file contains any logic beyond router registration and `.catch(next)` wiring" is a [FAIL] trigger — this trigger is NOT hit.

[OK] FR-ARCH-1 no `@prisma/client` import — the only imports are `Router` from `'express'`, `requireAuth` from `'../middleware/auth.js'`, and the four controller functions from `'../controllers/tags.controller.js'`. No `@prisma/client` reference exists anywhere in the file. Satisfies FRS: "routes/: Express router registration + `.catch(next)` only. No business logic, no Prisma."

[OK] FR-ARCH-1 no `res.json()` or `res.status()` calls — the route file contains no direct response construction. All response work is delegated to the controller layer. Satisfies FRS route-layer constraint.

[OK] FR-ARCH-1 `.catch(next)` wiring present on all four routes — every registered route uses the pattern `(req, res, next) => controller(req, res).catch(next)`:
  - `router.post('/', requireAuth, (req, res, next) => createTagController(req, res).catch(next))`
  - `router.get('/', requireAuth, (req, res, next) => listTagsController(req, res).catch(next))`
  - `router.patch('/:id', requireAuth, (req, res, next) => updateTagController(req, res).catch(next))`
  - `router.delete('/:id', requireAuth, (req, res, next) => deleteTagController(req, res).catch(next))`
  Satisfies FRS: "routes/: Express router registration + `.catch(next)` only."

[OK] FR-ARCH-1 / FR-TAG-1 `requireAuth` applied to every route — all four routes (`POST /`, `GET /`, `PATCH /:id`, `DELETE /:id`) list `requireAuth` as the second argument (between the path and the async handler). No route is unguarded. Satisfies FRS FR-TAG-1: "All endpoints scope by current user" and FR-TAG-2: "401 AUTH_TOKEN_INVALID" as an error path on every endpoint.

## 2026-06-26T11:44:54Z -- Task 6 Review

### Task 6 — `apps/api/src/index.ts` — `/tags` router mount

**FR-TAG-2 — all four endpoints reachable via `app.use('/tags', tagsRouter)`**

[OK] FR-TAG-2 POST /tags served — `app.use('/tags', tagsRouter)` at line 20, combined with `router.post('/')` in `routes/tags.ts` (confirmed in Task 5 review), exposes `POST /tags`. Satisfies FRS FR-TAG-2: "Endpoints: POST /tags, PATCH /tags/:id, DELETE /tags/:id, GET /tags".

[OK] FR-TAG-2 GET /tags served — `router.get('/')` within `tagsRouter` resolves to `GET /tags` via the mount. Satisfies FRS FR-TAG-2 endpoint list.

[OK] FR-TAG-2 PATCH /tags/:id served — `router.patch('/:id')` within `tagsRouter` resolves to `PATCH /tags/:id` via the mount. Satisfies FRS FR-TAG-2 endpoint list.

[OK] FR-TAG-2 DELETE /tags/:id served — `router.delete('/:id')` within `tagsRouter` resolves to `DELETE /tags/:id` via the mount. Satisfies FRS FR-TAG-2 endpoint list.

**SDS.md — plural naming convention**

[OK] SDS.md "Plural names: /notes, /tags, /shares" — mount path is `/tags` (plural). Satisfies SDS endpoint convention exactly.

**Duplicate mount / conflicting routes**

[OK] No duplicate `/tags` mount — `index.ts` contains exactly one `app.use('/tags', tagsRouter)` at line 20. No other mount uses the `/tags` prefix. The three mounts are `/auth` (line 18), `/notes` (line 19), `/tags` (line 20); no path overlap exists.

**Error handler position**

[OK] `errorHandler` remains last middleware — `app.use(errorHandler)` is at line 22, after all three router mounts (lines 18–20) and after the `/health` health-check route (line 14). No middleware is registered after `errorHandler`. This preserves correct Express error-handler semantics (must be last).

## 2026-06-26T12:00:00Z -- Task 7 Review

### Task 7 — `apps/api/src/__tests__/tags.test.ts`

**FR-TAG-1 — cross-user tag access returns 404**

[OK] FR-TAG-1 TAG-S4 present and asserting 404 TAG_NOT_FOUND — test `TAG-S4: other user PATCH /tags/:ownerTagId → 404 TAG_NOT_FOUND` (lines 163–182) creates a tag as `ownerToken`, then calls `PATCH /tags/:tagId` as `otherToken`, and asserts `res.status` is 404 and `res.body.code` is `'TAG_NOT_FOUND'`. Satisfies FRS: "cross-user tag access returns 404".

**FR-TAG-2 — scenarios TAG-S1..S5 pass; duplicate name within user → 409; same name allowed across different users**

[OK] FR-TAG-2 TAG-S1 present (create tag → 201) — test `TAG-S1: POST /tags with valid body → 201 with { id, name, color, createdAt }` (lines 105–118) asserts `res.status` is 201 and verifies all four response fields (`id`, `name`, `color`, `createdAt`) are present and correct. Satisfies FRS: "201 with full tag on success".

[OK] FR-TAG-2 TAG-S2 present (duplicate name → 409 TAG_NAME_DUPLICATE) — test `TAG-S2: POST /tags with existing name → 409 TAG_NAME_DUPLICATE` (lines 121–137) creates the tag first then re-creates with same name, and asserts `res.status` is 409 and `res.body.code` is `'TAG_NAME_DUPLICATE'`. Satisfies FRS: "409 TAG_NAME_DUPLICATE on unique constraint violation".

[OK] FR-TAG-2 TAG-S3 present (same name different user → 201) — test `TAG-S3: owner creates Work, other creates Work → 201 for other user` (lines 139–157) creates tag "Work" as `ownerToken` then creates tag "Work" as `otherToken` and asserts `res.status` is 201 and `body.name` is `'Work'`. Satisfies FRS: "same name allowed across different users".

[OK] FR-TAG-2 TAG-S4 present (cross-user PATCH → 404) — same test described under FR-TAG-1 above. Satisfies FRS: scenarios TAG-S4 pass.

[OK] FR-TAG-2 TAG-S5 present (delete → 204; absent from list) — test `TAG-S5: DELETE /tags/:id → 204; GET /tags does not contain deleted tag` (lines 189–215) asserts `deleteRes.status` is 204, then calls `GET /tags` and verifies the deleted tag `id` is absent from the response array. Satisfies FRS: "soft delete; tag absent from list endpoint post-deletion".

[OK] FR-TAG-2 TAG-VALIDATION-S1 present (invalid color → 400 VALIDATION_FAILED) — test `TAG-VALIDATION-S1: POST /tags with color "red" → 400 VALIDATION_FAILED` (lines 223–232) asserts `res.status` is 400 and `res.body.code` is `'VALIDATION_FAILED'`. Satisfies FRS: "400 VALIDATION_FAILED — bad name or color format".

[OK] FR-TAG-2 TAG-VALIDATION-S2 present (name too long → 400 VALIDATION_FAILED) — test `TAG-VALIDATION-S2: POST /tags with 51-char name → 400 VALIDATION_FAILED` (lines 235–246) creates a 51-character name string and asserts `res.status` is 400 and `res.body.code` is `'VALIDATION_FAILED'`. Satisfies FRS: "name: 1-50 chars" and "400 VALIDATION_FAILED".

**FR-TAG-3 — scenarios TAG-LIST-S1..S2 pass; noteCount accurate; no N+1**

[OK] FR-TAG-3 TAG-LIST-S1 present and asserting correct noteCounts — test `TAG-LIST-S1: tagA has 3 notes, tagB has 1 note → GET /tags returns correct noteCounts` (lines 253–302) creates two tags, associates three notes with tag A and one note with tag B, calls `GET /tags`, and asserts `tagA.noteCount` is 3 and `tagB.noteCount` is 1. Satisfies FRS: "noteCount accurate".

[OK] FR-TAG-3 TAG-LIST-S2 present and asserting soft-deleted note exclusion — test `TAG-LIST-S2: tagA with 3 notes, 1 soft-deleted → GET /tags returns tagA noteCount: 2` (lines 305–349) creates three notes, soft-deletes one via `DELETE /notes/:id`, calls `GET /tags`, and asserts `tagA.noteCount` is 2. Soft-delete is confirmed by asserting the `DELETE /notes/:id` response is 204. Satisfies FRS: "count non-deleted notes that include it".

[WARN] FR-TAG-3 N+1 query count assertion relaxed to code-review comment — FRS states "no N+1 (verified by test query count)" and spec scenario TAG-LIST-S1 states "the DB query count is exactly 1 (no N+1)". The test file contains the comment `// N+1 check: verified by code review — single _count query in tags.service.ts` (line 287) but makes no runtime assertion on the number of DB queries issued. The plan noted this relaxation was acceptable if Prisma query events were not available; no [FAIL] is raised, but this is a minor drift from the literal FRS wording "verified by test query count".

**Error code assertions across all tests**

[OK] 400 VALIDATION_FAILED — both TAG-VALIDATION-S1 and TAG-VALIDATION-S2 assert `res.body.code === 'VALIDATION_FAILED'` explicitly.

[OK] 404 TAG_NOT_FOUND — TAG-S4 asserts `res.body.code === 'TAG_NOT_FOUND'` explicitly.

[OK] 409 TAG_NAME_DUPLICATE — TAG-S2 asserts `res.body.code === 'TAG_NAME_DUPLICATE'` explicitly.

[COVERAGE] FR-TAG-2 has no test for 401 AUTH_TOKEN_INVALID — FRS states "401 AUTH_TOKEN_INVALID" as an error code for all four tag endpoints. No test in the file calls any tag endpoint without a token (or with an invalid token) and asserts a 401 response with code AUTH_TOKEN_INVALID. This error path has zero test coverage.

[COVERAGE] FR-TAG-2 has no test for the PATCH empty-body no-op (spec decision 5) — no test sends `PATCH /tags/:id` with an empty body `{}` and asserts 200 with the unchanged tag. This sub-bullet was flagged as uncovered in the Task 3 review and remains uncovered in Task 7.
