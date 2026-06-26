---
status: ARCHIVED
ticket: AB-1005
---

# Notes List, Sort, and Tag Filter

## Overview
AB-1005 adds the `GET /notes` list endpoint to the existing Notes domain. It builds directly
on the `Note`, `Tag`, and `NoteTag` models introduced in AB-1004, adding cursor-based
pagination, multi-field sort, and AND-semantic tag filtering. Two composite Prisma indexes
are added via migration to enable efficient keyset pagination without full-table scans.

## Goals
- Implement `GET /notes` with opaque cursor pagination (FR-NOTE-5)
- Support `?sort=field:direction` with four valid combinations (FR-NOTE-6)
- Support `?tagIds=t1,t2` AND-semantic tag filter with ownership validation (FR-NOTE-7)
- Add DB indexes for pagination performance

## Non-Goals
- Full-text search `body_text` column (FR-SEARCH-1..3 → AB-1007)
- Tag CRUD endpoints (FR-TAG-1..3 → AB-1006)
- Version history endpoints (FR-VER-1..5 → AB-1009)
- Sharing endpoints (FR-SHARE-1..4 → AB-1008)
- Slim list DTO (body omitted for bandwidth) — deferred to a future optimization ticket

## FRs Covered
- FR-NOTE-5 — cursor-paginated list
- FR-NOTE-6 — sort by createdAt or updatedAt × asc/desc
- FR-NOTE-7 — filter by tags (AND semantics); foreign tagIds → 422

## API Contract

| Method | Path | Auth | Success | FRs |
|--------|------|------|---------|-----|
| GET | /notes | Bearer JWT | 200 PaginatedNotes | FR-NOTE-5, FR-NOTE-6, FR-NOTE-7 |

Full request/response shapes and error codes are in `delta-openapi.yaml`.

**Query parameters:**

| Param | Type | Default | Constraints |
|-------|------|---------|-------------|
| cursor | string | — | opaque; 400 if malformed |
| limit | integer | 20 | 1–50; 400 if > 50 or ≤ 0 |
| sort | string | `createdAt:desc` | `(createdAt\|updatedAt):(asc\|desc)`; 400 if invalid |
| tagIds | string | — | comma-separated cuid list; 422 if any foreign |

## Data Model

No new tables. Two composite indexes are added to `Note` to support keyset pagination:

```prisma
model Note {
  // ... existing fields unchanged ...

  @@index([userId, createdAt, id])
  @@index([userId, updatedAt, id])
}
```

One new migration: `YYYYMMDDHHMMSS_note_list_indexes`.

The `id` column is included in each index as a tiebreaker so the cursor predicate
`(sortField, id) > (lastValue, lastId)` can be satisfied by a single index seek.

## Ticket-Specific Decisions

1. **Full Note body in list response**: `GET /notes` returns the full `Note` shape (including
   `body` TipTap JSON), per FR-NOTE-5 `{ items: Note[], nextCursor }`. The `Note` type
   established in AB-1004 always includes `body`; diverging here would create a type mismatch
   with the shared schema. If list payload size becomes a concern, a slim list DTO (omitting
   `body`) can be introduced in a future optimization ticket without a contract break.

2. **Cursor encoding**: The cursor is `base64url(JSON.stringify({ lastId: string, lastValue:
   string }))` where `lastValue` is the ISO 8601 UTC timestamp of the sort field (createdAt or
   updatedAt). Base64url (RFC 4648 §5, no `+`/`/`/`=`) is chosen over standard base64 to
   avoid percent-encoding in query strings. A cursor that cannot be base64-decoded or whose
   JSON is malformed returns 400 VALIDATION_FAILED.

3. **Tie-breaking**: When two notes share the same sort field timestamp, results are
   additionally ordered by `id ASC` (cuid is lexicographically monotonic). The cursor
   encodes both `lastValue` (sort field) and `lastId` so the keyset predicate is:
   - `createdAt:desc` → `(createdAt < lastValue) OR (createdAt = lastValue AND id > lastId)`
   - `createdAt:asc`  → `(createdAt > lastValue) OR (createdAt = lastValue AND id > lastId)`
   - (same pattern for updatedAt variants)

4. **AND semantics for tagIds**: A note qualifies only if it possesses ALL listed tags.
   Implemented via `AND: tagIds.map(tagId => ({ tags: { some: { tagId } } }))` — one Prisma
   `EXISTS` sub-query per tagId. This is correct for junction-table AND semantics; `every`
   would invert the logic (it asks "every tag the note has is in the filter list", not "the
   note has every tag in the filter list"). Tag ownership is validated before the main query:
   if any tagId is not found in `Tag WHERE userId = currentUserId`, return 422 INVALID_TAG
   immediately. An empty `?tagIds=` (empty string after splitting) is treated as "no filter
   applied".

5. **Composite DB indexes**: `(userId, createdAt, id)` and `(userId, updatedAt, id)` cover
   both sort directions under the userId equality predicate that is always present. Including
   `id` enables the tiebreaker keyset predicate to be resolved in a single index seek.

6. **`limit ≤ 0` is VALIDATION_FAILED**: Values ≤ 0 are treated identically to > 50.
   Zod: `z.coerce.number().int().min(1).max(50).default(20)`.

7. **`sort` default**: When the `sort` param is absent, the server defaults to
   `createdAt:desc`. Zod: `z.string().regex(...).default('createdAt:desc')`.

## Scenarios

### Paginated List (FR-NOTE-5)

**NOTE-LIST-S1 — First page, default limit**
Given a user has 25 non-deleted notes,
When `GET /notes` is called with no query params,
Then 200 is returned with `{ items: [20 notes, createdAt:desc order], nextCursor: <non-null string> }`.
*Validates: FR-NOTE-5 (default limit 20; nextCursor present when more results exist)*

**NOTE-LIST-S2 — Second page via cursor exhausts results**
Given the user has 25 notes and `nextCursor` from NOTE-LIST-S1,
When `GET /notes?cursor=<nextCursor>` is called,
Then 200 is returned with `{ items: [5 notes], nextCursor: null }`.
*Validates: FR-NOTE-5 (cursor advances page; nextCursor null at last page)*

**NOTE-LIST-S3 — limit > 50 rejected**
When `GET /notes?limit=51` is called,
Then 400 VALIDATION_FAILED is returned.
*Validates: FR-NOTE-5 (limit > 50 → 400)*

**NOTE-LIST-S4 — Invalid cursor rejected**
When `GET /notes?cursor=not!!valid` is called,
Then 400 VALIDATION_FAILED is returned.
*Validates: FR-NOTE-5 (invalid cursor → 400)*

**NOTE-LIST-S5 — Soft-deleted notes excluded**
Given a user has 3 notes, 1 of which is soft-deleted,
When `GET /notes` is called,
Then 200 is returned with `{ items: [2 notes] }` (deleted note absent).
*Validates: FR-NOTE-5 (only non-deleted notes returned)*

### Sort (FR-NOTE-6)

**NOTE-LIST-SORT-S1 — createdAt:desc**
Given 3 notes created in chronological order A, B, C,
When `GET /notes?sort=createdAt:desc` is called,
Then items are returned in order C, B, A.
*Validates: FR-NOTE-6 (createdAt:desc combination)*

**NOTE-LIST-SORT-S2 — createdAt:asc**
Given the same 3 notes,
When `GET /notes?sort=createdAt:asc` is called,
Then items are returned in order A, B, C.
*Validates: FR-NOTE-6 (createdAt:asc combination)*

**NOTE-LIST-SORT-S3 — updatedAt:desc**
Given 3 notes where note A was most recently updated,
When `GET /notes?sort=updatedAt:desc` is called,
Then note A is the first item.
*Validates: FR-NOTE-6 (updatedAt:desc combination)*

**NOTE-LIST-SORT-S4 — updatedAt:asc**
Given 3 notes where note B was least recently updated,
When `GET /notes?sort=updatedAt:asc` is called,
Then note B is the first item.
*Validates: FR-NOTE-6 (updatedAt:asc combination)*

**NOTE-LIST-SORT-S5 — Invalid sort value rejected**
When `GET /notes?sort=bogus:sideways` is called,
Then 400 VALIDATION_FAILED is returned.
*Validates: FR-NOTE-6 (invalid sort field or direction → 400)*

### Filter by Tags (FR-NOTE-7)

**NOTE-LIST-TAG-S1 — Single tag filter**
Given notes N1 (tag A), N2 (tags A and B), N3 (tag B only),
When `GET /notes?tagIds=<A>` is called,
Then items contain N1 and N2; N3 is absent.
*Validates: FR-NOTE-7 (basic tag filter)*

**NOTE-LIST-TAG-S2 — AND semantics (not OR)**
Given notes N1 (tag A), N2 (tags A and B), N3 (tag B only),
When `GET /notes?tagIds=<A>,<B>` is called,
Then only N2 is returned (only it possesses BOTH tags).
*Validates: FR-NOTE-7 (AND semantics confirmed — not OR)*

**NOTE-LIST-TAG-S3 — Foreign tagId rejected**
Given a tagId belonging to a different user,
When `GET /notes?tagIds=<foreignId>` is called,
Then 422 INVALID_TAG is returned.
*Validates: FR-NOTE-7 (foreign tagId → 422)*

## Dependencies
- AB-1004 merged (provides Note, Tag, NoteTag models; three-layer structure; `notes.service.ts` starting point)
