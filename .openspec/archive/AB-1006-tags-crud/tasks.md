---
status: APPROVED
ticket: AB-1006
---

# Tasks — Tags CRUD

## Checklist

- [x] **Task 1 — Shared tag schemas** *(10 min)*
  Add `createTagSchema`, `updateTagSchema`, `CreateTagInput`, `UpdateTagInput` to
  `packages/shared/src/index.ts` (append after `listNotesQuerySchema`).
  - Files touched: `packages/shared/src/index.ts`
  - Satisfies: TAG-VALIDATION-S1, TAG-VALIDATION-S2 (schema definitions)
  - Note: all subsequent tasks depend on this; do this first.

- [x] **Task 2 — Error code titles** *(5 min)* [PARALLEL after Task 1]
  Add `TAG_NOT_FOUND` and `TAG_NAME_DUPLICATE` entries to the `CODE_TITLES` map in
  `apps/api/src/middleware/errorHandler.ts`.
  - Files touched: `apps/api/src/middleware/errorHandler.ts`
  - Satisfies: TAG-S2, TAG-S4, TAG-S5 (correct error title in RFC 7807 response)

- [x] **Task 3 — Tags service** *(25 min)* [PARALLEL after Task 1]
  Create `apps/api/src/services/tags.service.ts` with:
  - `TagResponse` and `TagListItem` interfaces
  - `assertTagOwner(userId, tagId)` private helper (404 on miss)
  - `createTag(userId, data)` — prisma.tag.create; catch P2002 → TAG_NAME_DUPLICATE
  - `listTags(userId)` — single Prisma `_count` query with `where: { note: { deletedAt: null } }`
  - `updateTag(userId, tagId, data)` — assertTagOwner; no-op if empty; catch P2002
  - `deleteTag(userId, tagId)` — assertTagOwner; set `deletedAt = new Date()`
  - Files touched: `apps/api/src/services/tags.service.ts`
  - Satisfies: TAG-S1..S5, TAG-LIST-S1..S2 (service logic)
  - Risk: verify `_count.select.notes.where.note.deletedAt` compiles at runtime; if not, use `$queryRaw`

- [x] **Task 4 — Tags controller** *(15 min)*
  Create `apps/api/src/controllers/tags.controller.ts` with:
  - `createTagController` — safeParse createTagSchema → 201
  - `listTagsController` — 200
  - `updateTagController` — safeParse updateTagSchema → 200
  - `deleteTagController` — 204 `.end()`
  - No `@prisma/client` import; no business logic.
  - Files touched: `apps/api/src/controllers/tags.controller.ts`
  - Depends on: Task 1 (schemas), Task 3 (service)
  - Satisfies: TAG-VALIDATION-S1, TAG-VALIDATION-S2 (Zod parse in controller)

- [x] **Task 5 — Tags router** *(10 min)*
  Create `apps/api/src/routes/tags.ts` — default-export Router with four routes
  (POST /, GET /, PATCH /:id, DELETE /:id), each behind `authenticate` middleware
  with `.catch(next)` wiring only.
  - Files touched: `apps/api/src/routes/tags.ts`
  - Depends on: Task 4
  - Satisfies: FR-ARCH-1 (route layer contains only wiring)

- [x] **Task 6 — Mount /tags in app entry** *(5 min)*
  Add `import tagsRouter from './routes/tags.js'` and
  `app.use('/tags', tagsRouter)` after the `/notes` mount in
  `apps/api/src/index.ts`.
  - Files touched: `apps/api/src/index.ts`
  - Depends on: Task 5

- [x] **Task 7 — Integration tests** *(30 min)*
  Create `apps/api/src/__tests__/tags.test.ts` covering all 9 scenarios:
  - TAG-S1: POST /tags 201 with correct shape
  - TAG-S2: POST duplicate name → 409 TAG_NAME_DUPLICATE
  - TAG-S3: same name different user → 201
  - TAG-S4: PATCH other user's tag → 404 TAG_NOT_FOUND
  - TAG-S5: DELETE own tag → 204; absent from GET /tags
  - TAG-VALIDATION-S1: color "red" → 400 VALIDATION_FAILED
  - TAG-VALIDATION-S2: 51-char name → 400 VALIDATION_FAILED
  - TAG-LIST-S1: noteCount accurate (3+1); query-count assertion if feasible
  - TAG-LIST-S2: soft-deleted note excluded from noteCount
  - Files touched: `apps/api/src/__tests__/tags.test.ts`
  - Depends on: Tasks 1–6
  - Note: mirror `notes.list.test.ts` structure (minimal app, Date.now() emails,
    beforeEach cleanup scoped to test-user IDs, afterAll disconnect)
