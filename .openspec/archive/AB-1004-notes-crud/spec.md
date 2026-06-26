---
status: APPROVED
ticket: AB-1004
---

# Notes CRUD + Three-Layer Refactor

## Overview
AB-1004 delivers two things in one ticket. First, it retrofits the existing auth routes
(AB-1002/1003) from their fat-handler pattern to the FR-ARCH-1 three-layer structure
(routes → controllers → services), absorbing the work drafted in
`.openspec/changes/AB-1003b-auth-layer-refactor/` which can be archived after this ticket merges.
Second, it introduces the core note-taking model with four endpoints: create, read, update (with
version snapshot), and soft delete. All new endpoint code is written three-layer from the start.

## Goals
- Retrofit auth routes to FR-ARCH-1 (zero behavioral delta on auth)
- Define the `Note` and `NoteVersion` Prisma models + migration
- Define a `Tag` model stub (CRUD endpoints ship in AB-1006)
- Implement POST /notes, GET /notes/:id, PATCH /notes/:id, DELETE /notes/:id

## Non-Goals
- List, sort, filter endpoints (FR-NOTE-5..7 → AB-1005)
- Tag CRUD endpoints (FR-TAG-1..3 → AB-1006)
- Full-text search `body_text` column (deferred to AB-1007)
- Sending any real email or push notifications

## FRs Covered
- FR-ARCH-1 — three-layer structure for all AB-1004+ endpoints; auth routes retrofitted
- FR-NOTE-1 — create note
- FR-NOTE-2 — read own notes only
- FR-NOTE-3 — update note + create version snapshot
- FR-NOTE-4 — soft delete

## API Contract

| Method | Path | Auth | Success | FRs |
|--------|------|------|---------|-----|
| POST | /notes | Bearer JWT | 201 Note | FR-NOTE-1 |
| GET | /notes/:id | Bearer JWT | 200 Note | FR-NOTE-2 |
| PATCH | /notes/:id | Bearer JWT | 200 Note | FR-NOTE-3 |
| DELETE | /notes/:id | Bearer JWT | 204 | FR-NOTE-4 |

Full request/response shapes and error codes are in `delta-openapi.yaml`.

## Data Model

### New Prisma models

```prisma
model Note {
  id        String    @id @default(cuid())
  userId    String
  title     String    @db.VarChar(200)
  body      Json
  version   Int       @default(1)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  user     User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags     NoteTag[]
  versions NoteVersion[]
}

model NoteVersion {
  id      String   @id @default(cuid())
  noteId  String
  version Int
  title   String   @db.VarChar(200)
  body    Json
  savedAt DateTime @default(now())

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
}

model Tag {
  id        String    @id @default(cuid())
  userId    String
  name      String    @db.VarChar(50)
  color     String    @db.VarChar(7)   // hex e.g. #FF5733
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  notes NoteTag[]

  @@unique([userId, name])
}

model NoteTag {
  noteId String
  tagId  String

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
}
```

**Notes:**
- `body` is stored as `Json` (PostgreSQL `jsonb`). Plain-text extraction (`body_text`) is deferred to AB-1007.
- `Tag` model is defined here as a stub so `NoteTag` has a valid FK. CRUD endpoints ship in AB-1006.
- `NoteVersion` is defined here because `PATCH /notes/:id` (FR-NOTE-3) snapshots into it. The list/view/restore endpoints ship in AB-1009.

## Ticket-Specific Decisions

1. **Auth refactor absorbed from AB-1003b:** The draft at `.openspec/changes/AB-1003b-auth-layer-refactor/` is merged into this ticket rather than being its own ticket. The structural decisions there (one service file, one controller file for all auth; routes stay in `routes/auth/` subfolder) are adopted unchanged.

2. **Tag model stub in AB-1004 migration:** AB-1006 will not need a new migration for the Tag table — just controllers and services. This avoids a future ALTER TABLE and allows AB-1004's PATCH endpoint to validate tag ownership immediately.

3. **NoteVersion created in AB-1004 migration:** FR-NOTE-3 snapshots on every PATCH. AB-1009 can add the list/view/restore API on top of the table without an ALTER TABLE.

4. **body_text deferred to AB-1007:** The FTS `body_text` column and tsvector index are deferred to avoid adding dead Prisma middleware in AB-1004 that won't be exercised until AB-1007.

5. **PATCH partial update semantics:** Only fields present in the request body are updated (`title`, `body`, `tagIds` are all optional). Missing fields are left unchanged. This matches the `body { title?, body?, tagIds? }` shape in FR-NOTE-3.

6. **tagIds replaces entire tag set on PATCH:** When `tagIds` is provided, the note's tag set is replaced atomically (delete all existing NoteTag rows for this note, insert new ones) within the same transaction as the snapshot + update. This is the simplest semantics consistent with FR-NOTE-3.

7. **Cross-user note access returns 404 (not 403):** FR-NOTE-2 explicitly states "never 403 — don't leak existence". The service layer must apply `WHERE userId = currentUserId` before returning any error.

## Scenarios

### Auth Refactor (FR-ARCH-1)

**ARCH-REFACTOR-S1 — Auth integration tests pass after refactor**
Given the auth routes are refactored to three-layer structure,
When the full auth test suite runs (AUTH-REGISTER-S1..S4, AUTH-LOGIN-S1..S4, AUTH-REFRESH-S1..S3, AUTH-LOGOUT-S1..S2, AUTH-FORGOT-S1..S3, AUTH-OTP-S1..S5),
Then all scenarios pass with zero changes to test code.
*Validates: FR-ARCH-1 (zero behavioral delta guarantee)*

**ARCH-REFACTOR-S2 — Service file has no Express types**
Given `apps/api/src/services/auth.service.ts` is written,
When the file is statically checked for imports from `express`,
Then no `Request`, `Response`, or `NextFunction` import is found.
*Validates: FR-ARCH-1 (service layer constraint)*

**ARCH-REFACTOR-S3 — Controller file has no Prisma imports**
Given `apps/api/src/controllers/auth.controller.ts` is written,
When the file is statically checked for imports,
Then no `@prisma/client` import is found.
*Validates: FR-ARCH-1 (controller layer constraint)*

**ARCH-REFACTOR-S4 — Route files contain only wiring**
Given the auth route files (`register.ts`, `login.ts`, etc.) are refactored,
When each file is reviewed,
Then each file contains only `router.post/…`, `.catch(next)`, and a single controller import — no validation logic, no DB calls, no response shaping.
*Validates: FR-ARCH-1 (route layer constraint)*

### Create Note (FR-NOTE-1)

**NOTE-CREATE-S1 — Happy path, no tags**
Given a valid access token and body `{ title: "My Note", body: { type: "doc", content: [] } }`,
When POST /notes is called,
Then 201 is returned with `{ id, title, body, tagIds: [], createdAt, updatedAt, version: 1 }`.
*Validates: FR-NOTE-1*

**NOTE-CREATE-S2 — With valid owned tagIds**
Given a valid access token and a tag owned by the current user,
When POST /notes is called with `{ title, body, tagIds: [validTagId] }`,
Then 201 is returned and the note's tagIds contains the given tag.
*Validates: FR-NOTE-1 (tagIds validation)*

**NOTE-CREATE-S3 — Foreign tagId rejected**
Given a valid access token and a tag owned by a different user,
When POST /notes is called with `{ title, body, tagIds: [foreignTagId] }`,
Then 422 INVALID_TAG is returned.
*Validates: FR-NOTE-1 (foreign tagIds rejected)*

### Read Note (FR-NOTE-2)

**NOTE-READ-S1 — Happy path**
Given a valid access token and a note owned by the current user,
When GET /notes/:id is called,
Then 200 is returned with the full note.
*Validates: FR-NOTE-2*

**NOTE-READ-S2 — Cross-user access returns 404**
Given a valid access token and a note owned by a different user,
When GET /notes/:id is called,
Then 404 NOTE_NOT_FOUND is returned (not 403).
*Validates: FR-NOTE-2 (no existence leak)*

**NOTE-READ-S3 — Soft-deleted note returns 404**
Given a valid access token and a note that has been soft-deleted (`deletedAt IS NOT NULL`),
When GET /notes/:id is called by the owner,
Then 404 NOTE_NOT_FOUND is returned.
*Validates: FR-NOTE-2 (soft-deleted = 404)*

### Update Note (FR-NOTE-3)

**NOTE-UPDATE-S1 — Happy path increments version**
Given a valid access token and an owned note at version 1,
When PATCH /notes/:id is called with `{ title: "Updated" }`,
Then 200 is returned with `version: 2` and `title: "Updated"`.
*Validates: FR-NOTE-3*

**NOTE-UPDATE-S2 — Snapshot precedes update**
Given a valid access token and an owned note at version 1 with title "Original",
When PATCH /notes/:id is called with `{ title: "New Title" }`,
Then a NoteVersion row exists with `version: 1` and `title: "Original"` (the pre-update state), and the note now has `title: "New Title"` and `version: 2`.
*Validates: FR-NOTE-3 (snapshot precedes update)*

**NOTE-UPDATE-S3 — Snapshot + update are atomic**
Given a simulated DB failure injected mid-transaction,
When PATCH /notes/:id is called,
Then neither the snapshot row nor the note update is persisted (full rollback).
*Validates: FR-NOTE-3 (atomicity)*

### Soft Delete (FR-NOTE-4)

**NOTE-DELETE-S1 — Sets deletedAt, returns 204**
Given a valid access token and an owned note,
When DELETE /notes/:id is called,
Then 204 No Content is returned and the note's `deletedAt` is set to the current timestamp.
*Validates: FR-NOTE-4*

**NOTE-DELETE-S2 — Deleted note returns 404 on subsequent read**
Given a note that was soft-deleted,
When GET /notes/:id is called by the owner,
Then 404 NOTE_NOT_FOUND is returned.
*Validates: FR-NOTE-4 (deleted note absent from read endpoints)*

## Dependencies
- AB-1003 merged (provides starting codebase; auth routes to be refactored)
- AB-1003b-auth-layer-refactor spec archived after this ticket merges (absorbed)
