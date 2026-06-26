---
status: APPROVED
ticket: AB-1009
---

# Plan: AB-1009 — Version History

## Prerequisites verified

| Check | Status |
|-------|--------|
| spec.md status: APPROVED | ✅ |
| NoteVersion model in schema.prisma | ✅ (from AB-1004) |
| assertNoteOwner helper in notes.service.ts | ✅ |
| toNoteResponse helper in notes.service.ts | ✅ |
| node-cron installed | ❌ must add |
| VERSION_NOT_FOUND in errorHandler CODE_TITLES | ❌ must add |
| @@index([noteId]) on NoteVersion | ❌ must migrate |

---

## New packages

| Package | Type | Version |
|---------|------|---------|
| `node-cron` | runtime | verify exact pin via Context7 during /implement |
| `@types/node-cron` | devDependency | verify exact pin via Context7 during /implement |

CLAUDE.md rule: no `^`, `~`, or `@latest`. Pin both to exact versions confirmed by Context7.

---

## Prisma changes

One new migration — add index on `NoteVersion.noteId`. No model columns change.

```prisma
// In NoteVersion model, add:
@@index([noteId])
```

Migration name: `add-noteversion-noteid-index`

Command: `pnpm --filter api prisma migrate dev --name add-noteversion-noteid-index`

> The NoteVersion model itself already exists from AB-1004. This migration only adds the missing index needed for efficient per-note version lookups and the purge query.

---

## Files to create

### 1. `apps/api/src/services/versions.service.ts`

Three exported functions:

| Function | Signature | Behavior |
|----------|-----------|----------|
| `listVersions` | `(userId, noteId) → VersionListItem[]` | assertNoteOwner → findMany ordered version DESC, select id/version/savedAt/title only |
| `getVersion` | `(userId, noteId, versionId) → VersionDetail` | assertNoteOwner → findFirst where id+noteId; 404 VERSION_NOT_FOUND if missing |
| `restoreVersion` | `(userId, noteId, versionId) → NoteResponse` | assertNoteOwner → fetch version → $transaction: (1) create pre-restore NoteVersion, (2) update note, (3) create post-restore NoteVersion → return updated note via toNoteResponse |

No Express types (`Request`/`Response`) in this file — FR-ARCH-1 enforced.

Restore transaction detail (Decision §1 in spec):
```
$transaction(async tx => {
  // 1. pre-restore snapshot
  await tx.noteVersion.create({ data: { noteId: note.id, version: note.version, title: note.title, body: note.body } })
  // 2. update note with restored content, increment version
  const updated = await tx.note.update({ where: { id: note.id }, data: { title: ver.title, body: ver.body, version: { increment: 1 }, updatedAt: new Date() }, include: { tags: true } })
  // 3. post-restore record (marks restoration event in history)
  await tx.noteVersion.create({ data: { noteId: note.id, version: updated.version, title: updated.title, body: updated.body } })
  return updated
})
```

### 2. `apps/api/src/controllers/versions.controller.ts`

Three thin controller functions — Zod validate path params, call service, `res.json()`:

| Controller | Route | Response |
|------------|-------|----------|
| `listVersions` | GET /notes/:noteId/versions | 200 array |
| `getVersion` | GET /notes/:noteId/versions/:versionId | 200 object |
| `restoreVersion` | POST /notes/:noteId/versions/:versionId/restore | 200 full note |

No `@prisma/client` imports — FR-ARCH-1 enforced.

Path params are plain strings; no Zod schema in packages/shared needed (ownership + existence validated in service).

### 3. `apps/api/src/routes/versions.ts`

Router with `mergeParams: true` so `:noteId` from the parent route is accessible in controllers:

```typescript
const router = Router({ mergeParams: true })
router.get('/',               requireAuth, (req, res, next) => listVersionsController(req, res).catch(next))
router.get('/:versionId',     requireAuth, (req, res, next) => getVersionController(req, res).catch(next))
router.post('/:versionId/restore', requireAuth, (req, res, next) => restoreVersionController(req, res).catch(next))
export default router
```

No business logic — FR-ARCH-1 enforced.

### 4. `apps/api/src/lib/purge.ts`

Exports one function `purgeOldVersions()` and the configured cron job:

```typescript
export async function purgeOldVersions(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const { count } = await prisma.noteVersion.deleteMany({ where: { savedAt: { lt: cutoff } } })
  console.log(`[PURGE] Deleted ${count} NoteVersion rows older than 90 days`)
}

export const versionPurgeCron = cron.schedule('0 3 * * *', purgeOldVersions, { scheduled: false })
```

Exporting with `scheduled: false` keeps the cron inactive until `index.ts` calls `.start()`. This makes the function testable in isolation without the scheduler running.

### 5. `apps/api/tests/versions.test.ts`

Covers all 9 spec scenarios (see Test Strategy section below).

---

## Files to modify

### `apps/api/src/middleware/errorHandler.ts`

Add to `CODE_TITLES` map:

```typescript
VERSION_NOT_FOUND: 'Not Found',
```

### `apps/api/prisma/schema.prisma`

Add to `NoteVersion` model:

```prisma
@@index([noteId])
```

### `apps/api/src/index.ts`

Two additions:

1. Mount versions router (add alongside existing note-nested routes):
```typescript
import versionsRouter from './routes/versions.js'
app.use('/notes/:noteId/versions', versionsRouter)
```

2. Start purge cron after server starts:
```typescript
import { versionPurgeCron } from './lib/purge.js'
// after app.listen(...)
versionPurgeCron.start()
```

### `apps/api/package.json`

Add to `dependencies`:
```json
"node-cron": "<exact version from Context7>"
```

Add to `devDependencies`:
```json
"@types/node-cron": "<exact version from Context7>"
```

---

## Implementation order

Steps are sequential — each depends on the prior:

1. **errorHandler.ts** — add `VERSION_NOT_FOUND`. Unblocks everything else.
2. **schema.prisma** — add `@@index([noteId])`. Run migration immediately.
3. **package.json** — install `node-cron` + types (verify version via Context7 first).
4. **versions.service.ts** — core logic; no dependencies on controller or route.
5. **lib/purge.ts** — uses prisma directly; depends only on node-cron install.
6. **versions.controller.ts** — depends on versions.service.ts.
7. **routes/versions.ts** — depends on versions.controller.ts.
8. **index.ts** — mount router + start cron; depends on steps 5 + 7.
9. **tests/versions.test.ts** — depends on everything above being wired up.

---

## Risk areas

| Risk | Mitigation |
|------|-----------|
| `node-cron` exact version — CLAUDE.md forbids `^`/`~` | Check via Context7 before editing package.json |
| `mergeParams: true` on versions router — required for `:noteId` access | Verify pattern against shares router which uses same technique |
| Restore "+2" NoteVersion count — three-step transaction | VER-RESTORE-S1 explicitly counts DB rows after; test-drives correctness |
| Purge boundary condition (exactly 90 days) — off-by-one risk | VER-PURGE-S1 seeds a row at exactly 90 days and asserts it is NOT deleted; cutoff is `< 90d`, not `<= 90d` |
| Time-sensitive purge tests — flaky if using real `Date.now()` | Inject a `cutoff` param into `purgeOldVersions(cutoffOverride?)` for tests; production path calls with no arg |
| Migration on shared dev DB — may need `prisma migrate reset` if drift | Run migration early; confirm with `prisma migrate status` |

---

## Test strategy

**One test file:** `apps/api/tests/versions.test.ts`

Test infrastructure pattern (matches existing test files in this repo): Supertest against Express app, real Prisma against test DB, seed/teardown per test.

| Scenario ID | Test description | What's verified |
|-------------|-----------------|-----------------|
| VER-SAVE-S1 | each PATCH creates exactly one NoteVersion | 2 PATCHes → 2 NoteVersion rows, note.version = 3 |
| VER-SAVE-S2 | version count equals update count after N saves | N PATCHes → N NoteVersion rows |
| VER-LIST-S1 | GET /notes/:id/versions returns newest first, no body field | array[0].version = highest; no `body` key in items |
| VER-LIST-S2 | unowned note returns 404 NOTE_NOT_FOUND | cross-user access → 404, never 403 |
| VER-VIEW-S1 | GET /notes/:id/versions/:versionId returns full version with body | body field present; matches snapshot value |
| VER-RESTORE-S1 | restore increments NoteVersion count by 2 | rows before=2, after=4; note.version incremented; old v1 row unchanged |
| VER-RESTORE-S2 | restore with bad versionId returns 404 VERSION_NOT_FOUND | unknown cuid → 404 |
| VER-PURGE-S1 | purgeOldVersions deletes rows >90d, keeps ≤90d | row at −91d deleted; row at −90d kept; row at −1d kept; log output matches |
| VER-PURGE-S2 | cron schedule string is `'0 3 * * *'` | import versionPurgeCron; check `.options` or equivalent property |

VER-PURGE-S1 uses `purgeOldVersions(cutoffOverride)` with a fixed date to avoid time-dependent flakiness.
