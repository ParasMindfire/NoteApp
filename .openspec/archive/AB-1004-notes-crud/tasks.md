---
status: APPROVED
ticket: AB-1004
---

# Tasks — AB-1004: Notes CRUD + Three-Layer Refactor

> After EACH completed task: invoke Tester agent (writes/runs tests) then Reviewer agent (audits vs spec + FRS).
> If watchers find gaps, propose a single FIX BUNDLE for approval before the next task.

---

- [x] **T1 — Prisma schema + migration** [PARALLEL] _(20 min)_
  - Add `Note`, `NoteVersion`, `Tag`, `NoteTag` models to `apps/api/prisma/schema.prisma`
  - Add back-references on `User`: `notes Note[]`, `tags Tag[]`
  - Run `pnpm --filter @noteapp/api exec prisma migrate dev --name add_notes_tags_note_versions`
  - Gate: `prisma validate` passes; generated client compiles with `pnpm typecheck`
  - Files touched: `apps/api/prisma/schema.prisma`, generated client
  - Scenarios: prerequisite for NOTE-CREATE-S1..S3, NOTE-READ-S1..S3, NOTE-UPDATE-S1..S3, NOTE-DELETE-S1..S2

- [x] **T2 — Shared Zod schemas** [PARALLEL] _(15 min)_
  - Add to `packages/shared/src/index.ts`:
    - `createNoteSchema` — `{ title: z.string().min(1).max(200), body: z.record(z.unknown()), tagIds: z.array(z.string()).optional() }`
    - `updateNoteSchema` — `createNoteSchema.partial().refine(obj => Object.keys(obj).length > 0)`
    - Export types: `CreateNoteInput`, `UpdateNoteInput`
  - Files touched: `packages/shared/src/index.ts`
  - Scenarios: prerequisite for all NOTE-* scenarios

- [x] **T3 — Auth service extraction** [PARALLEL] _(30 min)_
  - Create `apps/api/src/services/auth.service.ts`
  - Extract all business logic (no `Request`/`Response` imports) from the 6 fat handlers:
    - `registerUser`, `loginUser`, `refreshTokens`, `logoutUser`, `sendOtp`, `resetPassword`
  - `DUMMY_HASH` constant moves here; token generation stays here
  - Files touched: `apps/api/src/services/auth.service.ts` (new)
  - Scenarios: ARCH-REFACTOR-S1, ARCH-REFACTOR-S2

---

- [x] **T4 — Auth controller** _(20 min)_
  - Create `apps/api/src/controllers/auth.controller.ts`
  - One exported function per endpoint: Zod `safeParse` → call service → `res.json` / `res.status(204).end()`
  - Cookie ops (`setRefreshCookie`, `clearRefreshCookie`) stay in controller, not service
  - No `@prisma/client` imports
  - Files touched: `apps/api/src/controllers/auth.controller.ts` (new)
  - Scenarios: ARCH-REFACTOR-S3

- [x] **T5 — Slim auth route files** _(15 min)_
  - Slim each of the 6 auth route files to pure wiring (import controller function, register with `.catch(next)`)
  - Update `routes/auth/index.ts` imports from handlers → controllers (rate limiters unchanged)
  - Files touched: `apps/api/src/routes/auth/register.ts`, `login.ts`, `refresh.ts`, `logout.ts`, `forgot-password.ts`, `reset-password.ts`, `index.ts`
  - Scenarios: ARCH-REFACTOR-S4
  - **Critical gate:** run full auth test suite after this task — all existing scenarios must pass before proceeding

---

- [x] **T6 — Error handler update** _(5 min)_
  - Add to `CODE_TITLES` in `apps/api/src/middleware/errorHandler.ts`:
    - `NOTE_NOT_FOUND: 'Note not found'`
    - `INVALID_TAG: 'Invalid tag'`
  - Files touched: `apps/api/src/middleware/errorHandler.ts`
  - Scenarios: prerequisite for NOTE-READ-S2, NOTE-CREATE-S3

- [x] **T7 — Notes service** _(35 min)_
  - Create `apps/api/src/services/notes.service.ts`
  - No `Request`/`Response` imports
  - Functions:
    - `createNote(userId, data)` — validate tagIds ownership (single `findMany`), `prisma.note.create` with nested NoteTag
    - `getNoteById(userId, noteId)` — `WHERE id = noteId AND userId = userId AND deletedAt IS NULL`, else `AppError(404, 'NOTE_NOT_FOUND', ...)`
    - `updateNote(userId, noteId, data)` — `prisma.$transaction`: snapshot → NoteVersion, update note + increment version, replace tag set if provided
    - `deleteNote(userId, noteId)` — `assertNoteOwner` then `prisma.note.update({ data: { deletedAt: new Date() } })`
    - Private helper `assertNoteOwner(userId, noteId)` shared by update/delete
  - Files touched: `apps/api/src/services/notes.service.ts` (new)
  - Scenarios: NOTE-CREATE-S1..S3, NOTE-READ-S1..S3, NOTE-UPDATE-S1..S3, NOTE-DELETE-S1..S2

- [x] **T8 — Notes controller** _(15 min)_
  - Create `apps/api/src/controllers/notes.controller.ts`
  - No `@prisma/client` imports
  - Functions: `createNoteController`, `getNoteController`, `updateNoteController`, `deleteNoteController`
  - Files touched: `apps/api/src/controllers/notes.controller.ts` (new)
  - Scenarios: NOTE-CREATE-S1..S3, NOTE-READ-S1..S3, NOTE-UPDATE-S1..S3, NOTE-DELETE-S1..S2

- [x] **T9 — Notes router + app mount** _(10 min)_
  - Create `apps/api/src/routes/notes.ts` — wiring only, applies `requireAuth` middleware, `.catch(next)` on all handlers
  - Mount in `apps/api/src/index.ts`: `app.use('/notes', notesRouter)`
  - Files touched: `apps/api/src/routes/notes.ts` (new), `apps/api/src/index.ts`
  - Scenarios: all NOTE-* scenarios (integration path complete)
