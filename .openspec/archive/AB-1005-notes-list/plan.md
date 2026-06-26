---
status: ARCHIVED
ticket: AB-1005
---

# Implementation Plan — Notes List, Sort, and Tag Filter

## Dependencies
- AB-1004 merged (Note, Tag, NoteTag, NoteVersion models; three-layer structure;
  `notes.service.ts` / `notes.controller.ts` / `routes/notes.ts` as starting point)

## New Packages
None. All required tools (Prisma, Zod, Express, Node `Buffer`) are already pinned.

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/__tests__/notes.list.test.ts` | Integration tests — all 13 list scenarios |

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add `@@index([userId, createdAt, id])` and `@@index([userId, updatedAt, id])` to Note model |
| `packages/shared/src/index.ts` | Add `listNotesQuerySchema` Zod schema + `ListNotesQuery` export |
| `apps/api/src/services/notes.service.ts` | Add `listNotes()` function + cursor helpers |
| `apps/api/src/controllers/notes.controller.ts` | Add `listNotesController` |
| `apps/api/src/routes/notes.ts` | Wire `GET /` → `listNotesController` (before `GET /:id`) |

## Generated (do not hand-write)

| Artifact | How |
|----------|-----|
| `apps/api/prisma/migrations/YYYYMMDDHHMMSS_note_list_indexes/migration.sql` | `pnpm --filter api prisma migrate dev --name note_list_indexes` |

---

## Step-by-Step Implementation

### Step 1 — Prisma schema: add indexes

In `apps/api/prisma/schema.prisma`, append to the `Note` model (after the existing relations):

```prisma
@@index([userId, createdAt, id])
@@index([userId, updatedAt, id])
```

Then run `pnpm --filter api prisma migrate dev --name note_list_indexes` to generate the
migration SQL and regenerate the Prisma Client.

**Why these indexes:** every list query includes `WHERE userId = $1 AND deletedAt IS NULL`
plus an ORDER BY on one of the two sort fields. Including `id` enables the keyset tiebreaker
predicate `(createdAt, id) < (lastValue, lastId)` to be resolved in a single index seek
without a sort step.

---

### Step 2 — Shared schema: `listNotesQuerySchema`

In `packages/shared/src/index.ts`, add after the existing note schemas:

```typescript
export const listNotesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(50, 'limit must be at most 50').default(20),
  sort: z
    .string()
    .regex(/^(createdAt|updatedAt):(asc|desc)$/, 'sort must be one of: createdAt:asc, createdAt:desc, updatedAt:asc, updatedAt:desc')
    .default('createdAt:desc'),
  tagIds: z.string().optional(), // raw comma-separated string; splitting happens in controller
});

export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
```

Then run `pnpm --filter shared build` to rebuild the CJS/ESM output.

**Notes:**
- `z.coerce.number()` is required because query params arrive as strings.
- `tagIds` stays as an optional raw string here; the controller splits it into `string[]`
  before passing to the service.

---

### Step 3 — Service: `listNotes`

Add to `apps/api/src/services/notes.service.ts`:

#### 3a — Cursor helpers (internal, not exported)

```typescript
interface Cursor {
  lastId: string;
  lastValue: string; // ISO 8601 UTC timestamp
}

function encodeCursor(lastId: string, lastValue: Date): string {
  return Buffer.from(JSON.stringify({ lastId, lastValue: lastValue.toISOString() })).toString('base64url');
}

function decodeCursor(raw: string): Cursor {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)['lastId'] !== 'string' ||
      typeof (parsed as Record<string, unknown>)['lastValue'] !== 'string'
    ) {
      throw new Error('bad shape');
    }
    return parsed as Cursor;
  } catch {
    throw new AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor');
  }
}
```

#### 3b — `listNotes` function signature + interface

```typescript
export interface ListNotesInput {
  cursor?: string;
  limit: number;
  sortField: 'createdAt' | 'updatedAt';
  sortDir: 'asc' | 'desc';
  tagIds: string[]; // already split and ownership-validated by caller? No — service validates ownership.
}

export interface PaginatedNotes {
  items: NoteResponse[];
  nextCursor: string | null;
}

export async function listNotes(
  userId: string,
  input: ListNotesInput,
): Promise<PaginatedNotes>
```

#### 3c — Implementation logic

```
1. Tag ownership validation (if tagIds.length > 0):
   - Query Tag WHERE id IN tagIds AND userId = userId
   - If count !== tagIds.length → throw AppError(422, 'INVALID_TAG', ...)

2. Cursor decoding (if cursor provided):
   - Call decodeCursor(cursor) → { lastId, lastValue }
   - Build keyset WHERE clause:
     - sortDir = 'desc': (sortField < lastValue) OR (sortField = lastValue AND id > lastId)
     - sortDir = 'asc' : (sortField > lastValue) OR (sortField = lastValue AND id > lastId)

3. Build Prisma where:
   {
     userId,
     deletedAt: null,
     ...(tagIds.length > 0 && {
       AND: tagIds.map(tagId => ({ tags: { some: { tagId } } }))
     }),
     ...(cursor && { OR: [keyset predicate as above] })
   }

4. Fetch limit + 1 records with:
   orderBy: [{ [sortField]: sortDir }, { id: 'asc' }]
   select: same select as toNoteResponse() helper (id, title, body, version, createdAt, updatedAt, tags)

5. Determine nextCursor:
   - If results.length === limit + 1: pop last record; encode cursor from the new last record
   - Else: nextCursor = null

6. Return { items: results.map(toNoteResponse), nextCursor }
```

**AND semantics:** `AND: tagIds.map(tagId => ({ tags: { some: { tagId } } }))` asks Prisma to
generate `EXISTS (SELECT 1 FROM NoteTag WHERE noteId = Note.id AND tagId = $n)` for each
tagId — correct AND behavior. (Do NOT use `tags: { every: { tagId: { in: tagIds } } }` — that
reads "every tag the note has must be in the list", which is the inverse of what we want.)

---

### Step 4 — Controller: `listNotesController`

Add to `apps/api/src/controllers/notes.controller.ts`:

```typescript
export async function listNotesController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;

  // Validate query params
  const result = listNotesQuerySchema.safeParse(req.query);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid query parameters';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }

  const { cursor, limit, sort, tagIds: rawTagIds } = result.data;

  // Parse sort string
  const [sortField, sortDir] = sort.split(':') as ['createdAt' | 'updatedAt', 'asc' | 'desc'];

  // Parse tagIds — split comma-separated string, drop empty strings
  const tagIds = rawTagIds
    ? rawTagIds.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const paginated = await listNotes(userId, { cursor, limit, sortField, sortDir, tagIds });
  res.status(200).json(paginated);
}
```

Import `listNotesQuerySchema` from `@noteapp/shared` alongside the existing schema imports.

---

### Step 5 — Route: wire `GET /`

In `apps/api/src/routes/notes.ts`, add before the `router.get('/:id', ...)` handler:

```typescript
router.get('/', (req, res, next) => {
  listNotesController(req, res).catch(next);
});
```

Import `listNotesController` alongside the existing controller imports.

**Ordering note:** In Express, `GET /` and `GET /:id` are distinct patterns — a request to
`GET /notes` never matches `/:id`. Placing `GET /` first is for readability only.

---

### Step 6 — Tests: `notes.list.test.ts`

New file at `apps/api/src/__tests__/notes.list.test.ts`. Same test-app setup pattern as
`notes.test.ts` (express + supertest + prisma). Uses `beforeEach` to delete notes and tags
between scenarios.

| Scenario | What it tests |
|----------|--------------|
| NOTE-LIST-S1 | 25 notes → first page returns 20 items + non-null nextCursor |
| NOTE-LIST-S2 | nextCursor from S1 → second page returns 5 items + null nextCursor |
| NOTE-LIST-S3 | `?limit=51` → 400 VALIDATION_FAILED |
| NOTE-LIST-S4 | `?cursor=!!!invalid` → 400 VALIDATION_FAILED |
| NOTE-LIST-S5 | 1 soft-deleted note among 3 → only 2 returned |
| NOTE-LIST-SORT-S1 | `?sort=createdAt:desc` → items in reverse creation order |
| NOTE-LIST-SORT-S2 | `?sort=createdAt:asc` → items in creation order |
| NOTE-LIST-SORT-S3 | `?sort=updatedAt:desc` → most-recently-updated first |
| NOTE-LIST-SORT-S4 | `?sort=updatedAt:asc` → least-recently-updated first |
| NOTE-LIST-SORT-S5 | `?sort=bogus:sideways` → 400 VALIDATION_FAILED |
| NOTE-LIST-TAG-S1 | `?tagIds=<A>` → returns only notes that have tag A |
| NOTE-LIST-TAG-S2 | `?tagIds=<A>,<B>` → AND semantics (only notes with BOTH tags) |
| NOTE-LIST-TAG-S3 | `?tagIds=<foreignId>` → 422 INVALID_TAG |

**Sort test setup:** To avoid relying on sub-millisecond timestamp differences, create notes
via direct Prisma inserts with explicit `createdAt`/`updatedAt` values set progressively
(e.g., 1-second apart using `new Date(Date.now() - 2000)` etc.).

---

## Prisma Schema Diff (summary)

```diff
 model Note {
   id        String    @id @default(cuid())
   userId    String
   title     String    @db.VarChar(200)
   body      Json
   version   Int       @default(1)
   createdAt DateTime  @default(now())
   updatedAt DateTime  @updatedAt
   deletedAt DateTime?

   user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
   tags     NoteTag[]
   versions NoteVersion[]
+
+  @@index([userId, createdAt, id])
+  @@index([userId, updatedAt, id])
 }
```

---

## Risk Areas

1. **Keyset cursor with `updatedAt` sort:** `updatedAt` changes on every PATCH. If a note is
   edited between page 1 and page 2 fetches, its position in the sort order may change and it
   could be skipped or duplicated. This is a known trade-off of cursor pagination on mutable
   fields and is acceptable for v1 — document in code comment.

2. **Prisma AND tag filter performance:** `AND: tagIds.map(tagId => ({ tags: { some: { tagId } } }))` generates
   one `EXISTS` sub-query per tagId. For a large filter list this is fine (tag lists are short
   by design), but note the trade-off. The NoteTag `@@id([noteId, tagId])` composite PK acts
   as a covering index for these lookups.

3. **`z.coerce.number()` and non-numeric `limit`:** A request with `?limit=abc` will fail
   coercion and Zod will return a parse error → 400. Confirmed correct behavior.

4. **`base64url` in Node 22:** `Buffer.from(str, 'base64url')` and `.toString('base64url')`
   are supported since Node 16. No polyfill needed.

5. **`GET /` route ordering in Express:** Adding `router.get('/', ...)` does not conflict with
   `router.get('/:id', ...)`. Confirmed by Express routing semantics — `:id` requires a
   non-empty segment.

---

## Test Strategy Summary

- All 13 scenarios live in one new file (`notes.list.test.ts`) to isolate list concerns from
  the existing CRUD test file.
- Sort tests use Prisma direct inserts with explicit timestamps to guarantee deterministic
  ordering regardless of test execution speed.
- Cursor tests use the full two-request flow (page 1 → extract nextCursor → page 2) to
  exercise the encode/decode round-trip.
- Tag AND semantics test (NOTE-LIST-TAG-S2) creates 3 notes with overlapping tags and
  asserts exactly 1 result to prove AND, not OR.
