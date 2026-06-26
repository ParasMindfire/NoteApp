---
status: APPROVED
ticket: AB-1007
slug: AB-1007-search
---

# AB-1007 — Full-Text Search

## Overview

AB-1007 adds a full-text search endpoint over the authenticated user's own non-deleted notes. PostgreSQL FTS (`to_tsvector` / `plainto_tsquery`) drives matching against note titles and body text. A Prisma middleware extracts plain text from TipTap JSON into a `bodyText` column on every note create/update. Results are ranked by relevance (ts_rank DESC), paginated with a keyset cursor, and include highlighted snippets (`ts_headline`) with `<mark>` wrappers around matched tokens.

## Goals

- `GET /search?q=<query>&cursor=<opaque>&limit=20` endpoint, auth-required
- PostgreSQL GIN-indexed `tsvector` over `title || bodyText`
- `bodyText` auto-populated by Prisma middleware on note create/update (no backfill)
- Relevance-ranked results; cursor encodes `{ lastId, lastRank }`
- `ts_headline` highlights with `<mark>…</mark>` wrappers
- Three-layer structure: `routes/search.ts` → `controllers/search.controller.ts` → `services/search.service.ts` (FR-ARCH-1)

## Non-Goals

- Multi-language FTS (English dictionary only)
- Sort parameters — relevance order only; no `createdAt`/`updatedAt` override
- Backfilling `bodyText` for notes that existed before this migration
- Cross-user search

## FRs Covered

- FR-SEARCH-1
- FR-SEARCH-2
- FR-SEARCH-3
- FR-ARCH-1 (three-layer convention carried forward)

## API Contract

| Method | Path    | Auth | Summary                                           |
|--------|---------|------|---------------------------------------------------|
| GET    | /search | JWT  | Full-text search own notes, ranked by relevance   |

**Query parameters:**

| Param  | Required | Type    | Constraints              | Default |
|--------|----------|---------|--------------------------|---------|
| q      | yes      | string  | non-empty                | —       |
| limit  | no       | integer | 1–50                     | 20      |
| cursor | no       | string  | opaque base64url         | —       |

**Success 200:**
```json
{
  "items": [
    {
      "note": {
        "id": "clxabc",
        "title": "Meeting notes",
        "body": { "type": "doc", "content": [] },
        "tagIds": ["clxtag1"],
        "version": 2,
        "createdAt": "2026-06-01T10:00:00.000Z",
        "updatedAt": "2026-06-10T14:30:00.000Z"
      },
      "headline": "quarterly <mark>review</mark> discussion"
    }
  ],
  "nextCursor": "eyJsYXN0SWQiOiJjbHhhYmMiLCJsYXN0UmFuayI6MC4wNzU5fQ"
}
```

**Errors:**

| Status | Code                | Trigger                                    |
|--------|---------------------|--------------------------------------------|
| 400    | VALIDATION_FAILED   | empty `q`, `limit` > 50, malformed cursor  |
| 401    | AUTH_TOKEN_INVALID  | missing or expired access token            |

See `delta-openapi.yaml` for full schema.

## Data Model

**Migration — add `bodyText` column to `Note`:**

```prisma
model Note {
  // … existing fields …
  bodyText  String   @default("") @db.Text
}
```

**Migration — GIN index (raw SQL):**
```sql
CREATE INDEX note_fts_idx ON "Note" USING GIN (
  to_tsvector('english', title || ' ' || "bodyText")
);
```

No other models change. `bodyText` is internal — excluded from all API responses (NoteResponse never exposes it).

## Ticket-Specific Decisions

### 1. TipTap text extraction
A pure function `extractText(doc: unknown): string` in `apps/api/src/lib/tiptap.ts` recursively walks the TipTap JSON tree and concatenates all text node values (nodes where `type === "text"`) separated by single spaces. No external library; TipTap JSON is stable ProseMirror format. Returns `""` for null/invalid input rather than throwing.

### 2. Prisma middleware for `bodyText`
`prisma.$extends()` with a query hook in `apps/api/src/lib/prisma.ts` intercepts `note.create` and `note.update` actions. Before the query executes, it calls `extractText(args.data.body)` and injects `bodyText` into the data payload. This is transparent to all callers — no service code changes needed for existing create/update operations. (`$use()` was the original plan; switched to `$extends()` because `$use()` is deprecated in Prisma 6.)

### 3. Cursor shape for relevance search
Cursor encodes `{ lastId: string, lastRank: number }` as base64url JSON (same helper as notes list). Keyset predicate:
```sql
ts_rank(...) < lastRank
OR (ts_rank(...) = lastRank AND id > lastId)
```
Ties are broken by cuid ascending since ts_rank returns floats with possible ties.

### 4. Raw SQL for search
`prisma.$queryRaw<SearchRow[]>` with Prisma's tagged-template (`Prisma.sql`) ensures full parameterization. `plainto_tsquery('english', $1)` handles arbitrary user input safely — no tsquery injection possible.

### 5. `ts_headline` options
```sql
ts_headline(
  'english',
  title || ' ' || "bodyText",
  query,
  'MaxFragments=3, MaxWords=15, MinWords=5, StartSel=<mark>, StopSel=</mark>'
)
```
Applied to the same concatenation as the tsvector so matches from both title and body appear in the snippet.

### 6. No backfill
`bodyText` defaults to `""` for all pre-existing notes. Those notes will not appear in FTS results until they are next saved (Prisma middleware then populates `bodyText`). This is acceptable for v1.

## Scenarios

### SEARCH-S1 — Match found in note
**Validates: FR-SEARCH-1**
- Given: authenticated user owns a note with body containing "quarterly review"
- When: `GET /search?q=review`
- Then: 200; `items` includes that note; `headline` contains `<mark>review</mark>`

### SEARCH-S2 — No match
**Validates: FR-SEARCH-1**
- Given: authenticated user owns notes with no mention of "zzznomatch"
- When: `GET /search?q=zzznomatch`
- Then: 200; `items: []`; `nextCursor: null`

### SEARCH-S3 — Empty query rejected
**Validates: FR-SEARCH-1**
- Given: authenticated user
- When: `GET /search?q=` (empty string)
- Then: 400 VALIDATION_FAILED

### SEARCH-S4 — Unauthenticated rejected
**Validates: FR-SEARCH-1**
- Given: no access token
- When: `GET /search?q=test`
- Then: 401 AUTH_TOKEN_INVALID

### SEARCH-HIGHLIGHT-S1 — `<mark>` appears in headline
**Validates: FR-SEARCH-2**
- Given: note body contains "typescript is great"
- When: `GET /search?q=typescript`
- Then: 200; result `headline` contains `<mark>typescript</mark>`

### SEARCH-HIGHLIGHT-S2 — Multiple matched terms wrapped
**Validates: FR-SEARCH-2**
- Given: note body contains "typescript and javascript frameworks"
- When: `GET /search?q=typescript javascript`
- Then: 200; `headline` wraps both matched tokens in `<mark>` tags

### SEARCH-PAGE-S1 — nextCursor present when more pages exist
**Validates: FR-SEARCH-3**
- Given: user has 25 notes all matching query "notes"
- When: `GET /search?q=notes&limit=20`
- Then: 200; `items.length === 20`; `nextCursor` is a non-null opaque string

### SEARCH-PAGE-S2 — Last page returns null nextCursor
**Validates: FR-SEARCH-3**
- Given: first-page response returned `nextCursor`
- When: `GET /search?q=notes&limit=20&cursor=<nextCursor>`
- Then: 200; remaining items returned; `nextCursor: null`

### SEARCH-PAGE-S3 — Malformed cursor rejected
**Validates: FR-SEARCH-3**
- Given: authenticated user
- When: `GET /search?q=test&cursor=NOTVALIDBASE64!!!`
- Then: 400 VALIDATION_FAILED

## Dependencies

- AB-1001 — infra (monorepo, Prisma, Vitest)
- AB-1002 — auth middleware (JWT verification)
- AB-1004 — Note model, NoteResponse shape, three-layer pattern
- AB-1005 — cursor encoding helpers (reused for `{ lastId, lastRank }`)
- AB-1006 — Tag model (NoteResponse includes `tagIds`)

All of the above must be merged before AB-1007 can ship.

## Open Questions

None.
