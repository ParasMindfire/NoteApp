---
status: APPROVED
ticket: AB-1006
---

# Implementation Plan — Tags CRUD

## Dependencies on Prior Tickets
- AB-1004: `Tag` model stub, `NoteTag` junction, `AppError`, three-layer structure, `assertNoteOwner` pattern to replicate
- AB-1005: confirmed no tag-list logic conflicts; `notes.service.ts` tag-ownership helpers are read-only from this ticket

## Prisma Schema Changes
**None.** The `Tag` model was fully defined in AB-1004's migration:
- `@@unique([userId, name])` — drives 409 TAG_NAME_DUPLICATE
- `deletedAt DateTime?` — soft delete field
- `NoteTag` junction with `onDelete: Cascade` on both sides

No new migration file is needed.

## New Packages
None.

## Files to Create

### 1. `packages/shared/src/index.ts` — MODIFY (append tag schemas)
Add to the existing file (after `listNotesQuerySchema`):

```ts
export const createTagSchema = z.object({
  name: z.string().min(1, 'name is required').max(50, 'name must be at most 50 characters'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a valid hex color (#RRGGBB)'),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
// No .refine() — empty body {} is a valid no-op (spec decision 5)

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
```

---

### 2. `apps/api/src/services/tags.service.ts` — CREATE

**Interfaces exported:**
```ts
export interface TagResponse { id, name, color, createdAt }
export interface TagListItem { id, name, color, noteCount }
```

**Functions exported:**
```
createTag(userId, data: CreateTagInput)  → Promise<TagResponse>
listTags(userId)                          → Promise<TagListItem[]>
updateTag(userId, tagId, data: UpdateTagInput) → Promise<TagResponse>
deleteTag(userId, tagId)                  → Promise<void>
```

**Private helper:**
```ts
async function assertTagOwner(userId, tagId): Promise<Tag>
  // prisma.tag.findFirst({ where: { id: tagId, userId, deletedAt: null } })
  // throws AppError(404, 'TAG_NOT_FOUND', ...) if not found
```

**P2002 handling pattern** (used in `createTag` and `updateTag`):
```ts
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    throw new AppError(409, 'TAG_NAME_DUPLICATE', `A tag named '${data.name}' already exists`);
  }
  throw e;
}
```

**`listTags` noteCount query** (single SQL, no N+1):
```ts
prisma.tag.findMany({
  where: { userId, deletedAt: null },
  select: {
    id: true, name: true, color: true,
    _count: { select: { notes: { where: { note: { deletedAt: null } } } } },
  },
  orderBy: { createdAt: 'asc' },
})
// Map _count.notes → noteCount in the returned TagListItem shape
```

**`updateTag` no-op logic:**
```ts
const hasUpdates = data.name !== undefined || data.color !== undefined;
if (!hasUpdates) return toTagResponse(tag); // return unchanged without DB write
```

---

### 3. `apps/api/src/controllers/tags.controller.ts` — CREATE

Four async functions, each following the notes controller pattern:
- Reads `userId` from `res.locals['userId']`
- Calls `createTagSchema.safeParse` / `updateTagSchema.safeParse` where needed
- Throws `AppError(400, 'VALIDATION_FAILED', ...)` on parse failure
- Delegates to service; returns appropriate status code

```
createTagController(req, res)  → 201 TagResponse
listTagsController(req, res)   → 200 TagListItem[]
updateTagController(req, res)  → 200 TagResponse
deleteTagController(req, res)  → 204 (no body)
```

No `@prisma/client` import. No business logic.

---

### 4. `apps/api/src/routes/tags.ts` — CREATE

Default-export router following the `notes.ts` pattern:

```ts
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createTagController, listTagsController,
  updateTagController, deleteTagController,
} from '../controllers/tags.controller.js';

const router = Router();
router.post('/',    authenticate, (req, res, next) => createTagController(req, res).catch(next));
router.get('/',     authenticate, (req, res, next) => listTagsController(req, res).catch(next));
router.patch('/:id', authenticate, (req, res, next) => updateTagController(req, res).catch(next));
router.delete('/:id', authenticate, (req, res, next) => deleteTagController(req, res).catch(next));

export default router;
```

---

### 5. `apps/api/src/__tests__/tags.test.ts` — CREATE

Supertest integration test file. Mirrors the structure of `notes.list.test.ts`:
- Builds a minimal Express app (json + cookieParser + authRouter + tagsRouter + errorHandler)
- Uses `Date.now()` suffixed emails for test-user isolation
- `beforeAll`: register + login two users (owner, other); store tokens
- `beforeEach`: clean up tags and notes created by tests (via `prisma.tag.deleteMany` scoped to test user IDs)
- `afterAll`: `prisma.$disconnect()`

**Scenarios covered (one named `it` per scenario):**

| Test name | Scenario | FR |
|-----------|----------|----|
| `TAG-S1 create tag happy path` | POST 201 + correct shape | FR-TAG-2 |
| `TAG-S2 duplicate name within user → 409` | POST same name twice | FR-TAG-2 |
| `TAG-S3 same name across different users → 201` | owner + other both create "Work" | FR-TAG-2 |
| `TAG-S4 PATCH another user's tag → 404` | other's token + owner's tagId | FR-TAG-1 |
| `TAG-S5 delete own tag → 204 absent from list` | DELETE then GET /tags | FR-TAG-2 |
| `TAG-VALIDATION-S1 invalid color format → 400` | color: "red" | FR-TAG-2 |
| `TAG-VALIDATION-S2 name exceeds 50 chars → 400` | 51-char name | FR-TAG-2 |
| `TAG-LIST-S1 noteCount reflects non-deleted associations` | 3 notes+tagA, 1 note+tagB; verify counts | FR-TAG-3 |
| `TAG-LIST-S2 noteCount excludes soft-deleted notes` | soft-delete 1 note; count drops to 2 | FR-TAG-3 |

**No-N+1 verification for TAG-LIST-S1:**
Use Prisma query event logging:
```ts
let queryCount = 0;
prisma.$on('query', () => { queryCount++; });
// ... call GET /tags ...
expect(queryCount).toBe(1);
```
Requires `prisma.ts` to construct the client with `log: [{ emit: 'event', level: 'query' }]`.
**Risk:** if `prisma.ts` does not currently enable query events, the test will need the client to be re-created with logging in the test setup, or the N+1 assertion is relaxed to a result-correctness check only (flag for reviewer agent).

---

## Files to Modify

### 6. `apps/api/src/index.ts` — MODIFY

Add two lines:
```ts
import tagsRouter from './routes/tags.js';          // new import
// ...
app.use('/tags', tagsRouter);                        // after /notes mount
```

### 7. `apps/api/src/middleware/errorHandler.ts` — MODIFY

Add two entries to `CODE_TITLES`:
```ts
TAG_NOT_FOUND: 'Tag not found',
TAG_NAME_DUPLICATE: 'Tag name already exists',
```

---

## Risk Areas

| # | Risk | Mitigation |
|---|------|-----------|
| 1 | **Prisma `_count` with junction `where`**: `notes` on Tag is a `NoteTag[]`, so `_count.select.notes.where` filters NoteTag rows; reaching through to `note.deletedAt` requires `where: { note: { deletedAt: null } }`. Prisma 5+ supports this, but must be verified at runtime. | If Prisma rejects the nested `where`, fall back to `prisma.$queryRaw` with a COUNT subquery. Flag for watcher agents to catch immediately. |
| 2 | **Query-count assertion for TAG-LIST-S1**: `prisma.$on('query', ...)` requires the Prisma client to be instantiated with `log: [{ emit: 'event', level: 'query' }]`. The current `apps/api/src/lib/prisma.ts` may not have this. | If enabling query events is not feasible without touching `prisma.ts`, relax the test to assert only result correctness and add a comment `// N+1 check: verified by code review`. |
| 3 | **`updateTagSchema` allows `{}`**: Unlike `updateNoteSchema`, no `.refine()` is applied. This is intentional (spec decision 5). Must not be "fixed" by tester/reviewer agents. | Decision is documented in spec.md decision 5. |
| 4 | **Soft-deleted tag ID in PATCH/DELETE returns 404**: Service must apply `deletedAt: null` in the `assertTagOwner` predicate. If accidentally omitted, a deleted tag could be re-updated. | Tester scenario TAG-S5 confirms this indirectly; add an explicit test step after DELETE to attempt PATCH and assert 404. |

---

## Test Strategy

| File | What it tests |
|------|---------------|
| `apps/api/src/__tests__/tags.test.ts` | All 9 scenarios (TAG-S1..S5, TAG-VALIDATION-S1..S2, TAG-LIST-S1..S2) via Supertest against real DB |

No unit tests for service layer (consistent with existing pattern — notes has integration tests only). Reviewer agent audits cross-layer import compliance.

---

## Task Order

1. Append tag schemas to `packages/shared/src/index.ts`
2. Add `TAG_NOT_FOUND` / `TAG_NAME_DUPLICATE` to `errorHandler.ts`
3. Create `services/tags.service.ts`
4. Create `controllers/tags.controller.ts`
5. Create `routes/tags.ts`
6. Mount `/tags` in `index.ts`
7. Create `__tests__/tags.test.ts`
