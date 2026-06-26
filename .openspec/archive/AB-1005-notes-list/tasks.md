---
status: ARCHIVED
ticket: AB-1005
---

# Tasks — Notes List, Sort, and Tag Filter

## Checklist

- [x] **Task 1 [PARALLEL] — Prisma: add composite indexes + run migration** (~15 min)
  - Edit `apps/api/prisma/schema.prisma`: append `@@index([userId, createdAt, id])` and
    `@@index([userId, updatedAt, id])` to the `Note` model (after the existing relation fields)
  - Run `pnpm --filter api prisma migrate dev --name note_list_indexes` to generate the
    migration file and regenerate Prisma Client
  - Verify migration SQL contains two `CREATE INDEX` statements
  - Files touched: `apps/api/prisma/schema.prisma`,
    `apps/api/prisma/migrations/YYYYMMDDHHMMSS_note_list_indexes/migration.sql`
  - Scenarios enabled: prerequisite for all list scenarios (no direct test coverage of indexes;
    correctness proven by pagination tests passing at scale)

- [x] **Task 2 [PARALLEL] — Shared: add `listNotesQuerySchema`** (~10 min)
  - Edit `packages/shared/src/index.ts`: add after the existing note schemas:
    - `listNotesQuerySchema` Zod object with fields: `cursor`, `limit`, `sort`, `tagIds`
    - `ListNotesQuery` type export (`z.infer<typeof listNotesQuerySchema>`)
  - Run `pnpm --filter shared build` to rebuild CJS/ESM output
  - Files touched: `packages/shared/src/index.ts`
  - Scenarios enabled: prerequisite for Tasks 3 and 4

- [x] **Task 3 — Service: add `listNotes` + cursor helpers** (~25 min)
  - Edit `apps/api/src/services/notes.service.ts`: add
    - Internal `Cursor` interface
    - `encodeCursor(lastId, lastValue)` → base64url string
    - `decodeCursor(raw)` → `Cursor` (throws AppError 400 on malformed input)
    - `ListNotesInput` interface (exported)
    - `PaginatedNotes` interface (exported)
    - `listNotes(userId, input)` async function (exported) implementing:
      1. Tag ownership validation → 422 if any tagId foreign
      2. Cursor decode + keyset WHERE predicate
      3. Prisma `findMany` with AND tag filter, keyset cursor, orderBy, limit+1
      4. nextCursor encode / null determination
  - Must run after Tasks 1 and 2
  - Files touched: `apps/api/src/services/notes.service.ts`
  - Scenarios satisfied: NOTE-LIST-S1, NOTE-LIST-S2, NOTE-LIST-S4, NOTE-LIST-S5,
    NOTE-LIST-SORT-S1..S4, NOTE-LIST-TAG-S1, NOTE-LIST-TAG-S2, NOTE-LIST-TAG-S3

- [x] **Task 4 — Controller + Route: wire `GET /notes`** (~15 min)
  - Edit `apps/api/src/controllers/notes.controller.ts`:
    - Import `listNotesQuerySchema` from `@noteapp/shared`
    - Import `listNotes, ListNotesInput` from `../services/notes.service.js`
    - Add `listNotesController(req, res)`: parse query with `listNotesQuerySchema.safeParse`,
      split `tagIds` string, call `listNotes`, respond 200
  - Edit `apps/api/src/routes/notes.ts`:
    - Import `listNotesController`
    - Add `router.get('/', (req, res, next) => { listNotesController(req, res).catch(next); })`
      before the existing `router.get('/:id', ...)` handler
  - Must run after Tasks 2 and 3
  - Files touched: `apps/api/src/controllers/notes.controller.ts`,
    `apps/api/src/routes/notes.ts`
  - Scenarios satisfied: NOTE-LIST-S3 (limit > 50 → 400 caught in controller),
    NOTE-LIST-SORT-S5 (invalid sort → 400 caught in controller)

- [x] **Task 5 — Tests: `notes.list.test.ts`** (~30 min)
  - Create `apps/api/src/__tests__/notes.list.test.ts`
  - Mirror setup pattern from `notes.test.ts`: express + supertest + prisma + beforeAll/beforeEach/afterAll
  - `beforeEach` deletes notes and tags for test users (not users themselves)
  - Sort tests use direct `prisma.note.create({ data: { ..., createdAt: new Date(base - Ns) } })`
    with explicit timestamps (1-second gaps) for deterministic ordering
  - Cursor test (NOTE-LIST-S2) does a real two-request round-trip: fetch page 1 → extract
    `nextCursor` → fetch page 2 → assert 5 items + null cursor
  - Must run after Tasks 1–4
  - Files touched: `apps/api/src/__tests__/notes.list.test.ts`
  - Scenarios covered:

    | Test name | Scenario | FR |
    |-----------|----------|----|
    | first page returns 20 of 25 items + nextCursor | NOTE-LIST-S1 | FR-NOTE-5 |
    | second page via cursor returns remaining 5 + null cursor | NOTE-LIST-S2 | FR-NOTE-5 |
    | limit > 50 → 400 VALIDATION_FAILED | NOTE-LIST-S3 | FR-NOTE-5 |
    | invalid cursor → 400 VALIDATION_FAILED | NOTE-LIST-S4 | FR-NOTE-5 |
    | soft-deleted note excluded from list | NOTE-LIST-S5 | FR-NOTE-5 |
    | sort=createdAt:desc → reverse creation order | NOTE-LIST-SORT-S1 | FR-NOTE-6 |
    | sort=createdAt:asc → chronological order | NOTE-LIST-SORT-S2 | FR-NOTE-6 |
    | sort=updatedAt:desc → most-recently-updated first | NOTE-LIST-SORT-S3 | FR-NOTE-6 |
    | sort=updatedAt:asc → least-recently-updated first | NOTE-LIST-SORT-S4 | FR-NOTE-6 |
    | sort=bogus:sideways → 400 VALIDATION_FAILED | NOTE-LIST-SORT-S5 | FR-NOTE-6 |
    | tagIds=A → notes with tag A only | NOTE-LIST-TAG-S1 | FR-NOTE-7 |
    | tagIds=A,B → AND semantics, only notes with both | NOTE-LIST-TAG-S2 | FR-NOTE-7 |
    | foreign tagId → 422 INVALID_TAG | NOTE-LIST-TAG-S3 | FR-NOTE-7 |

## Watcher Instructions (after each task completes)

After **Task 3** completes:
- Tester: verify `listNotes` unit-level logic (cursor encode/decode, tag filter shape) via
  `apps/api/src/__tests__/notes.service.test.ts` if feasible; otherwise defer to Task 5
- Reviewer: audit `notes.service.ts` — confirm no Express imports, AND tag predicate uses
  `some` (not `every`), keyset predicate has both branches (lt/gt + equality tiebreaker)

After **Task 5** completes:
- Tester: run `pnpm test --run` from workspace root; all 13 new scenarios must pass green
- Reviewer: audit `notes.list.test.ts` — confirm every scenario ID maps to exactly one test,
  AND semantics test (NOTE-LIST-TAG-S2) asserts exactly 1 result, sort tests use explicit timestamps
