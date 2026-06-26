---
status: APPROVED
ticket: AB-1007
---

# AB-1007 — Full-Text Search: Implementation Plan

## Prerequisites

All of the following branches must be merged before starting:
- AB-1001 (infra), AB-1002 (auth), AB-1004 (notes CRUD)
- AB-1005 (cursor helpers in `notes.service.ts`)
- AB-1006 (Tag model; NoteResponse uses tagIds)

Current branch `feat/AB-1006-tags-crud` must be merged first.

---

## New Packages

None. All required dependencies already pinned in `apps/api/package.json`:
- `@prisma/client@6.9.0` — raw SQL via `$queryRaw`, client extensions via `$extends`
- `zod@3.25.56` — query param validation in packages/shared
- `express@5.1.0`, `vitest@4.1.9`, `supertest@7.1.0` — unchanged

---

## Prisma Schema Changes

**File:** `apps/api/prisma/schema.prisma`

Add `bodyText` field to the `Note` model:

```prisma
model Note {
  id        String    @id @default(cuid())
  userId    String
  title     String    @db.VarChar(200)
  body      Json
  bodyText  String    @default("") @db.Text   // ← NEW: plain-text for FTS
  version   Int       @default(1)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  // … relations unchanged …
}
```

`bodyText` is **never returned in API responses** — all existing select clauses use explicit field lists that do not include it.

### Migration

Run: `pnpm --filter @noteapp/api exec prisma migrate dev --name add_note_fts`

Prisma generates the `ALTER TABLE` for `bodyText`. Then **manually append** the GIN index to the generated migration SQL before committing:

```sql
-- manually added: GIN index for full-text search
CREATE INDEX "note_fts_idx" ON "Note" USING GIN (
  to_tsvector('english', title || ' ' || "bodyText")
);
```

> **Why manual**: Prisma does not generate GIN/FTS indexes via schema attributes. The index must live in the migration SQL file so it runs in CI and production.

---

## Files to Create

### 1. `apps/api/src/lib/tiptap.ts`
Pure utility — no imports from Prisma or Express.

```
extractText(doc: unknown): string
```

Recursively walks a TipTap JSON tree. Collects `.text` from every node where `type === "text"`, joins with single spaces, trims. Returns `""` for null/invalid input (never throws).

---

### 2. `packages/shared/src/index.ts` ← MODIFY (append)

Add `searchQuerySchema`:

```typescript
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'q must be a non-empty string'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
```

---

### 3. `apps/api/src/lib/prisma.ts` ← MODIFY (replace)

Replace the bare `new PrismaClient()` with a `$extends` query hook that auto-populates `bodyText` on note create/update.

> **Why `$extends` not `$use()`**: `$use()` (Prisma middleware) is deprecated in Prisma 5+ and logs warnings in Prisma 6. `$extends` with a `query` hook is the current supported API and produces no warnings.

```typescript
import { PrismaClient } from '@prisma/client';
import { extractText } from './tiptap.js';

export const prisma = new PrismaClient().$extends({
  query: {
    note: {
      create({ args, query }) {
        if (args.data.body !== undefined) {
          (args.data as Record<string, unknown>).bodyText =
            extractText(args.data.body);
        }
        return query(args);
      },
      update({ args, query }) {
        const data = args.data as Record<string, unknown>;
        if (data['body'] !== undefined) {
          data['bodyText'] = extractText(data['body']);
        }
        return query(args);
      },
    },
  },
});
```

The exported `prisma` type becomes an extended client; all existing callers continue to work unchanged because the extension only adds behaviour, not type incompatibilities.

---

### 4. `apps/api/src/services/search.service.ts` ← CREATE

Implements FTS via `prisma.$queryRaw`. Key design points:

- **Row type** `SearchRow` defined locally:
  ```typescript
  interface SearchRow {
    id: string; title: string; body: unknown; version: number;
    tagIds: string; createdAt: Date; updatedAt: Date;
    rank: number; headline: string;
  }
  ```
  `tagIds` comes back as a PostgreSQL array literal string — parsed with a helper.

- **SQL shape** (two branches: first page vs. cursor page):
  ```sql
  SELECT
    n.id, n.title, n.body, n.version, n."createdAt", n."updatedAt",
    ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), query) AS rank,
    ts_headline('english', n.title || ' ' || n."bodyText", query,
      'MaxFragments=3,MaxWords=15,MinWords=5,StartSel=<mark>,StopSel=</mark>') AS headline,
    COALESCE(array_agg(nt."tagId") FILTER (WHERE nt."tagId" IS NOT NULL), '{}') AS "tagIds"
  FROM "Note" n
  CROSS JOIN plainto_tsquery('english', ${q}) query
  LEFT JOIN "NoteTag" nt ON nt."noteId" = n.id
  WHERE n."userId" = ${userId}
    AND n."deletedAt" IS NULL
    AND to_tsvector('english', n.title || ' ' || n."bodyText") @@ query
    -- cursor predicate appended when cursor present:
    AND (rank < ${lastRank} OR (rank = ${lastRank} AND n.id > ${lastId}))
  GROUP BY n.id, rank, headline
  ORDER BY rank DESC, n.id ASC
  LIMIT ${limit + 1}
  ```

- **Cursor encode/decode**: reuse the same `encodeCursor` / `decodeCursor` helpers pattern from `notes.service.ts`, but with `{ lastId, lastRank }` shape.

- **next-page detection**: fetch `limit + 1` rows; if `rows.length > limit`, pop the extra row and encode a cursor from the last kept row.

- **Exported interface**:
  ```typescript
  export interface SearchInput { q: string; cursor?: string; limit: number; }
  export interface SearchResultItem { note: NoteResponse; headline: string; }
  export interface SearchResultPage { items: SearchResultItem[]; nextCursor: string | null; }
  export async function searchNotes(userId: string, input: SearchInput): Promise<SearchResultPage>
  ```

---

### 5. `apps/api/src/controllers/search.controller.ts` ← CREATE

Standard three-layer controller:
- Parse `req.query` with `searchQuerySchema.safeParse(req.query)`
- On failure: `throw new AppError(400, 'VALIDATION_FAILED', detail)`
- Call `searchNotes(userId, result.data)`
- `res.status(200).json(page)`

---

### 6. `apps/api/src/routes/search.ts` ← CREATE

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { searchController } from '../controllers/search.controller.js';

const router = Router();
router.get('/', requireAuth, (req, res, next) => searchController(req, res).catch(next));
export default router;
```

---

### 7. `apps/api/src/index.ts` ← MODIFY

Add one import + one `app.use()` line:
```typescript
import searchRouter from './routes/search.js';
// …
app.use('/search', searchRouter);
```

---

### 8. `apps/api/src/middleware/errorHandler.ts` ← MODIFY (minor)

No new error codes needed. `VALIDATION_FAILED` and `AUTH_TOKEN_INVALID` already registered in `CODE_TITLES`. No change required unless linting demands it.

---

## Files to Create (Tests)

### `apps/api/src/__tests__/tiptap.test.ts`
Unit tests for `extractText()`:
- Simple paragraph with one text node
- Nested nodes (heading + paragraph)
- Empty `{ type: "doc", content: [] }`
- `null` / non-object input → returns `""`
- Text from multiple sibling nodes joined by spaces

### `apps/api/src/__tests__/search.test.ts`
Integration tests using Supertest + real DB. One describe block per scenario group:

| Scenario ID       | What it tests                                        |
|-------------------|------------------------------------------------------|
| SEARCH-S1         | Match found → 200, items array non-empty             |
| SEARCH-S2         | No match → 200, items empty, nextCursor null         |
| SEARCH-S3         | Empty q → 400 VALIDATION_FAILED                      |
| SEARCH-S4         | No auth → 401 AUTH_TOKEN_INVALID                     |
| SEARCH-HIGHLIGHT-S1 | Single term → `<mark>term</mark>` in headline     |
| SEARCH-HIGHLIGHT-S2 | Two terms → both wrapped in `<mark>` tags         |
| SEARCH-PAGE-S1    | 25 matching notes, limit=20 → nextCursor present     |
| SEARCH-PAGE-S2    | Second page using nextCursor → nextCursor null       |

**Test setup note**: notes must be created AND updated (or created with body text) so the middleware populates `bodyText`. Tests that rely on body matches must trigger an update to ensure `bodyText` is populated — or the test can create a note via the service layer which goes through the Prisma extension.

---

## Implementation Order (Task Sequence)

| # | Task | Layer |
|---|------|-------|
| 1 | Add `searchQuerySchema` to `packages/shared/src/index.ts` | Shared |
| 2 | Add `bodyText` to `schema.prisma`; run migration; manually add GIN index SQL | DB |
| 3 | Create `apps/api/src/lib/tiptap.ts` (`extractText`) | Lib |
| 4 | Modify `apps/api/src/lib/prisma.ts` — wire `$extends` hook | Lib |
| 5 | Create `apps/api/src/services/search.service.ts` | Service |
| 6 | Create `apps/api/src/controllers/search.controller.ts` | Controller |
| 7 | Create `apps/api/src/routes/search.ts`; register in `index.ts` | Route |
| 8 | Write `tiptap.test.ts` (unit) + `search.test.ts` (integration) | Test |

Tasks 3 and 4 can be done together. Tasks 5–7 are sequential. Task 8 runs after 7.

---

## Risk Areas

### R1 — `$extends` type complexity (Medium)
`PrismaClient.$extends(...)` returns an opaque extended type. TypeScript may surface errors in existing files that import `prisma` if they rely on the bare `PrismaClient` type. Mitigation: the extended client is structurally compatible with the unextended one; all existing code uses `prisma.model.method()` calls which remain unchanged.

### R2 — GIN index in manual migration SQL (Medium)
If the developer runs `prisma migrate dev` without appending the GIN index SQL, the index will be missing in their local DB but present in CI (which runs the committed migration). Mitigation: add a comment in the migration file header and document in tasks.

### R3 — ts_rank float cursor precision (Low-Medium)
`ts_rank` returns a float4. Two notes with identical content can share the exact same rank value. The cursor keyset predicate handles ties via `id > lastId`, but floating-point equality in SQL (`rank = lastRank`) may drop results if the client sends a rank with truncated precision. Mitigation: encode rank in cursor as a full-precision float string (not truncated). Test SEARCH-PAGE-S1/S2 must cover a real multi-page query.

### R4 — `prisma.$queryRaw` tag array parsing (Low)
PostgreSQL returns array columns as literal strings like `{clx1,clx2}` when using `$queryRaw`. The `tagIds` column aggregated via `array_agg` arrives as a string, not a JS array. Mitigation: parse with a helper: `tagIdsStr.slice(1, -1).split(',').filter(Boolean)`.

### R5 — `bodyText` not populated for pre-existing notes (Low / By Design)
Existing notes have `bodyText = ""` and won't appear in search until next saved. This is documented in spec as a Non-Goal. No mitigation needed; document in PR description.

---

## Definition of Done Checklist

- [ ] `pnpm build` — 0 errors, 0 warnings
- [ ] `pnpm lint --max-warnings 0`
- [ ] `pnpm typecheck`
- [ ] `pnpm test --run` — all green; ≥80% coverage on new files
- [ ] Every scenario (SEARCH-S1..S4, SEARCH-HIGHLIGHT-S1..S2, SEARCH-PAGE-S1..S2) has exactly one named test
- [ ] GIN index present in committed migration SQL
- [ ] `bodyText` absent from all API response shapes (verified by test assertions)
- [ ] Reviewer agent: all [OK], no cross-layer import violations
- [ ] Tester agent: all scenario IDs covered
