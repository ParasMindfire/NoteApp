# Review Log: AB-1009 — Version History


## 2026-06-26T00:00:00Z -- Task 1 — errorHandler VERSION_NOT_FOUND

**File audited:** `apps/api/src/middleware/errorHandler.ts`

[OK] FR-VER-3 error code mapping — `VERSION_NOT_FOUND` is present in `CODE_TITLES` at line 28. FRS states "404 VERSION_NOT_FOUND" for GET /notes/:id/versions/:versionId. The entry exists: `VERSION_NOT_FOUND: 'Not Found'`.

[OK] FR-VER-4 error code mapping — same `VERSION_NOT_FOUND` entry covers the 404 required by POST /notes/:id/versions/:versionId/restore. FRS states "404 VERSION_NOT_FOUND" for this endpoint.

[OK] SDS.md RFC 7807 compliance — `errorHandler` produces `{ type, title, status, detail, code }`. The `title` field resolves via `CODE_TITLES[err.code] ?? 'An error occurred'`, so `VERSION_NOT_FOUND` will render title `'Not Found'` in the response, satisfying the RFC 7807 human-readable title requirement.

[WARN] Title value style drift — All other 404 error codes follow the pattern `'<Domain> not found'` with lowercase: `NOTE_NOT_FOUND: 'Note not found'`, `TAG_NOT_FOUND: 'Tag not found'`, `SHARE_NOT_FOUND: 'Share not found'`. `VERSION_NOT_FOUND: 'Not Found'` uses generic title-cased HTTP status phrase instead. FRS does not specify the exact title string (only the code), so this is not a [FAIL], but it is a cosmetic inconsistency. Task brief acknowledges this as acceptable.

## 2026-06-26T00:00:00Z -- Task 2 -- NoteVersion noteId index

**Files audited:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260626182019_add_noteversion_noteid_index/migration.sql`

[OK] FR-VER-2 index on noteId present -- `NoteVersion` model in schema.prisma contains `@@index([noteId])` at line 91. FRS states "returns versions ordered by version DESC" implying efficient per-note lookup; the index satisfies this performance requirement.

[OK] FR-VER-5 purge query support -- FRS states "deletes NoteVersion rows where savedAt < now - 90 days". The task brief confirms no composite index is needed for the global savedAt scan; the noteId index covers the per-note list lookup required by FR-VER-2 without interfering with the purge path.

[OK] Migration SQL correct -- `apps/api/prisma/migrations/20260626182019_add_noteversion_noteid_index/migration.sql` contains exactly one statement: `CREATE INDEX "NoteVersion_noteId_idx" ON "NoteVersion"("noteId");`. Index name follows Prisma's `<Model>_<field>_idx` convention.

[OK] No other models changed -- Migration file contains only the single `CREATE INDEX` statement. Schema review confirms all other models (User, RefreshToken, PasswordResetOtp, Note, NoteShare, Tag, NoteTag) are unchanged from prior state; no accidental modifications detected.

[OK] NoteVersion model shape intact -- Fields `id`, `noteId`, `version`, `title`, `body`, `savedAt` match the data model specified in FR-VER-1: "NoteVersion { id, noteId, version: int, title, body, savedAt }". Relation to Note with `onDelete: Cascade` is present and correct.

## 2026-06-26T00:00:00Z -- Task 3 -- node-cron install

**File audited:** `apps/api/package.json`

[OK] FR-VER-5 prerequisite satisfied -- FRS states "Implementation: Express scheduled task or node-cron". `node-cron` is now present in `dependencies` at line 20. This unblocks Task 5 (purge.ts) and Task 8 (index.ts cron start), which together satisfy FR-VER-5 acceptance scenarios VER-PURGE-S1 and VER-PURGE-S2.

[OK] Exact pinned version -- `"node-cron": "4.5.0"` has no range specifier (`^`, `~`, or `@latest`). tasks.md Task 3 requires "pinned entries ... no `^`, `~`, or `@latest`". The value `"4.5.0"` is a bare exact version string. Requirement satisfied.

[OK] `@types/node-cron` correctly absent -- node-cron v4 bundles its own TypeScript type declarations; no separate `@types/node-cron` devDependency is needed or present. Absence is intentional and correct per the task brief.

[OK] No other dependencies accidentally modified -- Diffing current `apps/api/package.json` against the last committed state (git commit `d64e09c`) confirms the only change is the single addition of `"node-cron": "4.5.0"` in `dependencies`. All other `dependencies` entries (`@noteapp/shared`, `@prisma/client`, `bcrypt`, `cookie-parser`, `dotenv`, `express`, `express-rate-limit`, `jsonwebtoken`, `zod`) and all `devDependencies` entries are identical to the prior state. No accidental modifications detected.

## 2026-06-27T00:00:00Z -- Task 4 — versions.service.ts

**Files audited:**
- `apps/api/src/services/versions.service.ts`
- `apps/api/src/services/notes.service.ts` (export additions)
- `apps/api/src/__tests__/versions.service.test.ts`

---

### FR-VER-2: GET /notes/:id/versions — list ordered version DESC, no body in list items

[OK] FR-VER-2 sub-bullet: WHERE clause scoped to owned note — `assertNoteOwner(userId, noteId)` is called first, then `findMany({ where: { noteId: note.id } })` uses `note.id` from the ownership-verified result, not a raw route param.

[OK] FR-VER-2 sub-bullet: ordered `version: 'desc'` — `orderBy: { version: 'desc' }` at line 26 matches FRS: "returns versions ordered by version DESC (newest first)".

[OK] FR-VER-2 sub-bullet: body excluded from list items — `select: { id: true, version: true, savedAt: true, title: true }` at lines 24-26. FRS states "no body in list view". Body field is absent from the SELECT.

[OK] FR-VER-2 sub-bullet: 404 NOTE_NOT_FOUND on unowned/missing note — `assertNoteOwner` throws `AppError(404, 'NOTE_NOT_FOUND', ...)`. Cross-user access returns 404, never 403, satisfying FR-NOTE-2's "never 403 — don't leak existence" rule that flows through to FR-VER-2.

---

### FR-VER-3: GET /notes/:id/versions/:versionId — full version with body; 404 VERSION_NOT_FOUND

[OK] FR-VER-3 sub-bullet: version scoped to note (`noteId: note.id` in where clause) — `findFirst({ where: { id: versionId, noteId: note.id } })` at lines 36-39. Cross-note version access is rejected.

[OK] FR-VER-3 sub-bullet: body included in detail response — `select: { id: true, version: true, savedAt: true, title: true, body: true }` at lines 37-39. FRS states "full version including body".

[OK] FR-VER-3 sub-bullet: throws VERSION_NOT_FOUND — `if (!ver) throw new AppError(404, 'VERSION_NOT_FOUND', 'Version not found')` at line 40. FRS states "404 VERSION_NOT_FOUND".

[COVERAGE] FR-VER-3 sub-bullet "404 VERSION_NOT_FOUND" has no test for the `getVersion` error path. VER-VIEW-S1 covers the happy path only. There is no named scenario testing `getVersion(ownerId, note.id, nonExistentId)` → `VERSION_NOT_FOUND`. FRS states: "Errors: 404 VERSION_NOT_FOUND". The VER-RESTORE-S2 test covers `restoreVersion` VERSION_NOT_FOUND but `getVersion` VERSION_NOT_FOUND is uncovered.

---

### FR-VER-4: POST restore — single transaction; version count +2; selected version never modified; 404 VERSION_NOT_FOUND

[OK] FR-VER-4 sub-bullet: all three writes inside single `$transaction` — steps 1 (pre-restore `noteVersion.create`), 2 (`note.update`), and 3 (post-restore `noteVersion.create`) are all inside `prisma.$transaction(async (tx) => { ... })` at lines 57-98.

[OK] FR-VER-4 sub-bullet: pre-restore snapshot uses note's current version/title/body — `note.version`, `note.title`, `note.body` from `assertNoteOwner` result are used in step 1. These reflect the current state before restoration.

[OK] FR-VER-4 sub-bullet: post-restore record uses UPDATED version/title/body — step 3 uses `updatedNote.version`, `updatedNote.title`, `updatedNote.body` from the `tx.note.update` result at lines 90-94.

[OK] FR-VER-4 sub-bullet: version count +2 — two `noteVersion.create` calls are made in the transaction. FRS states "total version count after restore = previous count + 2".

[OK] FR-VER-4 sub-bullet: selected version never modified — `ver` is only read via `findFirst` (lines 51-54). It is never written to or deleted. `noteVersion.create` always creates new rows.

[OK] FR-VER-4 sub-bullet: 404 VERSION_NOT_FOUND — `if (!ver) throw new AppError(404, 'VERSION_NOT_FOUND', ...)` at line 55 before entering the transaction.

[WARN] FR-VER-4 sub-bullet "Snapshot current state" — `note` (used for the pre-restore snapshot) and `ver` (used for the restored content) are both fetched OUTSIDE the `$transaction` block. Under concurrent PATCH requests between the `assertNoteOwner` call and the `$transaction` start, the pre-restore snapshot could record a stale `version/title/body` rather than the true note state at transaction time. FRS states "In a single transaction: 1. Snapshot current state" — reading current state outside the transaction boundary is a TOCTOU drift. Not a hard data-loss risk in low-concurrency scenarios, but deviates from the atomicity intent. Flagged as [WARN] rather than [FAIL] because FRS does not explicitly require the note re-read to occur inside the transaction.

---

### FR-ARCH-1: Services must not import Request/Response from express; controllers must not import @prisma/client

[OK] FR-ARCH-1 sub-bullet: no Express types in service — grep for `express` in `versions.service.ts` returns zero matches. No `import ... from 'express'`, no `Request`, no `Response` type references. FRS states "services/: No Express types (Request/Response)".

[OK] FR-ARCH-1 sub-bullet: `@prisma/client` import in service is permitted — FRS restricts `@prisma/client` imports only in **controllers**, not services. `versions.service.ts` imports `{ Prisma }` from `'@prisma/client'` solely for type-level use (`Prisma.JsonValue`, `Prisma.InputJsonValue`). This is consistent with every other service file in the project.

---

### Cross-user access / assertNoteOwner

[OK] Cross-user access: `assertNoteOwner` is called as the first statement in all three exported functions (`listVersions` line 22, `getVersion` line 35, `restoreVersion` line 49). No function proceeds to any DB query without first verifying ownership.

[OK] NOTE_NOT_FOUND (not 403): `assertNoteOwner` throws `AppError(404, 'NOTE_NOT_FOUND', ...)` when note is missing, deleted, or belongs to another user. This satisfies FR-NOTE-2's "never 403 — don't leak existence" principle used across version endpoints.

---

### Export additions to notes.service.ts

[OK] `assertNoteOwner` export: was already defined; `export` keyword is present at line 38, enabling import in `versions.service.ts`. No breakage to existing callers.

[OK] `toNoteResponse` export: was already defined; `export` keyword is present at line 26. Imported by `versions.service.ts` at line 6.

[OK] `NoteWithTags` export: `export type NoteWithTags` at line 16 enables the type import in `versions.service.ts`. The type includes `body` (required for pre-restore snapshot at line 64) and `version` (required at line 62).

[OK] No circular dependency: `versions.service.ts` imports from `notes.service.ts`; `notes.service.ts` does not import from `versions.service.ts`. Import graph is acyclic.

[OK] Existing exports in `notes.service.ts` unchanged: `createNote`, `getNoteById`, `updateNote`, `deleteNote`, `listNotes`, `NoteResponse`, `ListNotesInput`, `PaginatedNotes` are all still exported. No regressions introduced.

---

### Summary

| Finding | Count |
|---------|-------|
| [OK]    | 17    |
| [WARN]  | 1     |
| [FAIL]  | 0     |
| [SEC]   | 0     |
| [COVERAGE] | 1  |

## 2026-06-27T00:00:00Z -- Task 5 — lib/purge.ts

**File audited:** `apps/api/src/lib/purge.ts`

[OK] FR-VER-5 sub-bullet: cron schedule string — `cron.createTask('0 3 * * *', ...)` at line 12. Matches FRS requirement "Daily at 03:00 UTC" exactly.

[OK] FR-VER-5 sub-bullet: `cutoffOverride` parameter — `export async function purgeOldVersions(cutoffOverride?: Date): Promise<void>` at line 4. Optional override present, enabling test injection without wall-clock dependency.

[OK] FR-VER-5 sub-bullet: cutoff boundary is `< 90d` not `<= 90d` — `where: { savedAt: { lt: cutoff } }` at line 7. Prisma `lt` is strictly less-than. A row saved exactly 90 days ago is NOT deleted. Boundary requirement satisfied.

[OK] FR-VER-5 sub-bullet: `deleteMany` targets `NoteVersion` only — `prisma.noteVersion.deleteMany(...)` at line 6. No reference to `prisma.note` or any other model. The `Note` table is never touched.

[OK] FR-VER-5 sub-bullet: log line format — `console.log(\`[PURGE] Deleted ${count} NoteVersion rows older than 90 days\`)` at line 9. Contains `[PURGE]` prefix and interpolated count. Matches FRS requirement "logs purged count with [PURGE] prefix" and the task brief's specified format verbatim.

[OK] FR-VER-5 sub-bullet: `versionPurgeCron` exported without auto-start — `export const versionPurgeCron = cron.createTask(...)` at line 12. Node-cron v4 `createTask()` leaves the task in stopped state; only `schedule()` calls `.start()` automatically (confirmed in `node-cron@4.5.0/dist/node-cron.js` line 471-472). No `.start()` call exists anywhere in `purge.ts`. `index.ts` does not yet reference `versionPurgeCron` (deferred to Task 8). Cron stays inactive until `index.ts` starts it.

[OK] FR-ARCH-1 sub-bullet: no Express types in lib file — grep for `express`, `Request`, `Response` in `purge.ts` returns zero matches. Only imports are `node-cron` and `./prisma.js`. FRS states "services/: No Express types (Request/Response)"; same convention applies to `lib/`.

[COVERAGE] FR-VER-5 sub-bullet "scenarios VER-PURGE-S1..S2 pass" — no test file for `purgeOldVersions` exists in `apps/api/src/__tests__/`. The `cutoffOverride` parameter was added explicitly for testability but no test exercises it. Neither VER-PURGE-S1 (rows older than 90d deleted, count logged) nor VER-PURGE-S2 (row exactly 90d old NOT deleted, boundary check) has a named test. FRS states: "Acceptance: scenarios VER-PURGE-S1..S2 pass; cron schedule verified; logs include count."

## 2026-06-27T00:00:00Z -- Task 6 -- versions.controller.ts

**File audited:** `apps/api/src/controllers/versions.controller.ts`

[OK] FR-ARCH-1 sub-bullet "No @prisma/client imports in controller" -- imports at lines 1-6 are `import type { Request, Response } from 'express'` and `import { listVersions, getVersion, restoreVersion } from '../services/versions.service.js'` only. No `@prisma/client` reference exists anywhere in the file. FRS states "controllers/: No @prisma/client imports."

[OK] FR-ARCH-1 sub-bullet "No business logic" -- all three exported functions contain zero if/else branches, no Prisma calls, and no direct DB access. Each function is 3-4 lines: extract identifiers, call service, respond.

[OK] FR-ARCH-1 sub-bullet "userId extracted from res.locals['userId']" -- all three functions read `const userId = res.locals['userId'] as string` (lines 9, 17, 26). `userId` is never read from `req.body` or `req.params`.

[OK] FR-ARCH-1 sub-bullet "each function calls matching service and returns via res.status(N).json()" -- `listVersionsController` calls `listVersions(userId, noteId)` and responds with `res.status(200).json(versions)`; `getVersionController` calls `getVersion(userId, noteId, versionId)` and responds with `res.status(200).json(version)`; `restoreVersionController` calls `restoreVersion(userId, noteId, versionId)` and responds with `res.status(200).json(note)`. Service names match exactly.

[OK] FR-ARCH-1 sub-bullet "status codes" -- `listVersionsController` → 200 (line 13), `getVersionController` → 200 (line 22), `restoreVersionController` → 200 (line 31). All three match the brief's requirement and the delta-openapi.yaml contract.

## 2026-06-27T00:00:00Z -- Task 7+8 -- routes/versions.ts + index.ts

**Files audited:**
- `apps/api/src/routes/versions.ts`
- `apps/api/src/index.ts`

---

### FR-VER-2, FR-VER-3, FR-VER-4 — requireAuth on all three endpoints

[OK] FR-VER-2/FR-VER-3/FR-VER-4 sub-bullet "Auth: requires access token" -- `router.use(requireAuth)` at line 11 of `versions.ts` is registered BEFORE any route handler. All three routes (`GET /:noteId/versions`, `GET /:noteId/versions/:versionId`, `POST /:noteId/versions/:versionId/restore`) are therefore guarded by `requireAuth`. FRS states "Auth: requires access token; must own note" for all three endpoints.

---

### FR-VER-2, FR-VER-3, FR-VER-4 — Route paths match delta-openapi.yaml

[WARN] FR-VER-2/FR-VER-3/FR-VER-4 sub-bullet "Endpoint path" -- delta-openapi.yaml defines the path parameter as `{id}` (e.g. `/notes/{id}/versions`), but `versions.ts` uses `/:noteId/versions`. When mounted at `/notes` in `index.ts`, the full effective paths are `/notes/:noteId/versions`, `/notes/:noteId/versions/:versionId`, and `/notes/:noteId/versions/:versionId/restore`. The resolved paths are functionally identical to the OpenAPI spec (`/notes/{id}/versions` etc.), but the param name `noteId` differs from the OpenAPI param name `id`. The controller reads `req.params['noteId']` (versions.controller.ts lines 10, 18, 27), which is consistent with the router definition and produces correct runtime behavior. The mismatch is a naming convention drift between the route param identifier and the OpenAPI operationId param name -- it is not a functional error. Flagged [WARN] rather than [FAIL] because path resolution is correct; only the internal param name differs from the spec's `{id}` convention.

---

### FR-ARCH-1 — mergeParams: true on router

[OK] FR-ARCH-1 / mounting convention sub-bullet "mergeParams: true" -- `const router = Router({ mergeParams: true })` at line 9 of `versions.ts`. This matches the pattern used by `shares.ts` (also mounted at `/notes` with `mergeParams: true`). The param `:noteId` is declared directly in the router's own path strings, so `mergeParams` is not strictly required here, but its presence is correct and consistent with the project pattern for sub-routers mounted under a parent prefix.

---

### FR-VER-2, FR-VER-3, FR-VER-4 — .catch(next) on all three routes

[OK] FR-ARCH-1 sub-bullet "routes/: .catch(next) only" -- all three route handlers wrap their controller call in `.catch(next)`:
- Line 13-15: `listVersionsController(req, res).catch(next)`
- Line 17-19: `getVersionController(req, res).catch(next)`
- Line 21-23: `restoreVersionController(req, res).catch(next)`
No business logic, no Prisma calls, no if/else branches exist in the route file. FRS states "routes/: Express router registration + .catch(next) only."

---

### FR-VER-5 — versionPurgeCron.start() in app.listen callback

[OK] FR-VER-5 sub-bullet "Daily at 03:00 UTC / registered in index.ts at startup" -- `versionPurgeCron.start()` at line 37 of `index.ts` is called INSIDE the `app.listen(PORT, () => { ... })` callback. This means the cron is started only after the server is successfully listening, matching the spec.md decision: "registered in `apps/api/src/index.ts` at startup." FRS states "scheduled job (cron) ... Daily at 03:00 UTC."

[OK] FR-VER-5 sub-bullet "import of versionPurgeCron" -- `import { versionPurgeCron } from './lib/purge.js'` at line 12 of `index.ts`. Import is named, matches the export from `purge.ts`, and uses the `.js` extension required for ESM resolution.

---

### versionsRouter mounting in index.ts

[OK] FR-VER-2/FR-VER-3/FR-VER-4 sub-bullet "mounted at /notes" -- `app.use('/notes', versionsRouter)` at line 26 of `index.ts`. Combined with the router's own path prefixes (`/:noteId/versions`...), the full effective paths are `/notes/:noteId/versions`, `/notes/:noteId/versions/:versionId`, and `/notes/:noteId/versions/:versionId/restore`. These match the delta-openapi.yaml contract paths `/notes/{id}/versions`, `/notes/{id}/versions/{versionId}`, `/notes/{id}/versions/{versionId}/restore` at the HTTP layer.

---

### No duplicate mounts or ordering issues

[OK] index.ts ordering sub-bullet "no duplicate mounts" -- `versionsRouter` is mounted exactly once (`app.use('/notes', versionsRouter)` at line 26). No second `app.use('/notes', versionsRouter)` exists anywhere in the file.

[OK] index.ts ordering sub-bullet "no ordering conflict with notesRouter or sharesRouter" -- mount order is: `notesRouter` (line 24), `sharesRouter` (line 25), `versionsRouter` (line 26). All three are mounted at `/notes`. Express processes them in registration order; since they handle distinct path patterns (notes handles `/`, `/:id`; shares handles `/:noteId/shares*`; versions handles `/:noteId/versions*`), there is no route shadowing. The version routes cannot be accidentally swallowed by a notes route because notes routes use `/:id` with no `/versions` suffix.

[OK] index.ts ordering sub-bullet "errorHandler registered after all routers" -- `app.use(errorHandler)` at line 31 is the last middleware registration, after all router mounts. `.catch(next)` in route handlers will correctly propagate to `errorHandler`.

---

### Summary

| Finding    | Count |
|------------|-------|
| [OK]       | 10    |
| [WARN]     | 1     |
| [FAIL]     | 0     |
| [SEC]      | 0     |
| [COVERAGE] | 0     |

## 2026-06-27T00:00:00Z -- Task 9 -- versions.test.ts

**File audited:** `apps/api/src/__tests__/versions.test.ts`

---

### 1. Scenario ID coverage in test names

[OK] VER-SAVE-S1 named test -- `describe` string begins "VER-SAVE-S1" (line 128); `it` string begins "VER-SAVE-S1" (line 129). Scenario ID present in both. Exactly one test.

[OK] VER-SAVE-S2 named test -- `describe` string begins "VER-SAVE-S2" (line 165); `it` string begins "VER-SAVE-S2" (line 166). Exactly one test.

[OK] VER-LIST-S1 named test -- `describe` string begins "VER-LIST-S1" (line 187); `it` string begins "VER-LIST-S1" (line 188). Exactly one test.

[OK] VER-LIST-S2 named test -- `describe` string begins "VER-LIST-S2" (line 233); `it` string begins "VER-LIST-S2" (line 234). Exactly one test.

[OK] VER-VIEW-S1 named test -- `describe` string begins "VER-VIEW-S1" (line 257); `it` string begins "VER-VIEW-S1" (line 258). Exactly one test.

[OK] VER-VIEW-S2 named test -- `describe` string begins "VER-VIEW-S2" (line 315); `it` string begins "VER-VIEW-S2" (line 316). Exactly one test. This covers the `getVersion` 404 path previously flagged [COVERAGE] in Task 4.

[OK] VER-RESTORE-S1 named test -- `describe` string begins "VER-RESTORE-S1" (line 333); `it` string begins "VER-RESTORE-S1" (line 334). Exactly one test.

[OK] VER-RESTORE-S2 named test -- `describe` string begins "VER-RESTORE-S2" (line 413); `it` string begins "VER-RESTORE-S2" (line 414). Exactly one test.

[OK] VER-AUTH-S1 named test -- `describe` string begins "VER-AUTH-S1" (line 430); `it` string begins "VER-AUTH-S1" (line 431). Exactly one test.

---

### 2. FR-VER-2: List response items assert NO `body` field

[OK] FR-VER-2 sub-bullet "no body in list view" -- VER-LIST-S1 at lines 215-217 iterates every item with `for (const item of versions)` and asserts `expect(item).not.toHaveProperty('body')`. FRS states "Success response: 200 with [{ id, version, savedAt, title }] (no body in list view)". Assertion is present and covers all items, not just first.

---

### 3. FR-VER-2: List ordered version DESC

[WARN] FR-VER-2 sub-bullet "ordered by version DESC" -- VER-LIST-S1 (line 212) asserts only `versions[0].version > versions[1].version` (two-position check). The spec scenario VER-LIST-S1 states "array[0].version = 3, array[1].version = 2, array[2].version = 1" — a three-position ordering guarantee. The test constructs a note with 2 updates (yielding 2 NoteVersion rows), so there is no third element to check against. The two-item ordering check partially validates DESC order but does not verify the full three-way relationship called out in the scenario. FRS states "returns versions ordered by version DESC (newest first)". This is a drift in test depth, not a code defect — but the scenario is only partially exercised.

---

### 4. FR-VER-3: Detail response includes `body` matching snapshot

[OK] FR-VER-3 sub-bullet "full version including body" -- VER-VIEW-S1 asserts `expect(detail.body).toBeDefined()` (line 301) AND `expect(detail.body).toEqual(originalBody)` (line 304). The snapshot body is captured as `tipTapBody('original body text for view test')` before the note is updated, so the equality assertion validates the correct historical snapshot. FRS states "200 with full version including body".

---

### 5. FR-VER-4: Restore asserts version count increases by exactly 2

[OK] FR-VER-4 sub-bullet "total version count after restore = previous count + 2" -- VER-RESTORE-S1 asserts `expect(beforeVersions).toHaveLength(2)` (line 351) and `expect(afterVersions).toHaveLength(4)` (line 405). The delta is exactly 2. FRS states "total version count after restore = previous count + 2 (one snapshot of pre-restore state, one for the restored content)".

---

### 6. FR-VER-4: Restore response shape — `{ id, title, body, tagIds, createdAt, updatedAt, version }`; version = previous + 1

[OK] FR-VER-4 sub-bullet "Success response: 200 with updated note" -- VER-RESTORE-S1 asserts all seven required fields: `id` (line 385), `title` (line 386), `body` (line 387), `tagIds` as array (line 388), `createdAt` (line 389), `updatedAt` (line 390), `version` (line 393). FRS + delta-openapi.yaml `NoteResponse` schema requires exactly these seven fields.

[OK] FR-VER-4 sub-bullet "version = previous + 1" -- Note starts at version 1, receives 2 updates (version becomes 3). After restore, `expect(restoredNote.version).toBe(4)` (line 393) confirms +1 increment. FRS states "Increment note version number".

---

### 7. Error shapes: `{ type, title, status, detail, code }` with exact code strings

[OK] FR-VER-2/VER-3/VER-4/VER-AUTH error code strings -- All error-path tests assert the exact `code` string: `'NOTE_NOT_FOUND'` (lines 249, checked via `res.body.code`), `'VERSION_NOT_FOUND'` (lines 325, 422), `'AUTH_TOKEN_INVALID'` (line 435). Code strings match FRS and delta-openapi.yaml exactly.

[FAIL] FR-VER-2/VER-3/VER-4/VER-AUTH sub-bullet "error shape { type, title, status, detail, code }" -- No error-path test (`VER-LIST-S2`, `VER-VIEW-S2`, `VER-RESTORE-S2`, `VER-AUTH-S1`) asserts the presence of `type`, `title`, `status`, or `detail` fields. Tests check only `res.status` (HTTP status) and `res.body.code`. The delta-openapi.yaml `Error` schema (lines 254-268) defines `required: [type, title, status, detail, code]`. FRS references this shape via the errorHandler RFC 7807 contract: "produces { type, title, status, detail, code }". Observed code: `expect((res.body as { code: string }).code).toBe('NOTE_NOT_FOUND')` — no assertion on `type`, `title`, `status` (body field), or `detail` in any error test.

---

### 8. No cron/purge imports in the test file

[OK] No cron/purge imports -- `grep` for `import.*purge` and `import.*cron` in `versions.test.ts` returns zero matches. The test app setup (lines 33-39) explicitly omits the cron/purge registration present in `index.ts`, matching the comment "no cron/purge" at line 32. Correct isolation: integration tests for version endpoints do not start the purge scheduler.

---

### 9. afterAll cleans up DB

[OK] afterAll DB cleanup -- `afterAll` at lines 118-122 calls `prisma.user.deleteMany` for both `USER_EMAIL` and `USER_B_EMAIL`, then `prisma.$disconnect()`. The `User` → `Note` → `NoteVersion` cascade (Prisma `onDelete: Cascade` on NoteVersion.note relation) ensures all test notes and NoteVersion rows are deleted transitively when the test users are deleted. No orphaned rows remain after the suite completes.

---

### 10. Additional gap: VER-PURGE-S1, VER-PURGE-S2 not in this file

[COVERAGE] FR-VER-5 sub-bullet "scenarios VER-PURGE-S1..S2 pass" -- `versions.test.ts` contains no tests for `purgeOldVersions`. This was already flagged as [COVERAGE] in Task 5 review. The task brief for Task 9 scopes the audit to `versions.test.ts`; the gap is pre-existing and noted for completeness. A separate `purge.test.ts` is required to close FR-VER-5 acceptance.

---

### Summary

| Finding    | Count |
|------------|-------|
| [OK]       | 18    |
| [WARN]     | 1     |
| [FAIL]     | 1     |
| [SEC]      | 0     |
| [COVERAGE] | 1     |
