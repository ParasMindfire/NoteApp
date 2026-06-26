---
status: APPROVED
ticket: AB-1009
---

# Tasks: AB-1009 — Version History

## Checklist

- [ ] **Task 1** [PARALLEL] — Add `VERSION_NOT_FOUND` to error handler _(5 min)_
  - **Files:** `apps/api/src/middleware/errorHandler.ts`
  - **What:** Add `VERSION_NOT_FOUND: 'Not Found'` to the `CODE_TITLES` map
  - **Scenarios satisfied:** unblocks VER-RESTORE-S2, VER-VIEW-S1

- [ ] **Task 2** [PARALLEL] — Add `@@index([noteId])` to NoteVersion + migrate _(10 min)_
  - **Files:** `apps/api/prisma/schema.prisma`
  - **What:** Add `@@index([noteId])` to the `NoteVersion` model block; run
    `pnpm --filter api prisma migrate dev --name add-noteversion-noteid-index`
  - **Scenarios satisfied:** unblocks all VER-LIST, VER-VIEW, VER-RESTORE scenarios (index is a correctness prerequisite before any query runs)

- [ ] **Task 3** [PARALLEL] — Install `node-cron` and `@types/node-cron` _(10 min)_
  - **Files:** `apps/api/package.json`
  - **What:** Use Context7 to confirm exact stable versions; add pinned entries to `dependencies` and `devDependencies` (no `^`, `~`, or `@latest`); run `pnpm install`
  - **Scenarios satisfied:** unblocks VER-PURGE-S1, VER-PURGE-S2

- [ ] **Task 4** [PARALLEL with Task 5] — Create `services/versions.service.ts` _(30 min)_
  - **Files:** `apps/api/src/services/versions.service.ts`
  - **What:** Export three functions following FR-ARCH-1 (no Express types):
    - `listVersions(userId, noteId)` — assertNoteOwner → `findMany` ordered `version DESC`, select `id/version/savedAt/title` only (no body)
    - `getVersion(userId, noteId, versionId)` — assertNoteOwner → `findFirst` where `{ id: versionId, noteId: note.id }`; throw `AppError(404, 'VERSION_NOT_FOUND', …)` if not found
    - `restoreVersion(userId, noteId, versionId)` — assertNoteOwner → fetch version → single `$transaction`: (1) create pre-restore NoteVersion `{noteId, version: note.version, title: note.title, body: note.body}`, (2) `note.update` applying selected title+body with `version: { increment: 1 }`, (3) create post-restore NoteVersion `{noteId, version: updated.version, title: updated.title, body: updated.body}` → return via `toNoteResponse`
  - **Scenarios satisfied:** VER-SAVE-S1, VER-SAVE-S2, VER-LIST-S1, VER-LIST-S2, VER-VIEW-S1, VER-RESTORE-S1, VER-RESTORE-S2

- [ ] **Task 5** [PARALLEL with Task 4] — Create `lib/purge.ts` _(15 min)_
  - **Files:** `apps/api/src/lib/purge.ts`
  - **What:**
    - Export `purgeOldVersions(cutoffOverride?: Date)`: compute cutoff as `cutoffOverride ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)`; call `prisma.noteVersion.deleteMany({ where: { savedAt: { lt: cutoff } } })`; log `[PURGE] Deleted ${count} NoteVersion rows older than 90 days`
    - Export `versionPurgeCron = cron.schedule('0 3 * * *', purgeOldVersions, { scheduled: false })` so the cron is inactive until `index.ts` calls `.start()`
  - **Depends on:** Task 3 (node-cron installed)
  - **Scenarios satisfied:** VER-PURGE-S1, VER-PURGE-S2

- [ ] **Task 6** — Create `controllers/versions.controller.ts` _(15 min)_
  - **Files:** `apps/api/src/controllers/versions.controller.ts`
  - **What:** Three thin controller functions (no `@prisma/client` imports — FR-ARCH-1):
    - `listVersionsController(req, res)` — extract `req.params.noteId`, call `listVersions`, `res.json(result)`
    - `getVersionController(req, res)` — extract `noteId` + `versionId`, call `getVersion`, `res.json(result)`
    - `restoreVersionController(req, res)` — extract `noteId` + `versionId`, call `restoreVersion`, `res.json(result)`
  - **Depends on:** Task 4
  - **Scenarios satisfied:** all (controller wires HTTP to service)

- [ ] **Task 7** — Create `routes/versions.ts` _(10 min)_
  - **Files:** `apps/api/src/routes/versions.ts`
  - **What:** `Router({ mergeParams: true })` so `:noteId` from parent is accessible; wire three routes with `requireAuth` + `.catch(next)`:
    - `GET /` → `listVersionsController`
    - `GET /:versionId` → `getVersionController`
    - `POST /:versionId/restore` → `restoreVersionController`
  - **Depends on:** Task 6
  - **Scenarios satisfied:** all (route file is the HTTP entry point)

- [ ] **Task 8** — Wire `index.ts` (mount router + start cron) _(5 min)_
  - **Files:** `apps/api/src/index.ts`
  - **What:**
    - Import `versionsRouter` from `./routes/versions.js`; add `app.use('/notes/:noteId/versions', versionsRouter)` alongside existing route mounts
    - Import `versionPurgeCron` from `./lib/purge.js`; call `versionPurgeCron.start()` after `app.listen(…)`
  - **Depends on:** Tasks 5 + 7
  - **Scenarios satisfied:** all (server wiring)

- [ ] **Task 9** [SUBAGENT] — Write `tests/versions.test.ts` (9 scenarios) _(45 min)_
  - **Files:** `apps/api/tests/versions.test.ts`
  - **What:** One test per scenario using Supertest + real Prisma against test DB:

    | Scenario | Test name |
    |----------|-----------|
    | VER-SAVE-S1 | `each PATCH creates exactly one NoteVersion record` |
    | VER-SAVE-S2 | `version count equals update count` |
    | VER-LIST-S1 | `GET /notes/:id/versions returns newest first with no body field` |
    | VER-LIST-S2 | `GET /notes/:id/versions for unowned note returns 404 NOTE_NOT_FOUND` |
    | VER-VIEW-S1 | `GET /notes/:id/versions/:versionId returns full version with body` |
    | VER-RESTORE-S1 | `POST restore increments NoteVersion count by 2 and updates note` |
    | VER-RESTORE-S2 | `POST restore with unknown versionId returns 404 VERSION_NOT_FOUND` |
    | VER-PURGE-S1 | `purgeOldVersions deletes rows older than 90 days only` |
    | VER-PURGE-S2 | `versionPurgeCron uses schedule string 0 3 * * *` |

  - VER-PURGE-S1 calls `purgeOldVersions(cutoffOverride)` with a fixed date (not real `Date.now()`) to avoid flakiness
  - VER-RESTORE-S1 verifies row count via `prisma.noteVersion.count` after the call
  - **Depends on:** Tasks 1–8 complete
  - **Scenarios satisfied:** VER-SAVE-S1..S2, VER-LIST-S1..S2, VER-VIEW-S1, VER-RESTORE-S1..S2, VER-PURGE-S1..S2
