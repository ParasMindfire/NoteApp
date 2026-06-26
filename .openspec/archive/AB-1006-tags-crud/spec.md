---
status: ARCHIVED
ticket: AB-1006
---

# Tags CRUD

## Overview
AB-1006 implements the four tag management endpoints (POST /tags, GET /tags, PATCH /tags/:id,
DELETE /tags/:id) on top of the `Tag` and `NoteTag` stub models introduced in AB-1004. Each
tag is user-scoped, has a unique name per user and a hex color. The list endpoint returns a
`noteCount` aggregate computed in a single SQL query to avoid N+1. No new Prisma migration is
needed — the Tag table was fully defined in the AB-1004 stub.

## Goals
- Implement POST /tags, PATCH /tags/:id, DELETE /tags/:id, GET /tags (FR-TAG-2)
- Enforce user-scoped namespacing — cross-user tag access returns 404 (FR-TAG-1)
- Return `noteCount` in list without N+1 (FR-TAG-3)

## Non-Goals
- Tag search / autocomplete (deferred to AB-1013 inline tag selector UX)
- Tag ordering / reordering
- Bulk tag operations
- GET /tags/:id single-tag read (not in FR-TAG-2; list is sufficient for v1)

## FRs Covered
- FR-TAG-1 — user-scoped tags; cross-user returns 404
- FR-TAG-2 — CRUD with name uniqueness per user and hex color validation
- FR-TAG-3 — GET /tags returns noteCount; single SQL, no N+1

## API Contract

| Method | Path            | Auth        | Success            | FRs                   |
|--------|-----------------|-------------|--------------------|-----------------------|
| POST   | /tags           | Bearer JWT  | 201 Tag            | FR-TAG-1, FR-TAG-2    |
| GET    | /tags           | Bearer JWT  | 200 TagListItem[]  | FR-TAG-1, FR-TAG-3    |
| PATCH  | /tags/:id       | Bearer JWT  | 200 Tag            | FR-TAG-1, FR-TAG-2    |
| DELETE | /tags/:id       | Bearer JWT  | 204                | FR-TAG-1, FR-TAG-2    |

Full request/response shapes and error codes are in `delta-openapi.yaml`.

**Tag response shape** (POST / PATCH):
```json
{ "id": "string", "name": "string", "color": "#RRGGBB", "createdAt": "ISO 8601 UTC" }
```

**TagListItem response shape** (GET /tags):
```json
{ "id": "string", "name": "string", "color": "#RRGGBB", "noteCount": 0 }
```

## Data Model

No new tables or columns. The `Tag` model was established as a stub in AB-1004 and already
contains everything needed:

```prisma
model Tag {
  id        String    @id @default(cuid())
  userId    String
  name      String    @db.VarChar(50)
  color     String    @db.VarChar(7)
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  notes NoteTag[]

  @@unique([userId, name])   // enforces 409 TAG_NAME_DUPLICATE on conflict
}
```

**No migration is required for AB-1006.**

The `@@unique([userId, name])` constraint drives the 409 response. The `deletedAt` field
supports soft delete. The `NoteTag` junction (also from AB-1004) is read-only from this
ticket's perspective; its rows are never modified by tag CRUD.

## Ticket-Specific Decisions

1. **Soft delete for tags**: DELETE /tags/:id sets `deletedAt = now` rather than issuing a
   physical `DELETE`. The `Tag` model was given a `deletedAt` field in the AB-1004 stub for
   this purpose. Hard-deleting would cascade-remove all `NoteTag` rows (Prisma `onDelete:
   Cascade`), silently stripping tag associations from existing notes. Soft delete avoids this:
   tags disappear from GET /tags (`WHERE deletedAt IS NULL`) while historical associations
   remain. A soft-deleted tag's ID returns 404 on subsequent PATCH or DELETE — same as
   nonexistent.

2. **noteCount via Prisma `_count` with `where` clause**: GET /tags uses a single Prisma query:
   ```ts
   prisma.tag.findMany({
     where: { userId, deletedAt: null },
     select: {
       id: true, name: true, color: true,
       _count: { select: { notes: { where: { note: { deletedAt: null } } } } },
     },
   })
   ```
   This translates to one SQL statement with a correlated `COUNT` subquery — no N+1. The
   integration test verifies by wrapping the call in a query-count assertion.

3. **No `updatedAt` on Tag**: The FRS response shapes (POST/PATCH return `{ id, name, color,
   createdAt }`; GET /tags returns `{ id, name, color, noteCount }`) do not include
   `updatedAt`. Adding the column would require an ALTER TABLE migration with no observable
   API benefit. Deferred to a future ticket if "last modified" sort is ever required.

4. **409 on unique constraint — Prisma P2002 mapping**: Both POST (new name already taken) and
   PATCH (rename to an existing name) can violate `@@unique([userId, name])`. The service layer
   catches `PrismaClientKnownRequestError` with `code === 'P2002'` and maps it to
   `{ status: 409, code: "TAG_NAME_DUPLICATE" }`.

5. **PATCH empty body is a no-op (200)**: A PATCH with `{}` performs no DB write and returns
   the unchanged tag with 200. Both `name` and `color` are optional in the Zod schema; the
   service skips the update call if the parsed payload has no updatable keys.

6. **Cross-user and soft-deleted IDs both return 404**: The service applies
   `WHERE id = :id AND userId = :userId AND deletedAt IS NULL` as a single condition. Any
   failure in that predicate returns 404 TAG_NOT_FOUND — never 403 (avoids leaking
   tag existence across users).

7. **Zod validation for color**: The `color` field uses
   `z.string().regex(/^#[0-9a-fA-F]{6}$/)`. Both POST and PATCH validate with the same shared
   Zod schema from `packages/shared`. An invalid format returns 400 VALIDATION_FAILED before
   any DB interaction.

## Scenarios

### Create / Uniqueness (FR-TAG-2)

**TAG-S1 — Create tag happy path**
Given a valid access token and body `{ name: "Work", color: "#FF5733" }`,
When POST /tags is called,
Then 201 is returned with `{ id, name: "Work", color: "#FF5733", createdAt }`.
*Validates: FR-TAG-2 (create tag success)*

**TAG-S2 — Duplicate name within user → 409**
Given a user who already owns a tag named "Work",
When POST /tags is called with `{ name: "Work", color: "#000000" }`,
Then 409 TAG_NAME_DUPLICATE is returned.
*Validates: FR-TAG-2 (duplicate name within user → 409)*

**TAG-S3 — Same name across different users → 201**
Given user A has a tag named "Work" and user B does not,
When user B calls POST /tags with `{ name: "Work", color: "#AABBCC" }`,
Then 201 is returned successfully.
*Validates: FR-TAG-2 (same name allowed across users)*

### Cross-user Scoping (FR-TAG-1)

**TAG-S4 — PATCH another user's tag → 404**
Given a tag belonging to user A,
When user B calls PATCH /tags/:id with `{ name: "Renamed" }`,
Then 404 TAG_NOT_FOUND is returned (not 403).
*Validates: FR-TAG-1 (cross-user tag access returns 404; existence never leaked)*

### Delete (FR-TAG-2)

**TAG-S5 — Delete own tag → 204; absent from subsequent list**
Given a valid access token and an owned tag,
When DELETE /tags/:id is called,
Then 204 No Content is returned and the tag no longer appears in GET /tags.
*Validates: FR-TAG-2 (soft delete; tag absent from list endpoint post-deletion)*

### Input Validation (FR-TAG-2)

**TAG-VALIDATION-S1 — Invalid color format → 400**
When POST /tags is called with `{ name: "X", color: "red" }`,
Then 400 VALIDATION_FAILED is returned.
*Validates: FR-TAG-2 (color must match `^#[0-9a-fA-F]{6}$`)*

**TAG-VALIDATION-S2 — Name exceeds 50 chars → 400**
When POST /tags is called with a name of 51 characters,
Then 400 VALIDATION_FAILED is returned.
*Validates: FR-TAG-2 (name max 50 chars)*

### List with noteCount (FR-TAG-3)

**TAG-LIST-S1 — noteCount reflects non-deleted note associations**
Given user has tag A associated with 3 non-deleted notes and tag B with 1 non-deleted note,
When GET /tags is called,
Then 200 is returned with `[{ id, name, color, noteCount: 3 }, { id, name, color, noteCount: 1 }]`
and the DB query count is exactly 1 (no N+1).
*Validates: FR-TAG-3 (noteCount accurate; no N+1)*

**TAG-LIST-S2 — noteCount excludes soft-deleted notes**
Given tag A is associated with 3 notes, 1 of which has `deletedAt` set,
When GET /tags is called,
Then tag A's noteCount is 2.
*Validates: FR-TAG-3 (noteCount counts only non-deleted notes)*

## Dependencies
- AB-1004 merged (provides Tag model stub, NoteTag junction, three-layer structure)
- AB-1005 merged (confirms no tag-related list logic conflicts)
