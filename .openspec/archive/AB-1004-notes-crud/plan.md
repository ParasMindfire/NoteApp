---
status: APPROVED
ticket: AB-1004
---

# Implementation Plan — AB-1004: Notes CRUD + Three-Layer Refactor

## Dependencies
- AB-1003 merged (current branch `feat/AB-1003-auth-password-reset` must be merged to `main` first)
- `.openspec/changes/AB-1003b-auth-layer-refactor/` archived after this ticket merges (absorbed)

## New Packages
None — all required packages (bcrypt, Prisma, Zod, Express, express-rate-limit, cookie-parser) already installed.

## Prisma Schema Changes

Add to `apps/api/prisma/schema.prisma`:
- `Note` model (id, userId, title, body, version, createdAt, updatedAt, deletedAt)
- `NoteVersion` model (id, noteId, version, title, body, savedAt)
- `Tag` model stub (id, userId, name, color, createdAt, deletedAt, @@unique([userId, name]))
- `NoteTag` join model (noteId, tagId, @@id([noteId, tagId]))
- Back-references on `User`: `notes Note[]`, `tags Tag[]`
- Migration name: `add_notes_tags_note_versions`

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/services/auth.service.ts` | Business logic extracted from fat handlers: registerUser, loginUser, refreshTokens, logoutUser, sendOtp, resetPassword |
| `apps/api/src/controllers/auth.controller.ts` | Thin wrappers: Zod validate → call service → res.json for each auth endpoint |
| `apps/api/src/services/notes.service.ts` | Notes business logic + all Prisma calls. No Express types. |
| `apps/api/src/controllers/notes.controller.ts` | Zod validate → call notes service → res.json. No Prisma imports. |
| `apps/api/src/routes/notes.ts` | Express router wiring only: router.post/get/patch/delete + .catch(next) |

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add Note, NoteVersion, Tag, NoteTag; add User back-references |
| `packages/shared/src/index.ts` | Add createNoteSchema, updateNoteSchema, TipTap body type; export inferred types |
| `apps/api/src/routes/auth/register.ts` | Slim to wiring only — single import of registerController, router call + .catch(next) |
| `apps/api/src/routes/auth/login.ts` | Same pattern |
| `apps/api/src/routes/auth/refresh.ts` | Same pattern |
| `apps/api/src/routes/auth/logout.ts` | Same pattern |
| `apps/api/src/routes/auth/forgot-password.ts` | Same pattern |
| `apps/api/src/routes/auth/reset-password.ts` | Same pattern |
| `apps/api/src/routes/auth/index.ts` | Update imports: replace handler imports with controller imports; wiring unchanged |
| `apps/api/src/index.ts` | Import and mount notesRouter at `/notes` |
| `apps/api/src/middleware/errorHandler.ts` | Add NOTE_NOT_FOUND (404), INVALID_TAG (422) to CODE_TITLES map |

## Implementation Order

### Step 1 — Prisma schema + migration
Update `schema.prisma`, run `prisma migrate dev`, regenerate client.
*Gate: `prisma validate` passes; generated client compiles.*

### Step 2 — Shared Zod schemas
Add to `packages/shared/src/index.ts`:
- `createNoteSchema` — `{ title: string (min 1, max 200), body: z.record(z.unknown()) (TipTap JSON), tagIds?: string[] }`
- `updateNoteSchema` — `.partial()` version of above, with `.refine(obj => Object.keys(obj).length > 0)` (at least one field)
- Export `CreateNoteInput`, `UpdateNoteInput` types.

### Step 3 — Auth service extraction
Create `services/auth.service.ts` with these exported functions (all business logic, no Express types):
- `registerUser(email, password)` — bcrypt hash, prisma.user.create
- `loginUser(email, password)` — bcrypt compare, token generation, prisma.refreshToken.create
- `refreshTokens(tokenValue)` — look up, validate, rotate in transaction
- `logoutUser(userId, tokenValue)` — set revokedAt
- `sendOtp(email)` — generate OTP, prisma.passwordResetOtp.create, console.log with [OTP] prefix
- `resetPassword(email, otp, newPassword)` — validate OTP attempts, bcrypt hash, update user, revoke all tokens

Note: timing-attack DUMMY_HASH constant moves into auth.service.ts.

### Step 4 — Auth controller
Create `controllers/auth.controller.ts` with one function per endpoint:
- Zod `safeParse` → throw AppError(400, 'VALIDATION_FAILED', ...) on failure
- Call corresponding service function
- `res.status(xxx).json(...)` or `res.status(204).end()`
- Cookie operations (setRefreshCookie, clearRefreshCookie) stay in controller, not service

Note: `requireAuth` middleware still applied at route level (not in controller).

### Step 5 — Slim auth route files
Each of the 6 auth route files becomes ~5 lines:
```ts
import { Router } from 'express';
import { registerController } from '../../controllers/auth.controller.js';
export const registerRouter = Router();
registerRouter.post('/', (req, res, next) => { registerController(req, res).catch(next); });
```
(Rate limiters stay in `routes/auth/index.ts` where they are now.)

### Step 6 — Notes service
Create `services/notes.service.ts`:
- `createNote(userId, { title, body, tagIds? })` — validate tagIds ownership, prisma.note.create with nested NoteTag connect
- `getNoteById(userId, noteId)` — find note where `id = noteId AND userId = userId AND deletedAt IS NULL`, else throw AppError(404)
- `updateNote(userId, noteId, { title?, body?, tagIds? })` — in a single `prisma.$transaction`: snapshot into NoteVersion, update note (increment version), replace tag set if provided
- `deleteNote(userId, noteId)` — set deletedAt = now (soft delete)

Helper: `assertNoteOwner(userId, noteId)` — shared lookup used by update/delete.

### Step 7 — Notes controller
Create `controllers/notes.controller.ts`:
- `createNoteController(req, res)` — parse body with createNoteSchema, call createNote, res.status(201).json(note)
- `getNoteController(req, res)` — call getNoteById, res.json(note)
- `updateNoteController(req, res)` — parse body with updateNoteSchema, call updateNote, res.json(note)
- `deleteNoteController(req, res)` — call deleteNote, res.status(204).end()

### Step 8 — Notes router + mount
Create `routes/notes.ts`:
```ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createNoteController, getNoteController, updateNoteController, deleteNoteController } from '../controllers/notes.controller.js';
export const notesRouter = Router();
notesRouter.use(requireAuth);
notesRouter.post('/', (req, res, next) => { createNoteController(req, res).catch(next); });
notesRouter.get('/:id', (req, res, next) => { getNoteController(req, res).catch(next); });
notesRouter.patch('/:id', (req, res, next) => { updateNoteController(req, res).catch(next); });
notesRouter.delete('/:id', (req, res, next) => { deleteNoteController(req, res).catch(next); });
```
Mount in `index.ts`: `app.use('/notes', notesRouter);`

### Step 9 — Error handler update
Add to CODE_TITLES in `errorHandler.ts`:
```ts
NOTE_NOT_FOUND: 'Note not found',
INVALID_TAG: 'Invalid tag',
```

## Test Strategy

| Test file | Scenarios covered |
|-----------|------------------|
| `apps/api/src/__tests__/notes.test.ts` (new) | NOTE-CREATE-S1..S3, NOTE-READ-S1..S3, NOTE-UPDATE-S1..S3, NOTE-DELETE-S1..S2 |
| Existing auth test files (unchanged) | ARCH-REFACTOR-S1 (pass = auth refactor is behaviorally transparent) |
| Reviewer static check | ARCH-REFACTOR-S2..S4 (cross-layer import rules) |

**Notes test setup pattern** (same as auth tests):
- `beforeAll`: create test user(s), mint access token via helper
- `beforeEach`: clean notes/tags tables
- Supertest against the Express app (no real HTTP server needed)
- For NOTE-UPDATE-S3 (atomicity): inject a mock that throws mid-transaction, assert rollback

**Coverage gate:** ≥ 80% on new files (`services/notes.service.ts`, `controllers/notes.controller.ts`, `routes/notes.ts`).

## Risk Areas

| Risk | Mitigation |
|------|------------|
| Auth refactor breaks existing tests | Run full auth test suite immediately after slimming route files (before writing any notes code). Gate progress on green. |
| PATCH transaction partially applied | Use `prisma.$transaction([...])` (batch API) to wrap snapshot + note update + NoteTag replace atomically. |
| tagIds ownership check: N+1 query | Use `prisma.tag.findMany({ where: { id: { in: tagIds }, userId } })` and compare count; single query. |
| Tag stub missing fields AB-1006 needs | AB-1006 spec will add `name`, `color` CRUD — already present in stub. No migration needed for AB-1006 table creation. |
| `updateNoteSchema` accepts empty body | `.refine` ensures at least one field is present before calling service; returns 400 otherwise. |
| cuid vs cuid2 | Existing schema uses `@default(cuid())` — new models follow the same pattern for consistency. |
