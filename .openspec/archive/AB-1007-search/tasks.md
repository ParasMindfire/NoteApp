---
status: APPROVED
ticket: AB-1007
---

# AB-1007 — Full-Text Search: Tasks

Tasks are ordered so each is independently testable after completion.
Tasks marked [PARALLEL] are independent of their siblings and can run concurrently.

---

## T1 — Add `searchQuerySchema` to packages/shared [PARALLEL]
**Estimate:** 10 min
**Files touched:** `packages/shared/src/index.ts`
**Scenarios satisfied:** SEARCH-S3 (empty q → 400), SEARCH-PAGE-S1/S2 (limit validation)

Append to `packages/shared/src/index.ts`:

```typescript
export const searchQuerySchema = z.object({
  q: z.string().min(1, 'q must be a non-empty string'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;
```

Verify: `pnpm --filter @noteapp/shared build` passes with 0 errors.

---

## T2 — Prisma schema: add `bodyText` + migration with GIN index [PARALLEL]
**Estimate:** 15 min
**Files touched:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_add_note_fts/migration.sql` (generated + manually amended)

**Scenarios satisfied:** FR-SEARCH-1 (tsvector index exists in migration)

Steps:
1. Add `bodyText String @default("") @db.Text` to the `Note` model in `schema.prisma`.
2. Run: `pnpm --filter @noteapp/api exec prisma migrate dev --name add_note_fts`
3. Open the generated migration SQL file and **manually append**:
   ```sql
   -- GIN index for full-text search (manually added — Prisma cannot generate this)
   CREATE INDEX "note_fts_idx" ON "Note" USING GIN (
     to_tsvector('english', title || ' ' || "bodyText")
   );
   ```
4. Run `pnpm --filter @noteapp/api exec prisma generate` to regenerate the client.

Verify: `pnpm --filter @noteapp/api exec prisma migrate status` shows no pending migrations.

---

## T3 — Create `apps/api/src/lib/tiptap.ts` [PARALLEL]
**Estimate:** 15 min
**Files touched:** `apps/api/src/lib/tiptap.ts`
**Scenarios satisfied:** FR-SEARCH-1 (bodyText populated from TipTap JSON)

Implement `extractText(doc: unknown): string`:
- Returns `""` for `null`, non-object, or missing `content` — never throws.
- Recursively walks every node in the tree.
- Collects the `.text` string from nodes where `type === "text"`.
- Joins collected strings with a single space and trims.

No imports from Prisma or Express. Pure function, no side effects.

Verify: `pnpm typecheck` passes; unit tests in T8a will cover behaviour.

---

## T4 — Wire `$extends` bodyText middleware in `apps/api/src/lib/prisma.ts`
**Estimate:** 15 min
**Depends on:** T3
**Files touched:** `apps/api/src/lib/prisma.ts`
**Scenarios satisfied:** FR-SEARCH-1 (bodyText auto-populated on note save)

Replace the bare `new PrismaClient()` export with:

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

Verify: `pnpm typecheck` passes; existing note create/update integration tests still green (`pnpm test --run`).

---

## T5 — Create `apps/api/src/services/search.service.ts` [SUBAGENT]
**Estimate:** 45 min
**Depends on:** T1, T2, T3, T4
**Files touched:** `apps/api/src/services/search.service.ts`
**Scenarios satisfied:** SEARCH-S1, SEARCH-S2, SEARCH-HIGHLIGHT-S1, SEARCH-HIGHLIGHT-S2, SEARCH-PAGE-S1, SEARCH-PAGE-S2

Key requirements:

**Types:**
```typescript
interface SearchRow {
  id: string; title: string; body: unknown; version: number;
  tagIds: string;       // PostgreSQL array literal e.g. "{clx1,clx2}" — parse before returning
  createdAt: Date; updatedAt: Date;
  rank: number; headline: string;
}
export interface SearchInput { q: string; cursor?: string; limit: number; }
export interface SearchResultItem { note: NoteResponse; headline: string; }
export interface SearchResultPage { items: SearchResultItem[]; nextCursor: string | null; }
```

**Cursor shape:** `{ lastId: string, lastRank: number }` — base64url JSON (same encode/decode pattern as `notes.service.ts`). Throw `AppError(400, 'VALIDATION_FAILED', 'Invalid pagination cursor')` on bad input.

**SQL:** Two query branches (first page / cursor page) using `prisma.$queryRaw<SearchRow[]>` with `Prisma.sql` tagged template. The cursor branch adds:
```sql
AND (ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), query) < ${lastRank}
  OR (ts_rank(to_tsvector('english', n.title || ' ' || n."bodyText"), query) = ${lastRank}
      AND n.id > ${lastId}))
```

**`ts_headline` options string:** `'MaxFragments=3,MaxWords=15,MinWords=5,StartSel=<mark>,StopSel=</mark>'`

**`tagIds` parsing:** `tagIdsStr === '{}'` → `[]`; else `tagIdsStr.slice(1, -1).split(',').filter(Boolean)`.

**Next-page detection:** fetch `limit + 1` rows; if `rows.length > limit`, pop the extra and encode cursor from the last kept row's `id` and `rank`.

**`NoteResponse` import:** reuse the interface from `notes.service.ts` (or re-declare locally — do not import from shared).

Verify: `pnpm typecheck` passes; service is importable.

---

## T6 — Create `apps/api/src/controllers/search.controller.ts`
**Estimate:** 10 min
**Depends on:** T5
**Files touched:** `apps/api/src/controllers/search.controller.ts`
**Scenarios satisfied:** SEARCH-S3 (400 on bad query), SEARCH-S4 (401 via middleware)

```typescript
import type { Request, Response } from 'express';
import { searchQuerySchema } from '@noteapp/shared';
import { AppError } from '../middleware/errorHandler.js';
import { searchNotes } from '../services/search.service.js';

export async function searchController(req: Request, res: Response): Promise<void> {
  const userId = res.locals['userId'] as string;
  const result = searchQuerySchema.safeParse(req.query);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid input';
    throw new AppError(400, 'VALIDATION_FAILED', detail);
  }
  const page = await searchNotes(userId, result.data);
  res.status(200).json(page);
}
```

Verify: `pnpm typecheck` passes.

---

## T7 — Create route + register in `index.ts`
**Estimate:** 10 min
**Depends on:** T6
**Files touched:**
- `apps/api/src/routes/search.ts` (new)
- `apps/api/src/index.ts` (add import + `app.use`)

`routes/search.ts`:
```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { searchController } from '../controllers/search.controller.js';

const router = Router();
router.get('/', requireAuth, (req, res, next) => searchController(req, res).catch(next));
export default router;
```

`index.ts` additions:
```typescript
import searchRouter from './routes/search.js';
// …
app.use('/search', searchRouter);
```

Verify: `pnpm build` passes (0 errors, 0 warnings). Dev server starts and `GET /search?q=test` (with valid JWT) returns 200 or empty results without crashing.

---

## T8a — Unit tests: `apps/api/src/__tests__/tiptap.test.ts` [PARALLEL after T3]
**Estimate:** 15 min
**Depends on:** T3
**Files touched:** `apps/api/src/__tests__/tiptap.test.ts`
**Scenarios satisfied:** FR-SEARCH-1 (bodyText extraction correctness)

Five named tests:
- `"returns text from a simple paragraph"` — single text node
- `"returns text from nested heading and paragraph nodes"` — multi-level nesting
- `"returns empty string for empty doc"` — `{ type: "doc", content: [] }`
- `"returns empty string for null or non-object input"` — `null`, `undefined`, `42`, `"string"`
- `"joins multiple sibling text nodes with spaces"` — two paragraphs → space-separated output

Verify: `pnpm test --run` (from root) all pass.

---

## T8b — Integration tests: `apps/api/src/__tests__/search.test.ts`
**Estimate:** 40 min
**Depends on:** T7, T8a
**Files touched:** `apps/api/src/__tests__/search.test.ts`
**Scenarios satisfied:** SEARCH-S1, SEARCH-S2, SEARCH-S3, SEARCH-S4, SEARCH-HIGHLIGHT-S1, SEARCH-HIGHLIGHT-S2, SEARCH-PAGE-S1, SEARCH-PAGE-S2

**Setup:** Each test registers a user, logs in (gets `accessToken`), and creates notes **via PATCH** after creation so the `$extends` middleware fires and populates `bodyText`. (On `POST /notes`, body is set but the middleware must also fire on `create` — verify this works end-to-end.)

Named tests (one per scenario ID):

| Test name | Scenario |
|-----------|----------|
| `"SEARCH-S1: returns matching note with headline"` | SEARCH-S1 |
| `"SEARCH-S2: returns empty items for no match"` | SEARCH-S2 |
| `"SEARCH-S3: rejects empty q with 400 VALIDATION_FAILED"` | SEARCH-S3 |
| `"SEARCH-S4: rejects unauthenticated request with 401"` | SEARCH-S4 |
| `"SEARCH-HIGHLIGHT-S1: headline contains <mark> tag around matched term"` | SEARCH-HIGHLIGHT-S1 |
| `"SEARCH-HIGHLIGHT-S2: headline wraps multiple matched terms in <mark> tags"` | SEARCH-HIGHLIGHT-S2 |
| `"SEARCH-PAGE-S1: returns nextCursor when results exceed limit"` | SEARCH-PAGE-S1 |
| `"SEARCH-PAGE-S2: second page using nextCursor returns null nextCursor"` | SEARCH-PAGE-S2 |

Additional assertions in SEARCH-S1:
- `response.body.items[0].note` has shape `{ id, title, body, tagIds, version, createdAt, updatedAt }` (no `bodyText` field)
- `response.body.items[0].headline` is a non-empty string

Verify: `pnpm test --run` (from root) all 8 named tests pass; coverage ≥ 80% on new files.

---

## Watcher Invocations (after ALL tasks complete)

Per CLAUDE.md: after each completed task, invoke:
1. **Tester agent (Sonnet)** — verifies all 8 scenario IDs have a named test; runs `pnpm test --run`
2. **Reviewer agent (Opus + ultrathink)** — audits against FR-SEARCH-1, FR-SEARCH-2, FR-SEARCH-3, FR-ARCH-1; checks cross-layer imports; verifies `bodyText` absent from all API responses; checks raw SQL uses parameterized inputs only

---

## Summary

| Task | Estimate | Depends on | Parallel? | Subagent? |
|------|----------|------------|-----------|-----------|
| T1 shared schema | 10 min | — | ✓ | |
| T2 Prisma migration | 15 min | — | ✓ | |
| T3 tiptap.ts | 15 min | — | ✓ | |
| T4 prisma middleware | 15 min | T3 | | |
| T5 search.service.ts | 45 min | T1–T4 | | ✓ |
| T6 search.controller.ts | 10 min | T5 | | |
| T7 route + index.ts | 10 min | T6 | | |
| T8a tiptap.test.ts | 15 min | T3 | ✓ (after T3) | |
| T8b search.test.ts | 40 min | T7 | | |
| **Total** | **~175 min** | | | |
